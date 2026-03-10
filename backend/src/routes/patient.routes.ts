import { Router } from "express";
import { z } from "zod";
import { patientController } from "../controllers/patient.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";
import patientSpecialtyRoutes from "./patient-specialty.routes";

const router = Router();

const createSchema = z.object({
  body: z.object({
    fullName: z.string().min(2),
    nationalId: z.string().regex(/^\d{14}$/, "nationalId must be exactly 14 digits").optional(),
    phone: z.string().min(3),
    whatsapp: z.string().optional(),
    dateOfBirth: z.string().optional(),
    profession: z.enum(["ADMIN_EMPLOYEE", "FREELANCER", "DRIVER", "ENGINEER", "FACTORY_WORKER", "OTHER"]),
    professionOther: z.string().optional(),
    leadSource: z.enum(["FACEBOOK_AD", "GOOGLE_SEARCH", "DOCTOR_REFERRAL", "FRIEND", "OTHER"]),
    leadSourceOther: z.string().optional(),
    address: z.string().optional(),
  }).superRefine((value, ctx) => {
    if (value.profession === "OTHER" && !value.professionOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["professionOther"],
        message: "professionOther is required when profession is OTHER"
      });
    }
    if (value.leadSource === "OTHER" && !value.leadSourceOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leadSourceOther"],
        message: "leadSourceOther is required when leadSource is OTHER"
      });
    }
  })
});

const updateSchema = z.object({
  body: z
    .object({
      fullName: z.string().min(2).optional(),
      nationalId: z.union([z.string().regex(/^\d{14}$/, "nationalId must be exactly 14 digits"), z.null()]).optional(),
      phone: z.string().min(3).optional(),
      whatsapp: z.string().optional(),
      dateOfBirth: z.string().optional(),
      profession: z.enum(["ADMIN_EMPLOYEE", "FREELANCER", "DRIVER", "ENGINEER", "FACTORY_WORKER", "OTHER"]).optional(),
      professionOther: z.string().optional().nullable(),
      leadSource: z.enum(["FACEBOOK_AD", "GOOGLE_SEARCH", "DOCTOR_REFERRAL", "FRIEND", "OTHER"]).optional(),
      leadSourceOther: z.string().optional().nullable(),
      address: z.string().optional()
    })
    .superRefine((value, ctx) => {
      if (value.profession === "OTHER" && !value.professionOther?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["professionOther"],
          message: "professionOther is required when profession is OTHER"
        });
      }
      if (value.leadSource === "OTHER" && !value.leadSourceOther?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["leadSourceOther"],
          message: "leadSourceOther is required when leadSource is OTHER"
        });
      }
    })
});

router.get("/", requireAuth, requirePermissions("patients.read"), asyncHandler(patientController.list));
router.get("/stats", requireAuth, requirePermissions("patients.read"), asyncHandler(patientController.stats));
router.get("/:id/assessments", requireAuth, requirePermissions("patients.read"), asyncHandler(patientController.listAssessments));
router.post(
  "/",
  requireAuth,
  requirePermissions("patients.manage"),
  validate(createSchema),
  asyncHandler(patientController.create)
);
router.patch(
  "/:id",
  requireAuth,
  requirePermissions("patients.manage"),
  validate(updateSchema),
  asyncHandler(patientController.update)
);
router.delete(
  "/:id",
  requireAuth,
  requirePermissions("patients.manage"),
  asyncHandler(patientController.remove)
);
router.use("/:id/specialties", patientSpecialtyRoutes);

export default router;
