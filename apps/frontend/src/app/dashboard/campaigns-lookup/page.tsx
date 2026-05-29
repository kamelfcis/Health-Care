"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check, PencilLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/tables/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { RippleButton } from "@/components/ui/ripple-button";
import { campaignCatalogService, CampaignCatalogItem } from "@/lib/campaign-catalog-service";
import { clinicService } from "@/lib/clinic-service";
import { storage } from "@/lib/storage";

const inputClass =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-orange-300 hover:text-orange-700";
const deleteButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100";

export default function CampaignsLookupPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(() => storage.getUser());
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const isClinicAdmin = currentUser?.role === "ClinicAdmin";
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const apiClinicId = isSuperAdmin ? selectedClinicId || undefined : undefined;
  const canManage = isSuperAdmin ? Boolean(selectedClinicId) : isClinicAdmin;

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-campaigns-lookup"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin
  });

  useEffect(() => {
    if (!isSuperAdmin || selectedClinicId) return;
    const first = clinicsQuery.data?.[0]?.id;
    if (first) setSelectedClinicId(first);
  }, [isSuperAdmin, selectedClinicId, clinicsQuery.data]);

  const [newCatalog, setNewCatalog] = useState({ name: "", nameAr: "", isActive: true });
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [editingCatalog, setEditingCatalog] = useState({ name: "", nameAr: "", isActive: true });
  const [deleteTarget, setDeleteTarget] = useState<CampaignCatalogItem | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["campaigns", "catalog", "manage", isSuperAdmin ? (selectedClinicId || "none") : "mine"],
    queryFn: () => campaignCatalogService.manageList(apiClinicId),
    enabled: canManage
  });

  const refreshCatalog = async () => {
    await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    await queryClient.invalidateQueries({ queryKey: ["patients"] });
  };

  const createCatalogMutation = useMutation({
    mutationFn: () => campaignCatalogService.create(newCatalog, apiClinicId),
    onSuccess: async () => {
      toast.success(t("campaignsLookup.created"));
      setNewCatalog({ name: "", nameAr: "", isActive: true });
      await refreshCatalog();
    },
    onError: () => toast.error(t("campaignsLookup.createFailed"))
  });

  const updateCatalogMutation = useMutation({
    mutationFn: (campaignId: string) =>
      campaignCatalogService.update(campaignId, editingCatalog, apiClinicId),
    onSuccess: async () => {
      toast.success(t("campaignsLookup.updated"));
      setEditingCatalogId(null);
      setEditingCatalog({ name: "", nameAr: "", isActive: true });
      await refreshCatalog();
    },
    onError: () => toast.error(t("campaignsLookup.updateFailed"))
  });

  const deleteCatalogMutation = useMutation({
    mutationFn: () => campaignCatalogService.remove(String(deleteTarget?.id), apiClinicId),
    onSuccess: async () => {
      toast.success(t("campaignsLookup.deleted"));
      setDeleteTarget(null);
      await refreshCatalog();
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        toast.error(t("campaignsLookup.deleteInUse"));
        return;
      }
      toast.error(t("campaignsLookup.deleteFailed"));
    }
  });

  const columns: ColumnDef<CampaignCatalogItem>[] = useMemo(
    () => [
      { header: "English", accessorKey: "name" },
      { header: "العربية", accessorKey: "nameAr" },
      {
        header: t("field.status"),
        id: "status",
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              row.original.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {row.original.isActive ? t("common.active") : t("common.inactive")}
          </span>
        )
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={iconButtonClass}
              onClick={() => {
                setEditingCatalogId(row.original.id);
                setEditingCatalog({
                  name: row.original.name,
                  nameAr: row.original.nameAr,
                  isActive: row.original.isActive
                });
              }}
              aria-label={t("common.edit")}
            >
              <PencilLine size={14} />
            </button>
            <button
              type="button"
              className={deleteButtonClass}
              onClick={() => setDeleteTarget(row.original)}
              aria-label={t("common.delete")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      }
    ],
    [t]
  );

  const deleteTargetLabel = deleteTarget
    ? locale === "ar"
      ? deleteTarget.nameAr || deleteTarget.name
      : deleteTarget.name || deleteTarget.nameAr
    : "";

  return (
    <RoleGate
      allowed={["SuperAdmin", "ClinicAdmin"]}
      fallback={<div className="card p-6 text-base text-slate-500">{t("common.notAllowed")}</div>}
    >
      <AppShell>
        <section className="space-y-4">
          <div className="card space-y-4 p-6">
            <h1 className="text-3xl font-semibold text-brand-navy">{t("nav.campaignsLookup")}</h1>
            <p className="text-base text-slate-600">{t("campaignsLookup.subtitleClinic")}</p>

            {isSuperAdmin ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-slate-600">{t("dashboard.clinicScope")}</p>
                <select
                  className="h-11 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                  value={selectedClinicId}
                  onChange={(event) => setSelectedClinicId(event.target.value)}
                >
                  {(clinicsQuery.data ?? []).map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid gap-2 md:grid-cols-4">
              <input
                value={newCatalog.name}
                onChange={(event) => setNewCatalog((prev) => ({ ...prev, name: event.target.value }))}
                className={inputClass}
                placeholder="Name (English)"
                disabled={!canManage}
              />
              <input
                value={newCatalog.nameAr}
                onChange={(event) => setNewCatalog((prev) => ({ ...prev, nameAr: event.target.value }))}
                className={inputClass}
                placeholder="الاسم (عربي)"
                disabled={!canManage}
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newCatalog.isActive}
                  onChange={(event) => setNewCatalog((prev) => ({ ...prev, isActive: event.target.checked }))}
                  disabled={!canManage}
                />
                {t("common.active")}
              </label>
              <RippleButton
                type="button"
                className="h-10 text-sm"
                disabled={
                  !canManage ||
                  !newCatalog.name.trim() ||
                  !newCatalog.nameAr.trim() ||
                  createCatalogMutation.isPending
                }
                onClick={() => createCatalogMutation.mutate()}
              >
                {t("campaignsLookup.addButton")}
              </RippleButton>
            </div>
          </div>

          {editingCatalogId ? (
            <section className="card p-4">
              <p className="mb-3 text-base font-semibold text-slate-800">{t("campaignsLookup.editTitle")}</p>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                <input
                  value={editingCatalog.name}
                  onChange={(event) => setEditingCatalog((prev) => ({ ...prev, name: event.target.value }))}
                  className={inputClass}
                />
                <input
                  value={editingCatalog.nameAr}
                  onChange={(event) => setEditingCatalog((prev) => ({ ...prev, nameAr: event.target.value }))}
                  className={inputClass}
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingCatalog.isActive}
                    onChange={(event) => setEditingCatalog((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  {t("common.active")}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={iconButtonClass}
                    onClick={() => updateCatalogMutation.mutate(editingCatalogId)}
                    aria-label={t("common.save")}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass}
                    onClick={() => {
                      setEditingCatalogId(null);
                      setEditingCatalog({ name: "", nameAr: "", isActive: true });
                    }}
                    aria-label={t("common.cancel")}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <DataTable columns={columns} data={catalogQuery.data ?? []} />

          <ConfirmDeleteModal
            open={Boolean(deleteTarget)}
            title={t("campaignsLookup.deleteConfirmTitle")}
            message={t("campaignsLookup.deleteConfirmMessage", { name: deleteTargetLabel })}
            confirmLabel={t("common.delete")}
            confirmingLabel={t("campaignsLookup.deleting")}
            isPending={deleteCatalogMutation.isPending}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => deleteCatalogMutation.mutate()}
          />
        </section>
      </AppShell>
    </RoleGate>
  );
}
