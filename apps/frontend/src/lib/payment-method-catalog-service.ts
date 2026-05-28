import { api } from "./api";

export interface PaymentMethodCatalogItem {
  id: string;
  clinicId: string;
  code: string;
  name: string;
  nameAr: string;
  isActive: boolean;
}

export interface PaymentMethodCatalogPayload {
  code: string;
  name: string;
  nameAr: string;
  isActive?: boolean;
}

function clinicParams(clinicId?: string) {
  return clinicId ? { clinicId } : undefined;
}

export const paymentMethodCatalogService = {
  async list(clinicId?: string) {
    const res = await api.get<{ data: PaymentMethodCatalogItem[] }>("/payment-methods", {
      params: clinicParams(clinicId)
    });
    return res.data.data;
  },

  async manageList(clinicId?: string) {
    const res = await api.get<{ data: PaymentMethodCatalogItem[] }>("/payment-methods/manage", {
      params: clinicParams(clinicId)
    });
    return res.data.data;
  },

  async create(payload: PaymentMethodCatalogPayload, clinicId?: string) {
    const res = await api.post<{ data: PaymentMethodCatalogItem }>("/payment-methods", payload, {
      params: clinicParams(clinicId)
    });
    return res.data.data;
  },

  async update(id: string, payload: Partial<PaymentMethodCatalogPayload>, clinicId?: string) {
    const res = await api.patch<{ data: PaymentMethodCatalogItem }>(`/payment-methods/${id}`, payload, {
      params: clinicParams(clinicId)
    });
    return res.data.data;
  },

  async remove(id: string, clinicId?: string) {
    await api.delete(`/payment-methods/${id}`, {
      params: clinicParams(clinicId)
    });
  }
};
