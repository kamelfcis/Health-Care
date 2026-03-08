import { Router } from "express";
import { z } from "zod";
import { adminController } from "../controllers/admin.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const createUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    roleId: z.string().min(1)
  })
});

const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    permissionKeys: z.array(z.string().min(1)).default([])
  })
});

const updateRolePermissionsSchema = z.object({
  body: z.object({
    permissionKeys: z.array(z.string().min(1))
  })
});

const updateUserRoleSchema = z.object({
  body: z.object({
    roleId: z.string().min(1)
  })
});

router.get("/permissions", requireAuth, requirePermissions("roles.read"), asyncHandler(adminController.listPermissions));
router.get("/roles", requireAuth, requirePermissions("roles.read"), asyncHandler(adminController.listRoles));
router.post(
  "/roles",
  requireAuth,
  requirePermissions("roles.manage"),
  validate(createRoleSchema),
  asyncHandler(adminController.createRole)
);
router.patch(
  "/roles/:id/permissions",
  requireAuth,
  requirePermissions("roles.manage"),
  validate(updateRolePermissionsSchema),
  asyncHandler(adminController.updateRolePermissions)
);
router.delete("/roles/:id", requireAuth, requirePermissions("roles.manage"), asyncHandler(adminController.deleteRole));
router.get("/users", requireAuth, requirePermissions("users.read"), asyncHandler(adminController.listUsers));
router.post(
  "/users",
  requireAuth,
  requirePermissions("users.manage"),
  validate(createUserSchema),
  asyncHandler(adminController.createUser)
);
router.patch(
  "/users/:id/role",
  requireAuth,
  requirePermissions("users.manage"),
  validate(updateUserRoleSchema),
  asyncHandler(adminController.updateUserRole)
);
router.delete("/users/:id", requireAuth, requirePermissions("users.manage"), asyncHandler(adminController.deleteUser));

export default router;
