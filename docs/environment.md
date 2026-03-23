# Environment Variables

Use the existing root `.env` file. Do not duplicate secrets across files.

## Required backend variables

- `DATABASE_URL`: **PostgreSQL** connection string for Prisma in production; optional `file:` SQLite for local demo only
- `JWT_ACCESS_SECRET`: secret key for access token signing
- `JWT_REFRESH_SECRET`: secret key for refresh token signing
- `JWT_ACCESS_EXPIRES_IN`: token duration (example: `15m`)
- `JWT_REFRESH_EXPIRES_IN`: token duration (example: `7d`)
- `CORS_ORIGIN`: allowed frontend origins (comma-separated, example: `http://localhost:3000`)
- `PORT`: backend server port (default: `5000`)
- `NODE_ENV`: `development` | `test` | `production`

## Optional frontend variables

- `NEXT_PUBLIC_API_BASE_URL`: Axios base URL. If unset, the browser uses same-origin `/api` (Next dev proxies to Express on port **5000** — see `apps/frontend/next.config.mjs`). On Vercel, set `/api` for the unified deployment. Override with `http://localhost:5000/api` only if you skip the proxy.

## Existing variables ain your `.env`

Your current file already contains Supabase-related keys. Those are preserved and untouched.  
Add the backend JWT/database variables above to enable this Express + Prisma stack.

### PostgreSQL (recommended for VPS / production)

Example:

- `DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/HealthCareDB?schema=public"`

Ensure the database exists, TCP `5432` is reachable from your app host, and run migrations: `npm run db:migrate:deploy --workspace backend`.

Full cutover from SQLite: see [`docs/postgresql-vps-migration.md`](postgresql-vps-migration.md).

### SQLite (local demo only)

If you still use a file DB locally, point `DATABASE_URL` at a `file:` URL **relative to `backend/`** when the API runs from the backend workspace (for example `file:./prisma/prisma/dev.db`). On Vercel, SQLite is only for the bundled demo DB; production should use PostgreSQL.

## Validation behavior

Backend validates env on startup via `backend/src/config/env.ts`.  
If required keys are missing or malformed, startup fails with explicit validation errors.
