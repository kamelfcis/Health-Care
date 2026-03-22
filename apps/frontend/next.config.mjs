import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoSqlitePath = path.join(__dirname, "..", "..", "backend", "prisma", "prisma", "dev.db");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing the Express app from ../../backend
  experimental: {
    externalDir: true,
    // Ensure demo SQLite is copied into the serverless bundle (not imported as JS).
    outputFileTracingIncludes: {
      "/api": [demoSqlitePath],
      "/*": [demoSqlitePath]
    }
  },
  /**
   * Local dev: browser calls same origin `/api` (see src/lib/api.ts), but Express runs on PORT 5000.
   * Vercel uses api/index.ts + vercel.json rewrites instead; production rewrites here are empty.
   */
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        { source: "/api/:path*", destination: "http://localhost:5000/api/:path*" },
        { source: "/uploads/:path*", destination: "http://localhost:5000/uploads/:path*" }
      ];
    }
    return [];
  }
};

export default nextConfig;
