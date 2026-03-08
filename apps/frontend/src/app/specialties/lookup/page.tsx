"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PencilLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/tables/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { RippleButton } from "@/components/ui/ripple-button";
import { SpecialtyCatalogItem, specialtyService } from "@/lib/specialty-service";

const inputClass =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-orange-300 hover:text-orange-700";
const deleteButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100";

export default function SpecialtiesLookupPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [newCatalog, setNewCatalog] = useState({ code: "", name: "", nameAr: "", isActive: true });
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [editingCatalog, setEditingCatalog] = useState({ code: "", name: "", nameAr: "", isActive: true });

  const catalogQuery = useQuery({
    queryKey: ["specialties", "catalog", "admin", "all"],
    queryFn: specialtyService.adminListCatalog
  });

  const refreshCatalog = async () => {
    await queryClient.invalidateQueries({ queryKey: ["specialties", "catalog", "admin"] });
    await queryClient.invalidateQueries({ queryKey: ["specialties", "catalog", "admin", "all"] });
  };

  const createCatalogMutation = useMutation({
    mutationFn: () =>
      specialtyService.adminCreateCatalog({
        code: newCatalog.code,
        name: newCatalog.name,
        nameAr: newCatalog.nameAr,
        isActive: newCatalog.isActive
      }),
    onSuccess: async () => {
      toast.success(t("specialties.catalog.created"));
      setNewCatalog({ code: "", name: "", nameAr: "", isActive: true });
      await refreshCatalog();
    },
    onError: () => toast.error(t("specialties.catalog.createFailed"))
  });

  const updateCatalogMutation = useMutation({
    mutationFn: (specialtyId: string) =>
      specialtyService.adminUpdateCatalog(specialtyId, {
        code: editingCatalog.code,
        name: editingCatalog.name,
        nameAr: editingCatalog.nameAr,
        isActive: editingCatalog.isActive
      }),
    onSuccess: async () => {
      toast.success(t("specialties.catalog.updated"));
      setEditingCatalogId(null);
      setEditingCatalog({ code: "", name: "", nameAr: "", isActive: true });
      await refreshCatalog();
    },
    onError: () => toast.error(t("specialties.catalog.updateFailed"))
  });

  const deleteCatalogMutation = useMutation({
    mutationFn: (specialtyId: string) => specialtyService.adminDeleteCatalog(specialtyId),
    onSuccess: async () => {
      toast.success(t("specialties.catalog.deleted"));
      await refreshCatalog();
    },
    onError: () => toast.error(t("specialties.catalog.deleteFailed"))
  });

  const columns: ColumnDef<SpecialtyCatalogItem>[] = useMemo(
    () => [
      { header: "Code", accessorKey: "code" },
      { header: "English", accessorKey: "name" },
      { header: "العربية", accessorKey: "nameAr" },
      {
        header: "الحالة",
        id: "status",
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              row.original.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {row.original.isActive ? "مفعّل" : "غير مفعّل"}
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
                  code: row.original.code,
                  name: row.original.name,
                  nameAr: row.original.nameAr,
                  isActive: row.original.isActive
                });
              }}
              aria-label="تعديل التخصص"
            >
              <PencilLine size={14} />
            </button>
            <button
              type="button"
              className={deleteButtonClass}
              onClick={() => deleteCatalogMutation.mutate(row.original.id)}
              aria-label="حذف التخصص"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      }
    ],
    [deleteCatalogMutation]
  );

  return (
    <RoleGate allowed={["SuperAdmin"]} fallback={<div className="card p-6 text-base text-slate-500">{t("common.notAllowed")}</div>}>
      <AppShell>
        <section className="space-y-4">
          <div className="card space-y-4 p-6">
            <h1 className="text-3xl font-semibold text-brand-navy">{t("nav.specialtiesLookup")}</h1>
            <p className="text-base text-slate-600">{t("specialties.lookup.subtitle")}</p>

            <div className="grid gap-2 md:grid-cols-5">
              <input
                value={newCatalog.code}
                onChange={(event) => setNewCatalog((prev) => ({ ...prev, code: event.target.value }))}
                className={inputClass}
                placeholder="Code (e.g. OPHTHALMOLOGY)"
              />
              <input
                value={newCatalog.name}
                onChange={(event) => setNewCatalog((prev) => ({ ...prev, name: event.target.value }))}
                className={inputClass}
                placeholder="Name (English)"
              />
              <input
                value={newCatalog.nameAr}
                onChange={(event) => setNewCatalog((prev) => ({ ...prev, nameAr: event.target.value }))}
                className={inputClass}
                placeholder="الاسم (عربي)"
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newCatalog.isActive}
                  onChange={(event) => setNewCatalog((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                مفعّل
              </label>
              <RippleButton
                type="button"
                className="h-10 text-sm"
                disabled={!newCatalog.code.trim() || !newCatalog.name.trim() || !newCatalog.nameAr.trim() || createCatalogMutation.isPending}
                onClick={() => createCatalogMutation.mutate()}
              >
                إضافة تخصص
              </RippleButton>
            </div>
          </div>

          {editingCatalogId ? (
            <section className="card p-4">
              <p className="mb-3 text-base font-semibold text-slate-800">تعديل التخصص</p>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
                <input
                  value={editingCatalog.code}
                  onChange={(event) => setEditingCatalog((prev) => ({ ...prev, code: event.target.value }))}
                  className={inputClass}
                />
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
                  مفعّل
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={iconButtonClass}
                    onClick={() => updateCatalogMutation.mutate(editingCatalogId)}
                    aria-label="حفظ التخصص"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass}
                    onClick={() => {
                      setEditingCatalogId(null);
                      setEditingCatalog({ code: "", name: "", nameAr: "", isActive: true });
                    }}
                    aria-label="إلغاء"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <DataTable columns={columns} data={catalogQuery.data ?? []} />
        </section>
      </AppShell>
    </RoleGate>
  );
}
