import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserRepository } from "../repositories/userRepository.js";
import type { AuthUser } from "../types.js";
import { AppError } from "../utils/errors.js";

export class AuthService {
  constructor(private users = new UserRepository()) {}

  async bootstrapAdmin(): Promise<void> {
    if (this.users.count() > 0) return;
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    this.users.create({ email: env.ADMIN_EMAIL, name: "Admin", passwordHash, role: "admin" });
  }

  async register(input: { email: string; name: string; password: string }): Promise<{ user: AuthUser; token: string }> {
    if (this.users.findByEmail(input.email)) throw new AppError(409, "Email is already registered", "EMAIL_EXISTS");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = this.users.create({ email: input.email, name: input.name, passwordHash, role: "user" });
    return { user, token: this.sign(user) };
  }

  async login(input: { email: string; password: string }): Promise<{ user: AuthUser; token: string }> {
    const row = this.users.findByEmail(input.email);
    if (!row) throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    const ok = await bcrypt.compare(input.password, row.password_hash);
    if (!ok) throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    const user = { id: row.id, email: row.email, name: row.name, role: row.role };
    return { user, token: this.sign(user) };
  }

  verify(token: string): AuthUser {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    const user = this.users.findById(payload.id);
    if (!user) throw new AppError(401, "User no longer exists", "TOKEN_INVALID");
    return user;
  }

  private sign(user: AuthUser): string {
    return jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
  }
}
