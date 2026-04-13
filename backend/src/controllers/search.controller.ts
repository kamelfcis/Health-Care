import { Response } from "express";
import { searchService } from "../services/search.service";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope } from "../utils/tenant";

export const searchController = {
  async global(req: AuthenticatedRequest, res: Response) {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const clinicId = getOptionalClinicScope(req);
    const data = await searchService.global({
      q,
      clinicId,
      permissions: req.user?.permissions ?? [],
      requesterRole: req.user?.role,
      requesterUserId: req.user?.sub
    });
    res.json(apiSuccess(data));
  }
};
