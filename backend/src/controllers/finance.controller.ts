import { Response } from "express";
import { ExpenseCategory } from "@prisma/client";
import { financeService } from "../services/finance.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicIdForCreate } from "../utils/tenant";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";

const invalidateFinanceCache = (clinicId: string) => {
  invalidateCacheByPrefix(buildCacheKey("finance", clinicId));
  invalidateCacheByPrefix(buildCacheKey("finance", "all"));
  invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
  invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
};

export const financeController = {
  async summary(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const from = typeof req.query.from === "string" ? req.query.from.trim().slice(0, 10) : undefined;
    const to = typeof req.query.to === "string" ? req.query.to.trim().slice(0, 10) : undefined;
    const cachePrefix = buildCacheKey("finance", clinicId ?? "all");
    const data = await getOrSetCache(
      buildCacheKey(cachePrefix, "summary", from ?? "", to ?? ""),
      30_000,
      () => financeService.summary(clinicId, from, to)
    );
    res.json(apiSuccess(data));
  },

  async listRevenues(req: AuthenticatedRequest, res: Response) {
    const { page, pageSize, search } = getPagination(req);
    const clinicId = getOptionalClinicScope(req);
    const from = typeof req.query.from === "string" ? req.query.from.trim().slice(0, 10) : undefined;
    const to = typeof req.query.to === "string" ? req.query.to.trim().slice(0, 10) : undefined;
    const data = await financeService.listRevenues({
      clinicId,
      page,
      pageSize,
      search,
      from,
      to
    });
    res.json(apiSuccess(data));
  },

  async listExpenses(req: AuthenticatedRequest, res: Response) {
    const { page, pageSize, search } = getPagination(req);
    const clinicId = getOptionalClinicScope(req);
    const from = typeof req.query.from === "string" ? req.query.from.trim().slice(0, 10) : undefined;
    const to = typeof req.query.to === "string" ? req.query.to.trim().slice(0, 10) : undefined;
    const category =
      typeof req.query.category === "string" &&
      Object.values(ExpenseCategory).includes(req.query.category as ExpenseCategory)
        ? (req.query.category as ExpenseCategory)
        : undefined;
    const data = await financeService.listExpenses({
      clinicId,
      page,
      pageSize,
      search,
      category,
      from,
      to
    });
    res.json(apiSuccess(data));
  },

  async expenseStats(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const from = typeof req.query.from === "string" ? req.query.from.trim().slice(0, 10) : undefined;
    const to = typeof req.query.to === "string" ? req.query.to.trim().slice(0, 10) : undefined;
    const cachePrefix = buildCacheKey("finance", clinicId ?? "all");
    const data = await getOrSetCache(
      buildCacheKey(cachePrefix, "expense-stats", from ?? "", to ?? ""),
      30_000,
      () => financeService.expenseStats(clinicId, from, to)
    );
    res.json(apiSuccess(data));
  },

  async createExpense(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicIdForCreate(req);
    const data = await financeService.createExpense(clinicId, req.user?.sub, req.body);
    invalidateFinanceCache(clinicId);
    res.status(201).json(apiSuccess(data, "Expense created"));
  },

  async updateExpense(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await financeService.updateExpense(String(req.params.id), clinicId, req.body);
    if (data.clinicId) invalidateFinanceCache(data.clinicId);
    res.json(apiSuccess(data, "Expense updated"));
  },

  async removeExpense(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const existing = await financeService.removeExpense(String(req.params.id), clinicId);
    if (clinicId) invalidateFinanceCache(clinicId);
    else invalidateCacheByPrefix(buildCacheKey("finance", "all"));
    res.json(apiSuccess(existing, "Expense deleted"));
  }
};
