import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/rbac.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get("/all", requireAuth, allowRoles("SuperAdmin"), asyncHandler(userController.listAll));
router.delete("/all/:id", requireAuth, allowRoles("SuperAdmin"), asyncHandler(userController.remove));

export default router;
