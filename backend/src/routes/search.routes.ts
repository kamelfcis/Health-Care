import { Router } from "express";
import { searchController } from "../controllers/search.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireAnyPermissions } from "../middleware/rbac.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireAnyPermissions("patients.read", "doctors.read", "billing.read"),
  asyncHandler(searchController.global)
);

export default router;
