"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/providers/i18n-provider";
import { RippleButton } from "@/components/ui/ripple-button";
import { patientService, PatientProcedureItem } from "@/lib/patient-service";
import { procedureService, ProcedureCatalogItem } from "@/lib/procedure-service";
import { useClinicCurrency } from "@/hooks/use-clinic-currency";
import { storage } from "@/lib/storage";
import { hasPermission } from "@/lib/permissions";

const inputClass =
  "w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20";

interface PatientProceduresPanelProps {
  patientId: string;
  clinicScope?: string;
}

export function PatientProceduresPanel({ patientId, clinicScope }: PatientProceduresPanelProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  const [catalogId, setCatalogId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAt, setPerformedAt] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);

  const canManage = hasPermission(currentUser, "patients.manage");
  const canBill = hasPermission(currentUser, "patients.manage") && hasPermission(currentUser, "billing.manage");

  const { formatMoney } = useClinicCurrency({
    clinicId: clinicScope ?? currentUser?.clinicId
  });

  const proceduresQuery = useQuery({
    queryKey: ["medical-record", "patient-procedures", patientId, clinicScope ?? "mine"],
    queryFn: () => patientService.listProcedures(patientId, clinicScope),
    enabled: Boolean(patientId)
  });

  const catalogQuery = useQuery({
    queryKey: ["procedures", "catalog", "active", clinicScope ?? "mine"],
    queryFn: () => procedureService.list(clinicScope),
    enabled: Boolean(patientId)
  });

  const catalogById = useMemo(() => {
    const map = new Map<string, ProcedureCatalogItem>();
    for (const item of catalogQuery.data ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [catalogQuery.data]);

  useEffect(() => {
    if (!catalogId) return;
    const item = catalogById.get(catalogId);
    if (!item) return;
    if (item.defaultAmount != null) {
      setAmount(String(item.defaultAmount));
    }
  }, [catalogId, catalogById]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["medical-record", "patient-procedures", patientId, clinicScope ?? "mine"]
    });
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!catalogId) throw new Error(t("patients.procedures.validation.catalogRequired"));
      const catalogItem = catalogById.get(catalogId);
      if (!catalogItem?.name.trim()) {
        throw new Error(t("patients.procedures.validation.catalogRequired"));
      }
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error(t("patients.procedures.validation.amountRequired"));
      }
      return patientService.createProcedure(
        patientId,
        {
          catalogId,
          name: catalogItem.name.trim(),
          amount: parsedAmount,
          notes: notes.trim() || undefined,
          performedAt: performedAt ? `${performedAt}T12:00:00.000Z` : undefined
        },
        clinicScope
      );
    },
    onSuccess: () => {
      toast.success(t("patients.procedures.createSuccess"));
      setCatalogId("");
      setAmount("");
      setNotes("");
      setPerformedAt(new Date().toISOString().slice(0, 10));
      invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || t("patients.procedures.createFailed"));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (procedureId: string) => patientService.removeProcedure(patientId, procedureId, clinicScope),
    onSuccess: () => {
      toast.success(t("patients.procedures.deleteSuccess"));
      invalidate();
    },
    onError: () => toast.error(t("patients.procedures.deleteFailed"))
  });

  if (proceduresQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (proceduresQuery.isError) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
        <p className="text-sm font-medium text-amber-800">{t("patients.procedures.loadFailed")}</p>
      </section>
    );
  }

  const procedures = proceduresQuery.data?.procedures ?? [];
  const catalog = catalogQuery.data ?? [];

  return (
    <div className="space-y-4">
      {canManage ? (
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-orange-100/40 p-4 shadow-sm">
          <h4 className="mb-3 text-base font-semibold text-slate-900">{t("patients.procedures.addTitle")}</h4>
          {!canBill ? (
            <p className="mb-3 text-xs text-amber-700">{t("patients.procedures.billingRequired")}</p>
          ) : null}
          {!catalog.length ? (
            <p className="text-sm text-slate-500">{t("patients.procedures.noCatalog")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">{t("patients.procedures.catalog")}</label>
                <select
                  className={inputClass}
                  value={catalogId}
                  onChange={(e) => setCatalogId(e.target.value)}
                  disabled={!canBill}
                >
                  <option value="">{t("patients.procedures.chooseCatalog")}</option>
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t("patients.procedures.amount")}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={!canBill}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t("patients.procedures.performedAt")}</label>
                <input
                  type="date"
                  className={inputClass}
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  disabled={!canBill}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">{t("patients.procedures.notes")}</label>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canBill}
                />
              </div>
              <div className="sm:col-span-2">
                <RippleButton
                  type="button"
                  disabled={!canBill || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  <Plus size={14} />
                  {t("patients.procedures.addAction")}
                </RippleButton>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {!procedures.length ? <p className="text-sm text-slate-500">{t("patients.procedures.empty")}</p> : null}

      {procedures.map((item) => (
        <ProcedureCard
          key={item.id}
          item={item}
          amountLabel={formatMoney(item.amount)}
          canManage={canManage}
          onDelete={() => deleteMutation.mutate(item.id)}
          isDeleting={deleteMutation.isPending}
          t={t}
        />
      ))}
    </div>
  );
}

function ProcedureCard({
  item,
  amountLabel,
  canManage,
  onDelete,
  isDeleting,
  t
}: {
  item: PatientProcedureItem;
  amountLabel: string;
  canManage: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  t: (key: string) => string;
}) {
  const performedLabel = item.performedAt ? new Date(item.performedAt).toLocaleDateString() : "-";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{item.name}</p>
          <p className="text-sm text-slate-600">
            {t("patients.procedures.amount")}: {amountLabel}
          </p>
          <p className="text-xs text-slate-500">
            {t("patients.procedures.performedAt")}: {performedLabel}
          </p>
          {item.notes ? <p className="mt-2 text-sm text-slate-700">{item.notes}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {item.invoiceId ? (
            <Link
              href={`/billing?invoiceId=${item.invoiceId}`}
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              {t("patients.procedures.viewInvoice")}
              {item.invoice?.invoiceNumber ? ` (${item.invoice.invoiceNumber})` : ""}
            </Link>
          ) : null}
          {canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 size={12} />
              {t("common.delete")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
