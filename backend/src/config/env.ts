import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("file:") || /^https?:\/\//.test(value) || /^postgres(ql)?:\/\//.test(value), {
      message: "DATABASE_URL must be a valid file:, postgres://, postgresql://, http://, or https:// URL"
    }),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("never"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("never"),
  CORS_ORIGIN: z.string().default("http://localhost:3000")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast so invalid env never reaches runtime logic.
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  throw new Error(`Invalid environment variables:\n${issues.join("\n")}`);
}

export const env = parsed.data;
