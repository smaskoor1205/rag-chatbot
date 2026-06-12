import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database as SqlDatabase, type SqlValue } from "sql.js";
import { env } from "./env.js";

fs.mkdirSync(path.dirname(env.DATABASE_PATH), { recursive: true });

type BindParams = SqlValue[] | Record<string, SqlValue>;

let sqlite: SqlDatabase | undefined;

function bindParams(params: BindParams | undefined): BindParams | undefined {
  if (!params || Array.isArray(params)) return params;
  return Object.fromEntries(Object.entries(params).flatMap(([key, value]) => [[`@${key}`, value], [`:${key}`, value], [`$${key}`, value]]));
}

function normalizeParams(params: unknown[]): BindParams | undefined {
  if (params.length === 0) return undefined;
  if (params.length === 1) {
    const only = params[0];
    if (Array.isArray(only)) return only as SqlValue[];
    if (typeof only === "object" && only !== null) return only as Record<string, SqlValue>;
    return [only as SqlValue];
  }
  return params as SqlValue[];
}

function save(): void {
  if (!sqlite) return;
  fs.writeFileSync(env.DATABASE_PATH, Buffer.from(sqlite.export()));
}

export const db = {
  exec(sql: string): void {
    if (!sqlite) throw new Error("Database is not initialized");
    sqlite.exec(sql);
    save();
  },
  prepare(sql: string) {
    return {
      run(...params: unknown[]) {
        if (!sqlite) throw new Error("Database is not initialized");
        const stmt = sqlite.prepare(sql);
        const only = normalizeParams(params);
        stmt.run(bindParams(only));
        stmt.free();
        save();
        return { changes: sqlite.getRowsModified() };
      },
      get(...params: unknown[]) {
        if (!sqlite) throw new Error("Database is not initialized");
        const stmt = sqlite.prepare(sql);
        const only = normalizeParams(params);
        if (params.length > 0) stmt.bind(bindParams(only));
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
      },
      all(...params: unknown[]) {
        if (!sqlite) throw new Error("Database is not initialized");
        const stmt = sqlite.prepare(sql);
        const only = normalizeParams(params);
        if (params.length > 0) stmt.bind(bindParams(only));
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      }
    };
  },
  transaction<T>(fn: () => T) {
    return () => {
      if (!sqlite) throw new Error("Database is not initialized");
      const result = fn();
      save();
      return result;
    };
  }
};

export async function migrate(): Promise<void> {
  if (!sqlite) {
    const SQL = await initSqlJs();
    sqlite = fs.existsSync(env.DATABASE_PATH) ? new SQL.Database(fs.readFileSync(env.DATABASE_PATH)) : new SQL.Database();
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','user')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      path TEXT NOT NULL,
      status TEXT NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      citations TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
  `);
}
