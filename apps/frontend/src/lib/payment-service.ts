import { api } from "./api";

interface PaymentInvoice {
  invoiceNumber: string;
}

export interface PaymentListItem {
  id: string;
  clinicId: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  invoice?: PaymentInvoice | null;
}

interface PaymentListPayload {
  data: PaymentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const paymentService = {
  async list(clinicId?: string) {
    const res = await api.get<{ data: PaymentListPayload }>("/payments", {
      params: { page: 1, pageSize: 500, ...(clinicId ? { clinicId } : {}) }
    });
    return res.data.data.data;
  }
};
