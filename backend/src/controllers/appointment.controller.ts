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

    const data = await appointmentService.list({
      clinicId: getOptionalClinicScope(req),
      doctorUserId: req.user?.role === "Doctor" ? req.user?.sub : undefined,
      page,
      pageSize,
      search,
      status,
      entryType
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
