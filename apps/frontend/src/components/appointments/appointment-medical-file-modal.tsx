"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Clock3, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/providers/i18n-provider";
import { SpecialtyAssessmentForm } from "@/components/forms/specialty-assessment-form";
import { Modal } from "@/components/ui/modal";
import { specialtyService, VisitEntryType } from "@/lib/specialty-service";
import { storage } from "@/lib/storage";

export interface AppointmentMedicalFilePatient {
  id: string;
  name: string;
  fileNumber?: number | null;
  nationalId?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  profession?: string | null;
  leadSource?: string | null;
  address?: string | null;
}

export interface AppointmentMedicalFileContext {
  id: string;
  doctorName: string;
  status: string;
  startsAtIso: string;
  entryType: VisitEntryType;
  reason?: string;
  notes?: string;
  patient: AppointmentMedicalFilePatient;
}

interface AppointmentMedicalFileModalProps {
  open: boolean;
  appointment: AppointmentMedicalFileContext | null;
  clinicScope?: string;
  onClose: () => void;
}

const STORAGE_SPECIALTY_KEY = "appointments_medical_file_specialty";

export function AppointmentMedicalFileModal({ open, appointment, clinicScope, onClose }: AppointmentMedicalFileModalProps) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [selectedSpecialtyCode, setSelectedSpecialtyCode] = useState("");
  const [selectedEntryType, setSelectedEntryType] = useState<VisitEntryType>("EXAM");
  const canLoad = open && Boolean(appointment);
  const isSuperAdmin = storage.getUser()?.role === "SuperAdmin";
  const clinicSpecialtiesQueryReady = !isSuperAdmin || Boolean(clinicScope);

  useEffect(() => {
    if (!appointment) return;
    setSelectedEntryType(appointment.entryType);
  }, [appointment]);

  const clinicSpecialtiesQuery = useQuery({
    queryKey: ["appointments", "medical-file", "specialties", clinicScope ?? "mine"],
    queryFn: () => specialtyService.listMyClinicSpecialties(clinicScope),
    enabled: canLoad && clinicSpecialtiesQueryReady
  });

  const enabledSpecialties = useMemo(
    () => (clinicSpecialtiesQuery.data ?? []).filter((item) => item.specialty?.isActive),
    [clinicSpecialtiesQuery.data]
  );

  useEffect(() => {
    if (!enabledSpecialties.length) {
      setSelectedSpecialtyCode("");
      return;
    }
    const cached = window.localStorage.getItem(STORAGE_SPECIALTY_KEY);
    const matched = enabledSpecialties.find((item) => item.specialty.code === cached);
    const nextCode = matched?.specialty.code ?? enabledSpecialties[0].specialty.code;
    setSelectedSpecialtyCode(nextCode);
  }, [enabledSpecialties]);

  const specialtyTemplateQuery = useQuery({
    queryKey: [
      "appointments",
      "medical-file",
      "template",
      selectedSpecialtyCode,
      appointment?.patient.id,
      clinicScope ?? "mine"
    ],
    queryFn: () =>
      specialtyService.getPatientSpecialtyTemplate(String(appointment?.patient.id), selectedSpecialtyCode, clinicScope),
    enabled: canLoad && Boolean(selectedSpecialtyCode) && Boolean(appointment?.patient.id)
  });

  const specialtyAssessmentQuery = useQuery({
    queryKey: [
      "appointments",
      "medical-file",
      "assessment",
      selectedSpecialtyCode,
      selectedEntryType,
      appointment?.patient.id,
      clinicScope ?? "mine"
    ],
    queryFn: () =>
      specialtyService.getPatientSpecialtyAssessment(
        String(appointment?.patient.id),
        selectedSpecialtyCode,
        selectedEntryType,
        clinicScope
      ),
    enabled: canLoad && Boolean(selectedSpecialtyCode) && Boolean(appointment?.patient.id)
  });

  const saveAssessmentMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      if (!appointment || !selectedSpecialtyCode) {
        throw new Error("Missing appointment context");
      }
      return specialtyService.savePatientSpecialtyAssessment(
        appointment.patient.id,
        selectedSpecialtyCode,
        values,
        selectedEntryType,
        clinicScope
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "appointments",
            "medical-file",
            "assessment",
            selectedSpecialtyCode,
            selectedEntryType,
            appointment?.patient.id,
            clinicScope ?? "mine"
          ]
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "patients",
            "specialty",
            selectedSpecialtyCode,
            "assessment",
            selectedEntryType,
            appointment?.patient.id,
            clinicScope ?? "mine"
          ]
        })
      ]);
      toast.success(t("patients.assessment.saved"));
    },
    onError: () => toast.error(t("patients.assessment.saveFailed"))
  });

  const entryTypeLabel =
    selectedEntryType === "EXAM" ? t("appointments.entryType.exam") : t("appointments.entryType.consultation");
  const appointmentStatusLabel = appointment
    ? (() => {
        const key = `status.${appointment.status}`;
        const translated = t(key);
        return translated === key ? appointment.status : translated;
      })()
    : "-";

  const formattedDate = appointment ? new Date(appointment.startsAtIso) : null;
  const dateLabel = formattedDate ? formattedDate.toLocaleDateString() : "-";
  const timeLabel = formattedDate ? formattedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
  const title = appointment
    ? `${t("appointments.medicalFile.title")} - ${appointment.patient.name}`
    : t("appointments.medicalFile.title");

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      maxWidthClass="max-w-[96vw] xl:max-w-[1600px]"
      bodyClassName="max-h-[82vh] overflow-y-auto"
    >
      {!appointment ? null : (
        <div className="space-y-4 md:[direction:ltr]">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
            <section className="space-y-4 md:[direction:rtl]">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">{t("patients.assessment.specialty")}</label>
                    <select
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      value={selectedSpecialtyCode}
                      onChange={(event) => {
                        const code = event.target.value;
                        setSelectedSpecialtyCode(code);
                        window.localStorage.setItem(STORAGE_SPECIALTY_KEY, code);
                      }}
                      disabled={!enabledSpecialties.length || saveAssessmentMutation.isPending}
                    >
                      {enabledSpecialties.map((item) => (
                        <option key={item.specialty.id} value={item.specialty.code}>
                          {locale === "ar" ? item.specialty.nameAr : item.specialty.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">{t("patients.assessment.entryType")}</label>
                    <select
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      value={selectedEntryType}
                      onChange={(event) => setSelectedEntryType(event.target.value as VisitEntryType)}
                      disabled={saveAssessmentMutation.isPending}
                    >
                      <option value="EXAM">{t("appointments.entryType.exam")}</option>
                      <option value="CONSULTATION">{t("appointments.entryType.consultation")}</option>
                    </select>
                  </div>
                </div>

                {!enabledSpecialties.length ? (
                  <p className="text-sm text-rose-600">{t("patients.assessment.noSpecialtiesEnabled")}</p>
                ) : clinicSpecialtiesQuery.isLoading || specialtyTemplateQuery.isLoading || specialtyAssessmentQuery.isLoading ? (
                  <p className="text-sm text-slate-500">{t("common.loading")}</p>
                ) : specialtyTemplateQuery.data?.template ? (
                  <>
                    <p className="text-xs text-slate-600">
                      {t("patients.assessment.activeTemplate")}:{" "}
                      <span className="font-semibold text-slate-800">
                        {locale === "ar" ? specialtyTemplateQuery.data.template.titleAr : specialtyTemplateQuery.data.template.title}
                      </span>
                    </p>
                    <SpecialtyAssessmentForm
                      key={`${appointment.patient.id}-${selectedSpecialtyCode}-${selectedEntryType}-${specialtyAssessmentQuery.data?.assessment?.updatedAt ?? "new"}`}
                      template={specialtyTemplateQuery.data.template}
                      initialValues={specialtyAssessmentQuery.data?.assessment?.values as Record<string, unknown> | undefined}
                      isSubmitting={saveAssessmentMutation.isPending}
                      onSubmit={async (values) => {
                        await saveAssessmentMutation.mutateAsync(values);
                      }}
                    />
                    {Array.isArray(specialtyAssessmentQuery.data?.assessment?.alerts) &&
                    specialtyAssessmentQuery.data?.assessment?.alerts?.length ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                        <p className="mb-2 text-sm font-semibold text-amber-800">{t("patients.assessment.alerts")}</p>
                        <ul className="list-disc space-y-1 ps-5 text-sm text-amber-900">
                          {specialtyAssessmentQuery.data.assessment.alerts.map((alert, index) => (
                            <li key={`${String(alert.key ?? "alert")}-${index}`}>
                              {String(alert.messageAr ?? alert.message ?? alert.nameAr ?? alert.name ?? "-")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {Array.isArray(specialtyAssessmentQuery.data?.assessment?.diagnoses) &&
                    specialtyAssessmentQuery.data?.assessment?.diagnoses?.length ? (
                      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
                        <p className="mb-2 text-sm font-semibold text-cyan-800">{t("patients.assessment.diagnoses")}</p>
                        <ul className="list-disc space-y-1 ps-5 text-sm text-cyan-900">
                          {specialtyAssessmentQuery.data.assessment.diagnoses.map((diagnosis, index) => (
                            <li key={`${String(diagnosis.key ?? "diag")}-${index}`}>
                              {String(diagnosis.nameAr ?? diagnosis.name ?? "-")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-700">
                    <p className="font-medium">
                      {t("patients.assessment.templateUnavailable", {
                        specialty:
                          enabledSpecialties.find((item) => item.specialty.code === selectedSpecialtyCode)?.specialty.name ?? "-"
                      })}
                    </p>
                  </div>
                )}
              </section>
            </section>

            <aside className="space-y-4 md:[direction:rtl]">
              <section className="grid gap-2 rounded-2xl border border-orange-100 bg-orange-50/40 p-3 md:grid-cols-1">
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <UserRound size={15} className="text-orange-600" />
                  {t("appointments.medicalFile.patient")}:{" "}
                  <span className="font-semibold text-slate-900">{appointment.patient.name}</span>
                </p>
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Stethoscope size={15} className="text-cyan-700" />
                  {t("appointments.medicalFile.doctor")}:{" "}
                  <span className="font-semibold text-slate-900">{appointment.doctorName || "-"}</span>
                </p>
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <CalendarDays size={15} className="text-emerald-700" />
                  {t("appointments.medicalFile.date")}: <span className="font-semibold text-slate-900">{dateLabel}</span>
                </p>
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Clock3 size={15} className="text-violet-700" />
                  {t("appointments.medicalFile.time")}: <span className="font-semibold text-slate-900">{timeLabel}</span>
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {t("appointments.medicalFile.status")}:{" "}
                  <span className="font-semibold text-slate-900">{appointmentStatusLabel}</span>
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {t("appointments.medicalFile.entryType")}: <span className="font-semibold text-slate-900">{entryTypeLabel}</span>
                </p>
              </section>

              <section className="grid gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm md:grid-cols-1">
                <p className="text-slate-600">
                  {t("patients.card.fileNumber")}:{" "}
                  <span className="font-semibold text-slate-800">{appointment.patient.fileNumber ?? "-"}</span>
                </p>
                <p className="text-slate-600">
                  {t("field.nationalId")}: <span className="font-semibold text-slate-800">{appointment.patient.nationalId || "-"}</span>
                </p>
                <p className="text-slate-600">
                  {t("patients.card.phone")}: <span className="font-semibold text-slate-800">{appointment.patient.phone || "-"}</span>
                </p>
                <p className="text-slate-600">
                  {t("patients.card.age")}: <span className="font-semibold text-slate-800">{appointment.patient.age ?? "-"}</span>
                </p>
                <p className="text-slate-600">
                  {t("patients.card.birthDate")}:{" "}
                  <span className="font-semibold text-slate-800">
                    {appointment.patient.dateOfBirth ? String(appointment.patient.dateOfBirth).slice(0, 10) : "-"}
                  </span>
                </p>
                <p className="text-slate-600">
                  {t("patients.card.address")}: <span className="font-semibold text-slate-800">{appointment.patient.address || "-"}</span>
                </p>
                {appointment.reason ? (
                  <p className="text-slate-600">
                    {t("appointments.reason")}: <span className="font-semibold text-slate-800">{appointment.reason}</span>
                  </p>
                ) : null}
                {appointment.notes ? (
                  <p className="text-slate-600">
                    {t("appointments.notes")}: <span className="font-semibold text-slate-800">{appointment.notes}</span>
                  </p>
                ) : null}
              </section>
            </aside>
          </div>

          <div className="flex items-center justify-end">
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
      )}
    </Modal>
  );
}
