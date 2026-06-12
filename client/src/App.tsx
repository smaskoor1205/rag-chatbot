import { useEffect, useState } from "react";
import { listConversations } from "./api";
import { AuthScreen } from "./components/AuthScreen";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { DocumentPanel } from "./components/DocumentPanel";
import { AdminPanel } from "./components/AdminPanel";
import { useAuth } from "./hooks/useAuth";
import type { Conversation } from "./types";

export function App() {
  const auth = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();

  async function refreshConversations() {
    if (!auth.token) return;
    const data = await listConversations(auth.token);
    setConversations(data.conversations);
  }

  useEffect(() => {
    void refreshConversations();
  }, [auth.token]);

  if (!auth.user) return <AuthScreen onLogin={auth.login} onRegister={auth.register} />;

  return (
    <div className="flex h-full">
      <Sidebar user={auth.user} conversations={conversations} activeId={activeId} onSelect={setActiveId} onNew={() => setActiveId(undefined)} onLogout={auth.logout} />
      <main className="flex min-w-0 flex-1 flex-col">
        <DocumentPanel token={auth.token} />
        <AdminPanel token={auth.token} enabled={auth.user.role === "admin"} />
        <ChatWindow token={auth.token} conversationId={activeId} onConversation={(id) => { setActiveId(id); void refreshConversations(); }} />
      </main>
    </div>
  );
}
