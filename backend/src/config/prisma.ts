import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

/** Resolve bundled demo DB on Vercel (cwd is often repo root or /var/task, not backend/). */
const findBundledSqliteSource = (): string | undefined => {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "prisma", "prisma", "dev.db"),
    path.join(cwd, "backend", "prisma", "prisma", "dev.db"),
    path.join(cwd, "apps", "backend", "prisma", "prisma", "dev.db"),
    process.env.SQLITE_BUNDLE_PATH,
    // Lambda/Vercel sometimes set task root
    process.env.LAMBDA_TASK_ROOT
      ? path.join(process.env.LAMBDA_TASK_ROOT, "backend", "prisma", "prisma", "dev.db")
      : undefined
  ].filter((p): p is string => Boolean(p));

  for (const p of candidates) {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved)) return resolved;
  }

  // Compiled backend: .../dist/config/prisma.js -> .../prisma/prisma/dev.db
  try {
    const fromDist = path.join(__dirname, "..", "..", "prisma", "prisma", "dev.db");
    if (fs.existsSync(fromDist)) return fromDist;
  } catch {
    /* ignore */
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[prisma] SQLite demo DB not found. Tried:",
    candidates.map((p) => path.resolve(p)).join(", ")
  );
  return undefined;
};

const prepareVercelSqliteRuntime = () => {
  const isVercel = Boolean(process.env.VERCEL);
  const configuredUrl = process.env.DATABASE_URL ?? "";
  const isSqlite = configuredUrl.startsWith("file:");
  if (!isVercel || !isSqlite) return;

  const runtimeDbPath = "/tmp/healthcare-crm.db";
  const sourceDbPath = findBundledSqliteSource();

  try {
    fs.mkdirSync(path.dirname(runtimeDbPath), { recursive: true });
    // Always copy from the bundle when present. A previous cold start may have created an empty
    // /tmp file; skipping copy would leave a schema-less DB and cause 500s on login.
    if (sourceDbPath && fs.existsSync(sourceDbPath)) {
      fs.copyFileSync(sourceDbPath, runtimeDbPath);
    } else if (!fs.existsSync(runtimeDbPath)) {
      fs.closeSync(fs.openSync(runtimeDbPath, "a"));
      // eslint-disable-next-line no-console
      console.warn("[prisma] No bundled dev.db found; created empty /tmp DB (login will fail until fixed).");
    }
    process.env.DATABASE_URL = `file:${runtimeDbPath}`;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Unable to prepare runtime sqlite database on Vercel", error);
  }
};

prepareVercelSqliteRuntime();

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

export const prisma =
  global.prismaClient ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaClient = prisma;
}
