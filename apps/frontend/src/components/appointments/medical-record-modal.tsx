"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Eye, FileText, Pill, Plus, Printer, Stethoscope, Trash2, Upload, UserRound } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useI18n } from "@/components/providers/i18n-provider";
import { Modal } from "@/components/ui/modal";
import { SpecialtyAssessmentForm } from "@/components/forms/specialty-assessment-form";
import { appointmentService } from "@/lib/appointment-service";
import { medicineService, MedicineItem } from "@/lib/medicine-service";
import { patientService, PatientAssessmentHistoryItem, PatientExamAttachmentItem, PatientExamItem } from "@/lib/patient-service";
import { specialtyService, SpecialtyTemplate } from "@/lib/specialty-service";
import { useDebounce } from "@/hooks/use-debounce";

export interface AppointmentMedicalRecordContext {
  id: string;
}

export interface PatientMedicalRecordContext {
  id: string;
  name: string;
  clinicId?: string;
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

interface PrescriptionItem {
  medicineId?: string;
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

type PrintPaperSize = "A4" | "A5";

interface PrintPrescriptionParams {
  patientName: string;
  doctorName: string;
  doctorStorageKey?: string;
  specialtyLabel: string;
  entryType: "EXAM" | "CONSULTATION";
  date: string;
  diagnoses: string[];
  notes: string;
}

const normalizePrescriptionItem = (item: PrescriptionItem): PrescriptionItem => ({
  medicineId: item.medicineId,
  name: item.name.trim(),
  dosage: item.dosage?.trim() || "",
  frequency: item.frequency?.trim() || "",
  duration: item.duration?.trim() || "",
  instructions: item.instructions?.trim() || ""
});

const dedupeStrings = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const parsePrescriptionItems = (values: Record<string, unknown>) => {
  const structured = Array.isArray(values.prescriptionItems)
    ? (values.prescriptionItems as unknown[])
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const name = String(record.name ?? "").trim();
          if (!name) return null;
          return normalizePrescriptionItem({
            medicineId: typeof record.medicineId === "string" ? record.medicineId : undefined,
            name,
            dosage: String(record.dosage ?? ""),
            frequency: String(record.frequency ?? ""),
            duration: String(record.duration ?? ""),
            instructions: String(record.instructions ?? "")
          });
        })
        .filter((item): item is PrescriptionItem => Boolean(item))
    : [];

  if (structured.length) return structured;
  return dedupeStrings([...listFromUnknown(values.medication), ...listFromUnknown(values.medications)]).map((name) =>
    normalizePrescriptionItem({ name })
  );
};

const extractMedicationNames = (values: Record<string, unknown>) => dedupeStrings(parsePrescriptionItems(values).map((item) => item.name));

const mergePrescriptionIntoValues = (values: Record<string, unknown>, items: PrescriptionItem[]) => {
  const cleanItems = items.map(normalizePrescriptionItem).filter((item) => item.name);
  const names = dedupeStrings(cleanItems.map((item) => item.name));
  return {
    ...values,
    prescriptionItems: cleanItems,
    medications: names,
    medication: names
  };
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const resolveUploadUrl = (pathOrUrl: string) => {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (typeof window === "undefined") return pathOrUrl;
  return `${window.location.origin}${pathOrUrl}`;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const printSizeStorageKeyForDoctor = (doctorStorageKey?: string) =>
  `appointments:prescription:paper-size:${doctorStorageKey?.trim() || "default"}`;

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
  const medications = extractMedicationNames(values);
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

interface PatientExamsPanelProps {
  patientId?: string;
  clinicScope?: string;
}

function PatientExamsPanel({ patientId, clinicScope }: PatientExamsPanelProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [newExamName, setNewExamName] = useState("");
  const [newExamDate, setNewExamDate] = useState("");
  const [newExamFiles, setNewExamFiles] = useState<File[]>([]);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [editingFiles, setEditingFiles] = useState<File[]>([]);

  const examsQuery = useQuery({
    queryKey: ["medical-record", "patient-exams", patientId, clinicScope ?? "mine"],
    queryFn: () => patientService.listExams(String(patientId), clinicScope),
    enabled: Boolean(patientId)
  });

  const createExamMutation = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error("Missing patient context");
      if (!newExamName.trim()) throw new Error(t("patients.exams.validation.nameRequired"));
      if (!newExamDate) throw new Error(t("patients.exams.validation.dateRequired"));
      if (!newExamFiles.length) throw new Error(t("patients.exams.validation.attachmentsRequired"));
      return patientService.createExam(
        patientId,
        {
          name: newExamName.trim(),
          examDate: newExamDate,
          attachments: newExamFiles
        },
        clinicScope
      );
    },
    onSuccess: async () => {
      setNewExamName("");
      setNewExamDate("");
      setNewExamFiles([]);
      await queryClient.invalidateQueries({
        queryKey: ["medical-record", "patient-exams", patientId, clinicScope ?? "mine"]
      });
      toast.success(t("patients.exams.createSuccess"));
    },
    onError: (error) => {
      if (error instanceof Error && error.message) {
        toast.error(error.message);
        return;
      }
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        if (typeof message === "string" && message.trim()) {
          toast.error(message);
          return;
        }
      }
      toast.error(t("patients.exams.createFailed"));
    }
  });

  const updateExamMutation = useMutation({
    mutationFn: async (examId: string) => {
      if (!patientId) throw new Error("Missing patient context");
      if (!editingName.trim()) throw new Error(t("patients.exams.validation.nameRequired"));
      if (!editingDate) throw new Error(t("patients.exams.validation.dateRequired"));
      return patientService.updateExam(
        patientId,
        examId,
        {
          name: editingName.trim(),
          examDate: editingDate,
          attachments: editingFiles
        },
        clinicScope
      );
    },
    onSuccess: async () => {
      setEditingExamId(null);
      setEditingFiles([]);
      await queryClient.invalidateQueries({
        queryKey: ["medical-record", "patient-exams", patientId, clinicScope ?? "mine"]
      });
      toast.success(t("patients.exams.updateSuccess"));
    },
    onError: (error) => {
      if (error instanceof Error && error.message) {
        toast.error(error.message);
        return;
      }
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        if (typeof message === "string" && message.trim()) {
          toast.error(message);
          return;
        }
      }
      toast.error(t("patients.exams.updateFailed"));
    }
  });

  const removeExamMutation = useMutation({
    mutationFn: async (examId: string) => {
      if (!patientId) throw new Error("Missing patient context");
      return patientService.removeExam(patientId, examId, clinicScope);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["medical-record", "patient-exams", patientId, clinicScope ?? "mine"]
      });
      toast.success(t("patients.exams.deleteSuccess"));
    },
    onError: () => {
      toast.error(t("patients.exams.deleteFailed"));
    }
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: async (payload: { examId: string; attachmentId: string }) => {
      if (!patientId) throw new Error("Missing patient context");
      return patientService.removeExamAttachment(patientId, payload.examId, payload.attachmentId, clinicScope);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["medical-record", "patient-exams", patientId, clinicScope ?? "mine"]
      });
      toast.success(t("patients.exams.attachmentDeleteSuccess"));
    },
    onError: () => {
      toast.error(t("patients.exams.attachmentDeleteFailed"));
    }
  });

  const startEditing = (exam: PatientExamItem) => {
    setEditingExamId(exam.id);
    setEditingName(exam.name);
    setEditingDate(exam.examDate.slice(0, 10));
    setEditingFiles([]);
  };

  const renderAttachment = (examId: string, attachment: PatientExamAttachmentItem) => {
    const isImage = attachment.mimeType.startsWith("image/");
    const url = resolveUploadUrl(attachment.fileUrl);
    return (
      <article key={attachment.id} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
          {isImage ? (
            <Image src={url} alt={attachment.fileName} width={400} height={240} unoptimized className="h-24 w-full object-cover" />
          ) : (
            <div className="flex h-24 w-full items-center justify-center text-slate-500">
              <FileText size={28} />
            </div>
          )}
        </div>
        <div className="mt-2 space-y-1">
          <p className="truncate text-xs font-semibold text-slate-800">{attachment.fileName}</p>
          <p className="text-[11px] text-slate-500">{formatBytes(attachment.sizeBytes)}</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Eye size={12} />
            {t("patients.exams.open")}
          </a>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
            onClick={() => removeAttachmentMutation.mutate({ examId, attachmentId: attachment.id })}
          >
            <Trash2 size={12} />
            {t("patients.exams.remove")}
          </button>
        </div>
      </article>
    );
  };

  if (examsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (examsQuery.isError) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
        <p className="text-sm font-medium text-amber-800">{t("patients.exams.loadFailed")}</p>
      </section>
    );
  }

  const exams = examsQuery.data?.exams ?? [];
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-orange-100/40 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-base font-semibold text-slate-900">{t("patients.exams.addTitle")}</h4>
          <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">{t("patients.exams.supportedFiles")}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={newExamName}
            onChange={(e) => setNewExamName(e.target.value)}
            placeholder={t("patients.exams.name")}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
          <input
            type="date"
            value={newExamDate}
            onChange={(e) => setNewExamDate(e.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
          <label className="md:col-span-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm font-medium text-slate-700 transition hover:border-orange-300 hover:bg-orange-50/30">
            <Upload size={16} />
            {t("patients.exams.attachFiles")}
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setNewExamFiles(Array.from(e.target.files ?? []))}
            />
          </label>
        </div>
        {newExamFiles.length > 0 ? (
          <p className="mt-2 text-xs text-slate-600">{t("patients.exams.filesCount", { count: String(newExamFiles.length) })}</p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createExamMutation.isPending}
            onClick={() => createExamMutation.mutate()}
          >
            <Plus size={14} />
            {t("patients.exams.addAction")}
          </button>
        </div>
      </section>

      {!exams.length ? <p className="text-sm text-slate-500">{t("patients.exams.empty")}</p> : null}

      {exams.map((exam) => (
        <section key={exam.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">{exam.name}</p>
              <p className="text-xs text-slate-500">{formatDate(exam.examDate)}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => startEditing(exam)}
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                onClick={() => removeExamMutation.mutate(exam.id)}
              >
                <Trash2 size={12} />
                {t("common.delete")}
              </button>
            </div>
          </div>

          {editingExamId === exam.id ? (
            <div className="mb-3 grid gap-2 rounded-xl border border-orange-200 bg-orange-50/40 p-3 md:grid-cols-2">
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-300"
              />
              <input
                type="date"
                value={editingDate}
                onChange={(e) => setEditingDate(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-300"
              />
              <label className="md:col-span-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs font-medium text-slate-700">
                <Upload size={14} />
                {t("patients.exams.attachMore")}
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setEditingFiles(Array.from(e.target.files ?? []))}
                />
              </label>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"
                  onClick={() => setEditingExamId(null)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-lg bg-orange-600 px-3 text-xs font-semibold text-white"
                  onClick={() => updateExamMutation.mutate(exam.id)}
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {exam.attachments.map((attachment) => renderAttachment(exam.id, attachment))}
          </div>
        </section>
      ))}
    </div>
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
  const [activePatientTab, setActivePatientTab] = useState<"history" | "exams">("history");
  const [medicineSearchInput, setMedicineSearchInput] = useState("");
  const [medicineDropdownOpen, setMedicineDropdownOpen] = useState(false);
  const [manualMedicineName, setManualMedicineName] = useState("");
  const [appointmentPrescriptionItems, setAppointmentPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [appointmentDoctorNotes, setAppointmentDoctorNotes] = useState("");
  const [printSizePickerOpen, setPrintSizePickerOpen] = useState(false);
  const [selectedPrintSize, setSelectedPrintSize] = useState<PrintPaperSize>("A4");
  const [pendingPrintParams, setPendingPrintParams] = useState<PrintPrescriptionParams | null>(null);
  const [loadedStoredPrintSize, setLoadedStoredPrintSize] = useState(false);
  const debouncedMedicineSearch = useDebounce(medicineSearchInput, 350);

  useEffect(() => {
    if (!open) return;
    if (mode === "patient") {
      setActivePatientTab("history");
    }
  }, [open, mode]);

  const appointmentAssessmentQuery = useQuery({
    queryKey: ["medical-record", "appointment", appointmentContext?.id, clinicScope ?? "mine"],
    queryFn: () => appointmentService.getAssessment(String(appointmentContext?.id), clinicScope),
    enabled: open && mode === "appointment" && Boolean(appointmentContext?.id)
  });

  const allMedicinesQuery = useQuery({
    queryKey: ["medical-record", "medicine-catalog-global"],
    queryFn: async () => {
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const merged: MedicineItem[] = [];
      do {
        const response = await medicineService.list({
          page,
          pageSize,
          sortBy: "arabicName",
          sortOrder: "asc"
        });
        merged.push(...response.data);
        totalPages = Math.max(1, response.totalPages ?? 1);
        page += 1;
      } while (page <= totalPages);

      const byId = new Map<string, MedicineItem>();
      merged.forEach((item) => byId.set(item.id, item));
      return Array.from(byId.values());
    },
    enabled: open && mode === "appointment"
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

  const resolvedPatientClinicScope = clinicScope ?? patientAssessmentsQuery.data?.patient?.clinicId;

  const appointmentAssessmentValues = useMemo(
    () => ((appointmentAssessmentQuery.data?.assessment?.values as Record<string, unknown> | undefined) ?? {}),
    [appointmentAssessmentQuery.data?.assessment?.values]
  );

  useEffect(() => {
    if (!open || mode !== "appointment") return;
    setAppointmentPrescriptionItems(parsePrescriptionItems(appointmentAssessmentValues));
  }, [open, mode, appointmentAssessmentQuery.data?.assessment?.updatedAt, appointmentAssessmentQuery.data?.appointment?.id, appointmentAssessmentValues]);

  useEffect(() => {
    if (!open || mode !== "appointment") return;
    const values = appointmentAssessmentValues;
    const fallbackNotes = String(
      values.notes ?? appointmentAssessmentQuery.data?.appointment?.notes ?? appointmentAssessmentQuery.data?.appointment?.reason ?? ""
    ).trim();
    setAppointmentDoctorNotes(fallbackNotes);
  }, [
    open,
    mode,
    appointmentAssessmentValues,
    appointmentAssessmentQuery.data?.assessment?.updatedAt,
    appointmentAssessmentQuery.data?.appointment?.id,
    appointmentAssessmentQuery.data?.appointment?.notes,
    appointmentAssessmentQuery.data?.appointment?.reason
  ]);

  const addMedicineItem = (item: PrescriptionItem) => {
    const normalized = normalizePrescriptionItem(item);
    if (!normalized.name) return;
    setAppointmentPrescriptionItems((prev) => [...prev, normalized]);
  };

  const updateMedicineItem = (index: number, patch: Partial<PrescriptionItem>) => {
    setAppointmentPrescriptionItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? normalizePrescriptionItem({ ...item, ...patch }) : item))
    );
  };

  const removeMedicineItem = (index: number) => {
    setAppointmentPrescriptionItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const addCatalogMedicine = (medicine: MedicineItem) => {
    const preferredName = locale === "ar" ? medicine.arabicName : medicine.englishName;
    addMedicineItem({
      medicineId: medicine.id,
      name: preferredName || medicine.arabicName || medicine.englishName
    });
    setMedicineSearchInput("");
    setMedicineDropdownOpen(false);
  };

  const addManualMedicine = () => {
    const name = manualMedicineName.trim();
    if (!name) return;
    addMedicineItem({ name });
    setManualMedicineName("");
  };

  const filteredMedicines = useMemo(() => {
    const all = allMedicinesQuery.data ?? [];
    const tokens = debouncedMedicineSearch
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.length) return all;

    return all.filter((medicine) => {
      const haystack = [
        medicine.arabicName,
        medicine.englishName,
        medicine.activeIngredient,
        medicine.company,
        medicine.specialty,
        medicine.dosageForm,
        medicine.concentration
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [allMedicinesQuery.data, debouncedMedicineSearch]);

  const printAppointmentPrescription = (params: {
    patientName: string;
    doctorName: string;
    specialtyLabel: string;
    entryType: "EXAM" | "CONSULTATION";
    date: string;
    diagnoses: string[];
    notes: string;
  }, paperSize: PrintPaperSize) => {
    const list = appointmentPrescriptionItems.filter((item) => item.name.trim());
    if (!list.length) {
      toast.warning(t("appointments.prescription.printNeedsItems"));
      return;
    }

    const pageMargin = paperSize === "A5" ? "8mm" : "10mm";
    const compactClass = paperSize === "A5" ? "compact" : "";

    const fullWidth = Math.max(window.screen.availWidth, 1200);
    const fullHeight = Math.max(window.screen.availHeight, 800);
    const printWindow = window.open(
      "",
      "_blank",
      `popup=yes,width=${fullWidth},height=${fullHeight},left=0,top=0`
    );
    if (!printWindow) {
      toast.error(t("appointments.prescription.printWindowBlocked"));
      return;
    }

    const rowsHtml = list
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.dosage || "-")}</td>
            <td>${escapeHtml(item.frequency || "-")}</td>
            <td>${escapeHtml(item.duration || "-")}</td>
            <td>${escapeHtml(item.instructions || "-")}</td>
          </tr>
        `
      )
      .join("");
    const diagnosesText = escapeHtml(params.diagnoses.length ? params.diagnoses.join(" - ") : "-");
    const printTitle = t("appointments.prescription.printTitle");
    const isArabic = locale === "ar";
    const direction = isArabic ? "rtl" : "ltr";
    const alignStart = isArabic ? "right" : "left";
    const alignEnd = isArabic ? "left" : "right";
    const issueDateLabel = t("appointments.prescription.issueDate");
    const subtitle = t("appointments.prescription.printSubtitle");

    printWindow.document.write(`
      <html>
      <head>
        <title>${printTitle}</title>
        <style>
          @page { size: ${paperSize} portrait; margin: ${pageMargin}; }
          * { box-sizing: border-box; }
          body {
            font-family: "Segoe UI", Tahoma, Arial, sans-serif;
            margin: 0;
            min-height: 100vh;
            color: #0f172a;
            direction: ${direction};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #f8fafc;
          }
          .sheet {
            width: 100%;
            min-height: 100vh;
            border: 2px solid #0f172a;
            border-radius: 16px;
            overflow: hidden;
            background: #ffffff;
          }
          .topBar {
            height: 6px;
            background: linear-gradient(90deg, #f97316, #fb923c);
          }
          .header {
            display: grid;
            grid-template-columns: 76px 1fr auto;
            gap: 12px;
            align-items: center;
            padding: 14px 16px;
            border-bottom: 1px solid #e2e8f0;
            page-break-inside: avoid;
          }
          .logoWrap {
            width: 64px;
            height: 64px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
          }
          .logoWrap img { width: 100%; height: 100%; object-fit: cover; }
          .clinicTitle { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.3px; }
          .clinicSub { margin: 4px 0 0; font-size: 12px; color: #64748b; }
          body.compact .clinicTitle { font-size: 19px; }
          body.compact .clinicSub { font-size: 11px; }
          .issueBlock {
            text-align: ${alignEnd};
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #fff7ed;
            min-width: 150px;
          }
          .issueLabel { font-size: 11px; color: #9a3412; font-weight: 700; text-transform: uppercase; }
          .issueValue { margin-top: 4px; font-size: 13px; font-weight: 700; color: #0f172a; }
          .content { padding: 14px 16px 16px; }
          .metaGrid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 12px;
            page-break-inside: avoid;
          }
          .metaCard {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 8px 10px;
            background: #ffffff;
          }
          .metaLabel { font-size: 11px; color: #64748b; margin-bottom: 3px; font-weight: 600; }
          .metaValue { font-size: 13px; font-weight: 700; color: #0f172a; }
          body.compact .metaValue { font-size: 12px; }
          .section {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 10px;
            background: #ffffff;
            page-break-inside: avoid;
          }
          .sectionTitle {
            margin: 0 0 6px;
            font-size: 12px;
            font-weight: 800;
            color: #1e293b;
            text-align: ${alignStart};
          }
          .sectionBody { font-size: 12px; color: #334155; line-height: 1.6; }
          .tableWrap {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
            page-break-inside: avoid;
            background: #ffffff;
          }
          table { width: 100%; border-collapse: collapse; }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            padding: 8px;
            font-size: 11px;
            vertical-align: top;
            text-align: ${alignStart};
          }
          th {
            background: #f8fafc;
            color: #0f172a;
            font-weight: 800;
          }
          tr:last-child td { border-bottom: 0; }
          .footer {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-top: 12px;
            page-break-inside: avoid;
          }
          .signBox {
            border: 1px dashed #94a3b8;
            border-radius: 10px;
            padding: 10px;
            min-height: 56px;
            display: flex;
            align-items: flex-end;
            font-size: 12px;
            color: #334155;
            font-weight: 600;
          }
          @media screen {
            body { background: #eef2ff; }
            .sheet {
              max-width: ${paperSize === "A5" ? "620px" : "980px"};
              margin: 16px auto;
              box-shadow: 0 20px 50px rgba(2, 6, 23, 0.15);
            }
          }
          @media print {
            body { background: #fff; }
            .sheet { box-shadow: none; }
          }
        </style>
      </head>
      <body dir="${direction}" class="${compactClass}">
        <section class="sheet">
          <div class="topBar"></div>
          <header class="header">
            <div class="logoWrap">
              <img src="/healthcare.jpeg" alt="Healthcare CRM" />
            </div>
            <div>
              <h1 class="clinicTitle">${printTitle}</h1>
              <p class="clinicSub">${subtitle}</p>
            </div>
            <div class="issueBlock">
              <div class="issueLabel">${issueDateLabel}</div>
              <div class="issueValue">${escapeHtml(params.date || "-")}</div>
            </div>
          </header>

          <div class="content">
            <section class="metaGrid">
              <article class="metaCard">
                <div class="metaLabel">${t("appointments.medicalFile.patient")}</div>
                <div class="metaValue">${escapeHtml(params.patientName || "-")}</div>
              </article>
              <article class="metaCard">
                <div class="metaLabel">${t("appointments.medicalFile.doctor")}</div>
                <div class="metaValue">${escapeHtml(params.doctorName || "-")}</div>
              </article>
              <article class="metaCard">
                <div class="metaLabel">${t("appointments.medicalRecord.specialty")}</div>
                <div class="metaValue">${escapeHtml(params.specialtyLabel || "-")}</div>
              </article>
              <article class="metaCard">
                <div class="metaLabel">${t("appointments.medicalFile.entryType")}</div>
                <div class="metaValue">${escapeHtml(entryTypeLabel(params.entryType))}</div>
              </article>
            </section>

            <section class="section">
              <h2 class="sectionTitle">${t("patients.assessment.diagnoses")}</h2>
              <div class="sectionBody">${diagnosesText}</div>
            </section>

            <section class="section">
              <h2 class="sectionTitle">${t("appointments.medicalRecord.doctorNotes")}</h2>
              <div class="sectionBody">${escapeHtml(params.notes || "-")}</div>
            </section>

            <section class="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>${t("appointments.prescription.name")}</th>
                    <th>${t("appointments.prescription.dosage")}</th>
                    <th>${t("appointments.prescription.frequency")}</th>
                    <th>${t("appointments.prescription.duration")}</th>
                    <th>${t("appointments.prescription.instructions")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </section>

            <section class="footer">
              <div class="signBox">${t("appointments.prescription.signatureDoctor")}</div>
              <div class="signBox">${t("appointments.prescription.signaturePatient")}</div>
            </section>
          </div>
        </section>
      </body>
      </html>
    `);
    printWindow.document.close();
    try {
      printWindow.moveTo(0, 0);
      printWindow.resizeTo(fullWidth, fullHeight);
    } catch {}
    printWindow.focus();
    printWindow.print();
  };

  const openPrintSizePicker = (params: PrintPrescriptionParams) => {
    const list = appointmentPrescriptionItems.filter((item) => item.name.trim());
    if (!list.length) {
      toast.warning(t("appointments.prescription.printNeedsItems"));
      return;
    }
    let nextSize: PrintPaperSize = "A4";
    let loadedFromStorage = false;
    try {
      const storedSize =
        typeof window !== "undefined"
          ? window.localStorage.getItem(printSizeStorageKeyForDoctor(params.doctorStorageKey))
          : null;
      if (storedSize === "A4" || storedSize === "A5") {
        nextSize = storedSize;
        loadedFromStorage = true;
      }
    } catch {}
    setSelectedPrintSize(nextSize);
    setLoadedStoredPrintSize(loadedFromStorage);
    setPendingPrintParams(params);
    setPrintSizePickerOpen(true);
  };

  const handlePrintWithSelectedSize = () => {
    if (!pendingPrintParams) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(printSizeStorageKeyForDoctor(pendingPrintParams.doctorStorageKey), selectedPrintSize);
      }
    } catch {}
    printAppointmentPrescription(pendingPrintParams, selectedPrintSize);
    setPrintSizePickerOpen(false);
    setPendingPrintParams(null);
  };

  const saveAppointmentDoctorNotes = async () => {
    const payload = appointmentAssessmentQuery.data;
    if (!payload?.assessment?.values) {
      const values = mergePrescriptionIntoValues({}, appointmentPrescriptionItems);
      await saveAppointmentAssessmentMutation.mutateAsync({
        ...values,
        notes: appointmentDoctorNotes.trim()
      });
      return;
    }

    const baseValues = (payload.assessment.values as Record<string, unknown>) ?? {};
    const mergedValues = mergePrescriptionIntoValues(baseValues, appointmentPrescriptionItems);
    await saveAppointmentAssessmentMutation.mutateAsync({
      ...mergedValues,
      notes: appointmentDoctorNotes.trim()
    });
  };

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
    const medications = extractMedicationNames(values);
    const attachments = listFromUnknown(values.attachments);
    const doctorName = `${payload.appointment.doctor?.user?.firstName ?? ""} ${payload.appointment.doctor?.user?.lastName ?? ""}`.trim();
    const doctorNotes = appointmentDoctorNotes.trim();
    const template = payload.template as SpecialtyTemplate | null;
    const appointmentSpecialtyLabel = locale === "ar" ? payload.specialty?.nameAr ?? "-" : payload.specialty?.name ?? "-";

    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold text-slate-900">{appointmentHeader}</p>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-3 text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
              onClick={() =>
                openPrintSizePicker({
                  patientName: payload.appointment.patient?.fullName ?? "-",
                  doctorName: doctorName || "-",
                  doctorStorageKey: payload.appointment.doctor?.id ?? (doctorName || "default"),
                  specialtyLabel: appointmentSpecialtyLabel,
                  entryType: payload.appointment.entryType,
                  date: formatDate(payload.appointment.startsAt),
                  diagnoses,
                  notes: doctorNotes
                })
              }
            >
              <Printer size={13} />
              {t("appointments.prescription.printAction")}
            </button>
          </div>
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
            <p className="mt-1 text-xs text-slate-500">{t("appointments.medicalRecord.doctorNotesHint")}</p>
            <textarea
              value={appointmentDoctorNotes}
              onChange={(event) => setAppointmentDoctorNotes(event.target.value)}
              rows={4}
              placeholder={t("appointments.medicalRecord.doctorNotesPlaceholder")}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg bg-orange-600 px-3 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void saveAppointmentDoctorNotes();
                }}
                disabled={saveAppointmentAssessmentMutation.isPending}
              >
                {saveAppointmentAssessmentMutation.isPending ? t("common.saving") : t("appointments.medicalRecord.saveDoctorNotes")}
              </button>
            </div>
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

        <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Pill size={15} className="text-orange-600" />
            <p className="text-sm font-semibold text-slate-900">{t("appointments.prescription.builderTitle")}</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">{t("appointments.prescription.searchCatalog")}</p>
              <button
                type="button"
                className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition hover:border-orange-300"
                onClick={() => setMedicineDropdownOpen((prev) => !prev)}
              >
                <span>{t("appointments.prescription.dropdownPlaceholder")}</span>
                <ChevronDown size={14} className={`transition ${medicineDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {medicineDropdownOpen ? (
                <div className="mt-2 rounded-lg border border-slate-200">
                  <div className="border-b border-slate-100 p-2">
                    <input
                      value={medicineSearchInput}
                      onChange={(event) => setMedicineSearchInput(event.target.value)}
                      placeholder={t("appointments.prescription.searchPlaceholder")}
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      {t("appointments.prescription.catalogCount", { count: String(allMedicinesQuery.data?.length ?? 0) })}
                    </p>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    {allMedicinesQuery.isLoading ? (
                      <p className="px-3 py-2 text-xs text-slate-500">{t("appointments.prescription.loadingCatalog")}</p>
                    ) : !(allMedicinesQuery.data?.length ?? 0) ? (
                      <p className="px-3 py-2 text-xs text-slate-500">{t("appointments.prescription.noCatalogData")}</p>
                    ) : filteredMedicines.length ? (
                      filteredMedicines.map((medicine) => (
                        <button
                          key={medicine.id}
                          type="button"
                          className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-orange-50"
                          onClick={() => addCatalogMedicine(medicine)}
                        >
                          <span className="font-medium text-slate-800">
                            {locale === "ar" ? medicine.arabicName : medicine.englishName}
                          </span>
                          <span className="text-xs text-slate-500">{medicine.activeIngredient}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-slate-500">{t("appointments.prescription.noCatalogResultsForSearch")}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">{t("appointments.prescription.addManual")}</p>
              <div className="flex gap-2">
                <input
                  value={manualMedicineName}
                  onChange={(event) => setManualMedicineName(event.target.value)}
                  placeholder={t("appointments.prescription.manualPlaceholder")}
                  className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-lg bg-orange-600 px-3 text-xs font-semibold text-white transition hover:bg-orange-700"
                  onClick={addManualMedicine}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {!appointmentPrescriptionItems.length ? (
                <p className="text-sm text-slate-500">{t("appointments.prescription.empty")}</p>
              ) : (
                appointmentPrescriptionItems.map((item, index) => (
                  <article key={`${item.medicineId ?? "manual"}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <input
                        value={item.name}
                        onChange={(event) => updateMedicineItem(index, { name: event.target.value })}
                        className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder={t("appointments.prescription.name")}
                      />
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50"
                        onClick={() => removeMedicineItem(index)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        value={item.dosage ?? ""}
                        onChange={(event) => updateMedicineItem(index, { dosage: event.target.value })}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder={t("appointments.prescription.dosage")}
                      />
                      <input
                        value={item.frequency ?? ""}
                        onChange={(event) => updateMedicineItem(index, { frequency: event.target.value })}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder={t("appointments.prescription.frequency")}
                      />
                      <input
                        value={item.duration ?? ""}
                        onChange={(event) => updateMedicineItem(index, { duration: event.target.value })}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder={t("appointments.prescription.duration")}
                      />
                      <input
                        value={item.instructions ?? ""}
                        onChange={(event) => updateMedicineItem(index, { instructions: event.target.value })}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder={t("appointments.prescription.instructions")}
                      />
                    </div>
                  </article>
                ))
              )}
            </div>
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
                const mergedValues = mergePrescriptionIntoValues(nextValues, appointmentPrescriptionItems);
                await saveAppointmentAssessmentMutation.mutateAsync({
                  ...mergedValues,
                  notes: appointmentDoctorNotes.trim()
                });
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
    if (activePatientTab === "exams") {
      return <PatientExamsPanel patientId={patientContext?.id} clinicScope={resolvedPatientClinicScope} />;
    }

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
              clinicScope={resolvedPatientClinicScope}
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
    <>
      <Modal
        open={open}
        title={title}
        onClose={onClose}
        maxWidthClass="max-w-[96vw] xl:max-w-[1400px]"
        bodyClassName="max-h-[82vh] overflow-y-auto"
      >
        <div className="space-y-4">
          {mode === "patient" ? (
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-orange-100/80 bg-gradient-to-r from-slate-50 via-white to-orange-50/60 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <button
                type="button"
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 ${
                  activePatientTab === "history"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_8px_24px_-12px_rgba(249,115,22,0.9)] ring-1 ring-orange-300/50"
                    : "text-slate-600 hover:-translate-y-0.5 hover:bg-white/85 hover:text-slate-800 hover:shadow-sm active:translate-y-0"
                }`}
                onClick={() => setActivePatientTab("history")}
              >
                {t("appointments.medicalRecord.historyTitle")}
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 ${
                  activePatientTab === "exams"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_8px_24px_-12px_rgba(249,115,22,0.9)] ring-1 ring-orange-300/50"
                    : "text-slate-600 hover:-translate-y-0.5 hover:bg-white/85 hover:text-slate-800 hover:shadow-sm active:translate-y-0"
                }`}
                onClick={() => setActivePatientTab("exams")}
              >
                {t("patients.exams.tab")}
              </button>
            </div>
          ) : null}
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

      <Modal
        open={printSizePickerOpen}
        title={t("appointments.prescription.paperSizeModalTitle")}
        onClose={() => {
          setPrintSizePickerOpen(false);
          setPendingPrintParams(null);
        }}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-600">{t("appointments.prescription.paperSizeModalSubtitle")}</p>
            <p className="text-xs text-slate-500">
              {loadedStoredPrintSize
                ? t("appointments.prescription.paperSizeRememberedLoaded")
                : t("appointments.prescription.paperSizeRememberHint")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedPrintSize("A4")}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 ${
                selectedPrintSize === "A4"
                  ? "border-orange-400 bg-orange-50 shadow-[0_18px_34px_-18px_rgba(249,115,22,0.95)] ring-2 ring-orange-200/70"
                  : "border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"
              }`}
            >
              <span
                className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-orange-300/40 blur-2xl transition duration-300 ${
                  selectedPrintSize === "A4" ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              />
              <div className="mb-2 flex items-center justify-between">
                <span className="text-base font-semibold text-slate-900">A4</span>
                <CheckCircle2
                  size={18}
                  className={`transition-all duration-300 ${
                    selectedPrintSize === "A4"
                      ? "scale-100 text-orange-600 opacity-100 drop-shadow-[0_0_12px_rgba(249,115,22,0.55)]"
                      : "scale-75 text-slate-300 opacity-50"
                  }`}
                />
              </div>
              <p className="text-xs text-slate-600">{t("appointments.prescription.paperSizeA4Desc")}</p>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPrintSize("A5")}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 ${
                selectedPrintSize === "A5"
                  ? "border-sky-400 bg-sky-50 shadow-[0_18px_34px_-18px_rgba(14,165,233,0.95)] ring-2 ring-sky-200/70"
                  : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40"
              }`}
            >
              <span
                className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-sky-300/40 blur-2xl transition duration-300 ${
                  selectedPrintSize === "A5" ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              />
              <div className="mb-2 flex items-center justify-between">
                <span className="text-base font-semibold text-slate-900">A5</span>
                <CheckCircle2
                  size={18}
                  className={`transition-all duration-300 ${
                    selectedPrintSize === "A5"
                      ? "scale-100 text-sky-600 opacity-100 drop-shadow-[0_0_12px_rgba(14,165,233,0.55)]"
                      : "scale-75 text-slate-300 opacity-50"
                  }`}
                />
              </div>
              <p className="text-xs text-slate-600">{t("appointments.prescription.paperSizeA5Desc")}</p>
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => {
                setPrintSizePickerOpen(false);
                setPendingPrintParams(null);
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-sm font-semibold text-white shadow-[0_14px_30px_-16px_rgba(249,115,22,0.9)] transition hover:from-orange-600 hover:to-amber-600"
              onClick={handlePrintWithSelectedSize}
            >
              <Printer size={14} />
              {t("appointments.prescription.paperSizePrintNow")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
