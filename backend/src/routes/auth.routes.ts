import { Router } from "express";
import { z } from "zod";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { uploadClinicImage } from "../middleware/upload.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const registerSchema = z.object({
  body: z.object({
    clinicName: z.string().min(2),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    specialtyCodes: z
      .union([z.array(z.string().min(1)), z.string().min(1)])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(z.array(z.string().min(1)).min(1))
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1)
  })
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
});

router.post("/register", uploadClinicImage.single("clinicImage"), validate(registerSchema), asyncHandler(authController.register));
router.post("/login", validate(loginSchema), asyncHandler(authController.login));
router.post("/refresh", validate(refreshSchema), asyncHandler(authController.refresh));
router.get("/me", requireAuth, asyncHandler(authController.me));
router.post("/logout", requireAuth, asyncHandler(authController.logout));
router.post("/change-password", requireAuth, validate(changePasswordSchema), asyncHandler(authController.changePassword));

export default router;
