"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ClipboardList, Eye, FileStack, PencilLine, Plus, Sparkles, Trash2, X } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGate } from "@/components/auth/role-gate";
import { useI18n } from "@/components/providers/i18n-provider";
import { SpecialtyAssessmentForm } from "@/components/forms/specialty-assessment-form";
import { RippleButton } from "@/components/ui/ripple-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { clinicService } from "@/lib/clinic-service";
import { SpecialtyTemplate, SpecialtyTemplateField, SpecialtyTemplateRule, specialtyService } from "@/lib/specialty-service";

const fieldTypes = ["TEXT", "TEXT_AREA", "NUMBER", "YES_NO", "DATE", "DROPDOWN", "MULTI_SELECT", "AUTO", "GRID"] as const;
const ruleTypes = ["ALERT", "DIAGNOSIS", "COMPUTE"] as const;
const operators = ["eq", "neq", "gt", "gte", "lt", "lte", "includes"] as const;
const fieldTypeLabels: Record<SpecialtyTemplateField["fieldType"], string> = {
  TEXT: "نص",
  TEXT_AREA: "نص طويل",
  NUMBER: "رقم",
  YES_NO: "نعم / لا",
  DATE: "تاريخ",
  DROPDOWN: "قائمة منسدلة",
  MULTI_SELECT: "اختيار متعدد",
  AUTO: "تلقائي",
  GRID: "شبكة",
  EMPTY: "فارغ"
};
const gridCellTypeLabels: Record<GridCellFieldType, string> = {
  ...fieldTypeLabels,
  EMPTY: "فارغ"
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
const modalPanelVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: "easeOut", staggerChildren: 0.08 }
  }
};
const modalPanelItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
};

type RuleCondition = {
  field: string;
  op: (typeof operators)[number];
  value: string;
};

type RuleFormState = {
  name: string;
  nameAr: string;
  type: (typeof ruleTypes)[number];
  logic: "all" | "any";
  conditions: RuleCondition[];
  severity: string;
  message: string;
  messageAr: string;
};

type GridColumnDraft = {
  id: string;
  label: string;
  labelAr: string;
};

type GridRowDraft = {
  id: string;
  label: string;
  labelAr: string;
};

type PersistedGridColumn = {
  key: string;
  label: string;
  labelAr: string;
  order: number;
};

type PersistedGridRow = {
  key: string;
  label: string;
  labelAr: string;
  order: number;
};

type GridGroup = {
  id: string;
  name: string;
  nameAr: string;
  sectionId: string;
  fields: SpecialtyTemplateField[];
  columns: PersistedGridColumn[];
  rows: PersistedGridRow[];
};

type SectionRenderItem =
  | {
      itemType: "field";
      id: string;
      order: number;
      field: SpecialtyTemplateField;
    }
  | {
      itemType: "grid";
      id: string;
      order: number;
      group: GridGroup;
    };

type GridCellFieldType = "TEXT" | "TEXT_AREA" | "NUMBER" | "YES_NO" | "DATE" | "DROPDOWN" | "MULTI_SELECT" | "AUTO" | "EMPTY";
type GridCellOptionDraft = {
  id?: string;
  value: string;
  label: string;
  labelAr: string;
};
type GridCellConfig = {
  type: GridCellFieldType;
  label: string;
  labelAr: string;
  options: GridCellOptionDraft[];
};
const gridCellFieldTypes: GridCellFieldType[] = ["TEXT", "TEXT_AREA", "NUMBER", "YES_NO", "DATE", "DROPDOWN", "MULTI_SELECT", "AUTO", "EMPTY"];

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const sanitizeKeyBase = (value: string, fallback: string) => toSlug(value) || fallback;
const createClientId = () => {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const ensureUniqueKey = (base: string, usedKeys: Set<string>) => {
  const normalizedBase = sanitizeKeyBase(base, "item");
  let candidate = normalizedBase;
  let suffix = 2;
  while (usedKeys.has(candidate)) {
    candidate = `${normalizedBase}_${suffix}`;
    suffix += 1;
  }
  usedKeys.add(candidate);
  return candidate;
};

const getGridCellKey = (rowId: string, columnId: string) => `${rowId}:${columnId}`;

const readGridMeta = (field: SpecialtyTemplateField) => {
  const metadata = field.metadata as Record<string, unknown> | null | undefined;
  const grid = metadata?.grid as Record<string, unknown> | undefined;
  const gridId = typeof grid?.id === "string" ? grid.id.trim() : "";
  const rowKey = typeof metadata?.row === "string" ? metadata.row.trim() : "";
  const columnKey = typeof metadata?.columnKey === "string" ? metadata.columnKey.trim() : "";
  const columns = Array.isArray(grid?.columns)
    ? (grid.columns
        .map((column, index) => {
          if (!column || typeof column !== "object") return null;
          const item = column as Record<string, unknown>;
          const key = typeof item.key === "string" ? item.key.trim() : "";
          if (!key) return null;
          return {
            key,
            label: typeof item.label === "string" ? item.label : key,
            labelAr: typeof item.labelAr === "string" ? item.labelAr : key,
            order: typeof item.order === "number" ? item.order : index + 1
          } satisfies PersistedGridColumn;
        })
        .filter((item): item is PersistedGridColumn => Boolean(item))
        .sort((a, b) => a.order - b.order))
    : [];
  return { gridId, rowKey, columnKey, columns };
};

const splitCellLabel = (value: string, fallback: string) => {
  const source = value.trim() || fallback;
  const parts = source.split(" - ");
  return parts[0]?.trim() || source;
};

const emptyRule: RuleFormState = {
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

function SpecialtiesTemplatesPage({ mode = "templates" }: { mode?: "templates" | "rules" } = {}) {
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
    label: "",
    labelAr: "",
    sectionId: "",
    fieldType: "TEXT" as (typeof fieldTypes)[number],
    isRequired: false
  });
  const [createSectionDialogOpen, setCreateSectionDialogOpen] = useState(false);
  const [newSection, setNewSection] = useState({ name: "", nameAr: "" });
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState({ name: "", nameAr: "" });
  const [gridColumns, setGridColumns] = useState<GridColumnDraft[]>([{ id: "col-1", label: "", labelAr: "" }]);
  const [gridRows, setGridRows] = useState<GridRowDraft[]>([{ id: "row-1", label: "", labelAr: "" }]);
  const [gridCellConfigs, setGridCellConfigs] = useState<Record<string, GridCellConfig>>({});
  const [gridPreviewValues, setGridPreviewValues] = useState<Record<string, string>>({});
  const [gridEditTarget, setGridEditTarget] = useState<GridGroup | null>(null);
  const [gridDeleteTarget, setGridDeleteTarget] = useState<GridGroup | null>(null);
  const [gridEditColumns, setGridEditColumns] = useState<PersistedGridColumn[]>([]);
  const [gridEditRows, setGridEditRows] = useState<PersistedGridRow[]>([]);
  const [gridEditCellConfigs, setGridEditCellConfigs] = useState<Record<string, GridCellConfig>>({});
  const [activeGridCellKey, setActiveGridCellKey] = useState<string>("");
  const [gridOptionPopupCellKey, setGridOptionPopupCellKey] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<RuleFormState>(emptyRule);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<Partial<SpecialtyTemplateField>>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState({ value: "", label: "", labelAr: "" });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<RuleFormState>(emptyRule);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<SpecialtyTemplateRule | null>(null);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<SpecialtyTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<SpecialtyTemplate | null>(null);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<SpecialtyTemplateField | null>(null);
  const [sectionToDeleteId, setSectionToDeleteId] = useState<string | null>(null);
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
  const [addFieldSectionId, setAddFieldSectionId] = useState<string | null>(null);
  const [newRuleFieldId, setNewRuleFieldId] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<{ sectionId: string; itemType: SectionRenderItem["itemType"]; itemId: string } | null>(null);
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
  const selectedTemplateSections = useMemo(
    () => selectedTemplate?.sections ?? [],
    [selectedTemplate]
  );
  useEffect(() => {
    if (!selectedTemplateSections.length) {
      setNewField((prev) => ({ ...prev, sectionId: "" }));
      return;
    }
    const exists = selectedTemplateSections.some((section) => section.id === newField.sectionId);
    if (!exists) {
      setNewField((prev) => ({ ...prev, sectionId: selectedTemplateSections[0].id }));
    }
  }, [selectedTemplateSections, newField.sectionId]);
  useEffect(() => {
    setExpandedSectionIds((prev) =>
      prev.filter((id) => selectedTemplateSections.some((section) => section.id === id))
    );
    if (addFieldSectionId && !selectedTemplateSections.some((section) => section.id === addFieldSectionId)) {
      setAddFieldSectionId(null);
    }
  }, [selectedTemplateSections, addFieldSectionId]);

  const rulesQuery = useQuery({
    queryKey: ["specialties", "admin", "rules", selectedTemplateId],
    queryFn: () => specialtyService.adminListRules(selectedTemplateId),
    enabled: Boolean(selectedTemplateId)
  });

  const rules = useMemo(() => rulesQuery.data ?? [], [rulesQuery.data]);
  const fieldRulesByFieldId = useMemo(() => {
    const grouped = new Map<string, SpecialtyTemplateRule[]>();
    rules.forEach((rule) => {
      if (!rule.fieldId) return;
      const existing = grouped.get(rule.fieldId);
      if (existing) {
        existing.push(rule);
      } else {
        grouped.set(rule.fieldId, [rule]);
      }
    });
    return grouped;
  }, [rules]);
  const globalRules = useMemo(() => rules.filter((rule) => !rule.fieldId), [rules]);
  const sectionRows = useMemo(() => {
    if (!selectedTemplate) return [];
    const fieldsBySection = new Map<string, SpecialtyTemplateField[]>();
    selectedTemplate.fields.forEach((field) => {
      if (!field.sectionId) return;
      const existing = fieldsBySection.get(field.sectionId);
      if (existing) {
        existing.push(field);
        return;
      }
      fieldsBySection.set(field.sectionId, [field]);
    });
    return selectedTemplateSections.map((section) => ({
      id: section.id,
      name: section.name,
      nameAr: section.nameAr,
      label: (section.nameAr || section.name || "بدون قسم").trim() || "بدون قسم",
      fields: fieldsBySection.get(section.id) ?? []
    }));
  }, [selectedTemplate, selectedTemplateSections]);
  const gridGroupsBySection = useMemo(() => {
    const grouped = new Map<string, GridGroup[]>();
    sectionRows.forEach((section) => {
      const byGridId = new Map<string, SpecialtyTemplateField[]>();
      section.fields.forEach((field) => {
        const { gridId, rowKey, columnKey } = readGridMeta(field);
        if (!gridId || !rowKey || !columnKey) return;
        const existing = byGridId.get(gridId);
        if (existing) {
          existing.push(field);
        } else {
          byGridId.set(gridId, [field]);
        }
      });
      const groups: GridGroup[] = Array.from(byGridId.entries()).map(([id, fields], groupIndex) => {
        const firstMeta = readGridMeta(fields[0]);
        const columns = firstMeta.columns.length
          ? firstMeta.columns
          : Array.from(
              new Set(
                fields
                  .map((field) => readGridMeta(field).columnKey)
                  .filter(Boolean)
              )
            ).map((key, index) => ({ key, label: key, labelAr: key, order: index + 1 }));
        const rowMap = new Map<string, PersistedGridRow>();
        fields.forEach((field, index) => {
          const { rowKey, columnKey } = readGridMeta(field);
          if (!rowKey || rowMap.has(rowKey)) return;
          const column = columns.find((item) => item.key === columnKey);
          rowMap.set(rowKey, {
            key: rowKey,
            label: splitCellLabel(field.label, `Row ${index + 1}`),
            labelAr: splitCellLabel(field.labelAr, `صف ${index + 1}`),
            order: rowMap.size + 1
          });
          if (column) {
            rowMap.set(rowKey, {
              key: rowKey,
              label: splitCellLabel(field.label.replace(` - ${column.label}`, ""), `Row ${index + 1}`),
              labelAr: splitCellLabel(field.labelAr.replace(` - ${column.labelAr}`, ""), `صف ${index + 1}`),
              order: rowMap.size
            });
          }
        });
        return {
          id,
          name: `Grid ${groupIndex + 1}`,
          nameAr: `شبكة ${groupIndex + 1}`,
          sectionId: section.id,
          fields,
          columns,
          rows: Array.from(rowMap.values())
        };
      });
      grouped.set(section.id, groups);
    });
    return grouped;
  }, [sectionRows]);
  const sectionItemsById = useMemo(() => {
    const result = new Map<string, SectionRenderItem[]>();
    sectionRows.forEach((section) => {
      const gridGroups = gridGroupsBySection.get(section.id) ?? [];
      const gridFieldIds = new Set<string>();
      const items: SectionRenderItem[] = [];

      gridGroups.forEach((group) => {
        group.fields.forEach((field) => gridFieldIds.add(field.id));
        const groupOrder =
          group.fields.reduce((min, field) => Math.min(min, field.displayOrder), Number.POSITIVE_INFINITY) ||
          Number.POSITIVE_INFINITY;
        items.push({
          itemType: "grid",
          id: group.id,
          order: Number.isFinite(groupOrder) ? groupOrder : Number.MAX_SAFE_INTEGER,
          group
        });
      });

      section.fields.forEach((field) => {
        if (gridFieldIds.has(field.id)) return;
        items.push({
          itemType: "field",
          id: field.id,
          order: field.displayOrder,
          field
        });
      });

      result.set(
        section.id,
        items.sort((a, b) => (a.order === b.order ? a.id.localeCompare(b.id) : a.order - b.order))
      );
    });
    return result;
  }, [sectionRows, gridGroupsBySection]);
  const unassignedFields = useMemo(
    () => selectedTemplate?.fields.filter((field) => !field.sectionId) ?? [],
    [selectedTemplate]
  );
  const sectionToDelete = useMemo(
    () => selectedTemplateSections.find((section) => section.id === sectionToDeleteId) ?? null,
    [selectedTemplateSections, sectionToDeleteId]
  );
  const previewTemplateForRender = useMemo(() => {
    if (!previewTemplate) return null;
    const sectionOrderMap = new Map(
      (previewTemplate.sections ?? []).map((section, index) => [section.id, section.displayOrder ?? index + 1])
    );
    const orderedFields = [...previewTemplate.fields].sort((a, b) => {
      const aSectionOrder = a.sectionId ? (sectionOrderMap.get(a.sectionId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      const bSectionOrder = b.sectionId ? (sectionOrderMap.get(b.sectionId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      if (aSectionOrder !== bSectionOrder) return aSectionOrder - bSectionOrder;
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.id.localeCompare(b.id);
    });
    return {
      ...previewTemplate,
      fields: orderedFields
    };
  }, [previewTemplate]);

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
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Template is required");
      if (!newField.sectionId) throw new Error("Section is required");
      const usedFieldKeys = new Set((selectedTemplate?.fields ?? []).map((field) => field.key));
      const generatedBaseFieldKey = ensureUniqueKey(
        sanitizeKeyBase(newField.label, "field"),
        usedFieldKeys
      );
      if (newField.fieldType !== "GRID") {
        return specialtyService.adminCreateField(selectedTemplateId, {
          key: generatedBaseFieldKey,
          label: newField.label,
          labelAr: newField.labelAr,
          sectionId: newField.sectionId,
          fieldType: newField.fieldType,
          isRequired: newField.isRequired
        });
      }

      const usedColumnKeys = new Set<string>();
      const normalizedColumns = gridColumns
        .map((column, index) => ({
          id: column.id,
          key: ensureUniqueKey(
            sanitizeKeyBase(column.label, `col_${index + 1}`),
            usedColumnKeys
          ),
          label: column.label,
          labelAr: column.labelAr,
          order: index + 1
        }))
        .filter((column) => column.label.trim() && column.labelAr.trim());
      const usedRowKeys = new Set<string>();
      const normalizedRows = gridRows
        .map((row, index) => ({
          id: row.id,
          key: ensureUniqueKey(
            sanitizeKeyBase(row.label, `row_${index + 1}`),
            usedRowKeys
          ),
          label: row.label.trim() || `Row ${index + 1}`,
          labelAr: row.labelAr.trim() || `صف ${index + 1}`
        }));

      if (!normalizedColumns.length || !normalizedRows.length) {
        throw new Error("Grid rows and columns are required");
      }

      const gridId = `${generatedBaseFieldKey}_grid`;
      const createCalls = normalizedRows.flatMap((row) =>
        normalizedColumns.map((column) => {
          const cellDraftKey = getGridCellKey(row.id, column.id);
          const selectedCellType = gridCellConfigs[cellDraftKey]?.type ?? "TEXT";
          const cellType = (selectedCellType === "EMPTY" ? "TEXT" : selectedCellType) as SpecialtyTemplateField["fieldType"];
          const metadata: Record<string, unknown> = {
            row: row.key,
            columnKey: column.key,
            cellType: selectedCellType,
            cellLabel: gridCellConfigs[cellDraftKey]?.label?.trim() || `${row.label} - ${column.label}`,
            cellLabelAr: gridCellConfigs[cellDraftKey]?.labelAr?.trim() || `${row.labelAr} - ${column.labelAr}`,
            grid: {
              id: gridId,
              rowKey: row.key,
              columns: normalizedColumns.map((item) => ({
                key: item.key,
                label: item.label,
                labelAr: item.labelAr,
                order: item.order
              }))
            }
          };
          return specialtyService.adminCreateField(selectedTemplateId, {
            key: ensureUniqueKey(
              `${generatedBaseFieldKey}_${row.key}_${column.key}`,
              usedFieldKeys
            ),
            label: `${row.label} - ${column.label}`,
            labelAr: `${row.labelAr} - ${column.labelAr}`,
            sectionId: newField.sectionId,
            fieldType: cellType,
            isRequired: newField.isRequired,
            metadata
          });
        })
      );

      await Promise.all(createCalls);
      return null;
    },
    onSuccess: async () => {
      toast.success("تم إنشاء الحقل");
      setAddFieldSectionId(null);
      setNewField({
        label: "",
        labelAr: "",
        sectionId: "",
        fieldType: "TEXT",
        isRequired: false
      });
      setGridColumns([
        { id: "col-1", label: "", labelAr: "" }
      ]);
      setGridRows([{ id: "row-1", label: "", labelAr: "" }]);
      setGridCellConfigs({});
      setGridPreviewValues({});
      await refreshData();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Section")) {
        toast.error("اختر قسمًا قبل إنشاء الحقل");
        return;
      }
      if (message.includes("Grid")) {
        toast.error("أضف صفوفًا وأعمدة صالحة للـ Grid");
        return;
      }
      toast.error("تعذر إنشاء الحقل");
    }
  });

  const createSectionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Template is required");
      const usedSectionKeys = new Set(selectedTemplateSections.map((section) => section.key));
      const key = ensureUniqueKey(sanitizeKeyBase(newSection.name, "section"), usedSectionKeys);
      return specialtyService.adminCreateSection(selectedTemplateId, {
        key,
        name: newSection.name.trim(),
        nameAr: newSection.nameAr.trim()
      });
    },
    onSuccess: async (section) => {
      toast.success("تم إنشاء القسم");
      setCreateSectionDialogOpen(false);
      setNewSection({ name: "", nameAr: "" });
      setNewField((prev) => ({ ...prev, sectionId: section.id }));
      await refreshData();
    },
    onError: () => toast.error("تعذر إنشاء القسم")
  });
  const updateSectionMutation = useMutation({
    mutationFn: ({
      sectionId,
      payload
    }: {
      sectionId: string;
      payload: { name: string; nameAr: string };
    }) => specialtyService.adminUpdateSection(sectionId, payload),
    onSuccess: async () => {
      toast.success("تم تحديث الشاشة");
      setEditingSectionId(null);
      setEditingSection({ name: "", nameAr: "" });
      await refreshData();
    },
    onError: () => toast.error("تعذر تحديث الشاشة")
  });
  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => specialtyService.adminDeleteSection(sectionId),
    onSuccess: async () => {
      toast.success("تم حذف القسم");
      setSectionToDeleteId(null);
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
      toast.error(errorMessage || "تعذر حذف القسم");
    }
  });

  const openGridEditDialog = (group: GridGroup) => {
    setGridEditTarget(group);
    setGridEditColumns(group.columns.map((column) => ({ ...column })));
    setGridEditRows(group.rows.map((row) => ({ ...row })));
    const initialCellConfigs: Record<string, GridCellConfig> = {};
    group.fields.forEach((field) => {
      const { rowKey, columnKey } = readGridMeta(field);
      if (!rowKey || !columnKey) return;
      const metadata = field.metadata as Record<string, unknown> | null | undefined;
      const cellType = (typeof metadata?.cellType === "string" ? metadata.cellType : field.fieldType) as GridCellFieldType;
      const label = typeof metadata?.cellLabel === "string" ? metadata.cellLabel : field.label;
      const labelAr = typeof metadata?.cellLabelAr === "string" ? metadata.cellLabelAr : field.labelAr;
      initialCellConfigs[getGridCellKey(rowKey, columnKey)] = {
        type: cellType,
        label,
        labelAr,
        options: field.options.map((option) => ({
          id: option.id,
          value: option.value,
          label: option.label,
          labelAr: option.labelAr
        }))
      };
    });
    setGridEditCellConfigs(initialCellConfigs);
    const firstRow = group.rows[0]?.key ?? "";
    const firstColumn = group.columns[0]?.key ?? "";
    setActiveGridCellKey(firstRow && firstColumn ? getGridCellKey(firstRow, firstColumn) : "");
  };

  const closeGridEditDialog = () => {
    setGridEditTarget(null);
    setGridEditColumns([]);
    setGridEditRows([]);
    setGridEditCellConfigs({});
    setActiveGridCellKey("");
    setGridOptionPopupCellKey(null);
  };

  useEffect(() => {
    if (!gridEditTarget) return;
    const firstRow = gridEditRows[0]?.key ?? "";
    const firstColumn = gridEditColumns[0]?.key ?? "";
    const fallback = firstRow && firstColumn ? getGridCellKey(firstRow, firstColumn) : "";
    if (!activeGridCellKey) {
      setActiveGridCellKey(fallback);
      return;
    }
    const [rowKey, columnKey] = activeGridCellKey.split(":");
    const rowExists = gridEditRows.some((row) => row.key === rowKey);
    const columnExists = gridEditColumns.some((column) => column.key === columnKey);
    if (!rowExists || !columnExists) {
      setActiveGridCellKey(fallback);
    }
  }, [gridEditTarget, gridEditRows, gridEditColumns, activeGridCellKey]);

  const saveGridEditMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Template is required");
      if (!gridEditTarget) throw new Error("Grid is required");
      if (!gridEditColumns.length || !gridEditRows.length) throw new Error("Grid must have at least one row and one column");

      const previousColumnKeys = new Set(gridEditTarget.columns.map((item) => item.key));
      const previousRowKeys = new Set(gridEditTarget.rows.map((item) => item.key));

      const usedColumnKeys = new Set<string>();
      const normalizedColumns = gridEditColumns.map((column, index) => ({
        ...column,
        key: previousColumnKeys.has(column.key)
          ? ensureUniqueKey(column.key, usedColumnKeys)
          : ensureUniqueKey(sanitizeKeyBase(column.label || `col_${index + 1}`, `col_${index + 1}`), usedColumnKeys),
        label: column.label.trim() || `Column ${index + 1}`,
        labelAr: column.labelAr.trim() || `عمود ${index + 1}`,
        order: index + 1
      }));
      const usedRowKeys = new Set<string>();
      const normalizedRows = gridEditRows.map((row, index) => ({
        ...row,
        key: previousRowKeys.has(row.key)
          ? ensureUniqueKey(row.key, usedRowKeys)
          : ensureUniqueKey(sanitizeKeyBase(row.label || `row_${index + 1}`, `row_${index + 1}`), usedRowKeys),
        label: row.label.trim() || `Row ${index + 1}`,
        labelAr: row.labelAr.trim() || `صف ${index + 1}`,
        order: index + 1
      }));

      const nextColumnKeys = new Set(normalizedColumns.map((item) => item.key));
      const nextRowKeys = new Set(normalizedRows.map((item) => item.key));
      const removedRowKeys = new Set(gridEditTarget.rows.map((item) => item.key).filter((key) => !nextRowKeys.has(key)));
      const removedColumnKeys = new Set(gridEditTarget.columns.map((item) => item.key).filter((key) => !nextColumnKeys.has(key)));

      const existingCellMap = new Map<string, SpecialtyTemplateField>();
      gridEditTarget.fields.forEach((field) => {
        const { rowKey, columnKey } = readGridMeta(field);
        if (!rowKey || !columnKey) return;
        existingCellMap.set(getGridCellKey(rowKey, columnKey), field);
      });

      const deletedFieldIds = gridEditTarget.fields
        .filter((field) => {
          const { rowKey, columnKey } = readGridMeta(field);
          return removedRowKeys.has(rowKey) || removedColumnKeys.has(columnKey);
        })
        .map((field) => field.id);

      const deletedFieldIdSet = new Set(deletedFieldIds);

      const gridColumnsMetadata = normalizedColumns.map((column) => ({
        key: column.key,
        label: column.label,
        labelAr: column.labelAr,
        order: column.order
      }));

      const usedFieldKeys = new Set((selectedTemplate?.fields ?? []).map((field) => field.key));
      deletedFieldIds.forEach((id) => {
        const field = gridEditTarget.fields.find((f) => f.id === id);
        if (field) usedFieldKeys.delete(field.key);
      });

      const section = selectedTemplateSections.find((s) => s.id === gridEditTarget.sectionId);
      const sectionName = section?.name ?? "Section";
      const sectionNameAr = section?.nameAr ?? "قسم";

      const cells: Array<{
        fieldId?: string;
        key: string;
        label: string;
        labelAr: string;
        sectionId: string;
        section: string;
        sectionAr: string;
        fieldType: SpecialtyTemplateField["fieldType"];
        displayOrder: number;
        metadata: Record<string, unknown>;
        options?: Array<{ id?: string; value: string; label: string; labelAr: string; displayOrder: number }>;
      }> = [];

      let displayOrder = 1;
      normalizedRows.forEach((row) => {
        normalizedColumns.forEach((column) => {
          const cellKey = getGridCellKey(row.key, column.key);
          const existingField = existingCellMap.get(cellKey);
          const cellConfig = gridEditCellConfigs[cellKey] ?? {
            type: "TEXT",
            label: `${row.label} - ${column.label}`,
            labelAr: `${row.labelAr} - ${column.labelAr}`,
            options: []
          };
          const selectedType = cellConfig.type;
          const persistedType = (selectedType === "EMPTY" ? "TEXT" : selectedType) as SpecialtyTemplateField["fieldType"];
          const wantsOptions = selectedType === "DROPDOWN" || selectedType === "MULTI_SELECT";
          const rawLabel = cellConfig.label.trim();
          const rawLabelAr = cellConfig.labelAr.trim();
          const label = rawLabel || `${row.label} - ${column.label}`;
          const labelAr = rawLabelAr || `${row.labelAr} - ${column.labelAr}`;
          const metadata: Record<string, unknown> = {
            row: row.key,
            columnKey: column.key,
            cellType: selectedType,
            cellLabel: rawLabel,
            cellLabelAr: rawLabelAr,
            grid: {
              id: gridEditTarget.id,
              rowKey: row.key,
              columns: gridColumnsMetadata
            }
          };

          const isExistingUpdate = existingField && !deletedFieldIdSet.has(existingField.id);

          const normalizedOptions = wantsOptions
            ? cellConfig.options
                .map((option, index) => ({
                  id: option.id,
                  value: option.value.trim() || `option_${index + 1}`,
                  label: option.label.trim() || option.value.trim() || `Option ${index + 1}`,
                  labelAr: option.labelAr.trim() || option.label.trim() || `خيار ${index + 1}`,
                  displayOrder: index + 1
                }))
                .filter((option) => option.value)
            : [];

          cells.push({
            fieldId: isExistingUpdate ? existingField.id : undefined,
            key: isExistingUpdate
              ? existingField.key
              : ensureUniqueKey(
                  `${sanitizeKeyBase(gridEditTarget.id, "grid")}_${row.key}_${column.key}`,
                  usedFieldKeys
                ),
            label,
            labelAr,
            sectionId: gridEditTarget.sectionId,
            section: sectionName,
            sectionAr: sectionNameAr,
            fieldType: persistedType,
            displayOrder: displayOrder++,
            metadata,
            options: normalizedOptions
          });
        });
      });

      await specialtyService.adminBulkUpsertGrid(selectedTemplateId, { deletedFieldIds, cells });
    },
    onSuccess: async () => {
      toast.success("تم تحديث الـ Grid");
      closeGridEditDialog();
      await refreshData();
    },
    onError: () => toast.error("تعذر تحديث الـ Grid")
  });
  const deleteGridMutation = useMutation({
    mutationFn: async () => {
      if (!gridDeleteTarget) throw new Error("Grid is required");
      await Promise.all(gridDeleteTarget.fields.map((field) => specialtyService.adminDeleteField(field.id)));
    },
    onSuccess: async () => {
      toast.success("تم حذف الـ Grid");
      setGridDeleteTarget(null);
      await refreshData();
    },
    onError: () => toast.error("تعذر حذف الـ Grid")
  });

  const updateFieldMutation = useMutation({
    mutationFn: (fieldId: string) =>
      specialtyService.adminUpdateField(fieldId, {
        label: String(editingField.label ?? ""),
        labelAr: String(editingField.labelAr ?? ""),
        sectionId: (editingField.sectionId as string | null | undefined) ?? undefined,
        fieldType: (editingField.fieldType ?? "TEXT") as SpecialtyTemplateField["fieldType"],
        isRequired: Boolean(editingField.isRequired),
        metadata: (editingField.metadata as SpecialtyTemplateField["metadata"]) ?? undefined
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
    mutationFn: () => {
      const usedRuleKeys = new Set(rules.map((rule) => rule.key));
      const generatedRuleKey = ensureUniqueKey(sanitizeKeyBase(newRule.name, "rule"), usedRuleKeys);
      return specialtyService.adminCreateRule(selectedTemplateId, {
        key: generatedRuleKey,
        name: newRule.name,
        nameAr: newRule.nameAr,
        type: newRule.type,
        expression: buildExpression(newRule),
        fieldId: newRuleFieldId ?? undefined,
        severity: newRule.type === "ALERT" ? newRule.severity : undefined
      });
    },
    onSuccess: async () => {
      toast.success("تم إنشاء القاعدة");
      setNewRule(emptyRule);
      setNewRuleFieldId(null);
      await refreshData();
    },
    onError: () => toast.error("تعذر إنشاء القاعدة")
  });

  const updateRuleMutation = useMutation({
    mutationFn: (ruleId: string) =>
      specialtyService.adminUpdateRule(ruleId, {
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
      setDeleteRuleTarget(null);
      setEditingRuleId(null);
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
  const openNewRuleForField = (fieldId: string) => {
    setNewRule(emptyRule);
    setNewRuleFieldId(fieldId);
    setEditingRuleId(null);
  };
  const openNewGlobalRule = () => {
    setNewRule(emptyRule);
    setNewRuleFieldId(null);
    setEditingRuleId(null);
  };

  const handleSectionItemDrop = (sectionId: string, targetItemId: string) => {
    if (reorderFieldsMutation.isPending) return;
    if (!selectedTemplate || !dragItem) return;
    if (dragItem.sectionId !== sectionId) return;
    if (dragItem.itemId === targetItemId) return;

    const currentItems = sectionItemsById.get(sectionId) ?? [];
    if (!currentItems.length) return;

    const fromIndex = currentItems.findIndex(
      (item) => item.itemType === dragItem.itemType && item.id === dragItem.itemId
    );
    const toIndex = currentItems.findIndex((item) => item.id === targetItemId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reorderedItems = [...currentItems];
    const [movedItem] = reorderedItems.splice(fromIndex, 1);
    if (!movedItem) return;
    reorderedItems.splice(toIndex, 0, movedItem);

    const orderedSectionFieldIds = reorderedItems.flatMap((item) =>
      item.itemType === "field"
        ? [item.field.id]
        : [...item.group.fields]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((field) => field.id)
    );
    if (!orderedSectionFieldIds.length) return;

    const sectionFieldIds = new Set(sectionRows.find((row) => row.id === sectionId)?.fields.map((field) => field.id) ?? []);
    if (!sectionFieldIds.size) return;

    const finalOrderedIds: string[] = [];
    let insertedSection = false;
    selectedTemplate.fields.forEach((field) => {
      if (sectionFieldIds.has(field.id)) {
        if (!insertedSection) {
          finalOrderedIds.push(...orderedSectionFieldIds);
          insertedSection = true;
        }
        return;
      }
      finalOrderedIds.push(field.id);
    });
    if (!insertedSection) {
      finalOrderedIds.push(...orderedSectionFieldIds);
    }

    reorderFieldsMutation.mutate(finalOrderedIds);
    setDragItem(null);
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
                          <>
                            <button
                              type="button"
                              className={premiumIconButtonClass}
                              onClick={() => setPreviewTemplate(template)}
                              aria-label={t("specialties.templates.preview")}
                            >
                              <Eye size={16} />
                            </button>
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
                          </>
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
                  {mode === "templates" ? (
                  <TooltipProvider delayDuration={120}>
                  <div className={dsPanelClass}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-base font-medium text-slate-700">شاشات الحقول</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setCreateSectionDialogOpen(true)}
                            className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
                          >
                            <Plus size={14} />
                            إنشاء شاشة
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">إنشاء شاشة جديدة</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                      <div className="grid grid-cols-[minmax(0,1.6fr)_120px_220px] items-center border-b border-slate-200 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-4 py-3 text-sm font-semibold text-white">
                        <span className="pe-2 text-right">الشاشة</span>
                        <span className="text-center">عدد الحقول</span>
                        <span className="text-right">إجراءات</span>
                      </div>
                      {sectionRows.map((row, rowIndex) => {
                        const expanded = expandedSectionIds.includes(row.id);
                        const isAddingHere = addFieldSectionId === row.id;
                        return (
                          <div key={row.id} className="border-b border-slate-200/90 last:border-b-0">
                            <div className="grid grid-cols-[minmax(0,1.6fr)_120px_220px] items-center px-4 py-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {editingSectionId === row.id ? (
                                    <div className="grid w-full gap-2 pe-2">
                                      <input
                                        value={editingSection.nameAr}
                                        onChange={(event) => setEditingSection((prev) => ({ ...prev, nameAr: event.target.value }))}
                                        className={dsInputCompactClass}
                                        placeholder="اسم الشاشة (عربي)"
                                      />
                                      <input
                                        value={editingSection.name}
                                        onChange={(event) => setEditingSection((prev) => ({ ...prev, name: event.target.value }))}
                                        className={dsInputCompactClass}
                                        placeholder="Screen name (English)"
                                      />
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedSectionIds((prev) =>
                                          prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
                                        )
                                      }
                                      className="inline-flex w-full items-center gap-2 pe-2 text-right"
                                      aria-label="توسيع أو طي الشاشة"
                                    >
                                      <ChevronDown size={14} className={cn("text-slate-500 transition", expanded ? "rotate-180" : "")} />
                                      <span className={`rounded-lg border px-2.5 py-1 text-sm font-semibold ${sectionColorClasses[rowIndex % sectionColorClasses.length]}`}>
                                        {row.label}
                                      </span>
                                    </button>
                                  )}
                                </TooltipTrigger>
                                <TooltipContent side="top">توسيع أو طي الشاشة</TooltipContent>
                              </Tooltip>
                              <span className="text-center text-base font-semibold text-slate-700">{row.fields.length}</span>
                              <div className="flex items-center justify-end gap-2">
                                {editingSectionId === row.id ? (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className={premiumIconButtonClass}
                                          aria-label="حفظ الشاشة"
                                          onClick={() =>
                                            updateSectionMutation.mutate({
                                              sectionId: row.id,
                                              payload: {
                                                name: editingSection.name.trim(),
                                                nameAr: editingSection.nameAr.trim()
                                              }
                                            })
                                          }
                                          disabled={
                                            !editingSection.name.trim() ||
                                            !editingSection.nameAr.trim() ||
                                            updateSectionMutation.isPending
                                          }
                                        >
                                          <Check size={15} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">حفظ الشاشة</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className={premiumIconButtonClass}
                                          aria-label="إلغاء تعديل الشاشة"
                                          onClick={() => {
                                            setEditingSectionId(null);
                                            setEditingSection({ name: "", nameAr: "" });
                                          }}
                                          disabled={updateSectionMutation.isPending}
                                        >
                                          <X size={15} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">إلغاء</TooltipContent>
                                    </Tooltip>
                                  </>
                                ) : (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className={premiumIconButtonClass}
                                          aria-label="تعديل الشاشة"
                                          onClick={() => {
                                            setEditingSectionId(row.id);
                                            setEditingSection({ name: row.name, nameAr: row.nameAr });
                                          }}
                                        >
                                          <PencilLine size={15} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">تعديل الشاشة</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className={premiumIconButtonClass}
                                          aria-label="إضافة حقل داخل الشاشة"
                                          onClick={() => {
                                            setAddFieldSectionId(row.id);
                                            setNewField((prev) => ({ ...prev, sectionId: row.id }));
                                          }}
                                        >
                                          <Plus size={15} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">إضافة حقل داخل الشاشة</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className={premiumDeleteButtonClass}
                                          aria-label="حذف الشاشة"
                                          onClick={() => setSectionToDeleteId(row.id)}
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">حذف الشاشة</TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </div>

                            {isAddingHere ? (
                              <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-3">
                                <p className="text-sm font-semibold text-slate-700">إضافة حقل إلى شاشة: {row.label}</p>
                                <div className="grid gap-2 md:grid-cols-3">
                                  <input value={newField.label} onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))} className={dsInputClass} placeholder="الاسم (إنجليزي)" />
                                  <input value={newField.labelAr} onChange={(e) => setNewField((p) => ({ ...p, labelAr: e.target.value }))} className={dsInputClass} placeholder="الاسم (عربي)" />
                                  <select value={newField.fieldType} onChange={(e) => setNewField((p) => ({ ...p, fieldType: e.target.value as (typeof fieldTypes)[number] }))} className={dsInputClass}>
                                    {fieldTypes.map((fieldType) => <option key={fieldType} value={fieldType}>{fieldTypeLabels[fieldType]}</option>)}
                                  </select>
                                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" checked={newField.isRequired} onChange={(e) => setNewField((p) => ({ ...p, isRequired: e.target.checked }))} />
                                    مطلوب
                                  </label>
                                  <div className="md:col-span-2 flex items-center gap-2">
                                    <RippleButton type="button" disabled={!newField.label.trim() || !newField.labelAr.trim() || !newField.sectionId || createFieldMutation.isPending} onClick={() => createFieldMutation.mutate()}>
                                      إضافة الحقل
                                    </RippleButton>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className={dsModalCancelButtonClass}
                                          onClick={() => {
                                            setAddFieldSectionId(null);
                                            setNewField((prev) => ({ ...prev, sectionId: "" }));
                                            setGridCellConfigs({});
                                          }}
                                        >
                                          إلغاء
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">إلغاء إضافة الحقل</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                                {newField.fieldType === "GRID" ? (
                                  <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/40 p-3">
                                    <p className="text-sm font-semibold text-slate-700">Grid Builder</p>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-slate-600">الأعمدة</p>
                                      {gridColumns.map((column) => (
                                        <div key={column.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                                          <input
                                            value={column.label}
                                            onChange={(e) => setGridColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, label: e.target.value } : item)))}
                                            className={dsInputCompactClass}
                                            placeholder="Label"
                                          />
                                          <input
                                            value={column.labelAr}
                                            onChange={(e) => setGridColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, labelAr: e.target.value } : item)))}
                                            className={dsInputCompactClass}
                                            placeholder="الاسم العربي"
                                          />
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs text-rose-700"
                                                disabled={gridColumns.length <= 1}
                                                onClick={() => setGridColumns((prev) => prev.filter((item) => item.id !== column.id))}
                                              >
                                                حذف
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">حذف العمود</TooltipContent>
                                          </Tooltip>
                                        </div>
                                      ))}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-700"
                                            onClick={() =>
                                              setGridColumns((prev) => [...prev, { id: createClientId(), label: "", labelAr: "" }])
                                            }
                                          >
                                            + عمود
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">إضافة عمود</TooltipContent>
                                      </Tooltip>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-slate-600">الصفوف</p>
                                      {gridRows.map((rowItem) => (
                                        <div key={rowItem.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                                          <input
                                            value={rowItem.label}
                                            onChange={(e) => setGridRows((prev) => prev.map((item) => (item.id === rowItem.id ? { ...item, label: e.target.value } : item)))}
                                            className={dsInputCompactClass}
                                            placeholder="Label"
                                          />
                                          <input
                                            value={rowItem.labelAr}
                                            onChange={(e) => setGridRows((prev) => prev.map((item) => (item.id === rowItem.id ? { ...item, labelAr: e.target.value } : item)))}
                                            className={dsInputCompactClass}
                                            placeholder="الاسم العربي"
                                          />
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs text-rose-700"
                                                disabled={gridRows.length <= 1}
                                                onClick={() => setGridRows((prev) => prev.filter((item) => item.id !== rowItem.id))}
                                              >
                                                حذف
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">حذف الصف</TooltipContent>
                                          </Tooltip>
                                        </div>
                                      ))}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-700"
                                            onClick={() =>
                                              setGridRows((prev) => [...prev, { id: createClientId(), label: "", labelAr: "" }])
                                            }
                                          >
                                            + صف
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">إضافة صف</TooltipContent>
                                      </Tooltip>
                                    </div>
                                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-slate-700">{t("specialties.grid.livePreview")}</p>
                                        <p className="text-[11px] text-slate-500">{t("specialties.grid.livePreviewHint")}</p>
                                      </div>
                                      {gridColumns.some((column) => column.label.trim() || column.labelAr.trim()) ? (
                                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                                          <table className="min-w-full border-separate border-spacing-0 text-right text-xs">
                                            <thead className="bg-slate-100/80">
                                              <tr>
                                                {gridColumns.map((column, columnIndex) => (
                                                  <th
                                                    key={`preview-head-${column.id}`}
                                                    className="border-b border-slate-200 px-3 py-2 text-center font-semibold text-slate-700"
                                                  >
                                                    {column.labelAr.trim() || column.label.trim() || `${t("specialties.grid.column")} ${columnIndex + 1}`}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {gridRows.map((rowItem, rowIndex) => (
                                                <tr key={`preview-row-${rowItem.id}`}>
                                                  {gridColumns.map((column) => {
                                                    const previewKey = getGridCellKey(rowItem.id, column.id);
                                                    const selectedType = gridCellConfigs[previewKey]?.type ?? "TEXT";
                                                    return (
                                                      <td key={`preview-cell-${rowItem.id}-${column.id}`} className="border-b border-slate-100 px-2 py-2">
                                                        <div className="space-y-1.5">
                                                          <select
                                                            value={selectedType}
                                                            onChange={(event) =>
                                                              setGridCellConfigs((prev) => ({
                                                                ...prev,
                                                                [previewKey]: {
                                                                  type: event.target.value as GridCellFieldType,
                                                                  label: prev[previewKey]?.label ?? `${rowItem.label || `Row ${rowIndex + 1}`} - ${column.label || `Column`}`,
                                                                  labelAr: prev[previewKey]?.labelAr ?? `${rowItem.labelAr || `صف ${rowIndex + 1}`} - ${column.labelAr || `عمود`}`,
                                                                  options: prev[previewKey]?.options ?? []
                                                                }
                                                              }))
                                                            }
                                                            className={dsInputCompactClass}
                                                          >
                                                            {gridCellFieldTypes.map((fieldType) => (
                                                              <option key={`${previewKey}-${fieldType}`} value={fieldType}>
                                                                {gridCellTypeLabels[fieldType]}
                                                              </option>
                                                            ))}
                                                          </select>
                                                          <input
                                                            value={gridPreviewValues[previewKey] ?? ""}
                                                            onChange={(event) =>
                                                              setGridPreviewValues((prev) => ({
                                                                ...prev,
                                                                [previewKey]: event.target.value
                                                              }))
                                                            }
                                                            placeholder={`${t("specialties.grid.sampleCell")} ${rowIndex + 1}`}
                                                            className={dsInputCompactClass}
                                                          />
                                                        </div>
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                          {t("specialties.grid.livePreviewEmpty")}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {expanded ? (
                              <div className="space-y-3 border-t border-slate-100 bg-white p-3">
                                {(sectionItemsById.get(row.id) ?? []).map((item) => {
                                  if (item.itemType === "grid") {
                                    const group = item.group;
                                    return (
                                      <div
                                        key={`grid-group-${group.id}`}
                                        className="rounded-xl border border-orange-200 bg-orange-50/50 p-3"
                                        draggable
                                        onDragStart={() => setDragItem({ sectionId: row.id, itemType: "grid", itemId: group.id })}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => handleSectionItemDrop(row.id, group.id)}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-800">{group.nameAr}</p>
                                            <p className="text-xs text-slate-600">
                                              الصفوف: {group.rows.length} | الأعمدة: {group.columns.length} | الخلايا: {group.fields.length}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            className="inline-flex h-9 items-center rounded-lg border border-orange-200 bg-white px-3 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
                                            onClick={() => openGridEditDialog(group)}
                                          >
                                            تعديل الـ Grid
                                          </button>
                                          <button
                                            type="button"
                                            className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                                            onClick={() => setGridDeleteTarget(group)}
                                          >
                                            حذف الـ Grid
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }
                                  const field = item.field;
                                  return (
                            <div
                              key={field.id}
                              className="rounded-xl border border-slate-200 bg-white p-3"
                              draggable
                              onDragStart={() => setDragItem({ sectionId: row.id, itemType: "field", itemId: field.id })}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleSectionItemDrop(row.id, field.id)}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  {editingFieldId === field.id ? (
                                    <div className="grid gap-2 md:grid-cols-2">
                                      <input value={String(editingField.label ?? "")} onChange={(e) => setEditingField((p) => ({ ...p, label: e.target.value }))} className={dsInputCompactClass} />
                                      <input value={String(editingField.labelAr ?? "")} onChange={(e) => setEditingField((p) => ({ ...p, labelAr: e.target.value }))} className={dsInputCompactClass} />
                                      <select
                                        value={String(editingField.sectionId ?? "")}
                                        onChange={(e) => setEditingField((p) => ({ ...p, sectionId: e.target.value }))}
                                        className={dsInputCompactClass}
                                      >
                                        <option value="" disabled>
                                          اختر الشاشة
                                        </option>
                                        {selectedTemplateSections.map((section) => (
                                          <option key={section.id} value={section.id}>
                                            {section.nameAr}
                                          </option>
                                        ))}
                                      </select>
                                      <select value={String(editingField.fieldType ?? field.fieldType)} onChange={(e) => setEditingField((p) => ({ ...p, fieldType: e.target.value as SpecialtyTemplateField["fieldType"] }))} className={dsInputCompactClass}>
                                        {fieldTypes.map((type) => <option key={type} value={type}>{fieldTypeLabels[type]}</option>)}
                                      </select>
                                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(editingField.isRequired)}
                                          onChange={(e) => setEditingField((p) => ({ ...p, isRequired: e.target.checked }))}
                                        />
                                        مطلوب
                                      </label>
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
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button type="button" className={dsTextActionSuccessClass} onClick={() => updateFieldMutation.mutate(field.id)}>حفظ</button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">حفظ الحقل</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button type="button" className={dsTextActionClass} onClick={() => setEditingFieldId(null)}>إلغاء</button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">إلغاء تعديل الحقل</TooltipContent>
                                      </Tooltip>
                                    </>
                                  ) : (
                                    <>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className={premiumIconButtonClass}
                                            onClick={() => openNewRuleForField(field.id)}
                                            aria-label="إضافة قاعدة للحقل"
                                          >
                                            <ClipboardList size={16} />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">إضافة قاعدة للحقل</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button type="button" className={premiumIconButtonClass} onClick={() => { setEditingFieldId(field.id); setEditingField(field); }} aria-label="تعديل الحقل">
                                            <PencilLine size={16} />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">تعديل الحقل</TooltipContent>
                                      </Tooltip>
                                    </>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className={premiumDeleteButtonClass} onClick={() => setDeleteFieldTarget(field)} aria-label="حذف الحقل">
                                        <Trash2 size={16} />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">حذف الحقل</TooltipContent>
                                  </Tooltip>
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
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button type="button" className={premiumIconButtonClass} onClick={() => { setEditingOptionId(option.id); setEditingOption({ value: option.value, label: option.label, labelAr: option.labelAr }); }} aria-label="تعديل الخيار">
                                                  <PencilLine size={14} />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top">تعديل الخيار</TooltipContent>
                                            </Tooltip>
                                          </>
                                        )}
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button type="button" className={premiumDeleteButtonClass} onClick={() => deleteOptionMutation.mutate(option.id)} aria-label="حذف الخيار">
                                              <Trash2 size={14} />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">حذف الخيار</TooltipContent>
                                        </Tooltip>
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
                              <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-slate-700">{t("specialties.rules.fieldSection")}</p>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-orange-200 bg-white px-2 text-xs font-medium text-orange-700 transition hover:bg-orange-50"
                                        onClick={() => openNewRuleForField(field.id)}
                                        aria-label={t("specialties.rules.addFieldRule")}
                                      >
                                        <Plus size={12} />
                                        {t("specialties.rules.addFieldRule")}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">{t("specialties.rules.addFieldRule")}</TooltipContent>
                                  </Tooltip>
                                </div>
                                {newRuleFieldId === field.id ? (
                                  <div className="mb-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-2">
                                    <div className="grid gap-2 md:grid-cols-2">
                                      <input value={newRule.name} onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))} className={dsInputCompactClass} placeholder="اسم القاعدة (إنجليزي)" />
                                      <input value={newRule.nameAr} onChange={(e) => setNewRule((p) => ({ ...p, nameAr: e.target.value }))} className={dsInputCompactClass} placeholder="اسم القاعدة (عربي)" />
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                      <select value={newRule.type} onChange={(e) => setNewRule((p) => ({ ...p, type: e.target.value as RuleFormState["type"] }))} className={dsInputCompactClass}>
                                        {ruleTypes.map((type) => <option key={type} value={type}>{ruleTypeLabels[type]}</option>)}
                                      </select>
                                      <select value={newRule.logic} onChange={(e) => setNewRule((p) => ({ ...p, logic: e.target.value as RuleFormState["logic"] }))} className={dsInputCompactClass}>
                                        <option value="all">و (الكل)</option>
                                        <option value="any">أو (أي شرط)</option>
                                      </select>
                                    </div>
                                    <div className="space-y-2 rounded border border-slate-200 p-2">
                                      {newRule.conditions.map((condition, index) => (
                                        <div key={`field-new-condition-${field.id}-${index}`} className="grid gap-2 md:grid-cols-[1.3fr_0.8fr_1fr_auto]">
                                          <input value={condition.field} onChange={(e) => updateRuleCondition(index, "field", e.target.value)} className={dsInputCompactClass} placeholder="مفتاح الحقل" />
                                          <select value={condition.op} onChange={(e) => updateRuleCondition(index, "op", e.target.value)} className={dsInputCompactClass}>
                                            {operators.map((op) => <option key={op} value={op}>{operatorLabels[op]}</option>)}
                                          </select>
                                          <input value={condition.value} onChange={(e) => updateRuleCondition(index, "value", e.target.value)} className={dsInputCompactClass} placeholder="القيمة" />
                                          <button type="button" className="h-8 rounded border border-slate-200 px-2 text-xs text-rose-600" onClick={() => removeRuleCondition(index)}>
                                            حذف
                                          </button>
                                        </div>
                                      ))}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50" onClick={() => addRuleCondition()}>
                                            + إضافة شرط
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">إضافة شرط</TooltipContent>
                                      </Tooltip>
                                    </div>
                                    {newRule.type === "ALERT" ? (
                                      <div className="grid gap-2 md:grid-cols-3">
                                        <input value={newRule.severity} onChange={(e) => setNewRule((p) => ({ ...p, severity: e.target.value }))} className={dsInputCompactClass} placeholder="درجة الأهمية" />
                                        <input value={newRule.message} onChange={(e) => setNewRule((p) => ({ ...p, message: e.target.value }))} className={dsInputCompactClass} placeholder="رسالة التنبيه (En)" />
                                        <input value={newRule.messageAr} onChange={(e) => setNewRule((p) => ({ ...p, messageAr: e.target.value }))} className={dsInputCompactClass} placeholder="رسالة التنبيه (Ar)" />
                                      </div>
                                    ) : null}
                                    <div className="flex items-center gap-2">
                                      <RippleButton type="button" className="h-9 text-xs" onClick={() => createRuleMutation.mutate()} disabled={createRuleMutation.isPending} title={t("specialties.rules.addFieldRule")}>
                                        {t("specialties.rules.addFieldRule")}
                                      </RippleButton>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button type="button" className={dsTextActionClass} onClick={openNewGlobalRule}>
                                            إلغاء
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">إلغاء</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                ) : null}
                                <div className="space-y-2">
                                  {(fieldRulesByFieldId.get(field.id) ?? []).map((rule) => (
                                    <div key={rule.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                      {editingRuleId === rule.id ? (
                                        <div className="grid gap-2 md:grid-cols-3">
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
                                                <div key={`field-edit-condition-${rule.id}-${index}`} className="grid gap-2 md:grid-cols-[1.3fr_0.8fr_1fr_auto]">
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
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <button
                                                        type="button"
                                                        className="h-8 rounded border border-slate-200 px-2 text-xs text-rose-600"
                                                        onClick={() => removeRuleCondition(index, true)}
                                                      >
                                                        حذف
                                                      </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">حذف الشرط</TooltipContent>
                                                  </Tooltip>
                                        </div>
                                      ))}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className="rounded border border-slate-200 px-2 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                            onClick={() => addRuleCondition(true)}
                                          >
                                            + إضافة شرط
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">إضافة شرط</TooltipContent>
                                      </Tooltip>
                                            </div>
                                          </div>
                                          <input value={editingRule.severity} onChange={(e) => setEditingRule((p) => ({ ...p, severity: e.target.value }))} className={dsInputCompactClass} />
                                          <input value={editingRule.message} onChange={(e) => setEditingRule((p) => ({ ...p, message: e.target.value }))} className={dsInputCompactClass} />
                                          <input value={editingRule.messageAr} onChange={(e) => setEditingRule((p) => ({ ...p, messageAr: e.target.value }))} className={dsInputCompactClass} />
                                          <div className="flex items-center gap-2">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  type="button"
                                                  className={dsTextActionSuccessClass}
                                                  onClick={() => updateRuleMutation.mutate(rule.id)}
                                                >
                                                  حفظ
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top">حفظ القاعدة</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button type="button" className={dsTextActionClass} onClick={() => setEditingRuleId(null)}>إلغاء</button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top">إلغاء تعديل القاعدة</TooltipContent>
                                            </Tooltip>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-between gap-2">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-800">{rule.nameAr}</p>
                                            <p className="text-xs text-slate-500">{rule.key} - {ruleTypeLabels[rule.type]}</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button type="button" className={premiumIconButtonClass} onClick={() => startEditRule(rule)} aria-label="تعديل قاعدة الحقل">
                                                  <PencilLine size={14} />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top">تعديل قاعدة الحقل</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button type="button" className={premiumDeleteButtonClass} onClick={() => setDeleteRuleTarget(rule)} aria-label="حذف قاعدة الحقل">
                                                  <Trash2 size={14} />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top">حذف قاعدة الحقل</TooltipContent>
                                            </Tooltip>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {!(fieldRulesByFieldId.get(field.id) ?? []).length ? (
                                    <p className="text-xs text-slate-500">{t("specialties.rules.noneForField")}</p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                                  );
                                })}
                                {!(sectionItemsById.get(row.id) ?? []).length ? (
                                  <p className="text-sm text-slate-500">لا توجد حقول في هذه الشاشة.</p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {!sectionRows.length ? <p className="p-3 text-sm text-slate-500">لا توجد أقسام بعد.</p> : null}
                    </div>
                    {unassignedFields.length ? (
                      <p className="mt-2 text-xs text-amber-700">
                        يوجد {unassignedFields.length} حقل بدون قسم. يمكنك تعديل الحقول وربطها بقسم من داخل القائمة.
                      </p>
                    ) : null}
                  </div>
                  </TooltipProvider>
                  ) : null}

                  {mode === "rules" ? (
                  <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-slate-50 p-5 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{t("specialties.rules.globalBuilder")}</p>
                        <p className="text-sm text-slate-600">{t("specialties.rules.globalDescription")}</p>
                      </div>
                      <button type="button" className={premiumIconButtonClass} onClick={openNewGlobalRule} aria-label={t("specialties.rules.addGlobalRule")}>
                        <Plus size={16} />
                      </button>
                    </div>

                  <div className={dsPanelClass}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-base font-medium text-slate-700">{t("specialties.rules.globalBuilder")}</p>
                      <button type="button" className={premiumIconButtonClass} onClick={openNewGlobalRule} aria-label={t("specialties.rules.addGlobalRule")}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className="mb-2 text-xs text-slate-500">{t("specialties.rules.globalDescription")}</p>
                    {newRuleFieldId !== null ? (
                      <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        يتم الآن إعداد قاعدة مرتبطة بحقل. اضغط (+) هنا لإنشاء قاعدة عامة بدلًا من ذلك.
                      </p>
                    ) : null}
                    {newRuleFieldId === null ? (
                    <div className="grid gap-2 md:grid-cols-3">
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
                      <RippleButton type="button" className="h-10 text-sm" onClick={() => createRuleMutation.mutate()}>{t("specialties.rules.addGlobalRule")}</RippleButton>
                    </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {globalRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="rounded-lg border border-slate-200 bg-white p-2"
                        >
                          {editingRuleId === rule.id ? (
                            <div className="grid gap-2 md:grid-cols-3">
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
                                <button type="button" className={premiumDeleteButtonClass} onClick={() => setDeleteRuleTarget(rule)} aria-label="حذف القاعدة">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {!globalRules.length ? <p className="text-base text-slate-500">{t("specialties.rules.noneGlobal")}</p> : null}
                    </div>
                  </div>
                  </div>
                  ) : null}
                </>
              ) : (
                <p className="text-base text-slate-500">اختر قالبًا أولًا.</p>
              )}
            </section>
          </div>
        </section>
        {createSectionDialogOpen ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="إغلاق نافذة إنشاء القسم"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setCreateSectionDialogOpen(false)}
              disabled={createSectionMutation.isPending}
            />
            <section className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
              <p className="mb-3 text-base font-semibold text-slate-800">إنشاء قسم جديد</p>
              <div className="grid gap-2">
                <input
                  value={newSection.nameAr}
                  onChange={(event) => setNewSection((prev) => ({ ...prev, nameAr: event.target.value }))}
                  className={dsInputClass}
                  placeholder="اسم القسم (عربي)"
                />
                <input
                  value={newSection.name}
                  onChange={(event) => setNewSection((prev) => ({ ...prev, name: event.target.value }))}
                  className={dsInputClass}
                  placeholder="Section name (English)"
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3">
                <button
                  type="button"
                  className={dsModalCancelButtonClass}
                  onClick={() => setCreateSectionDialogOpen(false)}
                  disabled={createSectionMutation.isPending}
                >
                  إلغاء
                </button>
                <RippleButton
                  type="button"
                  disabled={!newSection.name.trim() || !newSection.nameAr.trim() || createSectionMutation.isPending}
                  onClick={() => createSectionMutation.mutate()}
                >
                  {createSectionMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء"}
                </RippleButton>
              </div>
            </section>
          </div>
        ) : null}
        {gridEditTarget ? (
          <motion.div
            className="fixed inset-0 z-[91] flex items-center justify-center p-2 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="إغلاق نافذة تعديل الـ Grid"
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
              onClick={closeGridEditDialog}
              disabled={saveGridEditMutation.isPending}
            />
            <motion.section
              dir="rtl"
              role="dialog"
              aria-modal="true"
              className="relative flex max-h-[96vh] w-[min(96vw,96rem)] flex-col overflow-hidden rounded-3xl border border-orange-200/70 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/40 p-3 sm:p-5 shadow-2xl"
              style={{ boxShadow: "0 34px 120px rgba(234,88,12,0.18), 0 22px 60px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(251,146,60,0.2)" }}
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-orange-200/70 bg-white/95 px-3 py-3 shadow-sm backdrop-blur">
                <div>
                  <p className="text-xl font-bold text-slate-800">تعديل {gridEditTarget.nameAr}</p>
                  <p className="text-sm text-slate-600">واجهة هندسية واضحة: إدارة البنية يسارًا وتعديل الخلايا يمينًا.</p>
                </div>
                <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-orange-200/70 bg-gradient-to-r from-orange-50 to-amber-50 px-2.5 py-1.5">
                  <span className="text-xs font-semibold text-orange-800">Grid Overview</span>
                  <span className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-xs font-medium text-orange-700">أعمدة: {gridEditColumns.length}</span>
                  <span className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-xs font-medium text-orange-700">صفوف: {gridEditRows.length}</span>
                  <button
                    type="button"
                    className={dsModalCancelButtonClass}
                    onClick={closeGridEditDialog}
                    disabled={saveGridEditMutation.isPending}
                  >
                    إغلاق
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pe-1">
                <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
                <motion.div className="space-y-4" variants={modalPanelVariants} initial="hidden" animate="show">
                <motion.div className="rounded-2xl border border-orange-200/60 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)]" variants={modalPanelItemVariants}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">الأعمدة</p>
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                      onClick={() =>
                        setGridEditColumns((prev) => [
                          ...prev,
                          { key: createClientId(), label: "", labelAr: "", order: prev.length + 1 }
                        ])
                      }
                    >
                      + عمود
                    </button>
                  </div>
                  <div className="space-y-2">
                    {gridEditColumns.map((column, index) => (
                      <div key={`edit-column-${column.key}`} className="flex items-start gap-2 rounded-xl border border-transparent p-1.5 transition duration-150 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-md">
                        <span className="flex h-10 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-xs font-bold text-orange-700">{index + 1}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                          <input
                            value={column.label}
                            onChange={(event) =>
                              setGridEditColumns((prev) =>
                                prev.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item))
                              )
                            }
                            className={`${dsInputCompactClass} h-10 min-w-0 flex-1 text-base`}
                            placeholder="الاسم (English)"
                          />
                          <input
                            value={column.labelAr}
                            onChange={(event) =>
                              setGridEditColumns((prev) =>
                                prev.map((item, itemIndex) => (itemIndex === index ? { ...item, labelAr: event.target.value } : item))
                              )
                            }
                            className={`${dsInputCompactClass} h-10 min-w-0 flex-1 text-base`}
                            placeholder="الاسم العربي"
                          />
                        </div>
                        <button
                          type="button"
                          className="h-10 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs text-rose-700"
                          disabled={gridEditColumns.length <= 1}
                          onClick={() =>
                            setGridEditColumns((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                          }
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
                <motion.div className="rounded-2xl border border-orange-200/60 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)]" variants={modalPanelItemVariants}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">الصفوف</p>
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                      onClick={() =>
                        setGridEditRows((prev) => [
                          ...prev,
                          { key: createClientId(), label: "", labelAr: "", order: prev.length + 1 }
                        ])
                      }
                    >
                      + صف
                    </button>
                  </div>
                  <div className="space-y-2">
                    {gridEditRows.map((row, index) => (
                      <div key={`edit-row-${row.key}`} className="flex items-start gap-2 rounded-xl border border-transparent p-1.5 transition duration-150 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-md">
                        <span className="flex h-10 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-xs font-bold text-orange-700">{index + 1}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                          <input
                            value={row.label}
                            onChange={(event) =>
                              setGridEditRows((prev) =>
                                prev.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item))
                              )
                            }
                            className={`${dsInputCompactClass} h-10 min-w-0 flex-1 text-base`}
                            placeholder="الاسم (English)"
                          />
                          <input
                            value={row.labelAr}
                            onChange={(event) =>
                              setGridEditRows((prev) =>
                                prev.map((item, itemIndex) => (itemIndex === index ? { ...item, labelAr: event.target.value } : item))
                              )
                            }
                            className={`${dsInputCompactClass} h-10 min-w-0 flex-1 text-base`}
                            placeholder="الاسم العربي"
                          />
                        </div>
                        <button
                          type="button"
                          className="h-10 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs text-rose-700"
                          disabled={gridEditRows.length <= 1}
                          onClick={() =>
                            setGridEditRows((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                          }
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
                </motion.div>
                <div className="space-y-3">
                <div className="rounded-2xl border border-orange-200/70 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 text-xs text-slate-700">
                  عدّل نوع كل خلية، واسمها الإنجليزي/العربي، وخياراتها إذا كانت من نوع قائمة. يفضّل إكمال أسماء الصفوف والأعمدة أولًا.
                </div>
                <div className="overflow-x-auto rounded-2xl border border-orange-200/60 bg-white shadow-[0_10px_34px_rgba(15,23,42,0.08)]">
                  <div className="min-w-[760px] p-3">
                    <div
                      className="mb-2 grid gap-3"
                      style={{ gridTemplateColumns: `repeat(${Math.max(gridEditColumns.length, 1)}, minmax(220px, 1fr))` }}
                    >
                      {gridEditColumns.map((column, columnIndex) => (
                        <div key={`edit-grid-head-${column.key}`} className="rounded-xl border border-orange-200/60 bg-gradient-to-r from-orange-100/70 to-amber-50 px-3 py-2 text-center text-sm font-semibold text-slate-700">
                          {column.labelAr.trim() || column.label.trim() || `عمود ${columnIndex + 1}`}
                        </div>
                      ))}
                    </div>
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: `repeat(${Math.max(gridEditColumns.length, 1)}, minmax(220px, 1fr))` }}
                    >
                      {gridEditRows.flatMap((row, rowIndex) =>
                        gridEditColumns.map((column) => {
                          const cellKey = getGridCellKey(row.key, column.key);
                          const fallbackLabel = `${row.label || `Row ${rowIndex + 1}`} - ${column.label || "Column"}`;
                          const fallbackLabelAr = `${row.labelAr || `صف ${rowIndex + 1}`} - ${column.labelAr || "عمود"}`;
                          const cellConfig = gridEditCellConfigs[cellKey] ?? {
                            type: "TEXT",
                            label: fallbackLabel,
                            labelAr: fallbackLabelAr,
                            options: []
                          };
                          const selectedType = cellConfig.type;
                          const labelValue = cellConfig.label;
                          const displayLabel = labelValue.trim() || fallbackLabel;
                          return (
                            <div
                              key={`edit-grid-cell-${row.key}-${column.key}`}
                              className="space-y-2 rounded-2xl border border-orange-200/70 bg-[hsl(var(--primary)/0.9)] p-3 transition duration-150 focus-within:scale-[1.015] focus-within:border-blue-300 focus-within:shadow-[0_12px_28px_rgba(59,130,246,0.20)]"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-slate-600">صف {rowIndex + 1}</span>
                                <select
                                  value={selectedType}
                                  onChange={(event) =>
                                    setGridEditCellConfigs((prev) => ({
                                      ...prev,
                                      [cellKey]: {
                                        ...(prev[cellKey] ?? cellConfig),
                                        type: event.target.value as GridCellFieldType
                                      }
                                    }))
                                  }
                                  className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                >
                                  {gridCellFieldTypes.map((type) => (
                                    <option key={`edit-grid-type-${cellKey}-${type}`} value={type}>
                                      {gridCellTypeLabels[type]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <input
                                value={labelValue}
                                onChange={(event) =>
                                  setGridEditCellConfigs((prev) => ({
                                    ...prev,
                                    [cellKey]: {
                                      ...(prev[cellKey] ?? cellConfig),
                                      label: event.target.value,
                                      labelAr: event.target.value
                                    }
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                placeholder={fallbackLabel}
                              />
                              {selectedType === "EMPTY" ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-2 text-sm font-medium text-slate-700">
                                  {displayLabel}
                                </div>
                              ) : (
                                <>
                                  <input
                                    value={gridCellTypeLabels[selectedType]}
                                    readOnly
                                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3 text-sm text-slate-500 outline-none"
                                  />
                                  {(selectedType === "DROPDOWN" || selectedType === "MULTI_SELECT") ? (
                                    <button
                                      type="button"
                                      className="h-10 rounded-xl border border-orange-200 bg-white px-3 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
                                      onClick={() => setGridOptionPopupCellKey(cellKey)}
                                    >
                                      إدارة خيارات القائمة
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
                </div>
                </div>
              </div>
              {gridOptionPopupCellKey ? (
                (() => {
                  const [rowKey = "", columnKey = ""] = gridOptionPopupCellKey.split(":");
                  const row = gridEditRows.find((item) => item.key === rowKey);
                  const column = gridEditColumns.find((item) => item.key === columnKey);
                  if (!row || !column) return null;
                  const fallbackLabel = `${row.label || "Row"} - ${column.label || "Column"}`;
                  const fallbackLabelAr = `${row.labelAr || "صف"} - ${column.labelAr || "عمود"}`;
                  const cellConfig = gridEditCellConfigs[gridOptionPopupCellKey] ?? {
                    type: "TEXT" as GridCellFieldType,
                    label: fallbackLabel,
                    labelAr: fallbackLabelAr,
                    options: []
                  };
                  return (
                    <div className="absolute inset-0 z-[2] flex items-center justify-center p-3 sm:p-6">
                      <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
                        onClick={() => setGridOptionPopupCellKey(null)}
                      />
                      <section className="relative flex max-h-[80vh] w-full max-w-3xl flex-col rounded-3xl border border-orange-200/70 bg-white p-4 shadow-2xl sm:max-h-[88vh]">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-lg font-semibold text-slate-800">خيارات الخلية</p>
                            <p className="text-sm text-slate-600">
                              {row.labelAr || row.label} × {column.labelAr || column.label}
                            </p>
                          </div>
                          <button
                            type="button"
                            className={dsModalCancelButtonClass}
                            onClick={() => setGridOptionPopupCellKey(null)}
                          >
                            إغلاق
                          </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto pe-1">
                          <div className="space-y-2">
                            {(cellConfig.options ?? []).map((option, optionIndex) => (
                              <div key={`grid-cell-option-popup-${gridOptionPopupCellKey}-${option.id ?? optionIndex}`} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                                <input
                                  value={option.value}
                                  onChange={(event) =>
                                    setGridEditCellConfigs((prev) => {
                                      const base = prev[gridOptionPopupCellKey] ?? cellConfig;
                                      const nextOptions = [...(base.options ?? [])];
                                      nextOptions[optionIndex] = { ...nextOptions[optionIndex], value: event.target.value };
                                      return { ...prev, [gridOptionPopupCellKey]: { ...base, options: nextOptions } };
                                    })
                                  }
                                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
                                  placeholder="value"
                                />
                                <input
                                  value={option.label}
                                  onChange={(event) =>
                                    setGridEditCellConfigs((prev) => {
                                      const base = prev[gridOptionPopupCellKey] ?? cellConfig;
                                      const nextOptions = [...(base.options ?? [])];
                                      nextOptions[optionIndex] = { ...nextOptions[optionIndex], label: event.target.value };
                                      return { ...prev, [gridOptionPopupCellKey]: { ...base, options: nextOptions } };
                                    })
                                  }
                                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
                                  placeholder="label"
                                />
                                <input
                                  value={option.labelAr}
                                  onChange={(event) =>
                                    setGridEditCellConfigs((prev) => {
                                      const base = prev[gridOptionPopupCellKey] ?? cellConfig;
                                      const nextOptions = [...(base.options ?? [])];
                                      nextOptions[optionIndex] = { ...nextOptions[optionIndex], labelAr: event.target.value };
                                      return { ...prev, [gridOptionPopupCellKey]: { ...base, options: nextOptions } };
                                    })
                                  }
                                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
                                  placeholder="الاسم العربي"
                                />
                                <button
                                  type="button"
                                  className="h-10 rounded-xl border border-rose-200 px-3 text-sm text-rose-600"
                                  onClick={() =>
                                    setGridEditCellConfigs((prev) => {
                                      const base = prev[gridOptionPopupCellKey] ?? cellConfig;
                                      const nextOptions = (base.options ?? []).filter((_, itemIndex) => itemIndex !== optionIndex);
                                      return { ...prev, [gridOptionPopupCellKey]: { ...base, options: nextOptions } };
                                    })
                                  }
                                >
                                  حذف
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700"
                            onClick={() =>
                              setGridEditCellConfigs((prev) => ({
                                ...prev,
                                [gridOptionPopupCellKey]: {
                                  ...(prev[gridOptionPopupCellKey] ?? cellConfig),
                                  options: [...((prev[gridOptionPopupCellKey] ?? cellConfig).options ?? []), { value: "", label: "", labelAr: "" }]
                                }
                              }))
                            }
                          >
                            + إضافة خيار
                          </button>
                        </div>
                      </section>
                    </div>
                  );
                })()
              ) : null}
              {saveGridEditMutation.isPending && (
                <div className="mt-3 overflow-hidden rounded-full bg-orange-100">
                  <div className="h-1.5 w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400" />
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-orange-200/70 bg-white/95 px-3 py-3 shadow-sm">
                <button
                  type="button"
                  className={dsModalCancelButtonClass}
                  onClick={closeGridEditDialog}
                  disabled={saveGridEditMutation.isPending}
                >
                  إلغاء
                </button>
                <RippleButton
                  type="button"
                  onClick={() => saveGridEditMutation.mutate()}
                  disabled={saveGridEditMutation.isPending || !gridEditColumns.length || !gridEditRows.length}
                >
                  {saveGridEditMutation.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                </RippleButton>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
        {gridDeleteTarget ? (
          <div className="fixed inset-0 z-[92] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="إغلاق نافذة حذف الـ Grid"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setGridDeleteTarget(null)}
              disabled={deleteGridMutation.isPending}
            />
            <section className="relative w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-orange-50 to-white p-5 shadow-premium">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">تأكيد حذف الـ Grid</p>
                  <p className="text-sm text-slate-600">
                    أنت على وشك حذف <span className="font-semibold text-slate-800">{gridDeleteTarget.nameAr}</span> بالكامل.
                  </p>
                  <p className="text-xs text-rose-700">سيتم حذف كل خلايا هذا الـ Grid نهائيًا.</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={dsModalCancelButtonClass}
                    onClick={() => setGridDeleteTarget(null)}
                    disabled={deleteGridMutation.isPending}
                  >
                    إلغاء
                  </button>
                  <RippleButton
                    type="button"
                    className="from-rose-600 to-red-500 hover:shadow-rose-500/30"
                    onClick={() => deleteGridMutation.mutate()}
                    disabled={deleteGridMutation.isPending}
                  >
                    {deleteGridMutation.isPending ? "جارٍ الحذف..." : "حذف الـ Grid"}
                  </RippleButton>
                </div>
              </div>
            </section>
          </div>
        ) : null}
        {sectionToDelete ? (
          <div className="fixed inset-0 z-[86] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="إغلاق نافذة حذف القسم"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setSectionToDeleteId(null)}
              disabled={deleteSectionMutation.isPending}
            />
            <section className="relative w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-orange-50 to-white p-5 shadow-premium">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">تأكيد حذف القسم</p>
                  <p className="text-sm text-slate-600">
                    أنت على وشك حذف القسم <span className="font-semibold text-slate-800">{sectionToDelete.nameAr}</span>.
                  </p>
                  <p className="text-xs text-rose-700">لن يتم الحذف إذا كان القسم يحتوي على حقول مرتبطة.</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={dsModalCancelButtonClass}
                    onClick={() => setSectionToDeleteId(null)}
                    disabled={deleteSectionMutation.isPending}
                  >
                    إلغاء
                  </button>
                  <RippleButton
                    type="button"
                    className="from-rose-600 to-red-500 hover:shadow-rose-500/30"
                    onClick={() => deleteSectionMutation.mutate(sectionToDelete.id)}
                    disabled={deleteSectionMutation.isPending}
                  >
                    {deleteSectionMutation.isPending ? "جارٍ الحذف..." : "حذف القسم"}
                  </RippleButton>
                </div>
              </div>
            </section>
          </div>
        ) : null}
        {previewTemplateForRender ? (
          <div className="fixed inset-0 z-[87] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label={t("specialties.templates.previewClose")}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setPreviewTemplate(null)}
            />
            <section className="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-premium">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t("specialties.templates.previewTitle")}</p>
                  <p className="text-sm text-slate-600">
                    الإصدار {previewTemplateForRender.version} - {previewTemplateForRender.titleAr || previewTemplateForRender.title}
                  </p>
                </div>
                <button
                  type="button"
                  className={dsModalCancelButtonClass}
                  onClick={() => setPreviewTemplate(null)}
                >
                  {t("specialties.templates.previewClose")}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pe-1">
                <SpecialtyAssessmentForm
                  template={previewTemplateForRender}
                  initialValues={{}}
                  onSubmit={async () => {}}
                  readOnly
                  hideSaveAction
                />
              </div>
            </section>
          </div>
        ) : null}
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
        {deleteRuleTarget ? (
          <div className="fixed inset-0 z-[81] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="إغلاق نافذة تأكيد حذف القاعدة"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setDeleteRuleTarget(null)}
              disabled={deleteRuleMutation.isPending}
            />
            <section className="relative w-full max-w-lg rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-orange-50 to-white p-5 shadow-premium">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">تأكيد حذف القاعدة</p>
                  <p className="text-sm text-slate-600">
                    أنت على وشك حذف القاعدة <span className="font-semibold text-slate-800">{deleteRuleTarget.nameAr || deleteRuleTarget.name || deleteRuleTarget.key}</span>.
                  </p>
                  <p className="text-xs text-rose-700">لا يمكن التراجع عن هذا الإجراء.</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={dsModalCancelButtonClass}
                    onClick={() => setDeleteRuleTarget(null)}
                    disabled={deleteRuleMutation.isPending}
                  >
                    إلغاء
                  </button>
                  <RippleButton
                    type="button"
                    className="from-rose-600 to-red-500 hover:shadow-rose-500/30"
                    onClick={() => deleteRuleMutation.mutate(deleteRuleTarget.id)}
                    disabled={deleteRuleMutation.isPending}
                  >
                    {deleteRuleMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}
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

function SpecialtiesTemplateRulesPage() {
  return <SpecialtiesTemplatesPage mode="rules" />;
}

export default function SpecialtiesLandingPage() {
  const pathname = usePathname();
  const { t } = useI18n();
  if (pathname === "/specialties/templates") {
    return <SpecialtiesTemplatesPage />;
  }
  if (pathname === "/specialties/rules") {
    return <SpecialtiesTemplateRulesPage />;
  }

  return (
    <RoleGate allowed={["SuperAdmin"]} fallback={<div className="card p-6 text-base text-slate-500">{t("common.notAllowed")}</div>}>
      <AppShell>
        <section className="space-y-4">
          <div className="card space-y-3 p-6">
            <h1 className="text-3xl font-semibold text-brand-navy">{t("nav.specialties")}</h1>
            <p className="text-base text-slate-600">{t("specialties.landing.subtitle")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/specialties/templates"
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                <FileStack size={18} />
              </div>
              <p className="text-lg font-semibold text-slate-800">{t("nav.specialtiesTemplates")}</p>
              <p className="mt-1 text-sm text-slate-600">{t("specialties.landing.templatesDescription")}</p>
            </Link>
            <Link
              href="/specialties/rules"
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Sparkles size={18} />
              </div>
              <p className="text-lg font-semibold text-slate-800">{t("nav.specialtiesRulesBuilder")}</p>
              <p className="mt-1 text-sm text-slate-600">{t("specialties.landing.rulesDescription")}</p>
            </Link>
            <Link
              href="/specialties/lookup"
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                <ClipboardList size={18} />
              </div>
              <p className="text-lg font-semibold text-slate-800">{t("nav.specialtiesLookup")}</p>
              <p className="mt-1 text-sm text-slate-600">{t("specialties.landing.lookupDescription")}</p>
            </Link>
          </div>
        </section>
      </AppShell>
    </RoleGate>
  );
}
