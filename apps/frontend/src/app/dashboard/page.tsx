"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Calendar, CalendarClock, ClipboardList, CreditCard, LayoutDashboard, Pill, Settings, Stethoscope, UserCog, Users, Wallet } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "@/components/ui/stat-card";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGate } from "@/components/auth/role-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingInput } from "@/components/ui/floating-input";
import { RippleButton } from "@/components/ui/ripple-button";
import { AdvancedSearch } from "@/components/ui/AdvancedSearch";
import { adminService } from "@/lib/admin-service";
import { clinicService } from "@/lib/clinic-service";
import { formatCurrency } from "@/lib/currency-format";
import { DashboardMetrics, dashboardService } from "@/lib/dashboard-service";
import { storage } from "@/lib/storage";
import { RoleDefinition, RoleName } from "@/types";
import { toast } from "sonner";
import { useI18n } from "@/components/providers/i18n-provider";
import { hasPermission } from "@/lib/permissions";

interface NewUserForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
}

interface ClinicUserRow {
  id: string;
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleName;
  permissions: string[];
  createdAt?: string;
}

type QuickActionConfig = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
  requiredPermission?: string;
  allowedRoles?: RoleName[];
};

export default function DashboardPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);
  const canManageUsers = hasPermission(currentUser, "users.manage");
  const canViewRoles = hasPermission(currentUser, "roles.read");
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const metricsFallback: DashboardMetrics = {
    totalPatients: 0,
    appointmentsToday: 0,
    activeDoctors: 0,
    outstandingInvoices: 0,
    totalUsers: 0,
    usersCreatedThisWeek: 0,
    invoicesPaidCount: 0,
    invoicesPendingCount: 0
  };

  const [form, setForm] = useState<NewUserForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roleId: ""
  });
  const [formResetKey, setFormResetKey] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRoleFilter, setUsersRoleFilter] = useState("all");
  const [usersFromDate, setUsersFromDate] = useState("");
  const [usersToDate, setUsersToDate] = useState("");

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-filter"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin
  });
  const myClinicQuery = useQuery({
    queryKey: ["settings", "clinic-me"],
    queryFn: () => clinicService.getMyClinic(),
    enabled: !isSuperAdmin
  });
  const clinicScopeForMetrics = isSuperAdmin ? (selectedClinicId === "all" ? undefined : selectedClinicId) : myClinicQuery.data?.id;
  const metricsQuery = useQuery({
    queryKey: ["dashboard", "metrics", clinicScopeForMetrics ?? "mine-pending"],
    queryFn: () => dashboardService.getMetrics(clinicScopeForMetrics),
    enabled: isSuperAdmin || Boolean(myClinicQuery.data?.id)
  });

  const rolesQuery = useQuery({
    queryKey: ["dashboard", "roles"],
    queryFn: () => adminService.listRoles(),
    enabled: canViewRoles
  });

  const usersQuery = useQuery({
    queryKey: ["dashboard", "users"],
    queryFn: () => adminService.listUsers(),
    enabled: canManageUsers
  });

  const createUserMutation = useMutation({
    mutationFn: (payload: NewUserForm) => adminService.createUser(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "users"] });
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        roleId: ""
      });
      setFormResetKey((prev) => prev + 1);
      toast.success(t("dashboard.userCreated"));
    },
    onError: () => {
      toast.error(t("dashboard.userCreateFailed"));
    }
  });

  const loading = metricsQuery.isLoading || (canManageUsers && (rolesQuery.isLoading || usersQuery.isLoading));
  const metrics = metricsQuery.data ?? metricsFallback;
  const roles = useMemo(() => (rolesQuery.data ?? []) as RoleDefinition[], [rolesQuery.data]);
  const users = useMemo(() => (usersQuery.data ?? []) as ClinicUserRow[], [usersQuery.data]);
  const userRoleOptions = useMemo(
    () => [{ label: t("common.allStatuses"), value: "all" }, ...roles.map((role) => ({ label: role.name, value: role.name }))],
    [roles, t]
  );
  const filteredUsers = useMemo(() => {
    const normalizedSearch = usersSearch.trim().toLowerCase();
    return users.filter((user) => {
      const userDate = user.createdAt ? new Date(user.createdAt) : null;
      const fromDate = usersFromDate ? new Date(`${usersFromDate}T00:00:00`) : null;
      const toDate = usersToDate ? new Date(`${usersToDate}T23:59:59`) : null;
      const matchesSearch =
        !normalizedSearch ||
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        user.role.toLowerCase().includes(normalizedSearch);
      const matchesRole = usersRoleFilter === "all" || user.role === usersRoleFilter;
      const matchesFrom = !fromDate || !userDate || userDate >= fromDate;
      const matchesTo = !toDate || !userDate || userDate <= toDate;
      return matchesSearch && matchesRole && matchesFrom && matchesTo;
    });
  }, [users, usersSearch, usersRoleFilter, usersFromDate, usersToDate]);

  const selectedCurrencyCode = useMemo(() => {
    if (isSuperAdmin) {
      if (selectedClinicId === "all") return "USD";
      const selectedClinic = (clinicsQuery.data ?? []).find((clinic) => clinic.id === selectedClinicId);
      return (selectedClinic?.currencyCode ?? "USD").toUpperCase();
    }
    return (myClinicQuery.data?.currencyCode ?? "USD").toUpperCase();
  }, [clinicsQuery.data, isSuperAdmin, myClinicQuery.data?.currencyCode, selectedClinicId]);

  const outstandingInvoicesDisplay = useMemo(
    () => formatCurrency(metrics.outstandingInvoices, selectedCurrencyCode),
    [metrics.outstandingInvoices, selectedCurrencyCode]
  );
  const quickActionConfig = useMemo<QuickActionConfig[]>(
    () => [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, requiredPermission: "dashboard.view" },
      { href: "/clinics", labelKey: "nav.clinics", icon: Building2, requiredPermission: "clinics.read" },
      { href: "/specialties", labelKey: "nav.specialties", icon: ClipboardList, allowedRoles: ["SuperAdmin"] },
      { href: "/specialties/templates", labelKey: "nav.specialtiesTemplates", icon: ClipboardList, allowedRoles: ["SuperAdmin"] },
      { href: "/specialties/rules", labelKey: "nav.specialtiesRulesBuilder", icon: ClipboardList, allowedRoles: ["SuperAdmin"] },
      { href: "/specialties/lookup", labelKey: "nav.specialtiesLookup", icon: ClipboardList, allowedRoles: ["SuperAdmin"] },
      { href: "/users", labelKey: "nav.users", icon: UserCog, requiredPermission: "users.read" },
      { href: "/doctors", labelKey: "nav.doctors", icon: Stethoscope, requiredPermission: "doctors.read" },
      { href: "/patients", labelKey: "nav.patients", icon: Users, requiredPermission: "patients.read" },
      { href: "/appointments", labelKey: "nav.appointments", icon: Calendar, requiredPermission: "appointments.read" },
      { href: "/pharmacy", labelKey: "nav.pharmacy", icon: Pill, requiredPermission: "pharmacy.view" },
      { href: "/billing", labelKey: "nav.billing", icon: CreditCard, requiredPermission: "billing.read" },
      { href: "/payments", labelKey: "nav.payments", icon: Wallet, requiredPermission: "payments.read" },
      { href: "/dashboard/leads", labelKey: "nav.leads", icon: ClipboardList, requiredPermission: "leads.read" },
      { href: "/settings", labelKey: "nav.settings", icon: Settings }
    ],
    []
  );
  const quickActions = useMemo(() => {
    return quickActionConfig.filter((action) => {
      if (!currentUser) return false;
      if (action.allowedRoles?.length && !action.allowedRoles.includes(currentUser.role)) {
        return false;
      }
      if (!action.requiredPermission) return true;
      return hasPermission(currentUser, action.requiredPermission);
    });
  }, [currentUser, quickActionConfig]);

  useEffect(() => {
    if (!form.roleId && roles.length) {
      setForm((prev) => ({ ...prev, roleId: roles[0].id }));
    }
  }, [form.roleId, roles]);

  const selectedPermissions = useMemo(
    () => roles.find((role) => role.id === form.roleId)?.permissions ?? [],
    [form.roleId, roles]
  );

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createUserMutation.mutateAsync(form);
  };

  return (
    <AppShell>
      {isSuperAdmin ? (
        <section className="mb-4 card bg-white/80 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">{t("dashboard.clinicScope")}</p>
            <select
              className="h-11 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
              value={selectedClinicId}
              onChange={(event) => setSelectedClinicId(event.target.value)}
            >
              <option value="all">{t("common.allClinics")}</option>
              {(clinicsQuery.data ?? []).map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}
      <section className="mb-4 card bg-white/80 p-5">
        <h2 className="text-lg font-semibold text-brand-navy">{t("dashboard.quickActionsTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("dashboard.quickActionsDescription")}</p>
        {quickActions.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {quickActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 transition hover:border-orange-300 hover:shadow-soft"
                >
                  <span className="text-sm font-semibold">{t(action.labelKey)}</span>
                  <span className="rounded-xl bg-orange-100 p-2 text-orange-600 transition group-hover:bg-orange-500 group-hover:text-white">
                    <ActionIcon size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            {t("dashboard.quickActionsEmpty")}
          </div>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <StatCard
            title={t("dashboard.totalPatients")}
            value={metrics.totalPatients}
            icon={<Users size={17} />}
            gradientClassName="bg-gradient-to-br from-cyan-50 via-white to-sky-100"
            iconClassName="bg-cyan-500"
          />
        )}
        {loading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <StatCard
            title={t("dashboard.appointmentsToday")}
            value={metrics.appointmentsToday}
            icon={<CalendarClock size={17} />}
            gradientClassName="bg-gradient-to-br from-violet-50 via-white to-fuchsia-100"
            iconClassName="bg-violet-500"
          />
        )}
        {loading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <StatCard
            title={t("dashboard.outstandingInvoices")}
            value={outstandingInvoicesDisplay}
            icon={<Wallet size={17} />}
            gradientClassName="bg-gradient-to-br from-amber-50 via-white to-orange-100"
            iconClassName="bg-orange-500"
          />
        )}
        <RoleGate requiredPermissions={["doctors.read"]}>
          {loading ? (
            <Skeleton className="h-28 rounded-2xl" />
          ) : (
            <StatCard
              title={t("dashboard.activeDoctors")}
              value={metrics.activeDoctors}
              icon={<Stethoscope size={17} />}
              gradientClassName="bg-gradient-to-br from-emerald-50 via-white to-teal-100"
              iconClassName="bg-emerald-500"
            />
          )}
        </RoleGate>
      </section>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : (
          <StatCard
            title={t("dashboard.totalUsers")}
            value={metrics.totalUsers}
            icon={<UserCog size={17} />}
            gradientClassName="bg-gradient-to-br from-indigo-50 via-white to-blue-100"
            iconClassName="bg-indigo-500"
          />
        )}
        {loading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : (
          <StatCard
            title={t("dashboard.usersCreatedThisWeek")}
            value={metrics.usersCreatedThisWeek}
            icon={<Users size={17} />}
            gradientClassName="bg-gradient-to-br from-sky-50 via-white to-cyan-100"
            iconClassName="bg-sky-500"
          />
        )}
        {loading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : (
          <StatCard
            title={t("dashboard.invoicesPaidCount")}
            value={metrics.invoicesPaidCount}
            icon={<CreditCard size={17} />}
            gradientClassName="bg-gradient-to-br from-emerald-50 via-white to-lime-100"
            iconClassName="bg-emerald-500"
          />
        )}
        {loading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : (
          <StatCard
            title={t("dashboard.invoicesPendingCount")}
            value={metrics.invoicesPendingCount}
            icon={<Wallet size={17} />}
            gradientClassName="bg-gradient-to-br from-rose-50 via-white to-orange-100"
            iconClassName="bg-rose-500"
          />
        )}
      </section>
      <RoleGate requiredPermissions={["users.manage"]}>
        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="card bg-white/80 p-6 xl:col-span-2">
            <h2 className="text-lg font-semibold text-brand-navy">{t("dashboard.createTeamUser")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("dashboard.createTeamUserDesc")}</p>
            <form key={formResetKey} className="mt-4 space-y-4" onSubmit={createUser} autoComplete="off">
              <div className="grid gap-3 md:grid-cols-2">
                <FloatingInput
                  id="new-user-first-name"
                  label={t("field.firstName")}
                  autoComplete="off"
                  value={form.firstName}
                  onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  required
                />
                <FloatingInput
                  id="new-user-last-name"
                  label={t("field.lastName")}
                  autoComplete="off"
                  value={form.lastName}
                  onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FloatingInput
                  id="new-user-email"
                  type="email"
                  label={t("field.email")}
                  autoComplete="off"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
                <FloatingInput
                  id="new-user-password"
                  type="password"
                  label={t("field.temporaryPassword")}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="new-user-role" className="text-sm font-medium text-slate-700">
                  {t("field.role")}
                </label>
                <select
                  id="new-user-role"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                  value={form.roleId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      roleId: event.target.value
                    }))
                  }
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <RippleButton type="submit" className="h-11 w-full md:w-auto" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? t("common.creatingUser") : t("common.createUser")}
              </RippleButton>
            </form>
          </div>

          <div className="card bg-white/80 p-6">
            <h3 className="text-base font-semibold text-brand-navy">{t("dashboard.rolePermissions")}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {t("dashboard.permissionsForRole")}: {roles.find((role) => role.id === form.roleId)?.name ?? "-"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedPermissions.length ? (
                selectedPermissions.map((permission) => (
                  <span key={permission} className="rounded-xl bg-orange-50 px-2.5 py-1 text-xs text-orange-700">
                    {permission}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">{t("dashboard.noPermissions")}</span>
              )}
            </div>
          </div>
        </section>

        <section className="mt-4 card bg-white/80 p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-brand-navy">{t("dashboard.clinicUsers")}</h2>
            <span className="rounded-xl bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
              {filteredUsers.length}
            </span>
          </div>
          <AdvancedSearch
            searchValue={usersSearch}
            statusValue={usersRoleFilter}
            fromValue={usersFromDate}
            toValue={usersToDate}
            onSearchChange={setUsersSearch}
            onStatusChange={setUsersRoleFilter}
            onFromChange={setUsersFromDate}
            onToChange={setUsersToDate}
            onClear={() => {
              setUsersSearch("");
              setUsersRoleFilter("all");
              setUsersFromDate("");
              setUsersToDate("");
            }}
            statusOptions={userRoleOptions}
            placeholder={t("common.search")}
          />
          <div className="mt-3 overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-gradient-to-r from-slate-100 via-orange-50 to-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.name")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.email")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.role")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.permissions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-start text-slate-700">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-start text-slate-600">{user.email}</td>
                    <td className="px-4 py-3 text-start text-slate-700">{user.role}</td>
                    <td className="px-4 py-3 text-start">
                      <div className="flex flex-wrap gap-1.5">
                        {user.permissions.map((permission) => (
                          <span key={permission} className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {permission}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredUsers.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      {t("dashboard.noClinicUsers")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </RoleGate>
    </AppShell>
  );
}
