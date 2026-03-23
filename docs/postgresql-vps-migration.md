# PostgreSQL on VPS (migrate from SQLite)

The app uses **Prisma with `provider = "postgresql"`**. `DATABASE_URL` must be a `postgresql://` or `postgres://` URL (SQLite `file:` URLs are only for legacy demo tooling and are not used by the current schema).

## 1. Prepare the server

- Create database `HealthCareDB` (or your name) on PostgreSQL.
- Allow inbound TCP **5432** from your app host (VPS firewall / `pg_hba.conf` as needed).
- Use a strong password; store it only in `.env` / hosting secrets (never commit).

Example URL shape:

`postgresql://USER:PASSWORD@HOST:5432/HealthCareDB?schema=public`

URL-encode special characters in the password (e.g. `@` → `%40`, `#` → `%23`).

## 2. Apply schema (empty database)

From the **repo root**, with `DATABASE_URL` set in root `.env` to your PostgreSQL URL:

```bash
npm run db:migrate:deploy --workspace backend
```

This runs `prisma migrate deploy` and applies [`backend/prisma/migrations`](../backend/prisma/migrations) (baseline + future migrations).

## 3. Copy data from the old SQLite file (optional)

If you have existing data in `backend/prisma/prisma/dev.db`:

```bash
cd backend
npm run db:migrate:sqlite-to-pg
```

Optional env:

- `SQLITE_SOURCE_PATH` — path relative to `backend/` (default: `prisma/prisma/dev.db`).

Order: run **after** `migrate deploy` so tables exist. The script truncates all application tables (not `_prisma_migrations`), then copies rows from SQLite.

## 4. Seed (if you start empty)

```bash
npm run db:seed --workspace backend
```

## 5. Vercel / CI

Set **Production** (and Preview) `DATABASE_URL` to the same PostgreSQL URL. The unified frontend build runs `prisma migrate deploy` in `vercel-build`; it must succeed against that database.

SQLite bundle copy scripts still run for file-based demos but are **skipped at runtime** when `DATABASE_URL` does not start with `file:` (see `backend/src/config/prisma.ts`).

## 6. Verify

- Backend starts without Prisma errors.
- `POST /api/auth/login` works.
- `GET /api/patients` returns data (after copy or seed).

Prisma migrations path is configured in [`backend/prisma.config.ts`](../backend/prisma.config.ts) as `prisma/migrations`. Historical SQLite-only SQL under `backend/prisma/sqlite-migrations/` is **not** applied by `migrate deploy`; it is kept for reference only.
