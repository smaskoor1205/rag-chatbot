import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { isAppError } from "../utils/errors.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.flatten() } });
    return;
  }
  if (isAppError(error)) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  logger.error("unhandled_error", { requestId: req.requestId, error });
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
}
