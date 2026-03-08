import { Router } from "express";
import { z } from "zod";
import { AppointmentStatus, VisitEntryType } from "@prisma/client";
import { appointmentController } from "../controllers/appointment.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const createSchema = z.object({
  body: z.object({
    doctorId: z.string().min(1),
    patientId: z.string().min(1),
    entryType: z.nativeEnum(VisitEntryType).default("EXAM"),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    reason: z.string().optional(),
    notes: z.string().optional(),
    status: z.nativeEnum(AppointmentStatus).optional()
  })
});

const updateSchema = z.object({
  body: z.object({
    doctorId: z.string().min(1).optional(),
    patientId: z.string().min(1).optional(),
    entryType: z.nativeEnum(VisitEntryType).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    reason: z.string().optional(),
    notes: z.string().optional(),
    status: z.nativeEnum(AppointmentStatus).optional()
  })
});

router.get("/", requireAuth, requirePermissions("appointments.read"), asyncHandler(appointmentController.list));
router.post(
  "/",
  requireAuth,
  requirePermissions("appointments.manage"),
  validate(createSchema),
  asyncHandler(appointmentController.create)
);
router.patch(
  "/:id",
  requireAuth,
  requirePermissions("appointments.manage"),
  validate(updateSchema),
  asyncHandler(appointmentController.update)
);
router.delete(
  "/:id",
  requireAuth,
  requirePermissions("appointments.manage"),
  asyncHandler(appointmentController.remove)
);

export default router;
