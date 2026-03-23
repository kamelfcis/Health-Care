"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Filter, Hash, Phone, Search, User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/providers/i18n-provider";
import { AppointmentListQuery } from "@/lib/appointment-service";
import { specialtyService, VisitEntryType } from "@/lib/specialty-service";

const APPOINTMENT_STATUSES = ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

interface AppointmentSearchBarProps {
  value: AppointmentListQuery;
  onChange: (next: AppointmentListQuery) => void;
  onClear: () => void;
}

export function AppointmentSearchBar({ value, onChange, onClear }: AppointmentSearchBarProps) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ["specialties", "catalog", "appointment-filter"],
    queryFn: () => specialtyService.listCatalog()
  });

  const specialties = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  const setField = <K extends keyof AppointmentListQuery>(key: K, v: AppointmentListQuery[K]) => {
    onChange({ ...value, [key]: v });
  };

  const inputClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";

  const quickInputClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200";

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-soft backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("appointments.search.quickSection")}</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Hash className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            inputMode="numeric"
            value={value.patientFileNumber ?? ""}
            onChange={(e) => setField("patientFileNumber", e.target.value.replace(/\D/g, ""))}
            placeholder={t("appointments.search.quickFilePlaceholder")}
            className={quickInputClass}
            aria-label={t("appointments.search.fileNumber")}
          />
        </div>
        <div className="relative">
          <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={value.patientFullName ?? ""}
            onChange={(e) => setField("patientFullName", e.target.value)}
            placeholder={t("appointments.search.quickNamePlaceholder")}
            className={quickInputClass}
            aria-label={t("appointments.search.patientName")}
          />
        </div>
        <div className="relative">
          <Phone className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="tel"
            inputMode="tel"
            value={value.patientPhone ?? ""}
            onChange={(e) => setField("patientPhone", e.target.value)}
            placeholder={t("appointments.search.quickPhonePlaceholder")}
            className={quickInputClass}
            aria-label={t("appointments.search.phone")}
          />
        </div>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={value.search ?? ""}
            onChange={(e) => setField("search", e.target.value)}
            placeholder={t("appointments.search.keywordPlaceholder")}
            className={quickInputClass}
            aria-label={t("appointments.search.keywordPlaceholder")}
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
          {t("appointments.search.advanced")}
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
              <label className="text-xs font-medium text-slate-600">{t("appointments.search.status")}</label>
              <select
                value={value.status ?? ""}
                onChange={(e) => setField("status", e.target.value)}
                className={inputClass}
              >
                <option value="">{t("common.allStatuses")}</option>
                {APPOINTMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("appointments.entryType")}</label>
              <select
                value={value.entryType ?? ""}
                onChange={(e) => setField("entryType", e.target.value as VisitEntryType | "")}
                className={inputClass}
              >
                <option value="">{t("common.all")}</option>
                <option value="EXAM">{t("appointments.entryType.exam")}</option>
                <option value="CONSULTATION">{t("appointments.entryType.consultation")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("appointments.search.specialty")}</label>
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
              <label className="text-xs font-medium text-slate-600">{t("appointments.search.doctorName")}</label>
              <input
                value={value.doctorName ?? ""}
                onChange={(e) => setField("doctorName", e.target.value)}
                className={inputClass}
                placeholder={t("appointments.search.doctorName")}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <label className="text-xs font-medium text-slate-600">{t("appointments.search.startsRange")}</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={value.startsFrom ?? ""}
                  onChange={(e) => setField("startsFrom", e.target.value)}
                  className={inputClass}
                />
                <input
                  type="date"
                  value={value.startsTo ?? ""}
                  onChange={(e) => setField("startsTo", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
