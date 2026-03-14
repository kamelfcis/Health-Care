import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prepareVercelSqliteRuntime = () => {
  const isVercel = Boolean(process.env.VERCEL);
  const configuredUrl = process.env.DATABASE_URL ?? "";
  const isSqlite = configuredUrl.startsWith("file:");
  if (!isVercel || !isSqlite) return;

  const runtimeDbPath = "/tmp/healthcare-crm.db";
  const sourceDbPath = path.resolve(process.cwd(), "prisma", "prisma", "dev.db");

  try {
    if (!fs.existsSync(runtimeDbPath)) {
      fs.mkdirSync(path.dirname(runtimeDbPath), { recursive: true });
      if (fs.existsSync(sourceDbPath)) {
        fs.copyFileSync(sourceDbPath, runtimeDbPath);
      } else {
        fs.closeSync(fs.openSync(runtimeDbPath, "a"));
      }
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
