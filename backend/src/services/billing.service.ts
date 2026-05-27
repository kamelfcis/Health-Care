import { InvoiceSourceType, InvoiceStatus, Prisma, VisitEntryType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { invoiceTotalDue, syncInvoiceStatusFromPayments } from "./payment.service";

interface ListInput {
  clinicId?: string;
  patientId?: string;
  invoiceId?: string;
  /** Only PENDING + OVERDUE (collectible). Ignored if `status` or `invoiceId` is set. */
  openOnly?: boolean;
  page: number;
  pageSize: number;
  search?: string;
  status?: InvoiceStatus;
  sort?: "created_desc" | "due_asc";
  /** Inclusive due date lower bound YYYY-MM-DD (UTC) */
  dueFrom?: string;
  /** Inclusive due date upper bound YYYY-MM-DD (UTC) */
  dueTo?: string;
  invoiceType?: InvoiceSourceType;
}

export type BillingCreateInput = {
  patientId: string;
  appointmentId?: string;
  invoiceNumber?: string;
  amount: number;
  taxAmount?: number;
  discount?: number;
  dueDate?: string;
  notes?: string;
  status?: InvoiceStatus;
  invoiceType?: InvoiceSourceType;
};

const INVOICE_LIST_INCLUDE = {
  patient: true,
  appointment: { select: { id: true, startsAt: true, status: true, entryType: true } },
  patientProcedure: { select: { id: true, name: true } },
  payments: { where: { deletedAt: null } }
} as const;

function entryTypeToInvoiceType(entryType: VisitEntryType): InvoiceSourceType {
  return entryType === "CONSULTATION" ? "CONSULTATION" : "EXAM";
}

async function assertAppointmentBelongsToPatient(clinicId: string, patientId: string, appointmentId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId, patientId, deletedAt: null }
  });
  if (!appt) {
    throw new AppError("Appointment not found for this patient", 404);
  }
  return appt;
}

async function resolveInvoiceTypeForCreate(
  clinicId: string,
  patientId: string,
  appointmentId: string | null,
  provided?: InvoiceSourceType
): Promise<InvoiceSourceType> {
  if (provided) return provided;
  if (appointmentId) {
    const appt = await assertAppointmentBelongsToPatient(clinicId, patientId, appointmentId);
    return entryTypeToInvoiceType(appt.entryType);
  }
  return "OTHER";
}

export const billingService = {
  async list(input: ListInput) {
    const normalizedSearch = input.search?.trim();
    const isShortSearch = Boolean(normalizedSearch && normalizedSearch.length <= 3);
    const where = {
      ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      ...(input.patientId ? { patientId: input.patientId } : {}),
      ...(input.invoiceId?.trim() ? { id: input.invoiceId.trim() } : {}),
      deletedAt: null,
      ...(input.status
        ? { status: input.status }
        : input.openOnly && !input.invoiceId?.trim()
          ? { status: { in: ["PENDING", "OVERDUE"] as InvoiceStatus[] } }
          : {}),
      ...(normalizedSearch
        ? {
            OR: [
              ...(isShortSearch
                ? [
                    { invoiceNumber: { startsWith: normalizedSearch, mode: "insensitive" as const } },
                    { notes: { startsWith: normalizedSearch, mode: "insensitive" as const } }
                  ]
                : []),
              { invoiceNumber: { contains: normalizedSearch, mode: "insensitive" as const } },
              { notes: { contains: normalizedSearch, mode: "insensitive" as const } },
              {
                patient: { is: { fullName: { contains: normalizedSearch, mode: "insensitive" as const } } }
              }
            ]
          }
        : {}),
      ...(input.dueFrom || input.dueTo
        ? {
            dueDate: {
              ...(input.dueFrom ? { gte: new Date(`${input.dueFrom}T00:00:00.000Z`) } : {}),
              ...(input.dueTo ? { lte: new Date(`${input.dueTo}T23:59:59.999Z`) } : {})
            }
          }
        : {}),
      ...(input.invoiceType ? { invoiceType: input.invoiceType } : {})
    };

    const orderBy: Prisma.InvoiceOrderByWithRelationInput | Prisma.InvoiceOrderByWithRelationInput[] =
      input.sort === "due_asc"
        ? [{ dueDate: "asc" }, { createdAt: "desc" }]
        : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: INVOICE_LIST_INCLUDE,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy
      }),
      prisma.invoice.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async stats(clinicId?: string) {
    const base = { ...(clinicId ? { clinicId } : {}), deletedAt: null as null };
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendingCount, overdueCount, paidCount, draftCount, outstandingAgg, paymentsThisMonth] = await Promise.all([
      prisma.invoice.count({ where: { ...base, status: "PENDING" } }),
      prisma.invoice.count({ where: { ...base, status: "OVERDUE" } }),
      prisma.invoice.count({ where: { ...base, status: "PAID" } }),
      prisma.invoice.count({ where: { ...base, status: "DRAFT" } }),
      prisma.invoice.aggregate({
        where: { ...base, status: { in: ["PENDING", "OVERDUE"] } },
        _sum: { amount: true, taxAmount: true, discount: true }
      }),
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

    const outstanding =
      (outstandingAgg._sum.amount ?? 0) + (outstandingAgg._sum.taxAmount ?? 0) - (outstandingAgg._sum.discount ?? 0);

    return {
      pendingCount,
      overdueCount,
      paidCount,
      draftCount,
      outstandingTotal: Math.max(0, outstanding),
      paymentsThisMonthTotal: paymentsThisMonth._sum.amount ?? 0,
      paymentsThisMonthCount: paymentsThisMonth._count
    };
  },

  async create(clinicId: string, data: BillingCreateInput) {
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, clinicId, deletedAt: null }
    });
    if (!patient) {
      throw new AppError("Patient not found", 404);
    }

    let appointmentId: string | null = null;
    const rawAppt = data.appointmentId?.trim();
    if (rawAppt) {
      appointmentId = rawAppt;
    }

    const invoiceType = await resolveInvoiceTypeForCreate(
      clinicId,
      data.patientId,
      appointmentId,
      data.invoiceType
    );

    const invoiceNumber = data.invoiceNumber?.trim() || undefined;

    const taxAmount = data.taxAmount ?? 0;
    const discount = data.discount ?? 0;
    const requestedStatus = data.status ?? "PENDING";
    const markPaidOnCreate = requestedStatus === "PAID";
    const initialStatus = markPaidOnCreate ? "PENDING" : requestedStatus;

    const created = await prisma.$transaction(async (tx) => {
      let resolvedInvoiceNumber = invoiceNumber;
      if (!resolvedInvoiceNumber) {
        const counter = await tx.clinicCounter.upsert({
          where: { clinicId },
          create: { clinicId, lastPatientFileNumber: 0, lastInvoiceSequence: 1 },
          update: { lastInvoiceSequence: { increment: 1 } }
        });
        resolvedInvoiceNumber = `INV-${String(counter.lastInvoiceSequence).padStart(5, "0")}`;
      }

      const duplicateNum = await tx.invoice.findFirst({
        where: { clinicId, invoiceNumber: resolvedInvoiceNumber, deletedAt: null }
      });
      if (duplicateNum) {
        throw new AppError("Invoice number already exists for this clinic", 409);
      }

      const invoice = await tx.invoice.create({
        data: {
          clinicId,
          patientId: data.patientId,
          appointmentId,
          invoiceNumber: resolvedInvoiceNumber,
          amount: data.amount,
          taxAmount,
          discount,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          notes: data.notes,
          status: initialStatus,
          invoiceType
        }
      });

      if (markPaidOnCreate) {
        const totalDue = invoiceTotalDue(invoice);
        if (totalDue > 0.005) {
          await tx.payment.create({
            data: {
              clinicId,
              invoiceId: invoice.id,
              amount: totalDue,
              method: "CASH",
              status: "SUCCESS",
              paidAt: new Date()
            }
          });
        }
      }

      return invoice;
    });

    await syncInvoiceStatusFromPayments(created.id);

    return prisma.invoice.findFirst({
      where: { id: created.id },
      include: INVOICE_LIST_INCLUDE
    });
  },

  async update(
    id: string,
    clinicId: string | undefined,
    data: {
      status?: InvoiceStatus;
      notes?: string;
      amount?: number;
      taxAmount?: number;
      discount?: number;
      dueDate?: string | null;
      appointmentId?: string | null;
      invoiceType?: InvoiceSourceType;
    }
  ) {
    const existing = await prisma.invoice.findFirst({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      include: { patientProcedure: { select: { id: true } } }
    });
    if (!existing) {
      throw new AppError("Invoice not found", 404);
    }

    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.taxAmount !== undefined) patch.taxAmount = data.taxAmount;
    if (data.discount !== undefined) patch.discount = data.discount;
    if (data.dueDate !== undefined) {
      patch.dueDate = data.dueDate === null || data.dueDate === "" ? null : new Date(data.dueDate);
    }

    if (data.appointmentId !== undefined) {
      if (data.appointmentId === null || data.appointmentId === "") {
        patch.appointmentId = null;
      } else {
        await assertAppointmentBelongsToPatient(existing.clinicId, existing.patientId, data.appointmentId);
        patch.appointmentId = data.appointmentId;
      }
    }

    if (data.invoiceType !== undefined) {
      if (existing.patientProcedure) {
        throw new AppError("Procedure invoice type cannot be changed", 400);
      }
      patch.invoiceType = data.invoiceType;
    }

    const result = await prisma.invoice.updateMany({
      where: { id: existing.id, clinicId: existing.clinicId, deletedAt: null },
      data: patch as {
        status?: InvoiceStatus;
        notes?: string;
        amount?: number;
        taxAmount?: number;
        discount?: number;
        dueDate?: Date | null;
        appointmentId?: string | null;
        invoiceType?: InvoiceSourceType;
      }
    });
    if (!result.count) {
      throw new AppError("Invoice not found", 404);
    }

    const inv = await prisma.invoice.findFirst({ where: { id } });
    if (inv && inv.status !== "CANCELLED" && inv.status !== "DRAFT") {
      await syncInvoiceStatusFromPayments(id);
    }

    return prisma.invoice.findFirst({
      where: { id },
      include: INVOICE_LIST_INCLUDE
    });
  },

  async remove(id: string, clinicId: string | undefined) {
    const result = await prisma.invoice.updateMany({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      data: { deletedAt: new Date(), status: "CANCELLED" }
    });
    if (!result.count) {
      throw new AppError("Invoice not found", 404);
    }
    return result;
  }
};
