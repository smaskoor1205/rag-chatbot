export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface DocumentRecord {
  id: string;
  name: string;
  mime_type: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: string;
}

export interface Citation {
  documentId: string;
  documentName: string;
  chunkId: string;
  excerpt: string;
  score: number;
}
