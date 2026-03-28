/**
 * Fixes legacy clinic image URLs that point to ephemeral `/uploads/clinic-images/*`.
 *
 * By default this runs in dry mode and prints what would change.
 * Use `--apply` to persist updates.
 *
 * Optional:
 *  --base-url=https://frontend-nine-henna-86.vercel.app
 *      Checks whether each legacy URL is reachable before deciding.
 *      If missing, every legacy `/uploads/clinic-images/*` is treated as stale.
 */
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const LEGACY_PREFIX = "/uploads/clinic-images/";

function parseArg(name: string): string | undefined {
  const token = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return token ? token.slice(name.length + 1) : undefined;
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) return true;
    if (head.status !== 405) return false;
    const getRes = await fetch(url, { method: "GET" });
    return getRes.ok;
  } catch {
    return false;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const baseUrlArg = parseArg("--base-url");
  const baseUrl = (baseUrlArg ?? "").replace(/\/+$/, "");

  const clinics = await prisma.clinic.findMany({
    where: {
      deletedAt: null,
      imageUrl: { startsWith: LEGACY_PREFIX }
    },
    select: {
      id: true,
      name: true,
      imageUrl: true
    }
  });

  if (!clinics.length) {
    // eslint-disable-next-line no-console
    console.log("No clinics with legacy /uploads clinic image URLs were found.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${clinics.length} clinics with legacy image URLs.`);

  let toNullCount = 0;
  for (const clinic of clinics) {
    const imageUrl = clinic.imageUrl;
    if (!imageUrl) continue;

    let shouldNull = true;
    if (baseUrl) {
      const absoluteUrl = `${baseUrl}${imageUrl}`;
      shouldNull = !(await isReachable(absoluteUrl));
      // eslint-disable-next-line no-console
      console.log(`${clinic.id} | ${clinic.name} | ${absoluteUrl} | reachable=${!shouldNull}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`${clinic.id} | ${clinic.name} | ${imageUrl} | assumed stale (no --base-url)`);
    }

    if (!shouldNull) continue;
    toNullCount += 1;
    if (apply) {
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: { imageUrl: null }
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    apply
      ? `Updated ${toNullCount} clinics: set stale legacy imageUrl to null.`
      : `Dry-run complete. ${toNullCount} clinics would be updated. Re-run with --apply to persist.`
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
