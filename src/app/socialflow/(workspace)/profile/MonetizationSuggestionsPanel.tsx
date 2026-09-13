"use client";

import { useState } from "react";
import type { MonetizationSuggestion } from "@/lib/socialflow/profile/monetization-suggestions";
import { MONETIZATION_TYPE_LABELS } from "@/lib/socialflow/profile/monetization-suggestions";

export default function MonetizationSuggestionsPanel({
  saasId,
  onAdd,
}: {
  saasId: string;
  onAdd: (suggestion: MonetizationSuggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MonetizationSuggestion[]>([]);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());

  async function loadSuggestions() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/profile/monetization-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ saasId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; suggestions?: MonetizationSuggestion[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudieron generar sugerencias");
      setSuggestions(data.suggestions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(s: MonetizationSuggestion) {
    onAdd(s);
    setAddedNames((prev) => new Set(prev).add(s.name));
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={loadSuggestions}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Generando..." : "💡 Sugerencias de monetización con IA"}
      </button>

      {open && (
        <div className="space-y-3">
          {error && <p className="text-xs text-red-300">{error}</p>}
          {loading && <p className="text-xs text-white/40">Analizando tu nicho y tu Knowledge Base...</p>}
          {!loading && suggestions.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {suggestions.map((s) => {
                const added = addedNames.has(s.name);
                return (
                  <div key={s.name} className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{s.name}</p>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/60">
                          {MONETIZATION_TYPE_LABELS[s.type]}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-white/55">{s.description}</p>
                      <p className="mt-2 text-sm font-bold text-emerald-300">{s.priceRange}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(s)}
                      disabled={added}
                      className="mt-3 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {added ? "✓ Añadido" : "Añadir este servicio"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
