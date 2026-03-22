# Environment Variables

Use the existing root `.env` file. Do not duplicate secrets across files.

## Required backend variables

- `DATABASE_URL`: SQLite/PostgreSQL connection string for Prisma
- `JWT_ACCESS_SECRET`: secret key for access token signing
- `JWT_REFRESH_SECRET`: secret key for refresh token signing
- `JWT_ACCESS_EXPIRES_IN`: token duration (example: `15m`)
- `JWT_REFRESH_EXPIRES_IN`: token duration (example: `7d`)
- `CORS_ORIGIN`: allowed frontend origins (comma-separated, example: `http://localhost:3000`)
- `PORT`: backend server port (default: `5000`)
- `NODE_ENV`: `development` | `test` | `production`

## Optional frontend variables

- `NEXT_PUBLIC_API_BASE_URL`: Axios base URL. Local default via `api.ts` is `http://localhost:5000/api`. On Vercel, use `/api` with `BACKEND_API_ORIGIN`, or the full backend URL `https://<backend>.vercel.app/api` — see [`vercel-deploy.md`](vercel-deploy.md).
- `BACKEND_API_ORIGIN`: Backend origin **only** for Next.js rewrites (no `/api` suffix). Required at **build** time if using `/api` proxy.

## Existing variables ain your `.env`

Your current file already contains Supabase-related keys. Those are preserved and untouched.  
Add the backend JWT/database variables above to enable this Express + Prisma stack.

### SQLite (current default)

Use:

- `DATABASE_URL="file:./prisma/dev.db"`

## Validation behavior

Backend validates env on startup via `backend/src/config/env.ts`.  
If required keys are missing or malformed, startup fails with explicit validation errors.
