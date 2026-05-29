import { Response } from "express";
import { z } from "zod";
import { campaignCatalogService } from "../services/campaign-catalog.service";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicId, getScopedClinicIdForCreate } from "../utils/tenant";
import { AppError } from "../utils/app-error";

const createSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().min(1),
  isActive: z.boolean().optional()
});

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    nameAr: z.string().min(1).optional(),
    isActive: z.boolean().optional()
  })
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field required" });

function resolveClinicId(req: AuthenticatedRequest) {
  const scoped = getOptionalClinicScope(req);
  if (scoped) return scoped;
  if (req.user?.role === "SuperAdmin") {
    throw new AppError("clinicId query parameter is required", 400);
  }
  return getScopedClinicId(req);
}

export const campaignCatalogController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const clinicId = resolveClinicId(req);
    const data = await campaignCatalogService.listForClinic(clinicId);
    res.json(apiSuccess(data));
  },

  async manageList(req: AuthenticatedRequest, res: Response) {
    const clinicId = resolveClinicId(req);
    const data = await campaignCatalogService.manageListForClinic(clinicId);
    res.json(apiSuccess(data));
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicIdForCreate(req);
    const payload = createSchema.parse(req.body);
    const data = await campaignCatalogService.createForClinic(clinicId, payload);
    res.status(201).json(apiSuccess(data, "Campaign created"));
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const clinicId = resolveClinicId(req);
    const payload = updateSchema.parse(req.body);
    const data = await campaignCatalogService.updateForClinic(
      clinicId,
      String(req.params.campaignId),
      payload
    );
    res.json(apiSuccess(data, "Campaign updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const clinicId = resolveClinicId(req);
    const data = await campaignCatalogService.deleteForClinic(clinicId, String(req.params.campaignId));
    res.json(apiSuccess(data, "Campaign deleted"));
  }
};
