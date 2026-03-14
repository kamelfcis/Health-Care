import { Request, Response } from "express";
import { z } from "zod";
import { specialtyService } from "../services/specialty.service";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicId } from "../utils/tenant";
import { AppError } from "../utils/app-error";

const replaceSchema = z.object({
  specialtyCodes: z.array(z.string().min(1)).min(1)
});
const sectionSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().min(1),
  displayOrder: z.number().int().positive().optional()
});
const fieldTypeSchema = z.enum(["TEXT", "TEXT_AREA", "NUMBER", "YES_NO", "DATE", "DROPDOWN", "MULTI_SELECT", "AUTO", "GRID"]);
const ruleTypeSchema = z.enum(["ALERT", "DIAGNOSIS", "COMPUTE"]);

const resolveClinicId = (req: AuthenticatedRequest) => {
  const scoped = getOptionalClinicScope(req);
  if (scoped) return scoped;

  if (req.user?.role === "SuperAdmin") {
    throw new AppError("clinicId query param is required for SuperAdmin", 400);
  }

  return getScopedClinicId(req);
};

export const specialtyController = {
  async listCatalog(_req: Request, res: Response) {
    const data = await specialtyService.listCatalog();
    res.json(apiSuccess(data));
  },

  async adminListCatalog(_req: Request, res: Response) {
    const data = await specialtyService.adminListCatalogAll();
    res.json(apiSuccess(data));
  },

  async adminCreateCatalog(req: Request, res: Response) {
    const parsed = z
      .object({
        code: z.string().min(1),
        name: z.string().min(1),
        nameAr: z.string().min(1),
        description: z.string().optional(),
        isActive: z.boolean().optional()
      })
      .parse(req.body);
    const data = await specialtyService.adminCreateCatalog(parsed);
    res.status(201).json(apiSuccess(data, "Specialty created"));
  },

  async adminUpdateCatalog(req: Request, res: Response) {
    const parsed = z
      .object({
        code: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        nameAr: z.string().min(1).optional(),
        description: z.union([z.string(), z.null()]).optional(),
        isActive: z.boolean().optional()
      })
      .parse(req.body);
    const data = await specialtyService.adminUpdateCatalog(String(req.params.specialtyId), parsed);
    res.json(apiSuccess(data, "Specialty updated"));
  },

  async adminDeleteCatalog(req: Request, res: Response) {
    const data = await specialtyService.adminSoftDeleteCatalog(String(req.params.specialtyId));
    res.json(apiSuccess(data, "Specialty deleted"));
  },

  async myClinicSpecialties(req: AuthenticatedRequest, res: Response) {
    const clinicId = resolveClinicId(req);
    const data = await specialtyService.listClinicSpecialties(clinicId);
    res.json(apiSuccess(data));
  },

  async replaceMyClinicSpecialties(req: AuthenticatedRequest, res: Response) {
    const clinicId = resolveClinicId(req);
    const parsed = replaceSchema.parse(req.body);
    const data = await specialtyService.replaceClinicSpecialties(clinicId, parsed.specialtyCodes);
    res.json(apiSuccess(data, "Clinic specialties updated"));
  },

  async adminAssignClinicSpecialtyTemplate(req: Request, res: Response) {
    const parsed = z
      .object({
        templateId: z.string().min(1)
      })
      .parse(req.body);
    const data = await specialtyService.assignTemplateToClinicSpecialty(
      String(req.params.clinicSpecialtyId),
      parsed.templateId
    );
    res.json(apiSuccess(data, "Clinic specialty template assigned"));
  },

  async adminTemplatesBySpecialty(req: Request, res: Response) {
    const data = await specialtyService.listTemplatesBySpecialtyCode(String(req.params.specialtyCode));
    res.json(apiSuccess(data));
  },

  async adminCreateTemplate(req: Request, res: Response) {
    const parsed = z
      .object({
        title: z.string().min(1),
        titleAr: z.string().min(1),
        isActive: z.boolean().optional()
      })
      .parse(req.body);
    const data = await specialtyService.createTemplateBySpecialtyCode(String(req.params.specialtyCode), parsed);
    res.status(201).json(apiSuccess(data, "Template created"));
  },

  async adminUpdateTemplate(req: Request, res: Response) {
    const parsed = z
      .object({
        title: z.string().min(1).optional(),
        titleAr: z.string().min(1).optional(),
        isActive: z.boolean().optional()
      })
      .parse(req.body);
    const data = await specialtyService.updateTemplate(String(req.params.templateId), parsed);
    res.json(apiSuccess(data, "Template updated"));
  },

  async adminCloneTemplate(req: Request, res: Response) {
    const parsed = z
      .object({
        title: z.string().min(1).optional(),
        titleAr: z.string().min(1).optional(),
        isActive: z.boolean().optional()
      })
      .parse(req.body ?? {});
    const data = await specialtyService.cloneTemplate(String(req.params.templateId), parsed);
    res.status(201).json(apiSuccess(data, "Template cloned"));
  },

  async adminRemoveTemplate(req: Request, res: Response) {
    const data = await specialtyService.removeTemplate(String(req.params.templateId));
    res.json(apiSuccess(data, "Template deleted"));
  },

  async adminCreateField(req: Request, res: Response) {
    const parsed = z
      .object({
        key: z.string().min(1),
        label: z.string().min(1),
        labelAr: z.string().min(1),
        sectionId: z.string().min(1).optional(),
        section: z.string().min(1).optional(),
        sectionAr: z.string().min(1).optional(),
        fieldType: fieldTypeSchema,
        isRequired: z.boolean().optional(),
        displayOrder: z.number().int().positive().optional(),
        helpText: z.string().optional(),
        helpTextAr: z.string().optional(),
        visibleWhen: z.record(z.string(), z.unknown()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      })
      .refine((value) => Boolean(value.sectionId) || (Boolean(value.section) && Boolean(value.sectionAr)), {
        message: "sectionId or section/sectionAr are required",
        path: ["sectionId"]
      })
      .parse(req.body);
    const data = await specialtyService.createTemplateField(String(req.params.templateId), parsed);
    res.status(201).json(apiSuccess(data, "Field created"));
  },

  async adminListSections(req: Request, res: Response) {
    const data = await specialtyService.listTemplateSections(String(req.params.templateId));
    res.json(apiSuccess(data));
  },

  async adminCreateSection(req: Request, res: Response) {
    const parsed = sectionSchema.parse(req.body);
    const data = await specialtyService.createTemplateSection(String(req.params.templateId), parsed);
    res.status(201).json(apiSuccess(data, "Section created"));
  },

  async adminUpdateSection(req: Request, res: Response) {
    const parsed = sectionSchema.partial().parse(req.body);
    const data = await specialtyService.updateTemplateSection(String(req.params.sectionId), parsed);
    res.json(apiSuccess(data, "Section updated"));
  },

  async adminReorderSections(req: Request, res: Response) {
    const parsed = z
      .object({
        sectionIds: z.array(z.string().min(1)).min(1)
      })
      .parse(req.body);
    const data = await specialtyService.reorderTemplateSections(String(req.params.templateId), parsed.sectionIds);
    res.json(apiSuccess(data, "Sections reordered"));
  },

  async adminRemoveSection(req: Request, res: Response) {
    const data = await specialtyService.removeTemplateSection(String(req.params.sectionId));
    res.json(apiSuccess(data, "Section deleted"));
  },

  async adminUpdateField(req: Request, res: Response) {
    const parsed = z
      .object({
        key: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        labelAr: z.string().min(1).optional(),
        sectionId: z.union([z.string().min(1), z.null()]).optional(),
        section: z.string().min(1).optional(),
        sectionAr: z.string().min(1).optional(),
        fieldType: fieldTypeSchema.optional(),
        isRequired: z.boolean().optional(),
        displayOrder: z.number().int().positive().optional(),
        helpText: z.string().optional(),
        helpTextAr: z.string().optional(),
        visibleWhen: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
        metadata: z.union([z.record(z.string(), z.unknown()), z.null()]).optional()
      })
      .parse(req.body);
    const data = await specialtyService.updateTemplateField(String(req.params.fieldId), parsed);
    res.json(apiSuccess(data, "Field updated"));
  },

  async adminReorderFields(req: Request, res: Response) {
    const parsed = z
      .object({
        fieldIds: z.array(z.string().min(1)).min(1)
      })
      .parse(req.body);
    const data = await specialtyService.reorderTemplateFields(String(req.params.templateId), parsed.fieldIds);
    res.json(apiSuccess(data, "Fields reordered"));
  },

  async adminRemoveField(req: Request, res: Response) {
    const data = await specialtyService.removeTemplateField(String(req.params.fieldId));
    res.json(apiSuccess(data, "Field deleted"));
  },

  async adminCreateOption(req: Request, res: Response) {
    const parsed = z
      .object({
        value: z.string().min(1),
        label: z.string().min(1),
        labelAr: z.string().min(1),
        displayOrder: z.number().int().positive().optional()
      })
      .parse(req.body);
    const data = await specialtyService.addFieldOption(String(req.params.fieldId), parsed);
    res.status(201).json(apiSuccess(data, "Option created"));
  },

  async adminUpdateOption(req: Request, res: Response) {
    const parsed = z
      .object({
        value: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        labelAr: z.string().min(1).optional(),
        displayOrder: z.number().int().positive().optional()
      })
      .parse(req.body);
    const data = await specialtyService.updateFieldOption(String(req.params.optionId), parsed);
    res.json(apiSuccess(data, "Option updated"));
  },

  async adminReorderOptions(req: Request, res: Response) {
    const parsed = z
      .object({
        optionIds: z.array(z.string().min(1)).min(1)
      })
      .parse(req.body);
    const data = await specialtyService.reorderFieldOptions(String(req.params.fieldId), parsed.optionIds);
    res.json(apiSuccess(data, "Options reordered"));
  },

  async adminRemoveOption(req: Request, res: Response) {
    const data = await specialtyService.removeFieldOption(String(req.params.optionId));
    res.json(apiSuccess(data, "Option deleted"));
  },

  async adminListRules(req: Request, res: Response) {
    const parsedQuery = z
      .object({
        fieldId: z.string().min(1).optional()
      })
      .parse(req.query);
    const data = await specialtyService.listTemplateRules(String(req.params.templateId), parsedQuery.fieldId);
    res.json(apiSuccess(data));
  },

  async adminCreateRule(req: Request, res: Response) {
    const parsed = z
      .object({
        key: z.string().min(1),
        name: z.string().min(1),
        nameAr: z.string().min(1),
        type: ruleTypeSchema,
        expression: z.record(z.string(), z.unknown()),
        severity: z.string().optional(),
        displayOrder: z.number().int().positive().optional(),
        fieldId: z.string().min(1).optional()
      })
      .parse(req.body);
    const data = await specialtyService.createTemplateRule(String(req.params.templateId), parsed);
    res.status(201).json(apiSuccess(data, "Rule created"));
  },

  async adminUpdateRule(req: Request, res: Response) {
    const parsed = z
      .object({
        key: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        nameAr: z.string().min(1).optional(),
        type: ruleTypeSchema.optional(),
        expression: z.record(z.string(), z.unknown()).optional(),
        severity: z.union([z.string(), z.null()]).optional(),
        displayOrder: z.number().int().positive().optional(),
        fieldId: z.union([z.string().min(1), z.null()]).optional()
      })
      .parse(req.body);
    const data = await specialtyService.updateTemplateRule(String(req.params.ruleId), parsed);
    res.json(apiSuccess(data, "Rule updated"));
  },

  async adminReorderRules(req: Request, res: Response) {
    const parsed = z
      .object({
        ruleIds: z.array(z.string().min(1)).min(1)
      })
      .parse(req.body);
    const data = await specialtyService.reorderTemplateRules(String(req.params.templateId), parsed.ruleIds);
    res.json(apiSuccess(data, "Rules reordered"));
  },

  async adminRemoveRule(req: Request, res: Response) {
    const data = await specialtyService.removeTemplateRule(String(req.params.ruleId));
    res.json(apiSuccess(data, "Rule deleted"));
  }
};
