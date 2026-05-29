import { Router } from "express";
import { campaignCatalogController } from "../controllers/campaign-catalog.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/rbac.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get("/", requireAuth, asyncHandler(campaignCatalogController.list));
router.get("/manage", requireAuth, asyncHandler(campaignCatalogController.manageList));

router.post(
  "/",
  requireAuth,
  allowRoles("ClinicAdmin", "SuperAdmin"),
  asyncHandler(campaignCatalogController.create)
);
router.patch(
  "/:campaignId",
  requireAuth,
  allowRoles("ClinicAdmin", "SuperAdmin"),
  asyncHandler(campaignCatalogController.update)
);
router.delete(
  "/:campaignId",
  requireAuth,
  allowRoles("ClinicAdmin", "SuperAdmin"),
  asyncHandler(campaignCatalogController.remove)
);

export default router;
