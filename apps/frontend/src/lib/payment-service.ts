import { api } from "./api";

export const PAYMENT_METHODS = ["CASH", "CARD", "ONLINE", "INSURANCE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface PaymentInvoiceRef {
  id: string;
  invoiceNumber: string;
}

export interface PaymentListItem {
  id: string;
  clinicId: string;
  invoiceId: string;
  amount: number;
  method: string;
  status: string;
  transactionRef?: string | null;
  createdAt: string;
  invoice?: PaymentInvoiceRef | null;
}

export interface PaymentListParams {
  clinicId?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

interface PaymentListPayload {
  data: PaymentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaymentStats {
  successTotalAmount: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  thisMonthAmount: number;
  thisMonthCount: number;
}

export type PaymentCreatePayload = {
  invoiceId: string;
  amount: number;
  method: "CASH" | "CARD" | "ONLINE" | "INSURANCE";
  transactionRef?: string;
  status?: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
};

export type PaymentUpdatePayload = {
  status?: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
  transactionRef?: string;
  amount?: number;
};

function listParams(params?: PaymentListParams): Record<string, string | number> {
  const p: Record<string, string | number> = {
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20
  };
  if (params?.clinicId) p.clinicId = params.clinicId;
  if (params?.search?.trim()) p.search = params.search.trim();
  if (params?.status && params.status !== "all") p.status = params.status;
  return p;
}

export const paymentService = {
  async listResult(params?: PaymentListParams) {
    const res = await api.get<{ data: PaymentListPayload }>("/payments", { params: listParams(params) });
    return res.data.data;
  },

  async list(params?: PaymentListParams) {
    const r = await paymentService.listResult(params);
    return r.data;
  },

  async stats(clinicId?: string) {
    const res = await api.get<{ data: PaymentStats }>("/payments/stats", {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async create(payload: PaymentCreatePayload, createClinicId?: string) {
    const res = await api.post<{ data: PaymentListItem }>("/payments", payload, {
      params: createClinicId ? { clinicId: createClinicId } : undefined
    });
    return res.data.data;
  },

  async update(id: string, payload: PaymentUpdatePayload, clinicId?: string) {
    const res = await api.patch<{ data: PaymentListItem | null }>(`/payments/${id}`, payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async remove(id: string, clinicId?: string) {
    await api.delete(`/payments/${id}`, {
      params: clinicId ? { clinicId } : undefined
    });
  }
};
