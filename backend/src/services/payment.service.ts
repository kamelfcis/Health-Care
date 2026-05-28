import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { paymentMethodCatalogService } from "./payment-method-catalog.service";

interface ListInput {
  clinicId?: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: PaymentStatus;
  method?: string;
  /** Inclusive start (YYYY-MM-DD), UTC day bounds */
  createdFrom?: string;
  /** Inclusive end (YYYY-MM-DD), UTC day bounds */
  createdTo?: string;
}

const EPS = 0.005;
let useLegacyPaymentMethodRead = false;

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

    const skip = (input.page - 1) * input.pageSize;
    let items: Array<{
      id: string;
      clinicId: string;
      invoiceId: string;
      transactionRef: string | null;
      amount: number;
      method: string;
      status: PaymentStatus;
      paidAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      invoice: { id: string; invoiceNumber: string } | null;
    }> = [];
    let total = 0;
    const readUsingLegacySql = async () => {
      // Backward compatibility for databases where Payment.method is still enum-typed.
      const whereSql: Prisma.Sql[] = [Prisma.sql`p."deletedAt" IS NULL`];
      if (input.clinicId) whereSql.push(Prisma.sql`p."clinicId" = ${input.clinicId}`);
      if (input.status) whereSql.push(Prisma.sql`p."status" = ${input.status}`);
      if (input.method) whereSql.push(Prisma.sql`p."method"::text = ${input.method}`);
      if (input.createdFrom) whereSql.push(Prisma.sql`p."createdAt" >= ${new Date(`${input.createdFrom}T00:00:00.000Z`)}`);
      if (input.createdTo) whereSql.push(Prisma.sql`p."createdAt" <= ${new Date(`${input.createdTo}T23:59:59.999Z`)}`);
      if (normalizedSearch) {
        const like = `%${normalizedSearch}%`;
        const orParts: Prisma.Sql[] = [
          Prisma.sql`p."transactionRef" ILIKE ${like}`,
          Prisma.sql`i."invoiceNumber" ILIKE ${like}`,
          Prisma.sql`pat."fullName" ILIKE ${like}`
        ];
        if (isShortSearch) {
          const prefix = `${normalizedSearch}%`;
          orParts.unshift(
            Prisma.sql`p."transactionRef" ILIKE ${prefix}`,
            Prisma.sql`i."invoiceNumber" ILIKE ${prefix}`
          );
        }
        whereSql.push(Prisma.sql`(${Prisma.join(orParts, " OR ")})`);
      }
      const whereClause = whereSql.length ? Prisma.sql`WHERE ${Prisma.join(whereSql, " AND ")}` : Prisma.empty;
      const [rawItems, rawCount] = await Promise.all([
        prisma.$queryRaw<
          Array<{
            id: string;
            clinicId: string;
            invoiceId: string;
            transactionRef: string | null;
            amount: number;
            method: string;
            status: PaymentStatus;
            paidAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            invoiceNumber: string | null;
          }>
        >(Prisma.sql`
          SELECT
            p."id",
            p."clinicId",
            p."invoiceId",
            p."transactionRef",
            p."amount",
            p."method"::text AS "method",
            p."status",
            p."paidAt",
            p."createdAt",
            p."updatedAt",
            p."deletedAt",
            i."invoiceNumber"
          FROM "Payment" p
          LEFT JOIN "Invoice" i ON i."id" = p."invoiceId"
          LEFT JOIN "Patient" pat ON pat."id" = i."patientId"
          ${whereClause}
          ORDER BY p."createdAt" DESC
          OFFSET ${skip}
          LIMIT ${input.pageSize}
        `),
        prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
          SELECT COUNT(*)::int AS total
          FROM "Payment" p
          LEFT JOIN "Invoice" i ON i."id" = p."invoiceId"
          LEFT JOIN "Patient" pat ON pat."id" = i."patientId"
          ${whereClause}
        `)
      ]);
      items = rawItems.map((row) => ({
        id: row.id,
        clinicId: row.clinicId,
        invoiceId: row.invoiceId,
        transactionRef: row.transactionRef,
        amount: row.amount,
        method: row.method,
        status: row.status,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
        invoice: row.invoiceNumber ? { id: row.invoiceId, invoiceNumber: row.invoiceNumber } : null
      }));
      total = rawCount[0]?.total ?? 0;
    };

    if (useLegacyPaymentMethodRead) {
      await readUsingLegacySql();
    } else {
      try {
        [items, total] = await Promise.all([
          prisma.payment.findMany({
            where,
            include: { invoice: true },
            skip,
            take: input.pageSize,
            orderBy: { createdAt: "desc" }
          }),
          prisma.payment.count({ where })
        ]);
      } catch (error) {
      const isMethodDecodeMismatch =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2032" &&
        "meta" in error &&
        (error as { meta?: { modelName?: string; field?: string } }).meta?.modelName === "Payment" &&
        (error as { meta?: { modelName?: string; field?: string } }).meta?.field === "method";
      if (!isMethodDecodeMismatch) throw error;
        useLegacyPaymentMethodRead = true;
        await readUsingLegacySql();
      }
    }
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async create(
    clinicId: string,
    data: {
      invoiceId: string;
      amount: number;
      method: string;
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
    const methodCode = await paymentMethodCatalogService.assertMethodAllowed(clinicId, data.method);
    const payment = await prisma.payment.create({
      data: {
        clinicId,
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: methodCode,
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
    data: { status?: PaymentStatus; transactionRef?: string; amount?: number; method?: string }
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
      method?: string;
      paidAt?: Date | null;
    } = {};
    if (data.transactionRef !== undefined) patch.transactionRef = data.transactionRef;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.method !== undefined) {
      patch.method = await paymentMethodCatalogService.assertMethodAllowed(existing.clinicId, data.method);
    }
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
