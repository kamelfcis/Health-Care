"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { SquarePen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { EntityCollectionView } from "@/components/ui/entity-collection-view";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService } from "@/lib/clinic-service";
import { doctorService } from "@/lib/doctor-service";
import { specialtyService } from "@/lib/specialty-service";
import { storage } from "@/lib/storage";
import { RoleGate } from "@/components/auth/role-gate";
import { hasPermission } from "@/lib/permissions";

type DoctorRow = {
  id: string;
  email: string;
  isActive: boolean;
  name: string;
  specialty: string;
  license: string;
};

export default function DoctorsPage() {
  const getErrorMessage = (error: unknown, fallbackKey: string) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 409) {
        const message = error.response?.data?.message;
        if (typeof message === "string" && message.includes("linked appointments, prescriptions, or follow-ups")) {
          return t("doctors.deleteBlockedLinkedRecords");
        }
      }
      const message = error.response?.data?.message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
    return t(fallbackKey);
  };
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const canManageDoctors = hasPermission(currentUser, "doctors.manage");
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DoctorRow | null>(null);
  const [formExpanded, setFormExpanded] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    specialty: "",
    licenseNumber: "",
    isActive: true
  });

  const mutationClinicScope = isSuperAdmin ? (selectedClinicId === "all" ? undefined : selectedClinicId) : undefined;

  const resetForm = () => {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      specialty: "",
      licenseNumber: "",
      isActive: true
    });
    setEditingDoctorId(null);
  };

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-filter"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin
  });
  const myClinicQuery = useQuery({
    queryKey: ["clinic", "me", "doctors-form", currentUser?.role ?? "none"],
    queryFn: () => clinicService.getMyClinic(),
    enabled: !!currentUser && currentUser.role !== "SuperAdmin"
  });
  const listClinicScope = isSuperAdmin
    ? selectedClinicId === "all"
      ? undefined
      : selectedClinicId
    : myClinicQuery.data?.id ?? currentUser?.clinicId;

  const doctorsQuery = useQuery({
    queryKey: ["doctors", { page: 1, pageSize: 500, clinicId: listClinicScope ?? "mine-pending" }],
    queryFn: () => doctorService.list(listClinicScope),
    enabled: isSuperAdmin || Boolean(myClinicQuery.data?.id ?? currentUser?.clinicId)
  });
  const specialtyCatalogQuery = useQuery({
    queryKey: ["specialty-catalog", "doctors-form"],
    queryFn: () => specialtyService.listCatalog()
  });

  const data: DoctorRow[] = useMemo(
    () =>
      doctorsQuery.data?.map((doctor) => ({
        id: doctor.id,
        email: doctor.user?.email ?? "-",
        isActive: doctor.user?.isActive ?? false,
        name: `${doctor.user?.firstName ?? ""} ${doctor.user?.lastName ?? ""}`.trim() || "Doctor",
        specialty: doctor.specialty,
        license: doctor.licenseNumber
      })) ?? [],
    [doctorsQuery.data]
  );

  const specialties = useMemo(() => Array.from(new Set(data.map((item) => item.specialty))), [data]);
  const specialtyOptions = useMemo(
    () => (specialtyCatalogQuery.data ?? []).filter((item) => item.isActive),
    [specialtyCatalogQuery.data]
  );
  const selectedClinic = useMemo(() => {
    if (isSuperAdmin) {
      if (selectedClinicId === "all") return null;
      return (clinicsQuery.data ?? []).find((clinic) => clinic.id === selectedClinicId) ?? null;
    }
    return myClinicQuery.data ?? null;
  }, [clinicsQuery.data, isSuperAdmin, myClinicQuery.data, selectedClinicId]);
  const requiredEmailDomain = useMemo(() => {
    if (!selectedClinic?.slug) return null;
    return `@${selectedClinic.slug.toLowerCase()}.com`;
  }, [selectedClinic?.slug]);
  const normalizedFormEmail = form.email.trim().toLowerCase();
  const normalizedFormLicense = form.licenseNumber.trim().toLowerCase();
  const duplicateEmailError = useMemo(() => {
    if (!normalizedFormEmail) return null;
    const hasDuplicate = (doctorsQuery.data ?? []).some((doctor) => {
      if (editingDoctorId && doctor.id === editingDoctorId) return false;
      const existingEmail = doctor.user?.email?.trim().toLowerCase();
      return Boolean(existingEmail && existingEmail === normalizedFormEmail);
    });
    return hasDuplicate ? t("doctors.emailAlreadyExistsInline") : null;
  }, [doctorsQuery.data, editingDoctorId, normalizedFormEmail, t]);
  const duplicateLicenseError = useMemo(() => {
    if (!normalizedFormLicense) return null;
    const hasDuplicate = (doctorsQuery.data ?? []).some((doctor) => {
      if (editingDoctorId && doctor.id === editingDoctorId) return false;
      return doctor.licenseNumber.trim().toLowerCase() === normalizedFormLicense;
    });
    return hasDuplicate ? t("doctors.licenseAlreadyExistsInline") : null;
  }, [doctorsQuery.data, editingDoctorId, normalizedFormLicense, t]);
  const emailDomainInlineError = useMemo(() => {
    if (editingDoctorId || !requiredEmailDomain || !normalizedFormEmail) return null;
    return normalizedFormEmail.endsWith(requiredEmailDomain) ? null : t("doctors.emailDomainInvalid", { domain: requiredEmailDomain });
  }, [editingDoctorId, normalizedFormEmail, requiredEmailDomain, t]);
  const submitBlockedByInlineValidation = Boolean(duplicateEmailError || duplicateLicenseError || emailDomainInlineError);

  useEffect(() => {
    if (!formExpanded || editingDoctorId || form.specialty || !specialtyOptions.length) {
      return;
    }
    setForm((prev) => ({ ...prev, specialty: specialtyOptions[0].name }));
  }, [editingDoctorId, form.specialty, formExpanded, specialtyOptions]);

  const createMutation = useMutation({
    mutationFn: () =>
      doctorService.create(
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          specialty: form.specialty.trim(),
          licenseNumber: form.licenseNumber.trim()
        },
        mutationClinicScope
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success(t("doctors.created"));
      resetForm();
      setFormExpanded(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "doctors.createFailed"));
    }
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      doctorService.update(
        String(editingDoctorId),
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          specialty: form.specialty.trim(),
          licenseNumber: form.licenseNumber.trim(),
          isActive: form.isActive
        },
        mutationClinicScope
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success(t("doctors.updated"));
      resetForm();
      setFormExpanded(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "doctors.updateFailed"));
    }
  });

  const removeMutation = useMutation({
    mutationFn: (doctorId: string) => doctorService.remove(doctorId, mutationClinicScope),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setDeleteTarget(null);
      toast.success(t("doctors.deleted"));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "doctors.deleteFailed"));
    }
  });

  const startEdit = useCallback((row: DoctorRow) => {
    const [firstName = "", ...rest] = row.name.split(" ");
    const lastName = rest.join(" ");
    setEditingDoctorId(row.id);
    setForm({
      firstName,
      lastName,
      email: row.email === "-" ? "" : row.email,
      password: "",
      specialty: row.specialty,
      licenseNumber: row.license,
      isActive: row.isActive
    });
    setFormExpanded(true);
  }, []);

  const columns: ColumnDef<DoctorRow>[] = useMemo(() => {
    const base: ColumnDef<DoctorRow>[] = [
      { header: t("nav.doctors"), accessorKey: "name" },
      { header: t("doctors.specialty"), accessorKey: "specialty" },
      { header: t("doctors.licenseNumber"), accessorKey: "license" },
      { header: t("doctors.email"), accessorKey: "email" },
      {
        header: t("doctors.status"),
        id: "status",
        cell: ({ row }) => (row.original.isActive ? t("doctors.status.active") : t("doctors.status.inactive"))
      }
    ];

    if (!canManageDoctors) return base;

    return [
      ...base,
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100"
              onClick={() => startEdit(row.original)}
              aria-label="Edit doctor"
            >
              <SquarePen size={13} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
              onClick={() => setDeleteTarget(row.original)}
              aria-label="Delete doctor"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      }
    ];
  }, [canManageDoctors, startEdit, t]);

  const formBlock = canManageDoctors && formExpanded ? (
    <section className="card mb-3 bg-white/80 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder={t("field.firstName")}
          value={form.firstName}
          onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder={t("field.lastName")}
          value={form.lastName}
          onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
        />
        <div className="space-y-1">
          <input
            key={`doctor-email-${formResetKey}`}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            placeholder={t("field.email")}
            type="email"
            name="doctor-email-new"
            autoComplete="off"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          {duplicateEmailError ? <p className="text-xs font-medium text-rose-600">{duplicateEmailError}</p> : null}
          {emailDomainInlineError ? <p className="text-xs font-medium text-rose-600">{emailDomainInlineError}</p> : null}
        </div>
        {!editingDoctorId ? (
          <input
            key={`doctor-password-${formResetKey}`}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            placeholder={t("field.temporaryPassword")}
            type="password"
            name="doctor-password-new"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
        ) : (
          <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            {t("doctors.activeAccount")}
          </label>
        )}
        <div className="space-y-1">
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            placeholder={t("doctors.licenseNumber")}
            value={form.licenseNumber}
            onChange={(event) => setForm((prev) => ({ ...prev, licenseNumber: event.target.value }))}
          />
          {duplicateLicenseError ? <p className="text-xs font-medium text-rose-600">{duplicateLicenseError}</p> : null}
        </div>
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:col-span-2"
          value={form.specialty}
          onChange={(event) => setForm((prev) => ({ ...prev, specialty: event.target.value }))}
          disabled={specialtyCatalogQuery.isLoading || !specialtyOptions.length}
        >
          <option value="">{t("doctors.specialty")}</option>
          {specialtyOptions.map((item) => (
            <option key={item.id} value={item.name}>
              {locale === "ar" ? item.nameAr : item.name}
            </option>
          ))}
        </select>
      </div>
      {!editingDoctorId && requiredEmailDomain ? (
        <p className="mt-2 text-xs font-medium text-slate-500">{t("doctors.emailDomainHint", { domain: requiredEmailDomain })}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <RippleButton
          type="button"
          className="h-10 text-sm"
          disabled={
            (isSuperAdmin && selectedClinicId === "all") ||
            !form.firstName.trim() ||
            !form.lastName.trim() ||
            !form.email.trim() ||
            !form.specialty.trim() ||
            !form.licenseNumber.trim() ||
            submitBlockedByInlineValidation ||
            (!editingDoctorId && form.password.length < 8) ||
            createMutation.isPending ||
            updateMutation.isPending
          }
          onClick={() => {
            if (isSuperAdmin && selectedClinicId === "all") {
              toast.error(t("doctors.selectClinicScope"));
              return;
            }
            if (submitBlockedByInlineValidation) {
              return;
            }
            if (editingDoctorId) {
              updateMutation.mutate();
            } else {
              createMutation.mutate();
            }
          }}
        >
          {editingDoctorId ? t("doctors.update") : t("doctors.create")}
        </RippleButton>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={() => {
            resetForm();
            setFormExpanded(false);
          }}
        >
          {t("common.cancel")}
        </button>
      </div>
    </section>
  ) : null;

  return (
    <RoleGate requiredPermissions={["doctors.read"]} fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}>
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
      {doctorsQuery.isLoading ? (
        <div className="card p-6 text-sm text-slate-500">{t("doctors.loading")}</div>
      ) : (
        <EntityCollectionView
          title={t("nav.doctors")}
          columns={columns}
          data={data}
          storageKey="doctor-view"
          belowHeader={formBlock}
          statusOptions={[
            { label: t("common.allSpecialties"), value: "all" },
            ...specialties.map((specialty) => ({ label: specialty, value: specialty }))
          ]}
          searchPlaceholder={`${t("common.search")} ${t("nav.doctors")}`}
          addButton={
            canManageDoctors ? (
              <RippleButton
                onClick={() => {
                  resetForm();
                  setFormResetKey((prev) => prev + 1);
                  setFormExpanded((prev) => !prev);
                }}
              >
                {formExpanded ? t("common.close") : `+ ${t("nav.doctors")}`}
              </RippleButton>
            ) : undefined
          }
          getSearchText={(row) => `${row.name} ${row.specialty} ${row.license} ${row.email}`}
          getStatus={(row) => row.specialty}
          renderCard={(row) => (
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900">{row.name}</h3>
              <p className="text-sm text-slate-600">{row.specialty}</p>
              <p className="text-xs text-slate-500">{row.email}</p>
              <p className="text-xs text-orange-600">
                {t("doctors.licenseNumber")}: {row.license}
              </p>
              {canManageDoctors ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100"
                    onClick={() => startEdit(row)}
                    aria-label="Edit doctor"
                  >
                    <SquarePen size={13} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                    onClick={() => setDeleteTarget(row)}
                    aria-label="Delete doctor"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : null}
              <p className="text-xs font-semibold text-slate-500">
                {row.isActive ? t("doctors.status.active") : t("doctors.status.inactive")}
              </p>
            </div>
          )}
        />
      )}
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={t("doctors.deleteConfirmTitle")}
        message={t("doctors.deleteConfirmMessage", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("doctors.delete")}
        confirmingLabel={t("doctors.deleting")}
        isPending={removeMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          removeMutation.mutate(deleteTarget.id);
        }}
      />
    </AppShell>
    </RoleGate>
  );
}
