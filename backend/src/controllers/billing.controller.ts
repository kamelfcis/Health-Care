import { Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import { billingService } from "../services/billing.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicIdForCreate } from "../utils/tenant";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";

const invalidateBillingDashboard = (clinicId: string) => {
  invalidateCacheByPrefix(buildCacheKey("billing", clinicId));
  invalidateCacheByPrefix(buildCacheKey("billing", "all"));
  invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
  invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
};

export const billingController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const { page, pageSize, search } = getPagination(req);
    const status =
      typeof req.query.status === "string" &&
      Object.values(InvoiceStatus).includes(req.query.status as InvoiceStatus)
        ? (req.query.status as InvoiceStatus)
        : undefined;
    const clinicId = getOptionalClinicScope(req);
    const patientId = typeof req.query.patientId === "string" ? req.query.patientId.trim() : undefined;
    const invoiceId = typeof req.query.invoiceId === "string" ? req.query.invoiceId.trim() : undefined;
    const openOnlyRaw = req.query.openOnly;
    const openOnly = openOnlyRaw === "1" || openOnlyRaw === "true";
    const sort =
      req.query.sort === "due_asc" || req.query.sort === "created_desc" ? (req.query.sort as "due_asc" | "created_desc") : undefined;
    const cachePrefix = buildCacheKey("billing", clinicId ?? "all");
    const data = await getOrSetCache(
      buildCacheKey(
        cachePrefix,
        "list",
        page,
        pageSize,
        search ?? "",
        status ?? "",
        patientId ?? "",
        invoiceId ?? "",
        openOnly ? "1" : "",
        sort ?? ""
      ),
      45_000,
      () =>
        billingService.list({
          clinicId,
          patientId,
          invoiceId,
          openOnly,
          page,
          pageSize,
          search,
          status,
          sort
        })
    );
    res.json(apiSuccess(data));
  },

  async stats(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const cachePrefix = buildCacheKey("billing", clinicId ?? "all");
    const data = await getOrSetCache(buildCacheKey(cachePrefix, "stats"), 30_000, () => billingService.stats(clinicId));
    res.json(apiSuccess(data));
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicIdForCreate(req);
    const data = await billingService.create(clinicId, req.body);
    invalidateBillingDashboard(clinicId);
    res.status(201).json(apiSuccess(data, "Invoice created"));
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const body = req.body as Record<string, unknown>;
    const dueRaw = body.dueDate;
    const apptRaw = body.appointmentId;
    const appointmentId =
      apptRaw === undefined
        ? undefined
        : apptRaw === null || apptRaw === ""
          ? null
          : (apptRaw as string);
    const data = await billingService.update(String(req.params.id), clinicId, {
      status: body.status as InvoiceStatus | undefined,
      notes: body.notes as string | undefined,
      amount: body.amount as number | undefined,
      taxAmount: body.taxAmount as number | undefined,
      discount: body.discount as number | undefined,
      dueDate: dueRaw === "" ? null : (dueRaw as string | undefined),
      appointmentId
    });
    if (clinicId) invalidateBillingDashboard(clinicId);
    else {
      invalidateCacheByPrefix(buildCacheKey("billing", "all"));
      invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    }
    res.json(apiSuccess(data, "Invoice updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await billingService.remove(String(req.params.id), clinicId);
    if (clinicId) invalidateBillingDashboard(clinicId);
    else {
      invalidateCacheByPrefix(buildCacheKey("billing", "all"));
      invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    }
    res.json(apiSuccess(data, "Invoice deleted"));
  }
};
