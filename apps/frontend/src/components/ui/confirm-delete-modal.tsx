"use client";

import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmingLabel: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  open,
  title,
  message,
  confirmLabel,
  confirmingLabel,
  isPending = false,
  onCancel,
  onConfirm
}: ConfirmDeleteModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onCancel}
            disabled={isPending}
          >
            {t("common.cancel")}
          </button>
          <RippleButton
            type="button"
            className="h-10 bg-rose-600 text-sm hover:bg-rose-700"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? confirmingLabel : confirmLabel}
          </RippleButton>
        </div>
      </div>
    </div>
  );
}
