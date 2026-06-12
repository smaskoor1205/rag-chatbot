import type { Conversation, DocumentRecord, Message, User } from "./types";

const API = import.meta.env.VITE_API_URL || "";

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: { message: "Request failed" } }));
    throw new Error(payload.error?.message || "Request failed");
  }
  return (await res.json()) as T;
}

export const login = (email: string, password: string) =>
  api<{ user: User; token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const register = (email: string, name: string, password: string) =>
  api<{ user: User; token: string }>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, name, password }) });

export const listDocuments = (token: string) => api<{ documents: DocumentRecord[] }>("/api/documents", {}, token);
export const listConversations = (token: string) => api<{ conversations: Conversation[] }>("/api/chat/conversations", {}, token);
export const listMessages = (token: string, id: string) => api<{ messages: Message[] }>(`/api/chat/conversations/${id}/messages`, {}, token);
export const adminStats = (token: string) => api<{ users: number; documents: number; messages: number; status: string }>("/api/admin/stats", {}, token);

export async function uploadDocument(token: string, file: File) {
  const data = new FormData();
  data.append("file", file);
  return api<{ document: DocumentRecord }>("/api/documents", { method: "POST", body: data }, token);
}

export async function streamChat(token: string, message: string, conversationId: string | undefined, onToken: (token: string) => void) {
  const res = await fetch(`${API}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, conversationId })
  });
  if (!res.ok || !res.body) throw new Error("Chat request failed");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let donePayload: unknown;
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      const type = event.match(/^event: (.+)$/m)?.[1];
      const data = event.match(/^data: (.+)$/m)?.[1];
      if (!type || !data) continue;
      const parsed = JSON.parse(data);
      if (type === "token") onToken(parsed.token);
      if (type === "done") donePayload = parsed;
    }
  }
  return donePayload as { conversationId: string; citations: unknown[] };
}
