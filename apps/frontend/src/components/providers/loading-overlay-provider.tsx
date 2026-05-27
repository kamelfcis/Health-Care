"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useI18n } from "./i18n-provider";
import { BRAND } from "@/lib/brand";

interface LoadingOverlayContextValue {
  startLoading: () => void;
  stopLoading: () => void;
  showFor: (durationMs: number) => void;
}

const LoadingOverlayContext = createContext<LoadingOverlayContextValue | null>(null);

export function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useI18n();

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const startLoading = useCallback(() => {
    clearHideTimer();
    setVisible(true);
  }, []);

  const stopLoading = useCallback(() => {
    clearHideTimer();
    setVisible(false);
  }, []);

  const showFor = useCallback((durationMs: number) => {
    clearHideTimer();
    setVisible(true);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      hideTimer.current = null;
    }, durationMs);
  }, []);

  const value = useMemo(
    () => ({
      startLoading,
      stopLoading,
      showFor
    }),
    [showFor, startLoading, stopLoading]
  );

  return (
    <LoadingOverlayContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {visible ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/60 bg-white/90 px-8 py-10 shadow-premium"
            >
              <Image
                src={BRAND.logoSrc}
                alt={BRAND.logoAlt}
                width={120}
                height={80}
                className="h-auto w-full max-w-[120px] object-contain"
              />
              <p className="mt-4 text-lg font-semibold text-brand-navy">{BRAND.name}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600">
                <LoadingSpinner className="h-4 w-4 text-orange-500" />
                {t("common.loading")}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </LoadingOverlayContext.Provider>
  );
}

export function useLoadingOverlay() {
  const context = useContext(LoadingOverlayContext);
  if (!context) {
    throw new Error("useLoadingOverlay must be used within LoadingOverlayProvider");
  }
  return context;
}
