"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StrategicPlan = {
  monthlyObjective: string;
  priorities: string[];
  keyOpportunity: string;
  alert: string | null;
  executiveSummary: string;
};

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ok"; plan: StrategicPlan };

export function CerebroPlan() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/socialflow/strategic-plan");
        if (!res.ok) { if (active) setState({ status: "empty" }); return; }
        const data = (await res.json()) as { ok: boolean; plan: StrategicPlan | null };
        if (!active) return;
        if (!data.ok || !data.plan) { setState({ status: "empty" }); return; }
        setState({ status: "ok", plan: data.plan });
      } catch {
        if (active) setState({ status: "error" });
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CerebroIcon />
          <p className="text-sm font-semibold text-slate-500">El Cerebro está analizando tu cuenta…</p>
        </div>
      </div>
    );
  }

  if (state.status === "empty" || state.status === "error") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <CerebroIcon />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">El Cerebro</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Todavía recopilando datos</p>
            <p className="mt-1 text-xs text-slate-500">
              El Cerebro necesita algunos días publicando para generar tu plan estratégico. Sigue publicando y aquí aparecerá tu estrategia personalizada.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { plan } = state;

  return (
    <div className="rounded-2xl border border-[#3b82f6]/20 bg-white shadow-sm overflow-hidden">
      {/* Cabecera */}
      <div className="bg-gradient-to-r from-[#3b82f6]/8 to-[#06b6d4]/8 border-b border-[#3b82f6]/15 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CerebroIcon />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">El Cerebro · Plan del mes</p>
              <p className="text-sm font-bold text-slate-800">{plan.monthlyObjective}</p>
            </div>
          </div>
          <Link
            href="/socialflow/ai"
            className="shrink-0 rounded-lg border border-[#3b82f6]/25 bg-white px-3 py-1.5 text-xs font-bold text-[#3b82f6] transition hover:bg-[#3b82f6]/5"
          >
            Ver análisis completo →
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Resumen ejecutivo */}
        <p className="text-sm text-slate-600 leading-relaxed">{plan.executiveSummary}</p>

        {/* Alerta (solo si existe) */}
        {plan.alert && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="mt-0.5 text-amber-500" aria-hidden="true">⚠</span>
            <p className="text-xs font-semibold text-amber-700">{plan.alert}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Prioridades */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">
              3 prioridades este mes
            </p>
            <ul className="space-y-2">
              {plan.priorities.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] text-[9px] font-black text-white">
                    {i + 1}
                  </span>
                  <span className="text-xs text-slate-700 leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Oportunidad clave */}
          <div className="rounded-xl border border-[#06b6d4]/20 bg-[#06b6d4]/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#06b6d4] mb-2">
              Oportunidad clave
            </p>
            <div className="flex items-start gap-2">
              <span className="text-[#06b6d4] text-base" aria-hidden="true">◆</span>
              <p className="text-xs text-slate-700 leading-relaxed">{plan.keyOpportunity}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CerebroIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] shadow-sm shadow-[#3b82f6]/20">
      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
      </svg>
    </div>
  );
}
