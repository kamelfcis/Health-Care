"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { ArrowLeft, Building2, ChevronLeft, ChevronRight, Shield, Trash2, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { AdvancedSearch } from "@/components/ui/AdvancedSearch";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService } from "@/lib/clinic-service";
import { storage } from "@/lib/storage";
import { SystemUserRow, userService } from "@/lib/user-service";
import { RoleName } from "@/types";

const SYSTEM_ROLE_OPTIONS: RoleName[] = [
  "SuperAdmin",
  "ClinicAdmin",
  "Doctor",
  "Nurse",
  "Receptionist",
  "Pharmacist",
  "Accountant"
];

const ROLE_BADGE: Record<string, string> = {
  SuperAdmin: "bg-violet-100 text-violet-800 ring-violet-200",
  ClinicAdmin: "bg-orange-100 text-orange-800 ring-orange-200",
  Doctor: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Nurse: "bg-sky-100 text-sky-800 ring-sky-200",
  Receptionist: "bg-amber-100 text-amber-800 ring-amber-200"
};

const DEFAULT_ROLE_BADGE = "bg-slate-100 text-slate-700 ring-slate-200";

const getInitials = (firstName: string, lastName: string) => {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();
  return `${first}${last}` || "?";
};

const formatJoinedDate = (value: string, locale: string) => {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  } catch {
    return value;
  }
};

type DeletedFilter = "active" | "deleted" | "all";

function DeletedFilterToggle({
  value,
  onChange,
  label
}: {
  value: DeletedFilter;
  onChange: (next: DeletedFilter) => void;
  label: string;
}) {
  const { t } = useI18n();
  const options: Array<{ value: DeletedFilter; label: string }> = [
    { value: "active", label: t("common.active") },
    { value: "deleted", label: t("common.deleted") },
    { value: "all", label: t("common.all") }
  ];

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-orange-200/70 bg-orange-50/40 px-2 py-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="inline-flex rounded-lg border border-orange-200 bg-white p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              value === option.value
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-600 hover:bg-orange-50 hover:text-orange-700"
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const API_DELETE_ERROR_KEYS: Record<string, string> = {
  "You cannot delete your own account": "systemUsers.cannotDeleteSelf",
  "Cannot delete the last Super Admin account": "systemUsers.cannotDeleteLastSuperAdmin",
  "Cannot delete user: linked doctor appointments or prescriptions exist": "systemUsers.deleteBlockedDoctor",
  "Cannot delete user: linked follow-ups exist": "systemUsers.deleteBlockedFollowUps"
};

function getDeleteErrorMessage(error: unknown, t: (key: string) => string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      const i18nKey = API_DELETE_ERROR_KEYS[message.trim()];
      if (i18nKey) return t(i18nKey);
      return message.trim();
    }
  }
  return t("systemUsers.deleteFailed");
}

function UserAvatar({ user }: { user: SystemUserRow }) {
  const initials = getInitials(user.firstName, user.lastName);
  return (
    <span
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-bold text-white shadow-sm ring-2 ring-orange-100"
      aria-hidden
    >
      {initials}
    </span>
  );
}

function RoleBadge({ role }: { role: RoleName }) {
  const className = ROLE_BADGE[role] ?? DEFAULT_ROLE_BADGE;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}>
      <Shield size={11} />
      {role}
    </span>
  );
}

function ClinicBadge({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
        <Building2 size={11} />
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-800 ring-1 ring-inset ring-orange-200">
      <Building2 size={11} />
      {name}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export default function SystemUsersPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(() => storage.getUser());
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>("active");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<SystemUserRow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, clinicFilter, roleFilter, deletedFilter]);

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-system-users"],
    queryFn: () => clinicService.list()
  });

  const usersQuery = useQuery({
    queryKey: ["system-users", page, debouncedSearch, clinicFilter, roleFilter, deletedFilter],
    queryFn: () =>
      userService.listAllSystem({
        page,
        pageSize: 50,
        search: debouncedSearch || undefined,
        clinicId: clinicFilter !== "all" ? clinicFilter : undefined,
        role: roleFilter,
        deletedFilter
      }),
    enabled: currentUser?.role === "SuperAdmin"
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => userService.deleteSystemUser(userId),
    onSuccess: () => {
      toast.success(t("systemUsers.deleted"));
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["system-users"] });
    },
    onError: (error) => {
      toast.error(getDeleteErrorMessage(error, t));
    }
  });

  const clinicOptions = useMemo(
    () => [
      { label: t("common.allClinics"), value: "all" },
      ...(clinicsQuery.data ?? []).map((clinic) => ({ label: clinic.name, value: clinic.id }))
    ],
    [clinicsQuery.data, t]
  );

  const roleOptions = useMemo(
    () => [
      { label: t("common.allStatuses"), value: "all" },
      ...SYSTEM_ROLE_OPTIONS.map((role) => ({ label: role, value: role }))
    ],
    [t]
  );

  const users = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = usersQuery.data?.totalPages ?? 1;
  const deleteTargetName = deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}`.trim() : "";

  return (
    <RoleGate allowed={["SuperAdmin"]} fallback={<div className="card p-6 text-base text-slate-500">{t("common.notAllowed")}</div>}>
      <AppShell>
        <section className="space-y-5">
          <div className="relative overflow-hidden rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-500 p-6 text-white shadow-lg shadow-orange-500/20">
            <div className="pointer-events-none absolute -end-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 start-1/3 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/25"
                >
                  <ArrowLeft size={14} />
                  {t("nav.dashboard")}
                </Link>
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
                    <Users size={24} />
                  </span>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("systemUsers.title")}</h1>
                    <p className="mt-1 max-w-2xl text-sm text-orange-50/90">{t("systemUsers.subtitle")}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white/15 px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs font-medium text-orange-100">{t("systemUsers.totalUsers", { count: String(total) })}</p>
              </div>
            </div>
          </div>

          <div className="card space-y-4 bg-white/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DeletedFilterToggle
                value={deletedFilter}
                onChange={setDeletedFilter}
                label={t("systemUsers.filterDeleted")}
              />
            </div>
            <AdvancedSearch
              searchValue={search}
              statusValue={roleFilter}
              fromValue=""
              toValue=""
              onSearchChange={setSearch}
              onStatusChange={setRoleFilter}
              onFromChange={() => undefined}
              onToChange={() => undefined}
              onClear={() => {
                setSearch("");
                setRoleFilter("all");
                setClinicFilter("all");
                setDeletedFilter("active");
              }}
              statusOptions={roleOptions}
              placeholder={t("systemUsers.searchPlaceholder")}
              filterExtras={
                <div className="space-y-1.5">
                  <label htmlFor="system-users-clinic-filter" className="text-xs font-medium text-slate-600">
                    {t("systemUsers.filterClinic")}
                  </label>
                  <select
                    id="system-users-clinic-filter"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    value={clinicFilter}
                    onChange={(event) => setClinicFilter(event.target.value)}
                  >
                    {clinicOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              }
            />

            {usersQuery.isLoading ? (
              <LoadingSkeleton />
            ) : usersQuery.isError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-800">
                {t("systemUsers.loadFailed")}
              </div>
            ) : !users.length ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                <span className="rounded-2xl bg-orange-100 p-4 text-orange-600">
                  <Users size={28} />
                </span>
                <p className="text-sm font-medium text-slate-600">{t("systemUsers.empty")}</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-xs uppercase tracking-wide text-white">
                        <th className="px-4 py-3 text-start font-semibold">{t("table.name")}</th>
                        <th className="px-4 py-3 text-start font-semibold">{t("table.email")}</th>
                        <th className="px-4 py-3 text-start font-semibold">{t("table.role")}</th>
                        <th className="px-4 py-3 text-start font-semibold">{t("nav.clinics")}</th>
                        <th className="px-4 py-3 text-start font-semibold">{t("field.status")}</th>
                        <th className="px-4 py-3 text-start font-semibold">{t("systemUsers.joined")}</th>
                        <th className="px-4 py-3 text-start font-semibold">{t("common.deleted")}</th>
                        <th className="px-4 py-3 text-start font-semibold">{t("table.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const isDeleted = Boolean(user.deletedAt);
                        return (
                        <tr
                          key={user.id}
                          className={`border-t border-slate-100 transition ${
                            isDeleted ? "bg-slate-50/80 opacity-80" : "hover:bg-orange-50/40"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar user={user} />
                              <div className="min-w-0">
                                <span
                                  className={`block font-semibold ${
                                    isDeleted ? "text-slate-500 line-through" : "text-slate-900"
                                  }`}
                                >
                                  {user.firstName} {user.lastName}
                                </span>
                                {isDeleted ? (
                                  <span className="mt-0.5 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                    {t("systemUsers.deletedBadge")}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className={`px-4 py-3 ${isDeleted ? "text-slate-400" : "text-slate-600"}`}>{user.email}</td>
                          <td className="px-4 py-3">
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="px-4 py-3">
                            {user.clinicName ? (
                              <ClinicBadge name={user.clinicName} />
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                                {t("systemUsers.noClinic")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isDeleted ? (
                              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                {t("common.deleted")}
                              </span>
                            ) : (
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {user.isActive ? t("common.active") : t("common.inactive")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatJoinedDate(user.createdAt, locale)}</td>
                          <td className="px-4 py-3 text-slate-500">
                            {user.deletedAt
                              ? t("systemUsers.deletedOn", {
                                  date: formatJoinedDate(user.deletedAt, locale)
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={t("systemUsers.delete")}
                              disabled={user.id === currentUser?.id || deleteUserMutation.isPending}
                              title={user.id === currentUser?.id ? t("systemUsers.cannotDeleteSelf") : t("systemUsers.delete")}
                              onClick={() => setDeleteTarget(user)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {totalPages > 1 ? (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                <p className="text-sm text-slate-500">
                  {t("systemUsers.pageOf", { page: String(page), totalPages: String(totalPages) })}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={page <= 1 || usersQuery.isFetching}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft size={16} />
                    {t("systemUsers.prevPage")}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={page >= totalPages || usersQuery.isFetching}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    {t("systemUsers.nextPage")}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <ConfirmDeleteModal
            open={Boolean(deleteTarget)}
            title={t("systemUsers.deleteConfirmTitle")}
            message={t("systemUsers.deleteConfirmMessage", {
              name: deleteTargetName,
              email: deleteTarget?.email ?? ""
            })}
            confirmLabel={t("systemUsers.delete")}
            confirmingLabel={t("systemUsers.deleting")}
            isPending={deleteUserMutation.isPending}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
              if (deleteTarget) deleteUserMutation.mutate(deleteTarget.id);
            }}
          />
        </section>
      </AppShell>
    </RoleGate>
  );
}
