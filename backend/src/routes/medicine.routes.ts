import { Router } from "express";
import { z } from "zod";
import { medicineController } from "../controllers/medicine.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermissions } from "../middleware/rbac.middleware";
import { uploadMedicineImport } from "../middleware/upload.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const medicineSchema = z.object({
  arabicName: z.string().trim().min(1),
  englishName: z.string().trim().min(1),
  activeIngredient: z.string().trim().min(1),
  usageMethod: z.string().trim().optional().nullable(),
  specialty: z.string().trim().optional().nullable(),
  dosageForm: z.string().trim().optional().nullable(),
  concentration: z.string().trim().optional().nullable(),
  company: z.string().trim().optional().nullable(),
  warnings: z.string().trim().optional().nullable(),
  drugInteractions: z.string().trim().optional().nullable()
});

const createSchema = z.object({ body: medicineSchema });
const updateSchema = z.object({ body: medicineSchema.partial() });
const deleteRangeSchema = z.object({
  body: z.object({
    from: z.number().int().positive(),
    to: z.number().int().positive(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["arabicName", "englishName", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional()
  })
});

router.get("/", requireAuth, requirePermissions("pharmacy.view"), asyncHandler(medicineController.list));
router.get("/:id", requireAuth, requirePermissions("pharmacy.view"), asyncHandler(medicineController.getById));
router.post(
  "/",
  requireAuth,
  requirePermissions("pharmacy.create"),
  validate(createSchema),
  asyncHandler(medicineController.create)
);
router.put(
  "/:id",
  requireAuth,
  requirePermissions("pharmacy.edit"),
  validate(updateSchema),
  asyncHandler(medicineController.update)
);
router.delete(
  "/:id",
  requireAuth,
  requirePermissions("pharmacy.delete"),
  asyncHandler(medicineController.remove)
);
router.post(
  "/delete-range",
  requireAuth,
  requirePermissions("pharmacy.delete"),
  validate(deleteRangeSchema),
  asyncHandler(medicineController.deleteRange)
);
router.post(
  "/import",
  requireAuth,
  requirePermissions("pharmacy.import"),
  uploadMedicineImport.single("file"),
  asyncHandler(medicineController.importExcel)
);
router.get(
  "/import/template",
  requireAuth,
  requirePermissions("pharmacy.view"),
  asyncHandler(medicineController.downloadTemplate)
);

export default router;
