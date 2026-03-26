import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { AppError } from "./app-error";
import { getClinicImagesUploadDir } from "../config/uploads";

const CLINIC_BLOB_PREFIX = "clinic-images";

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getExtension(fileName: string): string {
  const ext = path.extname(fileName || "").toLowerCase();
  if (!ext || ext.length > 10) return ".bin";
  return ext;
}

function parsePathnameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return null;
  }
}

export async function saveClinicImage(
  file: Express.Multer.File
): Promise<{ imageUrl: string; storageKey: string | null }> {
  const safeOriginal = sanitizeFileName(file.originalname || "clinic-image");
  const fileName = `${Date.now()}-${randomUUID()}${getExtension(safeOriginal)}`;
  const normalizedToken = process.env.BLOB_READ_WRITE_TOKEN?.trim().replace(/^"(.*)"$/, "$1");
  if (normalizedToken) {
    // Normalize accidentally quoted values copied as KEY="value".
    process.env.BLOB_READ_WRITE_TOKEN = normalizedToken;
  }
  const hasBlobToken = Boolean(normalizedToken);
  const isVercelRuntime = Boolean(process.env.VERCEL);

  if (hasBlobToken) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`${CLINIC_BLOB_PREFIX}/${fileName}`, file.buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: file.mimetype || "application/octet-stream"
      });
      return { imageUrl: blob.url, storageKey: blob.pathname ?? parsePathnameFromUrl(blob.url) };
    } catch (error) {
      throw new AppError(`Failed to upload clinic image to blob: ${(error as Error).message}`, 500);
    }
  }

  if (isVercelRuntime) {
    throw new AppError(
      "Clinic image upload requires BLOB_READ_WRITE_TOKEN in production. Please configure Vercel Blob env vars.",
      500
    );
  }

  const uploadDir = getClinicImagesUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });
  const absolutePath = path.join(uploadDir, fileName);
  await fs.writeFile(absolutePath, file.buffer);
  return { imageUrl: `/uploads/clinic-images/${fileName}`, storageKey: null };
}

export async function removeClinicImage(imageUrl?: string | null): Promise<void> {
  if (!imageUrl) return;

  if (imageUrl.startsWith("http")) {
    const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    if (!hasBlobToken) return;
    try {
      const pathname = parsePathnameFromUrl(imageUrl);
      if (!pathname) return;
      const { del } = await import("@vercel/blob");
      await del(pathname);
    } catch {
      // Ignore cleanup failures; image replacement should still succeed.
    }
    return;
  }

  if (!imageUrl.startsWith("/uploads/clinic-images/")) return;
  const fileName = imageUrl.replace("/uploads/clinic-images/", "");
  if (!fileName) return;
  const absolutePath = path.join(getClinicImagesUploadDir(), fileName);
  try {
    await fs.unlink(absolutePath);
  } catch {
    // Ignore missing files during cleanup.
  }
}
