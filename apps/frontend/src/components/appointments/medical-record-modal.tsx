"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Pill,
  Plus,
  Printer,
  Stethoscope,
  Trash2,
  Upload,
  UserRound
} from "lucide-react";
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
  /** When Super Admin uses all-clinics filter, pass the appointment clinic for API ?clinicId */
  clinicId?: string;
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
type PrintLayoutMode = "withHeaderFooter" | "contentOnly";

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

const catalogTableCell = (value: string | null | undefined) => {
  const v = value?.trim();
  return v && v.length > 0 ? v : "—";
};

const MEDICINE_CATALOG_PAGE_SIZE = 15;

const printSizeStorageKeyForDoctor = (doctorStorageKey?: string) =>
  `appointments:prescription:paper-size:${doctorStorageKey?.trim() || "default"}`;
const printLayoutStorageKeyForDoctor = (doctorStorageKey?: string) =>
  `appointments:prescription:layout-mode:${doctorStorageKey?.trim() || "default"}`;

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
  const [medicineCatalogPage, setMedicineCatalogPage] = useState(1);
  const [medicineDropdownOpen, setMedicineDropdownOpen] = useState(false);
  const [manualMedicineName, setManualMedicineName] = useState("");
  const [appointmentPrescriptionItems, setAppointmentPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [appointmentDoctorNotes, setAppointmentDoctorNotes] = useState("");
  const [printSizePickerOpen, setPrintSizePickerOpen] = useState(false);
  const [selectedPrintSize, setSelectedPrintSize] = useState<PrintPaperSize>("A4");
  const [selectedPrintLayout, setSelectedPrintLayout] = useState<PrintLayoutMode>("withHeaderFooter");
  const [pendingPrintParams, setPendingPrintParams] = useState<PrintPrescriptionParams | null>(null);
  const [loadedStoredPrintSize, setLoadedStoredPrintSize] = useState(false);
  const [loadedStoredPrintLayout, setLoadedStoredPrintLayout] = useState(false);
  const debouncedMedicineSearch = useDebounce(medicineSearchInput, 350);

  const appointmentModeClinicScope = clinicScope ?? appointmentContext?.clinicId;

  useEffect(() => {
    if (!open) return;
    if (mode === "patient") {
      setActivePatientTab("history");
    }
  }, [open, mode]);

  useEffect(() => {
    if (open && mode === "appointment") {
      setMedicineCatalogPage(1);
    }
  }, [open, mode]);

  useEffect(() => {
    setMedicineCatalogPage(1);
  }, [debouncedMedicineSearch]);

  const appointmentAssessmentQuery = useQuery({
    queryKey: ["medical-record", "appointment", appointmentContext?.id, appointmentModeClinicScope ?? "mine"],
    queryFn: () => appointmentService.getAssessment(String(appointmentContext?.id), appointmentModeClinicScope),
    enabled: open && mode === "appointment" && Boolean(appointmentContext?.id)
  });

  const medicinesCatalogQuery = useQuery({
    queryKey: [
      "medical-record",
      "medicine-catalog",
      {
        q: debouncedMedicineSearch.trim(),
        page: medicineCatalogPage,
        pageSize: MEDICINE_CATALOG_PAGE_SIZE
      }
    ],
    queryFn: () =>
      medicineService.list({
        page: medicineCatalogPage,
        pageSize: MEDICINE_CATALOG_PAGE_SIZE,
        search: debouncedMedicineSearch.trim() || undefined,
        sortBy: "arabicName",
        sortOrder: "asc"
      }),
    enabled: open && mode === "appointment",
    placeholderData: keepPreviousData
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
        appointmentModeClinicScope,
        payload.appointment.id
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["medical-record", "appointment", appointmentContext?.id, appointmentModeClinicScope ?? "mine"]
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

  const catalogPayload = medicinesCatalogQuery.data;
  const catalogRows = catalogPayload?.data ?? [];
  const catalogTotal = catalogPayload?.total ?? 0;
  const catalogTotalPages = Math.max(1, catalogPayload?.totalPages ?? 1);
  const catalogPageNum = catalogPayload?.page ?? medicineCatalogPage;
  const catalogSearchTrimmed = debouncedMedicineSearch.trim();

  const printAppointmentPrescription = (params: {
    patientName: string;
    doctorName: string;
    specialtyLabel: string;
    entryType: "EXAM" | "CONSULTATION";
    date: string;
    diagnoses: string[];
    notes: string;
  }, paperSize: PrintPaperSize, layoutMode: PrintLayoutMode) => {
    const list = appointmentPrescriptionItems.filter((item) => item.name.trim());
    if (!list.length) {
      toast.warning(t("appointments.prescription.printNeedsItems"));
      return;
    }

    const isContentOnly = layoutMode === "contentOnly";
    const pageMargin = isContentOnly ? (paperSize === "A5" ? "5mm" : "6mm") : paperSize === "A5" ? "8mm" : "10mm";
    const compactClass = paperSize === "A5" ? "compact" : "";
    const layoutBodyClass = isContentOnly ? "print-mode-content-only" : "print-mode-branded";

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

    const printDash = "—";
    const formatPrintCell = (value: string | undefined) => {
      const v = value?.trim();
      if (!v) return printDash;
      return escapeHtml(v).replace(/\n/g, "<br>");
    };

    const thDrug = t("appointments.prescription.name");
    const thDose = t("appointments.prescription.dosage");
    const thDur = t("appointments.prescription.duration");
    const thInstr = t("appointments.prescription.instructions");
    const thFreq = t("appointments.prescription.frequency");

    const medicinesHtml = `
      <div class="rxTableWrap">
        <table class="rxTable">
          <thead>
            <tr>
              <th class="rxTh rxThNum" scope="col">#</th>
              <th class="rxTh rxThDrug" scope="col">${thDrug}</th>
              <th class="rxTh rxThDose" scope="col">${thDose}</th>
              <th class="rxTh rxThDur" scope="col">${thDur}</th>
              <th class="rxTh rxThInstr" scope="col">${thInstr}</th>
              <th class="rxTh rxThFreq" scope="col">${thFreq}</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map(
                (item, index) => `
            <tr class="rxTr">
              <td class="rxTd rxTdNum">${index + 1}</td>
              <td class="rxTd rxTdDrug">${escapeHtml(item.name)}</td>
              <td class="rxTd rxTdDose">${formatPrintCell(item.dosage)}</td>
              <td class="rxTd rxTdDur">${formatPrintCell(item.duration)}</td>
              <td class="rxTd rxTdInstr">${formatPrintCell(item.instructions)}</td>
              <td class="rxTd rxTdFreq">${formatPrintCell(item.frequency)}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    const diagnosesText = escapeHtml(params.diagnoses.length ? params.diagnoses.join(" - ") : "-");
    const printTitle = t("appointments.prescription.printTitle");
    const isArabic = locale === "ar";
    const direction = isArabic ? "rtl" : "ltr";
    const issueDateLabel = t("appointments.prescription.issueDate");
    const subtitle = t("appointments.prescription.printSubtitle");
    const headerHtml = isContentOnly
      ? ""
      : `
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
        `;
    const footerHtml = isContentOnly
      ? ""
      : `
            <section class="footer">
              <div class="signBox">${t("appointments.prescription.signatureDoctor")}</div>
              <div class="signBox">${t("appointments.prescription.signaturePatient")}</div>
            </section>
        `;

    printWindow.document.write(`
      <html>
      <head>
        <title>${printTitle}</title>
        <style>
          @page { size: ${paperSize} portrait; margin: ${pageMargin}; }
          * { box-sizing: border-box; }
          body {
            --reserve-top: 10mm;
            --reserve-bottom: 12mm;
            --fit-scale: 1;
            --font-scale: 1;
            --space-scale: 1;
            --line-scale: 1;
            --content-max: 640px;
            --brand-primary: #0ea5b7;
            --brand-secondary: #2563eb;
            --ink-strong: #0f172a;
            --ink-soft: #475569;
            --surface-soft: #f8fbff;
            font-family: "Segoe UI", Tahoma, Arial, sans-serif;
            margin: 0;
            height: 100vh;
            color: var(--ink-strong);
            direction: ${direction};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #eef6ff;
          }
          body.print-mode-content-only {
            --reserve-top: 72mm;
            --reserve-bottom: 58mm;
            --font-scale: 0.96;
            --space-scale: 0.9;
            --line-scale: 0.96;
            --content-max: 580px;
          }
          body.print-mode-branded {
            --reserve-top: 10mm;
            --reserve-bottom: 14mm;
            --font-scale: 1;
            --space-scale: 0.96;
            --line-scale: 1;
            --content-max: 640px;
          }
          body.compact.print-mode-content-only {
            --reserve-top: 58mm;
            --reserve-bottom: 46mm;
            --font-scale: 0.88;
            --space-scale: 0.74;
            --line-scale: 0.9;
            --content-max: 410px;
          }
          body.compact.print-mode-branded {
            --reserve-top: 8mm;
            --reserve-bottom: 10mm;
            --font-scale: 0.9;
            --space-scale: 0.78;
            --line-scale: 0.92;
            --content-max: 430px;
          }
          .sheet {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            border: 0;
            border-radius: 0;
            overflow: hidden;
            background: #ffffff;
          }
          .reserveZone {
            flex-shrink: 0;
            width: 100%;
          }
          .reserveZone--top { min-height: var(--reserve-top); }
          .reserveZone--bottom { min-height: var(--reserve-bottom); }
          .printMain {
            flex: 1 1 auto;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .contentInner {
            width: 100%;
            max-width: min(92%, var(--content-max));
            margin: 0 auto;
            padding: calc(10px * var(--space-scale) * var(--fit-scale))
              calc(12px * var(--space-scale) * var(--fit-scale))
              calc(14px * var(--space-scale) * var(--fit-scale));
            text-align: center;
          }
          body.compact .contentInner {
            max-width: min(94%, var(--content-max));
          }
          .topBar {
            height: calc(5px * var(--fit-scale));
            background: linear-gradient(90deg, var(--brand-primary), var(--brand-secondary));
          }
          .header {
            display: grid;
            grid-template-columns: 76px 1fr auto;
            gap: calc(10px * var(--space-scale) * var(--fit-scale));
            align-items: center;
            padding: calc(11px * var(--space-scale) * var(--fit-scale))
              calc(12px * var(--space-scale) * var(--fit-scale));
            border-bottom: 0;
            page-break-inside: avoid;
            width: 100%;
            max-width: min(96%, 720px);
            margin: 0 auto;
            position: relative;
          }
          .header::after {
            content: "";
            position: absolute;
            inset-inline: 14px;
            bottom: 0;
            height: 1px;
            background: linear-gradient(90deg, rgba(14, 165, 183, 0), rgba(14, 165, 183, 0.35), rgba(37, 99, 235, 0));
          }
          body.compact .header {
            max-width: min(98%, 480px);
          }
          .logoWrap {
            width: 64px;
            height: 64px;
            border-radius: 12px;
            border: 0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            box-shadow: 0 4px 14px rgba(14, 165, 183, 0.12);
          }
          .logoWrap img { width: 100%; height: 100%; object-fit: cover; }
          .clinicTitle { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.25px; text-align: center; color: #0b2b4a; }
          .clinicSub { margin: calc(3px * var(--space-scale) * var(--fit-scale)) 0 0; font-size: calc(12px * var(--font-scale) * var(--fit-scale)); color: #4b6b88; text-align: center; }
          .clinicTitle { font-size: calc(22px * var(--font-scale) * var(--fit-scale)); }
          body.compact .clinicTitle { font-size: calc(19px * var(--font-scale) * var(--fit-scale)); }
          body.compact .clinicSub { font-size: calc(11px * var(--font-scale) * var(--fit-scale)); }
          .issueBlock {
            text-align: center;
            padding: calc(6px * var(--space-scale) * var(--fit-scale))
              calc(8px * var(--space-scale) * var(--fit-scale));
            border: 0;
            border-radius: calc(10px * var(--fit-scale));
            background: linear-gradient(180deg, #f3fbff, #eef5ff);
            min-width: 120px;
          }
          .issueLabel { font-size: calc(10px * var(--font-scale) * var(--fit-scale)); color: #0f5d8e; font-weight: 700; text-transform: uppercase; }
          .issueValue { margin-top: calc(3px * var(--space-scale) * var(--fit-scale)); font-size: calc(12px * var(--font-scale) * var(--fit-scale)); font-weight: 700; color: #0b2b4a; }
          .metaGrid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: calc(6px * var(--space-scale) * var(--fit-scale))
              calc(10px * var(--space-scale) * var(--fit-scale));
            margin-bottom: calc(10px * var(--space-scale) * var(--fit-scale));
            page-break-inside: avoid;
            justify-items: center;
            text-align: center;
          }
          body.compact .metaGrid { margin-bottom: calc(8px * var(--space-scale) * var(--fit-scale)); }
          .metaCard {
            border: 0;
            border-radius: calc(10px * var(--fit-scale));
            padding: calc(4px * var(--space-scale) * var(--fit-scale))
              calc(3px * var(--space-scale) * var(--fit-scale));
            background: linear-gradient(180deg, #f9fcff, #f2f8ff);
            width: 100%;
            max-width: 280px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
          }
          .metaLabel { font-size: calc(10px * var(--font-scale) * var(--fit-scale)); color: #4b6b88; margin-bottom: calc(2px * var(--space-scale) * var(--fit-scale)); font-weight: 600; }
          .metaValue { font-size: calc(12px * var(--font-scale) * var(--fit-scale)); font-weight: 700; color: #0b2b4a; }
          body.compact .metaValue { font-size: calc(11px * var(--font-scale) * var(--fit-scale)); }
          .section {
            border: 0;
            border-radius: calc(12px * var(--fit-scale));
            padding: calc(6px * var(--space-scale) * var(--fit-scale)) 0
              calc(8px * var(--space-scale) * var(--fit-scale));
            margin-bottom: calc(2px * var(--space-scale) * var(--fit-scale));
            background: linear-gradient(180deg, rgba(14, 165, 183, 0.06), rgba(37, 99, 235, 0.04));
            page-break-inside: avoid;
            text-align: center;
          }
          .sectionTitle {
            margin: 0 0 calc(4px * var(--space-scale) * var(--fit-scale));
            font-size: calc(12px * var(--font-scale) * var(--fit-scale));
            font-weight: 800;
            color: #0b2b4a;
            text-align: center;
          }
          .sectionBody { font-size: calc(11px * var(--font-scale) * var(--fit-scale)); color: var(--ink-soft); line-height: calc(1.5 * var(--line-scale)); text-align: center; }
          .rxHeading {
            margin: calc(10px * var(--space-scale) * var(--fit-scale)) auto
              calc(10px * var(--space-scale) * var(--fit-scale));
            padding-bottom: calc(6px * var(--space-scale) * var(--fit-scale));
            font-size: calc(13px * var(--font-scale) * var(--fit-scale));
            font-weight: 800;
            color: #0b2b4a;
            text-align: center;
            max-width: min(92%, var(--content-max));
          }
          .rxHeading::after {
            content: "";
            display: block;
            height: 2px;
            margin-top: calc(6px * var(--space-scale) * var(--fit-scale));
            margin-left: auto;
            margin-right: auto;
            max-width: 220px;
            border-radius: 1px;
            background: linear-gradient(90deg, transparent, var(--brand-primary), var(--brand-secondary), transparent);
          }
          .rxList {
            margin: 0 0 calc(6px * var(--space-scale) * var(--fit-scale));
            page-break-inside: avoid;
            width: 100%;
          }
          .rxTableWrap {
            width: 100%;
            max-width: min(100%, 720px);
            margin: 0 auto calc(8px * var(--space-scale) * var(--fit-scale));
            text-align: start;
            border-radius: calc(14px * var(--fit-scale));
            overflow: hidden;
            box-shadow:
              0 1px 0 rgba(15, 23, 42, 0.06),
              0 12px 28px rgba(14, 165, 183, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(14, 165, 183, 0.18);
            background: linear-gradient(180deg, #ffffff 0%, #f9fcff 100%);
          }
          body.compact .rxTableWrap { max-width: 100%; }
          .rxTable {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: calc(11px * var(--font-scale) * var(--fit-scale));
          }
          .rxTh {
            padding: calc(10px * var(--space-scale) * var(--fit-scale))
              calc(8px * var(--space-scale) * var(--fit-scale));
            text-align: start;
            font-weight: 700;
            font-size: calc(10px * var(--font-scale) * var(--fit-scale));
            letter-spacing: 0.01em;
            text-transform: none;
            color: #111827;
            background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
            border-bottom: 1px solid #d1d5db;
            vertical-align: bottom;
          }
          .rxThNum { width: 2.25rem; text-align: center; }
          .rxThDrug { width: 24%; }
          .rxThDose { width: 12%; }
          .rxThDur { width: 11%; }
          .rxThInstr { width: 28%; }
          .rxThFreq { width: 15%; }
          .rxTr:nth-child(even) .rxTd { background: rgba(14, 165, 183, 0.04); }
          .rxTd {
            padding: calc(9px * var(--space-scale) * var(--fit-scale))
              calc(8px * var(--space-scale) * var(--fit-scale));
            vertical-align: top;
            text-align: start;
            color: var(--ink-strong);
            border-top: 1px solid rgba(15, 23, 42, 0.07);
            line-height: calc(1.45 * var(--line-scale));
            word-break: break-word;
          }
          .rxTdNum {
            text-align: center;
            font-weight: 800;
            color: #0b2b4a;
            background: rgba(14, 165, 183, 0.06);
          }
          .rxTdDrug { font-weight: 700; color: #0b2b4a; }
          .rxTdDose,
          .rxTdDur,
          .rxTdInstr,
          .rxTdFreq { color: #1e3a4f; font-weight: 600; }
          .footer {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: calc(10px * var(--space-scale) * var(--fit-scale));
            margin: calc(6px * var(--space-scale) * var(--fit-scale)) auto 0;
            page-break-inside: avoid;
            width: 100%;
            max-width: min(92%, 640px);
            padding: 0 calc(12px * var(--space-scale) * var(--fit-scale))
              calc(3px * var(--space-scale) * var(--fit-scale));
          }
          body.compact .footer {
            max-width: min(94%, 420px);
          }
          .signBox {
            border: 0;
            border-radius: calc(10px * var(--fit-scale));
            padding: calc(8px * var(--space-scale) * var(--fit-scale))
              calc(4px * var(--space-scale) * var(--fit-scale));
            min-height: calc(44px * var(--fit-scale));
            display: flex;
            align-items: flex-end;
            justify-content: center;
            font-size: calc(11px * var(--font-scale) * var(--fit-scale));
            color: #2f4f6a;
            font-weight: 600;
            text-align: center;
            background: linear-gradient(180deg, #f5fbff, #edf5ff);
          }
          @media screen {
            body { background: #eef2ff; }
            .sheet {
              max-width: ${paperSize === "A5" ? "620px" : "980px"};
              margin: 16px auto;
              box-shadow: 0 20px 50px rgba(2, 6, 23, 0.12);
            }
          }
          @media print {
            body { background: #fff; }
            .sheet { box-shadow: none; }
          }
        </style>
      </head>
      <body dir="${direction}" class="${[compactClass, layoutBodyClass].filter(Boolean).join(" ")}">
        <section class="sheet" id="print-sheet">
          <div class="reserveZone reserveZone--top" aria-hidden="true"></div>
          ${headerHtml}
          <div class="printMain">
            <div class="contentInner">
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

              <h2 class="rxHeading">${t("appointments.prescription.medicinesHeading")}</h2>
              <section class="rxList">
                ${medicinesHtml}
              </section>
            </div>
            ${footerHtml}
          </div>
          <div class="reserveZone reserveZone--bottom" aria-hidden="true"></div>
        </section>
      </body>
      </html>
    `);
    printWindow.document.close();
    const fitAndPrintSinglePage = () => {
      try {
        const sheet = printWindow.document.getElementById("print-sheet") as HTMLElement | null;
        const body = printWindow.document.body;
        if (sheet && body) {
          let fitScale = 1;
          const minScale = paperSize === "A5" ? 0.7 : 0.74;
          const step = 0.03;
          body.style.setProperty("--fit-scale", fitScale.toFixed(2));
          for (let attempt = 0; attempt < 14; attempt += 1) {
            const overflow = sheet.scrollHeight - sheet.clientHeight;
            if (overflow <= 2) break;
            fitScale = Math.max(minScale, fitScale - step);
            body.style.setProperty("--fit-scale", fitScale.toFixed(2));
            if (fitScale <= minScale) break;
          }
        }
      } catch {}
      printWindow.focus();
      printWindow.print();
    };
    try {
      printWindow.moveTo(0, 0);
      printWindow.resizeTo(fullWidth, fullHeight);
    } catch {}
    printWindow.setTimeout(fitAndPrintSinglePage, 140);
  };

  const openPrintSizePicker = (params: PrintPrescriptionParams) => {
    const list = appointmentPrescriptionItems.filter((item) => item.name.trim());
    if (!list.length) {
      toast.warning(t("appointments.prescription.printNeedsItems"));
      return;
    }
    let nextSize: PrintPaperSize = "A4";
    let nextLayout: PrintLayoutMode = "withHeaderFooter";
    let loadedFromStorage = false;
    let loadedLayoutFromStorage = false;
    try {
      const storedSize =
        typeof window !== "undefined"
          ? window.localStorage.getItem(printSizeStorageKeyForDoctor(params.doctorStorageKey))
          : null;
      if (storedSize === "A4" || storedSize === "A5") {
        nextSize = storedSize;
        loadedFromStorage = true;
      }
      const storedLayout =
        typeof window !== "undefined"
          ? window.localStorage.getItem(printLayoutStorageKeyForDoctor(params.doctorStorageKey))
          : null;
      if (storedLayout === "withHeaderFooter" || storedLayout === "contentOnly") {
        nextLayout = storedLayout;
        loadedLayoutFromStorage = true;
      }
    } catch {}
    setSelectedPrintSize(nextSize);
    setSelectedPrintLayout(nextLayout);
    setLoadedStoredPrintSize(loadedFromStorage);
    setLoadedStoredPrintLayout(loadedLayoutFromStorage);
    setPendingPrintParams(params);
    setPrintSizePickerOpen(true);
  };

  const handlePrintWithSelectedSize = () => {
    if (!pendingPrintParams) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(printSizeStorageKeyForDoctor(pendingPrintParams.doctorStorageKey), selectedPrintSize);
        window.localStorage.setItem(printLayoutStorageKeyForDoctor(pendingPrintParams.doctorStorageKey), selectedPrintLayout);
      }
    } catch {}
    printAppointmentPrescription(pendingPrintParams, selectedPrintSize, selectedPrintLayout);
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
    const rxMetaTextareaClass = `min-h-[4.25rem] resize-y rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm leading-relaxed outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 whitespace-pre-wrap [field-sizing:content]${locale === "ar" ? " [word-spacing:0.2em]" : ""}`;

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
                      {t("appointments.prescription.catalogCount", { count: String(catalogTotal) })}
                      {catalogTotal > 0 ? (
                        <span className="ms-2 text-slate-400">
                          {t("appointments.prescription.catalogPageInfo", {
                            page: String(catalogPageNum),
                            totalPages: String(catalogTotalPages)
                          })}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto overflow-x-auto">
                    {medicinesCatalogQuery.isLoading && !catalogPayload ? (
                      <p className="px-3 py-2 text-xs text-slate-500">{t("appointments.prescription.loadingCatalog")}</p>
                    ) : catalogTotal === 0 && !catalogSearchTrimmed ? (
                      <p className="px-3 py-2 text-xs text-slate-500">{t("appointments.prescription.noCatalogData")}</p>
                    ) : catalogTotal === 0 && catalogSearchTrimmed ? (
                      <p className="px-3 py-2 text-xs text-slate-500">{t("appointments.prescription.noCatalogResultsForSearch")}</p>
                    ) : (
                      <table className="min-w-max w-full border-collapse text-start text-xs text-slate-800">
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("pharmacy.table.arabicName")}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("pharmacy.table.englishName")}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("pharmacy.table.activeIngredient")}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("appointments.prescription.catalogCol.usageMethod")}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("pharmacy.table.specialty")}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("pharmacy.table.dosageForm")}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("pharmacy.table.concentration")}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("pharmacy.table.company")}
                            </th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold text-slate-600">
                              {t("appointments.prescription.catalogCol.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {catalogRows.map((medicine) => (
                            <tr key={medicine.id} className="border-b border-slate-100 last:border-b-0 hover:bg-orange-50/60">
                              <td className="max-w-[10rem] px-2 py-1.5 align-middle">{medicine.arabicName}</td>
                              <td className="max-w-[10rem] px-2 py-1.5 align-middle">{medicine.englishName}</td>
                              <td className="max-w-[9rem] px-2 py-1.5 align-middle">{catalogTableCell(medicine.activeIngredient)}</td>
                              <td className="max-w-[8rem] px-2 py-1.5 align-middle">{catalogTableCell(medicine.usageMethod)}</td>
                              <td className="max-w-[8rem] px-2 py-1.5 align-middle">{catalogTableCell(medicine.specialty)}</td>
                              <td className="max-w-[7rem] px-2 py-1.5 align-middle">{catalogTableCell(medicine.dosageForm)}</td>
                              <td className="max-w-[7rem] px-2 py-1.5 align-middle">{catalogTableCell(medicine.concentration)}</td>
                              <td className="max-w-[8rem] px-2 py-1.5 align-middle">{catalogTableCell(medicine.company)}</td>
                              <td className="whitespace-nowrap px-2 py-1.5 align-middle">
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-orange-600 px-2.5 text-[11px] font-semibold text-white transition hover:bg-orange-700"
                                  onClick={() => addCatalogMedicine(medicine)}
                                >
                                  <Plus size={12} />
                                  {t("common.add")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {catalogTotal > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-2 py-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={catalogPageNum <= 1 || medicinesCatalogQuery.isFetching}
                        onClick={() => setMedicineCatalogPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={14} />
                        {t("appointments.prescription.catalogPrev")}
                      </button>
                      <span className="text-[11px] text-slate-500">
                        {t("appointments.prescription.catalogPageInfo", {
                          page: String(catalogPageNum),
                          totalPages: String(catalogTotalPages)
                        })}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={catalogPageNum >= catalogTotalPages || medicinesCatalogQuery.isFetching}
                        onClick={() => setMedicineCatalogPage((p) => p + 1)}
                      >
                        {t("appointments.prescription.catalogNext")}
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ) : null}
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
                      <textarea
                        rows={2}
                        value={item.dosage ?? ""}
                        onChange={(event) => updateMedicineItem(index, { dosage: event.target.value })}
                        onBlur={(event) => updateMedicineItem(index, { dosage: event.target.value.trim() })}
                        className={rxMetaTextareaClass}
                        placeholder={t("appointments.prescription.dosage")}
                      />
                      <textarea
                        rows={2}
                        value={item.frequency ?? ""}
                        onChange={(event) => updateMedicineItem(index, { frequency: event.target.value })}
                        onBlur={(event) => updateMedicineItem(index, { frequency: event.target.value.trim() })}
                        className={rxMetaTextareaClass}
                        placeholder={t("appointments.prescription.frequency")}
                      />
                      <textarea
                        rows={2}
                        value={item.duration ?? ""}
                        onChange={(event) => updateMedicineItem(index, { duration: event.target.value })}
                        onBlur={(event) => updateMedicineItem(index, { duration: event.target.value.trim() })}
                        className={rxMetaTextareaClass}
                        placeholder={t("appointments.prescription.duration")}
                      />
                      <textarea
                        rows={2}
                        value={item.instructions ?? ""}
                        onChange={(event) => updateMedicineItem(index, { instructions: event.target.value })}
                        onBlur={(event) => updateMedicineItem(index, { instructions: event.target.value.trim() })}
                        className={rxMetaTextareaClass}
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
            <p className="text-xs text-slate-500">
              {loadedStoredPrintLayout
                ? t("appointments.prescription.layoutRememberedLoaded")
                : t("appointments.prescription.layoutRememberHint")}
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
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">{t("appointments.prescription.layoutModeTitle")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedPrintLayout("withHeaderFooter")}
                className={`rounded-2xl border p-3 text-left transition ${
                  selectedPrintLayout === "withHeaderFooter"
                    ? "border-orange-400 bg-orange-50 ring-2 ring-orange-200/70"
                    : "border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/30"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{t("appointments.prescription.layoutWithHeaderFooter")}</p>
                <p className="mt-1 text-xs text-slate-600">{t("appointments.prescription.layoutWithHeaderFooterDesc")}</p>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPrintLayout("contentOnly")}
                className={`rounded-2xl border p-3 text-left transition ${
                  selectedPrintLayout === "contentOnly"
                    ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200/70"
                    : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/30"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{t("appointments.prescription.layoutContentOnly")}</p>
                <p className="mt-1 text-xs text-slate-600">{t("appointments.prescription.layoutContentOnlyDesc")}</p>
              </button>
            </div>
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
