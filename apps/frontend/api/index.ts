/**
 * Single Vercel deployment: Express API as a Node serverless function.
 * Next.js serves pages; this handler serves /api/* and /uploads/* (see vercel.json rewrites).
 */
// Real workspace dependency (`backend/app` → compiled `dist/src/app.js`), not tsconfig paths only:
// emitted `api/index.js` must use a resolvable package for Node ESM on Vercel.
import { app } from "backend/app";

export default app;
