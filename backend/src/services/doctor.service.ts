import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

interface ListInput {
  clinicId?: string;
  page: number;
  pageSize: number;
  search?: string;
  specialty?: string;
}

export const doctorService = {
  async list(input: ListInput) {
    const normalizedSearch = input.search?.trim();
    const isShortSearch = Boolean(normalizedSearch && normalizedSearch.length <= 3);
    const where = {
      ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      deletedAt: null,
      ...(input.specialty ? { specialty: input.specialty } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              ...(isShortSearch
                ? [
                    { specialty: { startsWith: normalizedSearch, mode: "insensitive" as const } },
                    { licenseNumber: { startsWith: normalizedSearch, mode: "insensitive" as const } },
                    {
                      user: { firstName: { startsWith: normalizedSearch, mode: "insensitive" as const } }
                    },
                    {
                      user: { lastName: { startsWith: normalizedSearch, mode: "insensitive" as const } }
                    }
                  ]
                : []),
              { specialty: { contains: normalizedSearch, mode: "insensitive" as const } },
              { licenseNumber: { contains: normalizedSearch, mode: "insensitive" as const } },
              { user: { firstName: { contains: normalizedSearch, mode: "insensitive" as const } } },
              { user: { lastName: { contains: normalizedSearch, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: { user: true },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.doctor.count({ where })
    ]);
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async getById(id: string, clinicId: string) {
    const doctor = await prisma.doctor.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: { user: true }
    });
    if (!doctor) {
      throw new AppError("Doctor not found", 404);
    }
    return doctor;
  },

  async create(
    clinicId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      licenseNumber: string;
      specialty: string;
    }
  ) {
    const email = data.email.trim().toLowerCase();
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const specialty = data.specialty.trim();
    const licenseNumber = data.licenseNumber.trim();

    if (!firstName || !lastName || !email || !specialty || !licenseNumber) {
      throw new AppError("Missing required doctor fields", 400);
    }

    const [clinic, doctorRole, existingUser, existingLicense] = await Promise.all([
      prisma.clinic.findFirst({
        where: { id: clinicId, deletedAt: null },
        select: { slug: true }
      }),
      prisma.role.findFirst({
        where: { clinicId, name: "Doctor", deletedAt: null }
      }),
      prisma.user.findFirst({
        where: { clinicId, email, deletedAt: null }
      }),
      prisma.doctor.findFirst({
        where: { clinicId, licenseNumber, deletedAt: null }
      })
    ]);

    if (!clinic?.slug) {
      throw new AppError("Clinic not found", 404);
    }
    const requiredDomain = `@${clinic.slug.toLowerCase()}.com`;
    if (!email.endsWith(requiredDomain)) {
      throw new AppError(`Doctor email must end with ${requiredDomain}`, 400);
    }
    if (!doctorRole) {
      throw new AppError("Doctor role not found for this clinic", 400);
    }
    if (existingLicense) {
      throw new AppError("License number already exists in this clinic", 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const existingDoctorByUser = existingUser
      ? await prisma.doctor.findFirst({
          where: { clinicId, userId: existingUser.id }
        })
      : null;

    if (existingDoctorByUser?.deletedAt === null) {
      throw new AppError("Doctor profile already exists for this email", 409);
    }

    return prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              roleId: doctorRole.id,
              firstName,
              lastName,
              passwordHash,
              isActive: true
            }
          })
        : await tx.user.create({
            data: {
              clinicId,
              roleId: doctorRole.id,
              firstName,
              lastName,
              email,
              passwordHash
            }
          });

      if (existingDoctorByUser) {
        return tx.doctor.update({
          where: { id: existingDoctorByUser.id },
          data: {
            clinicId,
            userId: user.id,
            licenseNumber,
            specialty,
            deletedAt: null
          },
          include: { user: true }
        });
      }

      return tx.doctor.create({
        data: {
          clinicId,
          userId: user.id,
          licenseNumber,
          specialty
        },
        include: { user: true }
      });
    });
  },

  async update(
    id: string,
    clinicId: string,
    data: { specialty?: string; licenseNumber?: string; firstName?: string; lastName?: string; email?: string; isActive?: boolean }
  ) {
    const doctor = await prisma.doctor.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: { user: true }
    });
    if (!doctor) {
      throw new AppError("Doctor not found", 404);
    }

    const nextEmail = data.email?.trim().toLowerCase();
    const nextLicenseNumber = data.licenseNumber?.trim();
    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, deletedAt: null },
      select: { slug: true }
    });
    if (!clinic?.slug) {
      throw new AppError("Clinic not found", 404);
    }
    const requiredDomain = `@${clinic.slug.toLowerCase()}.com`;
    if (nextEmail && !nextEmail.endsWith(requiredDomain)) {
      throw new AppError(`Doctor email must end with ${requiredDomain}`, 400);
    }

    if (nextEmail && nextEmail !== doctor.user.email) {
      const duplicateUser = await prisma.user.findFirst({
        where: { clinicId, email: nextEmail, id: { not: doctor.user.id } }
      });
      if (duplicateUser) {
        throw new AppError("User email already exists in this clinic", 409);
      }
    }

    if (nextLicenseNumber && nextLicenseNumber !== doctor.licenseNumber) {
      const duplicateLicense = await prisma.doctor.findFirst({
        where: {
          clinicId,
          licenseNumber: nextLicenseNumber,
          deletedAt: null,
          id: { not: doctor.id }
        }
      });
      if (duplicateLicense) {
        throw new AppError("License number already exists in this clinic", 409);
      }
    }

    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: doctor.user.id },
        data: {
          ...(typeof data.firstName === "string" ? { firstName: data.firstName.trim() } : {}),
          ...(typeof data.lastName === "string" ? { lastName: data.lastName.trim() } : {}),
          ...(typeof nextEmail === "string" ? { email: nextEmail } : {}),
          ...(typeof data.isActive === "boolean" ? { isActive: data.isActive } : {})
        }
      });

      return tx.doctor.update({
        where: { id: doctor.id },
        data: {
          ...(typeof data.specialty === "string" ? { specialty: data.specialty.trim() } : {}),
          ...(typeof nextLicenseNumber === "string" ? { licenseNumber: nextLicenseNumber } : {})
        },
        include: { user: true }
      });
    });
  },

  async remove(id: string, clinicId: string) {
    const doctor = await prisma.doctor.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: { user: true }
    });
    if (!doctor) {
      throw new AppError("Doctor not found", 404);
    }

    const [appointmentsCount, prescriptionsCount, followUpsCount] = await Promise.all([
      prisma.appointment.count({
        where: { clinicId, doctorId: doctor.id, deletedAt: null }
      }),
      prisma.prescription.count({
        where: { clinicId, doctorId: doctor.id, deletedAt: null }
      }),
      prisma.followUp.count({
        where: { createdById: doctor.user.id }
      })
    ]);

    if (appointmentsCount > 0 || prescriptionsCount > 0 || followUpsCount > 0) {
      throw new AppError("Cannot delete doctor: linked appointments, prescriptions, or follow-ups exist", 409);
    }

    return prisma.$transaction(async (tx) => {
      await tx.doctor.delete({
        where: { id: doctor.id }
      });

      await tx.notification.updateMany({
        where: { userId: doctor.user.id },
        data: { userId: null }
      });

      await tx.lead.updateMany({
        where: { assignedToId: doctor.user.id },
        data: { assignedToId: null }
      });

      await tx.clinicUser.deleteMany({
        where: { userId: doctor.user.id }
      });

      return tx.user.delete({
        where: { id: doctor.user.id }
      });
    });
  }
};
