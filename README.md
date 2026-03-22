# Multi-Clinic HealthCare CRM SaaS

Production-ready monorepo containing:

- `apps/frontend`: Next.js 14 App Router frontend (TypeScript, Tailwind, TanStack Table, React Hook Form, Zod)
- `backend`: Express + Prisma + SQLite API with JWT auth and RBAC

## Architecture decisions

- **Monorepo workspaces**: shared scripts and independent app deployments.
- **Layered backend**: routes -> controllers -> services -> Prisma.
- **Tenant isolation**: APIs read `clinicId` from JWT and always scope data at query level.
- **Role-driven access**: middleware (`requireAuth`, `allowRoles`) centralizes authorization.
- **Secure-by-default backend**: `helmet`, `cors`, rate limiting, Zod validation, and env schema validation.

## Quick start (local)

1. Install dependencies:
   - `npm install`
2. Ensure root `.env` includes backend + frontend keys from [`docs/environment.md`](docs/environment.md).
3. Generate Prisma client and run DB setup:
   - `npm run db:migrate`
   - `npm run db:seed`
4. Start frontend + backend together:
   - `npm run dev`

Frontend runs on `http://localhost:3000` and backend on `http://localhost:5000`.

## Main scripts

- `npm run dev`: run frontend and backend concurrently
- `npm run dev:frontend`: run frontend only
- `npm run dev:backend`: run backend only
- `npm run build`: build both applications
- `npm run lint`: type/lint checks for both applications
- `npm run db:migrate`: run Prisma migration
- `npm run db:seed`: run seed script

## Windows VPS (PM2 quick run)

This repository includes `ecosystem.config.cjs` for PM2 with non-conflicting ports:

- Backend: `5000`
- Frontend: `3001`

Basic production flow:

1. `npm install`
2. `npm run build`
3. `npm run db:migrate --workspace backend`
4. `pm2 start ecosystem.config.cjs`
5. `pm2 save`

## Branding

- Main logo: `healthcare.jpeg` (copied to `apps/frontend/public/healthcare.jpeg`)
- Theme colors:
  - Navy: `#0B2A4A`
  - Orange: `#F27A1A`

## Vercel quick-demo deploy (frontend + backend)

Deploy **two** Vercel projects from the same repository. Full step-by-step (env vars, build command, why login 404s): **[`docs/vercel-deploy.md`](docs/vercel-deploy.md)**.

Summary:

1. **Backend** (`backend/`)
   - **Build Command:** `npm run build:vercel` (runs `prisma migrate deploy` + compile).
   - Set `DATABASE_URL`, JWT secrets, `CORS_ORIGIN` (your frontend `https://….vercel.app`).

2. **Frontend** (`apps/frontend/`)
   - **Rewrites (recommended):** `BACKEND_API_ORIGIN=https://<backend>.vercel.app` and `NEXT_PUBLIC_API_BASE_URL=/api` (must be set at **build** time).
   - **Or direct API:** `NEXT_PUBLIC_API_BASE_URL=https://<backend>.vercel.app/api` and leave `BACKEND_API_ORIGIN` unset.

3. **SQLite on Vercel**
   - Ephemeral; for real persistence use PostgreSQL and point `DATABASE_URL` at it.
