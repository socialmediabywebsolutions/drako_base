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
      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <p className="text-sm text-gray-400 animate-pulse">Cargando tu plan estratégico…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  if (!plan) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-base font-bold text-gray-900">Plan estratégico del mes</h2>
        <p className="mt-2 text-sm text-gray-500">
          Todavía no se ha calculado — se genera cada lunes a partir de todo lo que el Cerebro haya aprendido de tu cuenta.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-6 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#3b82f6]">Plan estratégico del mes</p>
        <h2 className="mt-1 text-base font-bold text-gray-900">{plan.monthlyObjective}</h2>
      </div>

      {plan.alert && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-700">⚠️ {plan.alert}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prioridades del mes</p>
        <ul className="mt-2 space-y-1.5">
          {plan.priorities.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-600">
              <span className="text-[#3b82f6]">{i + 1}.</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Oportunidad clave</p>
        <p className="mt-1 text-sm text-gray-600">{plan.keyOpportunity}</p>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs text-gray-500 italic">{plan.executiveSummary}</p>
      </div>
    </section>
  );
}
