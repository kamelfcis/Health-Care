"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Plus,
  SquarePen,
  Trash2,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGate } from "@/components/auth/role-gate";
import { StatCard } from "@/components/ui/stat-card";
import { EntityCollectionView } from "@/components/ui/entity-collection-view";
import { Modal } from "@/components/ui/modal";
import { RippleButton } from "@/components/ui/ripple-button";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService } from "@/lib/clinic-service";
import { useClinicCurrency } from "@/hooks/use-clinic-currency";
import {
  ClinicExpenseRow,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  ExpenseCreatePayload,
  financeService
} from "@/lib/finance-service";
import { storage } from "@/lib/storage";
import { useListQueryState } from "@/hooks/use-list-query-state";

const inputClass =
  "w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20";

type FinanceTab = "overview" | "revenues" | "expenses";

function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m + 1, 0);
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function getApiErrorMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

function expenseCategoryClass(category: ExpenseCategory): string {
  const map: Record<ExpenseCategory, string> = {
    UTILITIES: "bg-sky-100 text-sky-800 border-sky-200",
    RENT: "bg-violet-100 text-violet-800 border-violet-200",
    SALARIES: "bg-indigo-100 text-indigo-800 border-indigo-200",
    SUPPLIES: "bg-teal-100 text-teal-800 border-teal-200",
    MAINTENANCE: "bg-amber-100 text-amber-800 border-amber-200",
    MARKETING: "bg-pink-100 text-pink-800 border-pink-200",
    OTHER: "bg-slate-100 text-slate-700 border-slate-200"
  };
  return map[category] ?? map.OTHER;
}

const emptyExpenseForm: ExpenseCreatePayload = {
  title: "",
  category: "UTILITIES",
  amount: 0,
  expenseDate: new Date().toISOString().slice(0, 10),
  notes: ""
};

function FinancePageInner() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: FinanceTab =
    tabParam === "revenues" || tabParam === "expenses" ? tabParam : "overview";

  const { state } = useListQueryState();
  const defaultRange = useMemo(() => currentMonthRange(), []);
  const [periodFrom, setPeriodFrom] = useState(defaultRange.from);
  const [periodTo, setPeriodTo] = useState(defaultRange.to);

  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);

  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const canManage =
    isSuperAdmin || Boolean(currentUser?.permissions?.includes("finance.manage"));
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const listClinicId = isSuperAdmin ? (selectedClinicId === "all" ? undefined : selectedClinicId) : undefined;
  const createClinicParam = isSuperAdmin && selectedClinicId !== "all" ? selectedClinicId : undefined;

  const [expenseModal, setExpenseModal] = useState<"create" | "edit" | null>(null);
  const [editingExpense, setEditingExpense] = useState<ClinicExpenseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClinicExpenseRow | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseCreatePayload>(emptyExpenseForm);

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-finance"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin
  });
  const { formatMoney } = useClinicCurrency({
    clinicId: isSuperAdmin ? selectedClinicId : undefined,
    clinics: clinicsQuery.data
  });

  const summaryQuery = useQuery({
    queryKey: ["finance", "summary", listClinicId ?? "mine", periodFrom, periodTo],
    queryFn: () => financeService.getSummary(listClinicId, periodFrom, periodTo),
    enabled: !isSuperAdmin || selectedClinicId !== "all",
    placeholderData: keepPreviousData
  });

  const revenuesQuery = useQuery({
    queryKey: [
      "finance",
      "revenues",
      listClinicId ?? "mine",
      periodFrom,
      periodTo,
      state.page,
      state.pageSize,
      state.q
    ],
    queryFn: () =>
      financeService.listRevenues({
        clinicId: listClinicId,
        from: periodFrom,
        to: periodTo,
        page: state.page,
        pageSize: state.pageSize,
        search: state.q.trim() || undefined
      }),
    enabled: activeTab === "revenues" && (!isSuperAdmin || selectedClinicId !== "all"),
    placeholderData: keepPreviousData
  });

  const listCategory =
    state.status !== "all" && (EXPENSE_CATEGORIES as readonly string[]).includes(state.status)
      ? (state.status as ExpenseCategory)
      : undefined;

  const expensesQuery = useQuery({
    queryKey: [
      "finance",
      "expenses",
      listClinicId ?? "mine",
      periodFrom,
      periodTo,
      state.page,
      state.pageSize,
      state.q,
      listCategory ?? ""
    ],
    queryFn: () =>
      financeService.listExpenses({
        clinicId: listClinicId,
        from: periodFrom,
        to: periodTo,
        page: state.page,
        pageSize: state.pageSize,
        search: state.q.trim() || undefined,
        category: listCategory
      }),
    enabled: activeTab === "expenses" && (!isSuperAdmin || selectedClinicId !== "all"),
    placeholderData: keepPreviousData
  });

  const invalidateFinance = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["finance"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard", "finance-summary"] });
  }, [queryClient]);

  const saveExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!expenseForm.title.trim()) throw new Error(t("finance.validation.titleRequired"));
      if (!expenseForm.amount || expenseForm.amount <= 0) throw new Error(t("finance.validation.amountRequired"));
      const payload: ExpenseCreatePayload = {
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        expenseDate: expenseForm.expenseDate,
        notes: expenseForm.notes?.trim() || undefined
      };
      if (editingExpense) {
        return financeService.updateExpense(editingExpense.id, payload, createClinicParam);
      }
      if (isSuperAdmin && !createClinicParam) {
        throw new Error(t("finance.selectClinic"));
      }
      return financeService.createExpense(payload, createClinicParam);
    },
    onSuccess: () => {
      toast.success(editingExpense ? t("finance.expenseUpdated") : t("finance.expenseCreated"));
      setExpenseModal(null);
      setEditingExpense(null);
      setExpenseForm({ ...emptyExpenseForm, expenseDate: new Date().toISOString().slice(0, 10) });
      invalidateFinance();
    },
    onError: (err) => toast.error(getApiErrorMessage(err) ?? t("finance.saveFailed"))
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: () => financeService.removeExpense(String(deleteTarget?.id), createClinicParam),
    onSuccess: () => {
      toast.success(t("finance.expenseDeleted"));
      setDeleteTarget(null);
      invalidateFinance();
    },
    onError: (err) => toast.error(getApiErrorMessage(err) ?? t("finance.deleteFailed"))
  });

  const openCreateExpense = () => {
    if (isSuperAdmin && selectedClinicId === "all") {
      toast.error(t("finance.selectClinic"));
      return;
    }
    setEditingExpense(null);
    setExpenseForm({ ...emptyExpenseForm, expenseDate: new Date().toISOString().slice(0, 10) });
    setExpenseModal("create");
  };

  const openEditExpense = (row: ClinicExpenseRow) => {
    setEditingExpense(row);
    setExpenseForm({
      title: row.title,
      category: row.category,
      amount: row.amount,
      expenseDate: row.expenseDate.slice(0, 10),
      notes: row.notes ?? ""
    });
    setExpenseModal("edit");
  };

  type RevenueDisplayRow = {
    id: string;
    patientName: string;
    invoiceNumber: string;
    amount: string;
    method: string;
    date: string;
    searchText: string;
  };

  const revenueColumns = useMemo<ColumnDef<RevenueDisplayRow>[]>(
    () => [
      { accessorKey: "patientName", header: t("finance.col.patient") },
      { accessorKey: "invoiceNumber", header: t("finance.col.invoice") },
      { accessorKey: "amount", header: t("finance.col.amount") },
      { accessorKey: "method", header: t("finance.col.method") },
      { accessorKey: "date", header: t("finance.col.date") }
    ],
    [t]
  );

  const revenueRows = useMemo((): RevenueDisplayRow[] => {
    return (revenuesQuery.data?.data ?? []).map((r) => ({
      id: r.id,
      patientName: r.patientName,
      invoiceNumber: r.invoiceNumber,
      amount: formatMoney(r.amount),
      method: t(`paymentMethod.${r.method}` as "paymentMethod.CASH"),
      date: new Date(r.paidAt).toLocaleDateString(),
      searchText: `${r.patientName} ${r.invoiceNumber} ${r.transactionRef ?? ""}`
    }));
  }, [formatMoney, revenuesQuery.data, t]);

  const expenseColumns = useMemo<ColumnDef<ClinicExpenseRow>[]>(
    () => [
      { accessorKey: "title", header: t("finance.col.title") },
      {
        accessorKey: "category",
        header: t("finance.col.category"),
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${expenseCategoryClass(row.original.category)}`}
          >
            {t(`finance.category.${row.original.category}`)}
          </span>
        )
      },
      {
        accessorKey: "amount",
        header: t("finance.col.amount"),
        cell: ({ row }) => formatMoney(row.original.amount)
      },
      {
        accessorKey: "expenseDate",
        header: t("finance.col.date"),
        cell: ({ row }) => new Date(row.original.expenseDate).toLocaleDateString()
      },
      {
        id: "actions",
        header: t("finance.col.actions"),
        cell: ({ row }) =>
          canManage ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="text-orange-600 hover:text-orange-700"
                onClick={() => openEditExpense(row.original)}
                aria-label={t("common.edit")}
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="text-red-600 hover:text-red-700"
                onClick={() => setDeleteTarget(row.original)}
                aria-label={t("common.delete")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null
      }
    ],
    [canManage, formatMoney, t]
  );

  const summary = summaryQuery.data;
  const netProfit = summary?.netProfit ?? 0;
  const isProfit = netProfit >= 0;

  const tabLink = (tab: FinanceTab) => `/finance?tab=${tab}`;

  const superAdminNeedsClinic = isSuperAdmin && selectedClinicId === "all";

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-brand-navy">{t("finance.title")}</h1>
        {isSuperAdmin ? (
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <label className="flex min-w-[200px] flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">{t("finance.clinic")}</span>
              <select
                className={inputClass}
                value={selectedClinicId}
                onChange={(e) => setSelectedClinicId(e.target.value)}
              >
                <option value="all">{t("common.allClinics")}</option>
                {(clinicsQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">{t("finance.periodFrom")}</span>
            <input
              type="date"
              className={inputClass}
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">{t("finance.periodTo")}</span>
            <input
              type="date"
              className={inputClass}
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
          {(["overview", "revenues", "expenses"] as FinanceTab[]).map((tab) => (
            <Link
              key={tab}
              href={tabLink(tab)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab
                  ? "border-b-2 border-orange-500 text-orange-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t(`finance.tab.${tab}`)}
            </Link>
          ))}
        </div>

        {superAdminNeedsClinic ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("finance.selectClinicToView")}
          </p>
        ) : null}

        {activeTab === "overview" && !superAdminNeedsClinic ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title={t("finance.revenueTotal")}
                value={formatMoney(summary?.revenueTotal ?? 0)}
                icon={<ArrowUpCircle size={17} />}
                gradientClassName="bg-gradient-to-br from-emerald-50 via-white to-green-100"
                iconClassName="bg-emerald-500"
              />
              <StatCard
                title={t("finance.expenseTotal")}
                value={formatMoney(summary?.expenseTotal ?? 0)}
                icon={<ArrowDownCircle size={17} />}
                gradientClassName="bg-gradient-to-br from-rose-50 via-white to-red-100"
                iconClassName="bg-rose-500"
              />
              <StatCard
                title={t("finance.netProfit")}
                value={formatMoney(netProfit)}
                icon={isProfit ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                gradientClassName={
                  isProfit
                    ? "bg-gradient-to-br from-emerald-50 via-white to-teal-100 ring-1 ring-emerald-200"
                    : "bg-gradient-to-br from-rose-50 via-white to-orange-100 ring-1 ring-rose-200"
                }
                iconClassName={isProfit ? "bg-emerald-600" : "bg-rose-600"}
              />
            </div>
            <p className="text-sm text-slate-500">
              {isProfit ? t("finance.profitLabel") : t("finance.lossLabel")}:{" "}
              <span className={isProfit ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                {formatMoney(Math.abs(netProfit))}
              </span>
            </p>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("finance.expensesByCategory")}</h3>
              {summaryQuery.isLoading ? (
                <p className="text-sm text-slate-500">{t("common.loading")}</p>
              ) : (
                <ul className="space-y-2">
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const amt = summary?.expensesByCategory?.[cat] ?? 0;
                    if (amt <= 0) return null;
                    return (
                      <li key={cat} className="flex items-center justify-between gap-2 text-sm">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${expenseCategoryClass(cat)}`}
                        >
                          {t(`finance.category.${cat}`)}
                        </span>
                        <span className="font-medium text-slate-800">{formatMoney(amt)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : null}

        {activeTab === "revenues" && !superAdminNeedsClinic ? (
          <EntityCollectionView
            title={t("finance.tab.revenues")}
            data={revenueRows}
            columns={revenueColumns}
            tableCellsCenter
            tableHeaderClassName="bg-orange-500 text-white"
            storageKey="finance-revenues-view"
            skipLocalFiltering
            serverTotal={revenuesQuery.data?.total}
            listLoading={revenuesQuery.isLoading}
            searchPlaceholder={t("finance.searchRevenues")}
            statusOptions={[{ value: "all", label: t("common.all") }]}
            getSearchText={(row) => row.searchText}
            getStatus={() => "all"}
            renderCard={(row) => (
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">{row.patientName}</p>
                <p className="text-xs text-slate-500">{row.invoiceNumber}</p>
                <p className="mt-2 text-lg font-semibold text-emerald-700">{row.amount}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {row.method} · {row.date}
                </p>
              </div>
            )}
          />
        ) : null}

        {activeTab === "expenses" && !superAdminNeedsClinic ? (
          <EntityCollectionView
            title={t("finance.tab.expenses")}
            data={expensesQuery.data?.data ?? []}
            columns={expenseColumns}
            storageKey="finance-expenses-view"
            skipLocalFiltering
            serverTotal={expensesQuery.data?.total}
            listLoading={expensesQuery.isLoading}
            searchPlaceholder={t("finance.searchExpenses")}
            statusOptions={[
              { value: "all", label: t("finance.allCategories") },
              ...EXPENSE_CATEGORIES.map((cat) => ({
                value: cat,
                label: t(`finance.category.${cat}`)
              }))
            ]}
            getSearchText={(row) => `${row.title} ${row.notes ?? ""}`}
            getStatus={(row) => row.category}
            getDate={(row) => row.expenseDate.slice(0, 10)}
            addButton={
              canManage ? (
                <RippleButton type="button" onClick={openCreateExpense} className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t("finance.addExpense")}
                </RippleButton>
              ) : undefined
            }
            renderCard={(row) => (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{row.title}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${expenseCategoryClass(row.category)}`}
                  >
                    {t(`finance.category.${row.category}`)}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-rose-700">
                  {formatMoney(row.amount)}
                </p>
                <p className="mt-1 text-sm text-slate-500">{new Date(row.expenseDate).toLocaleDateString()}</p>
                {canManage ? (
                  <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-orange-200 bg-white text-orange-600 transition hover:bg-orange-50"
                      onClick={() => openEditExpense(row)}
                      aria-label={t("common.edit")}
                    >
                      <SquarePen className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                      onClick={() => setDeleteTarget(row)}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          />
        ) : null}
      </div>

      <Modal
        open={expenseModal !== null}
        onClose={() => setExpenseModal(null)}
        title={expenseModal === "edit" ? t("finance.editExpense") : t("finance.addExpense")}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveExpenseMutation.mutate();
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("finance.col.title")}</span>
            <input
              className={inputClass}
              value={expenseForm.title}
              onChange={(e) => setExpenseForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("finance.col.category")}</span>
            <select
              className={inputClass}
              value={expenseForm.category}
              onChange={(e) =>
                setExpenseForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
              }
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`finance.category.${cat}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("finance.col.amount")}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={expenseForm.amount || ""}
              onChange={(e) =>
                setExpenseForm((f) => ({ ...f, amount: e.target.value === "" ? 0 : Number(e.target.value) }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("finance.col.date")}</span>
            <input
              type="date"
              className={inputClass}
              value={expenseForm.expenseDate}
              onChange={(e) => setExpenseForm((f) => ({ ...f, expenseDate: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("finance.notes")}</span>
            <textarea
              className={inputClass}
              rows={3}
              value={expenseForm.notes ?? ""}
              onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <RippleButton type="button" className="bg-slate-100 text-slate-800 hover:bg-slate-200" onClick={() => setExpenseModal(null)}>
              {t("common.cancel")}
            </RippleButton>
            <RippleButton type="submit" disabled={saveExpenseMutation.isPending}>
              {saveExpenseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </RippleButton>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={t("finance.deleteExpenseTitle")}
        message={deleteTarget?.title ?? ""}
        confirmLabel={t("common.delete")}
        confirmingLabel={t("common.loading")}
        isPending={deleteExpenseMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteExpenseMutation.mutate()}
      />
    </AppShell>
  );
}

export default function FinancePage() {
  const { t } = useI18n();
  return (
    <RoleGate
      requiredPermissions={["finance.read"]}
      fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}
    >
      <Suspense fallback={null}>
        <FinancePageInner />
      </Suspense>
    </RoleGate>
  );
}
