import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "./app-error";

/** Seeded system clinic — never auto-deleted or hard-deleted by Super Admin. */
export const PROTECTED_CLINIC_SLUGS = new Set(["default-clinic"]);

export const clinicHasBusinessData = async (tx: Prisma.TransactionClient, clinicId: string) => {
  const [patients, doctors, appointments, invoices, leads] = await Promise.all([
    tx.patient.count({ where: { clinicId } }),
    tx.doctor.count({ where: { clinicId } }),
    tx.appointment.count({ where: { clinicId } }),
    tx.invoice.count({ where: { clinicId } }),
    tx.lead.count({ where: { clinicId } })
  ]);

  return patients + doctors + appointments + invoices + leads > 0;
};

const deleteClinicShell = async (tx: Prisma.TransactionClient, clinicId: string) => {
  await tx.notification.deleteMany({ where: { clinicId } });
  await tx.clinicUser.deleteMany({ where: { clinicId } });
  await tx.role.deleteMany({ where: { clinicId } });
  await tx.clinicSpecialty.deleteMany({ where: { clinicId } });
  await tx.paymentMethodCatalog.deleteMany({ where: { clinicId } });
  await tx.campaignCatalog.deleteMany({ where: { clinicId } });
  await tx.clinic.delete({ where: { id: clinicId } });
};

const deleteClinicBusinessData = async (tx: Prisma.TransactionClient, clinicId: string) => {
  await tx.followUp.deleteMany({ where: { lead: { clinicId } } });
  await tx.lead.updateMany({
    where: { clinicId },
    data: { assignedToId: null, convertedPatientId: null, createdById: null }
  });
  await tx.lead.deleteMany({ where: { clinicId } });

  await tx.patientProcedure.updateMany({
    where: { clinicId },
    data: { createdById: null, invoiceId: null }
  });
  await tx.patientProcedure.deleteMany({ where: { clinicId } });

  await tx.clinicExpense.updateMany({
    where: { clinicId },
    data: { createdById: null }
  });
  await tx.clinicExpense.deleteMany({ where: { clinicId } });

  await tx.payment.deleteMany({ where: { clinicId } });
  await tx.invoiceLineItem.deleteMany({ where: { clinicId } });
  await tx.invoice.deleteMany({ where: { clinicId } });

  await tx.prescription.deleteMany({ where: { clinicId } });
  await tx.medicalRecord.deleteMany({ where: { clinicId } });
  await tx.patientSpecialtyAssessment.deleteMany({ where: { clinicId } });
  await tx.appointment.deleteMany({ where: { clinicId } });

  await tx.patientExamAttachment.deleteMany({ where: { clinicId } });
  await tx.patientExam.deleteMany({ where: { clinicId } });

  await tx.procedureCatalog.deleteMany({ where: { clinicId } });
  await tx.patient.deleteMany({ where: { clinicId } });
  await tx.doctor.deleteMany({ where: { clinicId } });
};

/** Clears user FK references and hard-deletes a single user row. */
export const hardDeleteUserRecords = async (tx: Prisma.TransactionClient, userId: string) => {
  const doctorProfile = await tx.doctor.findFirst({ where: { userId } });
  if (doctorProfile) {
    await tx.doctor.delete({ where: { id: doctorProfile.id } });
  }
  await tx.followUp.deleteMany({ where: { createdById: userId } });
  await tx.notification.updateMany({
    where: { userId },
    data: { userId: null }
  });
  await tx.lead.updateMany({
    where: { assignedToId: userId },
    data: { assignedToId: null }
  });
  await tx.patientProcedure.updateMany({
    where: { createdById: userId },
    data: { createdById: null }
  });
  await tx.clinicExpense.updateMany({
    where: { createdById: userId },
    data: { createdById: null }
  });
  await tx.clinicUser.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
};

/**
 * Clinic is an orphan shell when it has no users, or its contact email is not registered
 * to any user (failed registration / stale clinic row).
 */
export const isOrphanClinicCandidate = async (
  clinicId: string,
  clinicEmail: string | null
): Promise<boolean> => {
  const userCount = await prisma.user.count({ where: { clinicId } });
  if (userCount > 0) {
    return false;
  }

  if (!clinicEmail) {
    return true;
  }

  const normalized = clinicEmail.trim().toLowerCase();
  const matchingUser = await prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
    select: { id: true }
  });
  return !matchingUser;
};

/**
 * Hard-deletes a clinic that has no users and no business records (registration shell only).
 * Returns true when the clinic was removed.
 */
export const hardDeleteOrphanClinicShell = async (
  tx: Prisma.TransactionClient,
  clinicId: string
): Promise<boolean> => {
  const clinic = await tx.clinic.findFirst({
    where: { id: clinicId, deletedAt: null },
    select: { id: true, slug: true }
  });
  if (!clinic || PROTECTED_CLINIC_SLUGS.has(clinic.slug)) {
    return false;
  }

  const userCount = await tx.user.count({ where: { clinicId } });
  if (userCount > 0) {
    return false;
  }

  if (await clinicHasBusinessData(tx, clinicId)) {
    return false;
  }

  await deleteClinicShell(tx, clinicId);
  return true;
};

export interface PurgeOrphanClinicsResult {
  purged: Array<{ id: string; slug: string }>;
  skipped: Array<{ id: string; slug: string; reason: string }>;
}

/**
 * Removes orphan clinic shells (no users / stale email) that have no business data.
 * Protected slugs and clinics with patients or appointments are skipped.
 */
export const purgeOrphanClinics = async (): Promise<PurgeOrphanClinicsResult> => {
  const clinics = await prisma.clinic.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, email: true }
  });

  const purged: PurgeOrphanClinicsResult["purged"] = [];
  const skipped: PurgeOrphanClinicsResult["skipped"] = [];

  for (const clinic of clinics) {
    if (PROTECTED_CLINIC_SLUGS.has(clinic.slug)) {
      skipped.push({ id: clinic.id, slug: clinic.slug, reason: "protected" });
      continue;
    }

    const orphanCandidate = await isOrphanClinicCandidate(clinic.id, clinic.email);
    if (!orphanCandidate) {
      skipped.push({ id: clinic.id, slug: clinic.slug, reason: "not_orphan" });
      continue;
    }

    const removed = await prisma.$transaction((tx) => hardDeleteOrphanClinicShell(tx, clinic.id));
    if (removed) {
      purged.push({ id: clinic.id, slug: clinic.slug });
    } else if (await clinicHasBusinessData(prisma, clinic.id)) {
      skipped.push({ id: clinic.id, slug: clinic.slug, reason: "has_business_data" });
    } else {
      skipped.push({ id: clinic.id, slug: clinic.slug, reason: "not_removed" });
    }
  }

  return { purged, skipped };
};

/**
 * Super Admin: permanently deletes a clinic, all its users, and all clinic-scoped data.
 */
export const hardDeleteClinicCascade = async (clinicId: string, actorUserId: string) => {
  const clinic = await prisma.clinic.findFirst({
    where: { id: clinicId },
    select: { id: true, slug: true, name: true, imageUrl: true, deletedAt: true }
  });
  if (!clinic) {
    throw new AppError("Clinic not found", 404);
  }
  if (PROTECTED_CLINIC_SLUGS.has(clinic.slug)) {
    throw new AppError("System clinic cannot be deleted", 403);
  }

  const users = await prisma.user.findMany({
    where: { clinicId },
    select: { id: true, role: { select: { name: true } } }
  });

  if (users.some((user) => user.id === actorUserId)) {
    throw new AppError("You cannot delete the clinic you belong to", 403);
  }

  const superAdminsInClinic = users.filter((user) => user.role.name === "SuperAdmin");
  if (superAdminsInClinic.length > 0) {
    const superAdminCount = await prisma.user.count({
      where: { deletedAt: null, role: { name: "SuperAdmin", deletedAt: null } }
    });
    if (superAdminCount <= superAdminsInClinic.length) {
      throw new AppError("Cannot delete clinic: would remove all Super Admin accounts", 409);
    }
  }

  await prisma.$transaction(async (tx) => {
    await deleteClinicBusinessData(tx, clinicId);

    for (const user of users) {
      await hardDeleteUserRecords(tx, user.id);
    }

    await deleteClinicShell(tx, clinicId);
  });

  return { id: clinic.id, name: clinic.name, imageUrl: clinic.imageUrl };
};
