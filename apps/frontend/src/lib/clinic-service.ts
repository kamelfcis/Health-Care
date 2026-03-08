import { api } from "./api";

export interface ClinicItem {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  currencyCode?: string | null;
  timezone?: string | null;
  isActive: boolean;
  clinicSpecialties?: Array<{
    specialty: {
      id: string;
      code: string;
      name: string;
      nameAr: string;
    };
  }>;
}

export interface ClinicAdminPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface CreateClinicPayload {
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  specialtyCodes: string[];
  adminUser: ClinicAdminPayload;
}

export interface UpdateClinicPayload {
  name?: string;
  slug?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  isActive?: boolean;
  specialtyCodes?: string[];
  applyRetroactiveCurrencyConversion?: boolean;
  conversionRate?: number;
}

interface ClinicsListResponse {
  data: ClinicItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const clinicService = {
  async list() {
    const res = await api.get<{ data: ClinicsListResponse }>("/clinics?page=1&pageSize=100");
    return res.data.data.data;
  },

  async create(payload: CreateClinicPayload) {
    const res = await api.post<{ data: ClinicItem }>("/clinics", payload);
    return res.data.data;
  },

  async update(clinicId: string, payload: UpdateClinicPayload) {
    const res = await api.patch<{ data: ClinicItem }>(`/clinics/${clinicId}`, payload);
    return res.data.data;
  },

  async remove(clinicId: string) {
    const res = await api.delete<{ data: ClinicItem }>(`/clinics/${clinicId}`);
    return res.data.data;
  },

  async getMyClinic() {
    const res = await api.get<{ data: ClinicItem }>("/clinics/me");
    return res.data.data;
  },

  async updateMyClinic(payload: FormData) {
    const res = await api.patch<{ data: ClinicItem }>("/clinics/me", payload, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return res.data.data;
  }
};
