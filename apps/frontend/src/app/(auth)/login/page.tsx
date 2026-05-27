"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import AnimatedMedicalBackground from "@/components/AnimatedMedicalBackground";
import { FloatingInput } from "@/components/ui/floating-input";
import { RippleButton } from "@/components/ui/ripple-button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { authService } from "@/lib/auth-service";
import { storage } from "@/lib/storage";
import { toast } from "sonner";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useI18n } from "@/components/providers/i18n-provider";
import { useLoadingOverlay } from "@/components/providers/loading-overlay-provider";
import { BRAND } from "@/lib/brand";

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

type LoginValues = z.infer<typeof loginSchema>;

const roleRedirectMap: Record<string, string> = {
  SuperAdmin: "/clinics",
  ClinicAdmin: "/dashboard",
  Doctor: "/appointments",
  Nurse: "/patients",
  Receptionist: "/billing",
  Sales: "/dashboard"
};
const accentColor = "hsl(198.42deg 66.28% 33.73%)";
const inputToneClass = "h-14 focus:border-[hsl(198.42deg_66.28%_33.73%)] focus:ring-[hsl(198.42deg_66.28%_33.73%)]/30";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  const { startLoading, stopLoading } = useLoadingOverlay();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (values: LoginValues) => {
    startLoading();
    try {
      const result = await authService.login(values);
      storage.setSession(result.accessToken, result.refreshToken, result.user);
      router.push(roleRedirectMap[result.user.role] ?? "/dashboard");
      toast.success(t("auth.welcomeBack"));
    } catch {
      toast.error(t("auth.invalidCredentials"));
    } finally {
      stopLoading();
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AnimatedMedicalBackground density="premium" accentColor={accentColor} />
      <LanguageToggle className="absolute right-4 top-4 z-20" />
      <div className="container relative z-10">
        <div className="grid overflow-hidden rounded-3xl border border-white/70 bg-white/35 shadow-premium backdrop-blur-xl lg:grid-cols-2">
          <motion.div
            className="relative flex flex-col items-center justify-center bg-gradient-to-br from-[hsl(198.42deg_66.28%_33.73%)] to-[#0b1f33] px-8 py-14 text-center text-white"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(28,132,143,.25),transparent_40%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_45%)]" />
            <Image
              src={BRAND.logoSrc}
              alt={BRAND.logoAlt}
              width={240}
              height={160}
              priority
              className="h-auto w-full max-w-[240px] object-contain"
            />
            <h1 className="mt-6 text-4xl font-semibold tracking-tight">{t("auth.healthcareCrm")}</h1>
            <p className="mt-4 max-w-md text-sm text-slate-200/95">
              {t("auth.loginTagline")}
            </p>
            <div className="mt-7 grid w-full max-w-md gap-2 text-left text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1"><ShieldCheck size={13} /> {t("auth.hipaaReady")}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1"><Stethoscope size={13} /> {t("auth.multiClinic")}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1"><Sparkles size={13} /> {t("auth.enterpriseGrade")}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="glass relative rounded-3xl p-8 sm:p-12"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ backgroundColor: accentColor, opacity: 0.25 }} />
            <div className="absolute -bottom-16 left-8 h-24 w-24 rounded-full blur-2xl" style={{ backgroundColor: accentColor, opacity: 0.2 }} />
            <h2 className="text-2xl font-semibold text-slate-900">{t("auth.welcomeBack")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("auth.signInContinue")}</p>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
              <FloatingInput id="email" label={t("field.email")} type="email" className={inputToneClass} error={errors.email?.message} {...register("email")} />
              <FloatingInput
                id="password"
                label={t("field.password")}
                type={showPassword ? "text" : "password"}
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

              <div className="flex items-center justify-between text-xs text-slate-500">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="rounded border-slate-300" />
                  {t("common.keepSignedIn")}
                </label>
                <span className="text-[hsl(198.42deg_66.28%_33.73%)]">{t("common.secureLogin")}</span>
              </div>

              <RippleButton
                type="submit"
                glow={false}
                className="h-12 w-full bg-[hsl(198.42deg_66.28%_33.73%)] font-medium text-white transition hover:bg-[hsl(198.42deg_66.28%_29%)]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner />
                    {t("common.signIn")}...
                  </span>
                ) : (
                  t("common.signIn")
                )}
              </RippleButton>
            </form>

            <p className="mt-5 text-sm text-slate-500">
              {t("auth.noAccount")}{" "}
              <Link href="/register" className="font-medium text-[hsl(198.42deg_66.28%_33.73%)] hover:text-[hsl(198.42deg_66.28%_29%)]">
                {t("common.registerHere")}
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
