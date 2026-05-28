import { api } from "./api";

export interface InvoicePatientRef {
  id: string;
  fullName: string;
}

export interface InvoicePaymentSlice {
  amount: number;
  status: string;
}

export const INVOICE_SOURCE_TYPES = ["PROCEDURE", "EXAM", "CONSULTATION", "OTHER"] as const;
export type InvoiceSourceType = (typeof INVOICE_SOURCE_TYPES)[number];
export type BillingLineType = InvoiceSourceType;

export interface BillingLineItem {
  id: string;
  lineType: BillingLineType;
  title: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  catalogProcedureId?: string | null;
}

export interface BillingListItem {
  id: string;
  clinicId: string;
  patientId: string;
  appointmentId?: string | null;
  appointment?: { id: string; startsAt: string; status?: string; entryType?: string } | null;
  invoiceType?: InvoiceSourceType;
  patientProcedure?: { id: string; name: string } | null;
  lineItems?: BillingLineItem[];
  invoiceNumber: string;
  amount: number;
  taxAmount: number;
  discount: number;
  dueDate: string | null;
  status: string;
  notes?: string | null;
  patient?: InvoicePatientRef | null;
  payments?: InvoicePaymentSlice[];
  /** Set on invoice or derived from latest successful payment in list API. */
  paymentMethodCode?: string | null;
}

export interface BillingListParams {
  clinicId?: string;
  patientId?: string;
  invoiceId?: string;
  /** Server: PENDING + OVERDUE only */
  openOnly?: boolean;
  sort?: "created_desc" | "due_asc";
  search?: string;
  status?: string;
  invoiceType?: InvoiceSourceType | "all";
  /** Invoice due date range (YYYY-MM-DD), sent as from=/to= */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface BillingListPayload {
  data: BillingListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BillingStats {
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
  draftCount: number;
  outstandingTotal: number;
  paymentsThisMonthTotal: number;
  paymentsThisMonthCount: number;
}

export type BillingCreatePayload = {
  patientId: string;
  appointmentId?: string;
  invoiceNumber?: string;
  amount: number;
  taxAmount?: number;
  discount?: number;
  dueDate?: string;
  notes?: string;
  status?: string;
  invoiceType?: InvoiceSourceType;
  paymentMethod?: string;
  lineItems?: Array<{
    lineType: BillingLineType;
    title?: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    taxPercent?: number;
    catalogProcedureId?: string;
  }>;
};

export type BillingUpdatePayload = {
  status?: string;
  notes?: string;
  amount?: number;
  taxAmount?: number;
  discount?: number;
  dueDate?: string | null;
  appointmentId?: string | null;
  invoiceType?: InvoiceSourceType;
  lineItems?: Array<{
    lineType: BillingLineType;
    title?: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    taxPercent?: number;
    catalogProcedureId?: string;
  }>;
};

function listParams(params?: BillingListParams): Record<string, string | number> {
  const p: Record<string, string | number> = {
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20
  };
  if (params?.clinicId) p.clinicId = params.clinicId;
  if (params?.patientId) p.patientId = params.patientId;
  if (params?.invoiceId?.trim()) p.invoiceId = params.invoiceId.trim();
  if (params?.openOnly) p.openOnly = "1";
  if (params?.sort) p.sort = params.sort;
  if (params?.search?.trim()) p.search = params.search.trim();
  if (params?.status && params.status !== "all") p.status = params.status;
  if (params?.invoiceType && params.invoiceType !== "all") p.invoiceType = params.invoiceType;
  if (params?.from?.trim()) p.from = params.from.trim().slice(0, 10);
  if (params?.to?.trim()) p.to = params.to.trim().slice(0, 10);
  return p;
}

export function invoicePaidSuccessSum(item: Pick<BillingListItem, "payments">) {
  const list = item.payments ?? [];
  return list.filter((pay) => pay.status === "SUCCESS").reduce((s, pay) => s + pay.amount, 0);
}

export function invoiceBalanceDue(item: BillingListItem) {
  const due = invoiceTotalDue(item);
  const paid = invoicePaidSuccessSum(item);
  return Math.max(0, due - paid);
}

export const billingService = {
  async listResult(params?: BillingListParams) {
    const res = await api.get<{ data: BillingListPayload }>("/billing", { params: listParams(params) });
    return res.data.data;
  },

  async list(params?: BillingListParams) {
    const r = await billingService.listResult(params);
    return r.data;
  },

  async stats(clinicId?: string) {
    const res = await api.get<{ data: BillingStats }>("/billing/stats", {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async create(payload: BillingCreatePayload, createClinicId?: string) {
    const res = await api.post<{ data: BillingListItem }>("/billing", payload, {
      params: createClinicId ? { clinicId: createClinicId } : undefined
    });
    return res.data.data;
  },

  async update(id: string, payload: BillingUpdatePayload, clinicId?: string) {
    const res = await api.patch<{ data: BillingListItem }>(`/billing/${id}`, payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async remove(id: string, clinicId?: string) {
    await api.delete(`/billing/${id}`, {
      params: clinicId ? { clinicId } : undefined
    });
  }
};

export function invoiceTotalDue(item: { amount: number; taxAmount?: number; discount?: number }) {
  const tax = item.taxAmount ?? 0;
  const disc = item.discount ?? 0;
  return Math.max(0, item.amount + tax - disc);
}
