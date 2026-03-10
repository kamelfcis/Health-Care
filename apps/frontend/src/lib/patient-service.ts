import { api } from "./api";

export interface PatientListItem {
  id: string;
  fullName: string;
  nationalId?: string | null;
  phone: string;
  whatsapp?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  profession: "ADMIN_EMPLOYEE" | "FREELANCER" | "DRIVER" | "ENGINEER" | "FACTORY_WORKER" | "OTHER";
  professionOther?: string | null;
  leadSource: "FACEBOOK_AD" | "GOOGLE_SEARCH" | "DOCTOR_REFERRAL" | "FRIEND" | "OTHER";
  leadSourceOther?: string | null;
  address?: string | null;
  clinic?: {
    name: string;
  };
  lastVisitAt?: string | null;
  fileNumber: number;
  createdAt: string;
}

interface PatientListPayload {
  data: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PatientPayload {
  fullName: string;
  nationalId?: string;
  phone: string;
  whatsapp?: string;
  dateOfBirth?: string;
  profession: "ADMIN_EMPLOYEE" | "FREELANCER" | "DRIVER" | "ENGINEER" | "FACTORY_WORKER" | "OTHER";
  professionOther?: string;
  leadSource: "FACEBOOK_AD" | "GOOGLE_SEARCH" | "DOCTOR_REFERRAL" | "FRIEND" | "OTHER";
  leadSourceOther?: string;
  address?: string;
}

export interface PatientStats {
  totalPatients: number;
  newThisMonth: number;
  withContactInfo: number;
  withoutContactInfo: number;
}

export interface PatientAssessmentHistoryItem {
  id: string;
  source: "appointment" | "legacy";
  createdAt: string;
  updatedAt: string;
  entryType: "EXAM" | "CONSULTATION";
  appointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    reason?: string | null;
    notes?: string | null;
    doctor: {
      id: string;
      name: string;
      specialty: string;
    };
  } | null;
  specialty: {
    id: string;
    code: string;
    name: string;
    nameAr: string;
  };
  values: Record<string, unknown>;
  diagnoses?: Array<Record<string, unknown>> | null;
  alerts?: Array<Record<string, unknown>> | null;
}

export interface PatientAssessmentsResponse {
  patient: {
    id: string;
    clinicId: string;
    fullName: string;
  };
  assessments: PatientAssessmentHistoryItem[];
}

export const patientService = {
  async list(clinicId?: string) {
    const res = await api.get<{ data: PatientListPayload }>("/patients", {
      params: { page: 1, pageSize: 500, ...(clinicId ? { clinicId } : {}) }
    });
    return res.data.data.data;
  },

  async stats(clinicId?: string) {
    const res = await api.get<{ data: PatientStats }>("/patients/stats", {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async create(payload: PatientPayload) {
    const res = await api.post("/patients", payload);
    return res.data.data as PatientListItem;
  },

  async update(id: string, payload: PatientPayload) {
    await api.patch(`/patients/${id}`, payload);
  },

  async remove(id: string) {
    await api.delete(`/patients/${id}`);
  },

  async listAssessments(id: string, clinicId?: string) {
    const res = await api.get<{ data: PatientAssessmentsResponse }>(`/patients/${id}/assessments`, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  }
};
