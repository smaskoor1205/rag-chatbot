import { randomUUID } from "node:crypto";
import { db } from "../config/database.js";
import { now } from "../utils/time.js";

export interface DocumentRecord {
  id: string;
  owner_id: string;
  name: string;
  mime_type: string;
  path: string;
  status: "uploaded" | "indexed" | "failed";
  chunk_count: number;
  created_at: string;
}

export interface ChunkRecord {
  id: string;
  document_id: string;
  content: string;
  metadata: string;
  token_count: number;
  created_at: string;
}

export class DocumentRepository {
  create(input: { ownerId: string; name: string; mimeType: string; path: string }): DocumentRecord {
    const row: DocumentRecord = {
      id: randomUUID(),
      owner_id: input.ownerId,
      name: input.name,
      mime_type: input.mimeType,
      path: input.path,
      status: "uploaded",
      chunk_count: 0,
      created_at: now()
    };
    db.prepare("INSERT INTO documents VALUES (@id,@owner_id,@name,@mime_type,@path,@status,@chunk_count,@created_at)").run(row);
    return row;
  }

  list(ownerId: string, role: string): DocumentRecord[] {
    const sql = role === "admin" ? "SELECT * FROM documents ORDER BY created_at DESC" : "SELECT * FROM documents WHERE owner_id = ? ORDER BY created_at DESC";
    return (role === "admin" ? db.prepare(sql).all() : db.prepare(sql).all(ownerId)) as unknown as DocumentRecord[];
  }

  find(id: string): DocumentRecord | undefined {
    return db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRecord | undefined;
  }

  replaceChunks(documentId: string, chunks: Array<{ content: string; metadata: object; tokenCount: number }>): ChunkRecord[] {
    const created = now();
    const rows = chunks.map((chunk) => ({
      id: randomUUID(),
      document_id: documentId,
      content: chunk.content,
      metadata: JSON.stringify(chunk.metadata),
      token_count: chunk.tokenCount,
      created_at: created
    }));
    db.transaction(() => {
      db.prepare("DELETE FROM chunks WHERE document_id = ?").run(documentId);
      const insert = db.prepare("INSERT INTO chunks VALUES (@id,@document_id,@content,@metadata,@token_count,@created_at)");
      rows.forEach((row) => insert.run(row));
      db.prepare("UPDATE documents SET status = 'indexed', chunk_count = ? WHERE id = ?").run(rows.length, documentId);
    })();
    return rows;
  }

  count(): number {
    return (db.prepare("SELECT COUNT(*) AS count FROM documents").get() as { count: number }).count;
  }
}
