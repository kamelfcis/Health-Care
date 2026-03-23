"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Filter, Hash, Phone, User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/providers/i18n-provider";
import { PatientListQuery } from "@/lib/patient-service";
import { specialtyService } from "@/lib/specialty-service";

const GOVERNORATE_OPTIONS = [
  "CAIRO",
  "GIZA",
  "ALEXANDRIA",
  "SHARKIA",
  "DAKAHLIA",
  "QALYUBIA",
  "MINYA",
  "ASYUT",
  "SOHAG",
  "LUXOR",
  "ASWAN",
  "OTHER"
] as const;

const LEAD_SOURCES = ["FACEBOOK_AD", "GOOGLE_SEARCH", "DOCTOR_REFERRAL", "FRIEND", "OTHER"] as const;

const MARITAL_OPTIONS = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"] as const;

export const emptyPatientListQuery = (): PatientListQuery => ({
  search: "",
  fileNumber: "",
  fullName: "",
  phone: "",
  clinicName: "",
  leadSource: "",
  specialtyCode: "",
  specialtyName: "",
  campaignName: "",
  governorate: "",
  maritalStatus: "",
  doctorName: "",
  createdFrom: "",
  createdTo: "",
  firstVisitFrom: "",
  firstVisitTo: ""
});

interface PatientSearchBarProps {
  value: PatientListQuery;
  onChange: (next: PatientListQuery) => void;
  onClear: () => void;
}

export function PatientSearchBar({ value, onChange, onClear }: PatientSearchBarProps) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ["specialties", "catalog", "filter"],
    queryFn: () => specialtyService.listCatalog()
  });

  const specialties = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  const setField = <K extends keyof PatientListQuery>(key: K, v: PatientListQuery[K]) => {
    onChange({ ...value, [key]: v });
  };

  const inputClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";

  const quickInputClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200";

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-soft backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("patients.search.quickSection")}</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="relative">
          <Hash className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            inputMode="numeric"
            value={value.fileNumber ?? ""}
            onChange={(e) => setField("fileNumber", e.target.value.replace(/\D/g, ""))}
            placeholder={t("patients.search.quickFilePlaceholder")}
            className={quickInputClass}
            aria-label={t("patients.search.fileNumber")}
          />
        </div>
        <div className="relative">
          <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={value.fullName ?? ""}
            onChange={(e) => setField("fullName", e.target.value)}
            placeholder={t("patients.search.quickNamePlaceholder")}
            className={quickInputClass}
            aria-label={t("patients.search.fullName")}
          />
        </div>
        <div className="relative">
          <Phone className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="tel"
            inputMode="tel"
            value={value.phone ?? ""}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder={t("patients.search.quickPhonePlaceholder")}
            className={quickInputClass}
            aria-label={t("patients.search.phone")}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-orange-50"
          onClick={() => setOpen((v) => !v)}
        >
          <Filter size={15} />
          {t("patients.search.advanced")}
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-orange-50"
          onClick={onClear}
        >
          <X size={15} />
          {t("common.clear")}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid overflow-hidden gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.leadSource")}</label>
              <select
                value={value.leadSource ?? ""}
                onChange={(e) => setField("leadSource", e.target.value)}
                className={inputClass}
              >
                <option value="">{t("common.allSources")}</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(`patients.leadSource.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.specialty")}</label>
              <select
                value={value.specialtyCode ?? ""}
                onChange={(e) => setField("specialtyCode", e.target.value)}
                className={inputClass}
                disabled={catalogQuery.isLoading}
              >
                <option value="">{t("common.allSpecialties")}</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.code}>
                    {locale === "ar" ? s.nameAr : s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.specialtyNameContains")}</label>
              <input
                value={value.specialtyName ?? ""}
                onChange={(e) => setField("specialtyName", e.target.value)}
                className={inputClass}
                placeholder={t("patients.search.specialtyNameContains")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.clinicName")}</label>
              <input
                value={value.clinicName ?? ""}
                onChange={(e) => setField("clinicName", e.target.value)}
                className={inputClass}
                placeholder={t("patients.search.clinicNamePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.campaignName")}</label>
              <input
                value={value.campaignName ?? ""}
                onChange={(e) => setField("campaignName", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.createdRange")}</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={value.createdFrom ?? ""}
                  onChange={(e) => setField("createdFrom", e.target.value)}
                  className={inputClass}
                />
                <input
                  type="date"
                  value={value.createdTo ?? ""}
                  onChange={(e) => setField("createdTo", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.firstVisitRange")}</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={value.firstVisitFrom ?? ""}
                  onChange={(e) => setField("firstVisitFrom", e.target.value)}
                  className={inputClass}
                />
                <input
                  type="date"
                  value={value.firstVisitTo ?? ""}
                  onChange={(e) => setField("firstVisitTo", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.governorate")}</label>
              <select
                value={value.governorate ?? ""}
                onChange={(e) => setField("governorate", e.target.value)}
                className={inputClass}
              >
                <option value="">{t("common.all")}</option>
                {GOVERNORATE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {t(`patients.governorate.${g}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.maritalStatus")}</label>
              <select
                value={value.maritalStatus ?? ""}
                onChange={(e) => setField("maritalStatus", e.target.value)}
                className={inputClass}
              >
                <option value="">{t("common.all")}</option>
                {MARITAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {t(`patients.maritalStatus.${m}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("patients.search.doctorName")}</label>
              <input
                value={value.doctorName ?? ""}
                onChange={(e) => setField("doctorName", e.target.value)}
                className={inputClass}
                placeholder={t("patients.search.doctorName")}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
