"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type FeedType = "opportunity" | "recommendation" | "alert";
type FeedPriority = "high" | "medium" | "low";

type FeedItem = {
  id: string;
  type: FeedType;
  title: string;
  description: string;
  priority: FeedPriority;
  status: "new" | "read" | "dismissed";
  actionLabel: string | null;
  actionHref: string | null;
};

type FeedResponse = { ok: boolean; items?: FeedItem[]; message?: string; error?: string };

const TYPE_ICON: Record<FeedType, string> = {
  opportunity: "💡",
  recommendation: "🎯",
  alert: "⚠️",
};

const PRIORITY_STYLE: Record<FeedPriority, string> = {
  high:   "border-red-500/30 bg-red-500/10 text-red-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  low:    "border-white/15 bg-white/5 text-white/45",
};

export default function IntelligenceFeedPanel() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/socialflow/intelligence-feed");
        const json = (await res.json().catch(() => null)) as FeedResponse | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok) throw new Error(json?.message || json?.error || "FEED_LOAD_FAILED");
        setItems(json.items ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el feed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function updateStatus(id: string, status: "read" | "dismissed") {
    setItems((prev) =>
      status === "dismissed"
        ? prev.filter((item) => item.id !== id)
        : prev.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    try {
      await fetch("/api/socialflow/intelligence-feed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    } catch (err) {
      console.error("SOCIALFLOW_INTELLIGENCE_FEED_UPDATE_ERROR", err);
    }
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-white/4 p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Intelligence Feed</h2>
          <p className="text-xs text-white/35 mt-0.5">Lo que necesitas saber ahora</p>
        </div>
        {items.filter((i) => i.status === "new").length > 0 && (
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold text-violet-300">
            {items.filter((i) => i.status === "new").length} nuevo{items.filter((i) => i.status === "new").length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading && (
        <p className="text-sm text-white/30 animate-pulse">Cargando inteligencia…</p>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-white/35">
          Todo en orden. Vuelve a auditar tu presencia para generar nuevas recomendaciones.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex flex-wrap items-start gap-3 rounded-xl border p-4 transition ${
                item.status === "new"
                  ? "border-violet-500/20 bg-violet-500/8"
                  : "border-white/6 bg-white/3"
              }`}
            >
              <span className="text-lg">{TYPE_ICON[item.type]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-white/55">{item.description}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs font-semibold">
                  {item.actionHref && (
                    <Link href={item.actionHref} className="text-violet-400 hover:text-violet-300 transition-colors">
                      {item.actionLabel ?? "Ver más"} →
                    </Link>
                  )}
                  {item.status === "new" && (
                    <button
                      type="button"
                      onClick={() => void updateStatus(item.id, "read")}
                      className="text-white/25 hover:text-white/50 transition-colors"
                    >
                      Marcar como leído
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void updateStatus(item.id, "dismissed")}
                    className="text-white/20 hover:text-red-400 transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
