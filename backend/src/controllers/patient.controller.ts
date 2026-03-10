import { Response } from "express";
import { patientService } from "../services/patient.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicId } from "../utils/tenant";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";

const calculateAge = (dateOfBirth: Date | null | undefined) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
};

export const patientController = {
  async stats(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const cachePrefix = buildCacheKey("patients", clinicId ?? "all");
    const data = await getOrSetCache(buildCacheKey(cachePrefix, "stats"), 30_000, () =>
      patientService.stats(clinicId)
    );
    res.json(apiSuccess(data));
  },

  async list(req: AuthenticatedRequest, res: Response) {
    const { page, pageSize, search } = getPagination(req);
    const clinicId = getOptionalClinicScope(req);
    const cachePrefix = buildCacheKey("patients", clinicId ?? "all");
    const data = await getOrSetCache(
      buildCacheKey(cachePrefix, "list", page, pageSize, search ?? ""),
      45_000,
      () =>
        patientService.list({
          clinicId,
          page,
          pageSize,
          search,
          requesterRole: req.user?.role,
          requesterUserId: req.user?.sub
        })
    );
    res.json(apiSuccess({
      ...data,
      data: data.data.map((item) => ({
        ...item,
        age: calculateAge(item.dateOfBirth),
        lastVisitAt: item.appointments[0]?.startsAt ?? null
      }))
    }));
  },

  async listAssessments(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.listAssessments(
      String(req.params.id),
      clinicId,
      req.user?.role,
      req.user?.sub
    );
    res.json(apiSuccess(data));
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicId(req);
    const data = await patientService.create(clinicId, req.body);
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId));
    invalidateCacheByPrefix(buildCacheKey("patients", "all"));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    res.status(201).json(
      apiSuccess(
        {
          ...data,
          age: calculateAge(data.dateOfBirth)
        },
        "Patient created"
      )
    );
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.update(String(req.params.id), clinicId, req.body);
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId));
    invalidateCacheByPrefix(buildCacheKey("patients", "all"));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    res.json(apiSuccess(data, "Patient updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.remove(String(req.params.id), clinicId);
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId));
    invalidateCacheByPrefix(buildCacheKey("patients", "all"));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    res.json(apiSuccess(data, "Patient deleted"));
  }
};
