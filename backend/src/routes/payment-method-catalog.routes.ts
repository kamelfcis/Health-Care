import { Router } from "express";
import { paymentMethodCatalogController } from "../controllers/payment-method-catalog.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/rbac.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get("/", requireAuth, asyncHandler(paymentMethodCatalogController.list));
router.get("/manage", requireAuth, asyncHandler(paymentMethodCatalogController.manageList));

router.post(
  "/",
  requireAuth,
  allowRoles("ClinicAdmin", "SuperAdmin"),
  asyncHandler(paymentMethodCatalogController.create)
);
router.patch(
  "/:methodId",
  requireAuth,
  allowRoles("ClinicAdmin", "SuperAdmin"),
  asyncHandler(paymentMethodCatalogController.update)
);
router.delete(
  "/:methodId",
  requireAuth,
  allowRoles("ClinicAdmin", "SuperAdmin"),
  asyncHandler(paymentMethodCatalogController.remove)
);

export default router;
