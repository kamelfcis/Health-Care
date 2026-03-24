import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

/**
 * Parses and **writes back** `body` / `query` / `params` so handlers receive coerced values.
 * Multipart (`multipart/form-data`) leaves JSON fields as strings; Zod preprocess/transform
 * fixes types but must be applied to `req` (e.g. `specialtyCodes` → array for clinic create).
 */
export const validate =
  (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    }) as { body?: unknown; query?: unknown; params?: unknown };

    if (result.body !== undefined) {
      req.body = result.body;
    }
    if (result.query !== undefined) {
      Object.assign(req.query as Record<string, unknown>, result.query as Record<string, unknown>);
    }
    if (result.params !== undefined) {
      Object.assign(req.params, result.params as Record<string, string>);
    }
    next();
  };
