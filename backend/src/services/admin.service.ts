import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { permissionService } from "./permission.service";
import { AppError } from "../utils/app-error";

interface CreateClinicUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
}

interface CreateRoleInput {
  name: string;
  permissionKeys: string[];
}

interface UpdateRolePermissionsInput {
  permissionKeys: string[];
}

const AUTO_DOCTOR_SPECIALTY = "General";
const AUTO_DOCTOR_LICENSE_PREFIX = "AUTO";

const buildAutoDoctorLicense = () =>
  `${AUTO_DOCTOR_LICENSE_PREFIX}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const ensureDoctorProfileForUser = async (tx: Prisma.TransactionClient, clinicId: string, userId: string) => {
  const existingProfile = await tx.doctor.findFirst({
    where: { clinicId, userId }
  });

  if (existingProfile) {
    if (existingProfile.deletedAt) {
      await tx.doctor.update({
        where: { id: existingProfile.id },
        data: { deletedAt: null }
      });
    }
    return;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const licenseNumber = buildAutoDoctorLicense();
    const duplicateLicense = await tx.doctor.findFirst({
      where: { clinicId, licenseNumber, deletedAt: null },
      select: { id: true }
    });

    if (duplicateLicense) {
      continue;
    }

    await tx.doctor.create({
      data: {
        clinicId,
        userId,
        specialty: AUTO_DOCTOR_SPECIALTY,
        licenseNumber
      }
    });
    return;
  }

  throw new AppError("Could not generate unique doctor license number", 500);
};

export const adminService = {
  async listRoles(clinicId: string) {
    const roles = await prisma.role.findMany({
      where: { clinicId, deletedAt: null },
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }]
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissions: role.rolePermissions.map((item) => item.permission.key)
    }));
  },

  async listPermissions() {
    return permissionService.listPermissionCatalog();
  },

  async listUsers(clinicId: string) {
    const users = await prisma.user.findMany({
      where: { clinicId, deletedAt: null },
      include: { role: true },
      orderBy: { createdAt: "desc" }
    });

    const roleIds = Array.from(new Set(users.map((user) => user.role.id)));
    const rolePermissionsEntries = await Promise.all(
      roleIds.map(async (roleId) => [roleId, await permissionService.getRolePermissions(roleId)] as const)
    );
    const rolePermissions = new Map<string, string[]>(rolePermissionsEntries);

    return users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roleId: user.role.id,
      role: user.role.name,
      permissions: rolePermissions.get(user.role.id) ?? [],
      createdAt: user.createdAt
    }));
  },

  async createClinicUser(clinicId: string, input: CreateClinicUserInput) {
    const existing = await prisma.user.findFirst({
      where: {
        clinicId,
        email: input.email.toLowerCase(),
        deletedAt: null
      }
    });

    if (existing) {
      throw new AppError("User already exists in this clinic", 409);
    }

    const role = await prisma.role.findFirst({
      where: { id: input.roleId, clinicId, deletedAt: null }
    });

    if (!role || role.name === "SuperAdmin" || role.name === "ClinicAdmin") {
      throw new AppError("This role cannot be assigned by Clinic Admin", 403);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          clinicId,
          roleId: role.id,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.toLowerCase(),
          passwordHash
        },
        include: { role: true }
      });

      if (role.name === "Doctor") {
        await ensureDoctorProfileForUser(tx, clinicId, createdUser.id);
      }

      return createdUser;
    });

    const permissions = await permissionService.getRolePermissions(user.role.id);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roleId: user.role.id,
      role: user.role.name,
      permissions
    };
  },

  async createRole(clinicId: string, input: CreateRoleInput) {
    const roleName = input.name.trim();
    if (!roleName) {
      throw new AppError("Role name is required", 400);
    }

    if (["SuperAdmin", "ClinicAdmin"].includes(roleName)) {
      throw new AppError("Reserved role name", 400);
    }

    const role = await prisma.role.create({
      data: {
        clinicId,
        name: roleName,
        isSystem: false
      }
    });

    await permissionService.replaceRolePermissions(clinicId, role.id, input.permissionKeys);

    return {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissions: await permissionService.getRolePermissions(role.id)
    };
  },

  async updateRolePermissions(clinicId: string, roleId: string, input: UpdateRolePermissionsInput) {
    await permissionService.replaceRolePermissions(clinicId, roleId, input.permissionKeys);
    const role = await prisma.role.findFirstOrThrow({
      where: { id: roleId, clinicId, deletedAt: null }
    });

    return {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissions: await permissionService.getRolePermissions(role.id)
    };
  },

  async deleteRole(clinicId: string, roleId: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, clinicId, deletedAt: null }
    });

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    if (role.isSystem || role.name === "SuperAdmin" || role.name === "ClinicAdmin") {
      throw new AppError("System role cannot be deleted", 403);
    }

    const assignedUsers = await prisma.user.count({
      where: { roleId: role.id, deletedAt: null }
    });

    if (assignedUsers > 0) {
      throw new AppError("Cannot delete role assigned to users", 409);
    }

    await prisma.role.update({
      where: { id: role.id },
      data: { deletedAt: new Date() }
    });
  },

  async updateUserRole(clinicId: string, userId: string, roleId: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, clinicId, deletedAt: null }
    });

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    if (role.name === "SuperAdmin" || role.name === "ClinicAdmin") {
      throw new AppError("This role cannot be assigned by Clinic Admin", 403);
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: userId, clinicId, deletedAt: null }
    });

    if (!existingUser) {
      throw new AppError("User not found", 404);
    }

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: existingUser.id },
        data: { roleId },
        include: { role: true }
      });

      if (role.name === "Doctor") {
        await ensureDoctorProfileForUser(tx, clinicId, updatedUser.id);
      }

      return updatedUser;
    });

    return {
      id: user.id,
      roleId: user.role.id,
      role: user.role.name,
      permissions: await permissionService.getRolePermissions(user.role.id)
    };
  },

  async deleteUser(clinicId: string, userId: string, actorUserId: string) {
    if (userId === actorUserId) {
      throw new AppError("You cannot delete your own account", 400);
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: userId, clinicId, deletedAt: null },
      include: { role: true }
    });
    if (!existingUser) {
      throw new AppError("User not found", 404);
    }
    if (existingUser.role.name === "ClinicAdmin" || existingUser.role.name === "SuperAdmin") {
      throw new AppError("This account cannot be deleted", 403);
    }

    const doctorProfile = await prisma.doctor.findFirst({
      where: { clinicId, userId: existingUser.id }
    });

    if (doctorProfile) {
      const [appointmentsCount, prescriptionsCount] = await Promise.all([
        prisma.appointment.count({ where: { clinicId, doctorId: doctorProfile.id } }),
        prisma.prescription.count({ where: { clinicId, doctorId: doctorProfile.id } })
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
      if (doctorProfile) {
        await tx.doctor.delete({ where: { id: doctorProfile.id } });
      }
      await tx.notification.updateMany({
        where: { userId: existingUser.id },
        data: { userId: null }
      });
      await tx.lead.updateMany({
        where: { assignedToId: existingUser.id },
        data: { assignedToId: null }
      });
      await tx.clinicUser.deleteMany({
        where: { userId: existingUser.id }
      });
      await tx.user.delete({ where: { id: existingUser.id } });
    });
  }
};
