import { AppointmentStatus, Prisma, VisitEntryType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

export interface AppointmentListInput {
  clinicId?: string;
  doctorUserId?: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: AppointmentStatus;
  entryType?: VisitEntryType;
  patientFullName?: string;
  patientPhone?: string;
  patientFileNumber?: number;
  doctorName?: string;
  specialtyCode?: string;
  startsFrom?: Date;
  startsTo?: Date;
}

function buildAppointmentListWhere(input: AppointmentListInput): Prisma.AppointmentWhereInput {
  const and: Prisma.AppointmentWhereInput[] = [{ deletedAt: null }];

  if (input.clinicId) {
    and.push({ clinicId: input.clinicId });
  }

  if (input.status) {
    and.push({ status: input.status });
  }

  if (input.entryType) {
    and.push({ entryType: input.entryType });
  }

  const doctorIs: Prisma.DoctorWhereInput = { deletedAt: null };
  if (input.doctorUserId) {
    doctorIs.userId = input.doctorUserId;
  }
  if (input.doctorName?.trim()) {
    const q = input.doctorName.trim();
    doctorIs.user = {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } }
      ]
    };
  }
  if (input.doctorUserId || input.doctorName?.trim()) {
    and.push({ doctor: { is: doctorIs } });
  }

  if (input.patientFullName?.trim()) {
    and.push({
      patient: {
        is: { fullName: { contains: input.patientFullName.trim(), mode: "insensitive" } }
      }
    });
  }

  if (input.patientPhone?.trim()) {
    const q = input.patientPhone.trim();
    and.push({
      patient: {
        is: {
          OR: [
            { phone: { contains: q, mode: "insensitive" } },
            { whatsapp: { contains: q, mode: "insensitive" } },
            { alternatePhone: { contains: q, mode: "insensitive" } }
          ]
        }
      }
    });
  }

  if (input.patientFileNumber !== undefined && Number.isFinite(input.patientFileNumber)) {
    and.push({
      patient: { is: { fileNumber: input.patientFileNumber } }
    });
  }

  if (input.specialtyCode?.trim()) {
    and.push({
      specialty: {
        is: {
          code: input.specialtyCode.trim().toUpperCase(),
          deletedAt: null
        }
      }
    });
  }

  if (input.startsFrom || input.startsTo) {
    and.push({
      startsAt: {
        ...(input.startsFrom ? { gte: input.startsFrom } : {}),
        ...(input.startsTo ? { lte: input.startsTo } : {})
      }
    });
  }

  if (input.search?.trim()) {
    const s = input.search.trim();
    and.push({
      OR: [
        { reason: { contains: s, mode: "insensitive" } },
        { patient: { is: { fullName: { contains: s, mode: "insensitive" } } } }
      ]
    });
  }

  return { AND: and };
}

export const appointmentService = {
  async list(input: AppointmentListInput) {
    const where = buildAppointmentListWhere(input);

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: true,
          specialty: true,
          doctor: { include: { user: true } }
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { startsAt: "asc" }
      }),
      prisma.appointment.count({ where })
    ]);
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async create(
    clinicId: string,
    data: {
      doctorId: string;
      patientId: string;
      specialtyCode: string;
      startsAt: string;
      endsAt: string;
      entryType?: VisitEntryType;
      reason?: string;
      notes?: string;
      status?: AppointmentStatus;
    }
  ) {
    const [doctor, patient, specialty] = await Promise.all([
      prisma.doctor.findFirst({
        where: { id: data.doctorId, clinicId, deletedAt: null },
        select: { id: true }
      }),
      prisma.patient.findFirst({
        where: { id: data.patientId, clinicId, deletedAt: null },
        select: { id: true }
      }),
      prisma.specialtyCatalog.findFirst({
        where: { code: data.specialtyCode.trim().toUpperCase(), deletedAt: null, isActive: true },
        select: { id: true }
      })
    ]);
    if (!doctor) {
      throw new AppError("Doctor not found in this clinic", 404);
    }
    if (!patient) {
      throw new AppError("Patient not found in this clinic", 404);
    }
    if (!specialty) {
      throw new AppError("Specialty not found", 404);
    }
    const enabledClinicSpecialty = await prisma.clinicSpecialty.findFirst({
      where: { clinicId, specialtyId: specialty.id, deletedAt: null },
      select: { id: true }
    });
    if (!enabledClinicSpecialty) {
      throw new AppError("Specialty is not enabled for this clinic", 403);
    }

    return prisma.appointment.create({
      data: {
        clinicId,
        doctorId: data.doctorId,
        patientId: data.patientId,
        specialtyId: specialty.id,
        entryType: data.entryType ?? "EXAM",
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        reason: data.reason || null,
        notes: data.notes || null,
        status: data.status ?? "SCHEDULED"
      }
    });
  },

  async update(
    id: string,
    clinicId: string,
    data: {
      doctorId?: string;
      patientId?: string;
      specialtyCode?: string;
      startsAt?: string;
      endsAt?: string;
      entryType?: VisitEntryType;
      reason?: string;
      notes?: string;
      status?: AppointmentStatus;
    }
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true, clinicId: true }
    });
    if (!appointment) {
      throw new AppError("Appointment not found", 404);
    }

    if (data.doctorId) {
      const doctor = await prisma.doctor.findFirst({
        where: { id: data.doctorId, clinicId, deletedAt: null },
        select: { id: true }
      });
      if (!doctor) {
        throw new AppError("Doctor not found in this clinic", 404);
      }
    }
    if (data.patientId) {
      const patient = await prisma.patient.findFirst({
        where: { id: data.patientId, clinicId, deletedAt: null },
        select: { id: true }
      });
      if (!patient) {
        throw new AppError("Patient not found in this clinic", 404);
      }
    }

    let nextSpecialtyId: string | undefined;
    if (typeof data.specialtyCode === "string" && data.specialtyCode.trim()) {
      const specialty = await prisma.specialtyCatalog.findFirst({
        where: { code: data.specialtyCode.trim().toUpperCase(), deletedAt: null, isActive: true },
        select: { id: true }
      });
      if (!specialty) {
        throw new AppError("Specialty not found", 404);
      }
      const enabledClinicSpecialty = await prisma.clinicSpecialty.findFirst({
        where: { clinicId, specialtyId: specialty.id, deletedAt: null },
        select: { id: true }
      });
      if (!enabledClinicSpecialty) {
        throw new AppError("Specialty is not enabled for this clinic", 403);
      }
      nextSpecialtyId = specialty.id;
    }

    return prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        ...(data.doctorId ? { doctorId: data.doctorId } : {}),
        ...(data.patientId ? { patientId: data.patientId } : {}),
        ...(nextSpecialtyId ? { specialtyId: nextSpecialtyId } : {}),
        ...(data.entryType ? { entryType: data.entryType } : {}),
        ...(data.startsAt ? { startsAt: new Date(data.startsAt) } : {}),
        ...(data.endsAt ? { endsAt: new Date(data.endsAt) } : {}),
        ...(data.reason !== undefined ? { reason: data.reason || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.status ? { status: data.status } : {})
      }
    });
  },

  async remove(id: string, clinicId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true }
    });
    if (!appointment) {
      throw new AppError("Appointment not found", 404);
    }
    return prisma.appointment.update({
      where: { id: appointment.id },
      data: { deletedAt: new Date(), status: "CANCELLED" }
    });
  },

  async getAssessmentByAppointment(id: string, clinicId: string, requester?: { role?: string; userId?: string }) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        patient: true,
        specialty: true,
        doctor: {
          include: {
            user: true
          }
        }
      }
    });
    if (!appointment) {
      throw new AppError("Appointment not found", 404);
    }
    if (requester?.role === "Doctor" && requester.userId && appointment.doctor.userId !== requester.userId) {
      throw new AppError("You are not allowed to access this appointment assessment", 403);
    }
    if (!appointment.specialtyId || !appointment.specialty) {
      throw new AppError("No specialty assigned to this appointment", 409);
    }

    const clinicSpecialty = await prisma.clinicSpecialty.findFirst({
      where: { clinicId: appointment.clinicId, specialtyId: appointment.specialtyId, deletedAt: null },
      select: { templateId: true }
    });
    if (!clinicSpecialty) {
      throw new AppError("Appointment specialty is not enabled for this clinic", 403);
    }

    const template = clinicSpecialty.templateId
      ? await prisma.specialtyTemplate.findFirst({
          where: { id: clinicSpecialty.templateId },
          include: {
            fields: { orderBy: { displayOrder: "asc" }, include: { options: { orderBy: { displayOrder: "asc" } } } },
            rules: { orderBy: { displayOrder: "asc" } }
          }
        })
      : null;

    const existingAssessment = await prisma.patientSpecialtyAssessment.findFirst({
      where: { appointmentId: appointment.id, specialtyId: appointment.specialtyId },
      include: {
        specialty: true,
        template: true
      }
    });

    return {
      appointment: {
        id: appointment.id,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
        entryType: appointment.entryType,
        reason: appointment.reason,
        notes: appointment.notes,
        patient: appointment.patient,
        doctor: {
          id: appointment.doctor.id,
          specialty: appointment.doctor.specialty,
          user: appointment.doctor.user
        }
      },
      specialty: {
        id: appointment.specialty.id,
        code: appointment.specialty.code,
        name: appointment.specialty.name,
        nameAr: appointment.specialty.nameAr
      },
      template,
      assessment: existingAssessment
    };
  }
};
