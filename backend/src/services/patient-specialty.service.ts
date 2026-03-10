import { Prisma, VisitEntryType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

type Dict = Record<string, unknown>;
type Condition = {
  field?: string;
  source?: "values" | "computed";
  op?: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "includes";
  value?: unknown;
  any?: Condition[];
  all?: Condition[];
};

interface RequesterContext {
  userId?: string;
  role?: string;
}

const assertDoctorPatientAccess = async (patientId: string, clinicId: string, requester?: RequesterContext) => {
  if (!requester || requester.role !== "Doctor" || !requester.userId) return;

  const linkedAppointment = await prisma.appointment.findFirst({
    where: {
      clinicId,
      patientId,
      deletedAt: null,
      doctor: {
        is: {
          userId: requester.userId,
          deletedAt: null
        }
      }
    },
    select: { id: true }
  });

  if (!linkedAppointment) {
    throw new AppError("You are not allowed to access this patient's specialty assessment", 403);
  }
};

const assertDoctorAppointmentAccess = async (appointmentId: string, clinicId: string, requester?: RequesterContext) => {
  if (!requester || requester.role !== "Doctor" || !requester.userId) return;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      clinicId,
      deletedAt: null,
      doctor: {
        is: {
          userId: requester.userId,
          deletedAt: null
        }
      }
    },
    select: { id: true }
  });
  if (!appointment) {
    throw new AppError("You are not allowed to access this appointment specialty assessment", 403);
  }
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeYesNo = (value: unknown) => {
  if (value === true || value === "YES" || value === "true") return "YES";
  if (value === false || value === "NO" || value === "false") return "NO";
  return value;
};

const getValue = (values: Dict, computed: Dict, field?: string, source?: "values" | "computed") => {
  if (!field) return undefined;
  if (source === "computed") return computed[field];
  return values[field];
};

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;

const evalCondition = (condition: Condition, values: Dict, computed: Dict): boolean => {
  if (condition.all?.length) {
    return condition.all.every((item) => evalCondition(item, values, computed));
  }
  if (condition.any?.length) {
    return condition.any.some((item) => evalCondition(item, values, computed));
  }

  const left = normalizeYesNo(getValue(values, computed, condition.field, condition.source));
  const right = normalizeYesNo(condition.value);
  switch (condition.op) {
    case "gt": {
      const l = toNumber(left);
      const r = toNumber(right);
      return l !== null && r !== null ? l > r : false;
    }
    case "gte": {
      const l = toNumber(left);
      const r = toNumber(right);
      return l !== null && r !== null ? l >= r : false;
    }
    case "lt": {
      const l = toNumber(left);
      const r = toNumber(right);
      return l !== null && r !== null ? l < r : false;
    }
    case "lte": {
      const l = toNumber(left);
      const r = toNumber(right);
      return l !== null && r !== null ? l <= r : false;
    }
    case "includes": {
      return Array.isArray(left) ? left.includes(right) : false;
    }
    case "neq":
      return left !== right;
    case "eq":
    default:
      return left === right;
  }
};

const evaluateComputes = (rules: Array<{ key: string; expression: Dict }>, values: Dict) => {
  const computed: Dict = {};

  for (const rule of rules) {
    const expression = rule.expression;
    const formula = typeof expression.formula === "string" ? expression.formula : undefined;
    const target = typeof expression.target === "string" ? expression.target : undefined;
    if (!formula || !target) continue;

    if (formula === "bmi") {
      const heightCm = toNumber(values[String(expression.heightField ?? "heightCm")]);
      const weightKg = toNumber(values[String(expression.weightField ?? "weightKg")]);
      if (heightCm && weightKg && heightCm > 0) {
        const heightM = heightCm / 100;
        computed[target] = Number((weightKg / (heightM * heightM)).toFixed(2));
      }
      continue;
    }

    const fields = Array.isArray(expression.fields) ? expression.fields.map((item) => String(item)) : [];
    const nums = fields.map((field) => toNumber(values[field])).filter((item): item is number => item !== null);
    if (!nums.length) continue;

    if (formula === "sum") {
      computed[target] = Number(nums.reduce((acc, curr) => acc + curr, 0).toFixed(2));
      continue;
    }

    if (formula === "multiply") {
      computed[target] = Number(nums.reduce((acc, curr) => acc * curr, 1).toFixed(2));
    }
  }

  return computed;
};

export const patientSpecialtyService = {
  async getTemplate(patientId: string, clinicId: string | undefined, specialtyCode: string, requester?: RequesterContext) {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        deletedAt: null,
        ...(clinicId ? { clinicId } : {})
      },
      select: { id: true, clinicId: true }
    });
    if (!patient) throw new AppError("Patient not found", 404);
    await assertDoctorPatientAccess(patient.id, patient.clinicId, requester);

    const specialty = await prisma.specialtyCatalog.findFirst({
      where: { code: specialtyCode.toUpperCase(), isActive: true, deletedAt: null },
      select: { id: true, code: true, name: true, nameAr: true }
    });
    if (!specialty) throw new AppError("Specialty not found", 404);

    const clinicSpecialty = await prisma.clinicSpecialty.findFirst({
      where: {
        clinicId: patient.clinicId,
        specialtyId: specialty.id,
        deletedAt: null
      },
      select: { id: true, templateId: true }
    });
    if (!clinicSpecialty) {
      throw new AppError("Specialty is not enabled for this clinic", 403);
    }
    if (!clinicSpecialty.templateId) {
      throw new AppError("No template assigned for this clinic specialty", 404);
    }

    const template = await prisma.specialtyTemplate.findFirst({
      where: { id: clinicSpecialty.templateId, specialtyId: specialty.id },
      include: {
        fields: {
          orderBy: { displayOrder: "asc" },
          include: {
            options: {
              orderBy: { displayOrder: "asc" }
            }
          }
        },
        rules: {
          orderBy: { displayOrder: "asc" }
        }
      },
    });
    if (!template) throw new AppError("Assigned template was not found for this clinic specialty", 404);

    return { patient, specialty, template };
  },

  async getAssessment(
    patientId: string,
    clinicId: string | undefined,
    specialtyCode: string,
    entryType: VisitEntryType,
    appointmentId?: string,
    requester?: RequesterContext
  ) {
    const { patient, specialty, template } = await this.getTemplate(patientId, clinicId, specialtyCode, requester);
    if (appointmentId) {
      await assertDoctorAppointmentAccess(appointmentId, patient.clinicId, requester);
      const scopedAppointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, patientId: patient.id, clinicId: patient.clinicId, deletedAt: null },
        select: { id: true, specialtyId: true }
      });
      if (!scopedAppointment) {
        throw new AppError("Appointment not found for selected patient", 404);
      }
      if (!scopedAppointment.specialtyId) {
        throw new AppError("No specialty assigned to this appointment", 409);
      }
      if (scopedAppointment.specialtyId !== specialty.id) {
        throw new AppError("Appointment specialty does not match requested specialty", 409);
      }
    }

    const assessment = await prisma.patientSpecialtyAssessment.findFirst({
      where: appointmentId
        ? { appointmentId, patientId: patient.id, specialtyId: specialty.id }
        : { patientId: patient.id, specialtyId: specialty.id, entryType },
      orderBy: appointmentId ? undefined : { updatedAt: "desc" }
    });

    return {
      specialty,
      template,
      assessment
    };
  },

  async upsertAssessment(
    patientId: string,
    clinicId: string | undefined,
    specialtyCode: string,
    values: Dict,
    entryType: VisitEntryType,
    appointmentId?: string,
    requester?: RequesterContext
  ) {
    const { patient, specialty, template } = await this.getTemplate(patientId, clinicId, specialtyCode, requester);
    let scopedEntryType = entryType;
    if (appointmentId) {
      await assertDoctorAppointmentAccess(appointmentId, patient.clinicId, requester);
      const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, patientId: patient.id, clinicId: patient.clinicId, deletedAt: null },
        select: { id: true, entryType: true, specialtyId: true }
      });
      if (!appointment) {
        throw new AppError("Appointment not found for selected patient", 404);
      }
      if (!appointment.specialtyId) {
        throw new AppError("No specialty assigned to this appointment", 409);
      }
      if (appointment.specialtyId !== specialty.id) {
        throw new AppError("Appointment specialty does not match requested specialty", 409);
      }
      scopedEntryType = appointment.entryType;
    }

    const computeRules = template.rules
      .filter((rule) => rule.type === "COMPUTE")
      .map((rule) => ({ key: rule.key, expression: rule.expression as Dict }));
    const computed = evaluateComputes(computeRules, values);

    const alerts = template.rules
      .filter((rule) => rule.type === "ALERT")
      .filter((rule) => evalCondition(rule.expression as Condition, values, computed))
      .map((rule) => {
        const expression = rule.expression as Dict;
        return {
          key: rule.key,
          name: rule.name,
          nameAr: rule.nameAr,
          severity: rule.severity,
          message: typeof expression.message === "string" ? expression.message : rule.name,
          messageAr: typeof expression.messageAr === "string" ? expression.messageAr : rule.nameAr
        };
      });

    const diagnoses = template.rules
      .filter((rule) => rule.type === "DIAGNOSIS")
      .filter((rule) => evalCondition(rule.expression as Condition, values, computed))
      .map((rule) => ({
        key: rule.key,
        name: rule.name,
        nameAr: rule.nameAr
      }));

    const systemDiagnosisAuto = diagnoses.map((item) => item.name);
    const mergedValues = {
      ...values,
      ...(computed.bmi !== undefined ? { bmi: computed.bmi } : {}),
      ...(computed.totalSpermCount !== undefined ? { totalSpermCount: computed.totalSpermCount } : {}),
      ...(computed.totalMotility !== undefined ? { totalMotility: computed.totalMotility } : {}),
      systemDiagnosisAuto
    };

    if (appointmentId) {
      const existing = await prisma.patientSpecialtyAssessment.findFirst({
        where: { appointmentId, patientId: patient.id, clinicId: patient.clinicId }
      });
      if (existing) {
        return prisma.patientSpecialtyAssessment.update({
          where: { id: existing.id },
          data: {
            patientId: patient.id,
            clinicId: patient.clinicId,
            specialtyId: specialty.id,
            entryType: scopedEntryType,
            templateId: template.id,
            values: toJson(mergedValues),
            computed: toJson(computed),
            alerts: toJson(alerts),
            diagnoses: toJson(diagnoses)
          }
        });
      }
      return prisma.patientSpecialtyAssessment.create({
        data: {
          appointmentId,
          patientId: patient.id,
          clinicId: patient.clinicId,
          specialtyId: specialty.id,
          entryType: scopedEntryType,
          templateId: template.id,
          values: toJson(mergedValues),
          computed: toJson(computed),
          alerts: toJson(alerts),
          diagnoses: toJson(diagnoses)
        }
      });
    }

    const existingLegacy = await prisma.patientSpecialtyAssessment.findFirst({
      where: { patientId: patient.id, specialtyId: specialty.id, entryType: scopedEntryType, appointmentId: null },
      orderBy: { updatedAt: "desc" }
    });
    if (existingLegacy) {
      return prisma.patientSpecialtyAssessment.update({
        where: { id: existingLegacy.id },
        data: {
          entryType: scopedEntryType,
          templateId: template.id,
          values: toJson(mergedValues),
          computed: toJson(computed),
          alerts: toJson(alerts),
          diagnoses: toJson(diagnoses)
        }
      });
    }
    return prisma.patientSpecialtyAssessment.create({
      data: {
        patientId: patient.id,
        clinicId: patient.clinicId,
        specialtyId: specialty.id,
        entryType: scopedEntryType,
        templateId: template.id,
        values: toJson(mergedValues),
        computed: toJson(computed),
        alerts: toJson(alerts),
        diagnoses: toJson(diagnoses)
      }
    });
  }
};
