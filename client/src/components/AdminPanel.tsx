import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { adminStats } from "../api";

export function AdminPanel({ token, enabled }: { token: string; enabled: boolean }) {
  const [stats, setStats] = useState<{ users: number; documents: number; messages: number; status: string } | null>(null);
  useEffect(() => {
    if (enabled) void adminStats(token).then(setStats);
  }, [enabled, token]);
  if (!enabled || !stats) return null;
  return (
    <section className="border-b border-line bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Activity size={16} />Admin</div>
      <div className="grid grid-cols-4 gap-2 text-center text-sm">
        <div className="rounded-md bg-panel p-2"><strong>{stats.users}</strong><span className="block text-xs">Users</span></div>
        <div className="rounded-md bg-panel p-2"><strong>{stats.documents}</strong><span className="block text-xs">Docs</span></div>
        <div className="rounded-md bg-panel p-2"><strong>{stats.messages}</strong><span className="block text-xs">Msgs</span></div>
        <div className="rounded-md bg-panel p-2"><strong>{stats.status}</strong><span className="block text-xs">Health</span></div>
      </div>
    </section>
  );
}
