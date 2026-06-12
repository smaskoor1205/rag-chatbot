import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/authService.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const service = new AuthService();
const registerSchema = z.object({ email: z.string().email(), name: z.string().min(2), password: z.string().min(8) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

router.post("/register", async (req, res, next) => {
  try {
    const result = await service.register(registerSchema.parse(req.body));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    res.json(await service.login(loginSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

export { router as authRoutes };
