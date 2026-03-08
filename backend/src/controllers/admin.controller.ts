import { Response } from "express";
import { adminService } from "../services/admin.service";
import { AuthenticatedRequest } from "../types/auth";
import { apiSuccess } from "../utils/api-response";
import { getScopedClinicId } from "../utils/tenant";
import { buildCacheKey, invalidateCacheByPrefix } from "../utils/response-cache";

export const adminController = {
  async listRoles(req: AuthenticatedRequest, res: Response) {
    const data = await adminService.listRoles(getScopedClinicId(req));
    res.json(apiSuccess(data));
  },

  async listPermissions(_req: AuthenticatedRequest, res: Response) {
    const data = await adminService.listPermissions();
    res.json(apiSuccess(data));
  },

  async listUsers(req: AuthenticatedRequest, res: Response) {
    const data = await adminService.listUsers(getScopedClinicId(req));
    res.json(apiSuccess(data));
  },

  async createUser(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicId(req);
    const data = await adminService.createClinicUser(clinicId, req.body);
    invalidateCacheByPrefix(buildCacheKey("doctors", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    res.status(201).json(apiSuccess(data, "User created"));
  },

  async createRole(req: AuthenticatedRequest, res: Response) {
    const data = await adminService.createRole(getScopedClinicId(req), req.body);
    res.status(201).json(apiSuccess(data, "Role created"));
  },

  async updateRolePermissions(req: AuthenticatedRequest, res: Response) {
    const roleId = String(req.params.id);
    const data = await adminService.updateRolePermissions(getScopedClinicId(req), roleId, req.body);
    res.status(200).json(apiSuccess(data, "Role permissions updated"));
  },

  async deleteRole(req: AuthenticatedRequest, res: Response) {
    const roleId = String(req.params.id);
    await adminService.deleteRole(getScopedClinicId(req), roleId);
    res.status(200).json(apiSuccess(null, "Role deleted"));
  },

  async updateUserRole(req: AuthenticatedRequest, res: Response) {
    const userId = String(req.params.id);
    const clinicId = getScopedClinicId(req);
    const data = await adminService.updateUserRole(clinicId, userId, req.body.roleId);
    invalidateCacheByPrefix(buildCacheKey("doctors", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    res.status(200).json(apiSuccess(data, "User role updated"));
  },

  async deleteUser(req: AuthenticatedRequest, res: Response) {
    const userId = String(req.params.id);
    const clinicId = getScopedClinicId(req);
    await adminService.deleteUser(clinicId, userId, String(req.user?.sub ?? ""));
    invalidateCacheByPrefix(buildCacheKey("doctors", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    res.status(200).json(apiSuccess(null, "User deleted"));
  }
};
