import { Router } from "express";
import { z } from "zod";
import { VisitEntryType } from "@prisma/client";
import { requireAuth } from "../middleware/auth.middleware";
import { requireAnyPermissions, requirePermissions } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";
import { patientSpecialtyController } from "../controllers/patient-specialty.controller";

const router = Router({ mergeParams: true });

const upsertSchema = z.object({
  body: z.object({
    values: z.record(z.string(), z.unknown()),
    entryType: z.nativeEnum(VisitEntryType).optional(),
    appointmentId: z.string().optional()
  })
});

router.get(
  "/:specialtyCode/template",
  requireAuth,
  requirePermissions("patients.read"),
  asyncHandler(patientSpecialtyController.template)
);
router.get(
  "/:specialtyCode/assessment",
  requireAuth,
  requirePermissions("patients.read"),
  asyncHandler(patientSpecialtyController.getAssessment)
);
router.put(
  "/:specialtyCode/assessment",
  requireAuth,
  requireAnyPermissions("specialty_assessments.manage", "medical_records.manage"),
  validate(upsertSchema),
  asyncHandler(patientSpecialtyController.upsertAssessment)
);

export default router;
