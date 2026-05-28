"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchText?: string;
}

interface SearchableSelectProps {
  id: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loadingText?: string;
  className?: string;
  /** When set, search is delegated to the parent (e.g. API); options are not filtered locally. */
  onSearchChange?: (query: string) => void;
  loading?: boolean;
  /** Render dropdown into document.body to escape clipping containers. */
  dropdownInPortal?: boolean;
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  loadingText,
  className,
  onSearchChange,
  loading = false,
  dropdownInPortal = false
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (onSearchChange) return options;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => {
      const target = (option.searchText ?? option.label).toLowerCase();
      return target.includes(normalizedQuery);
    });
  }, [options, query, onSearchChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !dropdownInPortal) return;
    const updatePosition = () => {
      const trigger = rootRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const panelMaxHeight = Math.min(360, Math.max(220, Math.floor(viewportHeight * 0.42)));
      const gap = 8;
      const spaceBelow = viewportHeight - rect.bottom - gap;
      const openUp = spaceBelow < 260 && rect.top > spaceBelow;
      const top = openUp ? Math.max(gap, rect.top - panelMaxHeight - gap) : rect.bottom + gap;
      const width = Math.max(220, rect.width);
      const left = Math.min(Math.max(gap, rect.left), Math.max(gap, viewportWidth - width - gap));

      setPanelStyle({
        position: "fixed",
        top,
        left,
        width,
        maxHeight: panelMaxHeight,
        zIndex: 80
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, dropdownInPortal]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const dropdownContent = open ? (
    <div
      ref={panelRef}
      style={dropdownInPortal ? panelStyle : undefined}
      className={cn(
        "mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900",
        dropdownInPortal ? "overflow-hidden" : "",
        !dropdownInPortal ? "absolute z-30" : ""
      )}
    >
      <input
        ref={inputRef}
        type="search"
        dir="auto"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          onSearchChange?.(next);
        }}
        placeholder={searchPlaceholder}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <div
        className={cn(
          "mt-2 overflow-auto rounded-xl border border-slate-100 dark:border-slate-800",
          dropdownInPortal ? "max-h-[calc(100%-3.5rem)] min-h-[8rem]" : "max-h-60"
        )}
      >
        {loading ? (
          <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{loadingText}</p>
        ) : filteredOptions.length ? (
          filteredOptions.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm transition hover:bg-orange-50 dark:hover:bg-slate-800",
                  isSelected ? "bg-orange-50 text-orange-700 dark:bg-slate-800 dark:text-orange-300" : "text-slate-700 dark:text-slate-100"
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                  onSearchChange?.("");
                }}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? <Check size={14} /> : null}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        className="flex h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              setQuery("");
              onSearchChange?.("");
            }
            return next;
          });
        }}
      >
        <span className="truncate text-start">{selectedOption?.label ?? placeholder ?? "-"}</span>
        <ChevronDown size={16} className={cn("transition", open ? "rotate-180" : "")} />
      </button>
      {dropdownInPortal && mounted && dropdownContent ? createPortal(dropdownContent, document.body) : dropdownContent}
    </div>
  );
}
