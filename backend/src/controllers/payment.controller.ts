import { Response } from "express";
import { PaymentStatus } from "@prisma/client";
import { paymentService } from "../services/payment.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicIdForCreate } from "../utils/tenant";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";

const invalidatePaymentBillingDashboard = (clinicId: string) => {
  invalidateCacheByPrefix(buildCacheKey("payments", clinicId));
  invalidateCacheByPrefix(buildCacheKey("payments", "all"));
  invalidateCacheByPrefix(buildCacheKey("billing", clinicId));
  invalidateCacheByPrefix(buildCacheKey("billing", "all"));
  invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
  invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
  invalidateCacheByPrefix(buildCacheKey("finance", clinicId));
  invalidateCacheByPrefix(buildCacheKey("finance", "all"));
};

export const paymentController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const { page, pageSize, search } = getPagination(req);
    const status =
      typeof req.query.status === "string" &&
      Object.values(PaymentStatus).includes(req.query.status as PaymentStatus)
        ? (req.query.status as PaymentStatus)
        : undefined;
    const method =
      typeof req.query.method === "string" && req.query.method.trim() ? req.query.method.trim().toUpperCase() : undefined;
    const createdFrom = typeof req.query.from === "string" ? req.query.from.trim().slice(0, 10) : undefined;
    const createdTo = typeof req.query.to === "string" ? req.query.to.trim().slice(0, 10) : undefined;
    const clinicId = getOptionalClinicScope(req);
    const cachePrefix = buildCacheKey("payments", clinicId ?? "all");
    const data = await getOrSetCache(
      buildCacheKey(
        cachePrefix,
        "list",
        page,
        pageSize,
        search ?? "",
        status ?? "",
        method ?? "",
        createdFrom ?? "",
        createdTo ?? ""
      ),
      45_000,
      () =>
        paymentService.list({
          clinicId,
          page,
          pageSize,
          search,
          status,
          method,
          createdFrom: createdFrom || undefined,
          createdTo: createdTo || undefined
        })
    );
    res.json(apiSuccess(data));
  },

  async stats(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const cachePrefix = buildCacheKey("payments", clinicId ?? "all");
    const data = await getOrSetCache(buildCacheKey(cachePrefix, "stats"), 30_000, () => paymentService.stats(clinicId));
    res.json(apiSuccess(data));
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicIdForCreate(req);
    const data = await paymentService.create(clinicId, req.body);
    invalidatePaymentBillingDashboard(clinicId);
    res.status(201).json(apiSuccess(data, "Payment created"));
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await paymentService.update(String(req.params.id), clinicId, req.body);
    if (clinicId) invalidatePaymentBillingDashboard(clinicId);
    else {
      invalidateCacheByPrefix(buildCacheKey("payments", "all"));
      invalidateCacheByPrefix(buildCacheKey("billing", "all"));
      invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    }
    res.json(apiSuccess(data, "Payment updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    await paymentService.remove(String(req.params.id), clinicId);
    if (clinicId) invalidatePaymentBillingDashboard(clinicId);
    else {
      invalidateCacheByPrefix(buildCacheKey("payments", "all"));
      invalidateCacheByPrefix(buildCacheKey("billing", "all"));
      invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    }
    res.json(apiSuccess({ ok: true }, "Payment deleted"));
  }
};
