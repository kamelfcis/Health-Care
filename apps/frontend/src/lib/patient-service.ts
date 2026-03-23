import { api } from "./api";

export interface PatientListItem {
  id: string;
  fullName: string;
  nationalId?: string | null;
  phone: string;
  whatsapp?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  gender?: string | null;
  genderOther?: string | null;
  nationality?: string | null;
  nationalityOther?: string | null;
  country?: string | null;
  countryOther?: string | null;
  governorate?: string | null;
  governorateOther?: string | null;
  city?: string | null;
  cityOther?: string | null;
  maritalStatus?: string | null;
  maritalStatusOther?: string | null;
  profession: "ADMIN_EMPLOYEE" | "FREELANCER" | "DRIVER" | "ENGINEER" | "FACTORY_WORKER" | "OTHER";
  professionOther?: string | null;
  occupation?: string | null;
  leadSource: "FACEBOOK_AD" | "GOOGLE_SEARCH" | "DOCTOR_REFERRAL" | "FRIEND" | "OTHER";
  leadSourceOther?: string | null;
  branch?: string | null;
  specialtyCode?: string | null;
  specialtyName?: string | null;
  clinicName?: string | null;
  doctorName?: string | null;
  campaignName?: string | null;
  referrerName?: string | null;
  referralType?: string | null;
  referralTypeOther?: string | null;
  generalNotes?: string | null;
  address?: string | null;
  clinic?: {
    id?: string;
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
  alternatePhone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  genderOther?: string;
  nationality?: string;
  nationalityOther?: string;
  country?: string;
  countryOther?: string;
  governorate?: string;
  governorateOther?: string;
  city?: string;
  cityOther?: string;
  maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | "OTHER";
  maritalStatusOther?: string;
  profession: "ADMIN_EMPLOYEE" | "FREELANCER" | "DRIVER" | "ENGINEER" | "FACTORY_WORKER" | "OTHER";
  professionOther?: string;
  occupation?: string;
  leadSource: "FACEBOOK_AD" | "GOOGLE_SEARCH" | "DOCTOR_REFERRAL" | "FRIEND" | "OTHER";
  leadSourceOther?: string;
  branch?: string;
  specialtyCode?: string;
  specialtyName?: string;
  clinicName?: string;
  doctorName?: string;
  campaignName?: string;
  referrerName?: string;
  referralType?: "DOCTOR" | "FRIEND" | "CAMPAIGN" | "SOCIAL_MEDIA" | "SEARCH" | "OTHER";
  referralTypeOther?: string;
  generalNotes?: string;
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

export interface PatientExamAttachmentItem {
  id: string;
  examId: string;
  clinicId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface PatientExamItem {
  id: string;
  patientId: string;
  clinicId: string;
  name: string;
  examDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  attachments: PatientExamAttachmentItem[];
}

export interface PatientExamsResponse {
  patient: {
    id: string;
    clinicId: string;
    fullName: string;
  };
  exams: PatientExamItem[];
}

export interface PatientListQuery {
  /** Legacy combined search (OR on name/phones/file#); prefer fullName + phone + fileNumber for quick search */
  search?: string;
  /** Quick / explicit: exact file number */
  fileNumber?: string;
  /** Quick / explicit: full name contains */
  fullName?: string;
  /** Quick / explicit: mobile contains (phone / whatsapp / alternate) */
  phone?: string;
  /** Advanced: patient clinic name (free text on record) contains */
  clinicName?: string;
  leadSource?: string;
  specialtyCode?: string;
  specialtyName?: string;
  campaignName?: string;
  governorate?: string;
  maritalStatus?: string;
  doctorName?: string;
  createdFrom?: string;
  createdTo?: string;
  firstVisitFrom?: string;
  firstVisitTo?: string;
}

const buildPatientListParams = (clinicId: string | undefined, query: PatientListQuery) => {
  const params: Record<string, string | number> = { page: 1, pageSize: 500 };
  if (clinicId) params.clinicId = clinicId;
  const entries: [keyof PatientListQuery, string | undefined][] = [
    ["search", query.search],
    ["fullName", query.fullName],
    ["phone", query.phone],
    ["clinicName", query.clinicName],
    ["leadSource", query.leadSource],
    ["specialtyCode", query.specialtyCode],
    ["specialtyName", query.specialtyName],
    ["campaignName", query.campaignName],
    ["governorate", query.governorate],
    ["maritalStatus", query.maritalStatus],
    ["doctorName", query.doctorName],
    ["createdFrom", query.createdFrom],
    ["createdTo", query.createdTo],
    ["firstVisitFrom", query.firstVisitFrom],
    ["firstVisitTo", query.firstVisitTo],
    ["fileNumber", query.fileNumber]
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && String(value).trim() !== "") {
      params[key] = String(value).trim();
    }
  }
  return params;
};

export const patientService = {
  async list(clinicId?: string, query: PatientListQuery = {}) {
    const res = await api.get<{ data: PatientListPayload }>("/patients", {
      params: buildPatientListParams(clinicId, query)
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
  },

  async listExams(id: string, clinicId?: string) {
    const res = await api.get<{ data: PatientExamsResponse }>(`/patients/${id}/exams`, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async createExam(
    patientId: string,
    payload: { name: string; examDate: string; attachments: File[] },
    clinicId?: string
  ) {
    const formData = new FormData();
    formData.append("name", payload.name);
    formData.append("examDate", payload.examDate);
    for (const file of payload.attachments) {
      formData.append("attachments", file);
    }
    const res = await api.post<{ data: PatientExamItem }>(`/patients/${patientId}/exams`, formData, {
      params: clinicId ? { clinicId } : undefined,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data.data;
  },

  async updateExam(
    patientId: string,
    examId: string,
    payload: { name?: string; examDate?: string; attachments?: File[] },
    clinicId?: string
  ) {
    const formData = new FormData();
    if (payload.name !== undefined) formData.append("name", payload.name);
    if (payload.examDate !== undefined) formData.append("examDate", payload.examDate);
    for (const file of payload.attachments ?? []) {
      formData.append("attachments", file);
    }
    const res = await api.patch<{ data: PatientExamItem }>(`/patients/${patientId}/exams/${examId}`, formData, {
      params: clinicId ? { clinicId } : undefined,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data.data;
  },

  async removeExam(patientId: string, examId: string, clinicId?: string) {
    await api.delete(`/patients/${patientId}/exams/${examId}`, {
      params: clinicId ? { clinicId } : undefined
    });
  },

  async removeExamAttachment(patientId: string, examId: string, attachmentId: string, clinicId?: string) {
    await api.delete(`/patients/${patientId}/exams/${examId}/attachments/${attachmentId}`, {
      params: clinicId ? { clinicId } : undefined
    });
  }
};
