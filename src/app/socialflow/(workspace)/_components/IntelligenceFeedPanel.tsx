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
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 pr-1">
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`group relative flex flex-col gap-2 rounded-xl border p-3 transition ${
                  item.status === "new"
                    ? "border-violet-500/20 bg-violet-500/8"
                    : "border-white/6 bg-white/3"
                }`}
              >
                {/* Header row: icon + priority badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base leading-none">{TYPE_ICON[item.type]}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>

                {/* Title */}
                <p className="text-sm font-semibold leading-snug text-white">{item.title}</p>

                {/* Description */}
                <p className="line-clamp-2 text-xs leading-relaxed text-white/45">{item.description}</p>

                {/* Actions — hidden until hover */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                  {item.actionHref && (
                    <Link href={item.actionHref} className="text-violet-400 transition-colors hover:text-violet-300">
                      {item.actionLabel ?? "Ver más"} →
                    </Link>
                  )}
                  {item.status === "new" && (
                    <button
                      type="button"
                      onClick={() => void updateStatus(item.id, "read")}
                      className="text-white/30 transition-colors hover:text-white/60"
                    >
                      Leído
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void updateStatus(item.id, "dismissed")}
                    className="text-white/20 transition-colors hover:text-red-400"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
