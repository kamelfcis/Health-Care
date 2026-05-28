import { Router } from "express";
import { z } from "zod";
import { paymentController } from "../controllers/payment.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const createSchema = z.object({
  body: z.object({
    invoiceId: z.string().min(1),
    amount: z.number().positive(),
    method: z.string().min(1),
    transactionRef: z.string().optional(),
    status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).optional()
  })
});

const updateSchema = z.object({
  body: z
    .object({
      status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).optional(),
      transactionRef: z.string().optional(),
      amount: z.number().positive().optional(),
      method: z.string().min(1).optional()
    })
    .refine((b) => Object.keys(b).length > 0, { message: "At least one field required" })
});

router.get("/", requireAuth, requirePermissions("payments.read"), asyncHandler(paymentController.list));
router.get("/stats", requireAuth, requirePermissions("payments.read"), asyncHandler(paymentController.stats));
router.post(
  "/",
  requireAuth,
  requirePermissions("payments.manage"),
  validate(createSchema),
  asyncHandler(paymentController.create)
);
router.patch(
  "/:id",
  requireAuth,
  requirePermissions("payments.manage"),
  validate(updateSchema),
  asyncHandler(paymentController.update)
);
router.delete("/:id", requireAuth, requirePermissions("payments.manage"), asyncHandler(paymentController.remove));

export default router;
