import { api } from "./api";

interface DoctorUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}

export interface DoctorListItem {
  id: string;
  clinicId: string;
  specialty: string;
  licenseNumber: string;
  user?: DoctorUser | null;
}

interface DoctorListPayload {
  data: DoctorListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const doctorService = {
  async list(clinicId?: string) {
    const res = await api.get<{ data: DoctorListPayload }>("/doctors", {
      params: { page: 1, pageSize: 500, ...(clinicId ? { clinicId } : {}) }
    });
    return res.data.data.data;
  },

  async getById(id: string, clinicId?: string) {
    const res = await api.get<{ data: DoctorListItem }>(`/doctors/${id}`, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async create(
    payload: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      specialty: string;
      licenseNumber: string;
    },
    clinicId?: string
  ) {
    const res = await api.post<{ data: DoctorListItem }>("/doctors", payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async update(
    id: string,
    payload: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      specialty: string;
      licenseNumber: string;
      isActive: boolean;
    }>,
    clinicId?: string
  ) {
    const res = await api.patch<{ data: DoctorListItem }>(`/doctors/${id}`, payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async remove(id: string, clinicId?: string) {
    const res = await api.delete<{ data: DoctorListItem }>(`/doctors/${id}`, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  }
};
