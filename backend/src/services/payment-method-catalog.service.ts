import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

function isPaymentMethodDecodeMismatch(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2032" &&
    "meta" in error &&
    (error as { meta?: { modelName?: string; field?: string } }).meta?.modelName === "Payment" &&
    (error as { meta?: { modelName?: string; field?: string } }).meta?.field === "method"
  );
}

async function countPaymentsUsingMethod(clinicId: string, methodCode: string) {
  try {
    return await prisma.payment.count({
      where: { clinicId, method: methodCode, deletedAt: null }
    });
  } catch (error) {
    if (!isPaymentMethodDecodeMismatch(error)) throw error;
    const rows = await prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Payment"
      WHERE "deletedAt" IS NULL
        AND "clinicId" = ${clinicId}
        AND "method"::text = ${methodCode}
    `);
    return rows[0]?.total ?? 0;
  }
}

const DEFAULT_METHODS = [
  { code: "CASH", name: "Cash", nameAr: "نقدي" },
  { code: "CARD", name: "Card", nameAr: "بطاقة" },
  { code: "ONLINE", name: "Online", nameAr: "أونلاين" },
  { code: "INSURANCE", name: "Insurance", nameAr: "تأمين" }
] as const;

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "_");
}

async function ensureDefaultsForClinic(clinicId: string) {
  const count = await prisma.paymentMethodCatalog.count({
    where: { clinicId, deletedAt: null }
  });
  if (count > 0) return;
  await prisma.paymentMethodCatalog.createMany({
    data: DEFAULT_METHODS.map((m) => ({
      clinicId,
      code: m.code,
      name: m.name,
      nameAr: m.nameAr,
      isActive: true
    })),
    skipDuplicates: true
  });
}

export const paymentMethodCatalogService = {
  async listForClinic(clinicId: string) {
    await ensureDefaultsForClinic(clinicId);
    return prisma.paymentMethodCatalog.findMany({
      where: { clinicId, deletedAt: null, isActive: true },
      orderBy: [{ name: "asc" }]
    });
  },

  async manageListForClinic(clinicId: string) {
    await ensureDefaultsForClinic(clinicId);
    return prisma.paymentMethodCatalog.findMany({
      where: { clinicId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
  },

  async createForClinic(
    clinicId: string,
    data: { code: string; name: string; nameAr: string; isActive?: boolean }
  ) {
    const code = normalizeCode(data.code);
    if (!code) throw new AppError("Code is required", 400);
    const duplicate = await prisma.paymentMethodCatalog.findFirst({
      where: { clinicId, code, deletedAt: null },
      select: { id: true }
    });
    if (duplicate) {
      throw new AppError("Payment method code already exists for this clinic", 409);
    }
    return prisma.paymentMethodCatalog.create({
      data: {
        clinicId,
        code,
        name: data.name.trim(),
        nameAr: data.nameAr.trim(),
        isActive: data.isActive ?? true
      }
    });
  },

  async updateForClinic(
    clinicId: string,
    id: string,
    data: {
      code?: string;
      name?: string;
      nameAr?: string;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.paymentMethodCatalog.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true, code: true }
    });
    if (!existing) throw new AppError("Payment method not found", 404);

    if (data.code !== undefined) {
      const nextCode = normalizeCode(data.code);
      const duplicate = await prisma.paymentMethodCatalog.findFirst({
        where: { clinicId, code: nextCode, deletedAt: null, NOT: { id } },
        select: { id: true }
      });
      if (duplicate) {
        throw new AppError("Payment method code already exists for this clinic", 409);
      }
    }

    return prisma.paymentMethodCatalog.update({
      where: { id: existing.id },
      data: {
        ...(data.code !== undefined ? { code: normalizeCode(data.code) } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.nameAr !== undefined ? { nameAr: data.nameAr.trim() } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });
  },

  async deleteForClinic(clinicId: string, id: string) {
    const existing = await prisma.paymentMethodCatalog.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true, code: true }
    });
    if (!existing) throw new AppError("Payment method not found", 404);

    const [paymentUse, invoiceUse] = await Promise.all([
      countPaymentsUsingMethod(clinicId, existing.code),
      prisma.invoice.count({
        where: { clinicId, paymentMethodCode: existing.code, deletedAt: null }
      })
    ]);
    if (paymentUse > 0 || invoiceUse > 0) {
      throw new AppError("Cannot delete method used by payments or invoices", 400);
    }

    await prisma.paymentMethodCatalog.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });
    return { count: 1 };
  },

  async assertMethodAllowed(clinicId: string, code: string) {
    await ensureDefaultsForClinic(clinicId);
    const normalized = normalizeCode(code);
    const method = await prisma.paymentMethodCatalog.findFirst({
      where: { clinicId, code: normalized, deletedAt: null, isActive: true },
      select: { code: true }
    });
    if (!method) {
      throw new AppError("Invalid payment method", 400);
    }
    return normalized;
  }
};
