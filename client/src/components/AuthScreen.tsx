import { FormEvent, useState } from "react";
import { Bot, LogIn } from "lucide-react";

export function AuthScreen({ onLogin, onRegister }: { onLogin: (email: string, password: string) => Promise<void>; onRegister: (email: string, name: string, password: string) => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("admin@example.com");
  const [name, setName] = useState("Admin");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") await onLogin(email, password);
      else await onRegister(email, name, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-white"><Bot size={22} /></div>
          <div>
            <h1 className="text-xl font-semibold">Enterprise RAG Chatbot</h1>
            <p className="text-sm text-slate-600">Secure document-grounded chat</p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-md border border-line p-1">
          <button type="button" className={`rounded px-3 py-2 ${mode === "login" ? "bg-ink text-white" : ""}`} onClick={() => setMode("login")}>Sign in</button>
          <button type="button" className={`rounded px-3 py-2 ${mode === "register" ? "bg-ink text-white" : ""}`} onClick={() => setMode("register")}>Register</button>
        </div>
        {mode === "register" && <label className="mb-3 block text-sm">Name<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} /></label>}
        <label className="mb-3 block text-sm">Email<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="mb-4 block text-sm">Password<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 font-medium text-white"><LogIn size={18} />Continue</button>
      </form>
    </main>
  );
}
