import { z, type ZodSchema } from "zod";
import type { Request, Response, NextFunction } from "express";

/**
 * Express middleware factory: validates request body against a Zod schema.
 * Returns 400 with structured error on failure.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: "بيانات غير صالحة",
        errors,
      });
    }
    // Replace body with parsed (coerced/transformed) data
    req.body = result.data;
    next();
  };
}

/**
 * Validates query parameters against a Zod schema.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: "معايير البحث غير صالحة",
        errors,
      });
    }
    req.query = result.data;
    next();
  };
}

/**
 * Validates route params against a Zod schema.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "معرف غير صالح",
      });
    }
    next();
  };
}

// ── Common reusable schemas for route params / queries ──
export const idParamSchema = z.object({
  id: z.string().min(1).max(100),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const loginBodySchema = z.object({
  username: z.string().min(2).max(100).trim(),
  password: z.string().min(4).max(200),
});

export const registerBodySchema = z.object({
  username: z.string().min(2).max(50).trim(),
  password: z.string().min(6).max(200),
  displayName: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().max(200).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  country: z.string().max(100).optional(),
});
