import { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { syncInvoiceStatusFromPayments } from "./payment.service";

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
};

async function assertAppointmentBelongsToPatient(clinicId: string, patientId: string, appointmentId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId, patientId, deletedAt: null }
  });
  if (!appt) {
    throw new AppError("Appointment not found for this patient", 404);
  }
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
        : {})
    };

    const orderBy: Prisma.InvoiceOrderByWithRelationInput | Prisma.InvoiceOrderByWithRelationInput[] =
      input.sort === "due_asc"
        ? [{ dueDate: "asc" }, { createdAt: "desc" }]
        : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { patient: true, appointment: true, payments: { where: { deletedAt: null } } },
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
      await assertAppointmentBelongsToPatient(clinicId, data.patientId, rawAppt);
      appointmentId = rawAppt;
    }

    let invoiceNumber = data.invoiceNumber?.trim();
    if (!invoiceNumber) {
      const counter = await prisma.clinicCounter.upsert({
        where: { clinicId },
        create: { clinicId, lastPatientFileNumber: 0, lastInvoiceSequence: 1 },
        update: { lastInvoiceSequence: { increment: 1 } }
      });
      invoiceNumber = `INV-${String(counter.lastInvoiceSequence).padStart(5, "0")}`;
    }

    const existingNum = await prisma.invoice.findFirst({
      where: { clinicId, invoiceNumber, deletedAt: null }
    });
    if (existingNum) {
      throw new AppError("Invoice number already exists for this clinic", 409);
    }

    const taxAmount = data.taxAmount ?? 0;
    const discount = data.discount ?? 0;
    const initialStatus = data.status ?? "PENDING";

    const created = await prisma.invoice.create({
      data: {
        clinicId,
        patientId: data.patientId,
        appointmentId,
        invoiceNumber,
        amount: data.amount,
        taxAmount,
        discount,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes,
        status: initialStatus
      }
    });

    await syncInvoiceStatusFromPayments(created.id);

    return prisma.invoice.findFirst({
      where: { id: created.id },
      include: { patient: true, appointment: true, payments: { where: { deletedAt: null } } }
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
    }
  ) {
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
        const inv = await prisma.invoice.findFirst({
          where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
          select: { patientId: true, clinicId: true }
        });
        if (!inv) {
          throw new AppError("Invoice not found", 404);
        }
        await assertAppointmentBelongsToPatient(inv.clinicId, inv.patientId, data.appointmentId);
        patch.appointmentId = data.appointmentId;
      }
    }

    const result = await prisma.invoice.updateMany({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      data: patch as {
        status?: InvoiceStatus;
        notes?: string;
        amount?: number;
        taxAmount?: number;
        discount?: number;
        dueDate?: Date | null;
        appointmentId?: string | null;
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
      include: { patient: true, appointment: true, payments: { where: { deletedAt: null } } }
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
