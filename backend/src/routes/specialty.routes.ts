import { Router } from "express";
import { z } from "zod";
import { specialtyController } from "../controllers/specialty.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const replaceSchema = z.object({
  body: z.object({
    specialtyCodes: z.array(z.string().min(1)).min(1)
  })
});

router.get("/catalog", asyncHandler(specialtyController.listCatalog));
router.get(
  "/admin/catalog",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminListCatalog)
);
router.post(
  "/admin/catalog",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminCreateCatalog)
);
router.patch(
  "/admin/catalog/:specialtyId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminUpdateCatalog)
);
router.delete(
  "/admin/catalog/:specialtyId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminDeleteCatalog)
);
router.get("/clinic/me", requireAuth, asyncHandler(specialtyController.myClinicSpecialties));
router.put(
  "/clinic/me",
  requireAuth,
  allowRoles("ClinicAdmin", "SuperAdmin"),
  validate(replaceSchema),
  asyncHandler(specialtyController.replaceMyClinicSpecialties)
);
router.patch(
  "/admin/clinic-specialties/:clinicSpecialtyId/template",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminAssignClinicSpecialtyTemplate)
);

router.get(
  "/admin/:specialtyCode/templates",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminTemplatesBySpecialty)
);
router.post(
  "/admin/:specialtyCode/templates",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminCreateTemplate)
);
router.patch(
  "/admin/templates/:templateId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminUpdateTemplate)
);
router.post(
  "/admin/templates/:templateId/clone",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminCloneTemplate)
);
router.delete(
  "/admin/templates/:templateId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminRemoveTemplate)
);
router.post(
  "/admin/templates/:templateId/fields",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminCreateField)
);
router.get(
  "/admin/templates/:templateId/sections",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminListSections)
);
router.post(
  "/admin/templates/:templateId/sections",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminCreateSection)
);
router.patch(
  "/admin/sections/:sectionId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminUpdateSection)
);
router.patch(
  "/admin/templates/:templateId/sections/reorder",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminReorderSections)
);
router.delete(
  "/admin/sections/:sectionId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminRemoveSection)
);
router.patch(
  "/admin/templates/:templateId/fields/reorder",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminReorderFields)
);
router.patch(
  "/admin/fields/:fieldId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminUpdateField)
);
router.delete(
  "/admin/fields/:fieldId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminRemoveField)
);
router.post(
  "/admin/fields/:fieldId/options",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminCreateOption)
);
router.patch(
  "/admin/options/:optionId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminUpdateOption)
);
router.patch(
  "/admin/fields/:fieldId/options/reorder",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminReorderOptions)
);
router.delete(
  "/admin/options/:optionId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminRemoveOption)
);
router.post(
  "/admin/templates/:templateId/grid-bulk",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminBulkUpsertGridFields)
);
router.get(
  "/admin/templates/:templateId/rules",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminListRules)
);
router.post(
  "/admin/templates/:templateId/rules",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminCreateRule)
);
router.patch(
  "/admin/rules/:ruleId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminUpdateRule)
);
router.patch(
  "/admin/templates/:templateId/rules/reorder",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminReorderRules)
);
router.delete(
  "/admin/rules/:ruleId",
  requireAuth,
  allowRoles("SuperAdmin"),
  asyncHandler(specialtyController.adminRemoveRule)
);

export default router;
