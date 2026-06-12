import { LogOut, MessageSquarePlus, Shield } from "lucide-react";
import type { Conversation, User } from "../types";

export function Sidebar({ user, conversations, activeId, onSelect, onNew, onLogout }: { user: User; conversations: Conversation[]; activeId?: string; onSelect: (id: string) => void; onNew: () => void; onLogout: () => void }) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-ink text-white">
      <div className="border-b border-white/10 p-4">
        <button onClick={onNew} className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 hover:bg-white/10"><MessageSquarePlus size={18} />New chat</button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Chat history">
        {conversations.map((conversation) => (
          <button key={conversation.id} onClick={() => onSelect(conversation.id)} className={`mb-1 w-full truncate rounded-md px-3 py-2 text-left text-sm ${activeId === conversation.id ? "bg-white/16" : "hover:bg-white/10"}`}>
            {conversation.title}
          </button>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 text-sm">
        <div className="mb-3 flex items-center gap-2"><Shield size={16} />{user.name} · {user.role}</div>
        <button onClick={onLogout} className="flex items-center gap-2 text-slate-200 hover:text-white"><LogOut size={16} />Sign out</button>
      </div>
    </aside>
  );
}
