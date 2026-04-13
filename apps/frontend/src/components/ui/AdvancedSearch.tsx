"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, Search, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";

export interface FilterOption {
  label: string;
  value: string;
}

interface AdvancedSearchProps {
  searchValue: string;
  statusValue: string;
  fromValue: string;
  toValue: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
  statusOptions: FilterOption[];
  placeholder?: string;
  /** Shown under the date row (e.g. what the date range filters) */
  dateRangeHint?: string;
  /** Extra controls inside the expandable filters panel */
  filterExtras?: ReactNode;
}

export function AdvancedSearch({
  searchValue,
  statusValue,
  fromValue,
  toValue,
  onSearchChange,
  onStatusChange,
  onFromChange,
  onToChange,
  onClear,
  statusOptions,
  placeholder,
  dateRangeHint,
  filterExtras
}: AdvancedSearchProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-soft backdrop-blur-sm">
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder || t("common.search")}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-orange-50"
          onClick={() => setOpen((value) => !value)}
        >
          <Filter size={15} />
          {t("common.filters")}
        </button>
        <button
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
            className="grid overflow-hidden pt-3 md:grid-cols-3 md:gap-3"
          >
            <select
              value={statusValue}
              onChange={(event) => onStatusChange(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={fromValue}
              aria-label={t("collection.fromDate")}
              onChange={(event) => onFromChange(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <input
              type="date"
              value={toValue}
              aria-label={t("collection.toDate")}
              onChange={(event) => onToChange(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            {dateRangeHint ? (
              <p className="text-xs leading-relaxed text-slate-500 md:col-span-3">{dateRangeHint}</p>
            ) : null}
            {filterExtras ? <div className="w-full pt-1 md:col-span-3">{filterExtras}</div> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
