/**
 * Compares Postgres Permission rows to PERMISSION_CATALOG (code source of truth).
 * Run: npm run db:verify-permissions --workspace backend
 * Requires DATABASE_URL and prisma migrate applied.
 */
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PERMISSION_CATALOG } from "../src/constants/permissions";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const main = async () => {
  const catalogKeys = new Set(PERMISSION_CATALOG.map((p) => p.key));
  const rows = await prisma.permission.findMany({ select: { key: true } });
  const dbKeys = new Set(rows.map((r) => r.key));

  const missingInDb = [...catalogKeys].filter((k) => !dbKeys.has(k));
  const orphansInDb = [...dbKeys].filter((k) => !catalogKeys.has(k));

  if (missingInDb.length) {
    // eslint-disable-next-line no-console
    console.error("Catalog keys missing in Postgres Permission table:", missingInDb.sort().join(", "));
    process.exitCode = 1;
  }
  if (orphansInDb.length) {
    // eslint-disable-next-line no-console
    console.warn("Postgres Permission rows not in PERMISSION_CATALOG (orphans):", orphansInDb.sort().join(", "));
  }
  if (!missingInDb.length && !orphansInDb.length) {
    // eslint-disable-next-line no-console
    console.log(`OK: ${catalogKeys.size} permission keys in catalog match Postgres Permission table.`);
  } else if (!missingInDb.length && orphansInDb.length) {
    // eslint-disable-next-line no-console
    console.log(`OK: all catalog keys exist in DB (${catalogKeys.size}). Review orphans above.`);
  }
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
