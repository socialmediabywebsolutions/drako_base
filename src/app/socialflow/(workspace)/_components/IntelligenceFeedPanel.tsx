"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";

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

const TYPE_ICON: Record<FeedType, string> = {
  opportunity: "💡",
  recommendation: "🎯",
  alert: "⚠️",
};

type FeedResponse = { ok: boolean; items?: FeedItem[]; message?: string; error?: string };

const PRIORITY_TONE: Record<FeedPriority, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
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
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || json?.error || "FEED_LOAD_FAILED");
        }
        setItems(json.items ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el feed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateStatus(id: string, status: "read" | "dismissed") {
    setItems((prev) => (status === "dismissed" ? prev.filter((item) => item.id !== id) : prev.map((item) => (item.id === id ? { ...item, status } : item))));
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

  if (loading) {
    return (
      <Card title="Intelligence Feed" subtitle="Lo que necesitas saber ahora" tone="default">
        <p className="text-sm text-slate-400">Cargando inteligencia...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Intelligence Feed" subtitle="Lo que necesitas saber ahora" tone="default">
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card title="Intelligence Feed" subtitle="Lo que necesitas saber ahora" tone="default">
        <p className="text-sm text-slate-500">
          Todo en orden. Vuelve a auditar tu presencia para generar nuevas recomendaciones.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Intelligence Feed" subtitle="Lo que necesitas saber ahora" tone="default" bodyClassName="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-start gap-3 rounded-2xl border-2 border-sky-50 bg-sky-50/30 p-4">
          <span className="text-xl">{TYPE_ICON[item.type]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-slate-900">{item.title}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_TONE[item.priority]}`}>
                {item.priority}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
              {item.actionHref && (
                <Link href={item.actionHref} className="text-sky-600 hover:text-sky-700">
                  {item.actionLabel ?? "Ver mas"} →
                </Link>
              )}
              {item.status === "new" && (
                <button type="button" onClick={() => void updateStatus(item.id, "read")} className="text-slate-400 hover:text-slate-600">
                  Marcar como leido
                </button>
              )}
              <button type="button" onClick={() => void updateStatus(item.id, "dismissed")} className="text-slate-400 hover:text-red-500">
                Descartar
              </button>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}
