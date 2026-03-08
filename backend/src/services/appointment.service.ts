import { AppointmentStatus, VisitEntryType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

interface ListInput {
  clinicId?: string;
  doctorUserId?: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: AppointmentStatus;
  entryType?: VisitEntryType;
}

export const appointmentService = {
  async list(input: ListInput) {
    const where = {
      ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      ...(input.doctorUserId
        ? {
            doctor: {
              is: {
                userId: input.doctorUserId,
                deletedAt: null
              }
            }
          }
        : {}),
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.entryType ? { entryType: input.entryType } : {}),
      ...(input.search
        ? {
            OR: [
              { reason: { contains: input.search, mode: "insensitive" as const } },
              {
                patient: {
                  is: { fullName: { contains: input.search, mode: "insensitive" as const } }
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: true,
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
      startsAt: string;
      endsAt: string;
      entryType?: VisitEntryType;
      reason?: string;
      notes?: string;
      status?: AppointmentStatus;
    }
  ) {
    const [doctor, patient] = await Promise.all([
      prisma.doctor.findFirst({
        where: { id: data.doctorId, clinicId, deletedAt: null },
        select: { id: true }
      }),
      prisma.patient.findFirst({
        where: { id: data.patientId, clinicId, deletedAt: null },
        select: { id: true }
      })
    ]);
    if (!doctor) {
      throw new AppError("Doctor not found in this clinic", 404);
    }
    if (!patient) {
      throw new AppError("Patient not found in this clinic", 404);
    }

    return prisma.appointment.create({
      data: {
        clinicId,
        doctorId: data.doctorId,
        patientId: data.patientId,
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

    return prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        ...(data.doctorId ? { doctorId: data.doctorId } : {}),
        ...(data.patientId ? { patientId: data.patientId } : {}),
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
  }
};
