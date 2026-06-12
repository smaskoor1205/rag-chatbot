import type { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/authService.js";
import { AppError } from "../utils/errors.js";

const auth = new AuthService();

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new AppError(401, "Authentication required", "AUTH_REQUIRED"));
  try {
    req.user = auth.verify(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") return next(new AppError(403, "Admin access required", "ADMIN_REQUIRED"));
  next();
}
