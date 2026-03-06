import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

const toJsonInput = (value: Record<string, unknown> | undefined) =>
  value === undefined ? undefined : (value as Prisma.InputJsonValue);

const toNullableJsonUpdate = (value: Record<string, unknown> | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
};

export const specialtyService = {
  async listCatalog() {
    return prisma.specialtyCatalog.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" }
    });
  },

  async listClinicSpecialties(clinicId: string) {
    return prisma.clinicSpecialty.findMany({
      where: { clinicId, deletedAt: null, specialty: { isActive: true, deletedAt: null } },
      include: {
        specialty: true,
        template: {
          select: {
            id: true,
            title: true,
            titleAr: true,
            version: true,
            isActive: true
          }
        }
      },
      orderBy: { specialty: { name: "asc" } }
    });
  },

  async replaceClinicSpecialties(clinicId: string, specialtyCodes: string[]) {
    const normalizedCodes = Array.from(new Set(specialtyCodes.map((item) => item.trim().toUpperCase()).filter(Boolean)));
    if (!normalizedCodes.length) {
      throw new AppError("At least one specialty is required", 400);
    }

    const specialties = await prisma.specialtyCatalog.findMany({
      where: { code: { in: normalizedCodes }, isActive: true, deletedAt: null },
      select: { id: true, code: true }
    });

    if (specialties.length !== normalizedCodes.length) {
      const found = new Set(specialties.map((item) => item.code));
      const missing = normalizedCodes.filter((code) => !found.has(code));
      throw new AppError(`Invalid specialties: ${missing.join(", ")}`, 400);
    }

    const specialtyTemplates = await prisma.specialtyTemplate.findMany({
      where: {
        specialtyId: { in: specialties.map((item) => item.id) },
        isActive: true
      },
      select: { id: true, specialtyId: true, version: true },
      orderBy: [{ specialtyId: "asc" }, { version: "desc" }]
    });
    const templateBySpecialty = new Map<string, string>();
    for (const template of specialtyTemplates) {
      if (!templateBySpecialty.has(template.specialtyId)) {
        templateBySpecialty.set(template.specialtyId, template.id);
      }
    }
    const missingTemplateSpecialties = specialties
      .filter((specialty) => !templateBySpecialty.has(specialty.id))
      .map((specialty) => specialty.code);
    if (missingTemplateSpecialties.length) {
      throw new AppError(
        `No active template configured for specialties: ${missingTemplateSpecialties.join(", ")}`,
        400
      );
    }

    await prisma.$transaction([
      prisma.clinicSpecialty.deleteMany({ where: { clinicId } }),
      prisma.clinicSpecialty.createMany({
        data: specialties.map((specialty) => ({
          clinicId,
          specialtyId: specialty.id,
          templateId: templateBySpecialty.get(specialty.id)
        }))
      })
    ]);

    return this.listClinicSpecialties(clinicId);
  },

  async listTemplatesBySpecialtyCode(specialtyCode: string) {
    const specialty = await prisma.specialtyCatalog.findFirst({
      where: { code: specialtyCode.toUpperCase(), deletedAt: null }
    });
    if (!specialty) throw new AppError("Specialty not found", 404);

    const templates = await prisma.specialtyTemplate.findMany({
      where: { specialtyId: specialty.id },
      include: {
        fields: {
          include: {
            options: {
              orderBy: { displayOrder: "asc" }
            }
          },
          orderBy: { displayOrder: "asc" }
        }
      },
      orderBy: [{ version: "desc" }]
    });

    return { specialty, templates };
  },

  async assignTemplateToClinicSpecialty(clinicSpecialtyId: string, templateId: string) {
    const clinicSpecialty = await prisma.clinicSpecialty.findUnique({
      where: { id: clinicSpecialtyId },
      select: { id: true, specialtyId: true }
    });
    if (!clinicSpecialty) throw new AppError("Clinic specialty mapping not found", 404);

    const template = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, specialtyId: true, title: true, titleAr: true, version: true, isActive: true }
    });
    if (!template) throw new AppError("Template not found", 404);
    if (template.specialtyId !== clinicSpecialty.specialtyId) {
      throw new AppError("Template does not belong to this specialty", 400);
    }

    return prisma.clinicSpecialty.update({
      where: { id: clinicSpecialtyId },
      data: { templateId: template.id },
      include: {
        specialty: true,
        template: {
          select: {
            id: true,
            title: true,
            titleAr: true,
            version: true,
            isActive: true
          }
        }
      }
    });
  },

  async createTemplateBySpecialtyCode(
    specialtyCode: string,
    input: { title: string; titleAr: string; isActive?: boolean }
  ) {
    const specialty = await prisma.specialtyCatalog.findFirst({
      where: { code: specialtyCode.toUpperCase(), deletedAt: null }
    });
    if (!specialty) throw new AppError("Specialty not found", 404);

    const latest = await prisma.specialtyTemplate.findFirst({
      where: { specialtyId: specialty.id },
      orderBy: { version: "desc" },
      select: { version: true }
    });
    const version = (latest?.version ?? 0) + 1;

    const template = await prisma.$transaction(async (tx) => {
      if (input.isActive) {
        await tx.specialtyTemplate.updateMany({
          where: { specialtyId: specialty.id, isActive: true },
          data: { isActive: false }
        });
      }
      return tx.specialtyTemplate.create({
        data: {
          specialtyId: specialty.id,
          version,
          title: input.title,
          titleAr: input.titleAr,
          isActive: Boolean(input.isActive)
        }
      });
    });

    return template;
  },

  async updateTemplate(
    templateId: string,
    input: {
      title?: string;
      titleAr?: string;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, specialtyId: true }
    });
    if (!existing) throw new AppError("Template not found", 404);

    return prisma.$transaction(async (tx) => {
      if (input.isActive) {
        await tx.specialtyTemplate.updateMany({
          where: { specialtyId: existing.specialtyId, isActive: true },
          data: { isActive: false }
        });
      }
      return tx.specialtyTemplate.update({
        where: { id: templateId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.titleAr !== undefined ? { titleAr: input.titleAr } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
        }
      });
    });
  },

  async cloneTemplate(templateId: string, input?: { title?: string; titleAr?: string; isActive?: boolean }) {
    const source = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      include: {
        fields: {
          include: { options: { orderBy: { displayOrder: "asc" } },
          },
          orderBy: { displayOrder: "asc" }
        },
        rules: {
          orderBy: { displayOrder: "asc" }
        }
      }
    });
    if (!source) throw new AppError("Template not found", 404);

    const latest = await prisma.specialtyTemplate.findFirst({
      where: { specialtyId: source.specialtyId },
      orderBy: { version: "desc" },
      select: { version: true }
    });
    const version = (latest?.version ?? 0) + 1;

    return prisma.$transaction(async (tx) => {
      if (input?.isActive) {
        await tx.specialtyTemplate.updateMany({
          where: { specialtyId: source.specialtyId, isActive: true },
          data: { isActive: false }
        });
      }

      const clonedTemplate = await tx.specialtyTemplate.create({
        data: {
          specialtyId: source.specialtyId,
          version,
          title: input?.title?.trim() || `${source.title} (Copy)`,
          titleAr: input?.titleAr?.trim() || `${source.titleAr} (نسخة)`,
          isActive: Boolean(input?.isActive)
        }
      });

      const fieldIdMap = new Map<string, string>();
      for (const field of source.fields) {
        const clonedField = await tx.specialtyTemplateField.create({
          data: {
            templateId: clonedTemplate.id,
            key: field.key,
            label: field.label,
            labelAr: field.labelAr,
            section: field.section,
            sectionAr: field.sectionAr,
            fieldType: field.fieldType,
            isRequired: field.isRequired,
            displayOrder: field.displayOrder,
            helpText: field.helpText ?? undefined,
            helpTextAr: field.helpTextAr ?? undefined,
            visibleWhen: field.visibleWhen as Prisma.InputJsonValue | undefined,
            metadata: field.metadata as Prisma.InputJsonValue | undefined
          }
        });
        fieldIdMap.set(field.id, clonedField.id);

        for (const option of field.options) {
          await tx.specialtyTemplateOption.create({
            data: {
              fieldId: clonedField.id,
              value: option.value,
              label: option.label,
              labelAr: option.labelAr,
              displayOrder: option.displayOrder
            }
          });
        }
      }

      for (const rule of source.rules) {
        await tx.specialtyRule.create({
          data: {
            templateId: clonedTemplate.id,
            key: rule.key,
            name: rule.name,
            nameAr: rule.nameAr,
            type: rule.type,
            expression: rule.expression as Prisma.InputJsonValue,
            severity: rule.severity ?? undefined,
            displayOrder: rule.displayOrder
          }
        });
      }

      return clonedTemplate;
    });
  },

  async removeTemplate(templateId: string) {
    const existing = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, isActive: true }
    });
    if (!existing) throw new AppError("Template not found", 404);
    if (existing.isActive) {
      throw new AppError("Cannot delete active template. Activate another template first", 400);
    }

    const linkedAssessments = await prisma.patientSpecialtyAssessment.count({
      where: { templateId }
    });
    if (linkedAssessments > 0) {
      throw new AppError("Cannot delete template because it is linked to existing patient assessments", 400);
    }
    const linkedClinicAssignments = await prisma.clinicSpecialty.count({
      where: { templateId, deletedAt: null }
    });
    if (linkedClinicAssignments > 0) {
      throw new AppError("Cannot delete template because it is assigned to one or more clinics", 400);
    }

    return prisma.specialtyTemplate.delete({
      where: { id: templateId }
    });
  },

  async createTemplateField(
    templateId: string,
    input: {
      key: string;
      label: string;
      labelAr: string;
      section: string;
      sectionAr: string;
      fieldType: "TEXT" | "NUMBER" | "YES_NO" | "DATE" | "DROPDOWN" | "MULTI_SELECT" | "AUTO" | "GRID";
      isRequired?: boolean;
      displayOrder?: number;
      helpText?: string;
      helpTextAr?: string;
      visibleWhen?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  ) {
    const template = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true }
    });
    if (!template) throw new AppError("Template not found", 404);

    const maxOrderRow = await prisma.specialtyTemplateField.findFirst({
      where: { templateId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true }
    });
    const fallbackOrder = (maxOrderRow?.displayOrder ?? 0) + 1;

    return prisma.specialtyTemplateField.create({
      data: {
        templateId,
        key: input.key,
        label: input.label,
        labelAr: input.labelAr,
        section: input.section,
        sectionAr: input.sectionAr,
        fieldType: input.fieldType,
        isRequired: Boolean(input.isRequired),
        displayOrder: input.displayOrder ?? fallbackOrder,
        helpText: input.helpText,
        helpTextAr: input.helpTextAr,
        visibleWhen: toJsonInput(input.visibleWhen),
        metadata: toJsonInput(input.metadata)
      },
      include: {
        options: {
          orderBy: { displayOrder: "asc" }
        }
      }
    });
  },

  async updateTemplateField(
    fieldId: string,
    input: {
      key?: string;
      label?: string;
      labelAr?: string;
      section?: string;
      sectionAr?: string;
      fieldType?: "TEXT" | "NUMBER" | "YES_NO" | "DATE" | "DROPDOWN" | "MULTI_SELECT" | "AUTO" | "GRID";
      isRequired?: boolean;
      displayOrder?: number;
      helpText?: string;
      helpTextAr?: string;
      visibleWhen?: Record<string, unknown> | null;
      metadata?: Record<string, unknown> | null;
    }
  ) {
    const existing = await prisma.specialtyTemplateField.findUnique({
      where: { id: fieldId },
      select: { id: true }
    });
    if (!existing) throw new AppError("Field not found", 404);

    return prisma.specialtyTemplateField.update({
      where: { id: fieldId },
      data: {
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.labelAr !== undefined ? { labelAr: input.labelAr } : {}),
        ...(input.section !== undefined ? { section: input.section } : {}),
        ...(input.sectionAr !== undefined ? { sectionAr: input.sectionAr } : {}),
        ...(input.fieldType !== undefined ? { fieldType: input.fieldType } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.helpText !== undefined ? { helpText: input.helpText } : {}),
        ...(input.helpTextAr !== undefined ? { helpTextAr: input.helpTextAr } : {}),
        ...(input.visibleWhen !== undefined ? { visibleWhen: toNullableJsonUpdate(input.visibleWhen) } : {}),
        ...(input.metadata !== undefined ? { metadata: toNullableJsonUpdate(input.metadata) } : {})
      },
      include: {
        options: {
          orderBy: { displayOrder: "asc" }
        }
      }
    });
  },

  async removeTemplateField(fieldId: string) {
    const existing = await prisma.specialtyTemplateField.findUnique({
      where: { id: fieldId },
      select: { id: true }
    });
    if (!existing) throw new AppError("Field not found", 404);

    await prisma.specialtyTemplateField.delete({ where: { id: fieldId } });
    return { id: fieldId };
  },

  async reorderTemplateFields(templateId: string, fieldIds: string[]) {
    const fields = await prisma.specialtyTemplateField.findMany({
      where: { templateId },
      select: { id: true }
    });
    const existingIds = new Set(fields.map((field) => field.id));
    if (fieldIds.length !== fields.length || fieldIds.some((id) => !existingIds.has(id))) {
      throw new AppError("Invalid field order payload", 400);
    }

    await prisma.$transaction(
      fieldIds.map((fieldId, index) =>
        prisma.specialtyTemplateField.update({
          where: { id: fieldId },
          data: { displayOrder: index + 1 }
        })
      )
    );

    return prisma.specialtyTemplateField.findMany({
      where: { templateId },
      include: {
        options: {
          orderBy: { displayOrder: "asc" }
        }
      },
      orderBy: { displayOrder: "asc" }
    });
  },

  async addFieldOption(
    fieldId: string,
    input: {
      value: string;
      label: string;
      labelAr: string;
      displayOrder?: number;
    }
  ) {
    const field = await prisma.specialtyTemplateField.findUnique({
      where: { id: fieldId },
      select: { id: true }
    });
    if (!field) throw new AppError("Field not found", 404);

    const maxOrderRow = await prisma.specialtyTemplateOption.findFirst({
      where: { fieldId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true }
    });
    const fallbackOrder = (maxOrderRow?.displayOrder ?? 0) + 1;

    return prisma.specialtyTemplateOption.create({
      data: {
        fieldId,
        value: input.value,
        label: input.label,
        labelAr: input.labelAr,
        displayOrder: input.displayOrder ?? fallbackOrder
      }
    });
  },

  async updateFieldOption(
    optionId: string,
    input: Partial<{
      value: string;
      label: string;
      labelAr: string;
      displayOrder: number;
    }>
  ) {
    const existing = await prisma.specialtyTemplateOption.findUnique({
      where: { id: optionId },
      select: { id: true }
    });
    if (!existing) throw new AppError("Option not found", 404);

    return prisma.specialtyTemplateOption.update({
      where: { id: optionId },
      data: {
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.labelAr !== undefined ? { labelAr: input.labelAr } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {})
      }
    });
  },

  async removeFieldOption(optionId: string) {
    const existing = await prisma.specialtyTemplateOption.findUnique({
      where: { id: optionId },
      select: { id: true }
    });
    if (!existing) throw new AppError("Option not found", 404);

    await prisma.specialtyTemplateOption.delete({ where: { id: optionId } });
    return { id: optionId };
  },

  async reorderFieldOptions(fieldId: string, optionIds: string[]) {
    const options = await prisma.specialtyTemplateOption.findMany({
      where: { fieldId },
      select: { id: true }
    });
    const existingIds = new Set(options.map((option) => option.id));
    if (optionIds.length !== options.length || optionIds.some((id) => !existingIds.has(id))) {
      throw new AppError("Invalid option order payload", 400);
    }

    await prisma.$transaction(
      optionIds.map((optionId, index) =>
        prisma.specialtyTemplateOption.update({
          where: { id: optionId },
          data: { displayOrder: index + 1 }
        })
      )
    );

    return prisma.specialtyTemplateOption.findMany({
      where: { fieldId },
      orderBy: { displayOrder: "asc" }
    });
  },

  async listTemplateRules(templateId: string) {
    const template = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true }
    });
    if (!template) throw new AppError("Template not found", 404);

    return prisma.specialtyRule.findMany({
      where: { templateId },
      orderBy: { displayOrder: "asc" }
    });
  },

  async createTemplateRule(
    templateId: string,
    input: {
      key: string;
      name: string;
      nameAr: string;
      type: "ALERT" | "DIAGNOSIS" | "COMPUTE";
      expression: Record<string, unknown>;
      severity?: string;
      displayOrder?: number;
    }
  ) {
    const template = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true }
    });
    if (!template) throw new AppError("Template not found", 404);

    const maxOrderRow = await prisma.specialtyRule.findFirst({
      where: { templateId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true }
    });

    return prisma.specialtyRule.create({
      data: {
        templateId,
        key: input.key,
        name: input.name,
        nameAr: input.nameAr,
        type: input.type,
        expression: input.expression as Prisma.InputJsonValue,
        severity: input.severity,
        displayOrder: input.displayOrder ?? (maxOrderRow?.displayOrder ?? 0) + 1
      }
    });
  },

  async updateTemplateRule(
    ruleId: string,
    input: Partial<{
      key: string;
      name: string;
      nameAr: string;
      type: "ALERT" | "DIAGNOSIS" | "COMPUTE";
      expression: Record<string, unknown>;
      severity: string | null;
      displayOrder: number;
    }>
  ) {
    const existing = await prisma.specialtyRule.findUnique({
      where: { id: ruleId },
      select: { id: true }
    });
    if (!existing) throw new AppError("Rule not found", 404);

    return prisma.specialtyRule.update({
      where: { id: ruleId },
      data: {
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.nameAr !== undefined ? { nameAr: input.nameAr } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.expression !== undefined ? { expression: input.expression as Prisma.InputJsonValue } : {}),
        ...(input.severity !== undefined ? { severity: input.severity } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {})
      }
    });
  },

  async removeTemplateRule(ruleId: string) {
    const existing = await prisma.specialtyRule.findUnique({
      where: { id: ruleId },
      select: { id: true }
    });
    if (!existing) throw new AppError("Rule not found", 404);

    await prisma.specialtyRule.delete({ where: { id: ruleId } });
    return { id: ruleId };
  },

  async reorderTemplateRules(templateId: string, ruleIds: string[]) {
    const rules = await prisma.specialtyRule.findMany({
      where: { templateId },
      select: { id: true }
    });
    const existingIds = new Set(rules.map((rule) => rule.id));
    if (ruleIds.length !== rules.length || ruleIds.some((id) => !existingIds.has(id))) {
      throw new AppError("Invalid rule order payload", 400);
    }

    await prisma.$transaction(
      ruleIds.map((ruleId, index) =>
        prisma.specialtyRule.update({
          where: { id: ruleId },
          data: { displayOrder: index + 1 }
        })
      )
    );

    return prisma.specialtyRule.findMany({
      where: { templateId },
      orderBy: { displayOrder: "asc" }
    });
  }
};
