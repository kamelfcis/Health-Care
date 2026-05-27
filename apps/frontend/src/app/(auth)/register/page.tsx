"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, EyeOff, ImagePlus, ShieldCheck, UploadCloud, UserPlus } from "lucide-react";
import AnimatedMedicalBackground from "@/components/AnimatedMedicalBackground";
import { FloatingInput } from "@/components/ui/floating-input";
import { RippleButton } from "@/components/ui/ripple-button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { authService } from "@/lib/auth-service";
import { toast } from "sonner";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useI18n } from "@/components/providers/i18n-provider";
import { specialtyService } from "@/lib/specialty-service";
import { BRAND } from "@/lib/brand";

const registerSchema = z.object({
  clinicName: z.string().min(2),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  specialtyCodes: z.array(z.string().min(1)).min(1, "Pick at least one specialty")
});

type RegisterValues = z.infer<typeof registerSchema>;
const accentColor = "hsl(198.42deg 66.28% 33.73%)";
const inputToneClass = "focus:border-[hsl(198.42deg_66.28%_33.73%)] focus:ring-[hsl(198.42deg_66.28%_33.73%)]/30";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [clinicImage, setClinicImage] = useState<File | undefined>(undefined);
  const [clinicImagePreview, setClinicImagePreview] = useState<string | null>(null);
  const router = useRouter();
  const { t, locale } = useI18n();
  const specialtiesQuery = useQuery({
    queryKey: ["specialties", "catalog"],
    queryFn: specialtyService.listCatalog
  });
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      specialtyCodes: []
    }
  });
  const selectedSpecialties = watch("specialtyCodes");

  const onSubmit = async (values: RegisterValues) => {
    try {
      await authService.register({ ...values, clinicImage });
      toast.success(t("auth.accountCreated"));
      router.push("/login");
    } catch {
      toast.error(t("auth.accountCreateFailed"));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AnimatedMedicalBackground density="premium" accentColor={accentColor} />
      <LanguageToggle className="absolute right-4 top-4 z-20" />
      <div className="container relative z-10">
        <div className="grid overflow-hidden rounded-3xl border border-white/70 bg-white/35 shadow-premium backdrop-blur-xl lg:grid-cols-2">
          <motion.div
            className="glass relative rounded-3xl p-8 sm:p-12"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ backgroundColor: accentColor, opacity: 0.24 }} />
            <div className="absolute bottom-0 right-4 h-20 w-20 rounded-full blur-2xl" style={{ backgroundColor: accentColor, opacity: 0.14 }} />
            <h1 className="text-2xl font-semibold text-slate-900">{t("auth.createAccount")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("auth.setupTeam")}</p>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <FloatingInput
                id="clinicName"
                label={t("nav.clinics")}
                className={inputToneClass}
                error={errors.clinicName?.message}
                {...register("clinicName")}
              />
              <div className="space-y-2">
                <label className="text-base text-slate-600">{t("auth.clinicSpecialties")}</label>
                <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-3">
                  {specialtiesQuery.isLoading ? (
                    <p className="text-xs text-slate-500">{t("common.loading")}</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(specialtiesQuery.data ?? []).map((specialty) => {
                        const checked = selectedSpecialties.includes(specialty.code);
                        const label = locale === "ar" ? specialty.nameAr : specialty.name;
                        return (
                          <label
                            key={specialty.id}
                            className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-[hsl(198.42deg_66.28%_33.73%)]/40"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-[hsl(198.42deg_66.28%_33.73%)] focus:ring-[hsl(198.42deg_66.28%_33.73%)]/30"
                              checked={checked}
                              onChange={(event) => {
                                const next = event.target.checked
                                  ? [...selectedSpecialties, specialty.code]
                                  : selectedSpecialties.filter((item) => item !== specialty.code);
                                setValue("specialtyCodes", next, { shouldValidate: true, shouldDirty: true });
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                {errors.specialtyCodes ? <p className="text-xs text-red-500">{errors.specialtyCodes.message}</p> : null}
              </div>
              <div className="space-y-1">
                <label htmlFor="clinicImage" className="text-base text-slate-600">
                  {t("auth.clinicImage")}
                </label>
                <p className="text-xs text-slate-500">{t("auth.clinicImageHint")}</p>
                <label
                  htmlFor="clinicImage"
                  className="group mt-2 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/70 to-cyan-50/40 p-3 transition hover:border-[hsl(198.42deg_66.28%_33.73%)]/45 hover:shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                      {clinicImagePreview ? (
                        <Image
                          src={clinicImagePreview}
                          alt="Clinic preview"
                          width={44}
                          height={44}
                          unoptimized
                          className="h-11 w-11 rounded-xl object-cover"
                        />
                      ) : (
                        <Building2 size={18} className="text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {clinicImage?.name ? clinicImage.name : t("auth.clinicImage")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {clinicImage ? "PNG, JPG, WEBP" : t("auth.clinicImageHint")}
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition group-hover:text-[hsl(198.42deg_66.28%_33.73%)]">
                    {clinicImage ? <ImagePlus size={14} /> : <UploadCloud size={14} />}
                    {clinicImage ? "Change" : "Upload"}
                  </div>
                </label>
                <input
                  id="clinicImage"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setClinicImage(file);
                    setClinicImagePreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FloatingInput id="firstName" label={t("field.firstName")} className={inputToneClass} error={errors.firstName?.message} {...register("firstName")} />
                <FloatingInput id="lastName" label={t("field.lastName")} className={inputToneClass} error={errors.lastName?.message} {...register("lastName")} />
              </div>
              <FloatingInput id="email" type="email" label={t("field.email")} className={inputToneClass} error={errors.email?.message} {...register("email")} />
              <FloatingInput
                id="password"
                type={showPassword ? "text" : "password"}
                label={t("field.password")}
                className={inputToneClass}
                error={errors.password?.message}
                endAdornment={
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-[hsl(198.42deg_66.28%_33.73%)]"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? t("common.hidePassword") : t("common.showPassword")}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                {...register("password")}
              />
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
                {t("auth.roleAssigned")} <span className="font-semibold text-slate-800">{t("auth.clinicAdmin")}</span>
              </div>
              {Object.values(errors).length ? <p className="text-sm text-red-500">Please review form fields.</p> : null}
              <RippleButton
                type="submit"
                glow={false}
                className="h-11 w-full bg-[hsl(198.42deg_66.28%_33.73%)] font-medium text-white transition hover:bg-[hsl(198.42deg_66.28%_29%)]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner />
                    {t("common.createAccount")}...
                  </span>
                ) : (
                  t("common.createAccount")
                )}
              </RippleButton>
            </form>
            <p className="mt-3 text-xs text-slate-500">
              {t("auth.terms")}
            </p>
            <p className="mt-5 text-sm text-slate-500">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/login" className="font-medium text-[hsl(198.42deg_66.28%_33.73%)] hover:text-[hsl(198.42deg_66.28%_29%)]">
                {t("common.signIn")}
              </Link>
            </p>
          </motion.div>
          <motion.div
            className="relative flex flex-col items-center justify-center bg-gradient-to-br from-[hsl(198.42deg_66.28%_33.73%)] to-[#0b1f33] px-8 py-14 text-center text-white"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(28,132,143,.24),transparent_42%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_45%)]" />
            <Image
              src={BRAND.logoSrc}
              alt={BRAND.logoAlt}
              width={240}
              height={160}
              priority
              className="h-auto w-full max-w-[240px] object-contain"
            />
            <h2 className="mt-8 text-4xl font-semibold tracking-tight">{t("auth.premiumClinicOps")}</h2>
            <p className="mt-4 max-w-md text-sm text-slate-200">
              {t("auth.workflowTagline")}
            </p>
            <div className="mt-7 grid w-full max-w-md gap-2 text-left text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1"><ShieldCheck size={13} /> {t("auth.encrypted")}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1"><Building2 size={13} /> {t("auth.multiSite")}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1"><UserPlus size={13} /> {t("auth.teamReady")}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
