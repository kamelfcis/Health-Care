"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/providers/i18n-provider";
import { SpecialtyAssessmentForm } from "@/components/forms/specialty-assessment-form";
import { RippleButton } from "@/components/ui/ripple-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClinicSpecialtyItem,
  SpecialtyTemplate,
  specialtyService
} from "@/lib/specialty-service";

const CLINIC_SPECIALTIES_QUERY_KEY = ["specialties", "clinic", "me"] as const;

function templateLabel(template: Pick<SpecialtyTemplate, "version" | "title" | "titleAr" | "isActive">, locale: string) {
  const title = locale === "ar" ? template.titleAr || template.title : template.title || template.titleAr;
  const activeSuffix = template.isActive ? "" : " (inactive)";
  return `v${template.version} - ${title}${activeSuffix}`;
}

function ClinicSpecialtyTemplateRow({
  item,
  onPreview
}: {
  item: ClinicSpecialtyItem;
  onPreview: (template: SpecialtyTemplate) => void;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const code = item.specialty.code;

  const templatesQuery = useQuery({
    queryKey: ["specialties", "clinic", "me", "templates", code],
    queryFn: () => specialtyService.listMyClinicTemplatesByCode(code)
  });

  const templates = templatesQuery.data?.templates ?? [];
  const [selectedTemplateId, setSelectedTemplateId] = useState(item.templateId ?? "");

  useEffect(() => {
    setSelectedTemplateId(item.templateId ?? "");
  }, [item.templateId]);

  const assignMutation = useMutation({
    mutationFn: () => specialtyService.assignMyClinicSpecialtyTemplate(item.id, selectedTemplateId),
    onSuccess: () => {
      toast.success(t("settings.specialties.assignSuccess"));
      void queryClient.invalidateQueries({ queryKey: CLINIC_SPECIALTIES_QUERY_KEY });
    },
    onError: () => toast.error(t("settings.specialties.assignFailed"))
  });

  const selectedTemplate = templates.find((tpl) => tpl.id === selectedTemplateId);
  const canAssign = Boolean(selectedTemplateId && selectedTemplate?.isActive && selectedTemplateId !== item.templateId);

  const specialtyName = locale === "ar" ? item.specialty.nameAr : item.specialty.name;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/70">
      <p className="font-semibold text-slate-900 dark:text-slate-100">{specialtyName}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {t("settings.specialties.currentTemplate")}:{" "}
        <span className="font-medium text-slate-800 dark:text-slate-200">
          {item.template
            ? templateLabel(item.template, locale)
            : t("settings.specialties.notAssigned")}
        </span>
      </p>

      {templatesQuery.isLoading ? (
        <Skeleton className="mt-3 h-10 w-full rounded-xl" />
      ) : templates.length === 0 ? (
        <p className="mt-2 text-sm text-amber-700">{t("settings.specialties.noTemplates")}</p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="" disabled>
              {t("settings.specialties.selectTemplate")}
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id} disabled={!template.isActive && template.id !== item.templateId}>
                {templateLabel(template, locale)}
              </option>
            ))}
          </select>
          <RippleButton
            type="button"
            className="h-10 text-sm"
            disabled={!selectedTemplateId}
            onClick={() => {
              const tpl = templates.find((t) => t.id === selectedTemplateId);
              if (tpl) onPreview(tpl);
            }}
          >
            <Eye className="me-1 inline h-4 w-4" />
            {t("settings.specialties.preview")}
          </RippleButton>
          <RippleButton
            type="button"
            className="h-10 text-sm"
            disabled={!canAssign || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            {assignMutation.isPending ? t("settings.specialties.assigning") : t("settings.specialties.assign")}
          </RippleButton>
        </div>
      )}
    </div>
  );
}

export function ClinicSpecialtiesSettings() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<SpecialtyTemplate | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["specialties", "catalog"],
    queryFn: () => specialtyService.listCatalog()
  });

  const clinicSpecialtiesQuery = useQuery({
    queryKey: CLINIC_SPECIALTIES_QUERY_KEY,
    queryFn: () => specialtyService.listMyClinicSpecialties()
  });

  useEffect(() => {
    if (clinicSpecialtiesQuery.data) {
      setSelectedCodes(clinicSpecialtiesQuery.data.map((row) => row.specialty.code));
    }
  }, [clinicSpecialtiesQuery.data]);

  const activeCatalog = useMemo(
    () => (catalogQuery.data ?? []).filter((item) => item.isActive),
    [catalogQuery.data]
  );

  const saveSpecialtiesMutation = useMutation({
    mutationFn: () => specialtyService.replaceMyClinicSpecialties(selectedCodes),
    onSuccess: () => {
      toast.success(t("settings.specialties.saved"));
      void queryClient.invalidateQueries({ queryKey: CLINIC_SPECIALTIES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["specialties", "clinic"] });
    },
    onError: () => toast.error(t("settings.specialties.saveFailed"))
  });

  const previewTemplateForRender = useMemo(() => {
    if (!previewTemplate) return null;
    const sectionOrder = new Map(
      (previewTemplate.sections ?? []).map((section, index) => [section.id, section.displayOrder ?? index + 1])
    );
    const orderedFields = [...previewTemplate.fields].sort((a, b) => {
      const sectionA = a.sectionId ? sectionOrder.get(a.sectionId) ?? 999 : 999;
      const sectionB = b.sectionId ? sectionOrder.get(b.sectionId) ?? 999 : 999;
      if (sectionA !== sectionB) return sectionA - sectionB;
      return a.displayOrder - b.displayOrder;
    });
    return { ...previewTemplate, fields: orderedFields };
  }, [previewTemplate]);

  return (
    <>
      <div className="card mt-6 p-6 dark:border-slate-800 dark:bg-slate-900/90">
        <h2 className="text-xl font-semibold text-brand-navy dark:text-slate-100">{t("settings.specialties.title")}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("settings.specialties.body")}</p>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t("auth.clinicSpecialties")}</p>
          {catalogQuery.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700 dark:bg-slate-800/50">
              {activeCatalog.map((specialty) => {
                const checked = selectedCodes.includes(specialty.code);
                const label = locale === "ar" ? specialty.nameAr : specialty.name;
                return (
                  <label
                    key={specialty.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...selectedCodes, specialty.code]
                          : selectedCodes.filter((code) => code !== specialty.code);
                        setSelectedCodes(next);
                      }}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <RippleButton
          type="button"
          className="mt-4 h-11"
          disabled={!selectedCodes.length || saveSpecialtiesMutation.isPending}
          onClick={() => saveSpecialtiesMutation.mutate()}
        >
          {saveSpecialtiesMutation.isPending ? t("settings.specialties.saving") : t("settings.specialties.save")}
        </RippleButton>

        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t("settings.specialties.templatesSection")}</p>
          {clinicSpecialtiesQuery.isLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : (clinicSpecialtiesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">{t("settings.specialties.noneEnabled")}</p>
          ) : (
            (clinicSpecialtiesQuery.data ?? []).map((item) => (
              <ClinicSpecialtyTemplateRow key={item.id} item={item} onPreview={setPreviewTemplate} />
            ))
          )}
        </div>
      </div>

      {previewTemplateForRender ? (
        <div className="fixed inset-0 z-[87] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("specialties.templates.previewClose")}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setPreviewTemplate(null)}
          />
          <section className="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("specialties.templates.previewTitle")}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {templateLabel(previewTemplateForRender, locale)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
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
    </>
  );
}
