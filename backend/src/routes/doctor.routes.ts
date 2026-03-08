import { Router } from "express";
import { z } from "zod";
import { doctorController } from "../controllers/doctor.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const createSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    licenseNumber: z.string().min(3),
    specialty: z.string().min(2)
  })
});

const updateSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    specialty: z.string().min(2).optional(),
    licenseNumber: z.string().min(3).optional(),
    isActive: z.boolean().optional()
  })
});

router.get("/", requireAuth, requirePermissions("doctors.read"), asyncHandler(doctorController.list));
router.get("/:id", requireAuth, requirePermissions("doctors.read"), asyncHandler(doctorController.getById));
router.post(
  "/",
  requireAuth,
  requirePermissions("doctors.manage"),
  validate(createSchema),
  asyncHandler(doctorController.create)
);
router.patch(
  "/:id",
  requireAuth,
  requirePermissions("doctors.manage"),
  validate(updateSchema),
  asyncHandler(doctorController.update)
);
router.delete(
  "/:id",
  requireAuth,
  requirePermissions("doctors.manage"),
  asyncHandler(doctorController.remove)
);

export default router;
