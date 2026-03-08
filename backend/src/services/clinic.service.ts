import { prisma } from "../config/prisma";
import bcrypt from "bcryptjs";
import { AppError } from "../utils/app-error";
import { permissionService } from "./permission.service";

interface ListInput {
  page: number;
  pageSize: number;
  search?: string;
}

interface ClinicAdminInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface CreateClinicInput {
  name: string;
  slug?: string;
  imageUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  specialtyCodes: string[];
  adminUser: ClinicAdminInput;
}

interface UpdateClinicInput {
  name?: string;
  slug?: string;
  imageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  isActive?: boolean;
  specialtyCodes?: string[];
  applyRetroactiveCurrencyConversion?: boolean;
  conversionRate?: number;
}

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildUniqueSlug = async (name: string, requestedSlug?: string, excludeClinicId?: string) => {
  const base = normalizeSlug(requestedSlug?.trim() || name) || `clinic-${Date.now()}`;
  let slug = base;
  let suffix = 1;
  // Keep trying until we find a unique slug.
  while (true) {
    const existing = await prisma.clinic.findFirst({
      where: {
        slug,
        ...(excludeClinicId ? { id: { not: excludeClinicId } } : {})
      },
      select: { id: true }
    });
    if (!existing) return slug;
    slug = `${base}-${suffix++}`;
  }
};

export const clinicService = {
  async list(input: ListInput) {
    const normalizedSearch = input.search?.trim();
    const isShortSearch = Boolean(normalizedSearch && normalizedSearch.length <= 3);
    const where = {
      deletedAt: null,
      ...(normalizedSearch
        ? {
            OR: [
              ...(isShortSearch
                ? [
                    { name: { startsWith: normalizedSearch, mode: "insensitive" as const } },
                    { slug: { startsWith: normalizedSearch, mode: "insensitive" as const } }
                  ]
                : []),
              { name: { contains: normalizedSearch, mode: "insensitive" as const } },
              { slug: { contains: normalizedSearch, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [items, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          clinicSpecialties: {
            where: { deletedAt: null },
            include: {
              specialty: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  nameAr: true
                }
              }
            }
          }
        }
      }),
      prisma.clinic.count({ where })
    ]);
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async create(data: CreateClinicInput) {
    const normalizedCodes = Array.from(new Set(data.specialtyCodes.map((item) => item.trim().toUpperCase()).filter(Boolean)));
    if (!normalizedCodes.length) {
      throw new AppError("At least one clinic specialty is required", 400);
    }

    const adminEmail = data.adminUser.email.trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: { email: adminEmail, deletedAt: null },
      select: { id: true }
    });
    if (existingUser) {
      throw new AppError("Admin email is already in use", 409);
    }

    const clinicEmail = data.email?.trim().toLowerCase();
    if (clinicEmail) {
      const existingClinicEmail = await prisma.clinic.findFirst({
        where: { email: clinicEmail, deletedAt: null },
        select: { id: true }
      });
      if (existingClinicEmail) {
        throw new AppError("Clinic email is already in use", 409);
      }
    }

    const slug = await buildUniqueSlug(data.name, data.slug);
    const passwordHash = await bcrypt.hash(data.adminUser.password, 12);

    const clinic = await prisma.$transaction(async (tx) => {
      const specialties = await tx.specialtyCatalog.findMany({
        where: { code: { in: normalizedCodes }, isActive: true, deletedAt: null },
        select: { id: true, code: true }
      });
      if (specialties.length !== normalizedCodes.length) {
        const found = new Set(specialties.map((item) => item.code));
        const missing = normalizedCodes.filter((code) => !found.has(code));
        throw new AppError(`Invalid specialties: ${missing.join(", ")}`, 400);
      }

      const createdClinic = await tx.clinic.create({
        data: {
          name: data.name.trim(),
          slug,
          imageUrl: data.imageUrl?.trim() || null,
          email: clinicEmail,
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          country: data.country?.trim() || null,
          countryCode: data.countryCode?.trim().toUpperCase() || "US",
          currencyCode: data.currencyCode?.trim().toUpperCase() || "USD",
          timezone: data.timezone?.trim() || "UTC"
        }
      });

      await tx.clinicSpecialty.createMany({
        data: specialties.map((specialty) => ({
          clinicId: createdClinic.id,
          specialtyId: specialty.id
        }))
      });

      const role = await tx.role.create({
        data: {
          clinicId: createdClinic.id,
          name: "ClinicAdmin",
          isSystem: true
        }
      });

      await tx.user.create({
        data: {
          clinicId: createdClinic.id,
          roleId: role.id,
          firstName: data.adminUser.firstName.trim(),
          lastName: data.adminUser.lastName.trim(),
          email: adminEmail,
          passwordHash
        }
      });

      return createdClinic;
    });

    await permissionService.ensureDefaultRoles(clinic.id);

    return prisma.clinic.findUniqueOrThrow({
      where: { id: clinic.id },
      include: {
        clinicSpecialties: {
          where: { deletedAt: null },
          include: {
            specialty: {
              select: {
                id: true,
                code: true,
                name: true,
                nameAr: true
              }
            }
          }
        }
      }
    });
  },

  async getById(id: string) {
    return prisma.clinic.findFirstOrThrow({
      where: { id, deletedAt: null }
    });
  },

  async update(id: string, data: UpdateClinicInput) {
    const {
      specialtyCodes,
      applyRetroactiveCurrencyConversion = false,
      conversionRate,
      ...clinicData
    } = data;

    const existingClinic = await prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, currencyCode: true }
    });
    if (!existingClinic) {
      throw new AppError("Clinic not found", 404);
    }

    if (typeof clinicData.slug === "string" && clinicData.slug.trim()) {
      clinicData.slug = await buildUniqueSlug(clinicData.slug, clinicData.slug, id);
    }
    if (typeof clinicData.email === "string") {
      clinicData.email = clinicData.email.trim().toLowerCase();
      const existingClinicEmail = await prisma.clinic.findFirst({
        where: { email: clinicData.email, id: { not: id }, deletedAt: null },
        select: { id: true }
      });
      if (existingClinicEmail) {
        throw new AppError("Clinic email is already in use", 409);
      }
    }
    if (typeof clinicData.countryCode === "string") {
      clinicData.countryCode = clinicData.countryCode.trim().toUpperCase();
    }
    if (typeof clinicData.currencyCode === "string") {
      clinicData.currencyCode = clinicData.currencyCode.trim().toUpperCase();
    }

    const isCurrencyChanging =
      typeof clinicData.currencyCode === "string" &&
      clinicData.currencyCode.length > 0 &&
      clinicData.currencyCode !== existingClinic.currencyCode;

    if (isCurrencyChanging && applyRetroactiveCurrencyConversion) {
      if (!conversionRate || conversionRate <= 0) {
        throw new AppError("Conversion rate must be greater than zero", 400);
      }
    }

    return prisma.$transaction(async (tx) => {
      if (isCurrencyChanging && applyRetroactiveCurrencyConversion && conversionRate) {
        await tx.$executeRaw`
          UPDATE "Invoice"
          SET
            "amount" = ROUND("amount" * ${conversionRate}, 2),
            "taxAmount" = ROUND("taxAmount" * ${conversionRate}, 2),
            "discount" = ROUND("discount" * ${conversionRate}, 2),
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "clinicId" = ${id}
            AND "deletedAt" IS NULL
        `;
        await tx.$executeRaw`
          UPDATE "Payment"
          SET
            "amount" = ROUND("amount" * ${conversionRate}, 2),
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "clinicId" = ${id}
            AND "deletedAt" IS NULL
        `;
      }

      const clinic = await tx.clinic.update({ where: { id }, data: clinicData });
      if (Array.isArray(specialtyCodes)) {
        const normalizedCodes = Array.from(new Set(specialtyCodes.map((item) => item.trim().toUpperCase()).filter(Boolean)));
        await tx.clinicSpecialty.deleteMany({ where: { clinicId: id } });
        if (normalizedCodes.length) {
          const specialties = await tx.specialtyCatalog.findMany({
            where: { code: { in: normalizedCodes }, isActive: true, deletedAt: null },
            select: { id: true, code: true }
          });
          if (specialties.length !== normalizedCodes.length) {
            const found = new Set(specialties.map((item) => item.code));
            const missing = normalizedCodes.filter((code) => !found.has(code));
            throw new AppError(`Invalid specialties: ${missing.join(", ")}`, 400);
          }
          await tx.clinicSpecialty.createMany({
            data: specialties.map((specialty) => ({
              clinicId: id,
              specialtyId: specialty.id
            }))
          });
        }
      }
      return clinic;
    });
  },

  async remove(id: string) {
    return prisma.clinic.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });
  }
};
