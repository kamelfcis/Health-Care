import fs from "fs";
import path from "path";

const VERCEL_TMP_UPLOAD_ROOT = "/tmp/healthcare-crm-uploads";

/** Read-only bundle copied at build to apps/frontend/api/bundle-uploads (see scripts/copy-vercel-uploads.mjs). */
function findBundledUploadsRoot(): string | undefined {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "api", "bundle-uploads"),
    path.join(cwd, "apps", "frontend", "api", "bundle-uploads"),
    process.env.UPLOADS_BUNDLE_PATH,
    process.env.LAMBDA_TASK_ROOT
      ? path.join(process.env.LAMBDA_TASK_ROOT, "api", "bundle-uploads")
      : undefined,
    process.env.LAMBDA_TASK_ROOT
      ? path.join(process.env.LAMBDA_TASK_ROOT, "apps", "frontend", "api", "bundle-uploads")
      : undefined
  ].filter((p): p is string => Boolean(p));

  for (const p of candidates) {
    const resolved = path.resolve(p);
    try {
      if (fs.existsSync(resolved) && fs.readdirSync(resolved).length > 0) {
        return resolved;
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

/**
 * Seed /tmp from traced bundle so /uploads/* URLs work (Express cannot write under /var/task).
 */
function prepareVercelUploadsFromBundle(): void {
  if (!process.env.VERCEL) return;
  const src = findBundledUploadsRoot();
  if (!src) {
    // eslint-disable-next-line no-console
    console.warn(
      "[uploads] No api/bundle-uploads in deployment; commit backend/uploads (see docs) or upload new files."
    );
    return;
  }
  try {
    fs.mkdirSync(VERCEL_TMP_UPLOAD_ROOT, { recursive: true });
    fs.cpSync(src, VERCEL_TMP_UPLOAD_ROOT, { recursive: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[uploads] Failed to copy bundle to /tmp", error);
  }
}

prepareVercelUploadsFromBundle();

/**
 * Writable upload root. Vercel serverless filesystem is read-only except /tmp.
 */
export function getUploadRoot(): string {
  if (process.env.VERCEL) {
    return VERCEL_TMP_UPLOAD_ROOT;
  }
  // dist/src/config -> ../../uploads == dist/uploads (matches previous middleware layout)
  return path.resolve(__dirname, "..", "..", "uploads");
}

export function getClinicImagesUploadDir(): string {
  return path.join(getUploadRoot(), "clinic-images");
}

export function getPatientExamsUploadDir(): string {
  return path.join(getUploadRoot(), "patient-exams");
}

/** Ensure dirs exist (safe to call multiple times). */
export function ensureUploadDirs(): void {
  fs.mkdirSync(getClinicImagesUploadDir(), { recursive: true });
  fs.mkdirSync(getPatientExamsUploadDir(), { recursive: true });
}
