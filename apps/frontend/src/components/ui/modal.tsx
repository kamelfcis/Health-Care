"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  bodyClassName?: string;
}

export function Modal({ open, title, onClose, children, maxWidthClass, bodyClassName }: ModalProps) {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={`relative w-full ${maxWidthClass ?? "max-w-2xl"} overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-orange-50/35 to-sky-50/30 shadow-premium`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(251,146,60,0.15),transparent_35%),radial-gradient(circle_at_100%_0%,rgba(56,189,248,0.16),transparent_35%)]" />
            <div className="relative flex items-center justify-between border-b border-white/80 bg-white/75 p-4 backdrop-blur-2xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-orange-200/30 blur-2xl" />
              <div className="pointer-events-none absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-sky-200/25 blur-2xl" />
              <h3 className="relative text-lg font-semibold text-brand-navy">{title}</h3>
              <button
                onClick={onClose}
                className="relative inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/95 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-white"
              >
                <X size={14} />
                {t("common.close")}
              </button>
            </div>
            <div className={`relative p-5 ${bodyClassName ?? ""}`}>{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
