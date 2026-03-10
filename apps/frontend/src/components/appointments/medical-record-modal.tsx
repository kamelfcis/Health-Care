"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ClipboardList, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/providers/i18n-provider";
import { Modal } from "@/components/ui/modal";
import { SpecialtyAssessmentForm } from "@/components/forms/specialty-assessment-form";
import { appointmentService } from "@/lib/appointment-service";
import { patientService, PatientAssessmentHistoryItem } from "@/lib/patient-service";
import { specialtyService, SpecialtyTemplate } from "@/lib/specialty-service";

export interface AppointmentMedicalRecordContext {
  id: string;
}

export interface PatientMedicalRecordContext {
  id: string;
  name: string;
}

interface MedicalRecordModalProps {
  open: boolean;
  clinicScope?: string;
  onClose: () => void;
  mode: "appointment" | "patient";
  appointmentContext?: AppointmentMedicalRecordContext | null;
  patientContext?: PatientMedicalRecordContext | null;
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

const asArray = (value: unknown) => (Array.isArray(value) ? value : []);

const listFromUnknown = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return String(record.name ?? record.label ?? record.title ?? "");
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

interface PatientAssessmentExpanderProps {
  item: PatientAssessmentHistoryItem;
  expanded: boolean;
  onToggle: () => void;
  patientId?: string;
  clinicScope?: string;
  entryTypeLabel: (value: "EXAM" | "CONSULTATION") => string;
}

function PatientAssessmentExpander({
  item,
  expanded,
  onToggle,
  patientId,
  clinicScope,
  entryTypeLabel
}: PatientAssessmentExpanderProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const templateQuery = useQuery({
    queryKey: ["medical-record", "template", patientId ?? "none", item.id, item.specialty.code, clinicScope ?? "mine"],
    queryFn: () => specialtyService.getPatientSpecialtyTemplate(String(patientId), item.specialty.code, clinicScope),
    enabled: expanded && Boolean(patientId)
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      if (!patientId) {
        throw new Error("Missing patient context");
      }
      return specialtyService.savePatientSpecialtyAssessment(
        patientId,
        item.specialty.code,
        values,
        item.entryType,
        clinicScope,
        item.appointment?.id
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["medical-record", "patient", patientId, clinicScope ?? "mine"]
      });
      if (item.appointment?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["medical-record", "appointment", item.appointment.id, clinicScope ?? "mine"]
        });
      }
      toast.success(t("patients.assessment.saved"));
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        if (typeof message === "string" && message.trim()) {
          toast.error(message);
          return;
        }
      }
      toast.error(t("patients.assessment.saveFailed"));
    }
  });

  const diagnoses = asArray(item.diagnoses).map((diagnosis) =>
    String((diagnosis as Record<string, unknown>)?.nameAr ?? (diagnosis as Record<string, unknown>)?.name ?? "-")
  );
  const values = item.values ?? {};
  const medications = [...listFromUnknown(values.medication), ...listFromUnknown(values.medications)];
  const notes = String(values.notes ?? item.appointment?.notes ?? item.appointment?.reason ?? "").trim();
  const dateLabel = item.appointment?.startsAt ? formatDate(item.appointment.startsAt) : formatDate(item.updatedAt);
  const template = templateQuery.data?.template as SpecialtyTemplate | null | undefined;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white">
      <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={onToggle}>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {entryTypeLabel(item.entryType)} {dateLabel}
          </p>
          <p className="text-xs text-slate-500">{item.source === "legacy" ? t("appointments.medicalRecord.legacy") : item.appointment?.doctor.name ?? "-"}</p>
        </div>
        <ChevronDown size={16} className={`transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid overflow-hidden transition-all duration-300 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0">
          <div className="space-y-3 border-t border-slate-100 p-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-sm font-semibold text-slate-800">{t("patients.assessment.activeTemplate")}</p>
              {templateQuery.isLoading ? (
                <p className="text-sm text-slate-500">{t("appointments.medicalRecord.loadingTemplate")}</p>
              ) : templateQuery.isError ? (
                <p className="text-sm text-amber-700">
                  {templateQuery.error instanceof Error ? templateQuery.error.message : t("patients.assessment.templateUnavailable")}
                </p>
              ) : template ? (
                <SpecialtyAssessmentForm
                  key={`${item.id}-${item.updatedAt}`}
                  template={template}
                  initialValues={values}
                  isSubmitting={saveMutation.isPending}
                  onSubmit={async (nextValues) => {
                    await saveMutation.mutateAsync(nextValues);
                  }}
                />
              ) : (
                <p className="text-sm text-amber-700">{t("patients.assessment.templateUnavailable", { specialty: item.specialty.name })}</p>
              )}
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">{t("patients.assessment.diagnoses")}</p>
                {diagnoses.length ? (
                  <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-slate-600">
                    {diagnoses.map((diag, index) => (
                      <li key={`${item.id}-diag-${index}`}>{diag}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">-</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{t("appointments.medicalRecord.doctorNotes")}</p>
                <p className="mt-1 text-sm text-slate-600">{notes || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{t("appointments.medicalRecord.medications")}</p>
                {medications.length ? (
                  <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-slate-600">
                    {medications.map((med, index) => (
                      <li key={`${item.id}-med-${index}`}>{med}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">-</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{t("appointments.medicalRecord.doctor")}</p>
                <p className="mt-1 text-sm text-slate-600">{item.appointment?.doctor.name ?? "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MedicalRecordModal({
  open,
  clinicScope,
  onClose,
  mode,
  appointmentContext,
  patientContext
}: MedicalRecordModalProps) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const appointmentAssessmentQuery = useQuery({
    queryKey: ["medical-record", "appointment", appointmentContext?.id, clinicScope ?? "mine"],
    queryFn: () => appointmentService.getAssessment(String(appointmentContext?.id), clinicScope),
    enabled: open && mode === "appointment" && Boolean(appointmentContext?.id)
  });

  const patientAssessmentsQuery = useQuery({
    queryKey: ["medical-record", "patient", patientContext?.id, clinicScope ?? "mine"],
    queryFn: () => patientService.listAssessments(String(patientContext?.id), clinicScope),
    enabled: open && mode === "patient" && Boolean(patientContext?.id)
  });

  const saveAppointmentAssessmentMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = appointmentAssessmentQuery.data;
      if (!payload?.appointment?.patient?.id || !payload.specialty?.code || !payload.appointment?.id) {
        throw new Error("Missing appointment assessment context");
      }
      return specialtyService.savePatientSpecialtyAssessment(
        payload.appointment.patient.id,
        payload.specialty.code,
        values,
        payload.appointment.entryType,
        clinicScope,
        payload.appointment.id
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["medical-record", "appointment", appointmentContext?.id, clinicScope ?? "mine"]
      });
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success(t("patients.assessment.saved"));
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        if (typeof message === "string" && message.trim()) {
          toast.error(message);
          return;
        }
      }
      toast.error(t("patients.assessment.saveFailed"));
    }
  });

  const appointmentHeader = useMemo(() => {
    if (!appointmentAssessmentQuery.data?.appointment?.startsAt) return t("appointments.medicalRecord.single");
    return t("appointments.medicalRecord.singleWithDate", {
      date: formatDate(appointmentAssessmentQuery.data.appointment.startsAt)
    });
  }, [appointmentAssessmentQuery.data?.appointment?.startsAt, t]);

  const entryTypeLabel = (value: "EXAM" | "CONSULTATION") =>
    value === "CONSULTATION" ? t("appointments.entryType.consultation") : t("appointments.entryType.exam");

  const renderAppointmentMode = () => {
    if (appointmentAssessmentQuery.isLoading) {
      return (
        <div className="space-y-3">
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      );
    }
    if (appointmentAssessmentQuery.isError) {
      const message =
        appointmentAssessmentQuery.error instanceof Error ? appointmentAssessmentQuery.error.message : t("appointments.medicalRecord.noAppointmentData");
      return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-sm font-medium text-amber-800">{message}</p>
        </section>
      );
    }

    const payload = appointmentAssessmentQuery.data;
    if (!payload) {
      return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-sm font-medium text-amber-800">{t("appointments.medicalRecord.noAppointmentData")}</p>
        </section>
      );
    }

    const values = (payload.assessment?.values as Record<string, unknown> | undefined) ?? {};
    const diagnosesFromRules = asArray(payload.assessment?.diagnoses).map((item) =>
      String((item as Record<string, unknown>)?.nameAr ?? (item as Record<string, unknown>)?.name ?? "-")
    );
    const diagnoses = [
      ...diagnosesFromRules,
      ...listFromUnknown(values.systemDiagnosisAuto),
      ...listFromUnknown(values.diagnosis),
      ...listFromUnknown(values.diagnoses)
    ];
    const medications = [...listFromUnknown(values.medication), ...listFromUnknown(values.medications)];
    const attachments = listFromUnknown(values.attachments);
    const doctorName = `${payload.appointment.doctor?.user?.firstName ?? ""} ${payload.appointment.doctor?.user?.lastName ?? ""}`.trim();
    const doctorNotes = String(values.notes ?? payload.appointment.notes ?? payload.appointment.reason ?? "").trim();
    const template = payload.template as SpecialtyTemplate | null;
    const appointmentSpecialtyLabel = locale === "ar" ? payload.specialty?.nameAr ?? "-" : payload.specialty?.name ?? "-";

    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
          <p className="text-base font-semibold text-slate-900">{appointmentHeader}</p>
          <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <p className="inline-flex items-center gap-1.5">
              <CalendarDays size={15} className="text-orange-600" />
              {formatDate(payload.appointment.startsAt)}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Stethoscope size={15} className="text-cyan-700" />
              {doctorName || "-"}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <UserRound size={15} className="text-violet-700" />
              {payload.appointment.patient?.fullName ?? "-"}
            </p>
            <p className="text-slate-700">
              {t("appointments.medicalRecord.specialty")}:{" "}
              <span className="font-semibold">{appointmentSpecialtyLabel}</span>
            </p>
            <p className="text-slate-700">
              {t("appointments.medicalFile.entryType")}:{" "}
              <span className="font-semibold">{entryTypeLabel(payload.appointment.entryType)}</span>
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">{t("appointments.medicalRecord.doctorNotes")}</p>
            <p className="mt-2 text-sm text-slate-600">{doctorNotes || "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">{t("patients.assessment.diagnoses")}</p>
            {diagnoses.length ? (
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-600">
                {diagnoses.map((item, index) => (
                  <li key={`diag-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">-</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">{t("appointments.medicalRecord.medications")}</p>
            {medications.length ? (
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-600">
                {medications.map((item, index) => (
                  <li key={`med-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">-</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">{t("appointments.medicalRecord.attachments")}</p>
            {attachments.length ? (
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-600">
                {attachments.map((item, index) => (
                  <li key={`att-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">-</p>
            )}
          </div>
        </section>

        {template ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">{t("patients.assessment.activeTemplate")}</p>
            <SpecialtyAssessmentForm
              key={`${payload.appointment.id}-${payload.assessment?.updatedAt ?? "new"}`}
              template={template}
              initialValues={values}
              isSubmitting={saveAppointmentAssessmentMutation.isPending}
              onSubmit={async (nextValues) => {
                await saveAppointmentAssessmentMutation.mutateAsync(nextValues);
              }}
            />
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
            <p className="text-sm font-medium text-amber-800">
              {payload.specialty ? t("appointments.medicalRecord.noTemplateForAppointmentSpecialty") : t("appointments.medicalRecord.noSpecialtyAssigned")}
            </p>
          </section>
        )}
      </div>
    );
  };

  const renderPatientMode = () => {
    if (patientAssessmentsQuery.isLoading) {
      return (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      );
    }

    const history = patientAssessmentsQuery.data?.assessments ?? [];
    if (!history.length) {
      return <p className="text-sm text-slate-500">{t("appointments.medicalRecord.noHistory")}</p>;
    }

    return (
      <div className="space-y-3">
        <p className="text-base font-semibold text-slate-900">{t("appointments.medicalRecord.historyTitle")}</p>
        {history.map((item) => {
          return (
            <PatientAssessmentExpander
              key={item.id}
              item={item}
              expanded={expandedHistoryId === item.id}
              onToggle={() => setExpandedHistoryId((prev) => (prev === item.id ? null : item.id))}
              patientId={patientContext?.id}
              clinicScope={clinicScope}
              entryTypeLabel={entryTypeLabel}
            />
          );
        })}
      </div>
    );
  };

  const title =
    mode === "appointment"
      ? t("appointments.medicalFile.title")
      : `${t("appointments.medicalFile.title")} - ${patientContext?.name ?? ""}`.trim();

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      maxWidthClass="max-w-[96vw] xl:max-w-[1400px]"
      bodyClassName="max-h-[82vh] overflow-y-auto"
    >
      <div className="space-y-4">
        {mode === "appointment" ? renderAppointmentMode() : renderPatientMode()}
        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
          >
            <ClipboardList size={14} />
            {t("common.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
