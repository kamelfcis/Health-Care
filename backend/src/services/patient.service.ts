import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { LeadSource, Profession } from "@prisma/client";

interface ListInput {
  clinicId?: string;
  page: number;
  pageSize: number;
  search?: string;
  requesterRole?: string;
  requesterUserId?: string;
}

export const patientService = {
  async list(input: ListInput) {
    const normalizedSearch = input.search?.trim();
    const isShortSearch = Boolean(normalizedSearch && normalizedSearch.length <= 3);
    const doctorScope =
      input.requesterRole === "Doctor" && input.requesterUserId
        ? {
            appointments: {
              some: {
                deletedAt: null,
                doctor: {
                  userId: input.requesterUserId,
                  deletedAt: null
                }
              }
            }
          }
        : {};
    const where = {
      ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      deletedAt: null,
      ...doctorScope,
      ...(normalizedSearch
        ? {
            OR: [
              ...(isShortSearch
                ? [
                    { fullName: { startsWith: normalizedSearch, mode: "insensitive" as const } },
                    { phone: { startsWith: normalizedSearch, mode: "insensitive" as const } }
                  ]
                : []),
              { fullName: { contains: normalizedSearch, mode: "insensitive" as const } },
              { phone: { contains: normalizedSearch, mode: "insensitive" as const } },
              { whatsapp: { contains: normalizedSearch, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          clinic: {
            select: {
              name: true
            }
          },
          appointments: {
            where: {
              deletedAt: null
            },
            orderBy: {
              startsAt: "desc"
            },
            take: 1,
            select: {
              startsAt: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.patient.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  create(
    clinicId: string,
    data: {
      fullName: string;
      nationalId?: string;
      phone: string;
      whatsapp?: string;
      dateOfBirth?: string;
      profession: Profession;
      professionOther?: string;
      leadSource: LeadSource;
      leadSourceOther?: string;
      address?: string;
    }
  ) {
    if (data.nationalId && !/^\d{14}$/.test(data.nationalId.trim())) {
      throw new AppError("nationalId must be exactly 14 digits", 400);
    }
    if (data.profession === "OTHER" && !data.professionOther?.trim()) {
      throw new AppError("professionOther is required when profession is OTHER", 400);
    }
    if (data.leadSource === "OTHER" && !data.leadSourceOther?.trim()) {
      throw new AppError("leadSourceOther is required when leadSource is OTHER", 400);
    }

    return prisma.$transaction(async (tx) => {
      const counter = await tx.clinicCounter.upsert({
        where: { clinicId },
        create: { clinicId, lastPatientFileNumber: 1 },
        update: { lastPatientFileNumber: { increment: 1 } }
      });

      return tx.patient.create({
        data: {
          clinicId,
          fullName: data.fullName,
          nationalId: data.nationalId?.trim() || null,
          phone: data.phone,
          whatsapp: data.whatsapp || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          profession: data.profession,
          professionOther: data.profession === "OTHER" ? data.professionOther?.trim() ?? null : null,
          leadSource: data.leadSource,
          leadSourceOther: data.leadSource === "OTHER" ? data.leadSourceOther?.trim() ?? null : null,
          address: data.address || null,
          fileNumber: counter.lastPatientFileNumber
        }
      });
    });
  },

  async update(id: string, clinicId: string | undefined, data: Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(data, "nationalId")) {
      const nationalId = data.nationalId;
      if (typeof nationalId === "string" && nationalId.trim()) {
        const normalizedNationalId = nationalId.trim();
        if (!/^\d{14}$/.test(normalizedNationalId)) {
          throw new AppError("nationalId must be exactly 14 digits", 400);
        }
        data.nationalId = normalizedNationalId;
      } else {
        data.nationalId = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(data, "dateOfBirth")) {
      const dateOfBirth = data.dateOfBirth;
      data.dateOfBirth =
        typeof dateOfBirth === "string" && dateOfBirth.trim()
          ? new Date(dateOfBirth)
          : null;
    }
    if (data.profession === "OTHER" && !String(data.professionOther ?? "").trim()) {
      throw new AppError("professionOther is required when profession is OTHER", 400);
    }
    if (data.leadSource === "OTHER" && !String(data.leadSourceOther ?? "").trim()) {
      throw new AppError("leadSourceOther is required when leadSource is OTHER", 400);
    }
    if (data.profession && data.profession !== "OTHER") {
      data.professionOther = null;
    }
    if (data.leadSource && data.leadSource !== "OTHER") {
      data.leadSourceOther = null;
    }
    const result = await prisma.patient.updateMany({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      data
    });
    if (!result.count) {
      throw new AppError("Patient not found", 404);
    }
    return result;
  },

  async remove(id: string, clinicId: string | undefined) {
    const result = await prisma.patient.updateMany({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      data: { deletedAt: new Date() }
    });
    if (!result.count) {
      throw new AppError("Patient not found", 404);
    }
    return result;
  },

  async stats(clinicId?: string) {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalPatients, newThisMonth, withContactInfo, withoutContactInfo] = await Promise.all([
      prisma.patient.count({
        where: { ...(clinicId ? { clinicId } : {}), deletedAt: null }
      }),
      prisma.patient.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          deletedAt: null,
          createdAt: { gte: last30Days }
        }
      }),
      prisma.patient.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          deletedAt: null,
          OR: [{ phone: { not: "" } }, { whatsapp: { not: null } }]
        }
      }),
      prisma.patient.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          deletedAt: null,
          phone: "",
          whatsapp: null
        }
      })
    ]);

    return {
      totalPatients,
      newThisMonth,
      withContactInfo,
      withoutContactInfo
    };
  }
};
