import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { listMessages, streamChat } from "../api";
import type { Citation, Message } from "../types";

interface LocalMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export function ChatWindow({ token, conversationId, onConversation }: { token: string; conversationId?: string; onConversation: (id: string) => void }) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    void listMessages(token, conversationId).then((data) =>
      setMessages(data.messages.filter((m: Message) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content, citations: JSON.parse(m.citations || "[]") })))
    );
  }, [conversationId, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      const result = await streamChat(token, message, conversationId, (tokenPart) => {
        setMessages((current) => {
          const next = [...current];
          next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + tokenPart };
          return next;
        });
      });
      onConversation(result.conversationId);
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { ...next[next.length - 1], citations: result.citations as Citation[] };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-panel">
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-xl text-center">
            <Sparkles className="mx-auto mb-4 text-accent" size={34} />
            <h1 className="text-2xl font-semibold">Ask your documents</h1>
            <p className="mt-2 text-slate-600">Upload enterprise knowledge, then ask grounded questions with citations.</p>
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message, index) => (
            <article key={index} className={`rounded-lg border border-line p-4 ${message.role === "user" ? "ml-12 bg-white" : "mr-12 bg-[#fbfcfd]"}`}>
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{message.role}</div>
              <p className="whitespace-pre-wrap leading-7">{message.content}</p>
              {!!message.citations?.length && (
                <div className="mt-3 border-t border-line pt-3 text-xs text-slate-600">
                  {message.citations.map((citation, i) => <div key={citation.chunkId}>[{i + 1}] {citation.documentName}: {citation.excerpt.slice(0, 140)}</div>)}
                </div>
              )}
            </article>
          ))}
          <div ref={endRef} />
        </div>
      </div>
      <form onSubmit={submit} className="border-t border-line bg-white p-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="min-h-12 flex-1 resize-none rounded-md border border-line px-3 py-2 focus:border-accent focus:outline-none" placeholder="Message the RAG assistant" />
          <button disabled={busy} className="h-12 w-12 rounded-md bg-accent text-white disabled:opacity-50" aria-label="Send message"><Send className="mx-auto" size={20} /></button>
        </div>
      </form>
    </section>
  );
}
