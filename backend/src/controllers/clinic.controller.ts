import { Request, Response } from "express";
import { clinicService } from "../services/clinic.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";
import { AuthenticatedRequest } from "../types/auth";
import { getScopedClinicId } from "../utils/tenant";
import { removeClinicImage, saveClinicImage } from "../utils/clinic-image-storage";

const parseDeletedFilter = (req: Request): "active" | "deleted" | "all" => {
  const raw =
    typeof req.query.deletedFilter === "string"
      ? req.query.deletedFilter.trim().toLowerCase()
      : req.query.includeDeleted === "true"
        ? "all"
        : "active";
  if (raw === "deleted" || raw === "all") return raw;
  return "active";
};

export const clinicController = {
  async me(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicId(req);
    const cachePrefix = buildCacheKey("clinics");
    const data = await getOrSetCache(buildCacheKey(cachePrefix, "me", clinicId), 30_000, () => clinicService.getById(clinicId));
    res.json(apiSuccess(data));
  },

  async updateMe(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicId(req);
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const existingClinic = await clinicService.getById(clinicId);
    const imageUrl = file ? (await saveClinicImage(file)).imageUrl : undefined;
    const shouldRemoveExisting = req.body.imageUrl === "";
    const data = await clinicService.update(clinicId, {
      ...req.body,
      ...(imageUrl ? { imageUrl } : {})
    });
    if (file || shouldRemoveExisting) {
      await removeClinicImage(existingClinic.imageUrl);
    }
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.json(apiSuccess(data, "Clinic settings updated"));
  },

  async listUsers(req: Request, res: Response) {
    const data = await clinicService.listUsersForSuperAdmin(String(req.params.id));
    res.json(apiSuccess(data));
  },

  async resetUserPassword(req: Request, res: Response) {
    const data = await clinicService.resetUserPasswordForSuperAdmin(
      String(req.params.id),
      String(req.params.userId)
    );
    res.json(apiSuccess(data, "Password reset"));
  },

  async list(req: Request, res: Response) {
    const { page, pageSize, search } = getPagination(req);
    const deletedFilter = parseDeletedFilter(req);
    const cachePrefix = buildCacheKey("clinics");
    const data = await getOrSetCache(
      buildCacheKey(cachePrefix, "list", page, pageSize, search ?? "", deletedFilter),
      45_000,
      () => clinicService.list({ page, pageSize, search, deletedFilter })
    );
    res.json(apiSuccess(data));
  },

  async create(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const imageUrl = file ? (await saveClinicImage(file)).imageUrl : undefined;
    const data = await clinicService.create({
      ...req.body,
      ...(imageUrl ? { imageUrl } : {})
    });
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.status(201).json(apiSuccess(data, "Clinic created"));
  },

  async update(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const clinicId = String(req.params.id);
    const existingClinic = await clinicService.getById(clinicId);
    const imageUrl = file ? (await saveClinicImage(file)).imageUrl : undefined;
    const shouldRemoveExisting = req.body.imageUrl === "";
    const data = await clinicService.update(String(req.params.id), {
      ...req.body,
      ...(imageUrl ? { imageUrl } : {})
    });
    if (file || shouldRemoveExisting) {
      await removeClinicImage(existingClinic.imageUrl);
    }
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.json(apiSuccess(data, "Clinic updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const clinicId = String(req.params.id);
    const data = await clinicService.remove(clinicId, String(req.user?.sub ?? ""));
    await removeClinicImage(data.imageUrl);
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.json(apiSuccess(data, "Clinic permanently deleted"));
  },

  async purgeOrphans(_req: Request, res: Response) {
    const data = await clinicService.purgeOrphans();
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.json(apiSuccess(data, "Orphan clinics purged"));
  }
};
