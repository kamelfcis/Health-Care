import { api } from "./api";

interface InvoicePatient {
  fullName: string;
}

export interface BillingListItem {
  id: string;
  clinicId: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  patient?: InvoicePatient | null;
}

interface BillingListPayload {
  data: BillingListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const billingService = {
  async list(clinicId?: string) {
    const res = await api.get<{ data: BillingListPayload }>("/billing", {
      params: { page: 1, pageSize: 500, ...(clinicId ? { clinicId } : {}) }
    });
    return res.data.data.data;
  }
};
