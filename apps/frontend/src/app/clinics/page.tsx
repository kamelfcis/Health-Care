"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SquarePen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import ProtectedRoute from "@/components/auth/protected-route";
import { EntityCollectionView } from "@/components/ui/entity-collection-view";
import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService } from "@/lib/clinic-service";
import { specialtyService } from "@/lib/specialty-service";
import { hasPermission } from "@/lib/permissions";
import { storage } from "@/lib/storage";

type ClinicRow = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  email: string;
  city: string;
  status: string;
  specialties: string;
};

export default function ClinicsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  const [formExpanded, setFormExpanded] = useState(false);
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [clinicImageFile, setClinicImageFile] = useState<File | null>(null);
  const [clinicImagePreviewUrl, setClinicImagePreviewUrl] = useState<string | null>(null);
  const [existingClinicImageUrl, setExistingClinicImageUrl] = useState<string | null>(null);
  const [removeExistingClinicImage, setRemoveExistingClinicImage] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    timezone: "UTC",
    isActive: true,
    specialtyCodes: [] as string[],
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: ""
  });

  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);

  useEffect(
    () => () => {
      if (clinicImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(clinicImagePreviewUrl);
      }
    },
    [clinicImagePreviewUrl]
  );

  const apiOrigin = useMemo(
    () => (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api").replace(/\/api\/?$/, ""),
    []
  );
  const resolveClinicImageSrc = useCallback(
    (imageUrl?: string | null) => {
      if (!imageUrl) return null;
      return imageUrl.startsWith("http") ? imageUrl : `${apiOrigin}${imageUrl}`;
    },
    [apiOrigin]
  );
  const clearPickedImage = useCallback(() => {
    if (clinicImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(clinicImagePreviewUrl);
    }
    setClinicImageFile(null);
    setClinicImagePreviewUrl(null);
  }, [clinicImagePreviewUrl]);

  const canManageClinics = hasPermission(currentUser, "clinics.manage");
  const clinicsQuery = useQuery({
    queryKey: ["clinics", { page: 1, pageSize: 100 }],
    queryFn: () => clinicService.list()
  });
  const specialtyCatalogQuery = useQuery({
    queryKey: ["specialties", "catalog", "clinics-form"],
    queryFn: specialtyService.listCatalog
  });

  const resetForm = () => {
    setForm({
      name: "",
      slug: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      timezone: "UTC",
      isActive: true,
      specialtyCodes: [],
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPassword: ""
    });
    setEditingClinicId(null);
    clearPickedImage();
    setExistingClinicImageUrl(null);
    setRemoveExistingClinicImage(false);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      clinicService.create({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        specialtyCodes: form.specialtyCodes,
        clinicImage: clinicImageFile,
        adminUser: {
          firstName: form.adminFirstName.trim(),
          lastName: form.adminLastName.trim(),
          email: form.adminEmail.trim(),
          password: form.adminPassword
        }
      }),
    onSuccess: () => {
      toast.success(t("clinics.created"));
      void queryClient.invalidateQueries({ queryKey: ["clinics"] });
      resetForm();
      setFormExpanded(false);
    },
    onError: () => {
      toast.error(t("clinics.createFailed"));
    }
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      clinicService.update(String(editingClinicId), {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        timezone: form.timezone.trim() || undefined,
        isActive: form.isActive,
        specialtyCodes: form.specialtyCodes,
        clinicImage: clinicImageFile,
        ...(removeExistingClinicImage && !clinicImageFile ? { imageUrl: "" } : {})
      }),
    onSuccess: () => {
      toast.success(t("clinics.updated"));
      void queryClient.invalidateQueries({ queryKey: ["clinics"] });
      resetForm();
      setFormExpanded(false);
    },
    onError: () => {
      toast.error(t("clinics.updateFailed"));
    }
  });

  const removeMutation = useMutation({
    mutationFn: (clinicId: string) => clinicService.remove(clinicId),
    onSuccess: () => {
      toast.success(t("clinics.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["clinics"] });
    },
    onError: () => {
      toast.error(t("clinics.deleteFailed"));
    }
  });

  const data = useMemo<ClinicRow[]>(
    () =>
      (clinicsQuery.data ?? []).map((clinic) => {
        const specialtyNames = (clinic.clinicSpecialties ?? []).map((item) =>
          locale === "ar" ? item.specialty.nameAr : item.specialty.name
        );
        return {
          id: clinic.id,
          name: clinic.name,
          slug: clinic.slug,
          imageUrl: clinic.imageUrl ?? null,
          email: clinic.email ?? "-",
          city: clinic.city ?? "-",
          status: clinic.isActive ? "Active" : "Inactive",
          specialties: specialtyNames.join("، ") || "-"
        };
      }),
    [clinicsQuery.data, locale]
  );

  const startEdit = useCallback(
    (row: ClinicRow) => {
      const clinic = (clinicsQuery.data ?? []).find((item) => item.id === row.id);
      if (!clinic) return;
      setEditingClinicId(clinic.id);
      setForm({
        name: clinic.name,
        slug: clinic.slug,
        email: clinic.email ?? "",
        phone: clinic.phone ?? "",
        address: clinic.address ?? "",
        city: clinic.city ?? "",
        country: clinic.country ?? "",
        timezone: clinic.timezone ?? "UTC",
        isActive: clinic.isActive,
        specialtyCodes: (clinic.clinicSpecialties ?? []).map((item) => item.specialty.code),
        adminFirstName: "",
        adminLastName: "",
        adminEmail: "",
        adminPassword: ""
      });
      clearPickedImage();
      setExistingClinicImageUrl(clinic.imageUrl ?? null);
      setRemoveExistingClinicImage(false);
      setFormExpanded(true);
    },
    [clearPickedImage, clinicsQuery.data]
  );

  const columns: ColumnDef<ClinicRow>[] = useMemo(() => {
    const base: ColumnDef<ClinicRow>[] = [
      { header: t("nav.clinics"), accessorKey: "name" },
      {
        header: t("clinics.image.column"),
        accessorKey: "imageUrl",
        cell: ({ row }) => {
          const src = resolveClinicImageSrc(row.original.imageUrl);
          return src ? (
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-orange-200 bg-orange-50/40">
              <Image src={src} alt={row.original.name} width={40} height={40} unoptimized className="h-full w-full object-cover" />
            </div>
          ) : (
            <span className="text-xs text-slate-400">{t("clinics.image.empty")}</span>
          );
        }
      },
      { header: "Slug", accessorKey: "slug" },
      { header: t("field.email"), accessorKey: "email" },
      { header: "City", accessorKey: "city" },
      { header: t("auth.clinicSpecialties"), accessorKey: "specialties" },
      { header: "Status", accessorKey: "status" }
    ];
    if (!canManageClinics) return base;
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
              aria-label="Edit clinic"
            >
              <SquarePen size={13} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
              onClick={() => {
                if (window.confirm(t("clinics.deleteConfirm"))) {
                  removeMutation.mutate(row.original.id);
                }
              }}
              aria-label="Delete clinic"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      }
    ];
  }, [canManageClinics, removeMutation, resolveClinicImageSrc, startEdit, t]);

  const specialtyOptions = useMemo(
    () => (specialtyCatalogQuery.data ?? []).filter((item) => item.isActive && !item.deletedAt),
    [specialtyCatalogQuery.data]
  );

  const formBlock = canManageClinics && formExpanded ? (
    <section className="card mb-3 border-l-4 border-l-orange-500 bg-white/85 p-4 shadow-[0_22px_55px_-30px_rgba(251,146,60,0.55)]">
      <div className="mb-4 rounded-2xl border border-orange-200/70 bg-orange-50/30 p-3">
        <p className="text-sm font-semibold text-slate-800">{t("clinics.image.title")}</p>
        <p className="mt-1 text-xs text-slate-500">{t("clinics.image.hint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-orange-200 bg-white">
            {clinicImagePreviewUrl || (existingClinicImageUrl && !removeExistingClinicImage) ? (
              <Image
                src={clinicImagePreviewUrl || resolveClinicImageSrc(existingClinicImageUrl)!}
                alt="Clinic preview"
                width={64}
                height={64}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                {t("clinics.image.empty")}
              </div>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (!file) return;
                clearPickedImage();
                setClinicImageFile(file);
                setClinicImagePreviewUrl(URL.createObjectURL(file));
                setRemoveExistingClinicImage(false);
              }}
            />
            {t("clinics.image.choose")}
          </label>
          {clinicImageFile ? (
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={clearPickedImage}
            >
              {t("clinics.image.resetPicked")}
            </button>
          ) : null}
          {editingClinicId && existingClinicImageUrl && !removeExistingClinicImage ? (
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
              onClick={() => {
                clearPickedImage();
                setRemoveExistingClinicImage(true);
                setExistingClinicImageUrl(null);
              }}
            >
              {t("clinics.image.removeCurrent")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder={t("nav.clinics")}
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder="Slug"
          value={form.slug}
          onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder={t("field.email")}
          type="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder={t("field.phone")}
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:col-span-2"
          placeholder={t("field.address")}
          value={form.address}
          onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder="City"
          value={form.city}
          onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder="Country"
          value={form.country}
          onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
        />
        <input
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder="Timezone"
          value={form.timezone}
          onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
        />
        {editingClinicId ? (
          <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            {t("clinics.status.active")}
          </label>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-sm font-medium text-slate-700">{t("auth.clinicSpecialties")}</p>
        <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
          {specialtyOptions.map((specialty) => {
            const checked = form.specialtyCodes.includes(specialty.code);
            return (
              <label
                key={specialty.id}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...form.specialtyCodes, specialty.code]
                      : form.specialtyCodes.filter((code) => code !== specialty.code);
                    setForm((prev) => ({ ...prev, specialtyCodes: next }));
                  }}
                />
                <span>{locale === "ar" ? specialty.nameAr : specialty.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {!editingClinicId ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700">{t("clinics.admin.section")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              key={`clinic-admin-first-${formResetKey}`}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              placeholder={t("field.firstName")}
              autoComplete="off"
              value={form.adminFirstName}
              onChange={(event) => setForm((prev) => ({ ...prev, adminFirstName: event.target.value }))}
            />
            <input
              key={`clinic-admin-last-${formResetKey}`}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              placeholder={t("field.lastName")}
              autoComplete="off"
              value={form.adminLastName}
              onChange={(event) => setForm((prev) => ({ ...prev, adminLastName: event.target.value }))}
            />
            <input
              key={`clinic-admin-email-${formResetKey}`}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              placeholder={t("field.email")}
              type="email"
              name="clinic-admin-email-new"
              autoComplete="off"
              value={form.adminEmail}
              onChange={(event) => setForm((prev) => ({ ...prev, adminEmail: event.target.value }))}
            />
            <input
              key={`clinic-admin-password-${formResetKey}`}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              placeholder={t("field.password")}
              type="password"
              name="clinic-admin-password-new"
              autoComplete="new-password"
              value={form.adminPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, adminPassword: event.target.value }))}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <RippleButton
          type="button"
          className="h-10 text-sm"
          disabled={
            !form.name.trim() ||
            !form.specialtyCodes.length ||
            (!editingClinicId &&
              (!form.adminFirstName.trim() ||
                !form.adminLastName.trim() ||
                !form.adminEmail.trim() ||
                form.adminPassword.length < 8)) ||
            createMutation.isPending ||
            updateMutation.isPending
          }
          onClick={() => {
            if (editingClinicId) {
              updateMutation.mutate();
            } else {
              createMutation.mutate();
            }
          }}
        >
          {editingClinicId ? t("clinics.update") : t("clinics.create")}
        </RippleButton>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={() => {
            resetForm();
            setFormExpanded(false);
          }}
        >
          {t("common.close")}
        </button>
      </div>
    </section>
  ) : null;

  return (
    <ProtectedRoute requiredPermissions={["clinics.read"]}>
      <AppShell>
        {clinicsQuery.isLoading ? (
          <div className="card p-6 text-sm text-slate-500">{t("clinics.loading")}</div>
        ) : (
          <EntityCollectionView
            title={t("nav.clinics")}
            columns={columns}
            data={data}
            belowHeader={formBlock}
            storageKey="clinic-view"
            statusOptions={[
              { label: t("common.allStatuses"), value: "all" },
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" }
            ]}
            searchPlaceholder={`${t("common.search")} ${t("nav.clinics")}`}
            addButton={
              canManageClinics ? (
                <RippleButton
                  onClick={() => {
                    resetForm();
                    setFormResetKey((prev) => prev + 1);
                    setFormExpanded((prev) => !prev);
                  }}
                >
                  {formExpanded ? t("common.close") : `+ ${t("nav.clinics")}`}
                </RippleButton>
              ) : undefined
            }
            getSearchText={(row) => `${row.name} ${row.slug} ${row.city} ${row.email} ${row.specialties} ${row.status}`}
            getStatus={(row) => row.status}
            renderCard={(row) => (
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3 border-l-4 border-l-orange-500 pl-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-orange-200 bg-orange-50/40">
                    {resolveClinicImageSrc(row.imageUrl) ? (
                      <Image
                        src={resolveClinicImageSrc(row.imageUrl)!}
                        alt={row.name}
                        width={56}
                        height={56}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        {t("clinics.image.empty")}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="truncate font-semibold text-slate-900">{row.name}</h3>
                    <p className="truncate text-sm text-slate-500">{row.city} - {row.slug}</p>
                    <p className="truncate text-xs text-slate-500">{row.email}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">{row.specialties}</p>
                    <p className="text-xs font-semibold text-orange-600">{row.status}</p>
                  </div>
                </div>
                {canManageClinics ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100"
                      onClick={() => startEdit(row)}
                      aria-label="Edit clinic"
                    >
                      <SquarePen size={13} />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                      onClick={() => {
                        if (window.confirm(t("clinics.deleteConfirm"))) {
                          removeMutation.mutate(row.id);
                        }
                      }}
                      aria-label="Delete clinic"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          />
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
