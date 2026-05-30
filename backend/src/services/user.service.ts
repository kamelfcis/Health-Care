import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { hardDeleteOrphanClinicShell, hardDeleteUserRecords } from "../utils/clinic-cleanup";

type DeletedFilter = "active" | "deleted" | "all";

interface ListAllSystemUsersInput {
  page: number;
  pageSize: number;
  search?: string;
  clinicId?: string;
  role?: string;
  deletedFilter?: DeletedFilter;
}

export const userService = {
  async listAllSystemUsers(input: ListAllSystemUsersInput) {
    const normalizedSearch = input.search?.trim();
    const deletedFilter = input.deletedFilter ?? "active";
    const deletedWhere =
      deletedFilter === "all"
        ? {}
        : deletedFilter === "deleted"
          ? { deletedAt: { not: null } }
          : { deletedAt: null };
    const where = {
      ...deletedWhere,
      ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      ...(input.role ? { role: { name: input.role, deletedAt: null } } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { firstName: { contains: normalizedSearch, mode: "insensitive" as const } },
              { lastName: { contains: normalizedSearch, mode: "insensitive" as const } },
              { email: { contains: normalizedSearch, mode: "insensitive" as const } },
              {
                clinic: {
                  name: { contains: normalizedSearch, mode: "insensitive" as const }
                }
              }
            ]
          }
        : {})
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ createdAt: "desc" }],
        include: {
          role: { select: { name: true } },
          clinic: { select: { id: true, name: true, deletedAt: true } }
        }
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));

    return {
      data: users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        clinicId: user.clinic.deletedAt ? null : user.clinicId,
        clinicName: user.clinic.deletedAt ? null : user.clinic.name,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        createdAt: user.createdAt
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages
    };
  },

  async hardDeleteSystemUser(userId: string, actorUserId: string) {
    if (userId === actorUserId) {
      throw new AppError("You cannot delete your own account", 403);
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: userId },
      include: { role: true }
    });
    if (!existingUser) {
      throw new AppError("User not found", 404);
    }

    if (existingUser.role.name === "SuperAdmin") {
      const superAdminCount = await prisma.user.count({
        where: {
          deletedAt: null,
          role: { name: "SuperAdmin", deletedAt: null }
        }
      });
      if (superAdminCount <= 1) {
        throw new AppError("Cannot delete the last Super Admin account", 409);
      }
    }

    const doctorProfile = await prisma.doctor.findFirst({
      where: { userId: existingUser.id }
    });

    if (doctorProfile) {
      const [appointmentsCount, prescriptionsCount] = await Promise.all([
        prisma.appointment.count({ where: { doctorId: doctorProfile.id } }),
        prisma.prescription.count({ where: { doctorId: doctorProfile.id } })
      ]);
      if (appointmentsCount > 0 || prescriptionsCount > 0) {
        throw new AppError("Cannot delete user: linked doctor appointments or prescriptions exist", 409);
      }
    }

    const followUpsCount = await prisma.followUp.count({
      where: { createdById: existingUser.id }
    });
    if (followUpsCount > 0) {
      throw new AppError("Cannot delete user: linked follow-ups exist", 409);
    }

    await prisma.$transaction(async (tx) => {
      await hardDeleteUserRecords(tx, existingUser.id);

      const remainingUsers = await tx.user.count({
        where: { clinicId: existingUser.clinicId }
      });
      if (remainingUsers === 0) {
        await hardDeleteOrphanClinicShell(tx, existingUser.clinicId);
      }
    });
  }
};
