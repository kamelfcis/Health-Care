"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGate } from "@/components/auth/role-gate";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { FloatingInput } from "@/components/ui/floating-input";
import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";
import { adminService } from "@/lib/admin-service";
import { RoleDefinition, RoleName } from "@/types";

interface NewUserForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
}

interface NewRoleForm {
  name: string;
  permissionKeys: string[];
}

interface ClinicUserRow {
  id: string;
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleName;
  permissions: string[];
}

export default function UsersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewUserForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roleId: ""
  });
  const [roleForm, setRoleForm] = useState<NewRoleForm>({
    name: "",
    permissionKeys: []
  });
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<ClinicUserRow | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["users-page", "roles"],
    queryFn: () => adminService.listRoles()
  });
  const permissionsQuery = useQuery({
    queryKey: ["users-page", "permissions"],
    queryFn: () => adminService.listPermissions()
  });

  const usersQuery = useQuery({
    queryKey: ["users-page", "users"],
    queryFn: () => adminService.listUsers()
  });

  const createUserMutation = useMutation({
    mutationFn: (payload: NewUserForm) => adminService.createUser(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users-page", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["doctors"] });
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

  const createRoleMutation = useMutation({
    mutationFn: (payload: NewRoleForm) => adminService.createRole(payload),
    onSuccess: (createdRole) => {
      void queryClient.invalidateQueries({ queryKey: ["users-page", "roles"] });
      setRoleForm({ name: "", permissionKeys: [] });
      setSelectedRoleId(createdRole.id);
      toast.success("Role created");
    },
    onError: () => {
      toast.error("Role creation failed");
    }
  });

  const updateRolePermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) =>
      adminService.updateRolePermissions(roleId, { permissionKeys }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users-page", "roles"] });
      void queryClient.invalidateQueries({ queryKey: ["users-page", "users"] });
      toast.success("Role permissions updated");
    },
    onError: () => {
      toast.error("Role permissions update failed");
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => adminService.deleteRole(roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users-page", "roles"] });
      setSelectedRoleId("");
      toast.success("Role deleted");
    },
    onError: () => {
      toast.error("Role deletion failed");
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => adminService.updateUserRole(userId, roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users-page", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("User role updated");
    },
    onError: () => {
      toast.error("User role update failed");
    }
  });
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users-page", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setDeleteTarget(null);
      toast.success(t("users.deleted"));
    },
    onError: () => {
      toast.error(t("users.deleteFailed"));
    }
  });

  const roles = useMemo(() => (rolesQuery.data ?? []) as RoleDefinition[], [rolesQuery.data]);
  const users = useMemo(() => (usersQuery.data ?? []) as ClinicUserRow[], [usersQuery.data]);
  const permissions = useMemo(() => permissionsQuery.data ?? [], [permissionsQuery.data]);

  useEffect(() => {
    if (!form.roleId && roles.length) {
      const firstAssignable = roles.find((role) => !role.isSystem) ?? roles[0];
      if (firstAssignable) {
        setForm((prev) => ({ ...prev, roleId: firstAssignable.id }));
      }
    }

    if (!selectedRoleId && roles.length) {
      setSelectedRoleId(roles[0].id);
    }
  }, [form.roleId, selectedRoleId, roles]);

  const selectedPermissions = useMemo(
    () => roles.find((role) => role.id === form.roleId)?.permissions ?? [],
    [form.roleId, roles]
  );
  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId), [roles, selectedRoleId]);
  const selectedRolePermissionKeys = useMemo(() => selectedRole?.permissions ?? [], [selectedRole]);

  return (
    <AppShell>
      <RoleGate
        requiredPermissions={["users.manage"]}
        fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}
      >
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="card bg-white/80 p-6 xl:col-span-2">
            <h2 className="text-lg font-semibold text-brand-navy">{t("dashboard.createTeamUser")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("dashboard.createTeamUserDesc")}</p>
            <form
              key={formResetKey}
              className="mt-4 space-y-4"
              autoComplete="off"
              onSubmit={async (event) => {
                event.preventDefault();
                await createUserMutation.mutateAsync(form);
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <FloatingInput
                  id="users-page-first-name"
                  label={t("field.firstName")}
                  autoComplete="off"
                  value={form.firstName}
                  onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  required
                />
                <FloatingInput
                  id="users-page-last-name"
                  label={t("field.lastName")}
                  autoComplete="off"
                  value={form.lastName}
                  onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FloatingInput
                  id="users-page-email"
                  type="email"
                  label={t("field.email")}
                  autoComplete="off"
                  name="users-page-email-new"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
                <FloatingInput
                  id="users-page-password"
                  type="password"
                  label={t("field.temporaryPassword")}
                  autoComplete="new-password"
                  name="users-page-temp-password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="users-page-role" className="text-sm font-medium text-slate-700">
                  {t("field.role")}
                </label>
                <select
                  id="users-page-role"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                  value={form.roleId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      roleId: event.target.value
                    }))
                  }
                >
                  {roles
                    .filter((role) => !role.isSystem)
                    .map((role) => (
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

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="card bg-white/80 p-6">
            <h2 className="text-lg font-semibold text-brand-navy">Create Custom Role</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                await createRoleMutation.mutateAsync(roleForm);
              }}
            >
              <FloatingInput
                id="users-page-role-name"
                label="Role name"
                value={roleForm.name}
                onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <div className="max-h-60 space-y-2 overflow-auto rounded-2xl border border-slate-200 p-3">
                {permissions.map((permission) => {
                  const checked = roleForm.permissionKeys.includes(permission.key);
                  return (
                    <label key={permission.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setRoleForm((prev) => ({
                            ...prev,
                            permissionKeys: event.target.checked
                              ? [...prev.permissionKeys, permission.key]
                              : prev.permissionKeys.filter((item) => item !== permission.key)
                          }))
                        }
                      />
                      <span>{permission.key}</span>
                    </label>
                  );
                })}
              </div>
              <RippleButton type="submit" disabled={createRoleMutation.isPending}>
                {createRoleMutation.isPending ? "Creating..." : "Create Role"}
              </RippleButton>
            </form>
          </div>

          <div className="card bg-white/80 p-6">
            <h2 className="text-lg font-semibold text-brand-navy">Manage Role Permissions</h2>
            <div className="mt-3 space-y-3">
              <select
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <div className="max-h-60 space-y-2 overflow-auto rounded-2xl border border-slate-200 p-3">
                {permissions.map((permission) => {
                  const checked = selectedRolePermissionKeys.includes(permission.key);
                  return (
                    <label key={permission.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={selectedRole?.isSystem}
                        onChange={(event) => {
                          if (!selectedRole) return;
                          const next = event.target.checked
                            ? [...selectedRolePermissionKeys, permission.key]
                            : selectedRolePermissionKeys.filter((item) => item !== permission.key);
                          void updateRolePermissionsMutation.mutateAsync({
                            roleId: selectedRole.id,
                            permissionKeys: next
                          });
                        }}
                      />
                      <span>{permission.key}</span>
                    </label>
                  );
                })}
              </div>
              <RippleButton
                type="button"
                disabled={!selectedRole || selectedRole.isSystem || deleteRoleMutation.isPending}
                onClick={() => {
                  if (!selectedRole) return;
                  void deleteRoleMutation.mutateAsync(selectedRole.id);
                }}
              >
                {deleteRoleMutation.isPending ? "Deleting..." : "Delete Selected Role"}
              </RippleButton>
            </div>
          </div>
        </section>

        <section className="mt-4 card bg-white/80 p-6">
          <h2 className="text-lg font-semibold text-brand-navy">{t("users.title")}</h2>
          <div className="mt-3 overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("table.name")}</th>
                  <th className="px-4 py-3">{t("table.email")}</th>
                  <th className="px-4 py-3">{t("table.role")}</th>
                  <th className="px-4 py-3">Assign role</th>
                  <th className="px-4 py-3">{t("table.permissions")}</th>
                  <th className="px-4 py-3">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3 text-slate-700">{user.role}</td>
                    <td className="px-4 py-3">
                      <select
                        className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
                        value={user.roleId}
                        onChange={(event) =>
                          void updateUserRoleMutation.mutateAsync({
                            userId: user.id,
                            roleId: event.target.value
                          })
                        }
                      >
                        {roles
                          .filter((role) => !role.isSystem)
                          .map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {user.permissions.map((permission) => (
                          <span key={permission} className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {permission}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => setDeleteTarget(user)}
                        aria-label={t("users.delete")}
                        disabled={user.role === "ClinicAdmin" || user.role === "SuperAdmin"}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      {t("dashboard.noClinicUsers")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <ConfirmDeleteModal
          open={Boolean(deleteTarget)}
          title={t("users.deleteConfirmTitle")}
          message={t("users.deleteConfirmMessage", { name: `${deleteTarget?.firstName ?? ""} ${deleteTarget?.lastName ?? ""}`.trim() })}
          confirmLabel={t("users.delete")}
          confirmingLabel={t("users.deleting")}
          isPending={deleteUserMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;
            deleteUserMutation.mutate(deleteTarget.id);
          }}
        />
      </RoleGate>
    </AppShell>
  );
}
