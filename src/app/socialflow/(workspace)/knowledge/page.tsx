"use client";

import { useEffect, useRef, useState } from "react";

type Doc = {
  id: string;
  name: string;
  type: "pdf" | "url" | "text";
  source_url: string | null;
  created_at: string;
};

type Panel = "none" | "upload" | "url";

type ListResponse = { ok: true; docs: Doc[] } | { ok: false; error: string };
type DeleteResponse = { ok: true } | { ok: false; error: string };
type SaveResponse = { ok: true; doc: Doc } | { ok: false; error?: string; message?: string };

export default function KnowledgeBasePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>("none");
  const [error, setError] = useState<string | null>(null);

  async function loadDocs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/knowledge");
      const json = await res.json() as ListResponse;
      if (json.ok) setDocs(json.docs);
      else setError(json.error ?? "Failed to load documents");
    } catch {
      setError("Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadDocs(); }, []);

  function togglePanel(next: Panel) {
    setPanel((prev) => (prev === next ? "none" : next));
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      const res = await fetch(`/api/socialflow/knowledge/${id}`, { method: "DELETE" });
      const json = await res.json() as DeleteResponse;
      if (json.ok) setDocs((prev) => prev.filter((d) => d.id !== id));
      else setError(json.error ?? "Failed to delete");
    } catch {
      setError("Unexpected error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Knowledge Base</h1>
        <p className="mt-2 text-sm text-slate-500">
          Añade documentos PDF, textos o URLs que la IA usará como contexto al generar campañas y contenido.
          El contenido se inyecta automáticamente en el pipeline de generación de cada nuevo tenant.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => togglePanel("upload")}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              panel === "upload"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Subir documento
          </button>
          <button
            type="button"
            onClick={() => togglePanel("url")}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              panel === "url"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Añadir URL
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Upload panel */}
      {panel === "upload" && (
        <UploadPanel
          onSuccess={(doc) => {
            setDocs((prev) => [doc, ...prev]);
            setPanel("none");
          }}
          onError={setError}
        />
      )}

      {/* URL panel */}
      {panel === "url" && (
        <UrlPanel
          onSuccess={(doc) => {
            setDocs((prev) => [doc, ...prev]);
            setPanel("none");
          }}
          onError={setError}
        />
      )}

      {/* Document list */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            Documentos{" "}
            {!loading && (
              <span className="ml-1 text-sm font-normal text-slate-500">({docs.length})</span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">Cargando...</div>
        ) : docs.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">No hay documentos todavía</p>
            <p className="mt-1 text-xs text-slate-400">
              Sube un PDF, un archivo de texto, o añade una URL para entrenar la IA con tu contenido.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((doc) => (
              <DocRow key={doc.id} doc={doc} onDelete={handleDelete} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DocRow({ doc, onDelete }: { doc: Doc; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const typeLabel: Record<Doc["type"], string> = {
    pdf: "PDF",
    url: "URL",
    text: "Texto",
  };

  const typeBg: Record<Doc["type"], string> = {
    pdf: "bg-orange-50 text-orange-700",
    url: "bg-sky-50 text-sky-700",
    text: "bg-slate-100 text-slate-600",
  };

  const date = new Date(doc.created_at).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  async function handleDelete() {
    setDeleting(true);
    await onDelete(doc.id);
    setDeleting(false);
  }

  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${typeBg[doc.type]}`}>
            {typeLabel[doc.type]}
          </span>
          <span className="truncate text-sm font-medium text-slate-800">{doc.name}</span>
        </div>
        {doc.source_url && (
          <a
            href={doc.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate text-xs text-slate-400 hover:text-sky-600 hover:underline"
          >
            {doc.source_url}
          </a>
        )}
        <p className="mt-0.5 text-xs text-slate-400">{date}</p>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="flex-shrink-0 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
      >
        {deleting ? "Eliminando..." : "Eliminar"}
      </button>
    </li>
  );
}

function UploadPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (doc: Doc) => void;
  onError: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setLocalError("Selecciona un archivo"); return; }
    setUploading(true);
    setLocalError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (name.trim()) fd.append("name", name.trim());
      const res = await fetch("/api/socialflow/knowledge/upload", { method: "POST", body: fd });
      const json = await res.json() as SaveResponse;
      if (json.ok) {
        onSuccess(json.doc);
      } else {
        setLocalError(json.message ?? json.error ?? "Error al subir");
      }
    } catch {
      setLocalError("Error inesperado");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Subir documento (PDF o texto)</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">Nombre personalizado (opcional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Guía de marca 2024"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">Archivo <span className="text-slate-400">(PDF, .txt — máx. 10 MB)</span></label>
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white px-6 py-8 text-center transition hover:border-slate-400"
          >
            {file ? (
              <div>
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-slate-300">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="text-sm text-slate-500">Haz clic para seleccionar un archivo</p>
                <p className="mt-0.5 text-xs text-slate-400">PDF o texto plano</p>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </div>
        {localError && <p className="text-sm text-red-600">{localError}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={uploading || !file}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {uploading ? "Subiendo..." : "Subir documento"}
          </button>
        </div>
      </form>
    </div>
  );
}

function UrlPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (doc: Doc) => void;
  onError: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) { setLocalError("Introduce una URL"); return; }
    setLoading(true);
    setLocalError(null);
    try {
      const res = await fetch("/api/socialflow/knowledge/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined }),
      });
      const json = await res.json() as SaveResponse;
      if (json.ok) {
        onSuccess(json.doc);
      } else {
        setLocalError(json.message ?? json.error ?? "Error al procesar la URL");
      }
    } catch {
      setLocalError("Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Añadir contenido desde URL</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tu-web.com/pagina-de-servicios"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">Nombre personalizado (opcional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Página de servicios"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>
        {localError && <p className="text-sm text-red-600">{localError}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Procesando..." : "Guardar contenido"}
        </button>
      </form>
    </div>
  );
}
