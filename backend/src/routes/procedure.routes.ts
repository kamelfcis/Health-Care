import { Router } from "express";
import { z } from "zod";
import { procedureController } from "../controllers/procedure.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { uploadMedicineImport } from "../middleware/upload.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const catalogSchema = z.object({
  name: z.string().trim().min(1),
  procedureType: z.string().trim().min(1).optional(),
  defaultAmount: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional()
});

const createSchema = z.object({ body: catalogSchema });
const updateSchema = z.object({
  body: catalogSchema.partial().refine((b) => Object.keys(b).length > 0, {
    message: "At least one field required"
  })
});

router.get("/", requireAuth, requirePermissions("billing.read"), asyncHandler(procedureController.list));
router.get(
  "/all",
  requireAuth,
  requirePermissions("billing.manage"),
  asyncHandler(procedureController.listAll)
);
router.post(
  "/",
  requireAuth,
  requirePermissions("billing.manage"),
  validate(createSchema),
  asyncHandler(procedureController.create)
);
router.get(
  "/import/template",
  requireAuth,
  requirePermissions("billing.manage"),
  asyncHandler(procedureController.downloadTemplate)
);
router.post(
  "/import",
  requireAuth,
  requirePermissions("billing.manage"),
  uploadMedicineImport.single("file"),
  asyncHandler(procedureController.importExcel)
);
router.patch(
  "/:id",
  requireAuth,
  requirePermissions("billing.manage"),
  validate(updateSchema),
  asyncHandler(procedureController.update)
);
router.delete(
  "/:id",
  requireAuth,
  requirePermissions("billing.manage"),
  asyncHandler(procedureController.remove)
);

export default router;
