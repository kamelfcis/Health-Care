/**
 * Clears dashboard overrides so apps/frontend/vercel.json is used (npm ci, not npm install).
 * Create a token: https://vercel.com/account/tokens
 * Usage: set VERCEL_TOKEN=... && node scripts/patch-vercel-project.mjs
 */
const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("Set VERCEL_TOKEN (Vercel → Account → Tokens → Create).");
  process.exit(1);
}

const teamId = "team_2IFtuuXSEcZGzUhW1VNyM0JE";
const projectId = "prj_JRxTr4TsDfLnAxImX65046c4o70v";
const uri = `https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`;

const body = {
  rootDirectory: "apps/frontend",
  installCommand: null,
  buildCommand: null,
  nodeVersion: "20.x",
};

const res = await fetch(uri, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error("PATCH failed:", res.status, text);
  process.exit(1);
}

console.log("OK: Vercel project updated.");
console.log("- rootDirectory: apps/frontend");
console.log("- installCommand / buildCommand: cleared (repo vercel.json applies: npm ci)");
console.log("- nodeVersion: 20.x");
console.log("\nNext from repo root:");
console.log('  npx vercel deploy --prod --yes --scope healthcare4314-6641s-projects');
