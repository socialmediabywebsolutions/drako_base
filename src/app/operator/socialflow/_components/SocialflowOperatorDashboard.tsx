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
type AiEntry = { tenantId: string; saasId: string; model: string; month: string; tokensIn: number; tokensOut: number; requestsCount: number };
type Tenant = { tenantId: string; saasId: string; name: string; niche: string | null; plan: string | null };
type InternalAccount = { tenantId: string; saasSlug: string; label: string | null; addedAt: string };
type AgentRunSummary = { totalRuns: number; successRuns: number; failedRuns: number; successRate: number; totalPosts: number; latestRunAt: string | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number, dec = 0) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtC = (c: number, dec = 0) => fmt(c / 100, dec);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const estimateCostEur = (i: number, o: number) => ((i / 1e6) * 0.1 + (o / 1e6) * 0.3) * 0.93;

// Spain quarterly deadlines
function fiscalQuarter(now: Date) {
  const m = now.getMonth() + 1;
  if (m <= 3) return { q: 1, label: "T1 (Ene–Mar)", deadlineLabel: "20 abr", months: [0, 1, 2] };
  if (m <= 6) return { q: 2, label: "T2 (Abr–Jun)", deadlineLabel: "20 jul", months: [3, 4, 5] };
  if (m <= 9) return { q: 3, label: "T3 (Jul–Sep)", deadlineLabel: "20 oct", months: [6, 7, 8] };
  return { q: 4, label: "T4 (Oct–Dic)", deadlineLabel: "20 ene", months: [9, 10, 11] };
}
function daysUntilDeadline(now: Date, deadlineLabel: string) {
  const [, mon] = deadlineLabel.replace("20 ", "").split(" ");
  const monMap: Record<string, number> = { ene: 0, abr: 3, jul: 6, oct: 9 };
  const year = now.getFullYear() + (monMap[mon] < now.getMonth() ? 1 : 0);
  const target = new Date(year, monMap[mon], 20);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, danger, dim,
}: { label: string; value: string; sub?: string; accent?: boolean; danger?: boolean; dim?: boolean }) {
  return (
    <div className={[
      "rounded-2xl border p-5 flex flex-col gap-1",
      accent ? "border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50" :
      danger ? "border-red-200 bg-red-50" :
      dim   ? "border-gray-100 bg-gray-50" :
              "border-gray-100 bg-white",
    ].join(" ")}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={[
        "text-2xl font-black tracking-tight leading-none mt-1",
        accent ? "text-[#3b82f6]" : danger ? "text-red-600" : dim ? "text-gray-400" : "text-gray-900",
      ].join(" ")}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({ p, color = "blue" }: { p: number; color?: "blue" | "orange" | "green" | "red" }) {
  const g = { blue: "from-[#3b82f6] to-[#06b6d4]", orange: "from-orange-400 to-amber-300", green: "from-emerald-400 to-teal-400", red: "from-red-400 to-rose-400" }[color];
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${g}`} style={{ width: `${Math.min(100, Math.max(0, p))}%` }} />
    </div>
  );
}

function Pill({ c = "gray", children }: { c?: "blue" | "green" | "red" | "orange" | "gray" | "purple" | "cyan" | "amber"; children: React.ReactNode }) {
  const cls = { blue: "bg-blue-100 text-blue-700", green: "bg-emerald-100 text-emerald-700", red: "bg-red-100 text-red-700", orange: "bg-orange-100 text-orange-700", gray: "bg-gray-100 text-gray-500", purple: "bg-purple-100 text-purple-700", cyan: "bg-cyan-100 text-cyan-700", amber: "bg-amber-100 text-amber-700" }[c];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

function PlanPill({ plan, isInternal }: { plan: string | null; isInternal?: boolean }) {
  if (isInternal) return <Pill c="purple">Pro interno</Pill>;
  if (!plan || plan === "free") return <Pill c="gray">free</Pill>;
  if (plan.includes("agencia")) return <Pill c="purple">agencia</Pill>;
  if (plan.includes("pro")) return <Pill c="blue">{plan}</Pill>;
  if (plan.includes("basico")) return <Pill c="green">{plan}</Pill>;
  if (plan.includes("starter")) return <Pill c="cyan">{plan}</Pill>;
  return <Pill c="orange">{plan}</Pill>;
}

// Fila de P&L con línea separadora opcional
function PLRow({ label, value, sub, positive, negative, bold, separator, indent }: {
  label: string; value: string; sub?: string;
  positive?: boolean; negative?: boolean; bold?: boolean; separator?: boolean; indent?: boolean;
}) {
  if (separator) return <div className="h-px bg-gray-100 my-2" />;
  return (
    <div className={`flex items-baseline justify-between py-2 ${indent ? "pl-4" : ""}`}>
      <div>
        <span className={`text-sm ${bold ? "font-bold text-gray-900" : "text-gray-600"}`}>{label}</span>
        {sub && <span className="ml-2 text-[11px] text-gray-400">{sub}</span>}
      </div>
      <span className={[
        "text-sm font-black tabular-nums",
        bold ? "text-base" : "",
        positive ? "text-emerald-600" : negative ? "text-red-600" : bold ? "text-gray-900" : "text-gray-700",
      ].join(" ")}>{value}</span>
    </div>
  );
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

function AlertBanner({ type, children }: { type: "warning" | "danger"; children: React.ReactNode }) {
  const s = type === "danger"
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-orange-200 bg-orange-50 text-orange-800";
  const icon = type === "danger" ? "⚠️" : "🗓️";
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s}`}>
      <span className="shrink-0">{icon}</span>
      <p className="text-sm font-semibold">{children}</p>
    </div>
  );
}

// ─── Section: Global ─────────────────────────────────────────────────────────

const ALL_SAAS = [
  { id: "socialflow", label: "Socialcors", icon: "📱", live: true },
  { id: "mentoria",   label: "Mentoría",   icon: "🎓", live: false },
  { id: "cryptoia",   label: "Crypto IA",  icon: "₿",  live: false },
  { id: "cazh",       label: "Cazh",       icon: "💳", live: false },
  { id: "rentia",     label: "Rentia",     icon: "🏠", live: false },
];

function GlobalSection({ revenue, aiEntries, internalAccounts }: {
  revenue: RevenueData | null; aiEntries: AiEntry[]; internalAccounts: InternalAccount[];
}) {
  const now = new Date();
  const q = fiscalQuarter(now);
  const daysLeft = daysUntilDeadline(now, q.deadlineLabel);
  const urgent = daysLeft <= 20;
  const pastDueAll = Object.values(revenue?.breakdown ?? {}).reduce((s, b) => s + (b.past_due_count ?? 0), 0);
  const globalMrr = revenue?.global_mrr_cents ?? 0;
  const globalClients = revenue?.global_active_tenants ?? 0;
  const totalAiCost = aiEntries.reduce((s, e) => s + estimateCostEur(e.tokensIn, e.tokensOut), 0);

  const qRevenue = (globalMrr / 100) * 3;
  const ivaNet = qRevenue * 0.21 - (totalAiCost * 3 + 60) * 0.21;

  return (
    <div className="space-y-8">
      {/* Alertas */}
      {(pastDueAll > 0 || urgent) && (
        <div className="space-y-2">
          {urgent && (
            <AlertBanner type="warning">
              Declaración {q.label} vence el <strong>{q.deadlineLabel}</strong> — quedan <strong>{daysLeft} días</strong>.
              {" "}IVA a ingresar estimado: <strong>{fmt(ivaNet, 2)}</strong>
            </AlertBanner>
          )}
          {pastDueAll > 0 && (
            <AlertBanner type="danger">
              {pastDueAll} pago{pastDueAll > 1 ? "s" : ""} atrasado{pastDueAll > 1 ? "s" : ""} en Stripe — riesgo de churn
            </AlertBanner>
          )}
        </div>
      )}

      {/* KPIs globales */}
      <div>
        <SectionLabel>Holding — todos los SaaS</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="MRR total"       value={fmtC(globalMrr)}                                   sub="Ingresos recurrentes mes" accent />
          <KpiCard label="Diario"          value={`${(globalMrr / 100 / 30).toFixed(1)} €`}          sub="Promedio por día" />
          <KpiCard label="ARR proyectado"  value={`${((globalMrr / 100) * 12 / 1000).toFixed(1)}k €`} sub="Sin cambios" />
          <KpiCard label="Clientes totales" value={String(globalClients)}                             sub="En todos los SaaS activos" />
        </div>
      </div>

      {/* Portfolio */}
      <div>
        <SectionLabel>Portfolio de productos</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {ALL_SAAS.map((saas) => {
            const data = revenue?.breakdown[saas.id];
            const saasAiCost = aiEntries.filter((e) => e.saasId === saas.id)
              .reduce((s, e) => s + estimateCostEur(e.tokensIn, e.tokensOut), 0);
            return (
              <div key={saas.id} className={[
                "rounded-2xl border p-4 transition-all",
                saas.live ? "border-gray-100 bg-white hover:border-blue-200" : "border-dashed border-gray-200 bg-gray-50",
              ].join(" ")}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{saas.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800 leading-none">{saas.label}</p>
                    {saas.live
                      ? <span className="text-[10px] text-emerald-600 font-semibold">● Live</span>
                      : <span className="text-[10px] text-gray-400">En desarrollo</span>}
                  </div>
                </div>
                {saas.live && data ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-gray-400">MRR</span><span className="font-black text-[#3b82f6]">{fmtC(data.mrr_cents)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Clientes</span><span className="font-semibold text-gray-800">{data.active_tenants}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Coste IA</span><span className="font-semibold text-gray-600">{saasAiCost.toFixed(2)} €</span></div>
                    {data.past_due_count > 0 && (
                      <div className="mt-2 rounded-lg bg-red-50 border border-red-100 px-2 py-1 text-[10px] font-bold text-red-600">
                        ⚠️ {data.past_due_count} past_due
                      </div>
                    )}
                  </div>
                ) : saas.live ? (
                  <p className="text-xs text-gray-400">Sin datos</p>
                ) : (
                  <p className="text-xs text-gray-300 mt-2">Disponible al lanzar</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Socialcors ──────────────────────────────────────────────────────

function SocialcorsSection({ revenue, tenants, aiEntries, internalAccounts, agentSummary, onAddInternal, onRemoveInternal }: {
  revenue: RevenueData | null; tenants: Tenant[]; aiEntries: AiEntry[];
  internalAccounts: InternalAccount[]; agentSummary: AgentRunSummary | null;
  onAddInternal: (id: string, label: string) => Promise<void>;
  onRemoveInternal: (id: string) => Promise<void>;
}) {
  const [view, setView] = useState<"clientes" | "ia" | "internas">("clientes");
  const sf = revenue?.breakdown["socialflow"];
  const mrr = sf?.mrr_cents ?? 0;
  const active = sf?.active_tenants ?? 0;
  const churn = sf?.churn_rate ?? 0;
  const arpu = active > 0 ? mrr / 100 / active : 0;
  const sfAiCost = aiEntries.filter((e) => e.saasId === "socialflow")
    .reduce((s, e) => s + estimateCostEur(e.tokensIn, e.tokensOut), 0);
  const net = mrr / 100 - sfAiCost - 20;
  const internalSet = new Set(internalAccounts.map((a) => a.tenantId));

  const VIEWS = [
    { id: "clientes" as const, label: "Clientes",         icon: "👥" },
    { id: "ia"       as const, label: "Inteligencia IA",  icon: "🤖" },
    { id: "internas" as const, label: "Cuentas Internas", icon: "🔑" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="MRR"            value={fmtC(mrr)}              sub="Socialcors"           accent />
        <KpiCard label="Clientes activos" value={String(active)}       sub={`${internalAccounts.length} internos`} />
        <KpiCard label="ARPU"           value={`${arpu.toFixed(0)} €`} sub="por cliente/mes" />
        <KpiCard label="Margen neto"    value={`${net.toFixed(0)} €`}  sub="MRR − IA − hosting"
          accent={net > 0} danger={net < 0} />
      </div>

      {/* Agentes */}
      {agentSummary && agentSummary.totalRuns > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 flex items-center gap-4">
          <span className="text-2xl">🤖</span>
          <div className="flex-1 grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xl font-black text-gray-900">{agentSummary.totalRuns}</p><p className="text-[11px] text-gray-400">ejecuciones</p></div>
            <div><p className="text-xl font-black text-emerald-600">{pct(agentSummary.successRate)}</p><p className="text-[11px] text-gray-400">éxito</p></div>
            <div><p className="text-xl font-black text-gray-900">{agentSummary.totalPosts}</p><p className="text-[11px] text-gray-400">posts generados</p></div>
          </div>
          {churn > 0 && (
            <div className="hidden lg:block text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center shrink-0">
              <p className="font-bold">Churn {pct(churn)}</p>
              <p className="text-red-400">−{fmtC(mrr * churn)}/mes</p>
            </div>
          )}
        </div>
      )}

      {/* Sub-nav */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 w-fit">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => setView(v.id)} className={[
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition",
            view === v.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
          ].join(" ")}>
            <span>{v.icon}</span> {v.label}
            {v.id === "internas" && internalAccounts.length > 0 && (
              <span className="rounded-full bg-purple-100 text-purple-700 text-[10px] font-black px-1.5">{internalAccounts.length}</span>
            )}
          </button>
        ))}
      </div>

      {view === "clientes" && <ClientesView tenants={tenants} aiEntries={aiEntries} internalSet={internalSet} />}
      {view === "ia"       && <IAView entries={aiEntries} />}
      {view === "internas" && <InternasView accounts={internalAccounts} tenants={tenants} onAdd={onAddInternal} onRemove={onRemoveInternal} />}
    </div>
  );
}

// ─── Section: Financiero ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">{children}</p>;
}

function FinancieroSection({ revenue, aiEntries }: {
  revenue: RevenueData | null; aiEntries: AiEntry[];
}) {
  const now = new Date();
  const q = fiscalQuarter(now);
  const daysLeft = daysUntilDeadline(now, q.deadlineLabel);
  const urgent = daysLeft <= 20;

  const globalMrr = revenue?.global_mrr_cents ?? 0;
  const mrr = globalMrr / 100; // euros

  // Gastos mensuales
  const aiCostMes = aiEntries.reduce((s, e) => s + estimateCostEur(e.tokensIn, e.tokensOut), 0);
  const hostingMes = 20; // Cloudflare estimado
  const stripeFeeMes = mrr * 0.014 + (revenue?.global_active_tenants ?? 0) * 0.25; // 1.4% + 0.25€ aprox
  const gastosFijosMes = hostingMes;
  const gastosVariablesMes = aiCostMes + stripeFeeMes;
  const gastosTotal = gastosFijosMes + gastosVariablesMes;
  const beneficioBruto = mrr - gastosTotal;

  // Fiscal trimestral
  const qRevenue = mrr * 3;
  const qGastos = gastosTotal * 3;
  const ivaRepercutido = qRevenue * 0.21;
  const ivaSoportado = qGastos * 0.21;
  const ivaNet = ivaRepercutido - ivaSoportado;
  const qNet = qRevenue - qGastos;
  const irpfEst = Math.max(0, qNet * 0.20);

  // Anual proyectado
  const arrIngresos = mrr * 12;
  const arrGastos = gastosTotal * 12;
  const arrBeneficio = arrIngresos - arrGastos;

  const NEXT_DEADLINES = [
    { label: "T3 (Jul–Sep)", deadline: "20 oct", model: "IVA 303 + IRPF 130" },
    { label: "T4 (Oct–Dic)", deadline: "20 ene", model: "IVA 303 + IRPF 130" },
    { label: "Renta 2026",   deadline: "Jun 2027", model: "IRPF anual / IS 200" },
  ];

  return (
    <div className="space-y-8">

      {urgent && (
        <AlertBanner type="warning">
          Declaración {q.label} vence el <strong>{q.deadlineLabel}</strong> — {daysLeft} días. IVA a ingresar: <strong>{fmt(ivaNet, 2)}</strong>
        </AlertBanner>
      )}

      {/* ── Cuenta de resultados mensual ─────────────────────────────── */}
      <div>
        <SectionLabel>Cuenta de resultados · mes actual</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* P&L */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">📊</span>
              <p className="text-sm font-bold text-gray-800">Ingresos y gastos</p>
            </div>
            <div>
              <PLRow label="Ingresos (MRR)" value={`+ ${fmt(mrr, 2)}`} positive bold />
              <PLRow separator />
              <PLRow label="Gastos fijos" value="" bold />
              <PLRow label="Hosting (Cloudflare)" value={`− ${fmt(hostingMes, 2)}`} negative indent sub="Workers + D1 + R2" />
              <PLRow label="Gastos variables" value="" bold />
              <PLRow label="Coste IA" value={`− ${fmt(aiCostMes, 3)}`} negative indent sub="Workers AI estimado" />
              <PLRow label="Comisiones Stripe" value={`− ${fmt(stripeFeeMes, 2)}`} negative indent sub="1.4% + 0.25€/tx aprox." />
              <PLRow separator />
              <PLRow label="Total gastos" value={`− ${fmt(gastosTotal, 2)}`} negative bold />
              <PLRow separator />
              <PLRow label="Beneficio bruto" value={fmt(beneficioBruto, 2)} positive={beneficioBruto > 0} negative={beneficioBruto < 0} bold />
            </div>
          </div>

          {/* Métricas clave */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-sm font-bold text-gray-800 mb-4">Ratios de rentabilidad</p>
              <div className="space-y-4">
                {[
                  { label: "Margen bruto", value: mrr > 0 ? (beneficioBruto / mrr) * 100 : 0, ideal: 80 },
                  { label: "Gastos IA / MRR", value: mrr > 0 ? (aiCostMes / mrr) * 100 : 0, ideal: 5, invertir: true },
                  { label: "Gastos totales / MRR", value: mrr > 0 ? (gastosTotal / mrr) * 100 : 0, ideal: 20, invertir: true },
                ].map(({ label, value, ideal, invertir }) => {
                  const ok = invertir ? value <= ideal : value >= ideal;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-600">{label}</span>
                        <span className={`font-bold ${ok ? "text-emerald-600" : value === 0 ? "text-gray-400" : "text-red-500"}`}>
                          {value.toFixed(1)}%
                        </span>
                      </div>
                      <Bar p={invertir ? Math.min(100, value * 5) : value} color={ok ? "green" : "red"} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Proyección anual */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-sm font-bold text-gray-800 mb-3">Proyección anual (sin cambios)</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Ingresos (ARR)</span><span className="font-bold text-gray-900">{fmt(arrIngresos)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Gastos totales</span><span className="font-semibold text-red-500">− {fmt(arrGastos)}</span></div>
                <div className="h-px bg-gray-100 my-2" />
                <div className="flex justify-between text-sm"><span className="font-bold text-gray-800">Beneficio neto anual</span><span className={`font-black text-lg ${arrBeneficio > 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(arrBeneficio)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fiscal trimestral ─────────────────────────────────────────── */}
      <div>
        <SectionLabel>Fiscal · {q.label}</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* IVA */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">🧾</span>
              <div>
                <p className="text-sm font-bold text-gray-800">IVA trimestral</p>
                <p className="text-[11px] text-gray-400">Modelo 303</p>
              </div>
            </div>
            <div>
              <PLRow label="IVA repercutido" value={`+ ${fmt(ivaRepercutido, 2)}`} positive sub="21% s/ ingresos" />
              <PLRow label="IVA soportado"   value={`− ${fmt(ivaSoportado, 2)}`}   negative sub="21% s/ gastos" />
              <PLRow separator />
              <PLRow label="A ingresar (neto)" value={fmt(ivaNet, 2)} positive={ivaNet < 0} negative={ivaNet > 0} bold />
            </div>
            <p className="mt-3 text-[11px] text-gray-400 leading-tight">
              Basado en MRR × 3 meses. B2B intracomunitario = exento (ajustar manualmente).
            </p>
          </div>

          {/* IRPF / IS */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">🏛️</span>
              <div>
                <p className="text-sm font-bold text-gray-800">IRPF / IS</p>
                <p className="text-[11px] text-gray-400">Pago fraccionado</p>
              </div>
            </div>
            <div>
              <PLRow label="Ingresos trimestrales" value={fmt(qRevenue, 2)} />
              <PLRow label="Gastos deducibles"     value={`− ${fmt(qGastos, 2)}`} negative />
              <PLRow separator />
              <PLRow label="Base imponible"        value={fmt(qNet, 2)} positive={qNet > 0} negative={qNet < 0} bold />
              <PLRow label="Tasa fraccionada"       value="× 20%" dim />
              <PLRow separator />
              <PLRow label="Pago estimado" value={fmt(irpfEst, 2)} negative={irpfEst > 0} bold />
            </div>
            <p className="mt-3 text-[11px] text-gray-400 leading-tight">
              Mod. 130 (autónomo) o 202 (SL). Valida con tu gestor — es una estimación.
            </p>
          </div>

          {/* Calendario fiscal */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">📆</span>
              <div>
                <p className="text-sm font-bold text-gray-800">Calendario fiscal</p>
                <p className="text-[11px] text-gray-400">Próximas obligaciones</p>
              </div>
            </div>
            <div className="space-y-2">
              {NEXT_DEADLINES.map((item) => {
                const isCurrent = item.label === q.label;
                return (
                  <div key={item.label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isCurrent ? "bg-orange-50 border border-orange-100" : "bg-gray-50"}`}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${isCurrent ? "bg-orange-400 animate-pulse" : "bg-gray-300"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                      <p className="text-[11px] text-gray-400">{item.model}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${isCurrent ? "text-orange-600" : "text-gray-400"}`}>
                      {item.deadline}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-gray-400">Zona horaria España. Siempre valida con tu gestor.</p>
          </div>
        </div>
      </div>

      {/* ── Desglose de gastos fijos ──────────────────────────────────── */}
      <div>
        <SectionLabel>Gastos fijos mensuales</SectionLabel>
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-widest text-gray-400">
              <tr>
                <th className="text-left px-5 py-3">Concepto</th>
                <th className="text-left px-5 py-3">Tipo</th>
                <th className="text-right px-5 py-3">Importe / mes</th>
                <th className="text-right px-5 py-3">IVA incluido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {[
                { concepto: "Cloudflare Workers + D1 + R2",    tipo: "Hosting",    importe: 20.00 },
                { concepto: "Workers AI (estimado)",            tipo: "IA",         importe: aiCostMes },
                { concepto: "Comisiones Stripe (estimado)",     tipo: "Pagos",      importe: stripeFeeMes },
                { concepto: "Resend (emails)",                  tipo: "Comunicación", importe: 0 },
              ].map((row) => (
                <tr key={row.concepto} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 font-medium text-gray-800">{row.concepto}</td>
                  <td className="px-5 py-3"><Pill c="gray">{row.tipo}</Pill></td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900 tabular-nums">
                    {row.importe === 0 ? <span className="text-gray-300">—</span> : `${fmt(row.importe, 3)}`}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500 tabular-nums">
                    {row.importe === 0 ? <span className="text-gray-300">—</span> : fmt(row.importe * 1.21, 3)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-5 py-3 font-bold text-gray-800">Total gastos</td>
                <td className="px-5 py-3 text-right font-black text-red-600 tabular-nums">{fmt(gastosTotal, 2)}</td>
                <td className="px-5 py-3 text-right font-bold text-gray-600 tabular-nums">{fmt(gastosTotal * 1.21, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Views: Clientes / IA / Internas ─────────────────────────────────────────

function ClientesView({ tenants, aiEntries, internalSet }: {
  tenants: Tenant[]; aiEntries: AiEntry[]; internalSet: Set<string>;
}) {
  const [q, setQ] = useState("");
  const costByTenant: Record<string, number> = {};
  for (const e of aiEntries) {
    if (e.saasId !== "socialflow") continue;
    costByTenant[e.tenantId] = (costByTenant[e.tenantId] ?? 0) + estimateCostEur(e.tokensIn, e.tokensOut);
  }
  const filtered = tenants.filter((t) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return t.name.toLowerCase().includes(s) || t.tenantId.toLowerCase().includes(s);
  });
  const topAi = [...tenants].sort((a, b) => (costByTenant[b.tenantId] ?? 0) - (costByTenant[a.tenantId] ?? 0)).slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{tenants.length}</p>
          <p className="text-xs text-gray-400">Total cuentas</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-center">
          <p className="text-2xl font-black text-blue-600">{tenants.filter((t) => !internalSet.has(t.tenantId)).length}</p>
          <p className="text-xs text-blue-500">De pago</p>
        </div>
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 text-center">
          <p className="text-2xl font-black text-purple-600">{internalSet.size}</p>
          <p className="text-xs text-purple-500">Internas</p>
        </div>
      </div>

      {topAi.some((t) => (costByTenant[t.tenantId] ?? 0) > 0) && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-2">🔥 Mayor consumo IA</p>
          <div className="flex flex-wrap gap-2">
            {topAi.filter((t) => (costByTenant[t.tenantId] ?? 0) > 0).map((t, i) => (
              <div key={t.tenantId} className="flex items-center gap-1.5 rounded-xl bg-white border border-amber-100 px-3 py-1.5 text-xs">
                <span className="font-black text-amber-500">#{i + 1}</span>
                <span className="font-semibold text-gray-800">{t.name}</span>
                <span className="text-amber-600">{(costByTenant[t.tenantId] ?? 0).toFixed(3)} €</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…"
          className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-widest text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-right px-4 py-3">Coste IA/mes</th>
              <th className="text-left px-4 py-3">Nicho</th>
              <th className="text-left px-4 py-3 hidden xl:table-cell">Tenant ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Sin resultados</td></tr>
            ) : filtered.map((t) => {
              const cost = costByTenant[t.tenantId] ?? 0;
              const isInt = internalSet.has(t.tenantId);
              return (
                <tr key={t.tenantId} className={`transition ${isInt ? "bg-purple-50/30" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-3 font-semibold text-gray-900 max-w-[200px] truncate">{isInt && <span className="mr-1">🔑</span>}{t.name}</td>
                  <td className="px-4 py-3"><PlanPill plan={t.plan} isInternal={isInt} /></td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{cost > 0 ? `${cost.toFixed(3)} €` : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[140px] truncate">{t.niche ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-300 hidden xl:table-cell max-w-[130px] truncate">{t.tenantId}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IAView({ entries }: { entries: AiEntry[] }) {
  const sf = entries.filter((e) => e.saasId === "socialflow");
  const totalIn = sf.reduce((s, e) => s + e.tokensIn, 0);
  const totalOut = sf.reduce((s, e) => s + e.tokensOut, 0);
  const totalReqs = sf.reduce((s, e) => s + e.requestsCount, 0);
  const totalCost = estimateCostEur(totalIn, totalOut);

  const byModel: Record<string, { i: number; o: number; r: number }> = {};
  const byMonth: Record<string, number> = {};
  for (const e of sf) {
    const m = e.model || "unknown";
    if (!byModel[m]) byModel[m] = { i: 0, o: 0, r: 0 };
    byModel[m].i += e.tokensIn; byModel[m].o += e.tokensOut; byModel[m].r += e.requestsCount;
    const mo = e.month || "—";
    byMonth[mo] = (byMonth[mo] ?? 0) + estimateCostEur(e.tokensIn, e.tokensOut);
  }
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  if (sf.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
        <p className="text-3xl mb-2">🤖</p>
        <p className="text-sm font-semibold text-gray-500">Sin datos de IA todavía</p>
        <p className="text-xs text-gray-400 mt-1">Aparecerán cuando los agentes empiecen a ejecutarse</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Tokens entrada" value={`${(totalIn / 1000).toFixed(1)}k`} />
        <KpiCard label="Tokens salida"  value={`${(totalOut / 1000).toFixed(1)}k`} />
        <KpiCard label="Peticiones"     value={totalReqs.toLocaleString("es-ES")} />
        <KpiCard label="Coste total"    value={`${totalCost.toFixed(3)} €`} accent={totalCost < 1} danger={totalCost > 50} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">Modelos</p>
          <div className="space-y-4">
            {Object.entries(byModel).map(([model, s]) => {
              const c = estimateCostEur(s.i, s.o);
              const share = totalCost > 0 ? (c / totalCost) * 100 : 0;
              return (
                <div key={model}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-mono text-gray-600 truncate max-w-[180px]">{model}</span>
                    <span className="text-gray-400 shrink-0 ml-2">{c.toFixed(4)} € · {share.toFixed(0)}%</span>
                  </div>
                  <Bar p={share} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">Coste por mes</p>
          <div className="space-y-3">
            {months.map(([month, cost]) => {
              const max = Math.max(...months.map((m) => m[1]), 0.001);
              return (
                <div key={month}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-gray-700">{month}</span>
                    <span className="text-gray-400">{cost.toFixed(4)} €</span>
                  </div>
                  <Bar p={(cost / max) * 100} color="orange" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        💡 Ratio óptimo: coste IA &lt; 5% del MRR. Si supera 15%, revisar prompts y frecuencia de agentes.
      </div>
    </div>
  );
}

function InternasView({ accounts, tenants, onAdd, onRemove }: {
  accounts: InternalAccount[]; tenants: Tenant[];
  onAdd: (id: string, label: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const accountSet = new Set(accounts.map((a) => a.tenantId));
  const available = tenants.filter((t) => !accountSet.has(t.tenantId));
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.tenantId, t.name]));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!tenantId.trim()) { setMsg({ ok: false, text: "Introduce un Tenant ID" }); return; }
    setAdding(true);
    try {
      await onAdd(tenantId.trim(), label.trim());
      setMsg({ ok: true, text: `✅ Añadida: ${label.trim() || tenantId.trim()}` });
      setTenantId(""); setLabel("");
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Error" }); }
    finally { setAdding(false); }
  }

  async function remove(id: string) {
    setRemoving(id);
    try { await onRemove(id); setMsg({ ok: true, text: "✅ Cuenta eliminada" }); }
    catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Error" }); }
    finally { setRemoving(null); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-5 flex gap-4">
        <div className="h-10 w-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center shrink-0">
          <span className="text-xl">🔑</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Cuentas internas = Plan Pro sin Stripe</p>
          <p className="text-sm text-gray-600 mt-0.5">Los tenants en esta lista reciben automáticamente el plan Pro más alto. Úsalo para tus propias empresas y cuentas demo.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-bold text-gray-700 mb-4">Añadir cuenta interna</p>
        <form onSubmit={submit} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Tenant ID *</label>
            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="abc123def456…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-mono focus:border-[#3b82f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3b82f6] transition"
              disabled={adding} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Etiqueta</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Mi empresa"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#3b82f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3b82f6] transition"
              disabled={adding} />
          </div>
          <button type="submit" disabled={adding || !tenantId.trim()}
            className="rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-6 py-2.5 text-sm font-black text-white shadow shadow-blue-200 hover:brightness-110 transition disabled:opacity-40">
            {adding ? "…" : "+ Añadir"}
          </button>
        </form>
        {available.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">Seleccionar desde clientes existentes:</p>
            <div className="flex flex-wrap gap-2">
              {available.slice(0, 15).map((t) => (
                <button key={t.tenantId} onClick={() => { setTenantId(t.tenantId); setLabel(t.name); }}
                  className={["rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                    tenantId === t.tenantId ? "border-[#3b82f6] bg-blue-50 text-[#3b82f6]" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#3b82f6] hover:text-[#3b82f6]",
                  ].join(" ")}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {msg && <p className={`mt-3 text-sm font-semibold ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-3xl mb-2">🔑</p>
          <p className="text-sm font-semibold text-gray-500">Sin cuentas internas</p>
          <p className="text-xs text-gray-400 mt-1">Añade tu cuenta de empresa para que tenga plan Pro automático</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {accounts.length} cuenta{accounts.length > 1 ? "s" : ""} activa{accounts.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y divide-gray-50 bg-white">
            {accounts.map((acc) => (
              <div key={acc.tenantId} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition">
                <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 text-lg">🔑</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{acc.label || tenantMap[acc.tenantId] || "—"}</p>
                  <p className="text-xs font-mono text-gray-400 truncate">{acc.tenantId}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Pill c="purple">Pro · {acc.saasSlug}</Pill>
                  <span className="text-xs text-gray-400 hidden sm:block">{new Date(acc.addedAt).toLocaleDateString("es-ES")}</span>
                  <button onClick={() => remove(acc.tenantId)} disabled={removing === acc.tenantId}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition disabled:opacity-50">
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

const NAV = [
  { id: "global"      as const, label: "Global",      icon: "🏠", desc: "Holding completo" },
  { id: "socialcors"  as const, label: "Socialcors",  icon: "📱", desc: "Clientes y agentes" },
  { id: "financiero"  as const, label: "Financiero",  icon: "📊", desc: "P&L · IVA · IRPF" },
] as const;
type NavId = (typeof NAV)[number]["id"];

export default function OperatorMainDashboard() {
  const [nav, setNav] = useState<NavId>("global");
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
        fetch("/api/operator/ai-costs").then((r) => r.json() as Promise<{ ok: boolean; entries: AiEntry[] }>),
        fetch("/api/operator/socialflow", {
          method: "POST", headers: { "content-type": "application/json" },
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
    if (!data.ok) throw new Error(data.error ?? "Error");
    await load();
  }

  async function handleRemoveInternal(tenantId: string) {
    const res = await fetch("/api/operator/internal-accounts", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, saasSlug: "socialflow" }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(data.error ?? "Error");
    await load();
  }

  const globalMrr = revenue?.global_mrr_cents ?? 0;
  const pastDueAll = Object.values(revenue?.breakdown ?? {}).reduce((s, b) => s + (b.past_due_count ?? 0), 0);
  const now = new Date();
  const q = fiscalQuarter(now);
  const daysLeft = daysUntilDeadline(now, q.deadlineLabel);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Header ── */}
      <div className="border-b border-gray-100 bg-white px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center shadow-sm shadow-blue-200 shrink-0">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 leading-none">Panel de control</h1>
              <p className="text-xs text-gray-400 mt-0.5">Drako Holding · {now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!loading && globalMrr > 0 && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">MRR</span>
                <span className="text-lg font-black text-[#3b82f6] leading-none">{fmtC(globalMrr)}</span>
              </div>
            )}
            {!loading && daysLeft <= 20 && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-600">
                🗓️ Fiscal en {daysLeft}d
              </div>
            )}
            {!loading && pastDueAll > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
                ⚠️ {pastDueAll} past_due
              </div>
            )}
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition disabled:opacity-50">
              <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? "…" : "Actualizar"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <div className="border-b border-gray-100 bg-white px-6">
        <div className="flex items-center gap-1">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setNav(n.id)}
              className={[
                "flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-semibold transition",
                nav === n.id
                  ? "border-[#3b82f6] text-[#3b82f6]"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
              <span className="hidden sm:inline text-[11px] text-gray-400 font-normal">· {n.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="h-8 w-8 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin" />
            <p className="text-sm text-gray-400">Cargando datos del holding…</p>
          </div>
        ) : nav === "global" ? (
          <GlobalSection revenue={revenue} aiEntries={aiEntries} internalAccounts={internalAccounts} />
        ) : nav === "socialcors" ? (
          <SocialcorsSection
            revenue={revenue} tenants={tenants} aiEntries={aiEntries}
            internalAccounts={internalAccounts} agentSummary={agentSummary}
            onAddInternal={handleAddInternal} onRemoveInternal={handleRemoveInternal}
          />
        ) : (
          <FinancieroSection revenue={revenue} aiEntries={aiEntries} />
        )}
      </div>
    </div>
  );
}
