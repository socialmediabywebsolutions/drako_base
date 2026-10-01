"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euros(cents: number, decimals = 0) {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function estimateCostEur(tokensIn: number, tokensOut: number) {
  const costUsd = (tokensIn / 1_000_000) * 0.1 + (tokensOut / 1_000_000) * 0.3;
  return costUsd * 0.93;
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) return `hace ${Math.floor(h / 24)}d`;
  if (h > 0) return `hace ${h}h ${m}m`;
  return `hace ${m}m`;
}

// ─── UI Atoms ────────────────────────────────────────────────────────────────

const TAB_ACTIVE =
  "border-b-2 border-[#3b82f6] text-[#3b82f6] font-semibold pb-3 px-1 text-sm whitespace-nowrap";
const TAB_INACTIVE =
  "border-b-2 border-transparent text-gray-400 hover:text-gray-600 pb-3 px-1 text-sm whitespace-nowrap transition";

function Pill({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "red" | "orange" | "gray" | "purple" }) {
  const cls = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    orange: "bg-orange-100 text-orange-700",
    gray: "bg-gray-100 text-gray-600",
    purple: "bg-purple-100 text-purple-700",
  }[color];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}

function PlanPill({ plan }: { plan: string | null }) {
  if (!plan) return <Pill color="gray">free</Pill>;
  if (plan.includes("pro")) return <Pill color="blue">{plan}</Pill>;
  if (plan.includes("basico")) return <Pill color="green">{plan}</Pill>;
  if (plan.includes("starter")) return <Pill color="gray">{plan}</Pill>;
  return <Pill color="orange">{plan}</Pill>;
}

// ─── Hero KPI Card ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  trend,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { label: string; up: boolean } | null;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-1",
        accent
          ? "border-[#3b82f6]/30 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-sm shadow-blue-100"
          : "border-gray-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <span className="text-xl">{icon}</span>
        {trend && (
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs font-bold",
              trend.up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
            ].join(" ")}
          >
            {trend.up ? "▲" : "▼"} {trend.label}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <p className={["text-3xl font-black tracking-tight", accent ? "text-[#3b82f6]" : "text-gray-900"].join(" ")}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Agent Status Badge ───────────────────────────────────────────────────────

function AgentStatusRow({
  label,
  successRate,
  totalRuns,
  totalPosts,
  lastRunAt,
}: {
  label: string;
  successRate: number;
  totalRuns: number;
  totalPosts: number;
  lastRunAt: string | null;
}) {
  const ok = successRate >= 0.9;
  const warn = successRate >= 0.7 && !ok;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span
        className={[
          "h-2.5 w-2.5 rounded-full shrink-0",
          totalRuns === 0 ? "bg-gray-300" : ok ? "bg-emerald-500" : warn ? "bg-orange-400" : "bg-red-500",
        ].join(" ")}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
        <p className="text-xs text-gray-400">
          {totalRuns === 0
            ? "Sin ejecuciones"
            : `${pct(successRate)} éxito · ${totalRuns} ejecuciones · ${totalPosts} posts`}
        </p>
      </div>
      <p className="text-xs text-gray-400 shrink-0">{timeAgo(lastRunAt)}</p>
    </div>
  );
}

// ─── Overview Hero ────────────────────────────────────────────────────────────

function OverviewHero({
  revenue,
  tenants,
  aiEntries,
  agentSummary,
  internalAccounts,
}: {
  revenue: RevenueData | null;
  tenants: Tenant[];
  aiEntries: AiEntry[];
  agentSummary: AgentRunSummary | null;
  internalAccounts: InternalAccount[];
}) {
  const sf = revenue?.breakdown["socialflow"] ?? null;
  const mrr = sf?.mrr_cents ?? 0;
  const active = sf?.active_tenants ?? 0;
  const churn = sf?.churn_rate ?? 0;
  const pastDue = sf?.past_due_count ?? 0;

  // Proyecciones
  const dailyEur = mrr / 100 / 30;
  const annualEur = (mrr / 100) * 12;

  // LTV estimado: ARPU / churn rate mensual
  const arpu = active > 0 ? mrr / 100 / active : 0;
  const ltv = churn > 0 ? arpu / churn : 0;

  // Coste IA total este mes
  const sfAi = aiEntries.filter((e) => e.saasId === "socialflow");
  const totalAiCost = sfAi.reduce((s, e) => s + estimateCostEur(e.tokensIn, e.tokensOut), 0);
  const aiCostRatio = mrr > 0 ? (totalAiCost / (mrr / 100)) * 100 : 0;

  // Margen neto estimado (MRR - coste IA - hosting ~20€/mes)
  const infraEst = 20;
  const netMargin = mrr / 100 - totalAiCost - infraEst;

  const internalSet = new Set(internalAccounts.map((a) => a.tenantId));
  const payingClients = tenants.filter((t) => !internalSet.has(t.tenantId)).length;

  return (
    <div className="space-y-5">
      {/* Alerta pagos pendientes */}
      {pastDue > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <span className="text-orange-500">⚠️</span>
          <p className="text-sm font-semibold text-orange-800">
            {pastDue} pago{pastDue > 1 ? "s" : ""} pendiente{pastDue > 1 ? "s" : ""} de cobro
          </p>
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="MRR"
          value={euros(mrr)}
          sub="Ingresos recurrentes mes"
          icon="💰"
          accent
        />
        <KpiCard
          label="Ingreso diario"
          value={`${dailyEur.toFixed(1)} €`}
          sub="Promedio por día"
          icon="📅"
        />
        <KpiCard
          label="ARR proyectado"
          value={`${(annualEur / 1000).toFixed(1)}k €`}
          sub="Si no entra ni sale nadie"
          icon="📈"
        />
        <KpiCard
          label="Clientes activos"
          value={String(active)}
          sub={`${payingClients} de pago · ${internalAccounts.length} internos`}
          icon="👥"
          trend={active > 0 ? { label: "activos", up: true } : null}
        />
        <KpiCard
          label="LTV estimado"
          value={ltv > 0 ? `${ltv.toFixed(0)} €` : "—"}
          sub={`Churn: ${pct(churn)}`}
          icon="🎯"
        />
        <KpiCard
          label="Margen neto est."
          value={`${netMargin.toFixed(0)} €`}
          sub={`IA: ${totalAiCost.toFixed(2)} € · ${aiCostRatio.toFixed(1)}% del MRR`}
          icon="📊"
          accent={netMargin > 0}
        />
      </div>

      {/* Segunda fila: agentes + distribución de planes */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Agentes */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Agentes IA</p>
              <p className="text-sm font-bold text-gray-800">Estado de automatización</p>
            </div>
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                agentSummary === null
                  ? "bg-gray-300"
                  : agentSummary.successRate >= 0.9
                  ? "bg-emerald-500 shadow shadow-emerald-200"
                  : "bg-orange-400",
              ].join(" ")}
            />
          </div>
          {agentSummary === null ? (
            <p className="text-sm text-gray-400">Sin datos de ejecución aún.</p>
          ) : (
            <div className="space-y-0">
              <AgentStatusRow
                label="Orquestador de contenido"
                successRate={agentSummary.successRate}
                totalRuns={agentSummary.totalRuns}
                totalPosts={agentSummary.totalPosts}
                lastRunAt={agentSummary.latestRunAt}
              />
              <AgentStatusRow
                label="Publicador automático"
                successRate={agentSummary.successRate}
                totalRuns={agentSummary.totalRuns}
                totalPosts={agentSummary.totalPosts}
                lastRunAt={agentSummary.latestRunAt}
              />
              <AgentStatusRow
                label="Prospector"
                successRate={1}
                totalRuns={0}
                totalPosts={0}
                lastRunAt={null}
              />
            </div>
          )}
          {agentSummary && agentSummary.totalRuns > 0 && (
            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-3 flex items-center gap-4 text-xs text-gray-500">
              <span>✅ {agentSummary.successRuns} OK</span>
              <span>❌ {agentSummary.failedRuns} fallidas</span>
              <span>📝 {agentSummary.totalPosts} posts generados</span>
            </div>
          )}
        </div>

        {/* Distribución de planes */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Distribución de planes</p>
          <p className="text-sm font-bold text-gray-800 mb-4">Cómo están suscritos tus clientes</p>
          {tenants.length === 0 ? (
            <p className="text-sm text-gray-400">Sin clientes aún.</p>
          ) : (() => {
            const planCount: Record<string, number> = {};
            for (const t of tenants) {
              const k = t.plan ?? "free";
              planCount[k] = (planCount[k] ?? 0) + 1;
            }
            const sorted = Object.entries(planCount).sort((a, b) => b[1] - a[1]);
            const total = tenants.length;
            return (
              <div className="space-y-3">
                {sorted.map(([plan, count]) => {
                  const pct2 = ((count / total) * 100).toFixed(0);
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-700">{plan}</span>
                        <span className="text-gray-400">{count} cliente{count > 1 ? "s" : ""} · {pct2}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4]"
                          style={{ width: `${pct2}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Insight rápido */}
          {tenants.length > 0 && arpu > 0 && (
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
              💡 <strong>ARPU:</strong> {arpu.toFixed(0)} €/cliente · Con 10 clientes más ganarías{" "}
              <strong>{(arpu * 10).toFixed(0)} € extra al mes</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sección Finanzas ─────────────────────────────────────────────────────────

function FinanzasSection({ revenue, aiEntries }: { revenue: RevenueData | null; aiEntries: AiEntry[] }) {
  if (!revenue) return <p className="text-sm text-gray-400">Cargando datos financieros…</p>;

  const sf = revenue.breakdown["socialflow"] ?? null;
  const mrr = sf?.mrr_cents ?? 0;
  const active = sf?.active_tenants ?? 0;
  const churn = sf?.churn_rate ?? 0;
  const pastDue = sf?.past_due_count ?? 0;
  const statusBreakdown = sf?.status_breakdown ?? {};

  const totalAiCost = aiEntries
    .filter((e) => e.saasId === "socialflow")
    .reduce((s, e) => s + estimateCostEur(e.tokensIn, e.tokensOut), 0);

  const arpu = active > 0 ? mrr / 100 / active : 0;
  const ltv = churn > 0 ? arpu / churn : 0;
  const netMargin = mrr / 100 - totalAiCost - 20;
  const annualProj = (mrr / 100) * 12;
  const dailyProj = mrr / 100 / 30;
  const breakEvenClients = arpu > 0 ? Math.ceil((totalAiCost + 20) / arpu) : "—";

  return (
    <div className="space-y-6">
      {/* KPIs expandidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">MRR actual</p>
          <p className="text-2xl font-black text-[#3b82f6]">{euros(mrr)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">Ingreso diario</p>
          <p className="text-2xl font-black text-gray-900">{dailyProj.toFixed(2)} €</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">ARR proyectado</p>
          <p className="text-2xl font-black text-gray-900">{annualProj.toFixed(0)} €</p>
          <p className="text-xs text-gray-400">si no varía el MRR</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">Margen neto est.</p>
          <p className={`text-2xl font-black ${netMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {netMargin.toFixed(0)} €
          </p>
          <p className="text-xs text-gray-400">MRR − IA − hosting</p>
        </div>
      </div>

      {/* Métricas de retención y crecimiento */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-blue-600 mb-1">ARPU</p>
          <p className="text-xl font-black text-blue-800">{arpu.toFixed(0)} €</p>
          <p className="text-xs text-blue-500">por cliente/mes</p>
        </div>
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
          <p className="text-xs text-purple-600 mb-1">LTV estimado</p>
          <p className="text-xl font-black text-purple-800">{ltv > 0 ? `${ltv.toFixed(0)} €` : "—"}</p>
          <p className="text-xs text-purple-500">ARPU / churn mensual</p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
          <p className="text-xs text-orange-600 mb-1">Clientes para break-even</p>
          <p className="text-xl font-black text-orange-800">{breakEvenClients}</p>
          <p className="text-xs text-orange-500">para cubrir IA + hosting</p>
        </div>
        <div className={`rounded-xl border p-4 ${pastDue > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
          <p className={`text-xs mb-1 ${pastDue > 0 ? "text-red-600" : "text-gray-400"}`}>Pagos en riesgo</p>
          <p className={`text-xl font-black ${pastDue > 0 ? "text-red-700" : "text-gray-700"}`}>{pastDue}</p>
          <p className="text-xs text-gray-400">clientes past_due</p>
        </div>
      </div>

      {/* Coste IA vs Revenue */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-bold text-gray-800 mb-3">Coste IA vs Revenue</p>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Coste IA: {totalAiCost.toFixed(2)} €</span>
            <span>MRR: {euros(mrr)}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-orange-400 to-red-400"
              style={{ width: `${Math.min(100, (totalAiCost / Math.max(mrr / 100, 1)) * 100).toFixed(1)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">
            La IA representa el{" "}
            <strong>{mrr > 0 ? ((totalAiCost / (mrr / 100)) * 100).toFixed(1) : 0}%</strong> del MRR
            {mrr > 0 && (totalAiCost / (mrr / 100)) < 0.1
              ? " — excelente ratio"
              : mrr > 0 && (totalAiCost / (mrr / 100)) < 0.25
              ? " — aceptable"
              : " — revisar"}
          </p>
        </div>
      </div>

      {/* Desglose por estado */}
      {Object.keys(statusBreakdown).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Suscripciones por estado</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusBreakdown).map(([status, count]) => {
              const color =
                status === "active" || status === "trialing" || status === "trial"
                  ? "green"
                  : status === "canceled"
                  ? "red"
                  : status === "past_due"
                  ? "orange"
                  : "gray";
              return <Pill key={status} color={color}>{status}: {count as number}</Pill>;
            })}
          </div>
        </div>
      )}

      {/* Churn insight */}
      {churn > 0 && mrr > 0 && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          ⚠️ Con un churn del <strong>{pct(churn)}</strong>, pierdes aproximadamente{" "}
          <strong>{euros(mrr * churn)}/mes</strong>. Para crecer necesitas adquirir más de ese valor en clientes nuevos cada mes.
        </div>
      )}
    </div>
  );
}

// ─── Sección Clientes ─────────────────────────────────────────────────────────

function ClientesSection({
  tenants,
  aiEntries,
  internalAccounts,
}: {
  tenants: Tenant[];
  aiEntries: AiEntry[];
  internalAccounts: InternalAccount[];
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

  const payingClients = tenants.filter((t) => !internalSet.has(t.tenantId));
  const topByAi = [...tenants].sort((a, b) => (costByTenant[b.tenantId] ?? 0) - (costByTenant[a.tenantId] ?? 0)).slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{tenants.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Cuentas totales</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-black text-[#3b82f6]">{payingClients.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Clientes de pago</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-black text-purple-600">{internalAccounts.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Cuentas internas</p>
        </div>
      </div>

      {/* Top por uso IA */}
      {topByAi.some((t) => (costByTenant[t.tenantId] ?? 0) > 0) && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-2">🔥 Top uso IA</p>
          <div className="flex flex-wrap gap-3">
            {topByAi.filter((t) => (costByTenant[t.tenantId] ?? 0) > 0).map((t, i) => (
              <div key={t.tenantId} className="flex items-center gap-2 text-sm">
                <span className="font-black text-amber-600">#{i + 1}</span>
                <span className="font-semibold text-gray-800">{t.name}</span>
                <span className="text-amber-700">{(costByTenant[t.tenantId] ?? 0).toFixed(3)} €</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre, nicho o ID…"
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
      />

      {/* Tabla */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">Sin resultados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold">Nicho</th>
                <th className="text-left px-4 py-3 font-semibold">Plan</th>
                <th className="text-right px-4 py-3 font-semibold">Coste IA</th>
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Tenant ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map((t) => {
                const cost = costByTenant[t.tenantId] ?? 0;
                const isInternal = internalSet.has(t.tenantId);
                return (
                  <tr key={t.tenantId} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{t.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{t.niche ?? "—"}</td>
                    <td className="px-4 py-3"><PlanPill plan={t.plan} /></td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                      {cost > 0 ? `${cost.toFixed(3)} €` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isInternal
                        ? <Pill color="purple">Interno</Pill>
                        : <span className="text-xs text-gray-400">Cliente</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 hidden xl:table-cell max-w-[120px] truncate">
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

// ─── Sección IA ───────────────────────────────────────────────────────────────

function IASection({ entries }: { entries: AiEntry[] }) {
  const sfEntries = entries.filter((e) => e.saasId === "socialflow");

  const byModel: Record<string, { tokensIn: number; tokensOut: number; requests: number }> = {};
  const byMonth: Record<string, { tokensIn: number; tokensOut: number; requests: number; cost: number }> = {};

  for (const e of sfEntries) {
    const m = e.model || "unknown";
    if (!byModel[m]) byModel[m] = { tokensIn: 0, tokensOut: 0, requests: 0 };
    byModel[m].tokensIn += e.tokensIn;
    byModel[m].tokensOut += e.tokensOut;
    byModel[m].requests += e.requestsCount;

    const mo = e.month || "—";
    if (!byMonth[mo]) byMonth[mo] = { tokensIn: 0, tokensOut: 0, requests: 0, cost: 0 };
    byMonth[mo].tokensIn += e.tokensIn;
    byMonth[mo].tokensOut += e.tokensOut;
    byMonth[mo].requests += e.requestsCount;
    byMonth[mo].cost += estimateCostEur(e.tokensIn, e.tokensOut);
  }

  const totalIn = sfEntries.reduce((s, e) => s + e.tokensIn, 0);
  const totalOut = sfEntries.reduce((s, e) => s + e.tokensOut, 0);
  const totalReqs = sfEntries.reduce((s, e) => s + e.requestsCount, 0);
  const totalCost = estimateCostEur(totalIn, totalOut);

  const sortedMonths = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">Tokens entrada (total)</p>
          <p className="text-2xl font-black text-gray-900">{(totalIn / 1000).toFixed(1)}k</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">Tokens salida (total)</p>
          <p className="text-2xl font-black text-gray-900">{(totalOut / 1000).toFixed(1)}k</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">Peticiones IA</p>
          <p className="text-2xl font-black text-gray-900">{totalReqs.toLocaleString("es-ES")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">Coste total estimado</p>
          <p className={`text-2xl font-black ${totalCost > 50 ? "text-red-600" : "text-emerald-600"}`}>
            {totalCost.toFixed(2)} €
          </p>
          <p className="text-xs text-gray-400">histórico completo</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Modelos */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">Modelos utilizados</p>
          {Object.keys(byModel).length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos de modelos.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(byModel).map(([model, stats]) => {
                const cost = estimateCostEur(stats.tokensIn, stats.tokensOut);
                const sharePct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                return (
                  <div key={model}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono text-gray-700 truncate max-w-[200px]">{model}</span>
                      <span className="text-gray-400 shrink-0">{cost.toFixed(3)} € · {sharePct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4]"
                        style={{ width: `${sharePct.toFixed(0)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{stats.requests} peticiones · {(stats.tokensIn / 1000).toFixed(1)}k in · {(stats.tokensOut / 1000).toFixed(1)}k out</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Evolución mensual */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">Evolución mensual del coste</p>
          {sortedMonths.length === 0 ? (
            <p className="text-sm text-gray-400">Sin histórico mensual.</p>
          ) : (
            <div className="space-y-2.5">
              {sortedMonths.map(([month, stats]) => {
                const maxCost = Math.max(...sortedMonths.map((m) => m[1].cost), 0.01);
                const barPct = (stats.cost / maxCost) * 100;
                return (
                  <div key={month}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{month}</span>
                      <span className="text-gray-400">{stats.cost.toFixed(3)} €</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-amber-300"
                        style={{ width: `${barPct.toFixed(0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Consejo de optimización */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        💡 <strong>Tip:</strong> El ratio óptimo de coste IA es {"<"}5% del MRR. Si supera el 15%, revisa los prompts y el número de agentes que se ejecutan por cliente.
      </div>
    </div>
  );
}

// ─── Sección Cuentas Internas ─────────────────────────────────────────────────

function CuentasInternasSection({
  accounts,
  tenants,
  onAdd,
  onRemove,
}: {
  accounts: InternalAccount[];
  tenants: Tenant[];
  onAdd: (tenantId: string, label: string) => Promise<void>;
  onRemove: (tenantId: string) => Promise<void>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tenantMap = Object.fromEntries(tenants.map((t) => [t.tenantId, t.name]));
  const accountSet = new Set(accounts.map((a) => a.tenantId));
  const nonInternalTenants = tenants.filter((t) => !accountSet.has(t.tenantId));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!tenantId.trim()) { setError("Introduce un Tenant ID"); return; }
    setAdding(true);
    try {
      await onAdd(tenantId.trim(), label.trim());
      setSuccess(`✅ Añadida: ${label.trim() || tenantId.trim()}`);
      setTenantId("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Cuentas internas:</strong> Los tenants en esta lista reciben automáticamente el plan Pro más alto sin necesitar suscripción Stripe. Ideal para tus empresas y demos.
      </div>

      {/* Añadir */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-bold text-gray-700 mb-3">Añadir cuenta interna</p>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">Tenant ID *</label>
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="ej. abc123def456"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
              disabled={adding}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 mb-1 block">Etiqueta</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ej. Mi empresa principal"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
              disabled={adding}
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-5 py-2.5 text-sm font-black text-white shadow shadow-blue-200 hover:brightness-110 transition disabled:opacity-50"
          >
            {adding ? "Añadiendo…" : "Añadir"}
          </button>
        </form>

        {nonInternalTenants.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-2">Clientes existentes (no internos):</p>
            <div className="flex flex-wrap gap-2">
              {nonInternalTenants.slice(0, 10).map((t) => (
                <button
                  key={t.tenantId}
                  onClick={() => { setTenantId(t.tenantId); setLabel(t.name); }}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:border-[#3b82f6] hover:text-[#3b82f6] transition"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      {/* Lista */}
      {accounts.length === 0 ? (
        <p className="text-sm text-gray-400">No hay cuentas internas configuradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Etiqueta</th>
                <th className="text-left px-4 py-3 font-semibold">Tenant ID</th>
                <th className="text-left px-4 py-3 font-semibold">SaaS</th>
                <th className="text-left px-4 py-3 font-semibold">Añadida</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {accounts.map((acc) => (
                <tr key={acc.tenantId + acc.saasSlug} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{acc.label || tenantMap[acc.tenantId] || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[160px] truncate">{acc.tenantId}</td>
                  <td className="px-4 py-3"><Pill color="purple">{acc.saasSlug}</Pill></td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(acc.addedAt).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onRemove(acc.tenantId).then(() => setSuccess(`✅ Eliminada: ${acc.tenantId}`)).catch((err) => setError(err?.message ?? "Error"))}
                      disabled={removing === acc.tenantId}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                    >
                      {removing === acc.tenantId ? "…" : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = ["Finanzas", "Clientes", "Inteligencia IA", "Cuentas Internas"] as const;
type Tab = (typeof TABS)[number];

export default function SocialflowOperatorDashboard() {
  const [tab, setTab] = useState<Tab>("Finanzas");
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
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddInternal(tenantId: string, label: string) {
    const res = await fetch("/api/operator/internal-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, saasSlug: "socialflow", label }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(data.error ?? "Error al añadir");
    await load();
  }

  async function handleRemoveInternal(tenantId: string) {
    const res = await fetch("/api/operator/internal-accounts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, saasSlug: "socialflow" }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(data.error ?? "Error al eliminar");
    await load();
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center shadow shadow-blue-200">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Socialcors</h2>
            <p className="text-xs text-gray-400">Panel de control · Revenue · IA · Clientes</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      {/* Overview Hero — siempre visible */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Cargando datos…
        </div>
      ) : (
        <OverviewHero
          revenue={revenue}
          tenants={tenants}
          aiEntries={aiEntries}
          agentSummary={agentSummary}
          internalAccounts={internalAccounts}
        />
      )}

      {/* Tabs con detalle */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-6 overflow-x-auto">
          <nav className="flex gap-6">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={tab === t ? TAB_ACTIVE : TAB_INACTIVE}>
                {t}
                {t === "Cuentas Internas" && internalAccounts.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#3b82f6] px-1.5 py-0.5 text-[10px] font-black text-white">
                    {internalAccounts.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6">
          {tab === "Finanzas" ? (
            <FinanzasSection revenue={revenue} aiEntries={aiEntries} />
          ) : tab === "Clientes" ? (
            <ClientesSection tenants={tenants} aiEntries={aiEntries} internalAccounts={internalAccounts} />
          ) : tab === "Inteligencia IA" ? (
            <IASection entries={aiEntries} />
          ) : (
            <CuentasInternasSection
              accounts={internalAccounts}
              tenants={tenants}
              onAdd={handleAddInternal}
              onRemove={handleRemoveInternal}
            />
          )}
        </div>
      </div>
    </div>
  );
}
