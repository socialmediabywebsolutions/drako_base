"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/card";
import { Table, TableWrap, TBody, TD, TH, THead } from "@/components/ui/table";

// Publicación Automática — @drako.systems en /operator/socialflow. Lista los últimos
// posts del AutoPublishAgent (/api/social-posts) y permite generarlos a mano con la
// sesión del operator (/api/cron/auto-publish).

type SocialPost = {
  id: number;
  platform: string;
  content: string;
  status: string;
  created_at: string;
};

const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", facebook: "Facebook" };

const STATUS_STYLE: Record<string, string> = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  publicado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  descartado: "bg-slate-100 text-slate-500 border-slate-200",
};

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 100 ? `${flat.slice(0, 100)}…` : flat;
}

// created_at viene de datetime('now') de SQLite: UTC sin zona.
function formatDate(value: string): string {
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

export default function AutoPublishPanel() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [discarding, setDiscarding] = useState<number | null>(null);
  const [viewing, setViewing] = useState<SocialPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-posts?limit=5", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; items?: SocialPost[]; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setPosts(data.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function generateNow() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/auto-publish", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      await load();
    } catch (genError) {
      setError(genError instanceof Error ? genError.message : "No se pudieron generar los posts.");
    } finally {
      setGenerating(false);
    }
  }

  async function discard(id: number) {
    setDiscarding(id);
    try {
      const res = await fetch(`/api/social-posts?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "descartado" }),
      });
      if (res.ok) setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status: "descartado" } : p)));
    } finally {
      setDiscarding(null);
    }
  }

  return (
    <Card
      tone="default"
      title="Publicación Automática — @drako.systems"
      subtitle="Posts que el AutoPublishAgent genera de lunes a viernes a las 10:00 UTC a partir del Journal"
      right={
        <button
          type="button"
          onClick={generateNow}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-70"
        >
          {generating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : null}
          {generating ? "Generando…" : "Generar ahora"}
        </button>
      }
    >
      <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        La publicación automática en Meta/LinkedIn se activará cuando se configuren los tokens de acceso
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando posts…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay posts generados. Pulsa &quot;Generar ahora&quot; o espera al próximo día laborable a las 10:00 UTC.</p>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Plataforma</TH>
                <TH>Preview contenido</TH>
                <TH>Estado</TH>
                <TH>Fecha</TH>
                <TH>Acciones</TH>
              </tr>
            </THead>
            <TBody>
              {posts.map((post) => (
                <tr key={post.id} className={post.status === "descartado" ? "opacity-60" : undefined}>
                  <TD className="font-medium">{PLATFORM_LABEL[post.platform] ?? post.platform}</TD>
                  <TD className="max-w-md text-slate-600">{preview(post.content)}</TD>
                  <TD>
                    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[post.status] ?? STATUS_STYLE.descartado}`}>
                      {post.status}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap">{formatDate(post.created_at)}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setViewing(post)}
                        className="whitespace-nowrap rounded-lg border-2 border-blue-500 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        Ver completo
                      </button>
                      {post.status !== "descartado" ? (
                        <button
                          type="button"
                          onClick={() => discard(post.id)}
                          disabled={discarding === post.id}
                          className="whitespace-nowrap rounded-lg border-2 border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {discarding === post.id ? "Descartando…" : "Descartar"}
                        </button>
                      ) : null}
                    </div>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      {viewing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="auto-publish-post-title">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white p-6 shadow-xl">
            <h4 id="auto-publish-post-title" className="text-lg font-bold text-slate-900">
              {PLATFORM_LABEL[viewing.platform] ?? viewing.platform} · {viewing.content.length} caracteres
            </h4>
            <p className="mt-4 flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-slate-800">{viewing.content}</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setViewing(null)} className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
