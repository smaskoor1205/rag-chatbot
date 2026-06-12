import { ChangeEvent, useEffect, useState } from "react";
import { FileUp, RefreshCw } from "lucide-react";
import { listDocuments, uploadDocument } from "../api";
import type { DocumentRecord } from "../types";

export function DocumentPanel({ token }: { token: string }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await listDocuments(token);
    setDocuments(data.documents);
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadDocument(token, file);
      await load();
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <section className="border-b border-line bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Documents</h2>
        <button onClick={load} className="rounded p-1 hover:bg-panel" aria-label="Refresh documents"><RefreshCw size={16} /></button>
      </div>
      <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-sm hover:bg-panel">
        <FileUp size={16} />{busy ? "Indexing..." : "Upload PDF, DOCX, TXT, HTML"}
        <input className="sr-only" type="file" accept=".pdf,.docx,.txt,.html,.htm,.md" onChange={upload} disabled={busy} />
      </label>
      <div className="max-h-40 overflow-auto text-sm">
        {documents.map((document) => (
          <div key={document.id} className="flex items-center justify-between border-t border-line py-2">
            <span className="truncate pr-2">{document.name}</span>
            <span className="text-xs text-slate-500">{document.chunk_count} chunks</span>
          </div>
        ))}
      </div>
    </section>
  );
}
