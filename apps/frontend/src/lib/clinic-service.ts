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
  imageUrl?: string;
  clinicImage?: File | null;
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
  imageUrl?: string | null;
  clinicImage?: File | null;
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
  toCreateFormData(payload: CreateClinicPayload) {
    const formData = new FormData();
    formData.append("name", payload.name);
    if (payload.slug !== undefined) formData.append("slug", payload.slug);
    if (payload.email !== undefined) formData.append("email", payload.email);
    if (payload.phone !== undefined) formData.append("phone", payload.phone);
    if (payload.address !== undefined) formData.append("address", payload.address);
    if (payload.city !== undefined) formData.append("city", payload.city);
    if (payload.country !== undefined) formData.append("country", payload.country);
    if (payload.countryCode !== undefined) formData.append("countryCode", payload.countryCode);
    if (payload.currencyCode !== undefined) formData.append("currencyCode", payload.currencyCode);
    if (payload.timezone !== undefined) formData.append("timezone", payload.timezone);
    if (payload.imageUrl !== undefined) formData.append("imageUrl", payload.imageUrl);
    formData.append("specialtyCodes", JSON.stringify(payload.specialtyCodes));
    formData.append("adminUser", JSON.stringify(payload.adminUser));
    if (payload.clinicImage) {
      formData.append("clinicImage", payload.clinicImage);
    }
    return formData;
  },

  toUpdateFormData(payload: UpdateClinicPayload) {
    const formData = new FormData();
    if (payload.name !== undefined) formData.append("name", payload.name);
    if (payload.slug !== undefined) formData.append("slug", payload.slug);
    if (payload.email !== undefined && payload.email !== null) formData.append("email", payload.email);
    if (payload.phone !== undefined && payload.phone !== null) formData.append("phone", payload.phone);
    if (payload.address !== undefined && payload.address !== null) formData.append("address", payload.address);
    if (payload.city !== undefined && payload.city !== null) formData.append("city", payload.city);
    if (payload.country !== undefined && payload.country !== null) formData.append("country", payload.country);
    if (payload.countryCode !== undefined) formData.append("countryCode", payload.countryCode);
    if (payload.currencyCode !== undefined) formData.append("currencyCode", payload.currencyCode);
    if (payload.timezone !== undefined) formData.append("timezone", payload.timezone);
    if (payload.isActive !== undefined) formData.append("isActive", String(payload.isActive));
    if (payload.imageUrl !== undefined && payload.imageUrl !== null) formData.append("imageUrl", payload.imageUrl);
    if (payload.specialtyCodes !== undefined) formData.append("specialtyCodes", JSON.stringify(payload.specialtyCodes));
    if (payload.applyRetroactiveCurrencyConversion !== undefined) {
      formData.append("applyRetroactiveCurrencyConversion", String(payload.applyRetroactiveCurrencyConversion));
    }
    if (payload.conversionRate !== undefined) formData.append("conversionRate", String(payload.conversionRate));
    if (payload.clinicImage) {
      formData.append("clinicImage", payload.clinicImage);
    }
    return formData;
  },

  async list() {
    const res = await api.get<{ data: ClinicsListResponse }>("/clinics?page=1&pageSize=100");
    return res.data.data.data;
  },

  async create(payload: CreateClinicPayload) {
    const res = await api.post<{ data: ClinicItem }>("/clinics", clinicService.toCreateFormData(payload), {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return res.data.data;
  },

  async update(clinicId: string, payload: UpdateClinicPayload) {
    const res = await api.patch<{ data: ClinicItem }>(`/clinics/${clinicId}`, clinicService.toUpdateFormData(payload), {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
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
