"use client";

import { useEffect, useRef, useState } from "react";
import type { BrainScore } from "@/lib/socialflow/knowledge/brain-score";
import BrainScorePanel from "@/components/socialflow/brain-score-panel";

type DocType = "pdf" | "url" | "text" | "catalog" | "competitor" | "market_analysis" | "auto_learned_style";

type Doc = {
  id: string;
  name: string;
  type: DocType;
  source_url: string | null;
  created_at: string;
};

type Panel = "none" | "upload" | "url" | "competitor" | "market" | "catalog";

type ListResponse = { ok: true; docs: Doc[] } | { ok: false; error: string };
type DeleteResponse = { ok: true } | { ok: false; error: string };
type SaveResponse = { ok: true; doc: Doc } | { ok: false; error?: string; message?: string };

const TYPE_LABEL: Record<DocType, string> = {
  pdf: "PDF",
  url: "URL",
  text: "Texto",
  catalog: "Catálogo",
  competitor: "Competidor",
  market_analysis: "Mercado",
  auto_learned_style: "Estilo aprendido",
};

const TYPE_BG: Record<DocType, string> = {
  pdf: "bg-orange-500/15 text-orange-300",
  url: "bg-sky-500/15 text-sky-300",
  text: "bg-white/8 text-white/60",
  catalog: "bg-amber-500/15 text-amber-300",
  competitor: "bg-purple-500/15 text-purple-300",
  market_analysis: "bg-emerald-500/15 text-emerald-300",
  auto_learned_style: "bg-fuchsia-500/15 text-fuchsia-300",
};

export default function KnowledgeBaseClient({
  accountType,
  score,
}: {
  accountType: "influencer" | "empresa" | null;
  score: BrainScore;
}) {
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
  const catalogDocs = docs.filter((d) => d.type === "catalog");
  const knowledgeDocs = docs.filter(
    (d) => d.type !== "market_analysis" && d.type !== "competitor" && d.type !== "catalog",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          Socialcors · Base de conocimiento
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          Mi Cerebro IA
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Todo lo que la IA sabe sobre ti. Cuanto más le enseñes, mejor contenido genera.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton active={panel === "upload"} onClick={() => togglePanel("upload")} icon="upload">
            Subir PDF o documento
          </ActionButton>
          <ActionButton active={panel === "url"} onClick={() => togglePanel("url")} icon="globe">
            Añadir URL
          </ActionButton>
          {accountType === "empresa" && (
            <ActionButton active={panel === "catalog"} onClick={() => togglePanel("catalog")} icon="catalog">
              Subir catálogo
            </ActionButton>
          )}
          <ActionButton active={panel === "competitor"} onClick={() => togglePanel("competitor")} icon="users">
            Analizar competidora
          </ActionButton>
          <ActionButton active={panel === "market"} onClick={() => togglePanel("market")} icon="chart">
            Analizar mi mercado
          </ActionButton>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
      </div>

      <BrainScorePanel score={score} />

      {/* Panels */}
      {panel === "upload" && <UploadPanel onSuccess={onSaved} />}
      {panel === "url" && <UrlPanel onSuccess={onSaved} />}
      {panel === "catalog" && <CatalogPanel onSuccess={onSaved} />}
      {panel === "competitor" && <CompetitorPanel onSuccess={onSaved} />}
      {panel === "market" && <MarketPanel onSuccess={onSaved} />}

      {/* Market analysis */}
      {marketDocs.length > 0 && (
        <DocSection
          title="Mi mercado"
          badge="Mercado"
          badgeStyle={TYPE_BG.market_analysis}
          docs={marketDocs}
          emptyText="Sin análisis de mercado todavía. Haz clic en «Analizar mi mercado» para generar uno con IA."
          loading={loading}
          onDelete={handleDelete}
        />
      )}

      {/* Competitors */}
      {competitorDocs.length > 0 && (
        <DocSection
          title="Mi competencia"
          badge="Competidor"
          badgeStyle={TYPE_BG.competitor}
          docs={competitorDocs}
          emptyText="Sin competidores analizados. Añade uno con «Analizar competidora»."
          loading={loading}
          onDelete={handleDelete}
        />
      )}

      {/* Catalog */}
      {catalogDocs.length > 0 && (
        <DocSection
          title="Mi catálogo"
          badge="Catálogo"
          badgeStyle={TYPE_BG.catalog}
          docs={catalogDocs}
          emptyText="Sin catálogo todavía. Súbelo con «Subir catálogo»."
          loading={loading}
          onDelete={handleDelete}
        />
      )}

      {/* Knowledge docs */}
      <DocSection
        title="Mi personalidad y estilo"
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
    <div className="rounded-2xl border border-white/8 bg-white/4">
      <div className="border-b border-white/8 px-6 py-4">
        <h2 className="text-base font-semibold text-white">
          {title}
          {!loading && (
            <span className="ml-1.5 text-sm font-normal text-white/30">({docs.length})</span>
          )}
        </h2>
      </div>

      {loading ? (
        <div className="px-6 py-8 text-center text-sm text-white/30 animate-pulse">Cargando...</div>
      ) : docs.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-white/30">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-white/5">
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
          <span className="truncate text-sm font-medium text-white/80">{doc.name}</span>
        </div>
        {doc.source_url && (
          <a
            href={doc.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate text-xs text-white/30 hover:text-violet-400 hover:underline transition-colors"
          >
            {doc.source_url}
          </a>
        )}
        <p className="mt-0.5 text-xs text-white/25">{date}</p>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="flex-shrink-0 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-white/35 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
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
    <DarkPanel title="Subir documento (PDF o texto)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre personalizado (opcional)">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guía de marca 2024" className={inputCls} />
        </Field>
        <Field label={<>Archivo <span className="text-white/25">(PDF, .txt — máx. 10 MB)</span></>}>
          <div onClick={() => inputRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/3 px-6 py-8 text-center transition hover:border-violet-500/40 hover:bg-white/5">
            {file ? (
              <div><p className="text-sm font-medium text-white/80">{file.name}</p><p className="text-xs text-white/35">{(file.size / 1024).toFixed(0)} KB</p></div>
            ) : (
              <p className="text-sm text-white/40">Haz clic para seleccionar un archivo</p>
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
        {localError && <p className="text-sm text-red-400">{localError}</p>}
        <SubmitButton loading={uploading} disabled={!file}>{uploading ? "Subiendo..." : "Subir documento"}</SubmitButton>
      </form>
    </DarkPanel>
  );
}

/* ── Panel: Catalog (CSV/Excel — empresa only) ───────────────────────────── */

function CatalogPanel({ onSuccess }: { onSuccess: (doc: Doc) => void }) {
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
      else setLocalError(json.message ?? json.error ?? "Error al subir el catálogo");
    } catch { setLocalError("Error inesperado"); }
    finally { setUploading(false); }
  }

  return (
    <DarkPanel title="Subir catálogo de productos (CSV o Excel)">
      <p className="mb-4 text-xs text-white/40">
        Sube tu catálogo con nombres, precios y descripciones. La IA lo usará para responder consultas de clientes y generar contenido.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre personalizado (opcional)">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Catálogo 2024" className={inputCls} />
        </Field>
        <Field label={<>Archivo <span className="text-white/25">(CSV, XLSX — máx. 10 MB)</span></>}>
          <div onClick={() => inputRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/3 px-6 py-8 text-center transition hover:border-violet-500/40 hover:bg-white/5">
            {file ? (
              <div><p className="text-sm font-medium text-white/80">{file.name}</p><p className="text-xs text-white/35">{(file.size / 1024).toFixed(0)} KB</p></div>
            ) : (
              <p className="text-sm text-white/40">Haz clic para seleccionar un archivo</p>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </Field>
        {localError && <p className="text-sm text-red-400">{localError}</p>}
        <SubmitButton loading={uploading} disabled={!file}>{uploading ? "Subiendo..." : "Subir catálogo"}</SubmitButton>
      </form>
    </DarkPanel>
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
    <DarkPanel title="Añadir contenido desde URL">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="URL"><input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-web.com/servicios" className={inputCls} autoFocus /></Field>
        <Field label="Nombre personalizado (opcional)"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Página de servicios" className={inputCls} /></Field>
        {localError && <p className="text-sm text-red-400">{localError}</p>}
        <SubmitButton loading={loading}>{loading ? "Procesando..." : "Guardar contenido"}</SubmitButton>
      </form>
    </DarkPanel>
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
    <DarkPanel title="Analizar competidor con IA">
      <p className="mb-4 text-xs text-white/40">
        Introduce el nombre y/o la URL del competidor. La IA extraerá sus servicios, fortalezas, patrones de contenido y oportunidades de diferenciación.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre del competidor"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agencia XYZ" className={inputCls} autoFocus /></Field>
        <Field label="URL de su web (opcional — mejora el análisis)"><input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://agenciaxyz.com" className={inputCls} /></Field>
        {localError && <p className="text-sm text-red-400">{localError}</p>}
        <SubmitButton loading={loading}>{loading ? "Analizando..." : "Analizar competidor"}</SubmitButton>
      </form>
    </DarkPanel>
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
    <DarkPanel title="Análisis de mercado con IA">
      <p className="mb-5 text-sm text-white/50">
        La IA analizará el nicho de tu marca (configurado en el Perfil) y generará un informe con hashtags en tendencia, palabras clave virales, formatos que funcionan en tu sector y oportunidades de mercado.
      </p>
      <p className="mb-5 text-xs text-white/30">
        El análisis se basa en tu perfil de marca. Si no tienes nicho configurado aún, configúralo primero en <strong className="text-white/50">Perfil → Nicho principal</strong>.
      </p>
      {localError && <p className="mb-4 text-sm text-red-400">{localError}</p>}
      <SubmitButton loading={loading} onClick={handleRun} type="button">
        {loading ? "Generando análisis..." : "Generar análisis de mercado"}
      </SubmitButton>
    </DarkPanel>
  );
}

/* ── Shared UI primitives ────────────────────────────────────────────────── */

const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition backdrop-blur-sm";

function ActionButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: string; children: React.ReactNode }) {
  const icons: Record<string, React.ReactNode> = {
    upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>,
    globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    catalog: <><path d="M3 3h18v18H3z" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" /></>,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-violet-500/50 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-white"
          : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {icons[icon]}
      </svg>
      {children}
    </button>
  );
}

function DarkPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
      <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/45">{label}</label>
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
      className="inline-flex rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
