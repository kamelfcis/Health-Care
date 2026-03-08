import { api } from "./api";
import { VisitEntryType } from "./specialty-service";

interface AppointmentPatient {
  id: string;
  fullName: string;
  nationalId?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  profession?: string | null;
  leadSource?: string | null;
  address?: string | null;
  fileNumber?: number | null;
}

interface AppointmentDoctorUser {
  firstName: string;
  lastName: string;
}

interface AppointmentDoctor {
  id: string;
  user?: AppointmentDoctorUser | null;
}

export interface AppointmentListItem {
  id: string;
  startsAt: string;
  endsAt: string;
  entryType: VisitEntryType;
  reason?: string | null;
  notes?: string | null;
  status: string;
  patient?: AppointmentPatient | null;
  doctor?: AppointmentDoctor | null;
}

interface AppointmentListPayload {
  data: AppointmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const appointmentService = {
  async list(clinicId?: string) {
    const res = await api.get<{ data: AppointmentListPayload }>("/appointments", {
      params: { page: 1, pageSize: 500, ...(clinicId ? { clinicId } : {}) }
    });
    return res.data.data.data;
  },

  async create(
    payload: {
      doctorId: string;
      patientId: string;
      startsAt: string;
      endsAt: string;
      entryType: VisitEntryType;
      reason?: string;
      notes?: string;
      status?: "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
    },
    clinicId?: string
  ) {
    const res = await api.post<{ data: AppointmentListItem }>("/appointments", payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async update(
    id: string,
    payload: Partial<{
      doctorId: string;
      patientId: string;
      startsAt: string;
      endsAt: string;
      entryType: VisitEntryType;
      reason: string;
      notes: string;
      status: "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
    }>,
    clinicId?: string
  ) {
    const res = await api.patch<{ data: AppointmentListItem }>(`/appointments/${id}`, payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async remove(id: string, clinicId?: string) {
    const res = await api.delete<{ data: AppointmentListItem }>(`/appointments/${id}`, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  }
};
