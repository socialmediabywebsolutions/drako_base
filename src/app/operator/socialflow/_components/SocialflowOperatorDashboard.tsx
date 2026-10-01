"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RevenueData = {
  global_mrr_cents: number;
  global_active_tenants: number;
  global_churn_rate: number;
  breakdown: Record<string, {
    active_tenants: number;
    mrr_cents: number;
    past_due_count: number;
    churn_rate: number;
    status_breakdown: Record<string, number>;
  }>;
};

type AiEntry = {
  tenantId: string;
  saasId: string;
  model: string;
  month: string;
  tokensIn: number;
  tokensOut: number;
  requestsCount: number;
};

type Tenant = {
  tenantId: string;
  saasId: string;
  name: string;
  niche: string | null;
  plan: string | null;
};

type InternalAccount = {
  tenantId: string;
  saasSlug: string;
  label: string | null;
  addedAt: string;
};

type AgentRunSummary = {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
  totalPosts: number;
  latestRunAt: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function euros(cents: number, dec = 0) {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
}
function eurosNum(n: number, dec = 0) {
  return n.toLocaleString("es-ES", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
}
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function estimateCostEur(tokensIn: number, tokensOut: number) {
  return ((tokensIn / 1_000_000) * 0.1 + (tokensOut / 1_000_000) * 0.3) * 0.93;
}
function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 48) return `hace ${Math.floor(h / 24)}d`;
  if (h > 0) return `hace ${h}h`;
  return `hace ${m}m`;
}

// ─── Atom: Kpi ────────────────────────────────────────────────────────────────

function Kpi({
  label, value, sub, icon, highlight = false, danger = false,
}: {
  label: string; value: string; sub?: string; icon: string;
  highlight?: boolean; danger?: boolean;
}) {
  return (
    <div className={[
      "rounded-2xl border p-4 flex flex-col gap-0.5 transition-all",
      highlight ? "border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-sm" :
      danger ? "border-red-200 bg-red-50" :
      "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm",
    ].join(" ")}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-lg">{icon}</span>
        {highlight && <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow shadow-blue-300" />}
        {danger && <div className="h-1.5 w-1.5 rounded-full bg-red-400" />}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={["text-2xl font-black tracking-tight leading-none mt-0.5",
        highlight ? "text-blue-600" : danger ? "text-red-600" : "text-gray-900",
      ].join(" ")}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

// ─── Atom: Bar ────────────────────────────────────────────────────────────────

function Bar({ pct: p, color = "blue" }: { pct: number; color?: "blue" | "orange" | "green" }) {
  const bg = color === "blue" ? "from-[#3b82f6] to-[#06b6d4]" :
             color === "orange" ? "from-orange-400 to-amber-300" :
             "from-emerald-400 to-teal-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${bg} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, p))}%` }} />
    </div>
  );
}

// ─── Atom: StatusDot ─────────────────────────────────────────────────────────

function StatusDot({ rate, runs }: { rate: number; runs: number }) {
  const cls = runs === 0 ? "bg-gray-300" :
    rate >= 0.9 ? "bg-emerald-500 shadow shadow-emerald-300 animate-pulse" :
    rate >= 0.7 ? "bg-amber-400" : "bg-red-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${cls}`} />;
}

// ─── Atom: Pill ──────────────────────────────────────────────────────────────

function Pill({ children, color = "gray" }: {
  children: React.ReactNode;
  color?: "blue" | "green" | "red" | "orange" | "gray" | "purple" | "cyan";
}) {
  const cls: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700", green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700", orange: "bg-orange-100 text-orange-700",
    gray: "bg-gray-100 text-gray-500", purple: "bg-purple-100 text-purple-700",
    cyan: "bg-cyan-100 text-cyan-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls[color]}`}>
      {children}
    </span>
  );
}

function PlanPill({ plan }: { plan: string | null }) {
  if (!plan || plan === "free") return <Pill color="gray">free</Pill>;
  if (plan.includes("agencia")) return <Pill color="purple">agencia</Pill>;
  if (plan.includes("pro")) return <Pill color="blue">{plan}</Pill>;
  if (plan.includes("basico")) return <Pill color="green">{plan}</Pill>;
  if (plan.includes("starter")) return <Pill color="cyan">{plan}</Pill>;
  return <Pill color="orange">{plan}</Pill>;
}

// ─── Nav: Sidebar ────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "overview", label: "Resumen", icon: "⚡" },
  { id: "finanzas", label: "Finanzas", icon: "💰" },
  { id: "clientes", label: "Clientes", icon: "👥" },
  { id: "ia", label: "Inteligencia IA", icon: "🤖" },
  { id: "internas", label: "Cuentas Internas", icon: "🔑" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

// ─── Section: Overview ────────────────────────────────────────────────────────

function OverviewSection({
  revenue, tenants, aiEntries, agentSummary, internalAccounts,
}: {
  revenue: RevenueData | null; tenants: Tenant[]; aiEntries: AiEntry[];
  agentSummary: AgentRunSummary | null; internalAccounts: InternalAccount[];
}) {
  const sf = revenue?.breakdown["socialflow"] ?? null;
  const mrr = sf?.mrr_cents ?? 0;
  const active = sf?.active_tenants ?? 0;
  const churn = sf?.churn_rate ?? 0;
  const pastDue = sf?.past_due_count ?? 0;

  const daily = mrr / 100 / 30;
  const annual = (mrr / 100) * 12;
  const arpu = active > 0 ? mrr / 100 / active : 0;
  const ltv = churn > 0 ? arpu / churn : 0;

  const sfAi = aiEntries.filter((e) => e.saasId === "socialflow");
  const aiCost = sfAi.reduce((s, e) => s + estimateCostEur(e.tokensIn, e.tokensOut), 0);
  const net = mrr / 100 - aiCost - 20;
  const internalSet = new Set(internalAccounts.map((a) => a.tenantId));
  const paying = tenants.filter((t) => !internalSet.has(t.tenantId)).length;

  // Plan distribution
  const planCount: Record<string, number> = {};
  for (const t of tenants) { const k = t.plan ?? "free"; planCount[k] = (planCount[k] ?? 0) + 1; }
  const planSorted = Object.entries(planCount).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Alert */}
      {pastDue > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <span>⚠️</span>
          <p className="text-sm font-semibold text-orange-800">
            {pastDue} pago{pastDue > 1 ? "s" : ""} atrasado{pastDue > 1 ? "s" : ""} — revisar Stripe
          </p>
        </div>
      )}

      {/* Ingresos */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">📊 Ingresos</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="MRR" value={euros(mrr)} sub="Ingresos del mes" icon="💰" highlight />
          <Kpi label="Por día" value={`${daily.toFixed(1)} €`} sub="Promedio diario" icon="📅" />
          <Kpi label="ARR proyectado" value={`${(annual / 1000).toFixed(1)}k €`} sub="Sin cambios de MRR" icon="📈" />
          <Kpi label="Margen neto" value={`${net.toFixed(0)} €`}
            sub={`IA ${aiCost.toFixed(2)} € + hosting 20 €`}
            icon={net >= 0 ? "✅" : "🔴"} highlight={net > 0} danger={net < 0} />
        </div>
      </div>

      {/* Clientes */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">👥 Clientes</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Activos" value={String(active)} sub="En la plataforma" icon="🟢" />
          <Kpi label="De pago" value={String(paying)} sub="Con suscripción" icon="💳" />
          <Kpi label="Internos" value={String(internalAccounts.length)} sub="Sin Stripe" icon="🔑" />
          <Kpi label="ARPU" value={`${arpu.toFixed(0)} €`} sub="Por cliente/mes" icon="🎯" />
        </div>
      </div>

      {/* Agentes + Planes */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Agentes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🤖</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Estado de agentes IA</p>
              <p className="text-[11px] text-gray-400">Automatización en tiempo real</p>
            </div>
            {agentSummary && (
              <div className="ml-auto">
                <StatusDot rate={agentSummary.successRate} runs={agentSummary.totalRuns} />
              </div>
            )}
          </div>

          {agentSummary === null || agentSummary.totalRuns === 0 ? (
            <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
              Sin ejecuciones aún. Los agentes se activarán cuando publiques contenido.
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {[
                  { name: "Orquestador de contenido", rate: agentSummary.successRate, runs: agentSummary.totalRuns },
                  { name: "Publicador automático", rate: agentSummary.successRate, runs: agentSummary.totalRuns },
                  { name: "Prospector de nichos", rate: 1, runs: 0 },
                ].map((a) => (
                  <div key={a.name} className="flex items-center gap-3">
                    <StatusDot rate={a.rate} runs={a.runs} />
                    <p className="flex-1 text-sm text-gray-700 font-medium">{a.name}</p>
                    <p className="text-xs text-gray-400">
                      {a.runs === 0 ? "Pendiente" : pct(a.rate)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-black text-gray-900">{agentSummary.totalRuns}</p>
                  <p className="text-gray-400">ejecuciones</p>
                </div>
                <div>
                  <p className="font-black text-emerald-600">{agentSummary.successRuns}</p>
                  <p className="text-gray-400">ok</p>
                </div>
                <div>
                  <p className="font-black text-gray-900">{agentSummary.totalPosts}</p>
                  <p className="text-gray-400">posts</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Planes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📊</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Distribución de planes</p>
              <p className="text-[11px] text-gray-400">Cómo están suscritos tus clientes</p>
            </div>
          </div>
          {planSorted.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin clientes aún</p>
          ) : (
            <div className="space-y-3.5">
              {planSorted.map(([plan, count]) => {
                const p = ((count / Math.max(tenants.length, 1)) * 100);
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-700">{plan}</span>
                      <span className="text-xs text-gray-400">{count} · {p.toFixed(0)}%</span>
                    </div>
                    <Bar pct={p} />
                  </div>
                );
              })}
              {arpu > 0 && (
                <div className="mt-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700">
                  💡 <strong>ARPU {arpu.toFixed(0)} €</strong> — 10 clientes nuevos = <strong>{(arpu * 10).toFixed(0)} €/mes</strong> más
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* LTV insight */}
      {ltv > 0 && (
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center shrink-0">
            <span className="text-lg">🎯</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">LTV estimado: <span className="text-[#3b82f6]">{eurosNum(ltv)}</span></p>
            <p className="text-xs text-gray-500">Valor de vida de un cliente con churn actual del {pct(churn)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Finanzas ────────────────────────────────────────────────────────

function FinanzasSection({ revenue, aiEntries }: { revenue: RevenueData | null; aiEntries: AiEntry[] }) {
  if (!revenue) return <p className="text-sm text-gray-400 py-8 text-center">Cargando datos financieros…</p>;

  const sf = revenue.breakdown["socialflow"] ?? null;
  const mrr = sf?.mrr_cents ?? 0;
  const active = sf?.active_tenants ?? 0;
  const churn = sf?.churn_rate ?? 0;
  const pastDue = sf?.past_due_count ?? 0;
  const statusBreakdown = sf?.status_breakdown ?? {};

  const aiCost = aiEntries.filter((e) => e.saasId === "socialflow")
    .reduce((s, e) => s + estimateCostEur(e.tokensIn, e.tokensOut), 0);
  const arpu = active > 0 ? mrr / 100 / active : 0;
  const ltv = churn > 0 ? arpu / churn : 0;
  const net = mrr / 100 - aiCost - 20;
  const annual = (mrr / 100) * 12;
  const daily = mrr / 100 / 30;
  const breakEven = arpu > 0 ? Math.ceil((aiCost + 20) / arpu) : null;
  const aiRatioPct = mrr > 0 ? (aiCost / (mrr / 100)) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Proyecciones de ingresos</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="MRR" value={euros(mrr)} sub="Este mes" icon="💰" highlight />
          <Kpi label="Diario" value={`${daily.toFixed(2)} €`} sub="Promedio" icon="📅" />
          <Kpi label="ARR" value={`${annual.toFixed(0)} €`} sub="Proyectado" icon="📈" />
          <Kpi label="Margen neto" value={`${net.toFixed(0)} €`}
            sub="MRR − IA − hosting" icon={net >= 0 ? "✅" : "⚠️"}
            highlight={net > 0} danger={net < 0} />
        </div>
      </div>

      {/* Métricas de salud */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Salud del negocio</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">ARPU</p>
            <p className="text-2xl font-black text-gray-900">{arpu.toFixed(0)} €</p>
            <p className="text-[11px] text-gray-400">por cliente/mes</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">LTV</p>
            <p className="text-2xl font-black text-gray-900">{ltv > 0 ? `${ltv.toFixed(0)} €` : "—"}</p>
            <p className="text-[11px] text-gray-400">ARPU ÷ churn mensual</p>
          </div>
          <div className={`rounded-2xl border p-4 ${pastDue > 0 ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-widest mb-1 ${pastDue > 0 ? "text-red-500" : "text-gray-400"}`}>
              Past due
            </p>
            <p className={`text-2xl font-black ${pastDue > 0 ? "text-red-600" : "text-gray-900"}`}>{pastDue}</p>
            <p className="text-[11px] text-gray-400">pagos atrasados</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Break-even</p>
            <p className="text-2xl font-black text-gray-900">{breakEven ?? "—"}</p>
            <p className="text-[11px] text-gray-400">clientes para cubrir costes</p>
          </div>
        </div>
      </div>

      {/* Coste IA vs Revenue */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-gray-800">Coste IA vs Revenue</p>
            <p className="text-xs text-gray-400">Qué parte del MRR se va en IA</p>
          </div>
          <div className={`rounded-xl px-3 py-1.5 text-xs font-black ${
            aiRatioPct < 5 ? "bg-emerald-100 text-emerald-700" :
            aiRatioPct < 15 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          }`}>
            {aiRatioPct.toFixed(1)}%
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Coste IA: {aiCost.toFixed(2)} €/mes</span>
            <span>MRR: {euros(mrr)}</span>
          </div>
          <Bar pct={aiRatioPct} color={aiRatioPct < 10 ? "green" : "orange"} />
          <p className="text-xs text-gray-400 mt-1">
            {aiRatioPct < 5 ? "✅ Excelente ratio — la IA es muy barata respecto al revenue" :
             aiRatioPct < 15 ? "🟡 Ratio aceptable — ojo si sigue creciendo" :
             "🔴 Ratio alto — revisar prompts y frecuencia de agentes"}
          </p>
        </div>
      </div>

      {/* Estados de suscripción */}
      {Object.keys(statusBreakdown).length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">Suscripciones por estado</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusBreakdown).map(([status, count]) => {
              const color: "green" | "red" | "orange" | "gray" =
                ["active", "trialing", "trial"].includes(status) ? "green" :
                status === "canceled" ? "red" :
                status === "past_due" ? "orange" : "gray";
              return <Pill key={status} color={color}>{status}: {count as number}</Pill>;
            })}
          </div>
        </div>
      )}

      {/* Churn insight */}
      {churn > 0 && mrr > 0 && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800 mb-0.5">⚠️ Impacto del churn</p>
          <p className="text-sm text-red-700">
            Con churn del <strong>{pct(churn)}</strong> pierdes ~<strong>{euros(mrr * churn)}/mes</strong>.
            Necesitas adquirir eso en clientes nuevos cada mes solo para mantener el MRR actual.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Section: Clientes ────────────────────────────────────────────────────────

function ClientesSection({
  tenants, aiEntries, internalAccounts,
}: {
  tenants: Tenant[]; aiEntries: AiEntry[]; internalAccounts: InternalAccount[];
}) {
  const [search, setSearch] = useState("");
  const internalSet = new Set(internalAccounts.map((a) => a.tenantId));

  const costByTenant: Record<string, number> = {};
  for (const e of aiEntries) {
    if (e.saasId !== "socialflow") continue;
    costByTenant[e.tenantId] = (costByTenant[e.tenantId] ?? 0) + estimateCostEur(e.tokensIn, e.tokensOut);
  }

  const filtered = tenants.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.tenantId.toLowerCase().includes(q) || (t.niche ?? "").toLowerCase().includes(q);
  });

  const paying = tenants.filter((t) => !internalSet.has(t.tenantId));
  const topAi = [...tenants].sort((a, b) => (costByTenant[b.tenantId] ?? 0) - (costByTenant[a.tenantId] ?? 0)).slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center">
          <p className="text-3xl font-black text-gray-900">{tenants.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Cuentas totales</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
          <p className="text-3xl font-black text-blue-600">{paying.length}</p>
          <p className="text-xs text-blue-500 mt-0.5">Clientes de pago</p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 text-center">
          <p className="text-3xl font-black text-purple-600">{internalAccounts.length}</p>
          <p className="text-xs text-purple-500 mt-0.5">Cuentas internas</p>
        </div>
      </div>

      {/* Top IA */}
      {topAi.some((t) => (costByTenant[t.tenantId] ?? 0) > 0) && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">🔥 Top consumo de IA</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {topAi.filter((t) => (costByTenant[t.tenantId] ?? 0) > 0).map((t, i) => (
              <div key={t.tenantId} className="flex items-center gap-2 rounded-xl bg-white border border-amber-100 px-3 py-2">
                <span className="text-lg font-black text-amber-400">#{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.name}</p>
                  <p className="text-xs text-amber-600">{(costByTenant[t.tenantId] ?? 0).toFixed(3)} €/mes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, nicho o ID…"
          className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
        />
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-widest text-gray-400">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold">Nicho</th>
                <th className="text-left px-4 py-3 font-semibold">Plan</th>
                <th className="text-right px-4 py-3 font-semibold">Coste IA</th>
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Tenant ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filtered.map((t) => {
                const cost = costByTenant[t.tenantId] ?? 0;
                const isInternal = internalSet.has(t.tenantId);
                return (
                  <tr key={t.tenantId} className={`transition ${isInternal ? "bg-purple-50/40" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-3 font-semibold text-gray-900 max-w-[180px] truncate">
                      {isInternal && <span className="mr-1.5">🔑</span>}{t.name}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[120px] truncate">{t.niche ?? "—"}</td>
                    <td className="px-4 py-3"><PlanPill plan={isInternal ? "pro" : t.plan} /></td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                      {cost > 0 ? `${cost.toFixed(3)} €` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isInternal ? <Pill color="purple">Interno</Pill> : <span className="text-xs text-gray-400">Cliente</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300 hidden xl:table-cell max-w-[120px] truncate">
                      {t.tenantId}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Section: IA ──────────────────────────────────────────────────────────────

function IASection({ entries }: { entries: AiEntry[] }) {
  const sfEntries = entries.filter((e) => e.saasId === "socialflow");

  const byModel: Record<string, { tokensIn: number; tokensOut: number; requests: number }> = {};
  const byMonth: Record<string, { cost: number; requests: number }> = {};

  for (const e of sfEntries) {
    const m = e.model || "unknown";
    if (!byModel[m]) byModel[m] = { tokensIn: 0, tokensOut: 0, requests: 0 };
    byModel[m].tokensIn += e.tokensIn;
    byModel[m].tokensOut += e.tokensOut;
    byModel[m].requests += e.requestsCount;

    const mo = e.month || "—";
    if (!byMonth[mo]) byMonth[mo] = { cost: 0, requests: 0 };
    byMonth[mo].cost += estimateCostEur(e.tokensIn, e.tokensOut);
    byMonth[mo].requests += e.requestsCount;
  }

  const totalIn = sfEntries.reduce((s, e) => s + e.tokensIn, 0);
  const totalOut = sfEntries.reduce((s, e) => s + e.tokensOut, 0);
  const totalReqs = sfEntries.reduce((s, e) => s + e.requestsCount, 0);
  const totalCost = estimateCostEur(totalIn, totalOut);

  const sortedMonths = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* KPIs IA */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Tokens entrada" value={`${(totalIn / 1000).toFixed(1)}k`} sub="Histórico total" icon="📥" />
        <Kpi label="Tokens salida" value={`${(totalOut / 1000).toFixed(1)}k`} sub="Histórico total" icon="📤" />
        <Kpi label="Peticiones" value={totalReqs.toLocaleString("es-ES")} sub="Llamadas a la IA" icon="⚡" />
        <Kpi label="Coste total" value={`${totalCost.toFixed(2)} €`}
          sub="Estimación histórica" icon="💸"
          danger={totalCost > 50} highlight={totalCost <= 5} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Modelos */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">Modelos utilizados</p>
          {Object.keys(byModel).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin datos de modelos</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(byModel).map(([model, stats]) => {
                const cost = estimateCostEur(stats.tokensIn, stats.tokensOut);
                const share = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                return (
                  <div key={model}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-gray-600 truncate max-w-[180px]">{model}</span>
                      <span className="text-xs text-gray-400 shrink-0 ml-2">{cost.toFixed(3)} € · {share.toFixed(0)}%</span>
                    </div>
                    <Bar pct={share} />
                    <p className="text-[11px] text-gray-400 mt-1">
                      {stats.requests} peticiones · {(stats.tokensIn / 1000).toFixed(1)}k entrada · {(stats.tokensOut / 1000).toFixed(1)}k salida
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Evolución */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">Evolución mensual del coste</p>
          {sortedMonths.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin histórico mensual</p>
          ) : (
            <div className="space-y-3">
              {sortedMonths.map(([month, stats]) => {
                const maxCost = Math.max(...sortedMonths.map((m) => m[1].cost), 0.01);
                return (
                  <div key={month}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-semibold text-gray-700">{month}</span>
                      <span className="text-gray-400">{stats.cost.toFixed(3)} €</span>
                    </div>
                    <Bar pct={(stats.cost / maxCost) * 100} color="orange" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tip */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Ratio óptimo:</strong> mantener el coste IA por debajo del <strong>5% del MRR</strong>.
          Si supera el 15%, revisar la frecuencia de ejecución de agentes y la longitud de los prompts.
        </p>
      </div>
    </div>
  );
}

// ─── Section: Cuentas Internas ───────────────────────────────────────────────

function CuentasInternasSection({
  accounts, tenants, onAdd, onRemove,
}: {
  accounts: InternalAccount[]; tenants: Tenant[];
  onAdd: (tenantId: string, label: string) => Promise<void>;
  onRemove: (tenantId: string) => Promise<void>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const accountSet = new Set(accounts.map((a) => a.tenantId));
  const nonInternalTenants = tenants.filter((t) => !accountSet.has(t.tenantId));
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.tenantId, t.name]));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!tenantId.trim()) { setMsg({ type: "err", text: "Introduce un Tenant ID" }); return; }
    setAdding(true);
    try {
      await onAdd(tenantId.trim(), label.trim());
      setMsg({ type: "ok", text: `✅ Añadida: ${label.trim() || tenantId.trim()}` });
      setTenantId(""); setLabel("");
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Error inesperado" });
    } finally { setAdding(false); }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    try {
      await onRemove(id);
      setMsg({ type: "ok", text: `✅ Cuenta eliminada` });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Error al eliminar" });
    } finally { setRemoving(null); }
  }

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-5">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-white border border-blue-100 flex items-center justify-center shrink-0">
            <span className="text-lg">🔑</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 mb-1">¿Qué son las cuentas internas?</p>
            <p className="text-sm text-gray-600">
              Los tenants en esta lista reciben automáticamente el <strong>plan Pro</strong> sin necesitar
              suscripción de Stripe. Úsalo para tus propias empresas, cuentas de demo y pruebas internas.
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-bold text-gray-800 mb-4">Añadir cuenta interna</p>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Tenant ID *</label>
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="ej. abc123def456"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-mono focus:border-[#3b82f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3b82f6] transition"
              disabled={adding}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Etiqueta (opcional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ej. Mi empresa"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#3b82f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3b82f6] transition"
              disabled={adding}
            />
          </div>
          <button
            type="submit"
            disabled={adding || !tenantId.trim()}
            className="rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-6 py-2.5 text-sm font-black text-white shadow shadow-blue-200 hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {adding ? "Añadiendo…" : "+ Añadir"}
          </button>
        </form>

        {/* Selector rápido de clientes existentes */}
        {nonInternalTenants.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2.5">Seleccionar desde clientes existentes:</p>
            <div className="flex flex-wrap gap-2">
              {nonInternalTenants.slice(0, 12).map((t) => (
                <button
                  key={t.tenantId}
                  onClick={() => { setTenantId(t.tenantId); setLabel(t.name); }}
                  className={[
                    "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                    tenantId === t.tenantId
                      ? "border-[#3b82f6] bg-blue-50 text-[#3b82f6]"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#3b82f6] hover:text-[#3b82f6]",
                  ].join(" ")}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {msg && (
          <p className={`mt-3 text-sm font-semibold ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Lista de cuentas */}
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-2xl mb-2">🔑</p>
          <p className="text-sm font-semibold text-gray-500">Sin cuentas internas configuradas</p>
          <p className="text-xs text-gray-400 mt-1">Añade tu cuenta de empresa arriba para darle plan Pro sin Stripe</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              {accounts.length} cuenta{accounts.length > 1 ? "s" : ""} interna{accounts.length > 1 ? "s" : ""} activa{accounts.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y divide-gray-50 bg-white">
            {accounts.map((acc) => (
              <div key={acc.tenantId + acc.saasSlug}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition">
                <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-base">🔑</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    {acc.label || tenantMap[acc.tenantId] || "Sin etiqueta"}
                  </p>
                  <p className="text-xs font-mono text-gray-400 truncate">{acc.tenantId}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Pill color="purple">{acc.saasSlug}</Pill>
                  <span className="text-xs text-gray-400 hidden sm:block">
                    {new Date(acc.addedAt).toLocaleDateString("es-ES")}
                  </span>
                  <button
                    onClick={() => handleRemove(acc.tenantId)}
                    disabled={removing === acc.tenantId}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                  >
                    {removing === acc.tenantId ? "…" : "Eliminar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SocialflowOperatorDashboard() {
  const [section, setSection] = useState<SectionId>("overview");
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [aiEntries, setAiEntries] = useState<AiEntry[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [internalAccounts, setInternalAccounts] = useState<InternalAccount[]>([]);
  const [agentSummary, setAgentSummary] = useState<AgentRunSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rev, ai, tenantsRes, intRes, agentRes] = await Promise.all([
        fetch("/api/operator/revenue").then((r) => r.json() as Promise<{ ok: boolean; data: RevenueData }>),
        fetch("/api/operator/ai-costs?saasId=socialflow").then((r) => r.json() as Promise<{ ok: boolean; entries: AiEntry[] }>),
        fetch("/api/operator/socialflow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "list_tenants" }),
        }).then((r) => r.json() as Promise<{ action: string; result: { tenants: Tenant[] } }>),
        fetch("/api/operator/internal-accounts?saasSlug=socialflow").then((r) => r.json() as Promise<{ ok: boolean; accounts: InternalAccount[] }>),
        fetch("/api/operator/socialflow").then((r) => r.json() as Promise<{ summary?: AgentRunSummary }>),
      ]);

      if (rev.ok) setRevenue(rev.data);
      if (ai.ok) setAiEntries(ai.entries ?? []);
      if (tenantsRes.action === "list_tenants") setTenants(tenantsRes.result?.tenants ?? []);
      if (intRes.ok) setInternalAccounts(intRes.accounts ?? []);
      if (agentRes.summary) setAgentSummary(agentRes.summary);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddInternal(tenantId: string, label: string) {
    const res = await fetch("/api/operator/internal-accounts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, saasSlug: "socialflow", label }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(data.error ?? "Error al añadir");
    await load();
  }

  async function handleRemoveInternal(tenantId: string) {
    const res = await fetch("/api/operator/internal-accounts", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, saasSlug: "socialflow" }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(data.error ?? "Error al eliminar");
    await load();
  }

  // Quick stats for sidebar badges
  const sfRev = revenue?.breakdown["socialflow"];
  const mrr = sfRev?.mrr_cents ?? 0;
  const pastDue = sfRev?.past_due_count ?? 0;

  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center shadow shadow-blue-200 shrink-0">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 leading-none">Socialcors</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Panel de control del operador</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && mrr > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5">
              <span className="text-[11px] text-blue-500 font-semibold">MRR</span>
              <span className="text-sm font-black text-blue-700">{euros(mrr)}</span>
            </div>
          )}
          {!loading && pastDue > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5">
              <span className="text-orange-500 text-sm">⚠️</span>
              <span className="text-xs font-bold text-orange-700">{pastDue} past_due</span>
            </div>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* ── Layout: Sidebar + Content ── */}
      <div className="flex min-h-[600px]">
        {/* Sidebar nav */}
        <aside className="w-52 shrink-0 border-r border-gray-100 bg-gray-50/60 py-4 hidden md:block">
          <nav className="space-y-0.5 px-3">
            {SECTIONS.map((s) => {
              const isActive = section === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={[
                    "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition text-sm",
                    isActive
                      ? "bg-white border border-gray-200 shadow-sm font-bold text-gray-900"
                      : "text-gray-500 hover:bg-white hover:text-gray-700 font-medium",
                  ].join(" ")}
                >
                  <span className="text-base shrink-0">{s.icon}</span>
                  <span className="flex-1 truncate">{s.label}</span>
                  {s.id === "internas" && internalAccounts.length > 0 && (
                    <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-black text-purple-700">
                      {internalAccounts.length}
                    </span>
                  )}
                  {s.id === "overview" && pastDue > 0 && (
                    <span className="h-2 w-2 rounded-full bg-orange-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer — quick stats */}
          {!loading && (
            <div className="mt-6 px-4 space-y-2">
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Clientes</p>
                <p className="text-lg font-black text-gray-900">{tenants.length}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Internos</p>
                <p className="text-lg font-black text-purple-600">{internalAccounts.length}</p>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile nav */}
        <div className="flex md:hidden border-b border-gray-100 overflow-x-auto w-full bg-gray-50/50">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={[
                "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition",
                section === s.id
                  ? "border-[#3b82f6] text-[#3b82f6]"
                  : "border-transparent text-gray-400",
              ].join(" ")}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin" />
              <p className="text-sm text-gray-400">Cargando datos del panel…</p>
            </div>
          ) : section === "overview" ? (
            <OverviewSection
              revenue={revenue} tenants={tenants} aiEntries={aiEntries}
              agentSummary={agentSummary} internalAccounts={internalAccounts}
            />
          ) : section === "finanzas" ? (
            <FinanzasSection revenue={revenue} aiEntries={aiEntries} />
          ) : section === "clientes" ? (
            <ClientesSection tenants={tenants} aiEntries={aiEntries} internalAccounts={internalAccounts} />
          ) : section === "ia" ? (
            <IASection entries={aiEntries} />
          ) : (
            <CuentasInternasSection
              accounts={internalAccounts}
              tenants={tenants}
              onAdd={handleAddInternal}
              onRemove={handleRemoveInternal}
            />
          )}
        </main>
      </div>
    </div>
  );
}
