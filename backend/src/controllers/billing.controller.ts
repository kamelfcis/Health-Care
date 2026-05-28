import { Response } from "express";
import { InvoiceLineType, InvoiceSourceType, InvoiceStatus } from "@prisma/client";

const INVOICE_SOURCE_TYPES = ["PROCEDURE", "EXAM", "CONSULTATION", "OTHER"] as const;
import { billingService } from "../services/billing.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicIdForCreate } from "../utils/tenant";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";

const invalidateBillingDashboard = (clinicId: string) => {
  invalidateCacheByPrefix(buildCacheKey("billing", clinicId));
  invalidateCacheByPrefix(buildCacheKey("billing", "all"));
  invalidateCacheByPrefix(buildCacheKey("payments", clinicId));
  invalidateCacheByPrefix(buildCacheKey("payments", "all"));
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
    const dueFrom = typeof req.query.from === "string" ? req.query.from.trim().slice(0, 10) : undefined;
    const dueTo = typeof req.query.to === "string" ? req.query.to.trim().slice(0, 10) : undefined;
    const invoiceTypeRaw = typeof req.query.invoiceType === "string" ? req.query.invoiceType.trim() : undefined;
    const invoiceType =
      invoiceTypeRaw && INVOICE_SOURCE_TYPES.includes(invoiceTypeRaw as (typeof INVOICE_SOURCE_TYPES)[number])
        ? (invoiceTypeRaw as InvoiceSourceType)
        : undefined;
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
        sort ?? "",
        dueFrom ?? "",
        dueTo ?? "",
        invoiceType ?? ""
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
          sort,
          dueFrom: dueFrom || undefined,
          dueTo: dueTo || undefined,
          invoiceType
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
    const invoiceTypeRaw = body.invoiceType;
    const invoiceType =
      typeof invoiceTypeRaw === "string" &&
      INVOICE_SOURCE_TYPES.includes(invoiceTypeRaw as (typeof INVOICE_SOURCE_TYPES)[number])
        ? (invoiceTypeRaw as InvoiceSourceType)
        : undefined;
    const lineItemsRaw = body.lineItems;
    const lineItems = Array.isArray(lineItemsRaw)
      ? lineItemsRaw.map((line) => ({
          lineType: String((line as Record<string, unknown>).lineType || "OTHER") as InvoiceLineType,
          title: typeof (line as Record<string, unknown>).title === "string" ? ((line as Record<string, unknown>).title as string) : undefined,
          quantity: Number((line as Record<string, unknown>).quantity || 1),
          unitPrice: Number((line as Record<string, unknown>).unitPrice || 0),
          discountPercent: Number((line as Record<string, unknown>).discountPercent || 0),
          taxPercent: Number((line as Record<string, unknown>).taxPercent || 0),
          catalogProcedureId:
            typeof (line as Record<string, unknown>).catalogProcedureId === "string"
              ? ((line as Record<string, unknown>).catalogProcedureId as string)
              : undefined
        }))
      : undefined;
    const data = await billingService.update(String(req.params.id), clinicId, {
      status: body.status as InvoiceStatus | undefined,
      notes: body.notes as string | undefined,
      amount: body.amount as number | undefined,
      taxAmount: body.taxAmount as number | undefined,
      discount: body.discount as number | undefined,
      dueDate: dueRaw === "" ? null : (dueRaw as string | undefined),
      appointmentId,
      invoiceType,
      lineItems
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
