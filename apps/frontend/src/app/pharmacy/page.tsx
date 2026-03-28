"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Eye, SquarePen, Trash2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGate } from "@/components/auth/role-gate";
import { PremiumTable } from "@/components/tables/premium-table";
import { DataPagination } from "@/components/ui/DataPagination";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { Modal } from "@/components/ui/modal";
import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";
import { useDebounce } from "@/hooks/use-debounce";
import { hasPermission } from "@/lib/permissions";
import { storage } from "@/lib/storage";
import { medicineService, MedicineItem, UpsertMedicinePayload } from "@/lib/medicine-service";
import { specialtyService, SpecialtyCatalogItem } from "@/lib/specialty-service";

type MedicineFormState = UpsertMedicinePayload;

const initialForm: MedicineFormState = {
  arabicName: "",
  englishName: "",
  activeIngredient: "",
  usageMethod: "",
  specialty: "",
  dosageForm: "",
  concentration: "",
  company: "",
  warnings: "",
  drugInteractions: ""
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

export default function PharmacyPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<"arabicName" | "englishName">("arabicName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<MedicineItem | null>(null);
  const [editingTarget, setEditingTarget] = useState<MedicineItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicineItem | null>(null);
  const [deleteRangeOpen, setDeleteRangeOpen] = useState(false);
  const [deleteRangeFrom, setDeleteRangeFrom] = useState("");
  const [deleteRangeTo, setDeleteRangeTo] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [form, setForm] = useState<MedicineFormState>(initialForm);
  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);

  const canCreate = hasPermission(currentUser, "pharmacy.create");
  const canEdit = hasPermission(currentUser, "pharmacy.edit");
  const canDelete = hasPermission(currentUser, "pharmacy.delete");
  const canImport = hasPermission(currentUser, "pharmacy.import");
  const canViewPharmacy = hasPermission(currentUser, "pharmacy.view");

  const specialtiesCatalogQuery = useQuery({
    queryKey: ["specialties", "catalog", "pharmacy"],
    queryFn: () => specialtyService.listCatalog(),
    enabled: Boolean(currentUser) && canViewPharmacy
  });

  const sortedSpecialtyCatalog = useMemo(() => {
    const data = specialtiesCatalogQuery.data ?? [];
    const copy = [...data];
    copy.sort((a, b) => {
      const aLabel = locale === "ar" ? (a.nameAr || a.name) : (a.name || a.nameAr);
      const bLabel = locale === "ar" ? (b.nameAr || b.name) : (b.name || b.nameAr);
      return aLabel.localeCompare(bLabel, locale === "ar" ? "ar" : "en", { sensitivity: "base" });
    });
    return copy;
  }, [specialtiesCatalogQuery.data, locale]);

  const catalogCodes = useMemo(
    () => new Set(sortedSpecialtyCatalog.map((item) => item.code)),
    [sortedSpecialtyCatalog]
  );

  const specialtyByCode = useMemo(() => {
    const map = new Map<string, SpecialtyCatalogItem>();
    sortedSpecialtyCatalog.forEach((item) => map.set(item.code, item));
    return map;
  }, [sortedSpecialtyCatalog]);

  const formatMedicineSpecialtyLabel = useCallback(
    (raw: string | null | undefined) => {
      const value = raw?.trim();
      if (!value) return "";
      const item = specialtyByCode.get(value);
      if (item) {
        return locale === "ar" ? (item.nameAr || item.name) : (item.name || item.nameAr);
      }
      return value;
    },
    [locale, specialtyByCode]
  );

  const medicinesQuery = useQuery({
    queryKey: ["medicines", { page, pageSize, search: debouncedSearch, sortBy, sortOrder }],
    queryFn: () =>
      medicineService.list({
        page,
        pageSize,
        search: debouncedSearch.trim() || undefined,
        sortBy,
        sortOrder
      }),
    enabled: Boolean(currentUser)
  });

  const createMutation = useMutation({
    mutationFn: () => medicineService.create(form),
    onSuccess: () => {
      toast.success(t("pharmacy.created"));
      setFormOpen(false);
      setForm(initialForm);
      void queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t("pharmacy.createFailed")));
    }
  });

  const updateMutation = useMutation({
    mutationFn: () => medicineService.update(String(editingTarget?.id), form),
    onSuccess: () => {
      toast.success(t("pharmacy.updated"));
      setFormOpen(false);
      setEditingTarget(null);
      setForm(initialForm);
      void queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t("pharmacy.updateFailed")));
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => medicineService.remove(id),
    onSuccess: () => {
      toast.success(t("pharmacy.deleted"));
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t("pharmacy.deleteFailed")));
    }
  });

  const removeRangeMutation = useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const totalFiltered = medicinesQuery.data?.total ?? 0;
      if (!totalFiltered) {
        throw new Error(t("pharmacy.deleteRangeNoRows"));
      }
      return medicineService.deleteRange({
        from,
        to,
        search: debouncedSearch.trim() || undefined,
        sortBy,
        sortOrder
      });
    },
    onSuccess: ({ deleted, matched }) => {
      if (!matched) {
        toast.warning(t("pharmacy.deleteRangeNoRowsInRange"));
      } else if (deleted < matched) {
        toast.warning(t("pharmacy.deleteRangePartial", { deleted: String(deleted), failed: String(matched - deleted) }));
      } else {
        toast.success(t("pharmacy.deleteRangeSuccess", { count: String(deleted) }));
      }
      setDeleteRangeOpen(false);
      setDeleteRangeFrom("");
      setDeleteRangeTo("");
      void queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t("pharmacy.deleteRangeFailed")));
    }
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => medicineService.importExcel(file),
    onSuccess: (result) => {
      const hasErrors = result.errors.length > 0;
      if (hasErrors) {
        toast.warning(
          t("pharmacy.importPartialSuccess", {
            inserted: String(result.insertedCount),
            errors: String(result.errors.length)
          })
        );
      } else {
        toast.success(t("pharmacy.imported", { count: String(result.insertedCount) }));
      }
      setImportOpen(false);
      setImportFile(null);
      void queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t("pharmacy.importFailed")));
    }
  });

  const rows = medicinesQuery.data?.data ?? [];

  const columns: ColumnDef<MedicineItem>[] = useMemo(() => {
    const base: ColumnDef<MedicineItem>[] = [
      {
        header: "#",
        id: "index",
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1
      },
      { header: t("pharmacy.table.arabicName"), accessorKey: "arabicName" },
      { header: t("pharmacy.table.englishName"), accessorKey: "englishName" },
      { header: t("pharmacy.table.activeIngredient"), accessorKey: "activeIngredient" },
      {
        header: t("pharmacy.table.specialty"),
        id: "specialty",
        cell: ({ row }) => {
          const label = formatMedicineSpecialtyLabel(row.original.specialty);
          return label || "-";
        }
      },
      { header: t("pharmacy.table.dosageForm"), accessorKey: "dosageForm" },
      { header: t("pharmacy.table.concentration"), accessorKey: "concentration" },
      { header: t("pharmacy.table.company"), accessorKey: "company" }
    ];

    return [
      ...base,
      {
        header: t("table.actions"),
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100"
              onClick={() => setViewTarget(row.original)}
              aria-label="View medicine"
            >
              <Eye size={13} />
            </button>
            {canEdit ? (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 transition hover:bg-cyan-100"
                onClick={() => {
                  setEditingTarget(row.original);
                  setForm({
                    arabicName: row.original.arabicName,
                    englishName: row.original.englishName,
                    activeIngredient: row.original.activeIngredient,
                    usageMethod: row.original.usageMethod ?? "",
                    specialty: row.original.specialty ?? "",
                    dosageForm: row.original.dosageForm ?? "",
                    concentration: row.original.concentration ?? "",
                    company: row.original.company ?? "",
                    warnings: row.original.warnings ?? "",
                    drugInteractions: row.original.drugInteractions ?? ""
                  });
                  setFormOpen(true);
                }}
                aria-label="Edit medicine"
              >
                <SquarePen size={13} />
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                onClick={() => setDeleteTarget(row.original)}
                aria-label="Delete medicine"
              >
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        )
      }
    ];
  }, [canDelete, canEdit, formatMedicineSpecialtyLabel, page, pageSize, t]);

  return (
    <RoleGate
      requiredPermissions={["pharmacy.view"]}
      fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}
    >
      <AppShell>
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold text-brand-navy">{t("nav.pharmacy")}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {canCreate ? (
                <RippleButton
                  onClick={() => {
                    setEditingTarget(null);
                    setForm(initialForm);
                    setFormOpen(true);
                  }}
                >
                  + {t("pharmacy.addMedicine")}
                </RippleButton>
              ) : null}
              {canImport ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload size={15} />
                  {t("pharmacy.importExcel")}
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  onClick={() => setDeleteRangeOpen(true)}
                >
                  <Trash2 size={15} />
                  {t("pharmacy.deleteRange")}
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={async () => {
                  try {
                    const blob = await medicineService.downloadTemplate();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "medicine_import_template.xlsx";
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (error) {
                    toast.error(getErrorMessage(error, t("pharmacy.templateDownloadFailed")));
                  }
                }}
              >
                <Download size={15} />
                {t("pharmacy.downloadTemplate")}
              </button>
            </div>
          </div>

          <section className="card bg-white/80 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:col-span-2"
                placeholder={t("pharmacy.searchPlaceholder")}
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setPage(1);
                }}
              />
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as "arabicName" | "englishName");
                  setPage(1);
                }}
              >
                <option value="arabicName">{t("pharmacy.sort.arabicName")}</option>
                <option value="englishName">{t("pharmacy.sort.englishName")}</option>
              </select>
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value as "asc" | "desc");
                  setPage(1);
                }}
              >
                <option value="asc">{t("pharmacy.sort.asc")}</option>
                <option value="desc">{t("pharmacy.sort.desc")}</option>
              </select>
            </div>
          </section>

          <PremiumTable
            columns={columns}
            data={rows}
            loading={medicinesQuery.isLoading}
            view="table"
            cardRender={(row) => (
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">{row.arabicName}</p>
                <p className="text-sm text-slate-700">{row.englishName}</p>
                <p className="text-xs text-slate-500">{row.activeIngredient}</p>
              </div>
            )}
          />

          <DataPagination
            page={medicinesQuery.data?.page ?? page}
            pageSize={medicinesQuery.data?.pageSize ?? pageSize}
            total={medicinesQuery.data?.total ?? 0}
            totalPages={medicinesQuery.data?.totalPages ?? 1}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </section>

        <Modal
          open={formOpen}
          title={editingTarget ? t("pharmacy.editMedicine") : t("pharmacy.addMedicine")}
          onClose={() => {
            setFormOpen(false);
            setEditingTarget(null);
            setForm(initialForm);
          }}
          maxWidthClass="max-w-4xl"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["arabicName", "pharmacy.form.arabicName"],
                ["englishName", "pharmacy.form.englishName"],
                ["activeIngredient", "pharmacy.form.activeIngredient"],
                ["usageMethod", "pharmacy.form.usageMethod"]
              ] as const
            ).map(([key, labelKey]) => (
              <input
                key={key}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder={t(labelKey)}
                value={form[key]}
                onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
              />
            ))}
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              aria-label={t("pharmacy.form.specialty")}
              value={form.specialty ?? ""}
              onChange={(event) => setForm((prev) => ({ ...prev, specialty: event.target.value }))}
            >
              <option value="">{t("pharmacy.form.specialtyNone")}</option>
              {sortedSpecialtyCatalog.map((item) => (
                <option key={item.code} value={item.code}>
                  {locale === "ar" ? (item.nameAr || item.name) : (item.name || item.nameAr)}
                </option>
              ))}
              {(form.specialty ?? "").trim() && !catalogCodes.has(form.specialty ?? "") ? (
                <option value={form.specialty ?? ""}>{form.specialty}</option>
              ) : null}
            </select>
            {(
              [
                ["dosageForm", "pharmacy.form.dosageForm"],
                ["concentration", "pharmacy.form.concentration"],
                ["company", "pharmacy.form.company"]
              ] as const
            ).map(([key, labelKey]) => (
              <input
                key={key}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder={t(labelKey)}
                value={form[key]}
                onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
              />
            ))}
            <textarea
              className="min-h-[90px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:col-span-2"
              placeholder={t("pharmacy.form.warnings")}
              value={form.warnings}
              onChange={(event) => setForm((prev) => ({ ...prev, warnings: event.target.value }))}
            />
            <textarea
              className="min-h-[90px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:col-span-2"
              placeholder={t("pharmacy.form.drugInteractions")}
              value={form.drugInteractions}
              onChange={(event) => setForm((prev) => ({ ...prev, drugInteractions: event.target.value }))}
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <RippleButton
              type="button"
              className="h-10 text-sm"
              disabled={
                !form.arabicName.trim() ||
                !form.englishName.trim() ||
                !form.activeIngredient.trim() ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              onClick={() => {
                if (editingTarget) {
                  updateMutation.mutate();
                } else {
                  createMutation.mutate();
                }
              }}
            >
              {editingTarget ? t("common.save") : t("pharmacy.addMedicine")}
            </RippleButton>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => {
                setFormOpen(false);
                setEditingTarget(null);
                setForm(initialForm);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </Modal>

        <Modal open={Boolean(viewTarget)} title={t("pharmacy.viewMedicine")} onClose={() => setViewTarget(null)} maxWidthClass="max-w-3xl">
          <div className="grid gap-3 md:grid-cols-2">
            {viewTarget
              ? (
                  [
                    [t("pharmacy.form.arabicName"), viewTarget.arabicName],
                    [t("pharmacy.form.englishName"), viewTarget.englishName],
                    [t("pharmacy.form.activeIngredient"), viewTarget.activeIngredient],
                    [t("pharmacy.form.usageMethod"), viewTarget.usageMethod],
                    [
                      t("pharmacy.form.specialty"),
                      formatMedicineSpecialtyLabel(viewTarget.specialty) || "-"
                    ],
                    [t("pharmacy.form.dosageForm"), viewTarget.dosageForm],
                    [t("pharmacy.form.concentration"), viewTarget.concentration],
                    [t("pharmacy.form.company"), viewTarget.company],
                    [t("pharmacy.form.warnings"), viewTarget.warnings],
                    [t("pharmacy.form.drugInteractions"), viewTarget.drugInteractions]
                  ] as const
                ).map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-200/80 bg-white/80 p-3 md:col-span-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-sm text-slate-800">{String(value || "-")}</p>
                  </div>
                ))
              : null}
          </div>
        </Modal>

        <Modal open={importOpen} title={t("pharmacy.importExcel")} onClose={() => setImportOpen(false)} maxWidthClass="max-w-xl">
          <div className="space-y-3">
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
            />
            <p className="text-xs text-slate-500">{t("pharmacy.importHint")}</p>
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
                {t("pharmacy.importExcel")}
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
          title={t("pharmacy.deleteConfirmTitle")}
          message={t("pharmacy.deleteConfirmMessage", { name: deleteTarget?.arabicName ?? "" })}
          confirmLabel={t("common.delete")}
          confirmingLabel={t("pharmacy.deleting")}
          isPending={removeMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;
            removeMutation.mutate(deleteTarget.id);
          }}
        />

        <Modal
          open={deleteRangeOpen}
          title={t("pharmacy.deleteRangeTitle")}
          onClose={() => {
            setDeleteRangeOpen(false);
            setDeleteRangeFrom("");
            setDeleteRangeTo("");
          }}
          maxWidthClass="max-w-xl"
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {t("pharmacy.deleteRangeHint", {
                from: "1",
                to: String(medicinesQuery.data?.total ?? 0)
              })}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="number"
                min={1}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                placeholder={t("pharmacy.deleteRangeFrom")}
                value={deleteRangeFrom}
                onChange={(event) => setDeleteRangeFrom(event.target.value)}
              />
              <input
                type="number"
                min={1}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                placeholder={t("pharmacy.deleteRangeTo")}
                value={deleteRangeTo}
                onChange={(event) => setDeleteRangeTo(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <RippleButton
                type="button"
                className="h-10 bg-rose-600 text-sm hover:bg-rose-700"
                disabled={removeRangeMutation.isPending}
                onClick={() => {
                  const from = Number(deleteRangeFrom);
                  const to = Number(deleteRangeTo);
                  if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= 0) {
                    toast.error(t("pharmacy.deleteRangeInvalid"));
                    return;
                  }
                  if (from > to) {
                    toast.error(t("pharmacy.deleteRangeInvalidOrder"));
                    return;
                  }
                  const totalFiltered = medicinesQuery.data?.total ?? 0;
                  if (to > totalFiltered) {
                    toast.error(t("pharmacy.deleteRangeOutOfBounds", { total: String(totalFiltered) }));
                    return;
                  }
                  removeRangeMutation.mutate({ from, to });
                }}
              >
                {removeRangeMutation.isPending ? t("pharmacy.deleting") : t("pharmacy.deleteRangeConfirm")}
              </RippleButton>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  setDeleteRangeOpen(false);
                  setDeleteRangeFrom("");
                  setDeleteRangeTo("");
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </Modal>
      </AppShell>
    </RoleGate>
  );
}
