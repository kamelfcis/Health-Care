import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Secret, SignOptions } from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { permissionService } from "./permission.service";
import { DEFAULT_ROLE_PERMISSIONS } from "../constants/permissions";
import { AppError } from "../utils/app-error";
import { RoleName } from "../types/auth";

interface RegisterInput {
  clinicName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  specialtyCodes: string[] | string;
  imageUrl?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const signToken = (
  payload: { sub: string; clinicId: string; role: RoleName; permissions: string[] },
  secret: Secret,
  expiresIn: string
) => jwt.sign(payload, secret, { expiresIn } as SignOptions);

const signAccessToken = (sub: string, clinicId: string, role: RoleName, permissions: string[]) =>
  signToken({ sub, clinicId, role, permissions }, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);

const signRefreshToken = (sub: string, clinicId: string, role: RoleName, permissions: string[]) =>
  signToken({ sub, clinicId, role, permissions }, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);

const getAuthUser = async (userId: string) => {
  const loadUser = () =>
    prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true }
            }
          }
        }
      }
    });

  let user = await loadUser();

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Backfill default permissions for legacy system roles that were created before dynamic RBAC migration.
  if (!user.role.rolePermissions.length && DEFAULT_ROLE_PERMISSIONS[user.role.name]) {
    await permissionService.replaceRolePermissions(
      user.clinicId,
      user.role.id,
      DEFAULT_ROLE_PERMISSIONS[user.role.name],
      true
    );
    user = await loadUser();
    if (!user) {
      throw new AppError("User not found", 404);
    }
  }

  const permissions = user.role.rolePermissions.map((item) => item.permission.key);

  return {
    user,
    permissions
  };
};

export const authService = {
  async register(input: RegisterInput) {
    const baseSlug = input.clinicName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug || `clinic-${Date.now()}`;
    let suffix = 1;
    while (await prisma.clinic.findUnique({ where: { slug } })) {
      slug = `${baseSlug || "clinic"}-${suffix++}`;
    }

    const clinic = await prisma.clinic.create({
      data: {
        name: input.clinicName.trim(),
        slug,
        email: input.email.toLowerCase(),
        imageUrl: input.imageUrl,
        countryCode: "US",
        currencyCode: "USD"
      }
    });

    const incomingSpecialties = Array.isArray(input.specialtyCodes) ? input.specialtyCodes : [input.specialtyCodes];
    const normalizedSpecialtyCodes = Array.from(
      new Set(incomingSpecialties.map((item) => String(item).trim().toUpperCase()).filter(Boolean))
    );
    if (!normalizedSpecialtyCodes.length) {
      throw new AppError("At least one clinic specialty is required", 400);
    }

    const specialties = await prisma.specialtyCatalog.findMany({
      where: {
        code: { in: normalizedSpecialtyCodes },
        isActive: true,
        deletedAt: null
      },
      select: { id: true, code: true }
    });
    if (specialties.length !== normalizedSpecialtyCodes.length) {
      const found = new Set(specialties.map((item) => item.code));
      const missing = normalizedSpecialtyCodes.filter((code) => !found.has(code));
      throw new AppError(`Invalid specialties: ${missing.join(", ")}`, 400);
    }

    await prisma.clinicSpecialty.createMany({
      data: specialties.map((specialty) => ({
        clinicId: clinic.id,
        specialtyId: specialty.id
      }))
    });

    await permissionService.ensureDefaultRoles(clinic.id);

    const existingRole = await prisma.role.findFirst({
      where: { clinicId: clinic.id, name: "ClinicAdmin", deletedAt: null }
    });

    const role =
      existingRole ??
      (await prisma.role.create({
        data: { clinicId: clinic.id, name: "ClinicAdmin" }
      }));

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        roleId: role.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        passwordHash
      },
      include: { role: true }
    });

    const authPayload = await getAuthUser(user.id);
    const accessToken = signAccessToken(user.id, user.clinicId, user.role.name as RoleName, authPayload.permissions);
    const refreshToken = signRefreshToken(user.id, user.clinicId, user.role.name as RoleName, authPayload.permissions);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });

    return {
      user: {
        id: user.id,
        clinicId: user.clinicId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        permissions: authPayload.permissions
      },
      accessToken,
      refreshToken
    };
  },

  async login(input: LoginInput) {
    const users = await prisma.user.findMany({
      where: {
        email: input.email.toLowerCase(),
        deletedAt: null
      },
      take: 2,
      include: {
        role: true,
        clinic: {
          select: {
            isActive: true,
            deletedAt: true
          }
        }
      }
    });

    if (users.length > 1) {
      throw new AppError("Multiple accounts found for this email. Please contact support.", 409);
    }

    const user = users[0];

    if (!user || !user.isActive) {
      throw new AppError("Invalid credentials", 401);
    }
    const isSuperAdmin = user.role.name === "SuperAdmin";
    if (!isSuperAdmin && (!user.clinic.isActive || user.clinic.deletedAt)) {
      throw new AppError("Clinic account is inactive", 403);
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new AppError("Invalid credentials", 401);
    }

    const authPayload = await getAuthUser(user.id);
    const accessToken = signAccessToken(user.id, user.clinicId, user.role.name as RoleName, authPayload.permissions);
    const refreshToken = signRefreshToken(user.id, user.clinicId, user.role.name as RoleName, authPayload.permissions);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLoginAt: new Date() }
    });

    return {
      user: {
        id: user.id,
        clinicId: user.clinicId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        permissions: authPayload.permissions
      },
      accessToken,
      refreshToken
    };
  },

  async refreshToken(refreshToken: string) {
    let payload: { sub: string; clinicId: string; role: RoleName; permissions: string[] };
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
        sub: string;
        clinicId: string;
        role: RoleName;
        permissions: string[];
      };
    } catch {
      throw new AppError("Invalid refresh token", 401);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        clinicId: payload.clinicId,
        refreshToken,
        deletedAt: null
      },
      include: { role: true }
    });

    if (!user) {
      throw new AppError("Invalid refresh token", 401);
    }

    const authPayload = await getAuthUser(user.id);
    const newAccessToken = signAccessToken(user.id, user.clinicId, user.role.name as RoleName, authPayload.permissions);
    const newRefreshToken = signRefreshToken(user.id, user.clinicId, user.role.name as RoleName, authPayload.permissions);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken }
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        clinicId: user.clinicId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        permissions: authPayload.permissions
      }
    };
  },

  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    });
  },

  async changePassword(userId: string, input: ChangePasswordInput) {
    if (input.newPassword !== input.confirmPassword) {
      throw new AppError("New password and confirmation do not match", 400);
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, passwordHash: true }
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const currentPasswordValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      throw new AppError("Current password is incorrect", 400);
    }

    const samePassword = await bcrypt.compare(input.newPassword, user.passwordHash);
    if (samePassword) {
      throw new AppError("New password must be different from current password", 400);
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        refreshToken: null
      }
    });
  },

  async me(userId: string) {
    const { user, permissions } = await getAuthUser(userId);
    return {
      id: user.id,
      clinicId: user.clinicId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      permissions
    };
  }
};
