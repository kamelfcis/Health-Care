import { api } from "./api";

export interface SpecialtyCatalogItem {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  description?: string | null;
  isActive: boolean;
}

export interface ClinicSpecialtyItem {
  id: string;
  clinicId: string;
  specialtyId: string;
  templateId?: string | null;
  template?: Pick<SpecialtyTemplate, "id" | "title" | "titleAr" | "version" | "isActive"> | null;
  specialty: SpecialtyCatalogItem;
}

export interface SpecialtyTemplateFieldOption {
  id: string;
  value: string;
  label: string;
  labelAr: string;
  displayOrder: number;
}

export interface SpecialtyTemplateField {
  id: string;
  key: string;
  label: string;
  labelAr: string;
  section: string;
  sectionAr: string;
  fieldType: "TEXT" | "NUMBER" | "YES_NO" | "DATE" | "DROPDOWN" | "MULTI_SELECT" | "AUTO" | "GRID";
  isRequired: boolean;
  displayOrder: number;
  helpText?: string | null;
  helpTextAr?: string | null;
  visibleWhen?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  options: SpecialtyTemplateFieldOption[];
}

export interface SpecialtyTemplateRule {
  id: string;
  key: string;
  name: string;
  nameAr: string;
  type: "ALERT" | "DIAGNOSIS" | "COMPUTE";
  severity?: string | null;
  expression: Record<string, unknown>;
  displayOrder: number;
}

export interface SpecialtyRulePayload {
  key: string;
  name: string;
  nameAr: string;
  type: "ALERT" | "DIAGNOSIS" | "COMPUTE";
  expression: Record<string, unknown>;
  severity?: string;
  displayOrder?: number;
}

export interface SpecialtyTemplate {
  id: string;
  specialtyId: string;
  version: number;
  isActive: boolean;
  title: string;
  titleAr: string;
  fields: SpecialtyTemplateField[];
  rules: SpecialtyTemplateRule[];
}

export interface SpecialtyAssessment {
  id: string;
  patientId: string;
  specialtyId: string;
  values: Record<string, unknown>;
  computed?: Record<string, unknown> | null;
  alerts?: Array<Record<string, unknown>> | null;
  diagnoses?: Array<Record<string, unknown>> | null;
  updatedAt: string;
}

export const specialtyService = {
  async listCatalog() {
    const res = await api.get<{ data: SpecialtyCatalogItem[] }>("/specialties/catalog");
    return res.data.data;
  },

  async listMyClinicSpecialties(clinicId?: string) {
    const res = await api.get<{ data: ClinicSpecialtyItem[] }>("/specialties/clinic/me", {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async replaceMyClinicSpecialties(specialtyCodes: string[], clinicId?: string) {
    const res = await api.put<{ data: ClinicSpecialtyItem[] }>(
      "/specialties/clinic/me",
      { specialtyCodes },
      { params: clinicId ? { clinicId } : undefined }
    );
    return res.data.data;
  },

  async adminAssignClinicSpecialtyTemplate(clinicSpecialtyId: string, templateId: string) {
    const res = await api.patch<{ data: ClinicSpecialtyItem }>(
      `/specialties/admin/clinic-specialties/${clinicSpecialtyId}/template`,
      { templateId }
    );
    return res.data.data;
  },

  async getPatientSpecialtyTemplate(patientId: string, specialtyCode: string, clinicId?: string) {
    const res = await api.get<{ data: { specialty: SpecialtyCatalogItem; template: SpecialtyTemplate } }>(
      `/patients/${patientId}/specialties/${specialtyCode}/template`,
      { params: clinicId ? { clinicId } : undefined }
    );
    return res.data.data;
  },

  async getPatientSpecialtyAssessment(patientId: string, specialtyCode: string, clinicId?: string) {
    const res = await api.get<{ data: { specialty: SpecialtyCatalogItem; template: SpecialtyTemplate; assessment: SpecialtyAssessment | null } }>(
      `/patients/${patientId}/specialties/${specialtyCode}/assessment`,
      { params: clinicId ? { clinicId } : undefined }
    );
    return res.data.data;
  },

  async savePatientSpecialtyAssessment(
    patientId: string,
    specialtyCode: string,
    values: Record<string, unknown>,
    clinicId?: string
  ) {
    const res = await api.put<{ data: SpecialtyAssessment }>(
      `/patients/${patientId}/specialties/${specialtyCode}/assessment`,
      { values },
      { params: clinicId ? { clinicId } : undefined }
    );
    return res.data.data;
  },

  async adminListTemplatesBySpecialty(specialtyCode: string) {
    const res = await api.get<{ data: { specialty: SpecialtyCatalogItem; templates: SpecialtyTemplate[] } }>(
      `/specialties/admin/${specialtyCode}/templates`
    );
    return res.data.data;
  },

  async adminCreateTemplate(
    specialtyCode: string,
    payload: { title: string; titleAr: string; isActive?: boolean }
  ) {
    const res = await api.post<{ data: SpecialtyTemplate }>(`/specialties/admin/${specialtyCode}/templates`, payload);
    return res.data.data;
  },

  async adminUpdateTemplate(
    templateId: string,
    payload: { title?: string; titleAr?: string; isActive?: boolean }
  ) {
    const res = await api.patch<{ data: SpecialtyTemplate }>(`/specialties/admin/templates/${templateId}`, payload);
    return res.data.data;
  },

  async adminCloneTemplate(
    templateId: string,
    payload?: { title?: string; titleAr?: string; isActive?: boolean }
  ) {
    const res = await api.post<{ data: SpecialtyTemplate }>(`/specialties/admin/templates/${templateId}/clone`, payload ?? {});
    return res.data.data;
  },

  async adminDeleteTemplate(templateId: string) {
    const res = await api.delete<{ data: SpecialtyTemplate }>(`/specialties/admin/templates/${templateId}`);
    return res.data.data;
  },

  async adminCreateField(
    templateId: string,
    payload: {
      key: string;
      label: string;
      labelAr: string;
      section: string;
      sectionAr: string;
      fieldType: SpecialtyTemplateField["fieldType"];
      isRequired?: boolean;
      displayOrder?: number;
      helpText?: string;
      helpTextAr?: string;
    }
  ) {
    const res = await api.post<{ data: SpecialtyTemplateField }>(
      `/specialties/admin/templates/${templateId}/fields`,
      payload
    );
    return res.data.data;
  },

  async adminUpdateField(
    fieldId: string,
    payload: Partial<{
      key: string;
      label: string;
      labelAr: string;
      section: string;
      sectionAr: string;
      fieldType: SpecialtyTemplateField["fieldType"];
      isRequired: boolean;
      displayOrder: number;
      helpText: string;
      helpTextAr: string;
    }>
  ) {
    const res = await api.patch<{ data: SpecialtyTemplateField }>(`/specialties/admin/fields/${fieldId}`, payload);
    return res.data.data;
  },

  async adminDeleteField(fieldId: string) {
    await api.delete(`/specialties/admin/fields/${fieldId}`);
  },

  async adminReorderFields(templateId: string, fieldIds: string[]) {
    const res = await api.patch<{ data: SpecialtyTemplateField[] }>(
      `/specialties/admin/templates/${templateId}/fields/reorder`,
      { fieldIds }
    );
    return res.data.data;
  },

  async adminCreateOption(
    fieldId: string,
    payload: {
      value: string;
      label: string;
      labelAr: string;
      displayOrder?: number;
    }
  ) {
    const res = await api.post<{ data: SpecialtyTemplateFieldOption }>(
      `/specialties/admin/fields/${fieldId}/options`,
      payload
    );
    return res.data.data;
  },

  async adminDeleteOption(optionId: string) {
    await api.delete(`/specialties/admin/options/${optionId}`);
  },

  async adminReorderOptions(fieldId: string, optionIds: string[]) {
    const res = await api.patch<{ data: SpecialtyTemplateFieldOption[] }>(
      `/specialties/admin/fields/${fieldId}/options/reorder`,
      { optionIds }
    );
    return res.data.data;
  },

  async adminUpdateOption(
    optionId: string,
    payload: Partial<{
      value: string;
      label: string;
      labelAr: string;
      displayOrder: number;
    }>
  ) {
    const res = await api.patch<{ data: SpecialtyTemplateFieldOption }>(`/specialties/admin/options/${optionId}`, payload);
    return res.data.data;
  },

  async adminListRules(templateId: string) {
    const res = await api.get<{ data: SpecialtyTemplateRule[] }>(`/specialties/admin/templates/${templateId}/rules`);
    return res.data.data;
  },

  async adminCreateRule(templateId: string, payload: SpecialtyRulePayload) {
    const res = await api.post<{ data: SpecialtyTemplateRule }>(`/specialties/admin/templates/${templateId}/rules`, payload);
    return res.data.data;
  },

  async adminUpdateRule(
    ruleId: string,
    payload: Partial<{
      key: string;
      name: string;
      nameAr: string;
      type: "ALERT" | "DIAGNOSIS" | "COMPUTE";
      expression: Record<string, unknown>;
      severity: string | null;
      displayOrder: number;
    }>
  ) {
    const res = await api.patch<{ data: SpecialtyTemplateRule }>(`/specialties/admin/rules/${ruleId}`, payload);
    return res.data.data;
  },

  async adminDeleteRule(ruleId: string) {
    await api.delete(`/specialties/admin/rules/${ruleId}`);
  },

  async adminReorderRules(templateId: string, ruleIds: string[]) {
    const res = await api.patch<{ data: SpecialtyTemplateRule[] }>(
      `/specialties/admin/templates/${templateId}/rules/reorder`,
      { ruleIds }
    );
    return res.data.data;
  }
};
