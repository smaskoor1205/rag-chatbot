import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { migrate } from "./config/database.js";
import { createApp } from "./app.js";
import { AuthService } from "./services/authService.js";

await migrate();
await new AuthService().bootstrapAdmin();

createApp().listen(env.PORT, () => {
  logger.info("server_started", { port: env.PORT, environment: env.NODE_ENV });
});
