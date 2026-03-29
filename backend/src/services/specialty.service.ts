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

  async adminListCatalogAll() {
    return prisma.specialtyCatalog.findMany({
      where: { deletedAt: null },
      orderBy: [{ name: "asc" }]
    });
  },

  async adminCreateCatalog(input: {
    code: string;
    name: string;
    nameAr: string;
    description?: string;
    isActive?: boolean;
  }) {
    const normalizedCode = input.code.trim().toUpperCase();
    if (!normalizedCode) {
      throw new AppError("Specialty code is required", 400);
    }
    const existing = await prisma.specialtyCatalog.findFirst({
      where: { code: normalizedCode, deletedAt: null },
      select: { id: true }
    });
    if (existing) {
      throw new AppError("Specialty code already exists", 400);
    }

    return prisma.specialtyCatalog.create({
      data: {
        code: normalizedCode,
        name: input.name.trim(),
        nameAr: input.nameAr.trim(),
        description: input.description?.trim() || null,
        isActive: input.isActive ?? true
      }
    });
  },

  async adminUpdateCatalog(
    specialtyId: string,
    input: Partial<{
      code: string;
      name: string;
      nameAr: string;
      description: string | null;
      isActive: boolean;
    }>
  ) {
    const existing = await prisma.specialtyCatalog.findFirst({
      where: { id: specialtyId, deletedAt: null },
      select: { id: true, code: true }
    });
    if (!existing) throw new AppError("Specialty not found", 404);

    let nextCode: string | undefined;
    if (input.code !== undefined) {
      nextCode = input.code.trim().toUpperCase();
      if (!nextCode) throw new AppError("Specialty code is required", 400);
      if (nextCode !== existing.code) {
        const codeTaken = await prisma.specialtyCatalog.findFirst({
          where: { code: nextCode, deletedAt: null, id: { not: specialtyId } },
          select: { id: true }
        });
        if (codeTaken) throw new AppError("Specialty code already exists", 400);
      }
    }

    return prisma.specialtyCatalog.update({
      where: { id: specialtyId },
      data: {
        ...(nextCode !== undefined ? { code: nextCode } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.nameAr !== undefined ? { nameAr: input.nameAr.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description === null ? null : input.description.trim() || null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });
  },

  async adminSoftDeleteCatalog(specialtyId: string) {
    const existing = await prisma.specialtyCatalog.findFirst({
      where: { id: specialtyId, deletedAt: null },
      select: { id: true }
    });
    if (!existing) throw new AppError("Specialty not found", 404);

    await prisma.specialtyCatalog.update({
      where: { id: specialtyId },
      data: {
        isActive: false,
        deletedAt: new Date()
      }
    });

    return { id: specialtyId };
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
        sections: {
          orderBy: { displayOrder: "asc" }
        },
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

  async listTemplateSections(templateId: string) {
    const template = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true }
    });
    if (!template) throw new AppError("Template not found", 404);

    return prisma.specialtyTemplateSection.findMany({
      where: { templateId },
      orderBy: { displayOrder: "asc" }
    });
  },

  async createTemplateSection(
    templateId: string,
    input: { key: string; name: string; nameAr: string; displayOrder?: number }
  ) {
    const template = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true }
    });
    if (!template) throw new AppError("Template not found", 404);

    const maxOrderRow = await prisma.specialtyTemplateSection.findFirst({
      where: { templateId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true }
    });
    const fallbackOrder = (maxOrderRow?.displayOrder ?? 0) + 1;

    return prisma.specialtyTemplateSection.create({
      data: {
        templateId,
        key: input.key.trim().toLowerCase(),
        name: input.name.trim(),
        nameAr: input.nameAr.trim(),
        displayOrder: input.displayOrder ?? fallbackOrder
      }
    });
  },

  async updateTemplateSection(
    sectionId: string,
    input: Partial<{ key: string; name: string; nameAr: string; displayOrder: number }>
  ) {
    const section = await prisma.specialtyTemplateSection.findUnique({
      where: { id: sectionId },
      select: { id: true }
    });
    if (!section) throw new AppError("Section not found", 404);

    return prisma.specialtyTemplateSection.update({
      where: { id: sectionId },
      data: {
        ...(input.key !== undefined ? { key: input.key.trim().toLowerCase() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.nameAr !== undefined ? { nameAr: input.nameAr.trim() } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {})
      }
    });
  },

  async reorderTemplateSections(templateId: string, sectionIds: string[]) {
    const sections = await prisma.specialtyTemplateSection.findMany({
      where: { templateId },
      select: { id: true }
    });
    const existingIds = new Set(sections.map((section) => section.id));
    if (sectionIds.length !== sections.length || sectionIds.some((id) => !existingIds.has(id))) {
      throw new AppError("Invalid section order payload", 400);
    }

    await prisma.$transaction(
      sectionIds.map((sectionId, index) =>
        prisma.specialtyTemplateSection.update({
          where: { id: sectionId },
          data: { displayOrder: index + 1 }
        })
      )
    );

    return prisma.specialtyTemplateSection.findMany({
      where: { templateId },
      orderBy: { displayOrder: "asc" }
    });
  },

  async removeTemplateSection(sectionId: string) {
    const section = await prisma.specialtyTemplateSection.findUnique({
      where: { id: sectionId }
    });
    if (!section) throw new AppError("Section not found", 404);

    await prisma.specialtyTemplateSection.delete({ where: { id: sectionId } });
    return { id: sectionId };
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
        sections: {
          orderBy: { displayOrder: "asc" }
        },
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

      const sectionIdMap = new Map<string, string>();
      for (const section of source.sections) {
        const clonedSection = await tx.specialtyTemplateSection.create({
          data: {
            templateId: clonedTemplate.id,
            key: section.key,
            name: section.name,
            nameAr: section.nameAr,
            displayOrder: section.displayOrder
          }
        });
        sectionIdMap.set(section.id, clonedSection.id);
      }

      const fieldIdMap = new Map<string, string>();
      for (const field of source.fields) {
        const clonedField = await tx.specialtyTemplateField.create({
          data: {
            templateId: clonedTemplate.id,
            sectionId: field.sectionId ? sectionIdMap.get(field.sectionId) ?? null : null,
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
            fieldId: rule.fieldId ? fieldIdMap.get(rule.fieldId) ?? null : null,
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
      sectionId?: string;
      section?: string;
      sectionAr?: string;
      fieldType: "TEXT" | "TEXT_AREA" | "NUMBER" | "YES_NO" | "DATE" | "DROPDOWN" | "MULTI_SELECT" | "AUTO" | "GRID";
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
    let resolvedSectionId: string | undefined;
    let resolvedSection = input.section?.trim() ?? "";
    let resolvedSectionAr = input.sectionAr?.trim() ?? "";
    if (input.sectionId) {
      const section = await prisma.specialtyTemplateSection.findFirst({
        where: { id: input.sectionId, templateId },
        select: { id: true, name: true, nameAr: true }
      });
      if (!section) {
        throw new AppError("Section not found for this template", 404);
      }
      resolvedSectionId = section.id;
      resolvedSection = section.name;
      resolvedSectionAr = section.nameAr;
    }
    if (!resolvedSection || !resolvedSectionAr) {
      throw new AppError("Section is required", 400);
    }

    return prisma.specialtyTemplateField.create({
      data: {
        templateId,
        sectionId: resolvedSectionId,
        key: input.key,
        label: input.label,
        labelAr: input.labelAr,
        section: resolvedSection,
        sectionAr: resolvedSectionAr,
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
      sectionId?: string | null;
      section?: string;
      sectionAr?: string;
      fieldType?: "TEXT" | "TEXT_AREA" | "NUMBER" | "YES_NO" | "DATE" | "DROPDOWN" | "MULTI_SELECT" | "AUTO" | "GRID";
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
      select: { id: true, templateId: true }
    });
    if (!existing) throw new AppError("Field not found", 404);

    let sectionPayload:
      | {
          sectionId?: string | null;
          section?: string;
          sectionAr?: string;
        }
      | undefined;

    if (input.sectionId !== undefined) {
      if (input.sectionId === null) {
        sectionPayload = { sectionId: null };
      } else {
        const section = await prisma.specialtyTemplateSection.findFirst({
          where: { id: input.sectionId, templateId: existing.templateId },
          select: { id: true, name: true, nameAr: true }
        });
        if (!section) throw new AppError("Section not found for this template", 404);
        sectionPayload = {
          sectionId: section.id,
          section: section.name,
          sectionAr: section.nameAr
        };
      }
    }

    return prisma.specialtyTemplateField.update({
      where: { id: fieldId },
      data: {
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.labelAr !== undefined ? { labelAr: input.labelAr } : {}),
        ...(sectionPayload ?? {}),
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

  async listTemplateRules(templateId: string, fieldId?: string) {
    const template = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true }
    });
    if (!template) throw new AppError("Template not found", 404);

    if (fieldId) {
      const field = await prisma.specialtyTemplateField.findFirst({
        where: { id: fieldId, templateId },
        select: { id: true }
      });
      if (!field) throw new AppError("Field not found for this template", 404);
    }

    return prisma.specialtyRule.findMany({
      where: { templateId, ...(fieldId ? { fieldId } : {}) },
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
      fieldId?: string;
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

    if (input.fieldId) {
      const field = await prisma.specialtyTemplateField.findFirst({
        where: { id: input.fieldId, templateId },
        select: { id: true }
      });
      if (!field) throw new AppError("Field not found for this template", 404);
    }

    return prisma.specialtyRule.create({
      data: {
        templateId,
        fieldId: input.fieldId ?? null,
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
      fieldId: string | null;
    }>
  ) {
    const existing = await prisma.specialtyRule.findUnique({
      where: { id: ruleId },
      select: { id: true, templateId: true }
    });
    if (!existing) throw new AppError("Rule not found", 404);

    if (input.fieldId !== undefined && input.fieldId !== null) {
      const field = await prisma.specialtyTemplateField.findFirst({
        where: { id: input.fieldId, templateId: existing.templateId },
        select: { id: true }
      });
      if (!field) throw new AppError("Field not found for this template", 404);
    }

    return prisma.specialtyRule.update({
      where: { id: ruleId },
      data: {
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.nameAr !== undefined ? { nameAr: input.nameAr } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.expression !== undefined ? { expression: input.expression as Prisma.InputJsonValue } : {}),
        ...(input.severity !== undefined ? { severity: input.severity } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.fieldId !== undefined ? { fieldId: input.fieldId } : {})
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
  },

  async bulkUpsertGridFields(
    templateId: string,
    payload: {
      deletedFieldIds: string[];
      cells: Array<{
        fieldId?: string;
        key: string;
        label: string;
        labelAr: string;
        sectionId: string;
        section: string;
        sectionAr: string;
        fieldType: "TEXT" | "TEXT_AREA" | "NUMBER" | "YES_NO" | "DATE" | "DROPDOWN" | "MULTI_SELECT" | "AUTO" | "GRID";
        displayOrder: number;
        metadata?: Record<string, unknown> | null;
        options?: Array<{
          id?: string;
          value: string;
          label: string;
          labelAr: string;
          displayOrder: number;
        }>;
      }>;
    }
  ) {
    const template = await prisma.specialtyTemplate.findUnique({
      where: { id: templateId },
      select: { id: true }
    });
    if (!template) throw new AppError("Template not found", 404);

    return prisma.$transaction(async (tx) => {
      if (payload.deletedFieldIds.length > 0) {
        await tx.specialtyTemplateOption.deleteMany({
          where: { field: { id: { in: payload.deletedFieldIds }, templateId } }
        });
        await tx.specialtyTemplateField.deleteMany({
          where: { id: { in: payload.deletedFieldIds }, templateId }
        });
      }

      const resultIds: string[] = [];

      for (const cell of payload.cells) {
        let fieldId: string;

        if (cell.fieldId) {
          await tx.specialtyTemplateField.update({
            where: { id: cell.fieldId },
            data: {
              label: cell.label,
              labelAr: cell.labelAr,
              fieldType: cell.fieldType,
              displayOrder: cell.displayOrder,
              metadata: cell.metadata === null
                ? Prisma.JsonNull
                : cell.metadata as Prisma.InputJsonValue ?? undefined
            }
          });
          fieldId = cell.fieldId;
        } else {
          const created = await tx.specialtyTemplateField.create({
            data: {
              templateId,
              sectionId: cell.sectionId,
              key: cell.key,
              label: cell.label,
              labelAr: cell.labelAr,
              section: cell.section,
              sectionAr: cell.sectionAr,
              fieldType: cell.fieldType,
              displayOrder: cell.displayOrder,
              metadata: cell.metadata as Prisma.InputJsonValue ?? undefined
            }
          });
          fieldId = created.id;
        }

        resultIds.push(fieldId);

        const nextOptions = cell.options ?? [];
        const nextOptionIds = new Set(
          nextOptions.map((o) => o.id).filter((id): id is string => Boolean(id))
        );

        await tx.specialtyTemplateOption.deleteMany({
          where: {
            fieldId,
            ...(nextOptionIds.size > 0 ? { id: { notIn: [...nextOptionIds] } } : {})
          }
        });

        for (const opt of nextOptions) {
          if (opt.id) {
            await tx.specialtyTemplateOption.update({
              where: { id: opt.id },
              data: {
                value: opt.value,
                label: opt.label,
                labelAr: opt.labelAr,
                displayOrder: opt.displayOrder
              }
            });
          } else {
            await tx.specialtyTemplateOption.create({
              data: {
                fieldId,
                value: opt.value,
                label: opt.label,
                labelAr: opt.labelAr,
                displayOrder: opt.displayOrder
              }
            });
          }
        }
      }

      return tx.specialtyTemplateField.findMany({
        where: { id: { in: resultIds } },
        include: { options: { orderBy: { displayOrder: "asc" } } },
        orderBy: { displayOrder: "asc" }
      });
    }, { maxWait: 10000, timeout: 30000 });
  }
};
