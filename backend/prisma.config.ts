import path from "path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Add a PostgreSQL (or file: SQLite for local demo) connection string to your root .env."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: databaseUrl
  }
});
