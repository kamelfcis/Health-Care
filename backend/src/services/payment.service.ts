import { InvoiceStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

interface ListInput {
  clinicId?: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  /** Inclusive start (YYYY-MM-DD), UTC day bounds */
  createdFrom?: string;
  /** Inclusive end (YYYY-MM-DD), UTC day bounds */
  createdTo?: string;
}

const EPS = 0.005;

export function invoiceTotalDue(inv: { amount: number; taxAmount: number; discount: number }) {
  return Math.max(0, inv.amount + inv.taxAmount - inv.discount);
}

/** Recompute PENDING / OVERDUE / PAID from successful payments. Skips DRAFT and CANCELLED. */
export async function syncInvoiceStatusFromPayments(invoiceId: string) {
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: {
      payments: { where: { deletedAt: null } }
    }
  });
  if (!inv) return;
  if (inv.status === "CANCELLED" || inv.status === "DRAFT") return;

  const totalDue = invoiceTotalDue(inv);
  const paidSum = inv.payments.filter((p) => p.status === "SUCCESS").reduce((s, p) => s + p.amount, 0);

  let next: InvoiceStatus;
  if (totalDue <= EPS) {
    next = "PAID";
  } else if (paidSum + EPS >= totalDue) {
    next = "PAID";
  } else {
    const due = inv.dueDate;
    const overdue = due != null && new Date() > due;
    next = overdue ? "OVERDUE" : "PENDING";
  }

  if (inv.status !== next) {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: next } });
  }
}

export const paymentService = {
  async list(input: ListInput) {
    const normalizedSearch = input.search?.trim();
    const isShortSearch = Boolean(normalizedSearch && normalizedSearch.length <= 3);
    const createdBounds =
      input.createdFrom || input.createdTo
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: new Date(`${input.createdFrom}T00:00:00.000Z`) } : {}),
              ...(input.createdTo ? { lte: new Date(`${input.createdTo}T23:59:59.999Z`) } : {})
            }
          }
        : {};
    const where = {
      ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.method ? { method: input.method } : {}),
      ...createdBounds,
      ...(normalizedSearch
        ? {
            OR: [
              ...(isShortSearch
                ? [
                    { transactionRef: { startsWith: normalizedSearch, mode: "insensitive" as const } },
                    { invoice: { invoiceNumber: { startsWith: normalizedSearch, mode: "insensitive" as const } } }
                  ]
                : []),
              { transactionRef: { contains: normalizedSearch, mode: "insensitive" as const } },
              { invoice: { invoiceNumber: { contains: normalizedSearch, mode: "insensitive" as const } } },
              {
                invoice: {
                  is: {
                    patient: { fullName: { contains: normalizedSearch, mode: "insensitive" as const } }
                  }
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { invoice: true },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.payment.count({ where })
    ]);
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async create(
    clinicId: string,
    data: {
      invoiceId: string;
      amount: number;
      method: PaymentMethod;
      transactionRef?: string;
      status?: PaymentStatus;
    }
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: data.invoiceId,
        clinicId,
        deletedAt: null,
        status: { notIn: ["CANCELLED"] }
      }
    });
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    const status = data.status ?? "SUCCESS";
    const payment = await prisma.payment.create({
      data: {
        clinicId,
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
        transactionRef: data.transactionRef,
        status,
        paidAt: status === "SUCCESS" ? new Date() : null
      }
    });

    await syncInvoiceStatusFromPayments(data.invoiceId);
    return payment;
  },

  async update(
    id: string,
    clinicId: string | undefined,
    data: { status?: PaymentStatus; transactionRef?: string; amount?: number; method?: PaymentMethod }
  ) {
    const existing = await prisma.payment.findFirst({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      select: { id: true, clinicId: true, invoiceId: true }
    });
    if (!existing) {
      throw new AppError("Payment not found", 404);
    }

    const patch: {
      status?: PaymentStatus;
      transactionRef?: string;
      amount?: number;
      method?: PaymentMethod;
      paidAt?: Date | null;
    } = {};
    if (data.transactionRef !== undefined) patch.transactionRef = data.transactionRef;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.method !== undefined) patch.method = data.method;
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.paidAt = data.status === "SUCCESS" ? new Date() : null;
    }

    await prisma.payment.updateMany({
      where: { id: existing.id, clinicId: existing.clinicId, deletedAt: null },
      data: patch
    });

    await syncInvoiceStatusFromPayments(existing.invoiceId);
    const updated = await prisma.payment.findFirst({ where: { id: existing.id } });
    return updated;
  },

  async remove(id: string, clinicId: string | undefined) {
    const existing = await prisma.payment.findFirst({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      select: { id: true, clinicId: true, invoiceId: true }
    });
    if (!existing) {
      throw new AppError("Payment not found", 404);
    }

    await prisma.payment.updateMany({
      where: { id: existing.id, clinicId: existing.clinicId, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    await syncInvoiceStatusFromPayments(existing.invoiceId);
    return { count: 1 };
  },

  async stats(clinicId?: string) {
    const base = { ...(clinicId ? { clinicId } : {}), deletedAt: null as null };
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [successTotal, pendingCount, failedCount, refundedCount, monthSuccess] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...base, status: "SUCCESS" },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.count({ where: { ...base, status: "PENDING" } }),
      prisma.payment.count({ where: { ...base, status: "FAILED" } }),
      prisma.payment.count({ where: { ...base, status: "REFUNDED" } }),
      prisma.payment.aggregate({
        where: {
          ...(clinicId ? { clinicId } : {}),
          deletedAt: null,
          status: "SUCCESS",
          createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true },
        _count: true
      })
    ]);

    return {
      successTotalAmount: successTotal._sum.amount ?? 0,
      successCount: successTotal._count,
      pendingCount,
      failedCount,
      refundedCount,
      thisMonthAmount: monthSuccess._sum.amount ?? 0,
      thisMonthCount: monthSuccess._count
    };
  }
};
