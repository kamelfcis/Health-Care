import { Router } from "express";
import { z } from "zod";
import { patientController } from "../controllers/patient.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { uploadPatientExamAttachments } from "../middleware/upload.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";
import patientSpecialtyRoutes from "./patient-specialty.routes";

const router = Router();
const genderValues = ["MALE", "FEMALE", "OTHER"] as const;
const maritalStatusValues = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"] as const;
const governorateValues = [
  "CAIRO",
  "GIZA",
  "ALEXANDRIA",
  "SHARKIA",
  "DAKAHLIA",
  "QALYUBIA",
  "MINYA",
  "ASYUT",
  "SOHAG",
  "LUXOR",
  "ASWAN",
  "OTHER"
] as const;
const cityValues = [
  "NASR_CITY",
  "HELIOPOLIS",
  "MAADI",
  "DOKKI",
  "MOHANDESSIN",
  "ZAMALEK",
  "OTHER"
] as const;
const nationalityValues = [
  "EGYPTIAN",
  "SAUDI",
  "EMIRATI",
  "KUWAITI",
  "JORDANIAN",
  "SYRIAN",
  "LEBANESE",
  "IRAQI",
  "PALESTINIAN",
  "OTHER"
] as const;
const countryValues = ["EGYPT", "SAUDI_ARABIA", "UAE", "KUWAIT", "JORDAN", "SYRIA", "LEBANON", "IRAQ", "PALESTINE", "OTHER"] as const;
const referralTypeValues = ["DOCTOR", "FRIEND", "CAMPAIGN", "SOCIAL_MEDIA", "SEARCH", "OTHER"] as const;

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
    alternatePhone: z.string().optional(),
    email: z.string().email().optional(),
    gender: z.enum(genderValues).optional(),
    genderOther: z.string().optional(),
    nationality: z.enum(nationalityValues).optional(),
    nationalityOther: z.string().optional(),
    country: z.enum(countryValues).optional(),
    countryOther: z.string().optional(),
    governorate: z.enum(governorateValues).optional(),
    governorateOther: z.string().optional(),
    city: z.enum(cityValues).optional(),
    cityOther: z.string().optional(),
    maritalStatus: z.enum(maritalStatusValues).optional(),
    maritalStatusOther: z.string().optional(),
    occupation: z.string().optional(),
    branch: z.string().optional(),
    specialtyCode: z.string().optional(),
    specialtyName: z.string().optional(),
    clinicName: z.string().optional(),
    doctorName: z.string().optional(),
    campaignName: z.string().optional(),
    referrerName: z.string().optional(),
    referralType: z.enum(referralTypeValues).optional(),
    referralTypeOther: z.string().optional(),
    generalNotes: z.string().optional()
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
    if (value.gender === "OTHER" && !value.genderOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["genderOther"], message: "genderOther is required when gender is OTHER" });
    }
    if (value.nationality === "OTHER" && !value.nationalityOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nationalityOther"], message: "nationalityOther is required when nationality is OTHER" });
    }
    if (value.country === "OTHER" && !value.countryOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["countryOther"], message: "countryOther is required when country is OTHER" });
    }
    if (value.governorate === "OTHER" && !value.governorateOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["governorateOther"], message: "governorateOther is required when governorate is OTHER" });
    }
    if (value.city === "OTHER" && !value.cityOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cityOther"], message: "cityOther is required when city is OTHER" });
    }
    if (value.maritalStatus === "OTHER" && !value.maritalStatusOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maritalStatusOther"], message: "maritalStatusOther is required when maritalStatus is OTHER" });
    }
    if (value.referralType === "OTHER" && !value.referralTypeOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["referralTypeOther"], message: "referralTypeOther is required when referralType is OTHER" });
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
      address: z.string().optional(),
      alternatePhone: z.string().optional().nullable(),
      email: z.union([z.string().email(), z.null()]).optional(),
      gender: z.enum(genderValues).optional().nullable(),
      genderOther: z.string().optional().nullable(),
      nationality: z.enum(nationalityValues).optional().nullable(),
      nationalityOther: z.string().optional().nullable(),
      country: z.enum(countryValues).optional().nullable(),
      countryOther: z.string().optional().nullable(),
      governorate: z.enum(governorateValues).optional().nullable(),
      governorateOther: z.string().optional().nullable(),
      city: z.enum(cityValues).optional().nullable(),
      cityOther: z.string().optional().nullable(),
      maritalStatus: z.enum(maritalStatusValues).optional().nullable(),
      maritalStatusOther: z.string().optional().nullable(),
      occupation: z.string().optional().nullable(),
      branch: z.string().optional().nullable(),
      specialtyCode: z.string().optional().nullable(),
      specialtyName: z.string().optional().nullable(),
      clinicName: z.string().optional().nullable(),
      doctorName: z.string().optional().nullable(),
      campaignName: z.string().optional().nullable(),
      referrerName: z.string().optional().nullable(),
      referralType: z.enum(referralTypeValues).optional().nullable(),
      referralTypeOther: z.string().optional().nullable(),
      generalNotes: z.string().optional().nullable()
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
      if (value.gender === "OTHER" && !value.genderOther?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["genderOther"], message: "genderOther is required when gender is OTHER" });
      }
      if (value.nationality === "OTHER" && !value.nationalityOther?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nationalityOther"], message: "nationalityOther is required when nationality is OTHER" });
      }
      if (value.country === "OTHER" && !value.countryOther?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["countryOther"], message: "countryOther is required when country is OTHER" });
      }
      if (value.governorate === "OTHER" && !value.governorateOther?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["governorateOther"], message: "governorateOther is required when governorate is OTHER" });
      }
      if (value.city === "OTHER" && !value.cityOther?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cityOther"], message: "cityOther is required when city is OTHER" });
      }
      if (value.maritalStatus === "OTHER" && !value.maritalStatusOther?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maritalStatusOther"], message: "maritalStatusOther is required when maritalStatus is OTHER" });
      }
      if (value.referralType === "OTHER" && !value.referralTypeOther?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["referralTypeOther"], message: "referralTypeOther is required when referralType is OTHER" });
      }
    })
});

const createExamSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    examDate: z.string().min(1)
  })
});

const updateExamSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    examDate: z.string().min(1).optional()
  })
});

router.get("/", requireAuth, requirePermissions("patients.read"), asyncHandler(patientController.list));
router.get("/stats", requireAuth, requirePermissions("patients.read"), asyncHandler(patientController.stats));
router.get("/:id/assessments", requireAuth, requirePermissions("patients.read"), asyncHandler(patientController.listAssessments));
router.get("/:id/exams", requireAuth, requirePermissions("patients.read"), asyncHandler(patientController.listExams));
router.post(
  "/:id/exams",
  requireAuth,
  requirePermissions("patients.manage"),
  uploadPatientExamAttachments.array("attachments", 10),
  validate(createExamSchema),
  asyncHandler(patientController.createExam)
);
router.patch(
  "/:id/exams/:examId",
  requireAuth,
  requirePermissions("patients.manage"),
  uploadPatientExamAttachments.array("attachments", 10),
  validate(updateExamSchema),
  asyncHandler(patientController.updateExam)
);
router.delete(
  "/:id/exams/:examId",
  requireAuth,
  requirePermissions("patients.manage"),
  asyncHandler(patientController.removeExam)
);
router.delete(
  "/:id/exams/:examId/attachments/:attachmentId",
  requireAuth,
  requirePermissions("patients.manage"),
  asyncHandler(patientController.removeExamAttachment)
);
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
