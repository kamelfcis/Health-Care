import { Router } from "express";
import { z } from "zod";
import { clinicController } from "../controllers/clinic.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/rbac.middleware";
import { uploadClinicImage } from "../middleware/upload.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const optionalBooleanFromInput = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}, z.boolean().optional());

const optionalNumberFromInput = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}, z.number().positive().optional());

const parseJsonInput = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const createSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    slug: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    countryCode: z.string().trim().toUpperCase().length(2).optional(),
    currencyCode: z.string().trim().toUpperCase().length(3).optional(),
    timezone: z.string().optional(),
    imageUrl: z.string().optional(),
    specialtyCodes: z.preprocess(parseJsonInput, z.array(z.string().min(1)).min(1)),
    adminUser: z.preprocess(parseJsonInput, z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8)
    }))
  })
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    countryCode: z.string().trim().toUpperCase().length(2).optional(),
    currencyCode: z.string().trim().toUpperCase().length(3).optional(),
    timezone: z.string().optional(),
    isActive: optionalBooleanFromInput,
    imageUrl: z.string().optional().nullable(),
    specialtyCodes: z.preprocess(parseJsonInput, z.array(z.string().min(1)).optional()),
    applyRetroactiveCurrencyConversion: optionalBooleanFromInput,
    conversionRate: optionalNumberFromInput
  })
});

const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    countryCode: z.string().trim().toUpperCase().length(2).optional(),
    currencyCode: z.string().trim().toUpperCase().length(3).optional(),
    timezone: z.string().optional(),
    specialtyCodes: z.array(z.string().min(1)).min(1).optional(),
    applyRetroactiveCurrencyConversion: optionalBooleanFromInput,
    conversionRate: optionalNumberFromInput
  })
});

router.get("/me", requireAuth, allowRoles("ClinicAdmin"), asyncHandler(clinicController.me));
router.patch(
  "/me",
  requireAuth,
  allowRoles("ClinicAdmin"),
  uploadClinicImage.single("clinicImage"),
  validate(updateMeSchema),
  asyncHandler(clinicController.updateMe)
);

router.get("/", requireAuth, allowRoles("SuperAdmin"), asyncHandler(clinicController.list));
router.post(
  "/",
  requireAuth,
  allowRoles("SuperAdmin"),
  uploadClinicImage.single("clinicImage"),
  validate(createSchema),
  asyncHandler(clinicController.create)
);
router.patch(
  "/:id",
  requireAuth,
  allowRoles("SuperAdmin"),
  uploadClinicImage.single("clinicImage"),
  validate(updateSchema),
  asyncHandler(clinicController.update)
);
router.delete("/:id", requireAuth, allowRoles("SuperAdmin"), asyncHandler(clinicController.remove));

export default router;
