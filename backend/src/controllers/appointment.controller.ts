import { Response } from "express";
import { AppointmentStatus, VisitEntryType } from "@prisma/client";
import { appointmentService } from "../services/appointment.service";
import { getPagination } from "../utils/http";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicId } from "../utils/tenant";
import { AppError } from "../utils/app-error";

const getRequiredClinicScope = (req: AuthenticatedRequest) => {
  const scoped = getOptionalClinicScope(req);
  if (!scoped) {
    throw new AppError("Please select a clinic scope", 400);
  }
  return scoped;
};

const optionalTrimmed = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t === "" ? undefined : t;
};

const optionalDateStartUtc = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || value.length < 8) return undefined;
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const optionalDateEndUtc = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || value.length < 8) return undefined;
  const d = new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const optionalFileNumber = (value: unknown): number | undefined => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = parseInt(value.trim(), 10);
  return Number.isNaN(n) ? undefined : n;
};

export const appointmentController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const { page, pageSize, search } = getPagination(req);
    const status =
      typeof req.query.status === "string" &&
      Object.values(AppointmentStatus).includes(req.query.status as AppointmentStatus)
        ? (req.query.status as AppointmentStatus)
        : undefined;
    const entryType =
      typeof req.query.entryType === "string" &&
      Object.values(VisitEntryType).includes(req.query.entryType as VisitEntryType)
        ? (req.query.entryType as VisitEntryType)
        : undefined;

    const patientFullName = optionalTrimmed(req.query.patientFullName);
    const patientPhone = optionalTrimmed(req.query.patientPhone);
    const patientFileNumber = optionalFileNumber(req.query.patientFileNumber);
    const doctorName = optionalTrimmed(req.query.doctorName);
    const specialtyCodeRaw = optionalTrimmed(req.query.specialtyCode);
    const specialtyCode = specialtyCodeRaw ? specialtyCodeRaw.toUpperCase() : undefined;
    const startsFrom = optionalDateStartUtc(req.query.startsFrom);
    const startsTo = optionalDateEndUtc(req.query.startsTo);

    const data = await appointmentService.list({
      clinicId: getOptionalClinicScope(req),
      doctorUserId: req.user?.role === "Doctor" ? req.user?.sub : undefined,
      page,
      pageSize,
      search,
      status,
      entryType,
      patientFullName,
      patientPhone,
      patientFileNumber,
      doctorName,
      specialtyCode,
      startsFrom,
      startsTo
    });

    res.json(apiSuccess(data));
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const clinicId = req.user?.role === "SuperAdmin" ? getRequiredClinicScope(req) : getScopedClinicId(req);
    const data = await appointmentService.create(clinicId, req.body);
    res.status(201).json(apiSuccess(data, "Appointment created"));
  },

  async getAssessment(req: AuthenticatedRequest, res: Response) {
    const clinicId = req.user?.role === "SuperAdmin" ? getRequiredClinicScope(req) : getScopedClinicId(req);
    const data = await appointmentService.getAssessmentByAppointment(String(req.params.id), clinicId, {
      role: req.user?.role,
      userId: req.user?.sub
    });
    res.json(apiSuccess(data));
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const clinicId = req.user?.role === "SuperAdmin" ? getRequiredClinicScope(req) : getScopedClinicId(req);
    const data = await appointmentService.update(String(req.params.id), clinicId, req.body);
    res.json(apiSuccess(data, "Appointment updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const clinicId = req.user?.role === "SuperAdmin" ? getRequiredClinicScope(req) : getScopedClinicId(req);
    const data = await appointmentService.remove(String(req.params.id), clinicId);
    res.json(apiSuccess(data, "Appointment cancelled"));
  }
};
