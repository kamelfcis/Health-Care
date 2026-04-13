import { Router } from "express";
import { z } from "zod";
import { billingController } from "../controllers/billing.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const invoiceStatusZ = z.enum(["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"]);

const createSchema = z.object({
  body: z.object({
    patientId: z.string().min(1),
    appointmentId: z.string().min(1).optional(),
    invoiceNumber: z.string().min(2).optional(),
    amount: z.number().positive(),
    taxAmount: z.number().min(0).optional(),
    discount: z.number().min(0).optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    status: invoiceStatusZ.optional()
  })
});

const updateSchema = z.object({
  body: z
    .object({
      status: invoiceStatusZ.optional(),
      notes: z.string().optional(),
      amount: z.number().positive().optional(),
      taxAmount: z.number().min(0).optional(),
      discount: z.number().min(0).optional(),
      dueDate: z.union([z.string(), z.literal("")]).optional(),
      appointmentId: z.union([z.string().min(1), z.literal(""), z.null()]).optional()
    })
    .refine((b) => Object.keys(b).length > 0, { message: "At least one field required" })
});

router.get("/", requireAuth, requirePermissions("billing.read"), asyncHandler(billingController.list));
router.get("/stats", requireAuth, requirePermissions("billing.read"), asyncHandler(billingController.stats));
router.post(
  "/",
  requireAuth,
  requirePermissions("billing.manage"),
  validate(createSchema),
  asyncHandler(billingController.create)
);
router.patch(
  "/:id",
  requireAuth,
  requirePermissions("billing.manage"),
  validate(updateSchema),
  asyncHandler(billingController.update)
);
router.delete("/:id", requireAuth, requirePermissions("billing.manage"), asyncHandler(billingController.remove));

export default router;
