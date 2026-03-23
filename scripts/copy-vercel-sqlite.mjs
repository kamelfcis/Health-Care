/**
 * Copy demo SQLite into apps/frontend/api/dev.db so Next/Vercel file tracing bundles it
 * with the serverless /api entry (cwd on Vercel is often apps/frontend).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "backend", "prisma", "prisma", "dev.db");
const dest = path.join(root, "apps", "frontend", "api", "dev.db");

if (!fs.existsSync(src)) {
  console.warn("[copy-vercel-sqlite] skip: source not found at", src);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("[copy-vercel-sqlite] copied to", dest);
