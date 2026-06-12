import { Router } from "express";

const router = Router();
router.get("/", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
router.get("/ready", (_req, res) => res.json({ status: "ready" }));

export { router as healthRoutes };
