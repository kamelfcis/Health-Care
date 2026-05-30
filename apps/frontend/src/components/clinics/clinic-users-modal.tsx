"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService, ClinicUserForSuperAdmin } from "@/lib/clinic-service";

interface ClinicUsersModalProps {
  open: boolean;
  clinicId: string | null;
  clinicName: string;
  onClose: () => void;
}

export function ClinicUsersModal({ open, clinicId, clinicName, onClose }: ClinicUsersModalProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Record<string, boolean>>({});
  const [resetTarget, setResetTarget] = useState<ClinicUserForSuperAdmin | null>(null);

  const usersQuery = useQuery({
    queryKey: ["clinics", "users", clinicId],
    queryFn: () => clinicService.listClinicUsers(String(clinicId)),
    enabled: open && Boolean(clinicId)
  });

  const resetMutation = useMutation({
    mutationFn: (userId: string) => clinicService.resetClinicUserPassword(String(clinicId), userId),
    onSuccess: (_data, userId) => {
      toast.success(t("clinics.users.resetSuccess"));
      setVisiblePasswordIds((prev) => ({ ...prev, [userId]: true }));
      setResetTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["clinics", "users", clinicId] });
    },
    onError: () => {
      toast.error(t("clinics.users.resetFailed"));
    }
  });

  const users = usersQuery.data?.users ?? [];

  const title = useMemo(
    () => (clinicName ? t("clinics.users.titleWithName", { name: clinicName }) : t("clinics.users.title")),
    [clinicName, t]
  );

  const togglePassword = (userId: string) => {
    setVisiblePasswordIds((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const resetTargetName = resetTarget ? `${resetTarget.firstName} ${resetTarget.lastName}`.trim() : "";

  return (
    <>
      <Modal open={open} title={title} onClose={onClose} maxWidthClass="max-w-3xl" bodyClassName="max-h-[70vh] overflow-y-auto">
        {usersQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        ) : usersQuery.isError ? (
          <p className="text-sm text-amber-700">{t("clinics.users.loadFailed")}</p>
        ) : !users.length ? (
          <p className="text-sm text-slate-500">{t("clinics.users.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-orange-200/80 shadow-sm">
            <table className="min-w-full border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-orange-300/60 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-2.5 font-semibold">{t("field.fullName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("field.email")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("field.role")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("clinics.users.password")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const showPassword = Boolean(visiblePasswordIds[user.id]);
                  const hasPassword = Boolean(user.recoverablePassword);
                  const isResetting = resetMutation.isPending && resetMutation.variables === user.id;
                  return (
                    <tr key={user.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{user.email}</td>
                      <td className="px-3 py-2.5 text-slate-700">{user.role}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-800">
                            {!hasPassword
                              ? "—"
                              : showPassword
                                ? user.recoverablePassword
                                : "••••••••"}
                          </span>
                          {hasPassword ? (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              aria-label={showPassword ? t("clinics.users.hidePassword") : t("clinics.users.showPassword")}
                              onClick={() => togglePassword(user.id)}
                            >
                              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">{t("clinics.users.passwordUnavailable")}</span>
                          )}
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 text-[10px] font-medium text-orange-800 transition hover:bg-orange-100 disabled:opacity-50"
                            aria-label={t("clinics.users.resetPassword")}
                            disabled={isResetting || resetMutation.isPending}
                            onClick={() => setResetTarget(user)}
                          >
                            <KeyRound size={12} />
                            {isResetting ? t("clinics.users.resetting") : t("clinics.users.resetPassword")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(resetTarget)}
        title={t("clinics.users.resetConfirmTitle")}
        message={t("clinics.users.resetConfirmMessage", { name: resetTargetName })}
        confirmLabel={t("clinics.users.resetPassword")}
        confirmingLabel={t("clinics.users.resetting")}
        isPending={resetMutation.isPending}
        onCancel={() => setResetTarget(null)}
        onConfirm={() => {
          if (resetTarget) resetMutation.mutate(resetTarget.id);
        }}
      />
    </>
  );
}

export function ClinicUsersButton({
  onClick,
  label
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 text-xs font-medium text-violet-800 transition hover:bg-violet-100"
      onClick={onClick}
    >
      <Users size={13} />
      {label}
    </button>
  );
}
