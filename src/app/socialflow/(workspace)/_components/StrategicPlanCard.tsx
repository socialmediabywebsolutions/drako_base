"use client";

import { useEffect, useState } from "react";

type StrategicPlan = {
  monthlyObjective: string;
  priorities: string[];
  keyOpportunity: string;
  alert: string | null;
  executiveSummary: string;
};

type PlanResponse = { ok: boolean; plan?: StrategicPlan | null; message?: string; error?: string };

type Props = { saasId: string };

// Tarjeta FIJA, siempre visible al entrar a la pestaña Inteligencia — a diferencia de
// IntelligenceFeedPanel (scroll de tarjetas descartables), este plan se recalcula una
// vez por semana (StrategicPlanningAgent) y no tiene estado leído/descartado: es la
// foto actual de la estrategia, no una notificación puntual.
export default function StrategicPlanCard({ saasId }: Props) {
  const [plan, setPlan] = useState<StrategicPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/socialflow/strategic-plan?saasId=${encodeURIComponent(saasId)}`);
        const json = (await res.json().catch(() => null)) as PlanResponse | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok) throw new Error(json?.message || json?.error || "STRATEGIC_PLAN_LOAD_FAILED");
        setPlan(json.plan ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el plan estratégico");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [saasId]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-white/8 bg-white/4 p-6">
        <p className="text-sm text-white/30 animate-pulse">Cargando tu plan estratégico…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-white/8 bg-white/4 p-6">
        <p className="text-sm text-red-400">{error}</p>
      </section>
    );
  }

  if (!plan) {
    return (
      <section className="rounded-2xl border border-white/8 bg-white/4 p-6">
        <h2 className="text-base font-bold text-white">Plan estratégico del mes</h2>
        <p className="mt-2 text-sm text-white/35">
          Todavía no se ha calculado — se genera cada lunes a partir de todo lo que el Cerebro haya aprendido de tu cuenta.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-500/20 bg-violet-500/6 p-6 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-300/70">Plan estratégico del mes</p>
        <h2 className="mt-1 text-base font-bold text-white">{plan.monthlyObjective}</h2>
      </div>

      {plan.alert && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs font-semibold text-red-300">⚠️ {plan.alert}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Prioridades del mes</p>
        <ul className="mt-2 space-y-1.5">
          {plan.priorities.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-white/70">
              <span className="text-violet-400">{i + 1}.</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Oportunidad clave</p>
        <p className="mt-1 text-sm text-white/70">{plan.keyOpportunity}</p>
      </div>

      <div className="border-t border-white/8 pt-3">
        <p className="text-xs text-white/40 italic">{plan.executiveSummary}</p>
      </div>
    </section>
  );
}
