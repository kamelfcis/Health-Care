import { NextFunction, Response } from "express";
import { AuthenticatedRequest, RoleName } from "../types/auth";
import { AppError } from "../utils/app-error";

export const allowRoles =
  (...roles: RoleName[]) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError("Forbidden", 403);
    }

    next();
  };

export const requirePermissions =
  (...permissions: string[]) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    if (req.user.role === "SuperAdmin") {
      next();
      return;
    }

    const granted = new Set(req.user.permissions ?? []);
    const missing = permissions.filter((permission) => !granted.has(permission));

    if (missing.length) {
      throw new AppError("Forbidden", 403);
    }

    next();
  };

export const requireAnyPermissions =
  (...permissions: string[]) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    if (req.user.role === "SuperAdmin") {
      next();
      return;
    }

    const granted = new Set(req.user.permissions ?? []);
    const hasAny = permissions.some((permission) => granted.has(permission));
    if (!hasAny) {
      throw new AppError("Forbidden", 403);
    }

    next();
  };
