/**
 * Upserts PERMISSION_CATALOG and reapplies DEFAULT_ROLE_PERMISSIONS for every clinic's system roles.
 * Safe to run after adding new permission keys (e.g. finance.read / finance.manage).
 *
 * Run from repo root: npm run db:sync-permissions
 */
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { permissionService } from "../src/services/permission.service";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const main = async () => {
  await permissionService.seedPermissionCatalog();
  // eslint-disable-next-line no-console
  console.log("Permission catalog upserted.");

  const clinics = await prisma.clinic.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true }
  });

  for (const clinic of clinics) {
    await permissionService.ensureDefaultRoles(clinic.id);
    // eslint-disable-next-line no-console
    console.log(`Synced system roles for clinic: ${clinic.name} (${clinic.slug})`);
  }

  // eslint-disable-next-line no-console
  console.log(`Done. ${clinics.length} clinic(s) updated. Users must log out and log in again to refresh JWT permissions.`);
};

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
