# Vercel deploy (single project: frontend + API + DB)

Deploy **one** Vercel project: the Next.js app in `apps/frontend` bundles the Express API from `backend` via [`api/index.ts`](../apps/frontend/api/index.ts). The browser calls **`/api/...`** on the same origin (no separate backend URL, no 503 from a missing proxy).

## Fix build: `npm error Tracker "idealTree" already exists`

This happens when the Vercel **project** has **Install Command** set to `cd ../.. && npm install` (dashboard override). That overrides [`apps/frontend/vercel.json`](../apps/frontend/vercel.json), which uses **`npm ci`**.

**Fastest (no token):** Open **Project → Settings → General** (e.g. `https://vercel.com/<team>/frontend/settings/general`) → **Build & Development Settings**:

1. **Root Directory:** `apps/frontend`
2. **Install Command:** **clear the field** (empty) so the repo’s `vercel.json` applies, **or** set explicitly to: `cd ../.. && npm ci`
3. **Build Command:** leave empty **or** `npm run vercel-build`
4. **Node.js Version:** `20.x`
5. **Save**, then **Deployments** → **Redeploy** the latest.

## Fix build: `npm error code ENOWORKSPACES` (SWC on Linux / Vercel)

During `next build`, Next may try to run `npm install` to download **`@next/swc-linux-x64-gnu`** (or **`-musl`**). In an **npm workspaces** monorepo, that nested install can fail with **`ENOWORKSPACES`** (“This command does not support workspaces”), even if the build later recovers.

**Fix:** [`apps/frontend/package.json`](../apps/frontend/package.json) lists those packages under **`optionalDependencies`** with the **same version as `next`** (e.g. `14.2.32`). They are installed during `npm ci` at the repo root, so Next does not need to spawn a failing `npm install`. Redeploy after pulling.

**CLI (token):** [Create a token](https://vercel.com/account/tokens), then from the **repo root**:

```powershell
$env:VERCEL_TOKEN = "<paste-token>"
npm run vercel:patch
npm run vercel:deploy
```

## CLI: login and deploy

1. `npx vercel login`
2. **Deploy from the repository root** (not only `apps/frontend`) so the full monorepo (`backend`, lockfile) is uploaded. Use the [`.vercelignore`](../.vercelignore) at the repo root so `node_modules` is not uploaded.

```powershell
cd <path-to-HealthCare-CRM-repo-root>
npx vercel link --yes --scope <your-team-slug>
npx vercel deploy --prod --yes --scope <your-team-slug>
```

### Fix: `npm error Tracker "idealTree" already exists` (CLI / build)

If the Vercel **dashboard** has **Install Command** = `cd ../.. && npm install`, that can trigger this npm bug on the build machine. Set **Install Command** to use **`npm ci`** instead, and **Root Directory** to **`apps/frontend`**.

**Option A — Dashboard:** Project → **Settings** → **General** → Build & Development:

- **Root Directory:** `apps/frontend`
- **Install Command:** `cd ../.. && npm ci`
- **Build Command:** `npm run vercel-build`
- **Node.js Version:** `20.x` (recommended)

**Option B — API script:** Create a token (Vercel → Account → **Tokens**), then from the repo root:

```powershell
$env:VERCEL_TOKEN = "<your-token>"
.\scripts\patch-vercel-project.ps1
```

(Edit `teamId` / `projectId` in the script if your project differs.)

### Git integration (recommended)

1. Push this repo to GitHub.
2. Vercel → **Add New Project** → Import the repository.
3. **Root Directory:** `apps/frontend` (see [`vercel.json`](../apps/frontend/vercel.json)).
4. **Install Command:** `cd ../.. && npm ci` (or leave empty to follow `vercel.json`).
5. Add the [environment variables](#vercel-project-settings) below for Production and Preview, then deploy.

## Demo database (`dev.db`)

`backend/prisma/prisma/dev.db` can be **tracked in git** so CI/build can copy it. Before `next build`, [`scripts/copy-vercel-sqlite.mjs`](../scripts/copy-vercel-sqlite.mjs) copies it to **`apps/frontend/api/dev.db`** so Next **file tracing** bundles it with the `/api` serverless function (see [`next.config.mjs`](../apps/frontend/next.config.mjs) `outputFileTracingIncludes`). At runtime [`backend/src/config/prisma.ts`](../backend/src/config/prisma.ts) finds that file (or paths under `backend/prisma/…`) and copies it to **`/tmp`** for SQLite writes.

## Uploads on Vercel (fix `/uploads/...` 404)

The deployment image under `/var/task` is **read-only**. The API uses **`/tmp/healthcare-crm-uploads`** for writes and **`express.static`** for **`/uploads`**.

**Ship existing files from your machine:** keep images under **`backend/uploads/clinic-images/`** and **`backend/uploads/patient-exams/`** and **commit them** (see [`.gitignore`](../.gitignore): those folders are tracked; other paths under `uploads/` stay ignored). Before `next build`, [`scripts/copy-vercel-uploads.mjs`](../scripts/copy-vercel-uploads.mjs) copies **`backend/uploads`** → **`apps/frontend/api/bundle-uploads`**, which Next traces into the serverless bundle. At cold start, [`backend/src/config/uploads.ts`](../backend/src/config/uploads.ts) copies that bundle into **`/tmp`** so URLs like **`/uploads/clinic-images/<file>.jpg`** resolve.

New uploads in production still land in **`/tmp`** only for that instance—use **S3 / R2 / Blob** if you need persistence across deploys and regions.

## Vercel project settings

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/frontend` |
| **Framework** | Next.js (auto-detected) |
| **Build Command** | `npm run vercel-build` |
| **Install Command** | `cd ../.. && npm ci` (monorepo workspace install from repo root; avoids npm `idealTree` issues) |

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
| `CORS_ORIGIN` | **Required for browser API calls:** include every URL you use, e.g. `https://frontend-nine-henna-86.vercel.app,http://localhost:3000` — **comma-separate** (no spaces). If login returns 500 only in browser, check Vercel **Function logs**; if CORS blocks, add the exact production hostname here. |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` (same-origin API) |

You do **not** need `NEXT_PUBLIC_BACKEND_ORIGIN`, `BACKEND_PROXY_ORIGIN`, or a second Vercel project for the API.

## Why you saw 503 / 404 before

- **503** often happened when a **proxy** or second service was misconfigured or cold.
- **404** on `/api/*` happened when Next had no handler and no rewrite to Express.

With the unified app, `/api` is handled by the same deployment as the UI.

## Fix: `Cannot find package '@hc-backend/app'` / `ERR_MODULE_NOT_FOUND` (API function)

[`api/index.ts`](../apps/frontend/api/index.ts) must **not** rely on the tsconfig-only alias `@hc-backend/*` for the Vercel entry: the emitted `api/index.js` would keep `import … from "@hc-backend/app"`, which is **not** a real package.

**Fix in this repo:**

1. [`apps/frontend/package.json`](../apps/frontend/package.json) depends on the workspace package **`"backend": "*"`**.
2. [`backend/package.json`](../backend/package.json) **`exports`** includes **`"./app": "./dist/src/app.js"`** (compiled output of `src/app.ts`).
3. **`vercel-build`** runs **`npx tsc -p tsconfig.json`** in `backend` before `next build` so `dist/` exists.
4. The handler imports **`import { app } from "backend/app"`**.

## Fix: `Cannot use import statement outside a module` (API function)

If Vercel **Function logs** show `SyntaxError` on `import` in `apps/frontend/api/index.js`, Node is loading that file as **CommonJS**. The compiled handler uses **ESM** `import` (e.g. from `@hc-backend/app`).

**Fix:** [`apps/frontend/package.json`](../apps/frontend/package.json) includes **`"type": "module"`** so `.js` serverless output is treated as ESM. Redeploy after pulling that change.

## SQLite on Vercel

Ephemeral filesystem: data may reset between invocations. For persistent data, use **PostgreSQL** (Neon, Supabase, etc.) and set `DATABASE_URL` accordingly.
