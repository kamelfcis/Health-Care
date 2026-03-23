import { Response } from "express";
import { patientService } from "../services/patient.service";
import { parsePatientListQuery, patientListCacheKeySuffix } from "../utils/patient-list-query";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { getOptionalClinicScope, getScopedClinicId } from "../utils/tenant";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";

const calculateAge = (dateOfBirth: Date | null | undefined) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
};

export const patientController = {
  async stats(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const cachePrefix = buildCacheKey("patients", clinicId ?? "all");
    const data = await getOrSetCache(buildCacheKey(cachePrefix, "stats"), 30_000, () =>
      patientService.stats(clinicId)
    );
    res.json(apiSuccess(data));
  },

  async list(req: AuthenticatedRequest, res: Response) {
    const q = parsePatientListQuery(req);
    const clinicId = getOptionalClinicScope(req);
    const cachePrefix = buildCacheKey("patients", clinicId ?? "all");
    const data = await getOrSetCache(
      buildCacheKey(cachePrefix, "list", patientListCacheKeySuffix(q)),
      45_000,
      () =>
        patientService.list({
          clinicId,
          page: q.page,
          pageSize: q.pageSize,
          search: q.search,
          fullName: q.fullName,
          phone: q.phone,
          clinicName: q.clinicName,
          leadSource: q.leadSource,
          specialtyCode: q.specialtyCode,
          specialtyName: q.specialtyName,
          campaignName: q.campaignName,
          governorate: q.governorate,
          maritalStatus: q.maritalStatus,
          doctorName: q.doctorName,
          createdFrom: q.createdFrom,
          createdTo: q.createdTo,
          firstVisitFrom: q.firstVisitFrom,
          firstVisitTo: q.firstVisitTo,
          fileNumber: q.fileNumber,
          requesterRole: req.user?.role,
          requesterUserId: req.user?.sub
        })
    );
    res.json(apiSuccess({
      ...data,
      data: data.data.map((item) => ({
        ...item,
        age: calculateAge(item.dateOfBirth),
        lastVisitAt: item.appointments[0]?.startsAt ?? null
      }))
    }));
  },

  async listAssessments(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.listAssessments(
      String(req.params.id),
      clinicId,
      req.user?.role,
      req.user?.sub
    );
    res.json(apiSuccess(data));
  },

  async listExams(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.listExams(
      String(req.params.id),
      clinicId,
      req.user?.role,
      req.user?.sub
    );
    res.json(apiSuccess(data));
  },

  async createExam(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const files = ((req as AuthenticatedRequest & { files?: Express.Multer.File[] }).files ?? []) as Express.Multer.File[];
    const data = await patientService.createExam(
      String(req.params.id),
      clinicId,
      { name: String(req.body.name ?? ""), examDate: String(req.body.examDate ?? "") },
      files.map((file) => ({
        fileUrl: `/uploads/patient-exams/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size
      })),
      req.user?.role,
      req.user?.sub
    );
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId ?? "all"));
    res.status(201).json(apiSuccess(data, "Patient exam created"));
  },

  async updateExam(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const files = ((req as AuthenticatedRequest & { files?: Express.Multer.File[] }).files ?? []) as Express.Multer.File[];
    const data = await patientService.updateExam(
      String(req.params.id),
      String(req.params.examId),
      clinicId,
      {
        ...(Object.prototype.hasOwnProperty.call(req.body, "name") ? { name: String(req.body.name ?? "") } : {}),
        ...(Object.prototype.hasOwnProperty.call(req.body, "examDate") ? { examDate: String(req.body.examDate ?? "") } : {})
      },
      files.map((file) => ({
        fileUrl: `/uploads/patient-exams/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size
      })),
      req.user?.role,
      req.user?.sub
    );
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId ?? "all"));
    res.json(apiSuccess(data, "Patient exam updated"));
  },

  async removeExam(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.removeExam(
      String(req.params.id),
      String(req.params.examId),
      clinicId,
      req.user?.role,
      req.user?.sub
    );
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId ?? "all"));
    res.json(apiSuccess(data, "Patient exam deleted"));
  },

  async removeExamAttachment(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.removeExamAttachment(
      String(req.params.id),
      String(req.params.examId),
      String(req.params.attachmentId),
      clinicId,
      req.user?.role,
      req.user?.sub
    );
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId ?? "all"));
    res.json(apiSuccess(data, "Patient exam attachment deleted"));
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicId(req);
    const data = await patientService.create(clinicId, req.body);
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId));
    invalidateCacheByPrefix(buildCacheKey("patients", "all"));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    res.status(201).json(
      apiSuccess(
        {
          ...data,
          age: calculateAge(data.dateOfBirth)
        },
        "Patient created"
      )
    );
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.update(String(req.params.id), clinicId, req.body);
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId));
    invalidateCacheByPrefix(buildCacheKey("patients", "all"));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    res.json(apiSuccess(data, "Patient updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req);
    const data = await patientService.remove(String(req.params.id), clinicId);
    invalidateCacheByPrefix(buildCacheKey("patients", clinicId));
    invalidateCacheByPrefix(buildCacheKey("patients", "all"));
    invalidateCacheByPrefix(buildCacheKey("dashboard", clinicId));
    invalidateCacheByPrefix(buildCacheKey("dashboard", "all"));
    res.json(apiSuccess(data, "Patient deleted"));
  }
};
