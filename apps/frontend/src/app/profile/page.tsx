"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { FloatingInput } from "@/components/ui/floating-input";
import { RippleButton } from "@/components/ui/ripple-button";
import { storage } from "@/lib/storage";
import { authService } from "@/lib/auth-service";
import { useI18n } from "@/components/providers/i18n-provider";

export default function ProfilePage() {
  const { t } = useI18n();
  const user = storage.getUser();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => authService.changePassword(form),
    onSuccess: () => {
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      toast.success(t("profile.password.changed"));
    },
    onError: () => {
      toast.error(t("profile.password.changeFailed"));
    }
  });

  return (
    <AppShell>
      <section className="card bg-white/80 p-6">
        <h1 className="text-2xl font-semibold text-brand-navy">{t("common.profile")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("common.account")}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{t("field.firstName")}</p>
            <p className="mt-1 font-medium text-slate-800">{user?.firstName ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{t("field.lastName")}</p>
            <p className="mt-1 font-medium text-slate-800">{user?.lastName ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{t("field.email")}</p>
            <p className="mt-1 font-medium text-slate-800">{user?.email ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{t("field.role")}</p>
            <p className="mt-1 font-medium text-slate-800">{user?.role ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
            <p className="text-xs text-slate-500">Clinic ID</p>
            <p className="mt-1 font-medium text-slate-800">{user?.clinicId ?? "-"}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-800">{t("profile.password.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("profile.password.description")}</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (form.newPassword !== form.confirmPassword) {
                toast.error(t("profile.password.mismatch"));
                return;
              }
              await changePasswordMutation.mutateAsync();
            }}
          >
            <FloatingInput
              id="profile-current-password"
              type="password"
              label={t("profile.password.current")}
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              required
            />
            <FloatingInput
              id="profile-new-password"
              type="password"
              label={t("profile.password.new")}
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              required
            />
            <FloatingInput
              id="profile-confirm-password"
              type="password"
              label={t("profile.password.confirm")}
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              required
            />
            <RippleButton type="submit" className="h-11" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? t("profile.password.saving") : t("profile.password.save")}
            </RippleButton>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
