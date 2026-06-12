import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { migrate } from "./config/database.js";
import { AuthService } from "./services/authService.js";

describe("api", () => {
  beforeAll(async () => {
    await migrate();
    await new AuthService().bootstrapAdmin();
  });

  it("reports health", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("registers and authenticates a user", async () => {
    const email = `user-${Date.now()}@example.com`;
    const register = await request(createApp()).post("/api/auth/register").send({ email, name: "Test User", password: "Password123!" });
    expect(register.status).toBe(201);
    expect(register.body.token).toBeTypeOf("string");
    const me = await request(createApp()).get("/api/auth/me").set("Authorization", `Bearer ${register.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });
});
