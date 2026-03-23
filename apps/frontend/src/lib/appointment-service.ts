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
  specialty?: string | null;
  user?: AppointmentDoctorUser | null;
}

interface AppointmentAssessmentSpecialty {
  id: string;
  code: string;
  name: string;
  nameAr: string;
}

export interface AppointmentAssessmentResponse {
  appointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    entryType: VisitEntryType;
    reason?: string | null;
    notes?: string | null;
    patient?: AppointmentPatient | null;
    doctor?: AppointmentDoctor | null;
  };
  specialty: AppointmentAssessmentSpecialty | null;
  template: unknown | null;
  assessment: {
    id: string;
    appointmentId?: string | null;
    values: Record<string, unknown>;
    diagnoses?: Array<Record<string, unknown>> | null;
    alerts?: Array<Record<string, unknown>> | null;
    updatedAt: string;
  } | null;
}

export interface AppointmentListItem {
  id: string;
  startsAt: string;
  endsAt: string;
  entryType: VisitEntryType;
  reason?: string | null;
  notes?: string | null;
  status: string;
  specialty?: {
    id: string;
    code: string;
    name: string;
    nameAr: string;
  } | null;
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

/** Mirrors backend appointment list query params (see appointment.controller list). */
export interface AppointmentListQuery {
  search?: string;
  status?: string;
  entryType?: VisitEntryType | "";
  patientFullName?: string;
  patientPhone?: string;
  patientFileNumber?: string;
  doctorName?: string;
  specialtyCode?: string;
  startsFrom?: string;
  startsTo?: string;
}

const APPOINTMENT_LIST_PAGE_SIZE = 500;

/** Default filters for appointment list (server-side search). */
export function emptyAppointmentListQuery(): AppointmentListQuery {
  return {
    search: "",
    status: "",
    entryType: "",
    patientFullName: "",
    patientPhone: "",
    patientFileNumber: "",
    doctorName: "",
    specialtyCode: "",
    startsFrom: "",
    startsTo: ""
  };
}

function buildAppointmentListParams(clinicId: string | undefined, query: AppointmentListQuery = {}) {
  const params: Record<string, string | number> = {
    page: 1,
    pageSize: APPOINTMENT_LIST_PAGE_SIZE,
    ...(clinicId ? { clinicId } : {})
  };
  const entries: [keyof AppointmentListQuery, string | undefined][] = [
    ["search", query.search],
    ["status", query.status],
    ["entryType", query.entryType ? String(query.entryType) : undefined],
    ["patientFullName", query.patientFullName],
    ["patientPhone", query.patientPhone],
    ["patientFileNumber", query.patientFileNumber],
    ["doctorName", query.doctorName],
    ["specialtyCode", query.specialtyCode],
    ["startsFrom", query.startsFrom],
    ["startsTo", query.startsTo]
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && String(value).trim() !== "") {
      params[key] = String(value).trim();
    }
  }
  return params;
}

export const appointmentService = {
  async list(clinicId?: string, query: AppointmentListQuery = {}) {
    const res = await api.get<{ data: AppointmentListPayload }>("/appointments", {
      params: buildAppointmentListParams(clinicId, query)
    });
    return res.data.data.data;
  },

  async create(
    payload: {
      doctorId: string;
      patientId: string;
      specialtyCode: string;
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
      specialtyCode: string;
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
  },

  async getAssessment(id: string, clinicId?: string) {
    const res = await api.get<{ data: AppointmentAssessmentResponse }>(`/appointments/${id}/assessment`, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  }
};
