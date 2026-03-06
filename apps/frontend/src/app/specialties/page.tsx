"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PencilLine, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGate } from "@/components/auth/role-gate";
import { useI18n } from "@/components/providers/i18n-provider";
import { RippleButton } from "@/components/ui/ripple-button";
import { clinicService } from "@/lib/clinic-service";
import { SpecialtyTemplate, SpecialtyTemplateField, SpecialtyTemplateRule, specialtyService } from "@/lib/specialty-service";

const fieldTypes = ["TEXT", "NUMBER", "YES_NO", "DATE", "DROPDOWN", "MULTI_SELECT", "AUTO", "GRID"] as const;
const ruleTypes = ["ALERT", "DIAGNOSIS", "COMPUTE"] as const;
const operators = ["eq", "neq", "gt", "gte", "lt", "lte", "includes"] as const;
const fieldTypeLabels: Record<(typeof fieldTypes)[number], string> = {
  TEXT: "نص",
  NUMBER: "رقم",
  YES_NO: "نعم / لا",
  DATE: "تاريخ",
  DROPDOWN: "قائمة منسدلة",
  MULTI_SELECT: "اختيار متعدد",
  AUTO: "تلقائي",
  GRID: "شبكة"
};
const ruleTypeLabels: Record<(typeof ruleTypes)[number], string> = {
  ALERT: "تنبيه",
  DIAGNOSIS: "تشخيص",
  COMPUTE: "حساب تلقائي"
};
const operatorLabels: Record<(typeof operators)[number], string> = {
  eq: "يساوي",
  neq: "لا يساوي",
  gt: "أكبر من",
  gte: "أكبر أو يساوي",
  lt: "أصغر من",
  lte: "أصغر أو يساوي",
  includes: "يحتوي"
};
const sectionColorClasses = [
  "border-sky-200 bg-sky-50/80 text-sky-800",
  "border-emerald-200 bg-emerald-50/80 text-emerald-800",
  "border-amber-200 bg-amber-50/80 text-amber-800",
  "border-violet-200 bg-violet-50/80 text-violet-800",
  "border-rose-200 bg-rose-50/80 text-rose-800",
  "border-cyan-200 bg-cyan-50/80 text-cyan-800"
];
const premiumIconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-700 hover:shadow";
const premiumDeleteButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 hover:shadow";
const dsInputClass =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const dsInputLgClass =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const dsInputCompactClass =
  "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const dsPanelClass = "rounded-2xl border border-slate-200 bg-slate-50/70 p-4";
const dsCardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const dsTextActionClass = "text-sm font-medium text-slate-600 transition hover:text-slate-800";
const dsTextActionSuccessClass = "text-sm font-medium text-emerald-700 transition hover:text-emerald-800";
const dsModalCancelButtonClass =
  "inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

type RuleCondition = {
  field: string;
  op: (typeof operators)[number];
  value: string;
};

type RuleFormState = {
  key: string;
  name: string;
  nameAr: string;
  type: (typeof ruleTypes)[number];
  logic: "all" | "any";
  conditions: RuleCondition[];
  severity: string;
  message: string;
  messageAr: string;
};

const emptyRule: RuleFormState = {
  key: "",
  name: "",
  nameAr: "",
  type: "ALERT",
  logic: "all",
  conditions: [{ field: "", op: "eq", value: "" }],
  severity: "MEDIUM",
  message: "",
  messageAr: ""
};

const buildExpression = (rule: RuleFormState) => {
  if (rule.type === "COMPUTE") {
    const first = rule.conditions[0] ?? { field: "" };
    return {
      formula: "copy",
      target: rule.name,
      field: first.field
    };
  }

  const conditionBlocks = rule.conditions
    .filter((condition) => condition.field.trim())
    .map((condition) => {
      const parsedValue = Number(condition.value);
      const normalizedValue = Number.isNaN(parsedValue) ? condition.value : parsedValue;
      return {
        field: condition.field,
        op: condition.op,
        value: normalizedValue
      };
    });

  return {
    [rule.logic]: conditionBlocks,
    ...(rule.type === "ALERT" ? { message: rule.message || rule.name, messageAr: rule.messageAr || rule.nameAr } : {})
  };
};

export default function SpecialtiesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [specialtyCode, setSpecialtyCode] = useState("");
  const [clinicAssignmentTemplateId, setClinicAssignmentTemplateId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTemplate, setNewTemplate] = useState({ title: "", titleAr: "", isActive: false });
  const [clonePayload, setClonePayload] = useState({ title: "", titleAr: "", isActive: false });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState({ title: "", titleAr: "", isActive: false });
  const [newField, setNewField] = useState({
    key: "",
    label: "",
    labelAr: "",
    section: "",
    sectionAr: "",
    fieldType: "TEXT" as (typeof fieldTypes)[number],
    isRequired: false
  });
  const [newRule, setNewRule] = useState<RuleFormState>(emptyRule);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<Partial<SpecialtyTemplateField>>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState({ value: "", label: "", labelAr: "" });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<RuleFormState>(emptyRule);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<SpecialtyTemplate | null>(null);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<SpecialtyTemplateField | null>(null);
  const [dragFieldId, setDragFieldId] = useState<string | null>(null);
  const [dragRuleId, setDragRuleId] = useState<string | null>(null);
  const [dragOption, setDragOption] = useState<{ fieldId: string; optionId: string } | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["specialties", "catalog", "admin"],
    queryFn: specialtyService.listCatalog
  });
  const clinicsQuery = useQuery({
    queryKey: ["clinics", "specialties-admin"],
    queryFn: clinicService.list
  });

  useEffect(() => {
    if (!specialtyCode && catalogQuery.data?.length) {
      setSpecialtyCode(catalogQuery.data[0].code);
    }
  }, [specialtyCode, catalogQuery.data]);

  const templatesQuery = useQuery({
    queryKey: ["specialties", "admin", "templates", specialtyCode],
    queryFn: () => specialtyService.adminListTemplatesBySpecialty(specialtyCode),
    enabled: Boolean(specialtyCode)
  });

  const templates = useMemo(() => templatesQuery.data?.templates ?? [], [templatesQuery.data?.templates]);
  const selectedCatalogSpecialty = useMemo(
    () => (catalogQuery.data ?? []).find((item) => item.code === specialtyCode) ?? null,
    [catalogQuery.data, specialtyCode]
  );
  const clinicSpecialtyFilterQueries = useQueries({
    queries: (clinicsQuery.data ?? []).map((clinic) => ({
      queryKey: ["specialties", "clinic", "admin", "filter", clinic.id],
      queryFn: () => specialtyService.listMyClinicSpecialties(clinic.id),
      enabled: Boolean(selectedCatalogSpecialty),
      staleTime: 60_000
    }))
  });
  const filteredClinics = useMemo(() => {
    const allClinics = clinicsQuery.data ?? [];
    if (!selectedCatalogSpecialty) return allClinics;

    return allClinics.filter((clinic, index) => {
      const clinicSpecialties = clinicSpecialtyFilterQueries[index]?.data ?? [];
      return clinicSpecialties.some((item) => item.specialtyId === selectedCatalogSpecialty.id);
    });
  }, [clinicsQuery.data, clinicSpecialtyFilterQueries, selectedCatalogSpecialty]);
  const isFilteringClinicsBySpecialty =
    Boolean(selectedCatalogSpecialty) &&
    (clinicsQuery.isLoading ||
      clinicSpecialtyFilterQueries.some((query) => query.isLoading || query.isPending));

  useEffect(() => {
    if (isFilteringClinicsBySpecialty) return;
    if (!filteredClinics.length) {
      setSelectedClinicId("");
      return;
    }

    const selectedClinicStillValid = filteredClinics.some((clinic) => clinic.id === selectedClinicId);
    if (!selectedClinicStillValid) {
      setSelectedClinicId(filteredClinics[0].id);
    }
  }, [filteredClinics, isFilteringClinicsBySpecialty, selectedClinicId]);

  const clinicSpecialtiesQuery = useQuery({
    queryKey: ["specialties", "clinic", "admin", selectedClinicId],
    queryFn: () => specialtyService.listMyClinicSpecialties(selectedClinicId),
    enabled: Boolean(selectedClinicId)
  });
  const selectedClinicSpecialty = useMemo(
    () =>
      (clinicSpecialtiesQuery.data ?? []).find((item) =>
        selectedCatalogSpecialty ? item.specialtyId === selectedCatalogSpecialty.id : false
      ) ?? null,
    [clinicSpecialtiesQuery.data, selectedCatalogSpecialty]
  );

  useEffect(() => {
    setClinicAssignmentTemplateId(selectedClinicSpecialty?.templateId ?? "");
  }, [selectedClinicSpecialty?.templateId]);

  useEffect(() => {
    if (!templates.length) {
      setSelectedTemplateId("");
      return;
    }
    const exists = templates.some((template) => template.id === selectedTemplateId);
    if (!exists) setSelectedTemplateId(templates[0].id);
  }, [templates, selectedTemplateId]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const rulesQuery = useQuery({
    queryKey: ["specialties", "admin", "rules", selectedTemplateId],
    queryFn: () => specialtyService.adminListRules(selectedTemplateId),
    enabled: Boolean(selectedTemplateId)
  });

  const rules = rulesQuery.data ?? [];
  const groupedFields = useMemo(() => {
    if (!selectedTemplate) return [];

    const groups = new Map<string, { id: string; label: string; fields: SpecialtyTemplateField[] }>();
    selectedTemplate.fields.forEach((field) => {
      const label = (field.sectionAr || field.section || "بدون قسم").trim() || "بدون قسم";
      const id = label.toLowerCase();
      const existing = groups.get(id);
      if (existing) {
        existing.fields.push(field);
        return;
      }
      groups.set(id, { id, label, fields: [field] });
    });

    return Array.from(groups.values());
  }, [selectedTemplate]);

  const refreshData = async () => {
    await queryClient.invalidateQueries({ queryKey: ["specialties", "admin", "templates", specialtyCode] });
    if (selectedTemplateId) {
      await queryClient.invalidateQueries({ queryKey: ["specialties", "admin", "rules", selectedTemplateId] });
    }
  };
  const refreshClinicSpecialtyAssignments = async () => {
    if (!selectedClinicId) return;
    await queryClient.invalidateQueries({ queryKey: ["specialties", "clinic", "admin", selectedClinicId] });
  };

  const createTemplateMutation = useMutation({
    mutationFn: () => specialtyService.adminCreateTemplate(specialtyCode, newTemplate),
    onSuccess: async () => {
      toast.success("تم إنشاء القالب");
      setNewTemplate({ title: "", titleAr: "", isActive: false });
      await refreshData();
    },
    onError: () => toast.error("تعذر إنشاء القالب")
  });

  const cloneTemplateMutation = useMutation({
    mutationFn: () => specialtyService.adminCloneTemplate(selectedTemplateId, clonePayload),
    onSuccess: async () => {
      toast.success("تم نسخ القالب");
      setClonePayload({ title: "", titleAr: "", isActive: false });
      await refreshData();
    },
    onError: () => toast.error("تعذر نسخ القالب")
  });

  const activateTemplateMutation = useMutation({
    mutationFn: (templateId: string) => specialtyService.adminUpdateTemplate(templateId, { isActive: true }),
    onSuccess: async () => {
      toast.success("تم تفعيل القالب");
      await refreshData();
    },
    onError: () => toast.error("تعذر تفعيل القالب")
  });
  const assignClinicTemplateMutation = useMutation({
    mutationFn: () => {
      if (!selectedClinicSpecialty) throw new Error("No clinic specialty mapping found");
      if (!clinicAssignmentTemplateId) throw new Error("No template selected");
      return specialtyService.adminAssignClinicSpecialtyTemplate(selectedClinicSpecialty.id, clinicAssignmentTemplateId);
    },
    onSuccess: async () => {
      toast.success("تم تعيين القالب للعيادة");
      await refreshClinicSpecialtyAssignments();
    },
    onError: () => toast.error("تعذر تعيين قالب للعيادة")
  });
  const updateTemplateMutation = useMutation({
    mutationFn: ({
      templateId,
      payload
    }: {
      templateId: string;
      payload: { title?: string; titleAr?: string; isActive?: boolean };
    }) => specialtyService.adminUpdateTemplate(templateId, payload),
    onSuccess: async () => {
      toast.success("تم تحديث القالب");
      setEditingTemplateId(null);
      setEditingTemplate({ title: "", titleAr: "", isActive: false });
      await refreshData();
    },
    onError: () => toast.error("تعذر تحديث القالب")
  });
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => specialtyService.adminDeleteTemplate(templateId),
    onSuccess: async () => {
      if (deleteTemplateTarget?.id === selectedTemplateId) {
        setSelectedTemplateId("");
      }
      toast.success("تم حذف القالب");
      setDeleteTemplateTarget(null);
      await refreshData();
    },
    onError: (error: unknown) => {
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "")
          : "";
      if (errorMessage.includes("Cannot delete active template")) {
        toast.error("لا يمكن حذف القالب النشط. فعّل قالبًا آخر أولًا.");
        return;
      }
      if (errorMessage.includes("linked to existing patient assessments")) {
        toast.error("لا يمكن حذف قالب مرتبط بتقييمات مرضى محفوظة.");
        return;
      }
      toast.error(errorMessage || "تعذر حذف القالب");
    }
  });

  const createFieldMutation = useMutation({
    mutationFn: () => specialtyService.adminCreateField(selectedTemplateId, newField),
    onSuccess: async () => {
      toast.success("تم إنشاء الحقل");
      setNewField({
        key: "",
        label: "",
        labelAr: "",
        section: "",
        sectionAr: "",
        fieldType: "TEXT",
        isRequired: false
      });
      await refreshData();
    },
    onError: () => toast.error("تعذر إنشاء الحقل")
  });

  const updateFieldMutation = useMutation({
    mutationFn: (fieldId: string) =>
      specialtyService.adminUpdateField(fieldId, {
        key: String(editingField.key ?? ""),
        label: String(editingField.label ?? ""),
        labelAr: String(editingField.labelAr ?? ""),
        section: String(editingField.section ?? ""),
        sectionAr: String(editingField.sectionAr ?? ""),
        fieldType: (editingField.fieldType ?? "TEXT") as SpecialtyTemplateField["fieldType"],
        isRequired: Boolean(editingField.isRequired)
      }),
    onSuccess: async () => {
      toast.success("تم تحديث الحقل");
      setEditingFieldId(null);
      setEditingField({});
      await refreshData();
    },
    onError: () => toast.error("تعذر تحديث الحقل")
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId: string) => specialtyService.adminDeleteField(fieldId),
    onSuccess: async () => {
      toast.success("تم حذف الحقل");
      setDeleteFieldTarget(null);
      await refreshData();
    },
    onError: () => toast.error("تعذر حذف الحقل")
  });

  const createOptionMutation = useMutation({
    mutationFn: ({
      fieldId,
      payload
    }: {
      fieldId: string;
      payload: { value: string; label: string; labelAr: string };
    }) => specialtyService.adminCreateOption(fieldId, payload),
    onSuccess: async () => {
      toast.success("تمت إضافة الخيار");
      await refreshData();
    },
    onError: () => toast.error("تعذر إضافة الخيار")
  });

  const updateOptionMutation = useMutation({
    mutationFn: (optionId: string) => specialtyService.adminUpdateOption(optionId, editingOption),
    onSuccess: async () => {
      toast.success("تم تحديث الخيار");
      setEditingOptionId(null);
      setEditingOption({ value: "", label: "", labelAr: "" });
      await refreshData();
    },
    onError: () => toast.error("تعذر تحديث الخيار")
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (optionId: string) => specialtyService.adminDeleteOption(optionId),
    onSuccess: async () => {
      toast.success("تم حذف الخيار");
      await refreshData();
    },
    onError: () => toast.error("تعذر حذف الخيار")
  });

  const createRuleMutation = useMutation({
    mutationFn: () =>
      specialtyService.adminCreateRule(selectedTemplateId, {
        key: newRule.key,
        name: newRule.name,
        nameAr: newRule.nameAr,
        type: newRule.type,
        expression: buildExpression(newRule),
        severity: newRule.type === "ALERT" ? newRule.severity : undefined
      }),
    onSuccess: async () => {
      toast.success("تم إنشاء القاعدة");
      setNewRule(emptyRule);
      await refreshData();
    },
    onError: () => toast.error("تعذر إنشاء القاعدة")
  });

  const updateRuleMutation = useMutation({
    mutationFn: (ruleId: string) =>
      specialtyService.adminUpdateRule(ruleId, {
        key: editingRule.key,
        name: editingRule.name,
        nameAr: editingRule.nameAr,
        type: editingRule.type,
        expression: buildExpression(editingRule),
        severity: editingRule.type === "ALERT" ? editingRule.severity : null
      }),
    onSuccess: async () => {
      toast.success("تم تحديث القاعدة");
      setEditingRuleId(null);
      setEditingRule(emptyRule);
      await refreshData();
    },
    onError: () => toast.error("تعذر تحديث القاعدة")
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => specialtyService.adminDeleteRule(ruleId),
    onSuccess: async () => {
      toast.success("تم حذف القاعدة");
      await refreshData();
    },
    onError: () => toast.error("تعذر حذف القاعدة")
  });

  const handleCreateOption = (event: FormEvent<HTMLFormElement>, fieldId: string) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = String(formData.get("value") ?? "").trim();
    const label = String(formData.get("label") ?? "").trim();
    const labelAr = String(formData.get("labelAr") ?? "").trim();
    if (!value || !label || !labelAr) {
      toast.error("أدخل قيمة الخيار والاسم بالإنجليزية والعربية");
      return;
    }
    createOptionMutation.mutate({ fieldId, payload: { value, label, labelAr } });
    event.currentTarget.reset();
  };

  const startEditRule = (rule: SpecialtyTemplateRule) => {
    const expression = rule.expression as {
      all?: Array<{ field?: string; op?: RuleCondition["op"]; value?: unknown }>;
      any?: Array<{ field?: string; op?: RuleCondition["op"]; value?: unknown }>;
      message?: string;
      messageAr?: string;
    };
    const logic: "all" | "any" = Array.isArray(expression.any) ? "any" : "all";
    const sourceConditions = (logic === "any" ? expression.any : expression.all) ?? [];
    const conditions: RuleCondition[] = sourceConditions.length
      ? sourceConditions.map((condition) => ({
          field: String(condition.field ?? ""),
          op: (condition.op ?? "eq") as RuleCondition["op"],
          value: condition.value !== undefined ? String(condition.value) : ""
        }))
      : [{ field: "", op: "eq", value: "" }];

    setEditingRuleId(rule.id);
    setEditingRule({
      key: rule.key,
      name: rule.name,
      nameAr: rule.nameAr,
      type: rule.type,
      logic,
      conditions,
      severity: rule.severity ?? "MEDIUM",
      message: expression.message ?? "",
      messageAr: expression.messageAr ?? ""
    });
  };

  const reorderFieldsMutation = useMutation({
    mutationFn: async (orderedFieldIds: string[]) => {
      if (!selectedTemplate) return;
      await specialtyService.adminReorderFields(selectedTemplate.id, orderedFieldIds);
    },
    onSuccess: async () => {
      await refreshData();
    },
    onError: () => toast.error("تعذر إعادة ترتيب الحقول")
  });

  const reorderRulesMutation = useMutation({
    mutationFn: async (orderedRuleIds: string[]) => {
      if (!selectedTemplate) return;
      await specialtyService.adminReorderRules(selectedTemplate.id, orderedRuleIds);
    },
    onSuccess: async () => {
      await refreshData();
    },
    onError: () => toast.error("تعذر إعادة ترتيب القواعد")
  });

  const reorderOptionsMutation = useMutation({
    mutationFn: async ({ fieldId, orderedOptionIds }: { fieldId: string; orderedOptionIds: string[] }) => {
      await specialtyService.adminReorderOptions(fieldId, orderedOptionIds);
    },
    onSuccess: async () => {
      await refreshData();
    },
    onError: () => toast.error("تعذر إعادة ترتيب الخيارات")
  });

  const updateRuleCondition = (
    index: number,
    key: keyof RuleCondition,
    value: string,
    editing = false
  ) => {
    if (editing) {
      setEditingRule((prev) => {
        const conditions = [...prev.conditions];
        conditions[index] = { ...conditions[index], [key]: value };
        return { ...prev, conditions };
      });
      return;
    }

    setNewRule((prev) => {
      const conditions = [...prev.conditions];
      conditions[index] = { ...conditions[index], [key]: value };
      return { ...prev, conditions };
    });
  };

  const addRuleCondition = (editing = false) => {
    if (editing) {
      setEditingRule((prev) => ({
        ...prev,
        conditions: [...prev.conditions, { field: "", op: "eq", value: "" }]
      }));
      return;
    }
    setNewRule((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: "", op: "eq", value: "" }]
    }));
  };

  const removeRuleCondition = (index: number, editing = false) => {
    if (editing) {
      setEditingRule((prev) => ({
        ...prev,
        conditions: prev.conditions.length > 1 ? prev.conditions.filter((_, idx) => idx !== index) : prev.conditions
      }));
      return;
    }
    setNewRule((prev) => ({
      ...prev,
      conditions: prev.conditions.length > 1 ? prev.conditions.filter((_, idx) => idx !== index) : prev.conditions
    }));
  };

  return (
    <RoleGate allowed={["SuperAdmin"]} fallback={<div className="card p-6 text-base text-slate-500">{t("common.notAllowed")}</div>}>
      <AppShell>
        <section className="space-y-4">
          <div className="card space-y-4 p-6">
            <h1 className="text-3xl font-semibold text-brand-navy">{t("nav.specialties")}</h1>
            <p className="text-base text-slate-600">إدارة القوالب الديناميكية والحقول والخيارات والقواعد لكل تخصص.</p>
            <div className="grid gap-3 md:grid-cols-[260px_260px_1fr]">
              <div>
                <label className="mb-1 block text-base font-medium text-slate-700">التخصص</label>
                <select value={specialtyCode} onChange={(event) => setSpecialtyCode(event.target.value)} className={`w-full ${dsInputLgClass}`}>
                  {(catalogQuery.data ?? []).map((item) => (
                    <option key={item.id} value={item.code}>
                      {item.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-base font-medium text-slate-700">العيادة</label>
                <select
                  value={selectedClinicId}
                  onChange={(event) => setSelectedClinicId(event.target.value)}
                  className={`w-full ${dsInputLgClass}`}
                  disabled={isFilteringClinicsBySpecialty || !filteredClinics.length}
                >
                  {filteredClinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
                {!isFilteringClinicsBySpecialty && !filteredClinics.length ? (
                  <p className="mt-1 text-sm text-amber-700">لا توجد عيادات مفعّل بها هذا التخصص.</p>
                ) : null}
              </div>
              <div className={dsPanelClass}>
                <p className="mb-2 text-base font-semibold text-slate-700">إنشاء قالب</p>
                <div className="grid gap-2 md:grid-cols-4">
                  <input value={newTemplate.title} onChange={(event) => setNewTemplate((prev) => ({ ...prev, title: event.target.value }))} className={dsInputLgClass} placeholder="اسم القالب (إنجليزي)" />
                  <input value={newTemplate.titleAr} onChange={(event) => setNewTemplate((prev) => ({ ...prev, titleAr: event.target.value }))} className={dsInputLgClass} placeholder="اسم القالب (عربي)" />
                  <label className="inline-flex items-center gap-2 text-base text-slate-700">
                    <input type="checkbox" checked={newTemplate.isActive} onChange={(event) => setNewTemplate((prev) => ({ ...prev, isActive: event.target.checked }))} />
                    تفعيل القالب
                  </label>
                  <RippleButton type="button" disabled={!specialtyCode || !newTemplate.title.trim() || !newTemplate.titleAr.trim() || createTemplateMutation.isPending} onClick={() => createTemplateMutation.mutate()}>
                    إضافة قالب
                  </RippleButton>
                </div>
              </div>
            </div>
            <div className={dsPanelClass}>
              <p className="mb-2 text-base font-semibold text-slate-700">تعيين قالب للعيادة حسب التخصص</p>
              {selectedClinicSpecialty ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    القالب المعيّن حاليًا:{" "}
                    <span className="font-semibold text-slate-800">
                      {selectedClinicSpecialty.template
                        ? `الإصدار ${selectedClinicSpecialty.template.version} - ${selectedClinicSpecialty.template.titleAr}`
                        : "غير معيّن"}
                    </span>
                  </p>
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <select
                      value={clinicAssignmentTemplateId}
                      onChange={(event) => setClinicAssignmentTemplateId(event.target.value)}
                      className={dsInputClass}
                    >
                      <option value="" disabled>
                        اختر قالبًا
                      </option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          الإصدار {template.version} - {template.titleAr}
                        </option>
                      ))}
                    </select>
                    <RippleButton
                      type="button"
                      className="h-10 text-sm"
                      disabled={!clinicAssignmentTemplateId || assignClinicTemplateMutation.isPending}
                      onClick={() => assignClinicTemplateMutation.mutate()}
                    >
                      {assignClinicTemplateMutation.isPending ? "جارٍ التعيين..." : "تعيين للعيادة"}
                    </RippleButton>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">هذا التخصص غير مفعّل للعيادة المختارة.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
            <section className="card p-5">
              <h2 className="mb-3 text-lg font-semibold text-slate-800">القوالب</h2>
              <div className="space-y-2">
                {templates.map((template) => (
                  <div key={template.id} className={`${dsCardClass} ${selectedTemplateId === template.id ? "border-orange-300 bg-orange-50/50" : ""}`}>
                    {editingTemplateId === template.id ? (
                      <div className="grid gap-2">
                        <input
                          value={editingTemplate.titleAr}
                          onChange={(event) => setEditingTemplate((prev) => ({ ...prev, titleAr: event.target.value }))}
                          className={dsInputClass}
                          placeholder="اسم القالب (عربي)"
                        />
                        <input
                          value={editingTemplate.title}
                          onChange={(event) => setEditingTemplate((prev) => ({ ...prev, title: event.target.value }))}
                          className={dsInputClass}
                          placeholder="اسم القالب (إنجليزي)"
                        />
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={editingTemplate.isActive}
                            onChange={(event) => setEditingTemplate((prev) => ({ ...prev, isActive: event.target.checked }))}
                          />
                          تفعيل القالب
                        </label>
                      </div>
                    ) : (
                      <button type="button" className="w-full text-left" onClick={() => setSelectedTemplateId(template.id)}>
                        <p className="text-base font-semibold text-slate-800">الإصدار {template.version} - {template.titleAr}</p>
                        <p className="text-sm text-slate-500">{template.title}</p>
                      </button>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${template.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{template.isActive ? "مفعل" : "غير مفعل"}</span>
                      <div className="flex items-center gap-2">
                        {editingTemplateId === template.id ? (
                          <>
                            <button
                              type="button"
                              className={premiumIconButtonClass}
                              onClick={() =>
                                updateTemplateMutation.mutate({
                                  templateId: template.id,
                                  payload: {
                                    title: editingTemplate.title.trim(),
                                    titleAr: editingTemplate.titleAr.trim(),
                                    isActive: editingTemplate.isActive
                                  }
                                })
                              }
                              disabled={!editingTemplate.title.trim() || !editingTemplate.titleAr.trim() || updateTemplateMutation.isPending}
                              aria-label="حفظ"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              className={premiumIconButtonClass}
                              onClick={() => {
                                setEditingTemplateId(null);
                                setEditingTemplate({ title: "", titleAr: "", isActive: false });
                              }}
                              disabled={updateTemplateMutation.isPending}
                              aria-label="إلغاء"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={premiumIconButtonClass}
                            onClick={() => {
                              setEditingTemplateId(template.id);
                              setEditingTemplate({
                                title: template.title,
                                titleAr: template.titleAr,
                                isActive: template.isActive
                              });
                            }}
                            aria-label="تعديل القالب"
                          >
                            <PencilLine size={16} />
                          </button>
                        )}
                        {!template.isActive && editingTemplateId !== template.id ? (
                          <button type="button" className={premiumIconButtonClass} onClick={() => activateTemplateMutation.mutate(template.id)} aria-label="تفعيل القالب">
                            <Sparkles size={16} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={premiumDeleteButtonClass}
                          onClick={() => {
                            if (template.isActive) {
                              toast.error("لا يمكن حذف القالب النشط. فعّل قالبًا آخر أولًا.");
                              return;
                            }
                            setDeleteTemplateTarget(template);
                          }}
                          disabled={deleteTemplateMutation.isPending || updateTemplateMutation.isPending}
                          aria-label="حذف القالب"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!templates.length ? <p className="text-base text-slate-500">لا توجد قوالب بعد</p> : null}
              </div>
              {selectedTemplate ? (
                <div className={`mt-3 ${dsPanelClass}`}>
                  <p className="mb-2 text-sm font-medium text-slate-700">نسخ القالب إلى إصدار جديد</p>
                  <div className="grid gap-2">
                    <input value={clonePayload.title} onChange={(event) => setClonePayload((prev) => ({ ...prev, title: event.target.value }))} className={dsInputClass} placeholder="اسم جديد (إنجليزي)" />
                    <input value={clonePayload.titleAr} onChange={(event) => setClonePayload((prev) => ({ ...prev, titleAr: event.target.value }))} className={dsInputClass} placeholder="اسم جديد (عربي)" />
                    <label className="inline-flex items-center gap-1 text-sm text-slate-700">
                      <input type="checkbox" checked={clonePayload.isActive} onChange={(event) => setClonePayload((prev) => ({ ...prev, isActive: event.target.checked }))} />
                      تفعيل النسخة الجديدة
                    </label>
                    <RippleButton type="button" className="h-10 text-sm" onClick={() => cloneTemplateMutation.mutate()}>
                      نسخ القالب
                    </RippleButton>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="card space-y-4 p-4">
              <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-800">حقول القالب</h2>
              </div>
              {selectedTemplate ? (
                <>
                  <div className={dsPanelClass}>
                    <p className="mb-2 text-base font-medium text-slate-700">إضافة حقل</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <input value={newField.key} onChange={(e) => setNewField((p) => ({ ...p, key: e.target.value }))} className={dsInputClass} placeholder="مفتاح الحقل (مثل: moasher_kotla_aljism)" />
                      <input value={newField.label} onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))} className={dsInputClass} placeholder="الاسم (إنجليزي)" />
                      <input value={newField.labelAr} onChange={(e) => setNewField((p) => ({ ...p, labelAr: e.target.value }))} className={dsInputClass} placeholder="الاسم (عربي)" />
                      <input value={newField.section} onChange={(e) => setNewField((p) => ({ ...p, section: e.target.value }))} className={dsInputClass} placeholder="القسم (إنجليزي)" />
                      <input value={newField.sectionAr} onChange={(e) => setNewField((p) => ({ ...p, sectionAr: e.target.value }))} className={dsInputClass} placeholder="القسم (عربي)" />
                      <select value={newField.fieldType} onChange={(e) => setNewField((p) => ({ ...p, fieldType: e.target.value as (typeof fieldTypes)[number] }))} className={dsInputClass}>
                        {fieldTypes.map((fieldType) => <option key={fieldType} value={fieldType}>{fieldTypeLabels[fieldType]}</option>)}
                      </select>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={newField.isRequired} onChange={(e) => setNewField((p) => ({ ...p, isRequired: e.target.checked }))} />
                        مطلوب
                      </label>
                      <div className="md:col-span-2">
                        <RippleButton type="button" disabled={!newField.key.trim() || !newField.label.trim() || !newField.labelAr.trim() || !newField.section.trim() || !newField.sectionAr.trim() || createFieldMutation.isPending} onClick={() => createFieldMutation.mutate()}>
                          إضافة الحقل
                        </RippleButton>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {groupedFields.map((group, groupIndex) => (
                      <div key={group.id} className="space-y-3">
                        <div className={`rounded-xl border px-3 py-2 ${sectionColorClasses[groupIndex % sectionColorClasses.length]}`}>
                          <p className="text-sm font-semibold">{group.label}</p>
                        </div>
                        <div className="space-y-3">
                          {group.fields.map((field) => (
                            <div
                              key={field.id}
                              className="rounded-xl border border-slate-200 bg-white p-3"
                              draggable
                              onDragStart={() => setDragFieldId(field.id)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => {
                                if (reorderFieldsMutation.isPending) return;
                                if (!dragFieldId || dragFieldId === field.id) return;
                                const ordered = [...selectedTemplate.fields];
                                const fromIndex = ordered.findIndex((item) => item.id === dragFieldId);
                                const toIndex = ordered.findIndex((item) => item.id === field.id);
                                if (fromIndex < 0 || toIndex < 0) return;
                                const [moved] = ordered.splice(fromIndex, 1);
                                ordered.splice(toIndex, 0, moved);
                                reorderFieldsMutation.mutate(ordered.map((item) => item.id));
                                setDragFieldId(null);
                              }}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  {editingFieldId === field.id ? (
                                    <div className="grid gap-2 md:grid-cols-2">
                                      <input value={String(editingField.key ?? "")} onChange={(e) => setEditingField((p) => ({ ...p, key: e.target.value }))} className={dsInputCompactClass} />
                                      <input value={String(editingField.label ?? "")} onChange={(e) => setEditingField((p) => ({ ...p, label: e.target.value }))} className={dsInputCompactClass} />
                                      <input value={String(editingField.labelAr ?? "")} onChange={(e) => setEditingField((p) => ({ ...p, labelAr: e.target.value }))} className={dsInputCompactClass} />
                                      <input value={String(editingField.section ?? "")} onChange={(e) => setEditingField((p) => ({ ...p, section: e.target.value }))} className={dsInputCompactClass} />
                                      <input value={String(editingField.sectionAr ?? "")} onChange={(e) => setEditingField((p) => ({ ...p, sectionAr: e.target.value }))} className={dsInputCompactClass} />
                                      <select value={String(editingField.fieldType ?? field.fieldType)} onChange={(e) => setEditingField((p) => ({ ...p, fieldType: e.target.value as SpecialtyTemplateField["fieldType"] }))} className={dsInputCompactClass}>
                                        {fieldTypes.map((type) => <option key={type} value={type}>{fieldTypeLabels[type]}</option>)}
                                      </select>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-base font-semibold text-slate-800">{field.labelAr}</p>
                                      <p className="text-sm text-slate-500">{field.key} - {fieldTypeLabels[field.fieldType]} - {field.sectionAr}</p>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {editingFieldId === field.id ? (
                                    <>
                                      <button type="button" className={dsTextActionSuccessClass} onClick={() => updateFieldMutation.mutate(field.id)}>حفظ</button>
                                      <button type="button" className={dsTextActionClass} onClick={() => setEditingFieldId(null)}>إلغاء</button>
                                    </>
                                  ) : (
                                    <button type="button" className={premiumIconButtonClass} onClick={() => { setEditingFieldId(field.id); setEditingField(field); }} aria-label="تعديل الحقل">
                                      <PencilLine size={16} />
                                    </button>
                                  )}
                                  <button type="button" className={premiumDeleteButtonClass} onClick={() => setDeleteFieldTarget(field)} aria-label="حذف الحقل">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>

                              {(field.fieldType === "DROPDOWN" || field.fieldType === "MULTI_SELECT") ? (
                                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                  <p className="mb-2 text-sm font-semibold text-slate-700">الخيارات</p>
                                  <div className="mb-3 flex flex-wrap gap-2">
                                    {field.options.map((option) => (
                                      <span
                                        key={option.id}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                                        draggable
                                        onDragStart={() => setDragOption({ fieldId: field.id, optionId: option.id })}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => {
                                          if (reorderOptionsMutation.isPending) return;
                                          if (!dragOption || dragOption.fieldId !== field.id || dragOption.optionId === option.id) return;
                                          const ordered = [...field.options];
                                          const fromIndex = ordered.findIndex((item) => item.id === dragOption.optionId);
                                          const toIndex = ordered.findIndex((item) => item.id === option.id);
                                          if (fromIndex < 0 || toIndex < 0) return;
                                          const [moved] = ordered.splice(fromIndex, 1);
                                          ordered.splice(toIndex, 0, moved);
                                          reorderOptionsMutation.mutate({
                                            fieldId: field.id,
                                            orderedOptionIds: ordered.map((item) => item.id)
                                          });
                                          setDragOption(null);
                                        }}
                                      >
                                        {editingOptionId === option.id ? (
                                          <>
                                            <input value={editingOption.value} onChange={(e) => setEditingOption((p) => ({ ...p, value: e.target.value }))} className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-xs" />
                                            <input value={editingOption.label} onChange={(e) => setEditingOption((p) => ({ ...p, label: e.target.value }))} className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-xs" />
                                            <input value={editingOption.labelAr} onChange={(e) => setEditingOption((p) => ({ ...p, labelAr: e.target.value }))} className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-xs" />
                                            <button type="button" className={dsTextActionSuccessClass} onClick={() => updateOptionMutation.mutate(option.id)}>حفظ</button>
                                            <button type="button" className={dsTextActionClass} onClick={() => setEditingOptionId(null)}>إلغاء</button>
                                          </>
                                        ) : (
                                          <>
                                            {option.value} ({option.labelAr})
                                            <button type="button" className={premiumIconButtonClass} onClick={() => { setEditingOptionId(option.id); setEditingOption({ value: option.value, label: option.label, labelAr: option.labelAr }); }} aria-label="تعديل الخيار">
                                              <PencilLine size={14} />
                                            </button>
                                          </>
                                        )}
                                        <button type="button" className={premiumDeleteButtonClass} onClick={() => deleteOptionMutation.mutate(option.id)} aria-label="حذف الخيار">
                                          <Trash2 size={14} />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                  <form className="grid gap-2 md:grid-cols-4" onSubmit={(event) => handleCreateOption(event, field.id)}>
                                    <input name="value" className={dsInputClass} placeholder="القيمة" />
                                    <input name="label" className={dsInputClass} placeholder="الاسم (إنجليزي)" />
                                    <input name="labelAr" className={dsInputClass} placeholder="الاسم (عربي)" />
                                    <RippleButton type="submit" className="h-10 text-sm">إضافة خيار</RippleButton>
                                  </form>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!selectedTemplate.fields.length ? <p className="text-sm text-slate-500">لا توجد حقول بعد.</p> : null}
                  </div>

                  <div className={dsPanelClass}>
                    <p className="mb-2 text-base font-medium text-slate-700">منشئ القواعد</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <input value={newRule.key} onChange={(e) => setNewRule((p) => ({ ...p, key: e.target.value }))} className={dsInputClass} placeholder="مفتاح القاعدة" />
                      <input value={newRule.name} onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))} className={dsInputClass} placeholder="اسم القاعدة (إنجليزي)" />
                      <input value={newRule.nameAr} onChange={(e) => setNewRule((p) => ({ ...p, nameAr: e.target.value }))} className={dsInputClass} placeholder="اسم القاعدة (عربي)" />
                      <select value={newRule.type} onChange={(e) => setNewRule((p) => ({ ...p, type: e.target.value as RuleFormState["type"] }))} className={dsInputClass}>
                        {ruleTypes.map((type) => <option key={type} value={type}>{ruleTypeLabels[type]}</option>)}
                      </select>
                      <select value={newRule.logic} onChange={(e) => setNewRule((p) => ({ ...p, logic: e.target.value as RuleFormState["logic"] }))} className={dsInputClass}>
                        <option value="all">و (الكل)</option>
                        <option value="any">أو (أي شرط)</option>
                      </select>
                      <div className="md:col-span-3 rounded-xl border border-slate-200 bg-white p-2">
                        <p className="mb-2 text-xs font-medium text-slate-600">الشروط</p>
                        <div className="space-y-2">
                          {newRule.conditions.map((condition, index) => (
                            <div key={`new-condition-${index}`} className="grid gap-2 md:grid-cols-[1.3fr_0.8fr_1fr_auto]">
                              <input
                                value={condition.field}
                                onChange={(e) => updateRuleCondition(index, "field", e.target.value)}
                                className={dsInputCompactClass}
                                placeholder="مفتاح الحقل"
                              />
                              <select
                                value={condition.op}
                                onChange={(e) => updateRuleCondition(index, "op", e.target.value)}
                                className={dsInputCompactClass}
                              >
                                {operators.map((op) => (
                                  <option key={op} value={op}>
                                    {operatorLabels[op]}
                                  </option>
                                ))}
                              </select>
                              <input
                                value={condition.value}
                                onChange={(e) => updateRuleCondition(index, "value", e.target.value)}
                                className={dsInputCompactClass}
                                placeholder="القيمة"
                              />
                              <button
                                type="button"
                                className="h-8 rounded border border-slate-200 px-2 text-sm text-rose-600"
                                onClick={() => removeRuleCondition(index)}
                              >
                                حذف
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="rounded border border-slate-200 px-2 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            onClick={() => addRuleCondition()}
                          >
                            + إضافة شرط
                          </button>
                        </div>
                      </div>
                      <input value={newRule.severity} onChange={(e) => setNewRule((p) => ({ ...p, severity: e.target.value }))} className={dsInputClass} placeholder="درجة الأهمية" />
                      <input value={newRule.message} onChange={(e) => setNewRule((p) => ({ ...p, message: e.target.value }))} className={dsInputClass} placeholder="رسالة التنبيه (إنجليزي)" />
                      <input value={newRule.messageAr} onChange={(e) => setNewRule((p) => ({ ...p, messageAr: e.target.value }))} className={dsInputClass} placeholder="رسالة التنبيه (عربي)" />
                      <RippleButton type="button" className="h-10 text-sm" onClick={() => createRuleMutation.mutate()}>إضافة قاعدة</RippleButton>
                    </div>

                    <div className="mt-3 space-y-2">
                      {rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="rounded-lg border border-slate-200 bg-white p-2"
                          draggable
                          onDragStart={() => setDragRuleId(rule.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (reorderRulesMutation.isPending) return;
                            if (!dragRuleId || dragRuleId === rule.id) return;
                            const ordered = [...rules];
                            const fromIndex = ordered.findIndex((item) => item.id === dragRuleId);
                            const toIndex = ordered.findIndex((item) => item.id === rule.id);
                            if (fromIndex < 0 || toIndex < 0) return;
                            const [moved] = ordered.splice(fromIndex, 1);
                            ordered.splice(toIndex, 0, moved);
                            reorderRulesMutation.mutate(ordered.map((item) => item.id));
                            setDragRuleId(null);
                          }}
                        >
                          {editingRuleId === rule.id ? (
                            <div className="grid gap-2 md:grid-cols-3">
                              <input value={editingRule.key} onChange={(e) => setEditingRule((p) => ({ ...p, key: e.target.value }))} className={dsInputCompactClass} />
                              <input value={editingRule.name} onChange={(e) => setEditingRule((p) => ({ ...p, name: e.target.value }))} className={dsInputCompactClass} />
                              <input value={editingRule.nameAr} onChange={(e) => setEditingRule((p) => ({ ...p, nameAr: e.target.value }))} className={dsInputCompactClass} />
                              <select value={editingRule.type} onChange={(e) => setEditingRule((p) => ({ ...p, type: e.target.value as RuleFormState["type"] }))} className={dsInputCompactClass}>
                                {ruleTypes.map((type) => <option key={type} value={type}>{ruleTypeLabels[type]}</option>)}
                              </select>
                              <select value={editingRule.logic} onChange={(e) => setEditingRule((p) => ({ ...p, logic: e.target.value as RuleFormState["logic"] }))} className={dsInputCompactClass}>
                                <option value="all">و (الكل)</option>
                                <option value="any">أو (أي شرط)</option>
                              </select>
                              <div className="md:col-span-3 rounded border border-slate-200 bg-white p-2">
                                <div className="space-y-2">
                                  {editingRule.conditions.map((condition, index) => (
                                    <div key={`edit-condition-${index}`} className="grid gap-2 md:grid-cols-[1.3fr_0.8fr_1fr_auto]">
                                      <input
                                        value={condition.field}
                                        onChange={(e) => updateRuleCondition(index, "field", e.target.value, true)}
                                        className={dsInputCompactClass}
                                      />
                                      <select
                                        value={condition.op}
                                        onChange={(e) => updateRuleCondition(index, "op", e.target.value, true)}
                                        className={dsInputCompactClass}
                                      >
                                        {operators.map((op) => (
                                          <option key={op} value={op}>
                                            {operatorLabels[op]}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        value={condition.value}
                                        onChange={(e) => updateRuleCondition(index, "value", e.target.value, true)}
                                        className={dsInputCompactClass}
                                      />
                                      <button
                                        type="button"
                                        className="h-8 rounded border border-slate-200 px-2 text-xs text-rose-600"
                                        onClick={() => removeRuleCondition(index, true)}
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className="rounded border border-slate-200 px-2 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                    onClick={() => addRuleCondition(true)}
                                  >
                                    + إضافة شرط
                                  </button>
                                </div>
                              </div>
                              <input value={editingRule.severity} onChange={(e) => setEditingRule((p) => ({ ...p, severity: e.target.value }))} className={dsInputCompactClass} />
                              <input value={editingRule.message} onChange={(e) => setEditingRule((p) => ({ ...p, message: e.target.value }))} className={dsInputCompactClass} />
                              <input value={editingRule.messageAr} onChange={(e) => setEditingRule((p) => ({ ...p, messageAr: e.target.value }))} className={dsInputCompactClass} />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className={dsTextActionSuccessClass}
                                  onClick={() => updateRuleMutation.mutate(rule.id)}
                                >
                                  حفظ
                                </button>
                                <button type="button" className={dsTextActionClass} onClick={() => setEditingRuleId(null)}>إلغاء</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-base font-semibold text-slate-800">{rule.nameAr}</p>
                                <p className="text-sm text-slate-500">{rule.key} - {ruleTypeLabels[rule.type]}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className={premiumIconButtonClass}
                                  onClick={() => startEditRule(rule)}
                                  aria-label="تعديل القاعدة"
                                >
                                  <PencilLine size={16} />
                                </button>
                                <button type="button" className={premiumDeleteButtonClass} onClick={() => deleteRuleMutation.mutate(rule.id)} aria-label="حذف القاعدة">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {!rules.length ? <p className="text-base text-slate-500">لا توجد قواعد بعد.</p> : null}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-base text-slate-500">اختر قالبًا أولًا.</p>
              )}
            </section>
          </div>
        </section>
        {deleteTemplateTarget ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="إغلاق نافذة تأكيد حذف القالب"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setDeleteTemplateTarget(null)}
              disabled={deleteTemplateMutation.isPending}
            />
            <section className="relative w-full max-w-lg rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-orange-50 to-white p-5 shadow-premium">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">تأكيد حذف القالب</p>
                  <p className="text-sm text-slate-600">
                    أنت على وشك حذف القالب <span className="font-semibold text-slate-800">الإصدار {deleteTemplateTarget.version} - {deleteTemplateTarget.titleAr || deleteTemplateTarget.title}</span>.
                  </p>
                  <p className="text-xs text-rose-700">
                    ملاحظة: لا يمكن حذف القالب النشط أو القالب المرتبط بتقييمات مرضى محفوظة.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={dsModalCancelButtonClass}
                    onClick={() => setDeleteTemplateTarget(null)}
                    disabled={deleteTemplateMutation.isPending}
                  >
                    إلغاء
                  </button>
                  <RippleButton
                    type="button"
                    className="from-rose-600 to-red-500 hover:shadow-rose-500/30"
                    onClick={() => deleteTemplateMutation.mutate(deleteTemplateTarget.id)}
                    disabled={deleteTemplateMutation.isPending}
                  >
                    {deleteTemplateMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}
                  </RippleButton>
                </div>
              </div>
            </section>
          </div>
        ) : null}
        {deleteFieldTarget ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="إغلاق نافذة تأكيد حذف الحقل"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setDeleteFieldTarget(null)}
              disabled={deleteFieldMutation.isPending}
            />
            <section className="relative w-full max-w-lg rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-orange-50 to-white p-5 shadow-premium">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">تأكيد حذف الحقل</p>
                  <p className="text-sm text-slate-600">
                    أنت على وشك حذف الحقل <span className="font-semibold text-slate-800">{deleteFieldTarget.labelAr || deleteFieldTarget.label || deleteFieldTarget.key}</span>.
                  </p>
                  <p className="text-xs text-rose-700">لا يمكن التراجع عن هذا الإجراء.</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={dsModalCancelButtonClass}
                    onClick={() => setDeleteFieldTarget(null)}
                    disabled={deleteFieldMutation.isPending}
                  >
                    إلغاء
                  </button>
                  <RippleButton
                    type="button"
                    className="from-rose-600 to-red-500 hover:shadow-rose-500/30"
                    onClick={() => deleteFieldMutation.mutate(deleteFieldTarget.id)}
                    disabled={deleteFieldMutation.isPending}
                  >
                    {deleteFieldMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}
                  </RippleButton>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </AppShell>
    </RoleGate>
  );
}
