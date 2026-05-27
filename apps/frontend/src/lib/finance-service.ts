import { api } from "./api";

export const EXPENSE_CATEGORIES = [
  "UTILITIES",
  "RENT",
  "SALARIES",
  "SUPPLIES",
  "MAINTENANCE",
  "MARKETING",
  "OTHER"
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface FinanceSummary {
  period: { from: string; to: string };
  revenueTotal: number;
  expenseTotal: number;
  netProfit: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  revenueCount: number;
  expenseCount: number;
}

export interface FinanceRevenueRow {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  transactionRef?: string | null;
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
}

export interface ClinicExpenseRow {
  id: string;
  clinicId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  notes?: string | null;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface FinanceListParams {
  clinicId?: string;
  search?: string;
  from?: string;
  to?: string;
  category?: ExpenseCategory;
  page?: number;
  pageSize?: number;
}

interface ListPayload<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type ExpenseCreatePayload = {
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  notes?: string;
};

export type ExpenseUpdatePayload = Partial<ExpenseCreatePayload> & { notes?: string | null };

function listParams(params?: FinanceListParams): Record<string, string | number> {
  const p: Record<string, string | number> = {
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20
  };
  if (params?.clinicId) p.clinicId = params.clinicId;
  if (params?.search?.trim()) p.search = params.search.trim();
  if (params?.from?.trim()) p.from = params.from.trim().slice(0, 10);
  if (params?.to?.trim()) p.to = params.to.trim().slice(0, 10);
  if (params?.category) p.category = params.category;
  return p;
}

export const financeService = {
  async getSummary(clinicId?: string, from?: string, to?: string) {
    const res = await api.get<{ data: FinanceSummary }>("/finance/summary", {
      params: {
        ...(clinicId ? { clinicId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {})
      }
    });
    return res.data.data;
  },

  async listRevenues(params?: FinanceListParams) {
    const res = await api.get<{ data: ListPayload<FinanceRevenueRow> }>("/finance/revenues", {
      params: listParams(params)
    });
    return res.data.data;
  },

  async listExpenses(params?: FinanceListParams) {
    const res = await api.get<{ data: ListPayload<ClinicExpenseRow> }>("/finance/expenses", {
      params: listParams(params)
    });
    return res.data.data;
  },

  async createExpense(payload: ExpenseCreatePayload, clinicId?: string) {
    const res = await api.post<{ data: ClinicExpenseRow }>("/finance/expenses", payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async updateExpense(id: string, payload: ExpenseUpdatePayload, clinicId?: string) {
    const res = await api.patch<{ data: ClinicExpenseRow }>(`/finance/expenses/${id}`, payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async removeExpense(id: string, clinicId?: string) {
    await api.delete(`/finance/expenses/${id}`, {
      params: clinicId ? { clinicId } : undefined
    });
  }
};
