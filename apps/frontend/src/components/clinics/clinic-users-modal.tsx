"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService } from "@/lib/clinic-service";

interface ClinicUsersModalProps {
  open: boolean;
  clinicId: string | null;
  clinicName: string;
  onClose: () => void;
}

export function ClinicUsersModal({ open, clinicId, clinicName, onClose }: ClinicUsersModalProps) {
  const { t } = useI18n();
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Record<string, boolean>>({});

  const usersQuery = useQuery({
    queryKey: ["clinics", "users", clinicId],
    queryFn: () => clinicService.listClinicUsers(String(clinicId)),
    enabled: open && Boolean(clinicId)
  });

  const users = usersQuery.data?.users ?? [];

  const title = useMemo(
    () => (clinicName ? t("clinics.users.titleWithName", { name: clinicName }) : t("clinics.users.title")),
    [clinicName, t]
  );

  const togglePassword = (userId: string) => {
    setVisiblePasswordIds((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  return (
    <Modal open={open} title={title} onClose={onClose} maxWidthClass="max-w-3xl" bodyClassName="max-h-[70vh] overflow-y-auto">
      {usersQuery.isLoading ? (
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      ) : usersQuery.isError ? (
        <p className="text-sm text-amber-700">{t("clinics.users.loadFailed")}</p>
      ) : !users.length ? (
        <p className="text-sm text-slate-500">{t("clinics.users.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full border-collapse text-start text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">{t("field.fullName")}</th>
                <th className="px-3 py-2 font-semibold">{t("field.email")}</th>
                <th className="px-3 py-2 font-semibold">{t("field.role")}</th>
                <th className="px-3 py-2 font-semibold">{t("clinics.users.password")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const showPassword = Boolean(visiblePasswordIds[user.id]);
                const hasPassword = Boolean(user.recoverablePassword);
                return (
                  <tr key={user.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{user.email}</td>
                    <td className="px-3 py-2.5 text-slate-700">{user.role}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
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
