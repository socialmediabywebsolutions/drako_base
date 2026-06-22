"use client";

import { useEffect, useRef, useState } from "react";

type DocType = "pdf" | "url" | "text" | "competitor" | "market_analysis";

type Doc = {
  id: string;
  name: string;
  type: DocType;
  source_url: string | null;
  created_at: string;
};

type Panel = "none" | "upload" | "url" | "competitor" | "market";

type ListResponse = { ok: true; docs: Doc[] } | { ok: false; error: string };
type DeleteResponse = { ok: true } | { ok: false; error: string };
type SaveResponse = { ok: true; doc: Doc } | { ok: false; error?: string; message?: string };

const TYPE_LABEL: Record<DocType, string> = {
  pdf: "PDF",
  url: "URL",
  text: "Texto",
  competitor: "Competidor",
  market_analysis: "Mercado",
};

const TYPE_BG: Record<DocType, string> = {
  pdf: "bg-orange-50 text-orange-700",
  url: "bg-sky-50 text-sky-700",
  text: "bg-slate-100 text-slate-600",
  competitor: "bg-purple-50 text-purple-700",
  market_analysis: "bg-emerald-50 text-emerald-700",
};

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

  function onSaved(doc: Doc) {
    setDocs((prev) => [doc, ...prev]);
    setPanel("none");
  }

  const marketDocs = docs.filter((d) => d.type === "market_analysis");
  const competitorDocs = docs.filter((d) => d.type === "competitor");
  const knowledgeDocs = docs.filter((d) => d.type !== "market_analysis" && d.type !== "competitor");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Knowledge Base</h1>
        <p className="mt-1 text-sm text-slate-500">
          Documentos, competidores y análisis de mercado que la IA usa como contexto al generar campañas.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton active={panel === "upload"} onClick={() => togglePanel("upload")} icon="upload">
            Subir documento
          </ActionButton>
          <ActionButton active={panel === "url"} onClick={() => togglePanel("url")} icon="globe">
            Añadir URL
          </ActionButton>
          <ActionButton active={panel === "competitor"} onClick={() => togglePanel("competitor")} icon="users">
            Analizar competidor
          </ActionButton>
          <ActionButton active={panel === "market"} onClick={() => togglePanel("market")} icon="chart">
            Análisis de mercado
          </ActionButton>
        </div>

        {error && (
          <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Panels */}
      {panel === "upload" && <UploadPanel onSuccess={onSaved} />}
      {panel === "url" && <UrlPanel onSuccess={onSaved} />}
      {panel === "competitor" && <CompetitorPanel onSuccess={onSaved} />}
      {panel === "market" && <MarketPanel onSuccess={onSaved} />}

      {/* Market analysis */}
      {(marketDocs.length > 0 || !loading) && (
        <DocSection
          title="Análisis de mercado"
          badge="Mercado"
          badgeStyle={TYPE_BG.market_analysis}
          docs={marketDocs}
          emptyText="Sin análisis de mercado todavía. Haz clic en «Análisis de mercado» para generar uno con IA."
          loading={loading}
          onDelete={handleDelete}
        />
      )}

      {/* Competitors */}
      {(competitorDocs.length > 0 || !loading) && (
        <DocSection
          title="Competidores"
          badge="Competidor"
          badgeStyle={TYPE_BG.competitor}
          docs={competitorDocs}
          emptyText="Sin competidores analizados. Añade uno con «Analizar competidor»."
          loading={loading}
          onDelete={handleDelete}
        />
      )}

      {/* Knowledge docs */}
      <DocSection
        title="Documentos de marca"
        badge="Docs"
        badgeStyle=""
        docs={knowledgeDocs}
        emptyText="Sube un PDF o añade una URL con contenido de tu marca para entrenar la IA."
        loading={loading}
        onDelete={handleDelete}
      />
    </div>
  );
}

/* ── Section component ──────────────────────────────────────────────────── */

function DocSection({
  title, docs, emptyText, loading, onDelete,
}: {
  title: string;
  badge: string;
  badgeStyle: string;
  docs: Doc[];
  emptyText: string;
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-6 py-4">
        <h2 className="text-base font-semibold text-slate-800">
          {title}
          {!loading && (
            <span className="ml-1.5 text-sm font-normal text-slate-400">({docs.length})</span>
          )}
        </h2>
      </div>

      {loading ? (
        <div className="px-6 py-8 text-center text-sm text-slate-400">Cargando...</div>
      ) : docs.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-slate-400">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {docs.map((doc) => (
            <DocRow key={doc.id} doc={doc} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Doc row ─────────────────────────────────────────────────────────────── */

function DocRow({ doc, onDelete }: { doc: Doc; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const date = new Date(doc.created_at).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });

  async function handleDelete() {
    setDeleting(true);
    await onDelete(doc.id);
    setDeleting(false);
  }

  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TYPE_BG[doc.type]}`}>
            {TYPE_LABEL[doc.type]}
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

/* ── Panel: Upload ───────────────────────────────────────────────────────── */

function UploadPanel({ onSuccess }: { onSuccess: (doc: Doc) => void }) {
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
      if (json.ok) onSuccess(json.doc);
      else setLocalError(json.message ?? json.error ?? "Error al subir");
    } catch { setLocalError("Error inesperado"); }
    finally { setUploading(false); }
  }

  return (
    <Panel title="Subir documento (PDF o texto)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre personalizado (opcional)">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guía de marca 2024" className={inputCls} />
        </Field>
        <Field label={<>Archivo <span className="text-slate-400">(PDF, .txt — máx. 10 MB)</span></>}>
          <div onClick={() => inputRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white px-6 py-8 text-center transition hover:border-slate-400">
            {file ? (
              <div><p className="text-sm font-medium text-slate-700">{file.name}</p><p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p></div>
            ) : (
              <p className="text-sm text-slate-500">Haz clic para seleccionar un archivo</p>
            )}
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </Field>
        {localError && <p className="text-sm text-red-600">{localError}</p>}
        <SubmitButton loading={uploading} disabled={!file}>{uploading ? "Subiendo..." : "Subir documento"}</SubmitButton>
      </form>
    </Panel>
  );
}

/* ── Panel: URL ──────────────────────────────────────────────────────────── */

function UrlPanel({ onSuccess }: { onSuccess: (doc: Doc) => void }) {
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined }),
      });
      const json = await res.json() as SaveResponse;
      if (json.ok) onSuccess(json.doc);
      else setLocalError(json.message ?? json.error ?? "Error al procesar la URL");
    } catch { setLocalError("Error inesperado"); }
    finally { setLoading(false); }
  }

  return (
    <Panel title="Añadir contenido desde URL">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="URL"><input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-web.com/servicios" className={inputCls} autoFocus /></Field>
        <Field label="Nombre personalizado (opcional)"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Página de servicios" className={inputCls} /></Field>
        {localError && <p className="text-sm text-red-600">{localError}</p>}
        <SubmitButton loading={loading}>{loading ? "Procesando..." : "Guardar contenido"}</SubmitButton>
      </form>
    </Panel>
  );
}

/* ── Panel: Competitor ───────────────────────────────────────────────────── */

function CompetitorPanel({ onSuccess }: { onSuccess: (doc: Doc) => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !url.trim()) { setLocalError("Introduce el nombre o la URL del competidor"); return; }
    setLoading(true);
    setLocalError(null);
    try {
      const res = await fetch("/api/socialflow/knowledge/analyze-competitor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, url: url.trim() || undefined }),
      });
      const json = await res.json() as SaveResponse;
      if (json.ok) onSuccess(json.doc);
      else setLocalError(json.message ?? json.error ?? "Error al analizar el competidor");
    } catch { setLocalError("Error inesperado"); }
    finally { setLoading(false); }
  }

  return (
    <Panel title="Analizar competidor con IA">
      <p className="mb-4 text-xs text-slate-500">
        Introduce el nombre y/o la URL del competidor. La IA extraerá sus servicios, fortalezas, patrones de contenido y oportunidades de diferenciación.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre del competidor"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agencia XYZ" className={inputCls} autoFocus /></Field>
        <Field label="URL de su web (opcional — mejora el análisis)"><input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://agenciaxyz.com" className={inputCls} /></Field>
        {localError && <p className="text-sm text-red-600">{localError}</p>}
        <SubmitButton loading={loading}>{loading ? "Analizando con IA..." : "Analizar competidor"}</SubmitButton>
      </form>
    </Panel>
  );
}

/* ── Panel: Market ───────────────────────────────────────────────────────── */

function MarketPanel({ onSuccess }: { onSuccess: (doc: Doc) => void }) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setLocalError(null);
    try {
      const res = await fetch("/api/socialflow/knowledge/analyze-market", { method: "POST" });
      const json = await res.json() as SaveResponse;
      if (json.ok) onSuccess(json.doc);
      else setLocalError(json.message ?? json.error ?? "Error al generar el análisis");
    } catch { setLocalError("Error inesperado"); }
    finally { setLoading(false); }
  }

  return (
    <Panel title="Análisis de mercado con IA">
      <p className="mb-5 text-sm text-slate-600">
        La IA analizará el nicho de tu marca (configurado en el Perfil) y generará un informe con hashtags en tendencia, palabras clave virales, formatos que funcionan en tu sector y oportunidades de mercado.
      </p>
      <p className="mb-5 text-xs text-slate-400">
        El análisis se basa en tu perfil de marca. Si no tienes nicho configurado aún, configúralo primero en <strong>Profile → Primary niche</strong>.
      </p>
      {localError && <p className="mb-4 text-sm text-red-600">{localError}</p>}
      <SubmitButton loading={loading} onClick={handleRun} type="button">
        {loading ? "Generando análisis..." : "Generar análisis de mercado"}
      </SubmitButton>
    </Panel>
  );
}

/* ── Shared UI primitives ────────────────────────────────────────────────── */

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none";

function ActionButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: string; children: React.ReactNode }) {
  const icons: Record<string, React.ReactNode> = {
    upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>,
    globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {icons[icon]}
      </svg>
      {children}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function SubmitButton({ loading, disabled, onClick, type = "submit", children }: {
  loading: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={loading || disabled}
      onClick={onClick}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
