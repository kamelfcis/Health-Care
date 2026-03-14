"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronDown,
  ClipboardList,
  Loader2,
  MapPin,
  Mic,
  PhoneCall,
  PhoneOff,
  PhoneOutgoing,
  Square,
  SquarePen,
  Trash2,
  TriangleAlert,
  User,
  UserPlus,
  Users
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { AppShell } from "@/components/layout/app-shell";
import { PatientForm, PatientFormValues } from "@/components/forms/patient-form";
import { SpecialtyAssessmentForm } from "@/components/forms/specialty-assessment-form";
import { RippleButton } from "@/components/ui/ripple-button";
import { toast } from "sonner";
import { EntityCollectionView } from "@/components/ui/entity-collection-view";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService } from "@/lib/clinic-service";
import { appointmentService } from "@/lib/appointment-service";
import { patientService, PatientStats } from "@/lib/patient-service";
import { storage } from "@/lib/storage";
import { StatCard } from "@/components/ui/stat-card";
import { RoleGate } from "@/components/auth/role-gate";
import { cn } from "@/lib/utils";
import { specialtyService, VisitEntryType } from "@/lib/specialty-service";
import { MedicalRecordModal, PatientMedicalRecordContext } from "@/components/appointments/medical-record-modal";

type PatientRow = {
  id: string;
  name: string;
  nationalId?: string | null;
  phone: string;
  whatsapp: string;
  fileNumber: number;
  age: number | null;
  profession: string;
  professionOther?: string | null;
  leadSource: string;
  leadSourceOther?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  clinicName?: string;
  lastVisit: string;
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

export default function PatientsPage() {
  const { locale, t } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const [formExpanded, setFormExpanded] = useState(false);
  const [editing, setEditing] = useState<PatientRow | null>(null);
  const [assessmentPatient, setAssessmentPatient] = useState<PatientRow | null>(null);
  const [medicalRecordPatient, setMedicalRecordPatient] = useState<PatientMedicalRecordContext | null>(null);
  const [selectedAssessmentSpecialtyCode, setSelectedAssessmentSpecialtyCode] = useState<string>("");
  const [selectedAssessmentEntryType, setSelectedAssessmentEntryType] = useState<VisitEntryType>("EXAM");
  const [deleteTarget, setDeleteTarget] = useState<PatientRow | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<PatientRow | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [isWhatsappSpeechSupported, setIsWhatsappSpeechSupported] = useState(false);
  const [isWhatsappListening, setIsWhatsappListening] = useState(false);
  const [whatsappVoiceLevel, setWhatsappVoiceLevel] = useState(0);
  const whatsappSpeechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const whatsappSpeechBaseMessageRef = useRef("");
  const whatsappMessageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const whatsappListeningRequestedRef = useRef(false);
  const whatsappAutoRestartRef = useRef(false);
  const whatsappRestartTimerRef = useRef<number | null>(null);
  const whatsappLastSpeechErrorToastAtRef = useRef(0);
  const whatsappAudioContextRef = useRef<AudioContext | null>(null);
  const whatsappAnalyserRef = useRef<AnalyserNode | null>(null);
  const whatsappAudioStreamRef = useRef<MediaStream | null>(null);
  const whatsappRafRef = useRef<number | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const formRef = useRef<HTMLElement | null>(null);
  const assessmentRef = useRef<HTMLElement | null>(null);
  const scrollToFormTop = useCallback(() => {
    const formEl = formRef.current;
    if (!formEl) return;

    const scrollContainer = formEl.closest("main");
    if (!(scrollContainer instanceof HTMLElement)) {
      formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const formRect = formEl.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetTop = scrollContainer.scrollTop + (formRect.top - containerRect.top) - 8;
    scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, []);
  const scrollToAssessmentTop = useCallback(() => {
    const assessmentEl = assessmentRef.current;
    if (!assessmentEl) return;

    const scrollContainer = assessmentEl.closest("main");
    if (!(scrollContainer instanceof HTMLElement)) {
      assessmentEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const assessmentRect = assessmentEl.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetTop = scrollContainer.scrollTop + (assessmentRect.top - containerRect.top) - 8;
    scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, []);
  useEffect(() => {
    if (!assessmentPatient) return;
    const timeout = setTimeout(() => {
      scrollToAssessmentTop();
    }, 0);
    return () => clearTimeout(timeout);
  }, [assessmentPatient, scrollToAssessmentTop]);
  const statsFallback: PatientStats = {
    totalPatients: 0,
    newThisMonth: 0,
    withContactInfo: 0,
    withoutContactInfo: 0
  };
  const specialtyClinicScope = isSuperAdmin && selectedClinicId !== "all" ? selectedClinicId : undefined;
  const appointmentMutationClinicScope = isSuperAdmin ? (selectedClinicId === "all" ? undefined : selectedClinicId) : undefined;

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-filter"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin
  });

  const patientsQuery = useQuery({
    queryKey: ["patients", { page: 1, pageSize: 500, clinicId: selectedClinicId }],
    queryFn: () => patientService.list(selectedClinicId === "all" ? undefined : selectedClinicId)
  });

  const statsQuery = useQuery({
    queryKey: ["patients", "stats", selectedClinicId],
    queryFn: () => patientService.stats(selectedClinicId === "all" ? undefined : selectedClinicId)
  });

  const assessmentScopeReady = !isSuperAdmin || selectedClinicId !== "all";
  const clinicSpecialtiesQuery = useQuery({
    queryKey: ["specialties", "clinic", "assessment", specialtyClinicScope ?? selectedClinicId],
    queryFn: () => specialtyService.listMyClinicSpecialties(specialtyClinicScope),
    enabled: assessmentScopeReady
  });
  const assessmentSpecialties = useMemo(
    () => (clinicSpecialtiesQuery.data ?? []).map((item) => item.specialty),
    [clinicSpecialtiesQuery.data]
  );
  const specialtyPreferenceScope = isSuperAdmin ? selectedClinicId : currentUser?.clinicId ?? "default";
  const specialtyPreferenceKey = `patients.assessment.specialty.${specialtyPreferenceScope}`;
  useEffect(() => {
    if (!assessmentSpecialties.length) {
      setSelectedAssessmentSpecialtyCode("");
      return;
    }
    const hasSelected = assessmentSpecialties.some((specialty) => specialty.code === selectedAssessmentSpecialtyCode);
    if (hasSelected) return;
    let remembered = "";
    try {
      remembered = localStorage.getItem(specialtyPreferenceKey) ?? "";
    } catch {
      remembered = "";
    }
    const rememberedValid = assessmentSpecialties.some((specialty) => specialty.code === remembered);
    setSelectedAssessmentSpecialtyCode(rememberedValid ? remembered : assessmentSpecialties[0]!.code);
  }, [assessmentSpecialties, selectedAssessmentSpecialtyCode, specialtyPreferenceKey]);
  useEffect(() => {
    if (!selectedAssessmentSpecialtyCode) return;
    try {
      localStorage.setItem(specialtyPreferenceKey, selectedAssessmentSpecialtyCode);
    } catch {
      // Ignore storage failures (private mode/locked storage).
    }
  }, [selectedAssessmentSpecialtyCode, specialtyPreferenceKey]);
  const selectedAssessmentSpecialty = useMemo(
    () => assessmentSpecialties.find((specialty) => specialty.code === selectedAssessmentSpecialtyCode) ?? null,
    [assessmentSpecialties, selectedAssessmentSpecialtyCode]
  );
  const selectedAssessmentSpecialtyName = selectedAssessmentSpecialty
    ? locale === "ar"
      ? selectedAssessmentSpecialty.nameAr
      : selectedAssessmentSpecialty.name
    : "-";

  const specialtyTemplateQuery = useQuery({
    queryKey: ["patients", "specialty", selectedAssessmentSpecialtyCode, "template", assessmentPatient?.id, specialtyClinicScope],
    queryFn: () =>
      specialtyService.getPatientSpecialtyTemplate(
        String(assessmentPatient?.id),
        selectedAssessmentSpecialtyCode,
        specialtyClinicScope
      ),
    enabled: Boolean(assessmentPatient) && Boolean(selectedAssessmentSpecialtyCode) && assessmentScopeReady
  });

  const specialtyAssessmentQuery = useQuery({
    queryKey: [
      "patients",
      "specialty",
      selectedAssessmentSpecialtyCode,
      "assessment",
      selectedAssessmentEntryType,
      assessmentPatient?.id,
      specialtyClinicScope
    ],
    queryFn: () =>
      specialtyService.getPatientSpecialtyAssessment(
        String(assessmentPatient?.id),
        selectedAssessmentSpecialtyCode,
        selectedAssessmentEntryType,
        specialtyClinicScope
      ),
    enabled: Boolean(assessmentPatient) && Boolean(selectedAssessmentSpecialtyCode) && assessmentScopeReady
  });

  const rows: PatientRow[] =
    patientsQuery.data?.map((item) => ({
      id: item.id,
      name: item.fullName,
      nationalId: item.nationalId ?? null,
      phone: item.phone,
      whatsapp: item.whatsapp ?? "-",
      fileNumber: item.fileNumber,
      age: item.age ?? null,
      profession: item.profession,
      professionOther: item.professionOther ?? null,
      leadSource: item.leadSource,
      leadSourceOther: item.leadSourceOther ?? null,
      dateOfBirth: item.dateOfBirth ?? null,
      address: item.address ?? null,
      clinicName: item.clinic?.name,
      lastVisit: item.lastVisitAt ? String(item.lastVisitAt).slice(0, 10) : "-",
    })) ?? [];

  const stats = statsQuery.data ?? statsFallback;
  const loading = patientsQuery.isLoading || statsQuery.isLoading;
  const getProfessionLabel = useCallback(
    (row: PatientRow) =>
      row.profession === "OTHER"
        ? row.professionOther || t("patients.profession.OTHER")
        : t(`patients.profession.${row.profession}`),
    [t]
  );
  const getLeadSourceLabel = useCallback(
    (row: PatientRow) =>
      row.leadSource === "OTHER"
        ? row.leadSourceOther || t("patients.leadSource.OTHER")
        : t(`patients.leadSource.${row.leadSource}`),
    [t]
  );
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
    (row: PatientRow) => {
      if (!row.whatsapp || row.whatsapp === "-") {
        toast.error(t("patients.whatsappPopup.missingNumber"));
        return;
      }
      setWhatsappTarget(row);
      setWhatsappMessage(t("patients.whatsappPopup.defaultMessage", { name: row.name }));
    },
    [t]
  );
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
    whatsappSpeechBaseMessageRef.current = "";
    setWhatsappMessage("");
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
    recognition.onstart = () => setIsWhatsappListening(true);
    recognition.onend = () => {
      setIsWhatsappListening(false);
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
      let finalTranscript = "";
      let interimTranscript = "";
      const startIndex = Number(event.resultIndex ?? 0);
      for (let i = startIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const chunk = String(result?.[0]?.transcript ?? "").trim();
        if (!chunk) continue;
        if (result.isFinal) {
          finalTranscript += `${chunk} `;
        } else {
          interimTranscript += `${chunk} `;
        }
      }
      const mergedSpeech = `${finalTranscript}${interimTranscript}`.trim();
      const base = whatsappSpeechBaseMessageRef.current;
      setWhatsappMessage(base && mergedSpeech ? `${base} ${mergedSpeech}` : base || mergedSpeech);
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

  const createMutation = useMutation({
    mutationFn: patientService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success(t("patients.profileSaved"));
    },
    onError: () => {
      toast.error("Unable to save patient");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof patientService.update>[1] }) =>
      patientService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Patient updated");
    },
    onError: () => {
      toast.error("Unable to save patient");
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => patientService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Patient deleted");
    },
    onError: () => {
      toast.error("Unable to delete patient");
    }
  });

  const buildAppointmentWindowIso = (dateText: string, timeText: string) => {
    const startDate = new Date(`${dateText}T${timeText}`);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
    return {
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString()
    };
  };

  const saveAssessmentMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      if (!assessmentPatient || !selectedAssessmentSpecialtyCode) {
        throw new Error("No selected patient");
      }
      return specialtyService.savePatientSpecialtyAssessment(
        assessmentPatient.id,
        selectedAssessmentSpecialtyCode,
        values,
        selectedAssessmentEntryType,
        specialtyClinicScope
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [
          "patients",
          "specialty",
          selectedAssessmentSpecialtyCode,
          "assessment",
          selectedAssessmentEntryType,
          assessmentPatient?.id,
          specialtyClinicScope
        ]
      });
      toast.success(t("patients.assessment.saved"));
    },
    onError: () => {
      toast.error(t("patients.assessment.saveFailed"));
    }
  });

  const columns: ColumnDef<PatientRow>[] = useMemo(
    () => [
      { header: t("nav.patients"), accessorKey: "name" },
      { header: "File #", accessorKey: "fileNumber" },
      { header: t("field.nationalId"), accessorKey: "nationalId" },
      { header: t("field.phone"), accessorKey: "phone" },
      { header: "WhatsApp", accessorKey: "whatsapp" },
      { header: "Age", accessorKey: "age" },
      {
        header: t("field.profession"),
        id: "profession",
        cell: ({ row }) => <span>{getProfessionLabel(row.original)}</span>
      },
      {
        header: t("field.leadSource"),
        id: "leadSource",
        cell: ({ row }) => <span>{getLeadSourceLabel(row.original)}</span>
      },
      { header: t("patients.lastVisit"), accessorKey: "lastVisit" },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100"
              onClick={() => {
                setEditing(row.original);
                setFormExpanded(true);
                setTimeout(scrollToFormTop, 0);
              }}
            >
              <SquarePen size={12} />
              {t("patients.actions.edit")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
              onClick={() => {
                if (isSuperAdmin && selectedClinicId === "all") {
                  toast.error(t("patients.assessment.selectClinicScope"));
                  return;
                }
                setSelectedAssessmentEntryType("EXAM");
                setMedicalRecordPatient({ id: row.original.id, name: row.original.name });
              }}
            >
              <ClipboardList size={12} />
              {t("patients.assessment.open")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={12} />
              {t("patients.actions.delete")}
            </button>
          </div>
        )
      }
    ],
    [getLeadSourceLabel, getProfessionLabel, isSuperAdmin, scrollToFormTop, selectedClinicId, t]
  );

  const handleSubmit = async (values: PatientFormValues) => {
    try {
      const payload = {
        fullName: values.fullName.trim(),
        nationalId: values.nationalId?.trim() || undefined,
        phone: values.phone.trim(),
        whatsapp: values.whatsapp || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        profession: values.profession,
        professionOther: values.professionOther || undefined,
        leadSource: values.leadSource,
        leadSourceOther: values.leadSourceOther || undefined,
        address: values.address || undefined
      };
      let patientId = editing?.id ?? "";

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
      } else {
        const createdPatient = await createMutation.mutateAsync(payload);
        patientId = createdPatient.id;
      }

      if (values.createAppointmentNow) {
        if (isSuperAdmin && selectedClinicId === "all") {
          toast.error(t("doctors.selectClinicScope"));
          return;
        }
        if (!patientId) {
          throw new Error("Unable to resolve patient id for appointment");
        }
        const { startsAt, endsAt } = buildAppointmentWindowIso(
          String(values.appointmentDate ?? ""),
          String(values.appointmentTime ?? "")
        );
        await appointmentService.create(
          {
            patientId,
            doctorId: String(values.appointmentDoctorId ?? ""),
            specialtyCode: String(values.appointmentSpecialtyCode ?? ""),
            startsAt,
            endsAt,
            entryType: (values.appointmentEntryType as VisitEntryType | undefined) ?? "EXAM",
            status: (values.appointmentStatus as "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | undefined) ?? "SCHEDULED",
            reason: String(values.appointmentReason ?? "").trim() || undefined,
            notes: String(values.appointmentNotes ?? "").trim() || undefined
          },
          appointmentMutationClinicScope
        );
        await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }

      setEditing(null);
    } catch {
      toast.error("Unable to save patient");
    }
  };

  const patientFormExpander = formExpanded ? (
    <section
      ref={formRef}
      className="mt-2 overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-orange-50/35 to-sky-50/30 shadow-premium"
    >
      <div className="sticky top-0 z-20 border-b border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-2xl">
        <h3 className="text-lg font-semibold text-brand-navy">  
          {editing ? t("patients.updatePatient") : t("patients.newPatient")}
        </h3>
      </div>
      <div className="p-6">
        <PatientForm
          key={editing?.id ?? "new-patient"}
          clinicScope={specialtyClinicScope}
          enableAppointmentSection={!isSuperAdmin || selectedClinicId !== "all"}
          initialValues={
            editing
              ? {
                  fullName: editing.name,
                  nationalId: editing.nationalId ?? "",
                  phone: editing.phone === "-" ? "" : editing.phone,
                  whatsapp: editing.whatsapp === "-" ? "" : editing.whatsapp,
                  profession:
                    ([
                      "ADMIN_EMPLOYEE",
                      "FREELANCER",
                      "DRIVER",
                      "ENGINEER",
                      "FACTORY_WORKER",
                      "OTHER"
                    ].includes(editing.profession)
                      ? editing.profession
                      : "ADMIN_EMPLOYEE") as PatientFormValues["profession"],
                  leadSource:
                    (["FACEBOOK_AD", "GOOGLE_SEARCH", "DOCTOR_REFERRAL", "FRIEND", "OTHER"].includes(editing.leadSource)
                      ? editing.leadSource
                      : "GOOGLE_SEARCH") as PatientFormValues["leadSource"],
                  leadSourceOther: editing.leadSourceOther ?? "",
                  dateOfBirth: editing.dateOfBirth ? String(editing.dateOfBirth).slice(0, 10) : "",
                  professionOther: editing.professionOther ?? "",
                  address: editing.address ?? "",
                  createAppointmentNow: false
                }
              : undefined
          }
          submitLabel={editing ? t("patients.updatePatient") : undefined}
          onSubmit={async (values) => {
            await handleSubmit(values);
            setFormExpanded(false);
            setEditing(null);
          }}
        />
        <div className="mt-3">
          <button
            type="button"
            className="text-sm text-slate-500 transition hover:text-slate-700"
            onClick={() => {
              setFormExpanded(false);
              setEditing(null);
            }}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </section>
  ) : null;

  const assessmentExpander = assessmentPatient ? (
    <section
      ref={assessmentRef}
      className="mt-2 overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-amber-50/35 to-orange-50/40 shadow-premium"
    >
      <div className="sticky top-0 z-20 border-b border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-brand-navy">
              {t("patients.assessment.title")} - {assessmentPatient.name}
            </h3>
            <p className="text-xs text-slate-500">{t("patients.assessment.subtitle")}</p>
            <p className="mt-1 text-xs text-slate-600">
              {t("patients.assessment.specialty")}: <span className="font-semibold text-slate-700">{selectedAssessmentSpecialtyName}</span>
            </p>
            <p className="text-xs text-slate-600">
              {t("patients.assessment.entryType")}:{" "}
              <span className="font-semibold text-slate-700">
                {selectedAssessmentEntryType === "EXAM"
                  ? t("appointments.entryType.exam")
                  : t("appointments.entryType.consultation")}
              </span>
            </p>
            <p className="text-xs text-slate-600">
              {t("patients.assessment.activeTemplate")}:{" "}
              <span className="font-semibold text-slate-700">
                {specialtyTemplateQuery.data?.template
                  ? locale === "ar"
                    ? specialtyTemplateQuery.data.template.titleAr
                    : specialtyTemplateQuery.data.template.title
                  : "-"}
              </span>
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-slate-500 transition hover:text-slate-700"
            onClick={() => setAssessmentPatient(null)}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div className="grid max-w-2xl gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">{t("patients.assessment.specialty")}</label>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              value={selectedAssessmentSpecialtyCode}
              onChange={(event) => setSelectedAssessmentSpecialtyCode(event.target.value)}
              disabled={!assessmentSpecialties.length || saveAssessmentMutation.isPending}
            >
              {assessmentSpecialties.map((specialty) => (
                <option key={specialty.id} value={specialty.code}>
                  {locale === "ar" ? specialty.nameAr : specialty.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">{t("patients.assessment.entryType")}</label>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              value={selectedAssessmentEntryType}
              onChange={(event) => setSelectedAssessmentEntryType(event.target.value as VisitEntryType)}
              disabled={saveAssessmentMutation.isPending}
            >
              <option value="EXAM">{t("appointments.entryType.exam")}</option>
              <option value="CONSULTATION">{t("appointments.entryType.consultation")}</option>
            </select>
          </div>
        </div>
        {!assessmentSpecialties.length ? (
          <p className="text-sm text-rose-600">{t("patients.assessment.noSpecialtiesEnabled")}</p>
        ) : clinicSpecialtiesQuery.isLoading || specialtyTemplateQuery.isLoading || specialtyAssessmentQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        ) : specialtyTemplateQuery.data?.template ? (
          <>
            <SpecialtyAssessmentForm
              key={`${assessmentPatient.id}-${selectedAssessmentSpecialtyCode}-${selectedAssessmentEntryType}-${specialtyAssessmentQuery.data?.assessment?.updatedAt ?? "new"}`}
              template={specialtyTemplateQuery.data.template}
              initialValues={specialtyAssessmentQuery.data?.assessment?.values as Record<string, unknown> | undefined}
              isSubmitting={saveAssessmentMutation.isPending}
              onSubmit={async (values) => {
                await saveAssessmentMutation.mutateAsync(values);
              }}
            />
            {Array.isArray(specialtyAssessmentQuery.data?.assessment?.alerts) && specialtyAssessmentQuery.data?.assessment?.alerts?.length ? (
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
            {Array.isArray(specialtyAssessmentQuery.data?.assessment?.diagnoses) && specialtyAssessmentQuery.data?.assessment?.diagnoses?.length ? (
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
          <p className="text-sm text-rose-600">
            {t("patients.assessment.templateUnavailable", { specialty: selectedAssessmentSpecialtyName })}
          </p>
        )}
      </div>
    </section>
  ) : null;

  return (
    <RoleGate requiredPermissions={["patients.read"]} fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}>
    <AppShell>
      {isSuperAdmin ? (
        <section className="mb-4 card bg-white/80 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">Clinic Scope</p>
            <select
              className="h-11 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
              value={selectedClinicId}
              onChange={(event) => setSelectedClinicId(event.target.value)}
            >
              <option value="all">{t("patients.allClinics")}</option>
              {(clinicsQuery.data ?? []).map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}
      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("dashboard.totalPatients")}
          value={stats.totalPatients}
          icon={<Users size={17} />}
          gradientClassName="bg-gradient-to-br from-cyan-50 via-white to-sky-100"
          iconClassName="bg-cyan-500"
        />
        <StatCard
          title={t("patients.newThisMonth")}
          value={stats.newThisMonth}
          icon={<UserPlus size={17} />}
          gradientClassName="bg-gradient-to-br from-violet-50 via-white to-fuchsia-100"
          iconClassName="bg-violet-500"
        />
        <StatCard
          title={t("patients.withContact")}
          value={stats.withContactInfo}
          icon={<PhoneCall size={17} />}
          gradientClassName="bg-gradient-to-br from-emerald-50 via-white to-teal-100"
          iconClassName="bg-emerald-500"
        />
        <StatCard
          title={t("patients.missingContact")}
          value={stats.withoutContactInfo}
          icon={<PhoneOff size={17} />}
          gradientClassName="bg-gradient-to-br from-amber-50 via-white to-orange-100"
          iconClassName="bg-orange-500"
        />
      </section>
      <Suspense fallback={<div className="card p-6 text-sm text-slate-500">{t("patients.loading")}</div>}>
        {loading ? (
          <div className="card p-6 text-sm text-slate-500">{t("patients.loading")}</div>
        ) : (
          <EntityCollectionView
            title={t("nav.patients")}
            columns={columns}
            data={rows}
            storageKey="patient-view"
            belowHeader={
              <>
                {patientFormExpander}
                {assessmentExpander}
              </>
            }
            statusOptions={[
              { label: t("patients.allRecords"), value: "all" },
              { label: t("patients.leadSource.FACEBOOK_AD"), value: "FACEBOOK_AD" },
              { label: t("patients.leadSource.GOOGLE_SEARCH"), value: "GOOGLE_SEARCH" },
              { label: t("patients.leadSource.DOCTOR_REFERRAL"), value: "DOCTOR_REFERRAL" },
              { label: t("patients.leadSource.FRIEND"), value: "FRIEND" },
              { label: t("patients.leadSource.OTHER"), value: "OTHER" }
            ]}
            searchPlaceholder={`${t("common.search")} ${t("nav.patients")}`}
            addButton={
              <RippleButton
                onClick={() => {
                  setEditing(null);
                  setFormExpanded((prev) => !prev);
                }}
              >
                {formExpanded ? t("common.close") : `+ ${t("nav.patients")}`}
              </RippleButton>
            }
            getSearchText={(row) =>
              `${row.name} ${row.nationalId ?? ""} ${row.phone} ${row.whatsapp} ${row.fileNumber} ${row.profession} ${row.leadSource}`
            }
            getStatus={(row) => row.leadSource}
            getDate={(row) => row.lastVisit}
            renderCard={(row) => (
              <div className="relative overflow-hidden rounded-2xl border border-orange-100/70 border-l-4 border-l-orange-500 bg-gradient-to-br from-white via-orange-50/40 to-cyan-50/30 p-4">
                <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-orange-200/30 blur-xl" />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-cyan-200/20 blur-xl" />
                <div className="relative space-y-3">
                  {(() => {
                    const isExpanded = expandedCardId === row.id;
                    return (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-lg font-bold leading-6 text-slate-900 break-words">{row.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 font-semibold text-cyan-700">
                                <ClipboardList size={12} />
                                {t("patients.card.fileNumber")}: {row.fileNumber}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
                                {t("field.nationalId")}: {row.nationalId || t("patients.card.notSet")}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-700">
                                <MapPin size={12} />
                                {row.clinicName ?? t("patients.card.notSet")}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-xl bg-blue-500 p-2 text-white shadow-soft">
                            <User size={14} />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          <button
                            type="button"
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-amber-200 bg-gradient-to-b from-white to-amber-50 px-3 text-xs font-semibold text-amber-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow"
                            onClick={() => {
                              if (isSuperAdmin && selectedClinicId === "all") {
                                toast.error(t("patients.assessment.selectClinicScope"));
                                return;
                              }
                              setMedicalRecordPatient({ id: row.id, name: row.name });
                            }}
                          >
                            <ClipboardList size={13} />
                            {t("patients.assessment.open")}
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200 bg-gradient-to-b from-white to-cyan-50 text-cyan-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow"
                            onClick={() => {
                              setEditing(row);
                              setFormExpanded(true);
                              setTimeout(scrollToFormTop, 0);
                            }}
                            aria-label={t("patients.actions.edit")}
                          >
                            <SquarePen size={13} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-gradient-to-b from-white to-rose-50 text-rose-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow"
                            onClick={() => setDeleteTarget(row)}
                            aria-label={t("patients.actions.delete")}
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-gradient-to-b from-white to-emerald-50 text-emerald-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => openWhatsappPopup(row)}
                            disabled={!row.whatsapp || row.whatsapp === "-"}
                            aria-label={t("patients.whatsappPopup.open")}
                          >
                            <FaWhatsapp size={15} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-orange-700">{t("patients.lastVisit")}: {row.lastVisit}</p>
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                            {getLeadSourceLabel(row)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/85 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          onClick={() => setExpandedCardId((prev) => (prev === row.id ? null : row.id))}
                        >
                          <ChevronDown size={14} className={cn("transition-transform", isExpanded && "rotate-180")} />
                          {isExpanded ? t("patients.card.hideDetails") : t("patients.card.viewDetails")}
                        </button>

                        <div
                          className={cn(
                            "overflow-hidden transition-all duration-300 ease-out",
                            isExpanded ? "mt-1 max-h-[1200px] opacity-100 pointer-events-auto" : "max-h-0 opacity-0 pointer-events-none"
                          )}
                        >
                          <div className={cn("space-y-3", isExpanded && "pt-2")}>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-xl bg-white/90 p-2">
                                <p className="text-xs text-slate-500">{t("patients.card.phone")}</p>
                                <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-slate-800">
                                  <PhoneOutgoing size={13} className="text-cyan-600" />
                                  {row.phone || t("patients.card.notSet")}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white/90 p-2">
                                <p className="text-xs text-slate-500">{t("patients.card.age")}</p>
                                <p className="mt-0.5 font-semibold text-slate-800">{row.age ?? t("patients.card.notSet")}</p>
                              </div>
                              <div className="rounded-xl bg-white/90 p-2">
                                <p className="text-xs text-slate-500">{t("patients.card.birthDate")}</p>
                                <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-slate-800">
                                  <Calendar size={13} className="text-orange-600" />
                                  {row.dateOfBirth ? String(row.dateOfBirth).slice(0, 10) : t("patients.card.notSet")}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-xl bg-white/90 p-2">
                                <p className="text-xs text-slate-500">{t("patients.card.profession")}</p>
                                <p className="mt-0.5 font-semibold text-slate-800 break-words">{getProfessionLabel(row)}</p>
                              </div>
                              <div className="rounded-xl bg-white/90 p-2">
                                <p className="text-xs text-slate-500">{t("patients.card.leadSource")}</p>
                                <p className="mt-0.5 font-semibold text-orange-700 break-words">{getLeadSourceLabel(row)}</p>
                              </div>
                              <div className="col-span-2 rounded-xl bg-white/90 p-2">
                                <p className="text-xs text-slate-500">{t("patients.card.address")}</p>
                                <p className="mt-0.5 font-semibold text-slate-800 break-words">{row.address || t("patients.card.notSet")}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          />
        )}
      </Suspense>
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
                  onChange={(event) => setWhatsappMessage(event.target.value)}
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
                <RippleButton
                  type="button"
                  className="from-emerald-600 to-emerald-500 hover:shadow-emerald-500/30"
                  onClick={openWhatsappChat}
                >
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
      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("patients.deleteConfirm.closeAria")}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
            disabled={removeMutation.isPending}
          />
          <section className="relative w-full max-w-xl rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-orange-50 to-white p-5 shadow-premium">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-rose-100 p-2 text-rose-600">
                  <TriangleAlert size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{t("patients.deleteConfirm.title")}</p>
                  <p className="text-sm text-slate-600">
                    {t("patients.deleteConfirm.description", { name: deleteTarget.name })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => setDeleteTarget(null)}
                  disabled={removeMutation.isPending}
                >
                  {t("patients.deleteConfirm.cancel")}
                </button>
                <RippleButton
                  type="button"
                  className="from-rose-600 to-red-500 hover:shadow-rose-500/30"
                  onClick={async () => {
                    if (!deleteTarget) return;
                    await removeMutation.mutateAsync(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                  disabled={removeMutation.isPending}
                >
                  {removeMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {t("patients.deleteConfirm.deleting")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Trash2 size={14} />
                      {t("patients.deleteConfirm.confirm")}
                    </span>
                  )}
                </RippleButton>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      <MedicalRecordModal
        open={Boolean(medicalRecordPatient)}
        mode="patient"
        patientContext={medicalRecordPatient}
        clinicScope={specialtyClinicScope}
        onClose={() => setMedicalRecordPatient(null)}
      />
    </AppShell>
    </RoleGate>
  );
}
