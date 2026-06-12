import { randomUUID } from "node:crypto";
import { db } from "../config/database.js";
import type { AuthUser, Role } from "../types.js";
import { now } from "../utils/time.js";

interface UserRow extends AuthUser {
  password_hash: string;
  created_at: string;
}

export class UserRepository {
  create(input: { email: string; name: string; passwordHash: string; role: Role }): AuthUser {
    const user = { id: randomUUID(), email: input.email.toLowerCase(), name: input.name, role: input.role, created_at: now() };
    db.prepare("INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES (@id,@email,@name,@passwordHash,@role,@created_at)").run({
      ...user,
      passwordHash: input.passwordHash
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  findByEmail(email: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
  }

  findById(id: string): AuthUser | undefined {
    return db.prepare("SELECT id,email,name,role FROM users WHERE id = ?").get(id) as AuthUser | undefined;
  }

  count(): number {
    return (db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
  }
}
