import { randomUUID } from "node:crypto";
import { db } from "../config/database.js";
import type { Citation } from "../types.js";
import { now } from "../utils/time.js";

export interface ConversationRecord {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: string;
  created_at: string;
}

export class ConversationRepository {
  ensure(userId: string, conversationId?: string, title?: string): ConversationRecord {
    if (conversationId) {
      const existing = db.prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?").get(conversationId, userId) as ConversationRecord | undefined;
      if (existing) return existing;
    }
    const time = now();
    const row = { id: randomUUID(), user_id: userId, title: title || "New chat", created_at: time, updated_at: time };
    db.prepare("INSERT INTO conversations VALUES (@id,@user_id,@title,@created_at,@updated_at)").run(row);
    return row;
  }

  addMessage(input: { conversationId: string; role: MessageRecord["role"]; content: string; citations?: Citation[] }): MessageRecord {
    const row = {
      id: randomUUID(),
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      citations: JSON.stringify(input.citations || []),
      created_at: now()
    };
    db.prepare("INSERT INTO messages VALUES (@id,@conversation_id,@role,@content,@citations,@created_at)").run(row);
    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(row.created_at, input.conversationId);
    return row;
  }

  list(userId: string): ConversationRecord[] {
    return db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50").all(userId) as unknown as ConversationRecord[];
  }

  messages(conversationId: string, userId: string): MessageRecord[] {
    return db
      .prepare("SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.conversation_id = ? AND c.user_id = ? ORDER BY m.created_at ASC")
      .all(conversationId, userId) as unknown as MessageRecord[];
  }

  countMessages(): number {
    return (db.prepare("SELECT COUNT(*) AS count FROM messages").get() as { count: number }).count;
  }
}
