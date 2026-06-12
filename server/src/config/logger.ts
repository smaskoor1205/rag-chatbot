import fs from "node:fs";
import path from "node:path";
import winston from "winston";
import { env } from "./env.js";

fs.mkdirSync(env.LOG_DIR, { recursive: true });

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(env.LOG_DIR, "app.log") })
  ]
});
