/**
 * One-shot: copy all rows from a Prisma SQLite dev DB into PostgreSQL.
 *
 * Prerequisites:
 * 1. DATABASE_URL points at PostgreSQL (e.g. postgresql://user:pass@host:5432/db?schema=public)
 * 2. Schema already applied: `npx prisma migrate deploy` (from backend/)
 *
 * Usage (from backend/):
 *   SQLITE_SOURCE_PATH=./prisma/prisma/dev.db npx ts-node --transpile-only prisma/scripts/migrate-sqlite-to-postgres.ts
 *
 * Default SQLITE_SOURCE_PATH: prisma/prisma/dev.db (repo-tracked demo DB)
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import pg from "pg";

const backendRoot = path.resolve(__dirname, "..", "..");
const defaultSqlitePath = path.join(backendRoot, "prisma", "prisma", "dev.db");
const sqlitePath = process.env.SQLITE_SOURCE_PATH
  ? path.resolve(backendRoot, process.env.SQLITE_SOURCE_PATH)
  : defaultSqlitePath;

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
  throw new Error(
    "DATABASE_URL must be a PostgreSQL URL (postgresql:// or postgres://). Set it in root .env before running this script."
  );
}

if (!fs.existsSync(sqlitePath)) {
  throw new Error(`SQLite file not found: ${sqlitePath}`);
}

type PgCol = { column_name: string; data_type: string; udt_name: string };

function convertValue(
  value: unknown,
  col: PgCol | undefined,
  sqliteType: string | undefined
): unknown {
  if (value === null || value === undefined) return null;

  const dt = (col?.data_type ?? "").toLowerCase();
  const udt = (col?.udt_name ?? "").toLowerCase();
  const isTimestampTarget =
    dt === "timestamp without time zone" ||
    dt === "timestamp with time zone" ||
    udt === "timestamp" ||
    udt === "timestamptz";

  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value === "number") {
    if (dt === "boolean" || udt === "bool") {
      return Boolean(value);
    }
    if (isTimestampTarget) {
      const ms = value > 10_000_000_000 ? value : value * 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    if (dt === "boolean" || udt === "bool") {
      if (value === "0" || value === "false") return false;
      if (value === "1" || value === "true") return true;
    }
    if (isTimestampTarget && value.length > 0) {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed)) {
        const raw = Number.parseInt(trimmed, 10);
        const ms = raw > 10_000_000_000 ? raw : raw * 1000;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
      const d = new Date(trimmed);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    if ((dt === "json" || dt === "jsonb" || udt === "json" || udt === "jsonb") && value.length > 0) {
      try {
        return JSON.stringify(JSON.parse(value));
      } catch {
        return value;
      }
    }
    return value;
  }

  const st = (sqliteType ?? "").toUpperCase();
  if (st === "INTEGER" && (dt === "boolean" || udt === "bool")) {
    return Boolean(Number(value));
  }

  return value;
}

async function main() {
  const sqlite = new Database(sqlitePath, { readonly: true });
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows: pgTables } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`
    );

    if (pgTables.length > 0) {
      const list = pgTables.map((r) => `"${r.tablename.replace(/"/g, '""')}"`).join(", ");
      await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }

    await client.query(`SET session_replication_role = replica`);

    const sqliteTables = sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name`
      )
      .all() as { name: string }[];

    for (const { name: tableName } of sqliteTables) {
      const cols = sqlite.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`).all() as {
        name: string;
        type: string;
      }[];

      if (!cols.length) continue;

      const { rows: pgCols } = await client.query<PgCol>(
        `SELECT column_name, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );

      const pgColByName = new Map(pgCols.map((c) => [c.column_name, c]));

      const rowStmt = sqlite.prepare(`SELECT * FROM "${tableName.replace(/"/g, '""')}"`);
      const rows = rowStmt.all() as Record<string, unknown>[];
      if (!rows.length) continue;

      const colNames = cols.map((c) => c.name);
      const quotedCols = colNames.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");

      for (const row of rows) {
        const values = colNames.map((cn) => {
          const sqliteCol = cols.find((c) => c.name === cn);
          return convertValue(row[cn], pgColByName.get(cn), sqliteCol?.type);
        });

        const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
        const sql = `INSERT INTO "${tableName.replace(/"/g, '""')}" (${quotedCols}) VALUES (${placeholders})`;
        await client.query(sql, values);
      }

      // eslint-disable-next-line no-console
      console.log(`Copied ${rows.length} rows -> "${tableName}"`);
    }

    await client.query(`SET session_replication_role = DEFAULT`);
    // eslint-disable-next-line no-console
    console.log("SQLite → PostgreSQL copy finished.");
  } finally {
    await client.end();
    sqlite.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
