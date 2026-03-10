import { Request, Response } from "express";
import { clinicService } from "../services/clinic.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";
import { AuthenticatedRequest } from "../types/auth";
import { getScopedClinicId } from "../utils/tenant";

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
    const imageUrl = file ? `/uploads/clinic-images/${file.filename}` : undefined;
    const data = await clinicService.update(clinicId, {
      ...req.body,
      ...(imageUrl ? { imageUrl } : {})
    });
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.json(apiSuccess(data, "Clinic settings updated"));
  },

  async list(req: Request, res: Response) {
    const { page, pageSize, search } = getPagination(req);
    const cachePrefix = buildCacheKey("clinics");
    const data = await getOrSetCache(buildCacheKey(cachePrefix, "list", page, pageSize, search ?? ""), 45_000, () =>
      clinicService.list({ page, pageSize, search })
    );
    res.json(apiSuccess(data));
  },

  async create(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const imageUrl = file ? `/uploads/clinic-images/${file.filename}` : undefined;
    const data = await clinicService.create({
      ...req.body,
      ...(imageUrl ? { imageUrl } : {})
    });
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.status(201).json(apiSuccess(data, "Clinic created"));
  },

  async update(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const imageUrl = file ? `/uploads/clinic-images/${file.filename}` : undefined;
    const data = await clinicService.update(String(req.params.id), {
      ...req.body,
      ...(imageUrl ? { imageUrl } : {})
    });
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.json(apiSuccess(data, "Clinic updated"));
  },

  async remove(req: Request, res: Response) {
    const data = await clinicService.remove(String(req.params.id));
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.json(apiSuccess(data, "Clinic deleted"));
  }
};
