"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, SquarePen, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EntityCollectionView } from "@/components/ui/entity-collection-view";
import { RippleButton } from "@/components/ui/ripple-button";
import { StatCard } from "@/components/ui/stat-card";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  billingService,
  BillingListItem,
  invoiceBalanceDue,
  invoiceTotalDue,
  type BillingCreatePayload,
  type BillingUpdatePayload
} from "@/lib/billing-service";
import { clinicService } from "@/lib/clinic-service";
import { formatCurrency } from "@/lib/currency-format";
import { patientService, PatientListItem } from "@/lib/patient-service";
import { appointmentService } from "@/lib/appointment-service";
import { storage } from "@/lib/storage";
import { RoleGate } from "@/components/auth/role-gate";
import { useDebounce } from "@/hooks/use-debounce";
import { useListQueryState } from "@/hooks/use-list-query-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const INVOICE_STATUSES = ["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"] as const;

function getApiErrorMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

type InvoiceRow = {
  raw: BillingListItem;
  clinicId: string;
  id: string;
  invoice: string;
  patient: string;
  patientId: string;
  amount: string;
  balanceDue: string;
  dueDate: string;
  status: string;
};

function BillingPageInner() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { state, setQuery } = useListQueryState();
  const urlPatientId = searchParams.get("patientId")?.trim() || undefined;
  const urlInvoiceId = searchParams.get("invoiceId")?.trim() || undefined;

  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const canManage = currentUser?.role === "SuperAdmin" || currentUser?.permissions?.includes("billing.manage");
  const canRecordPayment =
    isSuperAdmin || Boolean(currentUser?.permissions?.includes("payments.manage"));

  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");

  const listClinicId = selectedClinicId === "all" ? undefined : selectedClinicId;
  const createClinicParam =
    isSuperAdmin && selectedClinicId !== "all" ? selectedClinicId : undefined;

  const scopeForRowMutation = useCallback(
    (rowClinicId: string) => {
      if (isSuperAdmin && selectedClinicId === "all") return rowClinicId;
      if (isSuperAdmin && selectedClinicId !== "all") return selectedClinicId;
      return undefined;
    },
    [isSuperAdmin, selectedClinicId]
  );

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-filter"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin
  });
  const myClinicQuery = useQuery({
    queryKey: ["settings", "clinic-me", currentUser?.role ?? "none"],
    queryFn: () => clinicService.getMyClinic(),
    enabled: !!currentUser && currentUser.role !== "SuperAdmin"
  });

  const clinicCurrencyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const clinic of clinicsQuery.data ?? []) {
      if (clinic.id) map.set(clinic.id, (clinic.currencyCode ?? "USD").toUpperCase());
    }
    if (myClinicQuery.data?.id) {
      map.set(myClinicQuery.data.id, (myClinicQuery.data.currencyCode ?? "USD").toUpperCase());
    }
    return map;
  }, [clinicsQuery.data, myClinicQuery.data]);

  const listPage = state.page;
  const listPageSize = state.pageSize;
  const listSearch = state.q.trim() || undefined;
  const listStatus =
    state.status !== "all" && (INVOICE_STATUSES as readonly string[]).includes(state.status) ? state.status : undefined;
  const listSort = state.sort === "due_asc" ? "due_asc" : "created_desc";
  const listOpenOnly = state.openOnly;
  const listDueFrom = state.from.trim() || undefined;
  const listDueTo = state.to.trim() || undefined;

  const billingListQuery = useQuery({
    queryKey: [
      "billing",
      "list",
      listClinicId,
      urlPatientId,
      listPage,
      listPageSize,
      listSearch ?? "",
      listStatus ?? "",
      listSort,
      listOpenOnly ? "1" : "",
      listDueFrom ?? "",
      listDueTo ?? ""
    ],
    queryFn: () =>
      billingService.listResult({
        clinicId: listClinicId,
        patientId: urlPatientId,
        page: listPage,
        pageSize: listPageSize,
        search: listSearch,
        status: listStatus,
        sort: listSort,
        openOnly: listOpenOnly,
        from: listDueFrom,
        to: listDueTo
      }),
    placeholderData: keepPreviousData
  });

  const statsQuery = useQuery({
    queryKey: ["billing", "stats", listClinicId],
    queryFn: () => billingService.stats(listClinicId)
  });

  const rows: InvoiceRow[] = useMemo(
    () =>
      (billingListQuery.data?.data ?? []).map((item) => {
        const cur = clinicCurrencyById.get(item.clinicId) ?? "USD";
        const due = item.dueDate ? String(item.dueDate).slice(0, 10) : "-";
        const bal = invoiceBalanceDue(item);
        return {
          raw: item,
          clinicId: item.clinicId,
          id: item.id,
          invoice: item.invoiceNumber,
          patient: item.patient?.fullName ?? "-",
          patientId: item.patientId,
          amount: formatCurrency(invoiceTotalDue(item), cur),
          balanceDue: formatCurrency(bal, cur),
          dueDate: due,
          status: item.status
        };
      }),
    [billingListQuery.data?.data, clinicCurrencyById]
  );

  const highlightedId = urlInvoiceId;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BillingListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);

  const [patientQuery, setPatientQuery] = useState("");
  const debouncedPatientQ = useDebounce(patientQuery, 300);
  const patientListClinic = createClinicParam ?? (!isSuperAdmin ? currentUser?.clinicId : listClinicId);

  const patientsForSelect = useQuery({
    queryKey: ["billing", "patients-pick", patientListClinic, debouncedPatientQ],
    queryFn: () => patientService.list(patientListClinic, { search: debouncedPatientQ.trim() || undefined }),
    enabled: modalOpen && !!patientListClinic && (!isSuperAdmin || selectedClinicId !== "all")
  });

  const [formPatientId, setFormPatientId] = useState("");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formTax, setFormTax] = useState("0");
  const [formDiscount, setFormDiscount] = useState("0");
  const [formDue, setFormDue] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<string>("PENDING");
  const [formAppointmentId, setFormAppointmentId] = useState("");

  const apptPickClinicId = editing?.clinicId ?? patientListClinic ?? undefined;
  const apptPatientIdForQuery = (editing?.patientId ?? formPatientId).trim();

  const appointmentsPickQuery = useQuery({
    queryKey: ["billing", "appointments-pick", apptPickClinicId, apptPatientIdForQuery],
    queryFn: () => appointmentService.list(apptPickClinicId, { patientId: apptPatientIdForQuery }),
    enabled: modalOpen && Boolean(apptPickClinicId && apptPatientIdForQuery)
  });

  useEffect(() => {
    if (editing) return;
    setFormAppointmentId("");
  }, [formPatientId, editing]);

  const resetForm = () => {
    setFormPatientId("");
    setFormInvoiceNumber("");
    setFormAmount("");
    setFormTax("0");
    setFormDiscount("0");
    setFormDue("");
    setFormNotes("");
    setFormStatus("PENDING");
    setFormAppointmentId("");
    setPatientQuery("");
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    if (urlPatientId) setFormPatientId(urlPatientId);
    setModalOpen(true);
  };

  const openEdit = (item: BillingListItem) => {
    setEditing(item);
    setFormPatientId(item.patientId);
    setFormInvoiceNumber(item.invoiceNumber);
    setFormAmount(String(item.amount));
    setFormTax(String(item.taxAmount ?? 0));
    setFormDiscount(String(item.discount ?? 0));
    setFormDue(item.dueDate ? String(item.dueDate).slice(0, 10) : "");
    setFormNotes(item.notes ?? "");
    setFormStatus(item.status);
    setFormAppointmentId(item.appointmentId ?? "");
    setPatientQuery("");
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(formAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount");
      const taxAmount = Number(formTax) || 0;
      const discount = Number(formDiscount) || 0;
      if (!formPatientId.trim()) throw new Error("patient");

      if (editing) {
        const payload: BillingUpdatePayload = {
          status: formStatus,
          notes: formNotes.trim() || undefined,
          amount,
          taxAmount,
          discount,
          dueDate: formDue.trim() ? formDue : null,
          appointmentId: formAppointmentId.trim() || null
        };
        return billingService.update(editing.id, payload, scopeForRowMutation(editing.clinicId));
      }

      const payload: BillingCreatePayload = {
        patientId: formPatientId.trim(),
        amount,
        taxAmount,
        discount,
        dueDate: formDue.trim() || undefined,
        notes: formNotes.trim() || undefined,
        status: formStatus
      };
      const num = formInvoiceNumber.trim();
      if (num) payload.invoiceNumber = num;
      const appt = formAppointmentId.trim();
      if (appt) payload.appointmentId = appt;
      return billingService.create(payload, createClinicParam);
    },
    onSuccess: () => {
      toast.success(t("billing.saved"));
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "amount") {
        toast.error(t("billing.form.amount"));
        return;
      }
      if (err instanceof Error && err.message === "patient") {
        toast.error(t("billing.form.selectPatient"));
        return;
      }
      toast.error(getApiErrorMessage(err) ?? t("billing.saveFailed"));
    }
  });

  const removeMutation = useMutation({
    mutationFn: async ({ id, clinicId }: { id: string; clinicId: string }) => {
      await billingService.remove(id, scopeForRowMutation(clinicId));
    },
    onSuccess: () => {
      toast.success(t("billing.invoiceDeleted"));
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err) ?? t("billing.deleteFailed"))
  });

  const statusLabel = useCallback(
    (status: string) => {
      const key = `status.${status}`;
      const translated = t(key);
      return translated === key ? status : translated;
    },
    [t]
  );

  const stats = statsQuery.data;
  const selectedCurrency =
    listClinicId && clinicCurrencyById.get(listClinicId)
      ? clinicCurrencyById.get(listClinicId)!
      : myClinicQuery.data?.currencyCode?.toUpperCase() ?? "USD";

  const columns: ColumnDef<InvoiceRow>[] = useMemo(
    () => [
      { header: t("billing.column.invoice"), accessorKey: "invoice" },
      { header: t("nav.patients"), accessorKey: "patient" },
      { header: t("billing.column.amount"), accessorKey: "amount" },
      { header: t("billing.column.balanceDue"), accessorKey: "balanceDue" },
      { header: t("billing.column.dueDate"), accessorKey: "dueDate" },
      {
        header: t("field.status"),
        id: "status",
        cell: ({ row }) => statusLabel(row.original.status)
      },
      ...(canManage || canRecordPayment
        ? [
            {
              header: "",
              id: "actions",
              cell: ({ row }: { row: { original: InvoiceRow } }) => (
                <div className="flex justify-center gap-1">
                  {canRecordPayment && invoiceBalanceDue(row.original.raw) > 0 ? (
                    <Link
                      href={`/payments?invoiceId=${encodeURIComponent(row.original.id)}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      aria-label={t("billing.payQuick")}
                      title={t("billing.payQuick")}
                    >
                      <Banknote size={14} />
                    </Link>
                  ) : null}
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                        aria-label={t("common.edit")}
                        onClick={() => openEdit(row.original.raw)}
                      >
                        <SquarePen size={14} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                        aria-label={t("common.delete")}
                        onClick={() => setDeleteTarget(row.original)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : null}
                </div>
              )
            } as ColumnDef<InvoiceRow>
          ]
        : [])
    ],
    [t, canManage, canRecordPayment, statusLabel]
  );

  const createDisabled = isSuperAdmin && selectedClinicId === "all";

  return (
    <RoleGate requiredPermissions={["billing.read"]} fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}>
      <AppShell>
        {isSuperAdmin ? (
          <section className="mb-4 card bg-white/80 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-600">{t("dashboard.clinicScope")}</p>
              <select
                className="h-11 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
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
          </section>
        ) : null}

        {urlPatientId ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50/80 px-4 py-2 text-sm text-orange-900">
            <span>{t("billing.patientFilter")}</span>
            <Link href="/billing" className="font-medium underline">
              {t("billing.clearPatientFilter")}
            </Link>
          </div>
        ) : null}

        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statsQuery.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          ) : stats ? (
            <>
              <StatCard title={t("billing.stats.pending")} value={stats.pendingCount} gradientClassName="bg-gradient-to-br from-amber-50 to-white" />
              <StatCard title={t("billing.stats.overdue")} value={stats.overdueCount} gradientClassName="bg-gradient-to-br from-rose-50 to-white" />
              <StatCard title={t("billing.stats.paid")} value={stats.paidCount} gradientClassName="bg-gradient-to-br from-emerald-50 to-white" />
              <StatCard
                title={t("billing.stats.outstanding")}
                value={formatCurrency(stats.outstandingTotal, selectedCurrency)}
                gradientClassName="bg-gradient-to-br from-orange-50 to-white"
              />
              <StatCard
                title={t("billing.stats.paymentsThisMonth")}
                value={formatCurrency(stats.paymentsThisMonthTotal, selectedCurrency)}
                gradientClassName="bg-gradient-to-br from-cyan-50 to-white"
              />
              <StatCard title={t("payments.stats.thisMonth")} value={stats.paymentsThisMonthCount} gradientClassName="bg-gradient-to-br from-slate-50 to-white" />
            </>
          ) : null}
        </section>

        <EntityCollectionView
          title={t("nav.billing")}
          columns={columns}
          data={rows}
          storageKey="billing-view"
          tableCellsCenter
          skipLocalFiltering
          serverTotal={billingListQuery.data?.total ?? 0}
          listLoading={billingListQuery.isLoading || billingListQuery.isFetching}
          dateRangeHint={t("collection.dateHintBilling")}
          filterExtras={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                {t("common.sort")}
                <select
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  value={state.sort}
                  onChange={(e) => setQuery({ sort: e.target.value, page: 1 })}
                >
                  <option value="">{t("billing.sort.newest")}</option>
                  <option value="due_asc">{t("billing.sort.dueSoon")}</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={state.openOnly}
                  onChange={(e) => setQuery({ openOnly: e.target.checked, page: 1 })}
                />
                {t("billing.filter.openOnly")}
              </label>
              <p className="max-w-xl flex-1 text-xs leading-relaxed text-slate-500">{t("collection.smartSearchHintBilling")}</p>
            </div>
          }
          statusOptions={[
            { label: t("common.allStatuses"), value: "all" },
            ...INVOICE_STATUSES.map((status) => ({ label: statusLabel(status), value: status }))
          ]}
          searchPlaceholder={`${t("common.search")} ${t("nav.billing")}`}
          addButton={
            canManage ? (
              <RippleButton onClick={openCreate} disabled={createDisabled} title={createDisabled ? t("billing.selectClinic") : undefined}>
                {`+ ${t("nav.billing")}`}
              </RippleButton>
            ) : undefined
          }
          getSearchText={(row) => `${row.invoice} ${row.patient} ${row.amount} ${row.balanceDue} ${row.status} ${row.dueDate}`}
          getStatus={(row) => row.status}
          getDate={(row) => (row.dueDate !== "-" ? row.dueDate : undefined)}
          renderCard={(row) => (
            <div
              className={cn(
                "space-y-2",
                highlightedId === row.id && "ring-2 ring-orange-400 ring-offset-2 rounded-xl p-1 -m-1"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{row.invoice}</h3>
                <div className="flex gap-1">
                  {canRecordPayment && invoiceBalanceDue(row.raw) > 0 ? (
                    <Link
                      href={`/payments?invoiceId=${encodeURIComponent(row.id)}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700"
                      aria-label={t("billing.payQuick")}
                      title={t("billing.payQuick")}
                    >
                      <Banknote size={12} />
                    </Link>
                  ) : null}
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-200 text-cyan-700"
                        onClick={() => openEdit(row.raw)}
                        aria-label={t("common.edit")}
                      >
                        <SquarePen size={12} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 text-rose-700"
                        onClick={() => setDeleteTarget(row)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-slate-500">{row.patient}</p>
              <p className="text-xs text-slate-500">{row.amount}</p>
              <p className="text-xs font-medium text-slate-700">{t("billing.column.balanceDue")}: {row.balanceDue}</p>
              <p className="text-xs text-slate-500">{row.dueDate}</p>
              <p className="text-xs text-orange-600">{statusLabel(row.status)}</p>
            </div>
          )}
        />

        {modalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {editing ? t("billing.form.editTitle") : t("billing.form.createTitle")}
                </h2>
                <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setModalOpen(false)} aria-label={t("common.close")}>
                  <X size={18} />
                </button>
              </div>

              {createDisabled ? (
                <p className="text-sm text-amber-700">{t("billing.selectClinic")}</p>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveMutation.mutate();
                  }}
                >
                  {!editing ? (
                    <label className="block text-sm">
                      <span className="text-slate-600">{t("billing.form.patient")}</span>
                      <input
                        type="search"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder={t("common.search")}
                        value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                      />
                      <select
                        required
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={formPatientId}
                        onChange={(e) => setFormPatientId(e.target.value)}
                      >
                        <option value="">{t("billing.form.selectPatient")}</option>
                        {(patientsForSelect.data ?? []).map((p: PatientListItem) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName} — {p.phone}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="text-sm text-slate-600">
                      {t("billing.form.patient")}: <span className="font-medium text-slate-900">{editing.patient?.fullName ?? editing.patientId}</span>
                    </p>
                  )}

                  {apptPatientIdForQuery ? (
                    <label className="block text-sm">
                      <span className="text-slate-600">{t("billing.form.appointment")}</span>
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={formAppointmentId}
                        onChange={(e) => setFormAppointmentId(e.target.value)}
                        disabled={appointmentsPickQuery.isLoading}
                      >
                        <option value="">{t("billing.form.noAppointment")}</option>
                        {(appointmentsPickQuery.data ?? []).map((a) => (
                          <option key={a.id} value={a.id}>
                            {String(a.startsAt).slice(0, 10)} {String(a.startsAt).slice(11, 16)} — {a.status}
                          </option>
                        ))}
                      </select>
                      {appointmentsPickQuery.isLoading ? (
                        <p className="mt-1 text-xs text-slate-500">{t("billing.form.appointmentsLoading")}</p>
                      ) : null}
                    </label>
                  ) : null}

                  {!editing ? (
                    <label className="block text-sm">
                      <span className="text-slate-600">{t("billing.form.invoiceNumber")}</span>
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={formInvoiceNumber}
                        onChange={(e) => setFormInvoiceNumber(e.target.value)}
                        placeholder={t("billing.form.invoiceNumberHint")}
                      />
                    </label>
                  ) : null}

                  <label className="block text-sm">
                    <span className="text-slate-600">{t("billing.form.amount")}</span>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-sm">
                      <span className="text-slate-600">{t("billing.form.tax")}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={formTax}
                        onChange={(e) => setFormTax(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-slate-600">{t("billing.form.discount")}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={formDiscount}
                        onChange={(e) => setFormDiscount(e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    <span className="text-slate-600">{t("billing.form.dueDate")}</span>
                    <input type="date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={formDue} onChange={(e) => setFormDue(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">{t("billing.form.notes")}</span>
                    <textarea className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">{t("billing.form.status")}</span>
                    <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                      {INVOICE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <RippleButton type="button" glow={false} className="border border-slate-200 bg-white !text-slate-700 hover:bg-slate-50" onClick={() => setModalOpen(false)}>
                      {t("common.cancel")}
                    </RippleButton>
                    <RippleButton type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? t("common.saving") : t("common.save")}
                    </RippleButton>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}

        {deleteTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <p className="text-sm text-slate-700 dark:text-slate-200">{t("billing.deleteConfirm")}</p>
              <div className="mt-4 flex justify-end gap-2">
                <RippleButton type="button" glow={false} className="border border-slate-200 bg-white !text-slate-700 hover:bg-slate-50" onClick={() => setDeleteTarget(null)}>
                  {t("common.cancel")}
                </RippleButton>
                <RippleButton
                  type="button"
                  className="bg-rose-600 text-white"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate({ id: deleteTarget.id, clinicId: deleteTarget.clinicId })}
                >
                  {t("common.delete")}
                </RippleButton>
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    </RoleGate>
  );
}

export default function BillingPage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <RoleGate requiredPermissions={["billing.read"]} fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}>
          <AppShell>
            <div className="card p-6 text-sm text-slate-500">{t("billing.loading")}</div>
          </AppShell>
        </RoleGate>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}
