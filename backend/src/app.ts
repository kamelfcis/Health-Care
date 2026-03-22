import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import routes from "./routes";
import { env } from "./config/env";
import { errorMiddleware } from "./middleware/error.middleware";

export const app = express();

// Required behind Vercel / proxies for express-rate-limit and correct req.ip
app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true
  })
);

const uploadsDir = path.resolve(__dirname, "..", "uploads");
const fallbackUploadsDir = path.resolve(process.cwd(), "uploads");
const staticUploadsDir = fs.existsSync(uploadsDir) ? uploadsDir : fallbackUploadsDir;
app.use("/uploads", express.static(staticUploadsDir));
app.use("/api", routes);
app.use(errorMiddleware);
