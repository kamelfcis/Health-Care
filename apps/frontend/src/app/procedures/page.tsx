"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Download, Plus, SquarePen, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGate } from "@/components/auth/role-gate";
import { DataTable } from "@/components/tables/data-table";
import { Modal } from "@/components/ui/modal";
import { RippleButton } from "@/components/ui/ripple-button";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useI18n } from "@/components/providers/i18n-provider";
import { useDebounce } from "@/hooks/use-debounce";
import { clinicService } from "@/lib/clinic-service";
import { procedureService, ProcedureCatalogItem, UpsertProcedureCatalogPayload } from "@/lib/procedure-service";
import { storage } from "@/lib/storage";
import { useClinicCurrency } from "@/hooks/use-clinic-currency";

const inputClass =
  "w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20";

const emptyForm: UpsertProcedureCatalogPayload = {
  name: "",
  defaultAmount: null,
  isActive: true
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

export default function ProceduresPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<ProcedureCatalogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcedureCatalogItem | null>(null);
  const [form, setForm] = useState<UpsertProcedureCatalogPayload>(emptyForm);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);

  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const listClinicId = isSuperAdmin && selectedClinicId !== "all" ? selectedClinicId : undefined;
  const mutationClinicId = listClinicId;

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-procedures"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin
  });
  const { formatMoney } = useClinicCurrency({
    clinicId: isSuperAdmin ? selectedClinicId : undefined,
    clinics: clinicsQuery.data
  });

  const catalogQuery = useQuery({
    queryKey: ["procedures", "catalog", "all", listClinicId ?? "mine"],
    queryFn: () => procedureService.listAll(listClinicId),
    enabled: !isSuperAdmin || Boolean(listClinicId)
  });

  const filteredRows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    const rows = catalogQuery.data ?? [];
    if (!needle) return rows;
    return rows.filter((item) => item.name.toLowerCase().includes(needle));
  }, [catalogQuery.data, debouncedSearch]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["procedures"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error(t("procedures.validation.nameRequired"));
      const name = form.name.trim();
      const payload: UpsertProcedureCatalogPayload = {
        name,
        procedureType: name,
        defaultAmount:
          form.defaultAmount === null || form.defaultAmount === undefined || form.defaultAmount === ("" as unknown as number)
            ? null
            : Number(form.defaultAmount),
        isActive: form.isActive ?? true
      };
      if (editing) {
        return procedureService.update(editing.id, payload, mutationClinicId);
      }
      return procedureService.create(payload, mutationClinicId);
    },
    onSuccess: () => {
      toast.success(editing ? t("procedures.updated") : t("procedures.created"));
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, editing ? t("procedures.updateFailed") : t("procedures.createFailed")))
  });

  const deleteMutation = useMutation({
    mutationFn: () => procedureService.remove(String(deleteTarget?.id), mutationClinicId),
    onSuccess: () => {
      toast.success(t("procedures.deleted"));
      setDeleteTarget(null);
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, t("procedures.deleteFailed")))
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => procedureService.importExcel(file, mutationClinicId),
    onSuccess: (result) => {
      if (result.errors.length > 0) {
        toast.warning(
          t("procedures.importPartialSuccess", {
            inserted: String(result.insertedCount),
            errors: String(result.errors.length)
          })
        );
      } else {
        toast.success(t("procedures.imported", { count: String(result.insertedCount) }));
      }
      setImportOpen(false);
      setImportFile(null);
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, t("procedures.importFailed")))
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (item: ProcedureCatalogItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      defaultAmount: item.defaultAmount,
      isActive: item.isActive
    });
    setFormOpen(true);
  };

  const columns: ColumnDef<ProcedureCatalogItem>[] = useMemo(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: t("procedures.name"),
        cell: ({ row }) => <span className="font-medium text-slate-800">{row.original.name}</span>
      },
      {
        id: "defaultAmount",
        accessorKey: "defaultAmount",
        header: t("procedures.defaultAmount"),
        cell: ({ row }) =>
          row.original.defaultAmount != null
            ? formatMoney(row.original.defaultAmount)
            : "-"
      },
      {
        id: "isActive",
        accessorKey: "isActive",
        header: t("procedures.active"),
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              row.original.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {row.original.isActive ? t("procedures.active") : t("procedures.inactive")}
          </span>
        )
      },
      {
        id: "actions",
        header: t("table.actions"),
        cell: ({ row }) => (
          <div className="flex justify-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-700"
              onClick={() => openEdit(row.original)}
              aria-label={t("common.edit")}
            >
              <SquarePen size={14} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              onClick={() => setDeleteTarget(row.original)}
              aria-label={t("common.delete")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      }
    ],
    [formatMoney, t]
  );

  const needsClinicPick = isSuperAdmin && !listClinicId;

  return (
    <RoleGate requiredPermissions={["billing.manage"]}>
      <AppShell>
        <section className="card bg-white/80 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-brand-navy">{t("procedures.title")}</h1>
              <p className="mt-1 text-sm text-slate-600">{t("procedures.subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={needsClinicPick}
                onClick={async () => {
                  try {
                    const blob = await procedureService.downloadTemplate(mutationClinicId);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "procedure_import_template.xlsx";
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (error) {
                    toast.error(getErrorMessage(error, t("procedures.templateDownloadFailed")));
                  }
                }}
              >
                <Download size={15} />
                {t("procedures.downloadTemplate")}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={needsClinicPick}
                onClick={() => setImportOpen(true)}
              >
                <Upload size={15} />
                {t("procedures.importExcel")}
              </button>
              <RippleButton type="button" onClick={openCreate} disabled={needsClinicPick}>
                <Plus size={16} />
                {t("procedures.add")}
              </RippleButton>
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="mt-4 max-w-xs">
              <label className="mb-1 block text-xs text-slate-500">{t("nav.clinics")}</label>
              <select
                className={inputClass}
                value={selectedClinicId}
                onChange={(e) => setSelectedClinicId(e.target.value)}
              >
                <option value="all">{t("common.allClinics")}</option>
                {(clinicsQuery.data ?? []).map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!needsClinicPick ? (
            <div className="mt-4 max-w-md">
              <input
                className={inputClass}
                placeholder={t("procedures.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          ) : null}

          {needsClinicPick ? (
            <p className="mt-6 text-sm text-amber-700">{t("procedures.selectClinic")}</p>
          ) : catalogQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-500">{t("common.loading")}</p>
          ) : filteredRows.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">{t("procedures.empty")}</p>
          ) : (
            <div className="mt-6">
              <DataTable columns={columns} data={filteredRows} />
            </div>
          )}
        </section>

        <Modal
          open={formOpen}
          title={editing ? t("procedures.name") : t("procedures.add")}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-slate-600">{t("procedures.name")}</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">{t("procedures.defaultAmount")}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={form.defaultAmount ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultAmount: e.target.value === "" ? null : Number(e.target.value)
                  }))
                }
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive ?? true}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              {t("procedures.active")}
            </label>
            <RippleButton type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {t("common.save")}
            </RippleButton>
          </div>
        </Modal>

        <Modal open={importOpen} title={t("procedures.importExcel")} onClose={() => setImportOpen(false)} maxWidthClass="max-w-xl">
          <div className="space-y-3">
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
            />
            <p className="text-xs text-slate-500">{t("procedures.importHint")}</p>
            <div className="flex items-center gap-2">
              <RippleButton
                type="button"
                className="h-10 text-sm"
                disabled={!importFile || importMutation.isPending}
                onClick={() => {
                  if (!importFile) return;
                  importMutation.mutate(importFile);
                }}
              >
                {t("procedures.importExcel")}
              </RippleButton>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  setImportOpen(false);
                  setImportFile(null);
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </Modal>

        <ConfirmDeleteModal
          open={Boolean(deleteTarget)}
          title={t("common.delete")}
          message={deleteTarget?.name ?? ""}
          confirmLabel={t("common.delete")}
          confirmingLabel={t("common.loading")}
          isPending={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate()}
        />
      </AppShell>
    </RoleGate>
  );
}
