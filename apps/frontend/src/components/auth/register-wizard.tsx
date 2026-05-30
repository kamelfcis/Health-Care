"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Search,
  UploadCloud
} from "lucide-react";
import { FloatingInput } from "@/components/ui/floating-input";
import { RippleButton } from "@/components/ui/ripple-button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import axios from "axios";
import { authService } from "@/lib/auth-service";
import { toast } from "sonner";
import { useI18n } from "@/components/providers/i18n-provider";
import { specialtyService } from "@/lib/specialty-service";
import { cn } from "@/lib/utils";

const registerSchema = z.object({
  clinicName: z.string().min(2),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  specialtyCodes: z.array(z.string().min(1)).min(1, "Pick at least one specialty")
});

type RegisterValues = z.infer<typeof registerSchema>;

const stepSchemas = [
  registerSchema.pick({ clinicName: true }),
  registerSchema.pick({ specialtyCodes: true }),
  registerSchema.pick({ firstName: true, lastName: true, email: true, password: true })
];

const STEP_FIELDS: (keyof RegisterValues)[][] = [
  ["clinicName"],
  ["specialtyCodes"],
  ["firstName", "lastName", "email", "password"]
];

const TOTAL_STEPS = 3;
const inputToneClass = "focus:border-orange-500 focus:ring-orange-500/30";

function validationMessageForIssue(issue: z.ZodIssue, t: (key: string) => string): string {
  const field = issue.path[0];
  switch (field) {
    case "clinicName":
      return t("auth.register.clinicNameTooShort");
    case "email":
      return t("auth.register.invalidEmail");
    case "password":
      return t("auth.register.passwordTooShort");
    case "specialtyCodes":
      return t("auth.register.selectSpecialty");
    default:
      return t("auth.register.fillRequiredFields");
  }
}

const invalidPulseClass = "border-orange-400 ring-2 ring-orange-400/40";

function isRegisterEmailTakenError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (error.response?.status === 409) return true;
  const message = error.response?.data?.message;
  return typeof message === "string" && /already registered|already in use/i.test(message);
}

const stepTransition = (reducedMotion: boolean, rtl: boolean) => ({
  initial: { opacity: 0, x: reducedMotion ? 0 : rtl ? -24 : 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: reducedMotion ? 0 : rtl ? 24 : -24 },
  transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }
});

function ClinicLogoUpload({
  clinicImage,
  clinicImagePreview,
  onImageChange,
  t
}: {
  clinicImage?: File;
  clinicImagePreview: string | null;
  onImageChange: (file: File | undefined) => void;
  t: (key: string) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pickFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) return;
      onImageChange(file);
    },
    [onImageChange]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      pickFile(event.dataTransfer.files?.[0]);
    },
    [pickFile]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="clinicImage" className="text-base font-medium text-slate-700">
          {t("auth.register.clinicLogo")}
        </label>
        <span className="text-xs text-slate-400">{t("auth.register.logoOptional")}</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`group relative flex min-h-[168px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition duration-200 ${
          isDragging
            ? "border-orange-500 bg-orange-50/80 shadow-[0_0_0_4px_rgba(249,115,22,0.15)]"
            : clinicImagePreview
              ? "border-orange-300/80 bg-gradient-to-br from-orange-50/40 via-white to-orange-50/60 hover:border-orange-400"
              : "border-orange-200/90 bg-gradient-to-br from-white via-orange-50/20 to-orange-50/40 hover:border-orange-400 hover:bg-orange-50/50"
        }`}
      >
        {clinicImagePreview ? (
          <>
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-white shadow-lg ring-2 ring-orange-200/80">
              <Image
                src={clinicImagePreview}
                alt={t("auth.register.clinicLogo")}
                width={80}
                height={80}
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>
            <div className="space-y-1">
              <p className="max-w-[220px] truncate text-sm font-medium text-slate-700">
                {clinicImage?.name}
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-orange-500/25 transition group-hover:from-orange-700 group-hover:to-orange-600">
                <ImagePlus size={14} />
                {t("auth.register.changeLogo")}
              </span>
            </div>
          </>
        ) : (
          <>
            <div
              className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl transition ${
                isDragging
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                  : "bg-orange-100 text-orange-600 group-hover:bg-orange-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-orange-500/30"
              }`}
            >
              <UploadCloud size={26} strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">{t("auth.register.dropzoneHint")}</p>
              <p className="text-xs text-slate-500">{t("auth.register.logoFormats")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-orange-500/25 transition group-hover:from-orange-700 group-hover:to-orange-600">
              <UploadCloud size={14} />
              {t("auth.register.uploadLogo")}
            </span>
          </>
        )}

        <input
          ref={inputRef}
          id="clinicImage"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            pickFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function RegisterStepIndicator({
  step,
  labels
}: {
  step: number;
  labels: string[];
}) {
  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="mb-6 space-y-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-orange-100">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-500"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        />
      </div>
      <ol className="flex items-center justify-between gap-2">
        {labels.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
              <motion.span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                    : active
                      ? "bg-gradient-to-br from-orange-600 to-orange-500 text-white ring-4 ring-orange-200/60"
                      : "bg-slate-100 text-slate-400"
                }`}
                animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
              >
                {done ? <Check size={14} /> : index + 1}
              </motion.span>
              <span
                className={`hidden truncate text-[10px] font-medium sm:block ${
                  active ? "text-orange-700" : done ? "text-orange-600/80" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RegisterWizard() {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [clinicImage, setClinicImage] = useState<File | undefined>(undefined);
  const [clinicImagePreview, setClinicImagePreview] = useState<string | null>(null);
  const [specialtySearch, setSpecialtySearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invalidPulse, setInvalidPulse] = useState(false);
  const router = useRouter();
  const { t, locale } = useI18n();
  const reducedMotion = useReducedMotion();
  const rtl = locale === "ar";

  const specialtiesQuery = useQuery({
    queryKey: ["specialties", "catalog", "register"],
    queryFn: specialtyService.listCatalog,
    staleTime: 5 * 60_000
  });

  const { control, setValue, watch, getValues, clearErrors } = useForm<RegisterValues>({
    defaultValues: {
      clinicName: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      specialtyCodes: []
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    shouldUnregister: false
  });

  const selectedSpecialties = watch("specialtyCodes");
  const clinicName = watch("clinicName");

  const handleClinicImageChange = useCallback(
    (file: File | undefined) => {
      setClinicImagePreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return file ? URL.createObjectURL(file) : null;
      });
      setClinicImage(file);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (clinicImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(clinicImagePreview);
      }
    };
  }, [clinicImagePreview]);

  const stepLabels = useMemo(
    () => [
      t("auth.register.stepClinic"),
      t("auth.register.stepSpecialties"),
      t("auth.register.stepAccount")
    ],
    [t]
  );

  const stepSubtitle = useMemo(() => {
    if (step === 0) return t("auth.register.subtitleClinic");
    if (step === 1) return t("auth.register.subtitleSpecialties");
    return t("auth.register.subtitleAccount");
  }, [step, t]);

  const filteredSpecialties = useMemo(() => {
    const q = specialtySearch.trim().toLowerCase();
    const list = specialtiesQuery.data ?? [];
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nameAr.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    );
  }, [specialtiesQuery.data, specialtySearch]);

  const pulseInvalid = useCallback(() => {
    setInvalidPulse(true);
    window.setTimeout(() => setInvalidPulse(false), 500);
  }, []);

  useEffect(() => {
    clearErrors();
    setInvalidPulse(false);
  }, [step, clearErrors]);

  const validateCurrentStep = (): boolean => {
    const fields = STEP_FIELDS[step];
    const values = getValues();
    const stepData = Object.fromEntries(fields.map((field) => [field, values[field]]));
    const result = stepSchemas[step].safeParse(stepData);

    if (result.success) {
      clearErrors();
      return true;
    }

    clearErrors();
    toast.error(validationMessageForIssue(result.error.issues[0], t));
    pulseInvalid();
    return false;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    clearErrors();
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    clearErrors();
    setInvalidPulse(false);
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = async (values: RegisterValues) => {
    setSubmitting(true);
    try {
      await authService.register({ ...values, clinicImage });
      toast.success(t("auth.accountCreated"));
      router.push("/login");
    } catch (error) {
      if (isRegisterEmailTakenError(error)) {
        toast.error(t("auth.register.emailTaken"));
        setStep(2);
        return;
      }
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      toast.error(typeof message === "string" && message.trim() ? message.trim() : t("auth.accountCreateFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const values = getValues();
    const result = registerSchema.safeParse(values);
    if (!result.success) {
      clearErrors();
      toast.error(validationMessageForIssue(result.error.issues[0], t));
      pulseInvalid();
      return;
    }
    void onSubmit(result.data);
  };

  const motionProps = stepTransition(Boolean(reducedMotion), rtl);

  return (
    <div className="glass relative rounded-3xl p-8 sm:p-10">
      <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-orange-500/20 blur-2xl" />
      <div className="absolute bottom-0 right-4 h-20 w-20 rounded-full bg-orange-400/15 blur-2xl" />

      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-orange-600">
          {t("auth.register.stepOf", { current: step + 1, total: TOTAL_STEPS })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{t("auth.createAccount")}</h1>
        <p className="mt-1 text-sm text-slate-500">{stepSubtitle}</p>

        <RegisterStepIndicator step={step} labels={stepLabels} />

        <form onSubmit={onFormSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div key="step-clinic" {...motionProps} className="space-y-5">
                <Controller
                  name="clinicName"
                  control={control}
                  render={({ field }) => (
                    <FloatingInput
                      id="clinicName"
                      label={t("nav.clinics")}
                      className={cn(inputToneClass, invalidPulse && invalidPulseClass)}
                      autoFocus
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  )}
                />
                <ClinicLogoUpload
                  clinicImage={clinicImage}
                  clinicImagePreview={clinicImagePreview}
                  onImageChange={handleClinicImageChange}
                  t={t}
                />
                {clinicName && clinicName.length >= 2 ? (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-xl border border-orange-200/80 bg-orange-50/60 px-3 py-2 text-sm text-orange-800"
                  >
                    <Building2 size={16} />
                    {clinicName}
                  </motion.p>
                ) : null}
              </motion.div>
            ) : null}

            {step === 1 ? (
              <motion.div key="step-specialties" {...motionProps} className="space-y-3">
                <label className="text-base font-medium text-slate-700">{t("auth.clinicSpecialties")}</label>
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={specialtySearch}
                    onChange={(e) => setSpecialtySearch(e.target.value)}
                    placeholder={t("auth.register.searchSpecialties")}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white/90 ps-9 pe-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div className="max-h-[min(280px,40vh)] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/80 p-3">
                  {specialtiesQuery.isLoading ? (
                    <p className="text-xs text-slate-500">{t("common.loading")}</p>
                  ) : filteredSpecialties.length === 0 ? (
                    <p className="text-xs text-slate-500">{t("nav.search.noResults")}</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {filteredSpecialties.map((specialty) => {
                        const checked = selectedSpecialties.includes(specialty.code);
                        const label = locale === "ar" ? specialty.nameAr : specialty.name;
                        return (
                          <button
                            key={specialty.id}
                            type="button"
                            onClick={() => {
                              const next = checked
                                ? selectedSpecialties.filter((item) => item !== specialty.code)
                                : [...selectedSpecialties, specialty.code];
                              setValue("specialtyCodes", next, { shouldDirty: true });
                            }}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm transition duration-200 ${
                              checked
                                ? "border-orange-400 bg-orange-50 text-orange-900 ring-2 ring-orange-200 shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50/40"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                checked ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 bg-white"
                              }`}
                            >
                              {checked ? <Check size={10} strokeWidth={3} /> : null}
                            </span>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedSpecialties.length > 0 ? (
                  <p className="text-xs text-orange-700">
                    {t("auth.register.selectedCount", { count: selectedSpecialties.length })}
                  </p>
                ) : null}
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div key="step-account" {...motionProps} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="firstName"
                    control={control}
                    render={({ field }) => (
                      <FloatingInput
                        id="firstName"
                        label={t("field.firstName")}
                        className={cn(inputToneClass, invalidPulse && invalidPulseClass)}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        name={field.name}
                      />
                    )}
                  />
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => (
                      <FloatingInput
                        id="lastName"
                        label={t("field.lastName")}
                        className={cn(inputToneClass, invalidPulse && invalidPulseClass)}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        name={field.name}
                      />
                    )}
                  />
                </div>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <FloatingInput
                      id="email"
                      type="email"
                      label={t("field.email")}
                      className={cn(inputToneClass, invalidPulse && invalidPulseClass)}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  )}
                />
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <FloatingInput
                      id="password"
                      type={showPassword ? "text" : "password"}
                      label={t("field.password")}
                      className={cn(inputToneClass, invalidPulse && invalidPulseClass)}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                      endAdornment={
                        <button
                          type="button"
                          className="text-slate-400 transition hover:text-orange-600"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? t("common.hidePassword") : t("common.showPassword")}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />
                  )}
                />
                <div className="rounded-2xl border border-orange-200/80 bg-orange-50/50 px-4 py-3 text-sm text-slate-600">
                  {t("auth.roleAssigned")}{" "}
                  <span className="font-semibold text-orange-800">{t("auth.clinicAdmin")}</span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex items-center gap-2 pt-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {rtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                {t("auth.register.back")}
              </button>
            ) : (
              <div className="flex-1" />
            )}
            {step < TOTAL_STEPS - 1 ? (
              <RippleButton
                type="button"
                glow={false}
                className="inline-flex h-11 flex-[2] items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 font-medium text-white hover:from-orange-700 hover:to-orange-600"
                onClick={goNext}
              >
                {t("auth.register.next")}
                {rtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </RippleButton>
            ) : (
              <RippleButton
                type="submit"
                glow={false}
                className="inline-flex h-11 flex-[2] items-center justify-center bg-gradient-to-r from-orange-600 to-orange-500 font-medium text-white hover:from-orange-700 hover:to-orange-600"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner />
                    {t("common.createAccount")}...
                  </span>
                ) : (
                  t("common.createAccount")
                )}
              </RippleButton>
            )}
          </div>
        </form>

        <p className="mt-3 text-xs text-slate-500">{t("auth.terms")}</p>
        <p className="mt-4 text-sm text-slate-500">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login" className="font-medium text-orange-600 hover:text-orange-700">
            {t("common.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
