# Vercel deploy (single project: frontend + API + DB)

Deploy **one** Vercel project: the Next.js app in `apps/frontend` bundles the Express API from `backend` via [`api/index.ts`](../apps/frontend/api/index.ts). The browser calls **`/api/...`** on the same origin (no separate backend URL, no 503 from a missing proxy).

## CLI: login and deploy

After `npx vercel login`, from `apps/frontend`:

```powershell
npx vercel deploy --prod
```

### Git integration (recommended)

1. Push this repo to GitHub.
2. Vercel → **Add New Project** → Import the repository.
3. **Root Directory:** `apps/frontend` (install/build commands are read from [`vercel.json`](../apps/frontend/vercel.json)).
4. Add the [environment variables](#vercel-project-settings) below for Production and Preview, then deploy.

## Demo database (`dev.db`)

`backend/prisma/prisma/dev.db` can be **tracked in git** so the serverless bundle includes SQLite; at runtime [`backend/src/config/prisma.ts`](../backend/src/config/prisma.ts) copies it to `/tmp` for writes. Push commits that include `dev.db` when you want production demo data updated.

## Vercel project settings

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/frontend` |
| **Framework** | Next.js (auto-detected) |
| **Build Command** | `npm run vercel-build` |
| **Install Command** | `cd ../.. && npm install` (set in [`vercel.json`](../apps/frontend/vercel.json) so the whole workspace installs) |

`vercel-build` runs `prisma generate` + `migrate deploy` in `backend`, then `next build`. **`DATABASE_URL` must be set before build** so migrations run.

Routing: [`vercel.json`](../apps/frontend/vercel.json) rewrites `/api/*` and `/uploads/*` to the serverless Express entry so API and uploaded files work on one domain. The same file sets **`installCommand`** and **`buildCommand`** for the monorepo.

## Environment variables (Production + Preview)

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `file:./prisma/prisma/dev.db` (demo SQLite) or your **Postgres** URL |
| `JWT_ACCESS_SECRET` | Long random string (16+ chars) |
| `JWT_REFRESH_SECRET` | Different long random string |
| `JWT_ACCESS_EXPIRES_IN` | `15m` or `never` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` or `never` |
| `CORS_ORIGIN` | Your app URL, e.g. `https://<project>.vercel.app` — **comma-separate** multiple origins if needed |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` (same-origin API) |

You do **not** need `NEXT_PUBLIC_BACKEND_ORIGIN`, `BACKEND_PROXY_ORIGIN`, or a second Vercel project for the API.

## Why you saw 503 / 404 before

- **503** often happened when a **proxy** or second service was misconfigured or cold.
- **404** on `/api/*` happened when Next had no handler and no rewrite to Express.

With the unified app, `/api` is handled by the same deployment as the UI.

## SQLite on Vercel

Ephemeral filesystem: data may reset between invocations. For persistent data, use **PostgreSQL** (Neon, Supabase, etc.) and set `DATABASE_URL` accordingly.
