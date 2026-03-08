"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";
import type { SpecialtyTemplate } from "@/lib/specialty-service";

interface SpecialtyAssessmentFormProps {
  template: SpecialtyTemplate;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
  isSubmitting?: boolean;
  submitLabel?: string;
  hideSubmitActions?: boolean;
  hideSaveAction?: boolean;
  readOnly?: boolean;
}

type Values = Record<string, unknown>;
type SectionField = SpecialtyTemplate["fields"][number];

type GridRow = {
  id: string;
  label: string;
  cells: Record<string, SectionField | undefined>;
};

type DynamicGridColumn = {
  key: string;
  label: string;
  labelAr: string;
  order: number;
};

const isVisible = (field: SectionField, values: Values) => {
  const condition = field.visibleWhen as { field?: string; equals?: unknown } | null | undefined;
  if (!condition?.field) return true;
  return values[condition.field] === condition.equals;
};

const getFieldSide = (field: SectionField): "right" | "left" | null => {
  const meta = (field.metadata as { side?: unknown } | null | undefined)?.side;
  if (meta === "right" || meta === "left") return meta;
  if (/^right/i.test(field.key)) return "right";
  if (/^left/i.test(field.key)) return "left";
  return null;
};

const getGridRowKey = (field: SectionField) => {
  const metaRow = (field.metadata as { row?: unknown } | null | undefined)?.row;
  if (typeof metaRow === "string" && metaRow.trim()) return metaRow.trim().toLowerCase();
  return field.key.replace(/^right/i, "").replace(/^left/i, "").trim().toLowerCase();
};

const cleanGridRowLabel = (field: SectionField, locale: "ar" | "en") => {
  const source = locale === "ar" ? field.labelAr : field.label;
  return source
    .replace(/\bRight\b/gi, "")
    .replace(/\bLeft\b/gi, "")
    .replace(/يمين/g, "")
    .replace(/شمال/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const getGridMetadata = (field: SectionField) => {
  const grid = (field.metadata as { grid?: unknown } | null | undefined)?.grid;
  if (!grid || typeof grid !== "object") return null;
  const candidate = grid as { rowKey?: unknown; columns?: unknown };
  if (!Array.isArray(candidate.columns)) return null;
  const columns = candidate.columns
    .map((column, index) => {
      if (!column || typeof column !== "object") return null;
      const item = column as { key?: unknown; label?: unknown; labelAr?: unknown; order?: unknown };
      if (typeof item.key !== "string" || !item.key.trim()) return null;
      return {
        key: item.key.trim(),
        label: typeof item.label === "string" ? item.label : item.key.trim(),
        labelAr: typeof item.labelAr === "string" ? item.labelAr : item.key.trim(),
        order: typeof item.order === "number" ? item.order : index + 1
      };
    })
    .filter((column): column is DynamicGridColumn => Boolean(column))
    .sort((a, b) => a.order - b.order);
  if (!columns.length) return null;
  return {
    rowKey: typeof candidate.rowKey === "string" ? candidate.rowKey.trim() : "",
    columns
  };
};

const getFieldColumnKey = (field: SectionField) => {
  const fromMeta = (field.metadata as { columnKey?: unknown } | null | undefined)?.columnKey;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  return getFieldSide(field) ?? "value";
};

export function SpecialtyAssessmentForm({
  template,
  initialValues,
  onSubmit,
  isSubmitting,
  submitLabel,
  hideSubmitActions,
  hideSaveAction,
  readOnly
}: SpecialtyAssessmentFormProps) {
  const { locale, t } = useI18n();
  const { register, handleSubmit, setValue, watch } = useForm<Values>({
    defaultValues: initialValues ?? {}
  });

  const values = watch();
  const groupedSections = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        fields: SpecialtyTemplate["fields"];
      }
    >();

    for (const field of template.fields) {
      const id = field.section;
      const title = locale === "ar" ? field.sectionAr : field.section;
      const existing = map.get(id);
      if (!existing) {
        map.set(id, { id, title, fields: [field] });
      } else {
        existing.fields.push(field);
      }
    }

    return Array.from(map.values());
  }, [template.fields, locale]);
  const [activeSectionId, setActiveSectionId] = useState<string>("");

  useEffect(() => {
    if (!groupedSections.length) {
      setActiveSectionId("");
      return;
    }

    const exists = groupedSections.some((section) => section.id === activeSectionId);
    if (!exists) {
      setActiveSectionId(groupedSections[0].id);
    }
  }, [groupedSections, activeSectionId]);

  const activeSection = groupedSections.find((section) => section.id === activeSectionId) ?? groupedSections[0];
  const activeIndex = groupedSections.findIndex((section) => section.id === activeSection?.id);
  const activeSectionVisibleFields = useMemo(
    () => (activeSection?.fields.filter((field) => isVisible(field, values)) ?? []),
    [activeSection, values]
  );
  const dynamicGridColumns = useMemo(() => {
    const firstWithGrid = activeSectionVisibleFields.find((field) => Boolean(getGridMetadata(field)));
    return firstWithGrid ? (getGridMetadata(firstWithGrid)?.columns ?? []) : [];
  }, [activeSectionVisibleFields]);
  const gridRows = useMemo(() => {
    const rowsMap = new Map<string, GridRow>();
    const unpairedRows: GridRow[] = [];
    const useDynamicGrid = dynamicGridColumns.length > 0;

    activeSectionVisibleFields.forEach((field, index) => {
      if (useDynamicGrid) {
        const rowKey = getGridRowKey(field);
        const existing = rowsMap.get(rowKey);
        const cellKey = getFieldColumnKey(field);
        if (!existing) {
          rowsMap.set(rowKey, {
            id: rowKey || `row-${field.id}-${index}`,
            label: cleanGridRowLabel(field, locale),
            cells: { [cellKey]: field }
          });
          return;
        }
        existing.cells[cellKey] = field;
        if (!existing.label) existing.label = cleanGridRowLabel(field, locale);
        return;
      }

      const side = getFieldSide(field);
      if (!side) {
        unpairedRows.push({
          id: `single-${field.id}-${index}`,
          label: locale === "ar" ? field.labelAr : field.label,
          cells: { right: field }
        });
        return;
      }

      const rowKey = getGridRowKey(field);
      const existing = rowsMap.get(rowKey);
      if (!existing) {
        rowsMap.set(rowKey, {
          id: rowKey || `row-${field.id}-${index}`,
          label: cleanGridRowLabel(field, locale),
          cells: {
            right: side === "right" ? field : undefined,
            left: side === "left" ? field : undefined
          }
        });
        return;
      }

      if (side === "right") existing.cells.right = field;
      if (side === "left") existing.cells.left = field;
      if (!existing.label) existing.label = cleanGridRowLabel(field, locale);
    });

    return [...Array.from(rowsMap.values()), ...unpairedRows];
  }, [activeSectionVisibleFields, dynamicGridColumns.length, locale]);
  const useGridTable =
    activeSectionVisibleFields.some((field) => field.fieldType === "GRID") ||
    activeSectionVisibleFields.some((field) => getFieldSide(field) !== null) ||
    dynamicGridColumns.length > 0;
  const gridColumnsToRender = useMemo(
    () =>
      dynamicGridColumns.length
        ? dynamicGridColumns
        : [
            { key: "right", label: "Right", labelAr: "يمين", order: 1 },
            { key: "left", label: "Left", labelAr: "شمال", order: 2 }
          ],
    [dynamicGridColumns]
  );
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < groupedSections.length - 1;
  const goPrev = () => {
    if (!hasPrev) return;
    const prevSection = groupedSections[activeIndex - 1];
    if (!prevSection) return;
    setActiveSectionId(prevSection.id);
  };

  const goNext = () => {
    if (!hasNext) return;
    const nextSection = groupedSections[activeIndex + 1];
    if (!nextSection) return;
    setActiveSectionId(nextSection.id);
  };

  const renderFieldControl = (field: SectionField, compact = false) => {
    const label = locale === "ar" ? field.labelAr : field.label;
    const help = locale === "ar" ? field.helpTextAr : field.helpText;
    const inputClass = compact
      ? "h-10 w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      : "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-500";

    if (field.fieldType === "AUTO") {
      return (
        <div className="space-y-1">
          <label className={compact ? "text-sm font-semibold text-slate-700" : "text-sm font-medium text-slate-600"}>
            {label}
          </label>
          <input
            value={String(values[field.key] ?? "")}
            readOnly
            className={compact ? "h-10 w-full rounded-xl border border-slate-300/80 bg-slate-50 px-3 text-sm font-medium text-slate-700" : "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"}
          />
        </div>
      );
    }

    if (field.fieldType === "YES_NO") {
      return (
        <div className="space-y-1">
          <label className={compact ? "text-sm font-semibold text-slate-700" : "text-sm font-medium text-slate-600"}>
            {label}
          </label>
          <select {...register(field.key)} className={inputClass}>
            <option value="">-</option>
            <option value="YES">{locale === "ar" ? "نعم" : "Yes"}</option>
            <option value="NO">{locale === "ar" ? "لا" : "No"}</option>
          </select>
          {help ? <p className="text-[11px] text-slate-500">{help}</p> : null}
        </div>
      );
    }

    if (field.fieldType === "DROPDOWN") {
      return (
        <div className="space-y-1">
          <label className={compact ? "text-sm font-semibold text-slate-700" : "text-sm font-medium text-slate-600"}>
            {label}
          </label>
          <select {...register(field.key)} className={inputClass}>
            <option value="">-</option>
            {field.options.map((option) => (
              <option key={option.id} value={option.value}>
                {locale === "ar" ? option.labelAr : option.label}
              </option>
            ))}
          </select>
          {help ? <p className="text-[11px] text-slate-500">{help}</p> : null}
        </div>
      );
    }

    if (field.fieldType === "MULTI_SELECT") {
      const selected = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : [];
      return (
        <div className="space-y-2">
          <label className={compact ? "text-sm font-semibold text-slate-700" : "text-sm font-medium text-slate-600"}>
            {label}
          </label>
          <div className={compact ? "grid gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/40 p-2.5" : "grid gap-1 rounded-xl border border-slate-200 bg-white p-2"}>
            {field.options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <label key={option.id} className={compact ? "flex items-center gap-2 text-sm text-slate-700" : "flex items-center gap-2 text-sm text-slate-700"}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value);
                      setValue(field.key, next);
                    }}
                  />
                  <span>{locale === "ar" ? option.labelAr : option.label}</span>
                </label>
              );
            })}
          </div>
          {help ? <p className="text-[11px] text-slate-500">{help}</p> : null}
        </div>
      );
    }

    const type = field.fieldType === "DATE" ? "date" : field.fieldType === "NUMBER" ? "number" : "text";
    return (
      <div className="space-y-1">
        <label className={compact ? "text-sm font-semibold text-slate-700" : "text-sm font-medium text-slate-600"}>
          {label}
        </label>
        <input
          type={type}
          step={type === "number" ? "any" : undefined}
          {...register(field.key)}
          className={inputClass}
        />
        {help ? <p className="text-[11px] text-slate-500">{help}</p> : null}
      </div>
    );
  };

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (submittedValues) => {
        if (readOnly) return;
        await onSubmit(submittedValues);
      })}
    >
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/85 p-2">
        <div className="flex min-w-max gap-2">
          {groupedSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={
                section.id === activeSectionId
                  ? "rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                  : "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
              }
              onClick={() => setActiveSectionId(section.id)}
              disabled={Boolean(isSubmitting)}
            >
              {section.title}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2">
        <p className="text-sm font-medium text-slate-600">
          {locale === "ar" ? "التقدم" : "Progress"}: {activeIndex >= 0 ? activeIndex + 1 : 0} / {groupedSections.length}
        </p>
      </div>

      {activeSection ? (
        <section key={activeSection.id} className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
          <h4 className="text-sm font-semibold text-slate-800">{activeSection.title}</h4>
          {useGridTable ? (
            <div className="overflow-x-auto rounded-2xl border-2 border-slate-300 bg-gradient-to-b from-white to-slate-50/70 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
              <table className="min-w-full border-separate border-spacing-0 text-right text-sm">
                <thead className="bg-gradient-to-r from-orange-600 to-orange-500">
                  <tr>
                    {gridColumnsToRender.map((column) => (
                      <th
                        key={column.key}
                        className="border-x-2 border-b-2 border-orange-300/70 px-4 py-3 align-middle text-center text-base font-semibold text-white"
                      >
                        {locale === "ar" ? column.labelAr : column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row) => (
                    <tr key={row.id} className="align-middle transition-colors even:bg-slate-50/60 hover:bg-orange-50/40">
                      {gridColumnsToRender.map((column) => (
                        <td key={`${row.id}-${column.key}`} className="border-x-2 border-b-2 border-slate-200 px-4 py-3">
                          {row.cells[column.key] ? renderFieldControl(row.cells[column.key]!, true) : <span className="text-sm text-slate-400">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activeSectionVisibleFields.map((field) => (
                <div key={field.id}>{renderFieldControl(field)}</div>
              ))}
            </div>
          )}
        </section>
      ) : null}
      {!hideSubmitActions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-orange-200/80 bg-gradient-to-b from-white to-orange-50 px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              onClick={goPrev}
              disabled={!hasPrev || Boolean(isSubmitting)}
            >
              {locale === "ar" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              {locale === "ar" ? "السابق" : "Previous"}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-orange-200/80 bg-gradient-to-b from-white to-orange-50 px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              onClick={goNext}
              disabled={!hasNext || Boolean(isSubmitting)}
            >
              {locale === "ar" ? "التالي" : "Next"}
              {locale === "ar" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          {!hideSaveAction ? (
            <RippleButton type="submit" disabled={Boolean(isSubmitting) || Boolean(readOnly)}>
              {isSubmitting ? t("patients.assessment.saving") : submitLabel ?? t("patients.assessment.save")}
            </RippleButton>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
