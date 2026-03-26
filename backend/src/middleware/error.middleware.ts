import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error";
import { apiError } from "../utils/api-response";

export const errorMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof ZodError) {
    return res.status(422).json(apiError("Validation failed", error.flatten()));
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json(apiError(error.message));
  }

  if (error instanceof MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json(apiError("Uploaded file is too large. Maximum size is 10MB."));
    }
    return res.status(400).json(apiError(error.message));
  }

  // Log for Vercel/serverless diagnostics (no stack to client)
  // eslint-disable-next-line no-console
  console.error("[api] unhandled error:", error);

  return res.status(500).json(apiError("Internal server error"));
};
