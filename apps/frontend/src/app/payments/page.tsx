"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Loader2, SquarePen, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EntityCollectionView } from "@/components/ui/entity-collection-view";
import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService } from "@/lib/clinic-service";
import { formatCurrency } from "@/lib/currency-format";
import {
  paymentService,
  PaymentCreatePayload,
  PaymentListItem,
  PaymentMethod,
  PaymentStatus,
  PaymentUpdatePayload
} from "@/lib/payment-service";
import { billingService, invoiceBalanceDue } from "@/lib/billing-service";
import { storage } from "@/lib/storage";
import { useListQueryState } from "@/hooks/use-list-query-state";
import { RoleGate } from "@/components/auth/role-gate";
import { StatCard } from "@/components/ui/stat-card";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

function getApiErrorMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

type PaymentRow = {
  id: string;
  clinicId: string;
  invoiceId: string;
  invoice: string;
  amount: string;
  method: string;
  methodKey: string;
  status: string;
  date: string;
  ref: string;
  amountNum: number;
};

const METHODS: PaymentMethod[] = ["CASH", "CARD", "ONLINE", "INSURANCE"];
const PAY_STATUSES: PaymentStatus[] = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"];

const EPS = 0.005;

function PaymentsPageInner() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { state, setQuery } = useListQueryState();
  const urlInvoiceId = searchParams.get("invoiceId")?.trim() || undefined;

  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const canManage =
    isSuperAdmin || Boolean(currentUser?.permissions?.includes("payments.manage"));

  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const listClinicId = isSuperAdmin ? (selectedClinicId === "all" ? undefined : selectedClinicId) : undefined;
  const createClinicParam = isSuperAdmin && selectedClinicId !== "all" ? selectedClinicId : undefined;
  const scopeForMutation = useCallback(
    (rowClinicId: string) => {
      if (isSuperAdmin && selectedClinicId === "all") return rowClinicId;
      if (isSuperAdmin && selectedClinicId !== "all") return selectedClinicId;
      return undefined;
    },
    [isSuperAdmin, selectedClinicId]
  );

  const listPage = state.page;
  const listPageSize = state.pageSize;
  const listSearch = state.q.trim() || undefined;
  const listStatus =
    state.status !== "all" && (PAY_STATUSES as readonly string[]).includes(state.status) ? state.status : undefined;
  const listMethod =
    state.method !== "all" && (METHODS as readonly string[]).includes(state.method) ? state.method : undefined;
  const listDateFrom = state.from.trim() || undefined;
  const listDateTo = state.to.trim() || undefined;

  const [payModal, setPayModal] = useState<"create" | "edit" | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [invoicePickShowAll, setInvoicePickShowAll] = useState(false);

  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<PaymentMethod>("CASH");
  const [formRef, setFormRef] = useState("");
  const [formStatus, setFormStatus] = useState<PaymentStatus>("SUCCESS");
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const lastPrefilledInvoiceId = useRef<string | null>(null);

  const resetForm = useCallback(() => {
    setFormInvoiceId("");
    setFormAmount("");
    setFormMethod("CASH");
    setFormRef("");
    setFormStatus("SUCCESS");
  }, []);

  const openCreate = () => {
    if (isSuperAdmin && selectedClinicId === "all") {
      toast.error(t("payments.selectClinic"));
      return;
    }
    resetForm();
    setEditingPayment(null);
    setPayModal("create");
  };

  const openEdit = (row: PaymentRow, full: PaymentListItem) => {
    setEditingPayment(full);
    setFormInvoiceId(full.invoiceId);
    setFormAmount(String(full.amount));
    setFormMethod(full.method as PaymentMethod);
    setFormRef(full.transactionRef ?? "");
    setFormStatus(full.status as PaymentStatus);
    setPayModal("edit");
  };

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

  const invoicePickClinicId = isSuperAdmin
    ? selectedClinicId === "all"
      ? undefined
      : selectedClinicId
    : currentUser?.clinicId ?? undefined;

  const invoicePickEnabled =
    payModal === "create" &&
    Boolean(invoicePickClinicId || (isSuperAdmin && selectedClinicId === "all"));

  const invoicesForPaymentQuery = useQuery({
    queryKey: ["payments", "invoice-pick", invoicePickClinicId, invoicePickShowAll],
    queryFn: () =>
      billingService.listResult({
        clinicId: invoicePickClinicId,
        openOnly: !invoicePickShowAll,
        sort: "due_asc",
        page: 1,
        pageSize: 200
      }),
    enabled: invoicePickEnabled
  });

  const payableInvoices = useMemo(() => {
    const items = invoicesForPaymentQuery.data?.data ?? [];
    if (invoicePickShowAll) {
      return items.filter((inv) => inv.status !== "CANCELLED");
    }
    return items;
  }, [invoicesForPaymentQuery.data?.data, invoicePickShowAll]);

  const paymentsListQuery = useQuery({
    queryKey: [
      "payments",
      "list",
      listClinicId,
      listPage,
      listPageSize,
      listSearch ?? "",
      listStatus ?? "",
      listMethod ?? "",
      listDateFrom ?? "",
      listDateTo ?? ""
    ],
    queryFn: () =>
      paymentService.listResult({
        clinicId: listClinicId,
        page: listPage,
        pageSize: listPageSize,
        search: listSearch,
        status: listStatus,
        method: listMethod,
        from: listDateFrom,
        to: listDateTo
      }),
    placeholderData: keepPreviousData
  });

  const invoicePrefillQuery = useQuery({
    queryKey: ["payments", "invoice-prefill", urlInvoiceId, invoicePickClinicId ?? "all-clinics"],
    queryFn: () =>
      billingService.listResult({
        clinicId: invoicePickClinicId,
        invoiceId: urlInvoiceId,
        page: 1,
        pageSize: 1
      }),
    enabled: Boolean(urlInvoiceId && canManage)
  });

  useEffect(() => {
    if (!urlInvoiceId) {
      lastPrefilledInvoiceId.current = null;
      return;
    }
    if (!canManage) return;
    if (lastPrefilledInvoiceId.current === urlInvoiceId) return;
    const inv = invoicePrefillQuery.data?.data?.[0];
    if (!inv) return;
    lastPrefilledInvoiceId.current = urlInvoiceId;
    const bal = invoiceBalanceDue(inv);
    if (bal <= EPS) {
      toast.info(t("payments.invoiceAlreadyPaid"));
      return;
    }
    setEditingPayment(null);
    setFormInvoiceId(inv.id);
    setFormAmount(String(bal));
    setFormMethod("CASH");
    setFormStatus("SUCCESS");
    setFormRef("");
    setPayModal("create");
  }, [urlInvoiceId, canManage, invoicePrefillQuery.data?.data, t]);

  useEffect(() => {
    if (payModal === "create" && canManage) {
      const t = window.setTimeout(() => amountInputRef.current?.focus(), 100);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [payModal, canManage]);

  const statsQuery = useQuery({
    queryKey: ["payments", "stats", listClinicId],
    queryFn: () => paymentService.stats(listClinicId)
  });

  const itemsById = useMemo(() => {
    const m = new Map<string, PaymentListItem>();
    for (const item of paymentsListQuery.data?.data ?? []) {
      m.set(item.id, item as PaymentListItem);
    }
    return m;
  }, [paymentsListQuery.data?.data]);

  const methodLabel = useCallback(
    (m: string) => {
      const key = `paymentMethod.${m}`;
      const tr = t(key);
      return tr === key ? m : tr;
    },
    [t]
  );

  const statusLabel = useCallback(
    (status: string) => {
      const key = `status.${status}`;
      const translated = t(key);
      return translated === key ? status : translated;
    },
    [t]
  );

  const rows: PaymentRow[] = useMemo(
    () =>
      paymentsListQuery.data?.data?.map((item) => ({
        id: item.id,
        clinicId: item.clinicId,
        invoiceId: item.invoiceId,
        invoice: item.invoice?.invoiceNumber ?? "-",
        amount: formatCurrency(item.amount, clinicCurrencyById.get(item.clinicId) ?? "USD"),
        method: methodLabel(item.method),
        methodKey: item.method,
        status: item.status,
        date: String(item.createdAt).slice(0, 10),
        ref: item.transactionRef ?? "-",
        amountNum: item.amount
      })) ?? [],
    [paymentsListQuery.data?.data, clinicCurrencyById, methodLabel]
  );

  const invalidatePayments = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["billing"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: { mode: "create" | "edit"; body: PaymentCreatePayload | PaymentUpdatePayload }) => {
      if (payload.mode === "create") {
        return paymentService.create(payload.body as PaymentCreatePayload, createClinicParam);
      }
      if (!editingPayment) throw new Error("No payment");
      return paymentService.update(editingPayment.id, payload.body as PaymentUpdatePayload, scopeForMutation(editingPayment.clinicId));
    },
    onSuccess: async (_, variables) => {
      invalidatePayments();
      await queryClient.refetchQueries({ queryKey: ["payments", "list"] });
      if (variables.mode === "create") {
        setQuery({ page: 1 });
      }
      setPayModal(null);
      setEditingPayment(null);
      resetForm();
      lastPrefilledInvoiceId.current = null;
      toast.success(t("payments.saved"));
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e) ?? t("payments.saveFailed"));
    }
  });

  const removeMutation = useMutation({
    mutationFn: ({ id, clinicId }: { id: string; clinicId: string }) => paymentService.remove(id, scopeForMutation(clinicId)),
    onSuccess: () => {
      invalidatePayments();
      setDeleteTarget(null);
      toast.success(t("payments.paymentDeleted"));
    },
    onError: (e) => toast.error(getApiErrorMessage(e) ?? t("payments.deleteFailed"))
  });

  const columns: ColumnDef<PaymentRow>[] = useMemo(
    () => [
      { header: t("payments.column.invoice"), accessorKey: "invoice" },
      { header: t("payments.column.amount"), accessorKey: "amount" },
      { header: t("payments.column.method"), accessorKey: "method" },
      {
        header: t("field.status"),
        id: "status",
        cell: ({ row }) => statusLabel(row.original.status)
      },
      { header: t("payments.column.date"), accessorKey: "date" },
      { header: t("payments.column.ref"), accessorKey: "ref" },
      ...(canManage
        ? [
            {
              header: t("common.edit"),
              id: "actions",
              cell: ({ row }: { row: { original: PaymentRow } }) => (
                <div className="flex justify-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg border border-cyan-200 p-1.5 text-cyan-700 hover:bg-cyan-50"
                    onClick={() => {
                      const full = itemsById.get(row.original.id);
                      if (full) openEdit(row.original, full);
                    }}
                    aria-label={t("common.edit")}
                  >
                    <SquarePen size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50"
                    onClick={() => setDeleteTarget(row.original)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            } as ColumnDef<PaymentRow>
          ]
        : [])
    ],
    [t, canManage, itemsById, statusLabel, methodLabel]
  );

  const stats = statsQuery.data;
  const currency =
    (listClinicId ? clinicCurrencyById.get(listClinicId) : myClinicQuery.data?.currencyCode?.toUpperCase()) ?? "USD";

  const selectedInvoiceBalance = useMemo(() => {
    if (!formInvoiceId || payModal !== "create") return null;
    const inv = payableInvoices.find((i) => i.id === formInvoiceId);
    if (!inv) return null;
    return invoiceBalanceDue(inv);
  }, [formInvoiceId, payModal, payableInvoices]);

  const amountNum = Number(formAmount);
  const showOverBalanceWarning =
    payModal === "create" &&
    selectedInvoiceBalance != null &&
    Number.isFinite(amountNum) &&
    amountNum > selectedInvoiceBalance + EPS;

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("payments.form.amount"));
      return;
    }
    if (payModal === "create") {
      if (!formInvoiceId) {
        toast.error(t("payments.form.selectInvoice"));
        return;
      }
      const body: PaymentCreatePayload = {
        invoiceId: formInvoiceId,
        amount,
        method: formMethod,
        status: formStatus,
        transactionRef: formRef.trim() || undefined
      };
      saveMutation.mutate({ mode: "create", body });
    } else if (editingPayment) {
      const body: PaymentUpdatePayload = {
        amount,
        status: formStatus,
        transactionRef: formRef.trim() || undefined
      };
      saveMutation.mutate({ mode: "edit", body });
    }
  };

  const payFullBalance = () => {
    if (selectedInvoiceBalance != null && selectedInvoiceBalance > EPS) {
      setFormAmount(String(selectedInvoiceBalance));
    }
  };

  const formatInvOption = (inv: (typeof payableInvoices)[0]) => {
    const cur = clinicCurrencyById.get(inv.clinicId) ?? "USD";
    const bal = invoiceBalanceDue(inv);
    return `${inv.invoiceNumber} — ${inv.patient?.fullName ?? ""} · ${t("billing.column.balanceDue")} ${formatCurrency(bal, cur)} (${inv.status})`;
  };

  return (
    <RoleGate requiredPermissions={["payments.read"]} fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}>
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

        <section className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          ) : stats ? (
            <>
              <StatCard
                title={t("payments.stats.collected")}
                value={formatCurrency(stats.successTotalAmount, currency)}
                icon={<Banknote size={17} />}
                gradientClassName="bg-gradient-to-br from-emerald-50 via-white to-teal-100"
                iconClassName="bg-emerald-500"
              />
              <StatCard
                title={t("payments.stats.successCount")}
                value={stats.successCount}
                icon={<Banknote size={17} />}
                gradientClassName="bg-gradient-to-br from-cyan-50 via-white to-sky-100"
                iconClassName="bg-cyan-500"
              />
              <StatCard
                title={t("payments.stats.pending")}
                value={stats.pendingCount}
                icon={<Banknote size={17} />}
                gradientClassName="bg-gradient-to-br from-amber-50 via-white to-orange-100"
                iconClassName="bg-amber-500"
              />
              <StatCard
                title={t("payments.stats.thisMonth")}
                value={formatCurrency(stats.thisMonthAmount, currency)}
                icon={<Banknote size={17} />}
                gradientClassName="bg-gradient-to-br from-violet-50 via-white to-fuchsia-100"
                iconClassName="bg-violet-500"
              />
            </>
          ) : null}
        </section>

        <EntityCollectionView
          title={t("nav.payments")}
          columns={columns}
          data={rows}
          storageKey="payment-view"
          tableCellsCenter
          skipLocalFiltering
          serverTotal={paymentsListQuery.data?.total ?? 0}
          listLoading={paymentsListQuery.isLoading || paymentsListQuery.isFetching}
          dateRangeHint={t("collection.dateHintPayments")}
          filterExtras={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                {t("collection.method")}
                <select
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  value={state.method}
                  onChange={(e) => setQuery({ method: e.target.value, page: 1 })}
                >
                  <option value="all">{t("common.all")}</option>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {methodLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="max-w-xl flex-1 text-xs leading-relaxed text-slate-500">{t("collection.smartSearchHintPayments")}</p>
            </div>
          }
          statusOptions={[
            { label: t("common.allStatuses"), value: "all" },
            ...PAY_STATUSES.map((status) => ({ label: statusLabel(status), value: status }))
          ]}
          searchPlaceholder={`${t("common.search")} ${t("nav.payments")}`}
          addButton={
            canManage ? <RippleButton onClick={openCreate}>{`+ ${t("nav.payments")}`}</RippleButton> : undefined
          }
          getSearchText={(row) => `${row.invoice} ${row.amount} ${row.method} ${row.status} ${row.date} ${row.ref}`}
          getStatus={(row) => row.status}
          getDate={(row) => row.date}
          renderCard={(row) => (
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{row.invoice}</h3>
                {canManage ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-cyan-200 p-1 text-cyan-700"
                      onClick={() => {
                        const full = itemsById.get(row.id);
                        if (full) openEdit(row, full);
                      }}
                    >
                      <SquarePen size={12} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 p-1 text-rose-700"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="text-sm text-slate-500">{row.amount}</p>
              <p className="text-xs text-slate-500">{row.method}</p>
              <p className="text-xs text-orange-600">{statusLabel(row.status)}</p>
            </div>
          )}
        />

        {payModal ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              aria-label={t("common.close")}
              onClick={() => {
                setPayModal(null);
                setEditingPayment(null);
                resetForm();
              }}
              disabled={saveMutation.isPending}
            />
            <section className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-premium dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {payModal === "create" ? t("payments.form.createTitle") : t("payments.form.editTitle")}
                </h2>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    setPayModal(null);
                    setEditingPayment(null);
                    resetForm();
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <form className="space-y-3" onSubmit={handleSubmitPayment}>
                {payModal === "create" ? (
                  <>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={invoicePickShowAll}
                        onChange={(e) => setInvoicePickShowAll(e.target.checked)}
                      />
                      <span>{invoicePickShowAll ? t("payments.invoicePickAll") : t("payments.invoicePickOpenOnly")}</span>
                    </label>
                    <label className="block text-sm">
                      <span className="text-slate-600">{t("payments.form.invoice")}</span>
                      <select
                        required
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                        value={formInvoiceId}
                        onChange={(e) => setFormInvoiceId(e.target.value)}
                        disabled={invoicesForPaymentQuery.isLoading}
                      >
                        <option value="">{t("payments.form.selectInvoice")}</option>
                        {payableInvoices.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {formatInvOption(inv)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">
                    {t("payments.column.invoice")}:{" "}
                    <span className="font-semibold">{editingPayment?.invoice?.invoiceNumber ?? "-"}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block min-w-[140px] flex-1 text-sm">
                    <span className="text-slate-600">{t("payments.form.amount")}</span>
                    <input
                      ref={amountInputRef}
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                    />
                  </label>
                  {payModal === "create" && selectedInvoiceBalance != null && selectedInvoiceBalance > EPS ? (
                    <RippleButton type="button" className="h-10 shrink-0 text-sm" glow={false} onClick={payFullBalance}>
                      {t("payments.payFullBalance")}
                    </RippleButton>
                  ) : null}
                </div>
                {showOverBalanceWarning ? (
                  <p className="text-xs font-medium text-amber-700">{t("payments.amountOverBalance")}</p>
                ) : null}
                <label className="block text-sm">
                  <span className="text-slate-600">{t("payments.form.method")}</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as PaymentMethod)}
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {methodLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">{t("payments.form.ref")}</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">{t("payments.form.status")}</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PaymentStatus)}
                  >
                    {PAY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-600"
                    onClick={() => {
                      setPayModal(null);
                      setEditingPayment(null);
                      resetForm();
                    }}
                  >
                    {t("common.cancel")}
                  </button>
                  <RippleButton type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        {t("common.saving")}
                      </span>
                    ) : (
                      t("common.save")
                    )}
                  </RippleButton>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {deleteTarget ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
              disabled={removeMutation.isPending}
              aria-label={t("common.close")}
            />
            <section className="relative w-full max-w-xl rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-orange-50 to-white p-5 shadow-premium">
              <p className="text-sm font-semibold text-slate-900">{t("payments.deleteConfirm")}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                  onClick={() => setDeleteTarget(null)}
                  disabled={removeMutation.isPending}
                >
                  {t("common.cancel")}
                </button>
                <RippleButton
                  type="button"
                  className="from-rose-600 to-red-500"
                  disabled={removeMutation.isPending}
                  onClick={() => deleteTarget && removeMutation.mutate({ id: deleteTarget.id, clinicId: deleteTarget.clinicId })}
                >
                  {removeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : t("common.delete")}
                </RippleButton>
              </div>
            </section>
          </div>
        ) : null}
      </AppShell>
    </RoleGate>
  );
}

export default function PaymentsPage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <RoleGate requiredPermissions={["payments.read"]} fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}>
          <AppShell>
            <div className="card p-6 text-sm text-slate-500">{t("payments.loading")}</div>
          </AppShell>
        </RoleGate>
      }
    >
      <PaymentsPageInner />
    </Suspense>
  );
}
