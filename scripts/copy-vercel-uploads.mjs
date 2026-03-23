/**
 * Copy backend/uploads into apps/frontend/api/bundle-uploads so Next/Vercel file tracing
 * ships clinic-images / patient-exams with the serverless /api entry. At runtime (VERCEL),
 * backend copies this tree into /tmp for a writable static root (see config/uploads.ts).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "backend", "uploads");
const dest = path.join(root, "apps", "frontend", "api", "bundle-uploads");

if (!fs.existsSync(src)) {
  console.warn("[copy-vercel-uploads] skip: no folder at", src);
  process.exit(0);
}

const entries = fs.readdirSync(src);
if (entries.length === 0) {
  console.warn("[copy-vercel-uploads] skip: empty", src);
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("[copy-vercel-uploads] copied", src, "->", dest);
