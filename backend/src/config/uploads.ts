import fs from "fs";
import path from "path";

/**
 * Writable upload root. Vercel serverless filesystem is read-only except /tmp.
 */
export function getUploadRoot(): string {
  if (process.env.VERCEL) {
    return "/tmp/healthcare-crm-uploads";
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
