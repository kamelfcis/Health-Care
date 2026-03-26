import { Request, Response } from "express";
import { clinicService } from "../services/clinic.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";
import { AuthenticatedRequest } from "../types/auth";
import { getScopedClinicId } from "../utils/tenant";
import { removeClinicImage, saveClinicImage } from "../utils/clinic-image-storage";

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

  async remove(req: Request, res: Response) {
    const data = await clinicService.remove(String(req.params.id));
    invalidateCacheByPrefix(buildCacheKey("clinics"));
    res.json(apiSuccess(data, "Clinic deleted"));
  }
};
