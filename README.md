# Multi-Clinic HealthCare CRM SaaS

Production-ready monorepo containing:

- `apps/frontend`: Next.js 14 App Router frontend (TypeScript, Tailwind, TanStack Table, React Hook Form, Zod)
- `backend`: Express + Prisma + SQLite API with JWT auth and RBAC

## Architecture decisions

- **Monorepo workspaces**: shared scripts; Vercel uses one project rooted at `apps/frontend` (see Vercel section below).
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

## Vercel deploy (single project: UI + API + demo DB)

Use **one** Vercel project so the site and `/api` share the same URL. The Next app in `apps/frontend` bundles Express from `backend` via `api/index.ts`; `backend/prisma/prisma/dev.db` is tracked for a demo SQLite bundle (ephemeral on serverless — see docs).

Full checklist: **[`docs/vercel-deploy.md`](docs/vercel-deploy.md)**.

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/frontend` |
| **Install Command** | `cd ../.. && npm install` (monorepo workspaces; also set in [`apps/frontend/vercel.json`](apps/frontend/vercel.json)) |
| **Build Command** | `npm run vercel-build` |

Set **Production** (and Preview) env vars: `DATABASE_URL`, JWT secrets, `CORS_ORIGIN` (your `https://….vercel.app`), `NEXT_PUBLIC_API_BASE_URL=/api`. No second backend project or `BACKEND_API_ORIGIN`.

For durable data in production, prefer **PostgreSQL** and point `DATABASE_URL` at it.
