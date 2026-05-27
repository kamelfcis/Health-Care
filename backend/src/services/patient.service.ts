import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { LeadSource, Prisma, Profession } from "@prisma/client";
import { syncInvoiceStatusFromPayments } from "./payment.service";

interface ListInput {
  clinicId?: string;
  /** Exact patient id (e.g. global search deep link) */
  patientId?: string;
  page: number;
  pageSize: number;
  search?: string;
  /** AND filter: patient full name contains (quick / explicit search) */
  fullName?: string;
  /** AND filter: match mobile on phone / whatsapp / alternatePhone */
  phone?: string;
  /** AND filter: patient.clinicName contains */
  clinicName?: string;
  leadSource?: LeadSource;
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
  fileNumber?: number;
  requesterRole?: string;
  requesterUserId?: string;
}

const dayStartUtc = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const dayEndUtc = (ymd: string) => new Date(`${ymd}T23:59:59.999Z`);

interface ExamAttachmentInput {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export const patientService = {
  async list(input: ListInput) {
    const insensitive = Prisma.QueryMode.insensitive;
    const normalizedSearch = input.search?.trim();
    const isShortSearch = Boolean(normalizedSearch && normalizedSearch.length <= 3);
    const doctorScope: Prisma.PatientWhereInput =
      input.requesterRole === "Doctor" && input.requesterUserId
        ? {
            appointments: {
              some: {
                deletedAt: null,
                doctor: {
                  userId: input.requesterUserId,
                  deletedAt: null
                }
              }
            }
          }
        : {};

    const andParts: Prisma.PatientWhereInput[] = [
      ...(input.clinicId ? [{ clinicId: input.clinicId }] : []),
      { deletedAt: null },
      ...(Object.keys(doctorScope).length ? [doctorScope] : [])
    ];

    if (input.patientId?.trim()) {
      andParts.push({ id: input.patientId.trim() });
    }

    if (input.leadSource) {
      andParts.push({ leadSource: input.leadSource });
    }
    if (input.specialtyCode?.trim()) {
      andParts.push({ specialtyCode: input.specialtyCode.trim() });
    }
    if (input.specialtyName?.trim()) {
      andParts.push({ specialtyName: { contains: input.specialtyName.trim(), mode: insensitive } });
    }
    if (input.campaignName?.trim()) {
      andParts.push({ campaignName: { contains: input.campaignName.trim(), mode: insensitive } });
    }
    if (input.governorate?.trim()) {
      andParts.push({ governorate: input.governorate.trim() });
    }
    if (input.maritalStatus?.trim()) {
      andParts.push({ maritalStatus: input.maritalStatus.trim() });
    }
    if (input.doctorName?.trim()) {
      andParts.push({ doctorName: { contains: input.doctorName.trim(), mode: insensitive } });
    }
    if (input.fullName?.trim()) {
      andParts.push({ fullName: { contains: input.fullName.trim(), mode: insensitive } });
    }
    if (input.phone?.trim()) {
      const p = input.phone.trim();
      andParts.push({
        OR: [
          { phone: { contains: p, mode: insensitive } },
          { whatsapp: { contains: p, mode: insensitive } },
          { alternatePhone: { contains: p, mode: insensitive } }
        ]
      });
    }
    if (input.clinicName?.trim()) {
      andParts.push({ clinicName: { contains: input.clinicName.trim(), mode: insensitive } });
    }
    if (input.fileNumber !== undefined && Number.isFinite(input.fileNumber)) {
      andParts.push({ fileNumber: input.fileNumber });
    }
    if (input.createdFrom || input.createdTo) {
      andParts.push({
        createdAt: {
          ...(input.createdFrom ? { gte: dayStartUtc(input.createdFrom) } : {}),
          ...(input.createdTo ? { lte: dayEndUtc(input.createdTo) } : {})
        }
      });
    }
    if (input.firstVisitFrom || input.firstVisitTo) {
      andParts.push({
        firstVisitDate: {
          ...(input.firstVisitFrom ? { gte: dayStartUtc(input.firstVisitFrom) } : {}),
          ...(input.firstVisitTo ? { lte: dayEndUtc(input.firstVisitTo) } : {})
        }
      });
    }

    if (normalizedSearch) {
      const searchOr: Prisma.PatientWhereInput[] = [
        ...(isShortSearch
          ? [
              { fullName: { startsWith: normalizedSearch, mode: insensitive } },
              { phone: { startsWith: normalizedSearch, mode: insensitive } }
            ]
          : []),
        { fullName: { contains: normalizedSearch, mode: insensitive } },
        { phone: { contains: normalizedSearch, mode: insensitive } },
        { whatsapp: { contains: normalizedSearch, mode: insensitive } },
        { alternatePhone: { contains: normalizedSearch, mode: insensitive } }
      ];
      if (/^\d+$/.test(normalizedSearch)) {
        const n = parseInt(normalizedSearch, 10);
        if (!Number.isNaN(n)) {
          searchOr.push({ fileNumber: n });
        }
      }
      andParts.push({ OR: searchOr });
    }

    const where: Prisma.PatientWhereInput = { AND: andParts };

    const [items, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          clinic: {
            select: {
              id: true,
              name: true
            }
          },
          appointments: {
            where: {
              deletedAt: null
            },
            orderBy: {
              startsAt: "desc"
            },
            take: 1,
            select: {
              startsAt: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.patient.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  create(
    clinicId: string,
    data: {
      fullName: string;
      nationalId?: string;
      phone: string;
      whatsapp?: string;
      dateOfBirth?: string;
      profession: Profession;
      professionOther?: string;
      leadSource: LeadSource;
      leadSourceOther?: string;
      address?: string;
      alternatePhone?: string;
      email?: string;
      gender?: string;
      genderOther?: string;
      nationality?: string;
      nationalityOther?: string;
      country?: string;
      countryOther?: string;
      governorate?: string;
      governorateOther?: string;
      city?: string;
      cityOther?: string;
      maritalStatus?: string;
      maritalStatusOther?: string;
      occupation?: string;
      branch?: string;
      specialtyCode?: string;
      specialtyName?: string;
      clinicName?: string;
      doctorName?: string;
      campaignName?: string;
      referrerName?: string;
      referralType?: string;
      referralTypeOther?: string;
      generalNotes?: string;
    }
  ) {
    if (data.nationalId && !/^\d{14}$/.test(data.nationalId.trim())) {
      throw new AppError("nationalId must be exactly 14 digits", 400);
    }
    if (data.profession === "OTHER" && !data.professionOther?.trim()) {
      throw new AppError("professionOther is required when profession is OTHER", 400);
    }
    if (data.leadSource === "OTHER" && !data.leadSourceOther?.trim()) {
      throw new AppError("leadSourceOther is required when leadSource is OTHER", 400);
    }
    if (data.gender === "OTHER" && !data.genderOther?.trim()) {
      throw new AppError("genderOther is required when gender is OTHER", 400);
    }
    if (data.nationality === "OTHER" && !data.nationalityOther?.trim()) {
      throw new AppError("nationalityOther is required when nationality is OTHER", 400);
    }
    if (data.country === "OTHER" && !data.countryOther?.trim()) {
      throw new AppError("countryOther is required when country is OTHER", 400);
    }
    if (data.governorate === "OTHER" && !data.governorateOther?.trim()) {
      throw new AppError("governorateOther is required when governorate is OTHER", 400);
    }
    if (data.city === "OTHER" && !data.cityOther?.trim()) {
      throw new AppError("cityOther is required when city is OTHER", 400);
    }
    if (data.maritalStatus === "OTHER" && !data.maritalStatusOther?.trim()) {
      throw new AppError("maritalStatusOther is required when maritalStatus is OTHER", 400);
    }
    if (data.referralType === "OTHER" && !data.referralTypeOther?.trim()) {
      throw new AppError("referralTypeOther is required when referralType is OTHER", 400);
    }

    return prisma.$transaction(async (tx) => {
      const maxAgg = await tx.patient.aggregate({
        where: { clinicId, deletedAt: null },
        _max: { fileNumber: true }
      });
      const maxFromPatients = maxAgg._max.fileNumber ?? 0;
      const counterRow = await tx.clinicCounter.findUnique({
        where: { clinicId },
        select: { lastPatientFileNumber: true }
      });
      const counterVal = counterRow?.lastPatientFileNumber ?? 0;
      const nextFileNumber = Math.max(maxFromPatients, counterVal) + 1;

      await tx.clinicCounter.upsert({
        where: { clinicId },
        create: { clinicId, lastPatientFileNumber: nextFileNumber },
        update: { lastPatientFileNumber: nextFileNumber }
      });

      return tx.patient.create({
        data: {
          clinicId,
          fullName: data.fullName,
          nationalId: data.nationalId?.trim() || null,
          phone: data.phone,
          whatsapp: data.whatsapp || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          profession: data.profession,
          professionOther: data.profession === "OTHER" ? data.professionOther?.trim() ?? null : null,
          leadSource: data.leadSource,
          leadSourceOther: data.leadSource === "OTHER" ? data.leadSourceOther?.trim() ?? null : null,
          alternatePhone: data.alternatePhone?.trim() || null,
          email: data.email?.trim() || null,
          gender: data.gender?.trim() || null,
          genderOther: data.gender === "OTHER" ? data.genderOther?.trim() ?? null : null,
          nationality: data.nationality?.trim() || null,
          nationalityOther: data.nationality === "OTHER" ? data.nationalityOther?.trim() ?? null : null,
          country: data.country?.trim() || null,
          countryOther: data.country === "OTHER" ? data.countryOther?.trim() ?? null : null,
          governorate: data.governorate?.trim() || null,
          governorateOther: data.governorate === "OTHER" ? data.governorateOther?.trim() ?? null : null,
          city: data.city?.trim() || null,
          cityOther: data.city === "OTHER" ? data.cityOther?.trim() ?? null : null,
          maritalStatus: data.maritalStatus?.trim() || null,
          maritalStatusOther: data.maritalStatus === "OTHER" ? data.maritalStatusOther?.trim() ?? null : null,
          occupation: data.occupation?.trim() || null,
          branch: data.branch?.trim() || null,
          specialtyCode: data.specialtyCode?.trim() || null,
          specialtyName: data.specialtyName?.trim() || null,
          clinicName: data.clinicName?.trim() || null,
          doctorName: data.doctorName?.trim() || null,
          campaignName: data.campaignName?.trim() || null,
          referrerName: data.referrerName?.trim() || null,
          referralType: data.referralType?.trim() || null,
          referralTypeOther: data.referralType === "OTHER" ? data.referralTypeOther?.trim() ?? null : null,
          generalNotes: data.generalNotes?.trim() || null,
          address: data.address || null,
          fileNumber: nextFileNumber
        }
      });
    });
  },

  async update(id: string, clinicId: string | undefined, data: Record<string, unknown>) {
    const nullableStringFields = [
      "whatsapp",
      "alternatePhone",
      "email",
      "gender",
      "genderOther",
      "nationality",
      "nationalityOther",
      "country",
      "countryOther",
      "governorate",
      "governorateOther",
      "city",
      "cityOther",
      "maritalStatus",
      "maritalStatusOther",
      "professionOther",
      "occupation",
      "leadSourceOther",
      "branch",
      "specialtyCode",
      "specialtyName",
      "clinicName",
      "doctorName",
      "campaignName",
      "referrerName",
      "referralType",
      "referralTypeOther",
      "generalNotes",
      "address"
    ] as const;
    nullableStringFields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(data, field)) return;
      const value = data[field];
      data[field] = typeof value === "string" ? value.trim() || null : value ?? null;
    });
    if (Object.prototype.hasOwnProperty.call(data, "nationalId")) {
      const nationalId = data.nationalId;
      if (typeof nationalId === "string" && nationalId.trim()) {
        const normalizedNationalId = nationalId.trim();
        if (!/^\d{14}$/.test(normalizedNationalId)) {
          throw new AppError("nationalId must be exactly 14 digits", 400);
        }
        data.nationalId = normalizedNationalId;
      } else {
        data.nationalId = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(data, "dateOfBirth")) {
      const dateOfBirth = data.dateOfBirth;
      data.dateOfBirth =
        typeof dateOfBirth === "string" && dateOfBirth.trim()
          ? new Date(dateOfBirth)
          : null;
    }
    if (data.profession === "OTHER" && !String(data.professionOther ?? "").trim()) {
      throw new AppError("professionOther is required when profession is OTHER", 400);
    }
    if (data.leadSource === "OTHER" && !String(data.leadSourceOther ?? "").trim()) {
      throw new AppError("leadSourceOther is required when leadSource is OTHER", 400);
    }
    if (data.gender === "OTHER" && !String(data.genderOther ?? "").trim()) {
      throw new AppError("genderOther is required when gender is OTHER", 400);
    }
    if (data.nationality === "OTHER" && !String(data.nationalityOther ?? "").trim()) {
      throw new AppError("nationalityOther is required when nationality is OTHER", 400);
    }
    if (data.country === "OTHER" && !String(data.countryOther ?? "").trim()) {
      throw new AppError("countryOther is required when country is OTHER", 400);
    }
    if (data.governorate === "OTHER" && !String(data.governorateOther ?? "").trim()) {
      throw new AppError("governorateOther is required when governorate is OTHER", 400);
    }
    if (data.city === "OTHER" && !String(data.cityOther ?? "").trim()) {
      throw new AppError("cityOther is required when city is OTHER", 400);
    }
    if (data.maritalStatus === "OTHER" && !String(data.maritalStatusOther ?? "").trim()) {
      throw new AppError("maritalStatusOther is required when maritalStatus is OTHER", 400);
    }
    if (data.referralType === "OTHER" && !String(data.referralTypeOther ?? "").trim()) {
      throw new AppError("referralTypeOther is required when referralType is OTHER", 400);
    }
    if (data.profession && data.profession !== "OTHER") {
      data.professionOther = null;
    }
    if (data.leadSource && data.leadSource !== "OTHER") {
      data.leadSourceOther = null;
    }
    if (data.gender && data.gender !== "OTHER") {
      data.genderOther = null;
    }
    if (data.nationality && data.nationality !== "OTHER") {
      data.nationalityOther = null;
    }
    if (data.country && data.country !== "OTHER") {
      data.countryOther = null;
    }
    if (data.governorate && data.governorate !== "OTHER") {
      data.governorateOther = null;
    }
    if (data.city && data.city !== "OTHER") {
      data.cityOther = null;
    }
    if (data.maritalStatus && data.maritalStatus !== "OTHER") {
      data.maritalStatusOther = null;
    }
    if (data.referralType && data.referralType !== "OTHER") {
      data.referralTypeOther = null;
    }
    const result = await prisma.patient.updateMany({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      data
    });
    if (!result.count) {
      throw new AppError("Patient not found", 404);
    }
    return result;
  },

  async remove(id: string, clinicId: string | undefined) {
    const result = await prisma.patient.updateMany({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      data: { deletedAt: new Date() }
    });
    if (!result.count) {
      throw new AppError("Patient not found", 404);
    }
    return result;
  },

  async stats(clinicId?: string) {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalPatients, newThisMonth, withContactInfo, withoutContactInfo] = await Promise.all([
      prisma.patient.count({
        where: { ...(clinicId ? { clinicId } : {}), deletedAt: null }
      }),
      prisma.patient.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          deletedAt: null,
          createdAt: { gte: last30Days }
        }
      }),
      prisma.patient.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          deletedAt: null,
          OR: [{ phone: { not: "" } }, { whatsapp: { not: null } }]
        }
      }),
      prisma.patient.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          deletedAt: null,
          phone: "",
          whatsapp: null
        }
      })
    ]);

    return {
      totalPatients,
      newThisMonth,
      withContactInfo,
      withoutContactInfo
    };
  },

  async listExams(
    patientId: string,
    clinicId: string | undefined,
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      select: { id: true, clinicId: true, fullName: true }
    });
    if (!patient) {
      throw new AppError("Patient not found", 404);
    }

    if (requesterRole === "Doctor" && requesterUserId) {
      const linked = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          clinicId: patient.clinicId,
          deletedAt: null,
          doctor: {
            userId: requesterUserId,
            deletedAt: null
          }
        },
        select: { id: true }
      });
      if (!linked) {
        throw new AppError("You are not allowed to access this patient's exams", 403);
      }
    }

    const exams = await prisma.patientExam.findMany({
      where: { patientId: patient.id, clinicId: patient.clinicId, deletedAt: null },
      include: {
        attachments: {
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ examDate: "desc" }, { createdAt: "desc" }]
    });

    return { patient, exams };
  },

  async createExam(
    patientId: string,
    clinicId: string | undefined,
    payload: { name: string; examDate: string },
    attachments: ExamAttachmentInput[],
    requesterRole?: string,
    requesterUserId?: string
  ) {
    if (!attachments.length) {
      throw new AppError("At least one attachment is required", 400);
    }
    const normalizedName = payload.name?.trim();
    if (!normalizedName) {
      throw new AppError("Exam name is required", 400);
    }
    const examDate = new Date(payload.examDate);
    if (Number.isNaN(examDate.getTime())) {
      throw new AppError("Invalid exam date", 400);
    }

    const scope = await this.listExams(patientId, clinicId, requesterRole, requesterUserId);
    const created = await prisma.patientExam.create({
      data: {
        patientId: scope.patient.id,
        clinicId: scope.patient.clinicId,
        name: normalizedName,
        examDate,
        attachments: {
          create: attachments.map((attachment) => ({
            ...attachment,
            clinic: {
              connect: { id: scope.patient.clinicId }
            }
          }))
        }
      },
      include: {
        attachments: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    return created;
  },

  async updateExam(
    patientId: string,
    examId: string,
    clinicId: string | undefined,
    payload: { name?: string; examDate?: string },
    attachments: ExamAttachmentInput[],
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const scope = await this.listExams(patientId, clinicId, requesterRole, requesterUserId);
    const exam = await prisma.patientExam.findFirst({
      where: {
        id: examId,
        patientId: scope.patient.id,
        clinicId: scope.patient.clinicId,
        deletedAt: null
      },
      select: { id: true }
    });
    if (!exam) {
      throw new AppError("Exam not found", 404);
    }

    const nextData: { name?: string; examDate?: Date } = {};
    if (typeof payload.name === "string") {
      const normalizedName = payload.name.trim();
      if (!normalizedName) {
        throw new AppError("Exam name is required", 400);
      }
      nextData.name = normalizedName;
    }
    if (typeof payload.examDate === "string") {
      const examDate = new Date(payload.examDate);
      if (Number.isNaN(examDate.getTime())) {
        throw new AppError("Invalid exam date", 400);
      }
      nextData.examDate = examDate;
    }

    const updated = await prisma.patientExam.update({
      where: { id: exam.id },
      data: {
        ...nextData,
        ...(attachments.length
          ? {
              attachments: {
                create: attachments.map((attachment) => ({
                  ...attachment,
                  clinic: {
                    connect: { id: scope.patient.clinicId }
                  }
                }))
              }
            }
          : {})
      },
      include: {
        attachments: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    return updated;
  },

  async removeExam(
    patientId: string,
    examId: string,
    clinicId: string | undefined,
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const scope = await this.listExams(patientId, clinicId, requesterRole, requesterUserId);
    const result = await prisma.patientExam.updateMany({
      where: {
        id: examId,
        patientId: scope.patient.id,
        clinicId: scope.patient.clinicId,
        deletedAt: null
      },
      data: { deletedAt: new Date() }
    });
    if (!result.count) {
      throw new AppError("Exam not found", 404);
    }
    return result;
  },

  async removeExamAttachment(
    patientId: string,
    examId: string,
    attachmentId: string,
    clinicId: string | undefined,
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const scope = await this.listExams(patientId, clinicId, requesterRole, requesterUserId);
    const exam = await prisma.patientExam.findFirst({
      where: {
        id: examId,
        patientId: scope.patient.id,
        clinicId: scope.patient.clinicId,
        deletedAt: null
      },
      select: { id: true }
    });
    if (!exam) {
      throw new AppError("Exam not found", 404);
    }

    const result = await prisma.patientExamAttachment.deleteMany({
      where: {
        id: attachmentId,
        examId: exam.id,
        clinicId: scope.patient.clinicId
      }
    });
    if (!result.count) {
      throw new AppError("Attachment not found", 404);
    }
    return result;
  },

  async listAssessments(
    patientId: string,
    clinicId: string | undefined,
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      select: { id: true, clinicId: true, fullName: true }
    });
    if (!patient) {
      throw new AppError("Patient not found", 404);
    }

    if (requesterRole === "Doctor" && requesterUserId) {
      const linked = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          clinicId: patient.clinicId,
          deletedAt: null,
          doctor: {
            userId: requesterUserId,
            deletedAt: null
          }
        },
        select: { id: true }
      });
      if (!linked) {
        throw new AppError("You are not allowed to access this patient's assessments", 403);
      }
    }

    const assessments = await prisma.patientSpecialtyAssessment.findMany({
      where: { patientId: patient.id, clinicId: patient.clinicId },
      include: {
        specialty: true,
        appointment: {
          include: {
            doctor: {
              include: {
                user: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    const appointmentAssessments = assessments
      .filter((item) => item.appointmentId && item.appointment)
      .map((item) => ({
        id: item.id,
        source: "appointment" as const,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        entryType: item.entryType,
        appointment: {
          id: item.appointment!.id,
          startsAt: item.appointment!.startsAt,
          endsAt: item.appointment!.endsAt,
          status: item.appointment!.status,
          reason: item.appointment!.reason,
          notes: item.appointment!.notes,
          doctor: {
            id: item.appointment!.doctor.id,
            name: `${item.appointment!.doctor.user.firstName} ${item.appointment!.doctor.user.lastName}`.trim(),
            specialty: item.appointment!.doctor.specialty
          }
        },
        specialty: {
          id: item.specialty.id,
          code: item.specialty.code,
          name: item.specialty.name,
          nameAr: item.specialty.nameAr
        },
        values: item.values,
        diagnoses: item.diagnoses,
        alerts: item.alerts
      }));

    const legacyAssessments = assessments
      .filter((item) => !item.appointmentId)
      .map((item) => ({
        id: item.id,
        source: "legacy" as const,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        entryType: item.entryType,
        appointment: null,
        specialty: {
          id: item.specialty.id,
          code: item.specialty.code,
          name: item.specialty.name,
          nameAr: item.specialty.nameAr
        },
        values: item.values,
        diagnoses: item.diagnoses,
        alerts: item.alerts
      }));

    return {
      patient,
      assessments: [...appointmentAssessments, ...legacyAssessments]
    };
  },

  async listProcedures(
    patientId: string,
    clinicId: string | undefined,
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...(clinicId ? { clinicId } : {}), deletedAt: null },
      select: { id: true, clinicId: true, fullName: true }
    });
    if (!patient) {
      throw new AppError("Patient not found", 404);
    }

    if (requesterRole === "Doctor" && requesterUserId) {
      const linked = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          clinicId: patient.clinicId,
          deletedAt: null,
          doctor: {
            userId: requesterUserId,
            deletedAt: null
          }
        },
        select: { id: true }
      });
      if (!linked) {
        throw new AppError("You are not allowed to access this patient's procedures", 403);
      }
    }

    const procedures = await prisma.patientProcedure.findMany({
      where: { patientId: patient.id, clinicId: patient.clinicId, deletedAt: null },
      include: {
        catalog: { select: { id: true, name: true, procedureType: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, amount: true } }
      },
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }]
    });

    return { patient, procedures };
  },

  async createProcedure(
    patientId: string,
    clinicId: string | undefined,
    payload: {
      catalogId: string;
      name?: string;
      procedureType?: string;
      amount?: number;
      notes?: string;
      performedAt?: string;
    },
    createdById?: string,
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const scope = await this.listProcedures(patientId, clinicId, requesterRole, requesterUserId);
    const catalog = await prisma.procedureCatalog.findFirst({
      where: {
        id: payload.catalogId,
        clinicId: scope.patient.clinicId,
        deletedAt: null,
        isActive: true
      }
    });
    if (!catalog) {
      throw new AppError("Procedure catalog item not found or inactive", 404);
    }

    const name = (payload.name ?? catalog.name).trim();
    const procedureType = (payload.procedureType ?? catalog.procedureType).trim();
    if (!name) {
      throw new AppError("Procedure name is required", 400);
    }
    if (!procedureType) {
      throw new AppError("Procedure type is required", 400);
    }

    const amount =
      payload.amount !== undefined && payload.amount !== null
        ? Number(payload.amount)
        : catalog.defaultAmount !== null && catalog.defaultAmount !== undefined
          ? Number(catalog.defaultAmount)
          : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("A valid positive amount is required", 400);
    }

    let performedAt = new Date();
    if (payload.performedAt) {
      performedAt = new Date(payload.performedAt);
      if (Number.isNaN(performedAt.getTime())) {
        throw new AppError("Invalid performed date", 400);
      }
    }

    const userNotes = payload.notes?.trim() || "";
    const invoiceNotes = [`Procedure: ${name}`, `Type: ${procedureType}`, userNotes].filter(Boolean).join("\n");

    const created = await prisma.$transaction(async (tx) => {
      const counter = await tx.clinicCounter.upsert({
        where: { clinicId: scope.patient.clinicId },
        create: { clinicId: scope.patient.clinicId, lastPatientFileNumber: 0, lastInvoiceSequence: 1 },
        update: { lastInvoiceSequence: { increment: 1 } }
      });
      const invoiceNumber = `INV-${String(counter.lastInvoiceSequence).padStart(5, "0")}`;

      const invoice = await tx.invoice.create({
        data: {
          clinicId: scope.patient.clinicId,
          patientId: scope.patient.id,
          invoiceNumber,
          amount,
          taxAmount: 0,
          discount: 0,
          status: "PENDING",
          invoiceType: "PROCEDURE",
          notes: invoiceNotes
        }
      });

      const procedure = await tx.patientProcedure.create({
        data: {
          patientId: scope.patient.id,
          clinicId: scope.patient.clinicId,
          catalogId: catalog.id,
          name,
          procedureType,
          amount,
          notes: userNotes || null,
          performedAt,
          invoiceId: invoice.id,
          createdById: createdById ?? null
        },
        include: {
          catalog: { select: { id: true, name: true, procedureType: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true, amount: true } }
        }
      });

      return procedure;
    });

    if (created.invoiceId) {
      await syncInvoiceStatusFromPayments(created.invoiceId);
    }

    return created;
  },

  async updateProcedure(
    patientId: string,
    procedureId: string,
    clinicId: string | undefined,
    payload: {
      name?: string;
      procedureType?: string;
      amount?: number;
      notes?: string;
      performedAt?: string;
    },
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const scope = await this.listProcedures(patientId, clinicId, requesterRole, requesterUserId);
    const existing = await prisma.patientProcedure.findFirst({
      where: {
        id: procedureId,
        patientId: scope.patient.id,
        clinicId: scope.patient.clinicId,
        deletedAt: null
      },
      include: {
        invoice: { select: { id: true, status: true } }
      }
    });
    if (!existing) {
      throw new AppError("Patient procedure not found", 404);
    }

    const nextData: {
      name?: string;
      procedureType?: string;
      amount?: number;
      notes?: string | null;
      performedAt?: Date;
    } = {};

    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) throw new AppError("Procedure name is required", 400);
      nextData.name = name;
    }
    if (payload.procedureType !== undefined) {
      const procedureType = payload.procedureType.trim();
      if (!procedureType) throw new AppError("Procedure type is required", 400);
      nextData.procedureType = procedureType;
    }
    if (payload.amount !== undefined) {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError("A valid positive amount is required", 400);
      }
      nextData.amount = amount;
    }
    if (payload.notes !== undefined) {
      nextData.notes = payload.notes.trim() || null;
    }
    if (payload.performedAt !== undefined) {
      const performedAt = new Date(payload.performedAt);
      if (Number.isNaN(performedAt.getTime())) {
        throw new AppError("Invalid performed date", 400);
      }
      nextData.performedAt = performedAt;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const procedure = await tx.patientProcedure.update({
        where: { id: existing.id },
        data: nextData,
        include: {
          catalog: { select: { id: true, name: true, procedureType: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true, amount: true } }
        }
      });

      if (
        existing.invoiceId &&
        existing.invoice?.status === "PENDING" &&
        nextData.amount !== undefined
      ) {
        await tx.invoice.update({
          where: { id: existing.invoiceId },
          data: { amount: nextData.amount }
        });
        procedure.invoice =
          (await tx.invoice.findFirst({
            where: { id: existing.invoiceId },
            select: { id: true, invoiceNumber: true, status: true, amount: true }
          })) ?? procedure.invoice;
      }

      return procedure;
    });

    return updated;
  },

  async removeProcedure(
    patientId: string,
    procedureId: string,
    clinicId: string | undefined,
    requesterRole?: string,
    requesterUserId?: string
  ) {
    const scope = await this.listProcedures(patientId, clinicId, requesterRole, requesterUserId);
    const result = await prisma.patientProcedure.updateMany({
      where: {
        id: procedureId,
        patientId: scope.patient.id,
        clinicId: scope.patient.clinicId,
        deletedAt: null
      },
      data: { deletedAt: new Date() }
    });
    if (!result.count) {
      throw new AppError("Patient procedure not found", 404);
    }
    return result;
  }
};
