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
  high:   "border-red-300 bg-red-50 text-red-700",
  medium: "border-amber-300 bg-amber-50 text-amber-700",
  low:    "border-gray-200 bg-gray-100 text-gray-500",
};

// Franja lateral por tipo, independiente del badge de priority — sin esto, dos
// tarjetas de igual priority pero distinto type (ej. un alert y una opportunity, ambos
// "medium") se veían idénticas salvo por el emoji.
const TYPE_ACCENT: Record<FeedType, string> = {
  alert: "border-l-4 border-l-rose-500",
  opportunity: "border-l-4 border-l-[#3b82f6]",
  recommendation: "border-l-4 border-l-sky-500",
};

export default function IntelligenceFeedPanel() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Intelligence Feed</h2>
          <p className="text-xs text-gray-500 mt-0.5">Lo que necesitas saber ahora</p>
        </div>
        {items.filter((i) => i.status === "new").length > 0 && (
          <span className="rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2.5 py-1 text-[10px] font-bold text-[#3b82f6]">
            {items.filter((i) => i.status === "new").length} nuevo{items.filter((i) => i.status === "new").length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading && (
        <p className="text-sm text-gray-400 animate-pulse">Cargando inteligencia…</p>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-gray-500">
          Todo en orden. Vuelve a auditar tu presencia para generar nuevas recomendaciones.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300 pr-1">
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => {
              const isExpanded = expandedIds.has(item.id);
              const alwaysShowActions = isExpanded || (item.type === "alert" && item.priority === "high");
              return (
              <div
                key={item.id}
                onClick={() => toggleExpanded(item.id)}
                className={`group relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition ${TYPE_ACCENT[item.type]} ${
                  item.status === "new"
                    ? "border-[#3b82f6]/20 bg-[#3b82f6]/5"
                    : "border-gray-200 bg-gray-50"
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
                <p className="text-sm font-semibold leading-snug text-gray-900">{item.title}</p>

                {/* Description — clamp a 2 líneas hasta que se expande la tarjeta */}
                <p className={`text-xs leading-relaxed text-gray-500 ${isExpanded ? "" : "line-clamp-2"}`}>
                  {item.description}
                </p>

                {/* Actions — siempre visibles para alert+high o tarjeta expandida, el
                    resto se revela al hover como antes */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`flex flex-wrap items-center gap-3 text-xs font-semibold transition-opacity ${
                    alwaysShowActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {item.actionHref && (
                    <Link href={item.actionHref} className="text-[#3b82f6] transition-colors hover:text-[#06b6d4]">
                      {item.actionLabel ?? "Ver más"} →
                    </Link>
                  )}
                  {item.status === "new" && (
                    <button
                      type="button"
                      onClick={() => void updateStatus(item.id, "read")}
                      className="text-gray-400 transition-colors hover:text-gray-700"
                    >
                      Leído
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void updateStatus(item.id, "dismissed")}
                    className="text-gray-300 transition-colors hover:text-red-600"
                  >
                    Descartar
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
