import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32).default("development-secret-with-32-characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  DATABASE_PATH: z.string().default("./data/app.sqlite"),
  UPLOAD_DIR: z.string().default("./uploads"),
  LOG_DIR: z.string().default("./logs"),
  CHROMA_URL: z.string().default("http://localhost:8000"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_CHAT_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!")
});

export const env = schema.parse(process.env);
