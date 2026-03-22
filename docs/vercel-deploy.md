# Vercel deploy checklist (frontend + backend)

Use **two Vercel projects** from the same GitHub repo. After every push to `main`, both should auto-redeploy if connected.

## CLI: login and deploy

After `npx vercel login`, from repo root:

```powershell
.\scripts\vercel-cli.ps1
```

Or: `cd backend` → `npx vercel deploy --prod --yes` then `cd apps/frontend` → same.

## Demo database (`dev.db`)

`backend/prisma/prisma/dev.db` is **tracked in git** (exception in `.gitignore`) so the Vercel serverless bundle includes your latest SQLite file; at runtime [`backend/src/config/prisma.ts`](../backend/src/config/prisma.ts) copies it to `/tmp` for writes. Push commits that include `dev.db` when you want production demo data updated.

## 1. Backend project

| Setting | Value |
|--------|--------|
| **Root Directory** | `backend` |
| **Framework** | Other |
| **Install Command** | `npm install` |
| **Build Command** | `npm run build:vercel` |
| **Output Directory** | _(leave empty / default)_ |

### Environment variables (Production + Preview)

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `file:./prisma/prisma/dev.db` (demo SQLite) or your **Postgres** URL |
| `JWT_ACCESS_SECRET` | Long random string (16+ chars) |
| `JWT_REFRESH_SECRET` | Different long random string |
| `JWT_ACCESS_EXPIRES_IN` | `15m` or `never` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` or `never` |
| `CORS_ORIGIN` | `https://<your-frontend>.vercel.app` — **comma-separate** multiple origins if needed |

`build:vercel` runs `prisma migrate deploy` — **`DATABASE_URL` must be set before build** so migrations apply.

Copy your backend URL after deploy, e.g. `https://health-care-backend-xxxx.vercel.app`.

## 2. Frontend project

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/frontend` |
| **Framework** | Next.js |

### Environment variables

**Option A — Proxy `/api` to backend (recommended, matches `next.config.mjs` rewrites)**

Set at **build time** (Production + Preview):

| Variable | Value |
|----------|--------|
| `BACKEND_API_ORIGIN` | `https://<your-backend>.vercel.app` — **no trailing slash** |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` |

**Option B — Browser calls backend directly (no rewrites)**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-backend>.vercel.app/api` |
| `BACKEND_API_ORIGIN` | _(leave unset — rewrites disabled)_ |

Ensure backend `CORS_ORIGIN` includes this frontend URL.

## 3. Why login returned 404

`POST https://<frontend>.vercel.app/api/auth/login` only works if:

- **Option A:** `BACKEND_API_ORIGIN` is set **when the frontend is built**, so Next.js rewrites `/api/*` to the backend; or  
- **Option B:** `NEXT_PUBLIC_API_BASE_URL` points to `https://<backend>.vercel.app/api` so the browser never hits the frontend for API calls.

If both are missing/wrong, `/api/*` hits Next.js and returns **404**.

## 4. SQLite on Vercel

Ephemeral filesystem: data may reset. For a real demo/user data, use **PostgreSQL** (Neon, Supabase, etc.) and set `DATABASE_URL` accordingly.
