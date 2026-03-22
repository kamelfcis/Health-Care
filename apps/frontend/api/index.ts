/**
 * Single Vercel deployment: Express API as a Node serverless function.
 * Next.js serves pages; this handler serves /api/* and /uploads/* (see vercel.json rewrites).
 */
import { app } from "@hc-backend/app";

export default app;
