import { Router } from "express";
import { z } from "zod";
import { financeController } from "../controllers/finance.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const expenseCategoryEnum = z.enum([
  "UTILITIES",
  "RENT",
  "SALARIES",
  "SUPPLIES",
  "MAINTENANCE",
  "MARKETING",
  "OTHER"
]);

const createExpenseSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    category: expenseCategoryEnum,
    amount: z.number().positive(),
    expenseDate: z.string().min(1),
    notes: z.string().max(2000).optional()
  })
});

const updateExpenseSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).max(200).optional(),
      category: expenseCategoryEnum.optional(),
      amount: z.number().positive().optional(),
      expenseDate: z.string().min(1).optional(),
      notes: z.string().max(2000).nullable().optional()
    })
    .refine((b) => Object.keys(b).length > 0, { message: "At least one field required" })
});

router.get("/summary", requireAuth, requirePermissions("finance.read"), asyncHandler(financeController.summary));
router.get("/revenues", requireAuth, requirePermissions("finance.read"), asyncHandler(financeController.listRevenues));
router.get("/expenses", requireAuth, requirePermissions("finance.read"), asyncHandler(financeController.listExpenses));
router.get(
  "/expenses/stats",
  requireAuth,
  requirePermissions("finance.read"),
  asyncHandler(financeController.expenseStats)
);
router.post(
  "/expenses",
  requireAuth,
  requirePermissions("finance.manage"),
  validate(createExpenseSchema),
  asyncHandler(financeController.createExpense)
);
router.patch(
  "/expenses/:id",
  requireAuth,
  requirePermissions("finance.manage"),
  validate(updateExpenseSchema),
  asyncHandler(financeController.updateExpense)
);
router.delete(
  "/expenses/:id",
  requireAuth,
  requirePermissions("finance.manage"),
  asyncHandler(financeController.removeExpense)
);

export default router;
