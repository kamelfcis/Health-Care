"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Building2, ShieldCheck, UserPlus } from "lucide-react";
import AnimatedMedicalBackground from "@/components/AnimatedMedicalBackground";
import { RegisterWizard } from "@/components/auth/register-wizard";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useI18n } from "@/components/providers/i18n-provider";
import { BRAND } from "@/lib/brand";

const accentColor = "hsl(24 95% 53%)";

export default function RegisterPage() {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AnimatedMedicalBackground density="premium" accentColor={accentColor} />
      <LanguageToggle className="absolute end-4 top-4 z-20" />
      <div className="container relative z-10">
        <div className="grid overflow-hidden rounded-3xl border border-white/70 bg-white/35 shadow-premium backdrop-blur-xl lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <RegisterWizard />
          </motion.div>
          <motion.div
            className="relative flex flex-col items-center justify-center bg-gradient-to-br from-orange-600 via-orange-700 to-orange-950 px-8 py-14 text-center text-white"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(251,146,60,.28),transparent_42%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_45%)]" />
            <Image
              src={BRAND.logoSrc}
              alt={BRAND.logoAlt}
              width={240}
              height={160}
              priority
              className="relative z-10 h-auto w-full max-w-[240px] object-contain"
            />
            <h2 className="relative z-10 mt-8 text-4xl font-semibold tracking-tight">{t("auth.premiumClinicOps")}</h2>
            <p className="relative z-10 mt-4 max-w-md text-sm text-orange-100">{t("auth.workflowTagline")}</p>
            <div className="relative z-10 mt-7 grid w-full max-w-md gap-2 text-start text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1">
                  <ShieldCheck size={13} /> {t("auth.encrypted")}
                </div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1">
                  <Building2 size={13} /> {t("auth.multiSite")}
                </div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1">
                  <UserPlus size={13} /> {t("auth.teamReady")}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
