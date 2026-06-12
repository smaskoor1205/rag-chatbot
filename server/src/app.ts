import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./routes/authRoutes.js";
import { documentRoutes } from "./routes/documentRoutes.js";
import { chatRoutes } from "./routes/chatRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { healthRoutes } from "./routes/healthRoutes.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
  app.use(requestLogger);
  app.use("/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/admin", adminRoutes);
  if (env.NODE_ENV === "production") {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
    app.use(express.static(root));
    app.get("*", (_req, res) => res.sendFile(path.join(root, "index.html")));
  }
  app.use(errorHandler);
  return app;
}
