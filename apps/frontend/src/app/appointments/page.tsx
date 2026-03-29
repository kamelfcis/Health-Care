"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Mic, Square, SquarePen, Trash2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { EntityCollectionView } from "@/components/ui/entity-collection-view";
import { RippleButton } from "@/components/ui/ripple-button";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useI18n } from "@/components/providers/i18n-provider";
import { appointmentService, emptyAppointmentListQuery } from "@/lib/appointment-service";
import { useDebounce } from "@/hooks/use-debounce";
import { AppointmentSearchBar } from "@/components/appointments/appointment-search-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { clinicService } from "@/lib/clinic-service";
import { doctorService } from "@/lib/doctor-service";
import { patientService } from "@/lib/patient-service";
import { storage } from "@/lib/storage";
import { RoleGate } from "@/components/auth/role-gate";
import { hasPermission } from "@/lib/permissions";
import { specialtyService, VisitEntryType } from "@/lib/specialty-service";
import { AppointmentMedicalRecordContext, MedicalRecordModal } from "@/components/appointments/medical-record-modal";

type AppointmentRow = {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  specialtyCode: string;
  patient: string;
  doctor: string;
  doctorSpecialty: string;
  startsAtIso: string;
  endsAtIso: string;
  start: string;
  status: string;
  entryType: VisitEntryType;
  reason: string;
  notes: string;
  patientPhone: string;
  patientWhatsapp: string;
  patientNationalId: string;
  patientDateOfBirth: string;
  patientAge: number | null;
  patientAddress: string;
  patientProfession: string;
  patientLeadSource: string;
  patientFileNumber: number | null;
};

type SpeechRecognitionAlternativeLike = { transcript?: string };
type SpeechRecognitionResultLike = { isFinal: boolean; 0?: SpeechRecognitionAlternativeLike };
type SpeechRecognitionEventLike = { resultIndex?: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorEventLike = { error?: string };
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export default function AppointmentsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setCurrentUser(storage.getUser());
    setHasHydrated(true);
  }, []);
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const isClinicAdmin = currentUser?.role === "ClinicAdmin";
  const canManageAppointments = hasPermission(currentUser, "appointments.manage");
  const canOpenMedicalFile = isClinicAdmin || hasPermission(currentUser, "specialty_assessments.manage");
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const [formExpanded, setFormExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [medicalFileAppointment, setMedicalFileAppointment] = useState<AppointmentMedicalRecordContext | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentRow | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<{ name: string; whatsapp: string } | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [isWhatsappSpeechSupported, setIsWhatsappSpeechSupported] = useState(false);
  const [isWhatsappListening, setIsWhatsappListening] = useState(false);
  const [whatsappVoiceLevel, setWhatsappVoiceLevel] = useState(0);
  const whatsappSpeechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const whatsappSpeechBaseMessageRef = useRef("");
  const whatsappMessageRef = useRef("");
  const whatsappSpeechFinalTranscriptRef = useRef("");
  const whatsappMessageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const whatsappListeningRequestedRef = useRef(false);
  const whatsappAutoRestartRef = useRef(false);
  const whatsappRestartTimerRef = useRef<number | null>(null);
  const whatsappLastSpeechErrorToastAtRef = useRef(0);
  const whatsappAudioContextRef = useRef<AudioContext | null>(null);
  const whatsappAnalyserRef = useRef<AnalyserNode | null>(null);
  const whatsappAudioStreamRef = useRef<MediaStream | null>(null);
  const whatsappRafRef = useRef<number | null>(null);
  const [appointmentFilterDraft, setAppointmentFilterDraft] = useState(() => emptyAppointmentListQuery());
  const debouncedAppointmentFilters = useDebounce(appointmentFilterDraft, 400);
  const [form, setForm] = useState({
    patientId: "",
    specialtyCode: "",
    doctorId: "",
    appointmentDate: "",
    appointmentTime: "",
    entryType: "EXAM" as VisitEntryType,
    status: "SCHEDULED",
    reason: "",
    notes: ""
  });

  const queryScopeClinicId = isSuperAdmin ? selectedClinicId : `mine:${currentUser?.clinicId ?? "unknown"}`;
  const queryViewerId = currentUser?.id ?? "anonymous";
  const queryViewerRole = currentUser?.role ?? "unknown";
  const isQueryScopeReady = hasHydrated && Boolean(currentUser);
  const appointmentClinicScope = isSuperAdmin && selectedClinicId !== "all" ? selectedClinicId : undefined;
  const formScopeReady = isQueryScopeReady && canManageAppointments && (!isSuperAdmin || selectedClinicId !== "all");

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-filter"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin && isQueryScopeReady
  });

  const appointmentsQuery = useQuery({
    queryKey: [
      "appointments",
      "list",
      {
        page: 1,
        clinicScope: queryScopeClinicId,
        viewerId: queryViewerId,
        viewerRole: queryViewerRole,
        filters: debouncedAppointmentFilters
      }
    ],
    queryFn: () => appointmentService.list(appointmentClinicScope, debouncedAppointmentFilters),
    enabled: isQueryScopeReady,
    staleTime: 5_000,
    refetchOnMount: "always",
    placeholderData: keepPreviousData
  });
  const clinicSpecialtiesQuery = useQuery({
    queryKey: ["appointments", "clinic-specialties", { clinicScope: queryScopeClinicId }],
    queryFn: () => specialtyService.listMyClinicSpecialties(appointmentClinicScope),
    enabled: formScopeReady
  });
  const selectedSpecialtyCode = form.specialtyCode.trim();
  const selectedSpecialtyName = useMemo(
    () =>
      (clinicSpecialtiesQuery.data ?? [])
        .map((item) => item.specialty)
        .find((specialty) => specialty.code === selectedSpecialtyCode)?.name ?? "",
    [clinicSpecialtiesQuery.data, selectedSpecialtyCode]
  );
  const doctorsQuery = useQuery({
    queryKey: [
      "appointments",
      "doctors",
      {
        clinicScope: queryScopeClinicId,
        viewerId: queryViewerId,
        viewerRole: queryViewerRole,
        specialtyCode: selectedSpecialtyCode || "all"
      }
    ],
    queryFn: () => doctorService.list(appointmentClinicScope, selectedSpecialtyName || undefined),
    enabled: formScopeReady
  });
  const patientsQuery = useQuery({
    queryKey: [
      "appointments",
      "patients",
      { clinicScope: queryScopeClinicId, viewerId: queryViewerId, viewerRole: queryViewerRole }
    ],
    queryFn: () => patientService.list(appointmentClinicScope),
    enabled: formScopeReady
  });

  const mutationClinicScope = isSuperAdmin ? (selectedClinicId === "all" ? undefined : selectedClinicId) : undefined;

  const resetForm = useCallback(() => {
    setForm({
      patientId: "",
      specialtyCode: "",
      doctorId: "",
      appointmentDate: "",
      appointmentTime: "",
      entryType: "EXAM",
      status: "SCHEDULED",
      reason: "",
      notes: ""
    });
    setEditingId(null);
  }, []);

  const toLocalInput = (isoText: string) => {
    const date = new Date(isoText);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`;
  };
  const buildAppointmentWindowIso = (dateText: string, timeText: string) => {
    const startDate = new Date(`${dateText}T${timeText}`);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
    return {
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString()
    };
  };

  const data: AppointmentRow[] = useMemo(
    () =>
      appointmentsQuery.data?.map((item) => ({
        id: item.id,
        clinicId: item.clinicId,
        patientId: item.patient?.id ?? "",
        doctorId: item.doctor?.id ?? "",
        specialtyCode: item.specialty?.code ?? "",
        patient: item.patient?.fullName ?? "-",
        doctor: `${item.doctor?.user?.firstName ?? ""} ${item.doctor?.user?.lastName ?? ""}`.trim() || "-",
        doctorSpecialty: item.doctor?.specialty ?? "",
        startsAtIso: item.startsAt,
        endsAtIso: item.endsAt,
        start: new Date(item.startsAt).toLocaleString(),
        status: item.status,
        entryType: item.entryType,
        reason: item.reason ?? "",
        notes: item.notes ?? "",
        patientPhone: item.patient?.phone ?? "",
        patientWhatsapp: item.patient?.whatsapp ?? "",
        patientNationalId: item.patient?.nationalId ?? "",
        patientDateOfBirth: item.patient?.dateOfBirth ?? "",
        patientAge: item.patient?.age ?? null,
        patientAddress: item.patient?.address ?? "",
        patientProfession: item.patient?.profession ?? "",
        patientLeadSource: item.patient?.leadSource ?? "",
        patientFileNumber: item.patient?.fileNumber ?? null
      })) ?? [],
    [appointmentsQuery.data]
  );

  const specialtyOptions = useMemo(
    () =>
      (clinicSpecialtiesQuery.data ?? [])
        .filter((item) => item.specialty?.isActive)
        .map((item) => ({
          code: item.specialty.code,
          name: item.specialty.name,
          label: locale === "ar" ? item.specialty.nameAr : item.specialty.name
        })),
    [clinicSpecialtiesQuery.data, locale]
  );
  const statusLabel = (status: string) => {
    const key = `status.${status}`;
    const translated = t(key);
    return translated === key ? status : translated;
  };
  const entryTypeLabel = (entryType: VisitEntryType) =>
    entryType === "EXAM" ? t("appointments.entryType.exam") : t("appointments.entryType.consultation");
  const normalizeWhatsappNumber = useCallback((value: string) => {
    const DEFAULT_COUNTRY_CODE = "20"; // Egypt default; accepts explicit international numbers too.
    const sanitized = value.replace(/[^\d+]/g, "");
    if (!sanitized) return "";

    let digits = sanitized.startsWith("+") ? sanitized.slice(1) : sanitized;
    digits = digits.replace(/[^\d]/g, "");
    if (digits.startsWith("00")) {
      digits = digits.slice(2);
    }
    if (digits.startsWith("0")) {
      digits = `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
    }
    if (!digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length <= 10) {
      digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
    }
    return digits;
  }, []);
  const openWhatsappPopup = useCallback(
    (row: AppointmentRow) => {
      if (!row.patientWhatsapp || row.patientWhatsapp === "-") {
        toast.error(t("patients.whatsappPopup.missingNumber"));
        return;
      }
      setWhatsappTarget({ name: row.patient, whatsapp: row.patientWhatsapp });
      const nextMessage = t("patients.whatsappPopup.defaultMessage", { name: row.patient });
      whatsappMessageRef.current = nextMessage;
      setWhatsappMessage(nextMessage);
    },
    [t]
  );
  useEffect(() => {
    whatsappMessageRef.current = whatsappMessage;
  }, [whatsappMessage]);
  const openWhatsappChat = useCallback(() => {
    if (!whatsappTarget) return;
    const normalizedNumber = normalizeWhatsappNumber(whatsappTarget.whatsapp || "");
    if (!normalizedNumber) {
      toast.error(t("patients.whatsappPopup.invalidNumber"));
      return;
    }
    const message = (whatsappMessage || "").trim();
    const encodedMessage = encodeURIComponent(message);
    const url = encodedMessage
      ? `https://api.whatsapp.com/send/?phone=${normalizedNumber}&text=${encodedMessage}&type=phone_number&app_absent=0`
      : `https://api.whatsapp.com/send/?phone=${normalizedNumber}&type=phone_number&app_absent=0`;
    window.open(url, "_blank", "noopener,noreferrer");
    setWhatsappTarget(null);
  }, [normalizeWhatsappNumber, t, whatsappMessage, whatsappTarget]);
  const stopWhatsappSpeechInput = useCallback(() => {
    whatsappListeningRequestedRef.current = false;
    whatsappAutoRestartRef.current = false;
    if (whatsappRestartTimerRef.current !== null) {
      window.clearTimeout(whatsappRestartTimerRef.current);
      whatsappRestartTimerRef.current = null;
    }
    if (whatsappRafRef.current !== null) {
      cancelAnimationFrame(whatsappRafRef.current);
      whatsappRafRef.current = null;
    }
    whatsappAnalyserRef.current = null;
    if (whatsappAudioStreamRef.current) {
      whatsappAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      whatsappAudioStreamRef.current = null;
    }
    if (whatsappAudioContextRef.current) {
      void whatsappAudioContextRef.current.close();
      whatsappAudioContextRef.current = null;
    }
    setWhatsappVoiceLevel(0);
    try {
      whatsappSpeechRecognitionRef.current?.stop();
    } catch {
      // Ignore stop errors (already stopped, etc).
    }
  }, []);
  const closeWhatsappPopup = useCallback(() => {
    stopWhatsappSpeechInput();
    setWhatsappTarget(null);
  }, [stopWhatsappSpeechInput]);
  useEffect(() => {
    if (!whatsappTarget) {
      stopWhatsappSpeechInput();
    }
  }, [stopWhatsappSpeechInput, whatsappTarget]);
  const startWhatsappSpeechInput = useCallback(() => {
    if (!isWhatsappSpeechSupported) {
      toast.error(t("patients.whatsappPopup.speechNotSupported"));
      return;
    }
    if (isWhatsappListening) return;
    const recognition = whatsappSpeechRecognitionRef.current;
    if (!recognition) {
      toast.error(t("patients.whatsappPopup.speechNotSupported"));
      return;
    }
    whatsappListeningRequestedRef.current = true;
    whatsappAutoRestartRef.current = true;
    whatsappSpeechBaseMessageRef.current = whatsappMessageRef.current.trim();
    whatsappSpeechFinalTranscriptRef.current = "";
    recognition.lang = locale === "ar" ? "ar-EG" : "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    try {
      const textarea = whatsappMessageInputRef.current;
      if (textarea) {
        textarea.focus();
        const textLength = textarea.value.length;
        textarea.setSelectionRange(textLength, textLength);
      }
      void (async () => {
        try {
          if (whatsappRafRef.current !== null) {
            cancelAnimationFrame(whatsappRafRef.current);
            whatsappRafRef.current = null;
          }
          if (whatsappAudioStreamRef.current) {
            whatsappAudioStreamRef.current.getTracks().forEach((track) => track.stop());
          }
          if (whatsappAudioContextRef.current) {
            await whatsappAudioContextRef.current.close();
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
          });
          const audioContext = new AudioContext();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.7;
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          const buffer = new Uint8Array(analyser.fftSize);
          whatsappAudioStreamRef.current = stream;
          whatsappAudioContextRef.current = audioContext;
          whatsappAnalyserRef.current = analyser;
          const tick = () => {
            const activeAnalyser = whatsappAnalyserRef.current;
            if (!activeAnalyser || !whatsappListeningRequestedRef.current) {
              setWhatsappVoiceLevel(0);
              return;
            }
            activeAnalyser.getByteTimeDomainData(buffer);
            let sum = 0;
            for (let i = 0; i < buffer.length; i += 1) {
              const normalized = (buffer[i] - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / buffer.length);
            const boosted = Math.min(1, rms * 6);
            setWhatsappVoiceLevel(boosted);
            whatsappRafRef.current = requestAnimationFrame(tick);
          };
          whatsappRafRef.current = requestAnimationFrame(tick);
        } catch {
          setWhatsappVoiceLevel(0);
        }
      })();
      recognition.start();
    } catch {
      whatsappListeningRequestedRef.current = false;
      toast.error(t("patients.whatsappPopup.speechFailed"));
    }
  }, [isWhatsappListening, isWhatsappSpeechSupported, locale, t]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor =
      ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition) ||
      null;
    if (!SpeechRecognitionCtor) {
      setIsWhatsappSpeechSupported(false);
      whatsappSpeechRecognitionRef.current = null;
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.onstart = () => {
      setIsWhatsappListening(true);
      whatsappSpeechBaseMessageRef.current = whatsappMessageRef.current.trim();
      whatsappSpeechFinalTranscriptRef.current = "";
    };
    recognition.onend = () => {
      setIsWhatsappListening(false);
      whatsappSpeechBaseMessageRef.current = whatsappMessageRef.current.trim();
      if (!whatsappListeningRequestedRef.current || !whatsappAutoRestartRef.current) return;
      whatsappRestartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          // Ignore auto-restart errors if already restarting.
        }
      }, 80);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      setIsWhatsappListening(false);
      const errorType = String(event?.error ?? "");
      if (errorType === "aborted") return;
      const fatalErrors = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network"]);
      if (fatalErrors.has(errorType)) {
        whatsappListeningRequestedRef.current = false;
        whatsappAutoRestartRef.current = false;
      }
      const now = Date.now();
      if (fatalErrors.has(errorType) && now - whatsappLastSpeechErrorToastAtRef.current > 2000) {
        whatsappLastSpeechErrorToastAtRef.current = now;
        toast.error(t("patients.whatsappPopup.speechFailed"));
      }
    };
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interimTranscript = "";
      const startIndex = Math.max(0, Number(event.resultIndex ?? 0));
      for (let i = startIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const chunk = String(result?.[0]?.transcript ?? "").trim();
        if (!chunk) continue;
        if (result.isFinal) {
          whatsappSpeechFinalTranscriptRef.current = `${whatsappSpeechFinalTranscriptRef.current} ${chunk}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${chunk}`.trim();
        }
      }
      const mergedSpeech = `${whatsappSpeechFinalTranscriptRef.current} ${interimTranscript}`.trim();
      const base = whatsappSpeechBaseMessageRef.current;
      const nextMessage = base && mergedSpeech ? `${base} ${mergedSpeech}`.trim() : (base || mergedSpeech).trim();
      whatsappMessageRef.current = nextMessage;
      setWhatsappMessage(nextMessage);
    };
    whatsappSpeechRecognitionRef.current = recognition;
    setIsWhatsappSpeechSupported(true);
    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore cleanup stop errors.
      }
      if (whatsappRafRef.current !== null) {
        cancelAnimationFrame(whatsappRafRef.current);
      }
      if (whatsappRestartTimerRef.current !== null) {
        window.clearTimeout(whatsappRestartTimerRef.current);
        whatsappRestartTimerRef.current = null;
      }
      if (whatsappAudioStreamRef.current) {
        whatsappAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (whatsappAudioContextRef.current) {
        void whatsappAudioContextRef.current.close();
      }
      whatsappListeningRequestedRef.current = false;
      whatsappAutoRestartRef.current = false;
      setWhatsappVoiceLevel(0);
      whatsappSpeechRecognitionRef.current = null;
      setIsWhatsappListening(false);
    };
  }, [t]);
  const openMedicalFile = useCallback(
    (row: AppointmentRow) => {
      if (!row.patientId) {
        toast.error(t("appointments.medicalFile.patientMissing"));
        return;
      }
      if (!row.clinicId) {
        toast.error(t("appointments.medicalFile.clinicMissing"));
        return;
      }
      setMedicalFileAppointment({ id: row.id, clinicId: row.clinicId });
    },
    [t]
  );

  const createMutation = useMutation({
    mutationFn: () => {
      const { startsAt, endsAt } = buildAppointmentWindowIso(form.appointmentDate, form.appointmentTime);
      return appointmentService.create(
        {
          patientId: form.patientId,
          doctorId: form.doctorId,
          specialtyCode: form.specialtyCode,
          startsAt,
          endsAt,
          entryType: form.entryType,
          status: form.status as "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
          reason: form.reason.trim() || undefined,
          notes: form.notes.trim() || undefined
        },
        mutationClinicScope
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(t("appointments.created"));
      resetForm();
      setFormExpanded(false);
    },
    onError: () => toast.error(t("appointments.createFailed"))
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const { startsAt, endsAt } = buildAppointmentWindowIso(form.appointmentDate, form.appointmentTime);
      return appointmentService.update(
        String(editingId),
        {
          patientId: form.patientId,
          doctorId: form.doctorId,
          specialtyCode: form.specialtyCode,
          startsAt,
          endsAt,
          entryType: form.entryType,
          status: form.status as "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
          reason: form.reason.trim(),
          notes: form.notes.trim()
        },
        mutationClinicScope
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(t("appointments.updated"));
      resetForm();
      setFormExpanded(false);
    },
    onError: () => toast.error(t("appointments.updateFailed"))
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => appointmentService.remove(id, mutationClinicScope),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setDeleteTarget(null);
      toast.success(t("appointments.deleted"));
    },
    onError: () => toast.error(t("appointments.deleteFailed"))
  });

  const startEdit = useCallback((row: AppointmentRow) => {
    const localStart = toLocalInput(row.startsAtIso);
    const selectedDoctor = (doctorsQuery.data ?? []).find((doctor) => doctor.id === row.doctorId);
    const mappedSpecialtyCode =
      row.specialtyCode ||
      specialtyOptions.find((option) => option.name === (selectedDoctor?.specialty ?? row.doctorSpecialty))?.code ||
      "";
    setEditingId(row.id);
    setForm({
      patientId: row.patientId,
      specialtyCode: mappedSpecialtyCode,
      doctorId: row.doctorId,
      appointmentDate: localStart.slice(0, 10),
      appointmentTime: localStart.slice(11, 16),
      entryType: row.entryType,
      status: row.status,
      reason: row.reason,
      notes: row.notes
    });
    setFormExpanded(true);
  }, [doctorsQuery.data, specialtyOptions]);

  const columns: ColumnDef<AppointmentRow>[] = [
    { header: t("nav.patients"), accessorKey: "patient" },
    { header: t("nav.doctors"), accessorKey: "doctor" },
    {
      header: t("appointments.entryType"),
      id: "entryType",
      cell: ({ row }) => entryTypeLabel(row.original.entryType)
    },
    { header: "Start Time", accessorKey: "start" },
    {
      header: t("field.status"),
      id: "status",
      cell: ({ row }) => statusLabel(row.original.status)
    },
    ...(canManageAppointments || canOpenMedicalFile
      ? [
          {
            header: "Actions",
            id: "actions",
            cell: ({ row }: { row: { original: AppointmentRow } }) => (
              <div className="flex items-center gap-2">
                {canOpenMedicalFile ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                    onClick={() => openMedicalFile(row.original)}
                  >
                    <ClipboardList size={12} />
                    {t("patients.assessment.open")}
                  </button>
                ) : null}
                {canManageAppointments ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100"
                  onClick={() => startEdit(row.original)}
                  aria-label="Edit appointment"
                >
                  <SquarePen size={13} />
                </button>
                ) : null}
                {canManageAppointments ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                  onClick={() => setDeleteTarget(row.original)}
                  aria-label="Delete appointment"
                >
                  <Trash2 size={13} />
                </button>
                ) : null}
              </div>
            )
          }
        ]
      : [])
  ];

  const formBlock = canManageAppointments && formExpanded ? (
    <section className="card mb-3 bg-white/80 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          value={form.patientId}
          onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}
        >
          <option value="">{t("appointments.choosePatient")}</option>
          {(patientsQuery.data ?? []).map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.fullName}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          value={form.specialtyCode}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              specialtyCode: event.target.value,
              doctorId: ""
            }))
          }
        >
          <option value="">{t("appointments.chooseSpecialty")}</option>
          {specialtyOptions.map((specialty) => (
            <option key={specialty.code} value={specialty.code}>
              {specialty.label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          value={form.doctorId}
          onChange={(event) => setForm((prev) => ({ ...prev, doctorId: event.target.value }))}
          disabled={!form.specialtyCode}
        >
          <option value="">
            {form.specialtyCode ? t("appointments.chooseDoctor") : t("appointments.chooseSpecialty")}
          </option>
          {(doctorsQuery.data ?? []).map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {`${doctor.user?.firstName ?? ""} ${doctor.user?.lastName ?? ""}`.trim() || t("nav.doctors")}
            </option>
          ))}
          {form.specialtyCode && !(doctorsQuery.data ?? []).length ? (
            <option value="" disabled>
              {t("appointments.noDoctorsForSpecialty")}
            </option>
          ) : null}
        </select>
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          type="date"
          value={form.appointmentDate}
          onChange={(event) => setForm((prev) => ({ ...prev, appointmentDate: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          type="time"
          value={form.appointmentTime}
          onChange={(event) => setForm((prev) => ({ ...prev, appointmentTime: event.target.value }))}
        />
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          value={form.entryType}
          onChange={(event) => setForm((prev) => ({ ...prev, entryType: event.target.value as VisitEntryType }))}
        >
          <option value="EXAM">{t("appointments.entryType.exam")}</option>
          <option value="CONSULTATION">{t("appointments.entryType.consultation")}</option>
        </select>
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          value={form.status}
          onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
        >
          {["SCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"].map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:col-span-2"
          placeholder={t("appointments.reason")}
          value={form.reason}
          onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
        />
        <textarea
          className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:col-span-2"
          placeholder={t("appointments.notes")}
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <RippleButton
          type="button"
          className="h-10 text-sm"
          disabled={
            (isSuperAdmin && selectedClinicId === "all") ||
            !form.patientId ||
            !form.specialtyCode ||
            !form.doctorId ||
            !form.appointmentDate ||
            !form.appointmentTime ||
            createMutation.isPending ||
            updateMutation.isPending
          }
          onClick={() => {
            if (isSuperAdmin && selectedClinicId === "all") {
              toast.error(t("doctors.selectClinicScope"));
              return;
            }
            if (editingId) {
              updateMutation.mutate();
            } else {
              createMutation.mutate();
            }
          }}
        >
          {editingId ? t("appointments.update") : t("appointments.create")}
        </RippleButton>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={() => {
            resetForm();
            setFormExpanded(false);
          }}
        >
          {t("common.close")}
        </button>
      </div>
    </section>
  ) : null;

  return (
    <RoleGate requiredPermissions={["appointments.read"]} fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}>
    <AppShell>
      {isSuperAdmin ? (
        <section className="mb-4 card bg-white/80 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">{t("dashboard.clinicScope")}</p>
            <select
              className="h-11 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
              value={selectedClinicId}
              onChange={(event) => setSelectedClinicId(event.target.value)}
            >
              <option value="all">{t("common.allClinics")}</option>
              {(clinicsQuery.data ?? []).map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}
      <Suspense
        fallback={
          <section className="space-y-3">
            <Skeleton className="h-9 w-48 rounded-lg" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </section>
        }
      >
        <EntityCollectionView
          title={t("nav.appointments")}
          columns={columns}
          data={data}
          storageKey="appointment-view"
          skipLocalFiltering
          belowHeader={formBlock}
          listLoading={isQueryScopeReady && appointmentsQuery.isLoading}
          searchSlot={
            <AppointmentSearchBar
              value={appointmentFilterDraft}
              onChange={setAppointmentFilterDraft}
              onClear={() => setAppointmentFilterDraft(emptyAppointmentListQuery())}
            />
          }
          statusOptions={[{ label: t("common.allStatuses"), value: "all" }]}
          searchPlaceholder={`${t("common.search")} ${t("nav.appointments")}`}
          addButton={
            canManageAppointments ? (
              <RippleButton
                onClick={() => {
                  resetForm();
                  setFormExpanded((prev) => !prev);
                }}
              >
                {formExpanded ? t("common.close") : `+ ${t("nav.appointments")}`}
              </RippleButton>
            ) : undefined
          }
          getSearchText={(row) => `${row.patient} ${row.doctor} ${row.start} ${row.status} ${row.entryType}`}
          getStatus={(row) => row.status}
          getDate={(row) => row.start.slice(0, 10)}
          renderCard={(row) => (
          <div className="space-y-3 rounded-2xl border border-slate-200/80 border-l-4 border-l-orange-500 bg-gradient-to-br from-white to-orange-50/30 p-4 shadow-sm transition hover:shadow-md">
            <h3 className="text-base font-bold text-slate-900">{row.patient}</h3>
            <p className="text-sm font-medium text-slate-600">{row.doctor}</p>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
              <p className="text-xs font-medium text-slate-600">
                {t("field.phone")}: <span className="font-semibold text-slate-800">{row.patientPhone || t("patients.card.notSet")}</span>
              </p>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => openWhatsappPopup(row)}
                disabled={!row.patientWhatsapp || row.patientWhatsapp === "-"}
                aria-label={t("patients.whatsappPopup.open")}
              >
                <FaWhatsapp size={13} />
                <span>{row.patientWhatsapp || t("patients.card.notSet")}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 font-semibold text-orange-700">
                {entryTypeLabel(row.entryType)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
                {row.start}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                {statusLabel(row.status)}
              </span>
            </div>
            {canManageAppointments || canOpenMedicalFile ? (
              <div className="flex items-center gap-2 pt-1">
                {canOpenMedicalFile ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 px-2.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                    onClick={() => openMedicalFile(row)}
                  >
                    <ClipboardList size={12} />
                    {t("patients.assessment.open")}
                  </button>
                ) : null}
                {canManageAppointments ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100"
                  onClick={() => startEdit(row)}
                  aria-label="Edit appointment"
                >
                  <SquarePen size={13} />
                </button>
                ) : null}
                {canManageAppointments ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                  onClick={() => setDeleteTarget(row)}
                  aria-label="Delete appointment"
                >
                  <Trash2 size={13} />
                </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        />
      </Suspense>
      <MedicalRecordModal
        open={Boolean(medicalFileAppointment)}
        mode="appointment"
        appointmentContext={medicalFileAppointment}
        clinicScope={appointmentClinicScope ?? medicalFileAppointment?.clinicId}
        onClose={() => setMedicalFileAppointment(null)}
      />
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={t("appointments.deleteConfirmTitle")}
        message={t("appointments.deleteConfirmMessage", { name: deleteTarget?.patient ?? "-" })}
        confirmLabel={t("appointments.delete")}
        confirmingLabel={t("appointments.deleting")}
        isPending={removeMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          removeMutation.mutate(deleteTarget.id);
        }}
      />
      {whatsappTarget ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("patients.whatsappPopup.closeAria")}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeWhatsappPopup}
          />
          <section className="relative w-full max-w-lg rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 shadow-premium">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                  <FaWhatsapp size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-900">{t("patients.whatsappPopup.title")}</p>
                  <p className="text-sm text-slate-600">
                    {t("patients.whatsappPopup.to")}:{" "}
                    <span className="font-semibold text-slate-800">
                      {whatsappTarget.name} ({whatsappTarget.whatsapp || t("patients.card.notSet")})
                    </span>
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-slate-700">{t("patients.whatsappPopup.messageLabel")}</label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={isWhatsappListening ? stopWhatsappSpeechInput : startWhatsappSpeechInput}
                    disabled={!isWhatsappSpeechSupported}
                  >
                    {isWhatsappListening ? <Square size={12} /> : <Mic size={12} />}
                    {isWhatsappListening
                      ? t("patients.whatsappPopup.stopRecording")
                      : t("patients.whatsappPopup.startRecording")}
                  </button>
                </div>
                {isWhatsappListening ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
                    <div className="flex items-end gap-1">
                      {Array.from({ length: 20 }).map((_, idx) => {
                        const wave = Math.max(0.12, Math.min(1, whatsappVoiceLevel * (0.5 + (idx % 5) * 0.14)));
                        return (
                          <span
                            key={`voice-bar-${idx}`}
                            className="w-1 rounded-full bg-emerald-500/90 transition-all duration-75"
                            style={{ height: `${Math.round(6 + wave * 22)}px` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {!isWhatsappSpeechSupported ? (
                  <p className="text-xs text-slate-500">{t("patients.whatsappPopup.speechNotSupported")}</p>
                ) : null}
                <textarea
                  ref={whatsappMessageInputRef}
                  value={whatsappMessage}
                  onChange={(event) => {
                    const nextMessage = event.target.value;
                    whatsappMessageRef.current = nextMessage;
                    whatsappSpeechBaseMessageRef.current = nextMessage.trim();
                    setWhatsappMessage(nextMessage);
                  }}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder={t("patients.whatsappPopup.messagePlaceholder")}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={closeWhatsappPopup}
                >
                  {t("patients.whatsappPopup.cancel")}
                </button>
                <RippleButton type="button" className="from-emerald-600 to-emerald-500 hover:shadow-emerald-500/30" onClick={openWhatsappChat}>
                  <span className="inline-flex items-center gap-2">
                    <FaWhatsapp size={14} />
                    {t("patients.whatsappPopup.send")}
                  </span>
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
