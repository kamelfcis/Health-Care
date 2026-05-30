/**
 * One-off: delete clinic (and related data) by contact/owner email.
 * Usage: npx ts-node --transpile-only scripts/delete-clinic-by-email.ts kamelfcis@live.com
 */
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  PROTECTED_CLINIC_SLUGS,
  hardDeleteClinicCascade,
  hardDeleteOrphanClinicShell,
  isOrphanClinicCandidate,
  clinicHasBusinessData,
} from "../src/utils/clinic-cleanup";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const prisma = new PrismaClient();

const TARGET_EMAIL = (process.argv[2] ?? "").trim().toLowerCase();
if (!TARGET_EMAIL) {
  console.error("Usage: ts-node scripts/delete-clinic-by-email.ts <email>");
  process.exit(1);
}

async function findActorUserId(excludeClinicId: string): Promise<string> {
  const actor = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      clinicId: { not: excludeClinicId },
      role: { name: "SuperAdmin", deletedAt: null },
    },
    select: { id: true },
  });
  if (actor) return actor.id;

  const fallback = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      clinicId: { not: excludeClinicId },
      clinic: { slug: "default-clinic" },
    },
    select: { id: true },
  });
  if (!fallback) {
    throw new Error("No actor user found outside target clinic (need SuperAdmin or default-clinic user)");
  }
  return fallback.id;
}

async function main() {
  console.log("Target email:", TARGET_EMAIL);

  const clinicsByEmail = await prisma.clinic.findMany({
    where: { email: { equals: TARGET_EMAIL, mode: "insensitive" } },
    select: { id: true, slug: true, name: true, email: true, deletedAt: true },
  });

  const usersByEmail = await prisma.user.findMany({
    where: { email: { equals: TARGET_EMAIL, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      clinicId: true,
      deletedAt: true,
      role: { select: { name: true } },
    },
  });

  console.log("Found clinics by email:", JSON.stringify(clinicsByEmail, null, 2));
  console.log("Found users by email:", JSON.stringify(usersByEmail, null, 2));

  const clinicIds = new Set<string>();
  for (const c of clinicsByEmail) clinicIds.add(c.id);
  for (const u of usersByEmail) {
    if (u.clinicId) clinicIds.add(u.clinicId);
  }

  if (clinicIds.size === 0) {
    console.log("No clinic to delete for this email.");
    return;
  }

  for (const clinicId of clinicIds) {
    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId },
      select: { id: true, slug: true, name: true, email: true, deletedAt: true },
    });
    if (!clinic) continue;
    if (PROTECTED_CLINIC_SLUGS.has(clinic.slug)) {
      console.error("Refusing to delete protected clinic:", clinic.slug);
      continue;
    }

    if (clinic.deletedAt) {
      console.log("Restoring soft-deleted clinic row before hard delete:", clinic.slug);
      await prisma.clinic.update({ where: { id: clinicId }, data: { deletedAt: null } });
    }

    const userCount = await prisma.user.count({ where: { clinicId } });
    const hasBusiness = await clinicHasBusinessData(prisma, clinicId);
    const orphan = await isOrphanClinicCandidate(clinicId, clinic.email);

    console.log(
      `Clinic ${clinic.slug} (${clinic.id}): users=${userCount}, businessData=${hasBusiness}, orphanCandidate=${orphan}`
    );

    if (orphan && userCount === 0 && !hasBusiness) {
      const removed = await prisma.$transaction((tx) => hardDeleteOrphanClinicShell(tx, clinicId));
      console.log("hardDeleteOrphanClinicShell result:", removed, { id: clinic.id, slug: clinic.slug, email: clinic.email });
    } else {
      const actorUserId = await findActorUserId(clinicId);
      const result = await hardDeleteClinicCascade(clinicId, actorUserId);
      console.log("hardDeleteClinicCascade deleted:", result);
    }
  }

  const verifyClinics = await prisma.clinic.findMany({
    where: { email: { equals: TARGET_EMAIL, mode: "insensitive" } },
    select: { id: true, slug: true, deletedAt: true },
  });
  const verifyUsers = await prisma.user.findMany({
    where: { email: { equals: TARGET_EMAIL, mode: "insensitive" } },
    select: { id: true, deletedAt: true },
  });
  console.log("Verification — clinics:", verifyClinics);
  console.log("Verification — users:", verifyUsers);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
