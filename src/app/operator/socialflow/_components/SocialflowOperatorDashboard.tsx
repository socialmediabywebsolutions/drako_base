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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euros(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

// Coste estimado en € de tokens (Mistral Small 3.1 24B aprox: $0.10/1M in, $0.30/1M out)
function estimateCostEur(tokensIn: number, tokensOut: number) {
  const costUsd = (tokensIn / 1_000_000) * 0.1 + (tokensOut / 1_000_000) * 0.3;
  return costUsd * 0.93; // USD→EUR aprox
}

// ─── Tab styles ───────────────────────────────────────────────────────────────

const TAB_ACTIVE =
  "border-b-2 border-[#3b82f6] text-[#3b82f6] font-semibold pb-2 px-1 text-sm whitespace-nowrap";
const TAB_INACTIVE =
  "border-b-2 border-transparent text-gray-500 hover:text-gray-700 pb-2 px-1 text-sm whitespace-nowrap transition";

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "blue" }: { label: string; value: string; sub?: string; color?: "blue" | "green" | "red" | "gray" }) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-emerald-50 border-emerald-100",
    red: "bg-red-50 border-red-100",
    gray: "bg-gray-50 border-gray-100",
  };
  const textMap = {
    blue: "text-[#3b82f6]",
    green: "text-emerald-600",
    red: "text-red-600",
    gray: "text-gray-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-black ${textMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section: Finanzas ───────────────────────────────────────────────────────

function FinanzasSection({ data }: { data: RevenueData | null }) {
  if (!data) return <p className="text-sm text-gray-400">Cargando datos financieros…</p>;

  const sf = data.breakdown["socialflow"] ?? null;
  const mrr = sf?.mrr_cents ?? data.global_mrr_cents;
  const active = sf?.active_tenants ?? data.global_active_tenants;
  const churn = sf?.churn_rate ?? data.global_churn_rate;
  const pastDue = sf?.past_due_count ?? 0;

  const statusBreakdown = sf?.status_breakdown ?? {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="MRR" value={euros(mrr)} color="blue" />
        <StatCard label="Clientes activos" value={String(active)} color="green" />
        <StatCard label="Churn rate" value={pct(churn)} color={churn > 0.1 ? "red" : "gray"} />
        <StatCard label="Pagos pendientes" value={String(pastDue)} color={pastDue > 0 ? "red" : "gray"} />
      </div>

      {Object.keys(statusBreakdown).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Desglose por estado</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <span
                key={status}
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold border",
                  status === "active" || status === "trialing" || status === "trial"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : status === "canceled"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : status === "past_due"
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-gray-100 text-gray-600 border-gray-200",
                ].join(" ")}
              >
                {status}: <strong>{count as number}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Clientes ────────────────────────────────────────────────────────

function ClientesSection({
  tenants,
  aiEntries,
  internalAccounts,
}: {
  tenants: Tenant[];
  aiEntries: AiEntry[];
  internalAccounts: InternalAccount[];
}) {
  const internalSet = new Set(internalAccounts.map((a) => a.tenantId));

  const costByTenant: Record<string, number> = {};
  for (const e of aiEntries) {
    if (e.saasId !== "socialflow") continue;
    costByTenant[e.tenantId] = (costByTenant[e.tenantId] ?? 0) + estimateCostEur(e.tokensIn, e.tokensOut);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">{tenants.length} cuenta{tenants.length !== 1 ? "s" : ""} registrada{tenants.length !== 1 ? "s" : ""}</span>
      </div>

      {tenants.length === 0 ? (
        <p className="text-sm text-gray-400">Sin clientes registrados aún.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold">Nicho</th>
                <th className="text-left px-4 py-3 font-semibold">Plan</th>
                <th className="text-right px-4 py-3 font-semibold">Coste IA (mes)</th>
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {tenants.map((t) => {
                const cost = costByTenant[t.tenantId] ?? 0;
                const isInternal = internalSet.has(t.tenantId);
                return (
                  <tr key={t.tenantId} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{t.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{t.niche ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={[
                        "rounded-full px-2.5 py-1 text-xs font-bold",
                        t.plan?.includes("pro") ? "bg-blue-100 text-blue-700" :
                        t.plan?.includes("basico") ? "bg-cyan-100 text-cyan-700" :
                        t.plan?.includes("starter") ? "bg-gray-100 text-gray-600" :
                        "bg-yellow-50 text-yellow-700",
                      ].join(" ")}>
                        {t.plan ?? "free"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                      {cost > 0 ? `${cost.toFixed(3)} €` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isInternal ? (
                        <span className="rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold">Interno</span>
                      ) : (
                        <span className="text-xs text-gray-400">Cliente</span>
                      )}
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

// ─── Section: IA ─────────────────────────────────────────────────────────────

function IASection({ entries }: { entries: AiEntry[] }) {
  const sfEntries = entries.filter((e) => e.saasId === "socialflow");

  // Agrupar por modelo
  const byModel: Record<string, { tokensIn: number; tokensOut: number; requests: number }> = {};
  for (const e of sfEntries) {
    const m = e.model || "unknown";
    if (!byModel[m]) byModel[m] = { tokensIn: 0, tokensOut: 0, requests: 0 };
    byModel[m].tokensIn += e.tokensIn;
    byModel[m].tokensOut += e.tokensOut;
    byModel[m].requests += e.requestsCount;
  }

  const totalIn = sfEntries.reduce((s, e) => s + e.tokensIn, 0);
  const totalOut = sfEntries.reduce((s, e) => s + e.tokensOut, 0);
  const totalReqs = sfEntries.reduce((s, e) => s + e.requestsCount, 0);
  const totalCost = estimateCostEur(totalIn, totalOut);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tokens entrada" value={(totalIn / 1000).toFixed(1) + "k"} color="blue" />
        <StatCard label="Tokens salida" value={(totalOut / 1000).toFixed(1) + "k"} color="blue" />
        <StatCard label="Peticiones IA" value={totalReqs.toLocaleString("es-ES")} color="gray" />
        <StatCard label="Coste estimado" value={`${totalCost.toFixed(2)} €`} color={totalCost > 50 ? "red" : "green"} sub="Histórico total" />
      </div>

      {Object.keys(byModel).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Modelos utilizados</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Modelo</th>
                  <th className="text-right px-4 py-3 font-semibold">Tokens entrada</th>
                  <th className="text-right px-4 py-3 font-semibold">Tokens salida</th>
                  <th className="text-right px-4 py-3 font-semibold">Peticiones</th>
                  <th className="text-right px-4 py-3 font-semibold">Coste est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {Object.entries(byModel).map(([model, stats]) => (
                  <tr key={model} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-[200px] truncate">{model}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">{(stats.tokensIn / 1000).toFixed(1)}k</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">{(stats.tokensOut / 1000).toFixed(1)}k</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">{stats.requests.toLocaleString("es-ES")}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{estimateCostEur(stats.tokensIn, stats.tokensOut).toFixed(3)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Cuentas Internas ───────────────────────────────────────────────

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!tenantId.trim()) { setError("Introduce un Tenant ID"); return; }
    setAdding(true);
    try {
      await onAdd(tenantId.trim(), label.trim());
      setSuccess(`✅ Cuenta añadida: ${tenantId.trim()}`);
      setTenantId("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(tid: string) {
    setError(null);
    setSuccess(null);
    setRemoving(tid);
    try {
      await onRemove(tid);
      setSuccess(`✅ Cuenta eliminada: ${tid}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>¿Qué son las cuentas internas?</strong> Las cuentas en esta lista reciben automáticamente el plan Pro más alto sin necesitar suscripción Stripe. Úsalas para tus propias empresas y cuentas de demostración.
      </div>

      {/* Añadir cuenta */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Añadir cuenta interna</p>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">Tenant ID *</label>
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="ej. abc123def456"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
              disabled={adding}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 mb-1 block">Etiqueta (opcional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ej. Mi empresa principal"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
              disabled={adding}
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-5 py-2.5 text-sm font-bold text-white shadow shadow-blue-200 hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? "Añadiendo…" : "Añadir"}
          </button>
        </form>

        {/* Selector rápido desde clientes existentes */}
        {tenants.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-1.5">O elige un cliente existente:</p>
            <div className="flex flex-wrap gap-2">
              {tenants.slice(0, 12).map((t) => (
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
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {acc.label || tenantMap[acc.tenantId] || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[160px] truncate">{acc.tenantId}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold">
                      {acc.saasSlug}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(acc.addedAt).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(acc.tenantId)}
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const TABS = ["Finanzas", "Clientes", "Inteligencia IA", "Cuentas Internas"] as const;
type Tab = (typeof TABS)[number];

export default function SocialflowOperatorDashboard() {
  const [tab, setTab] = useState<Tab>("Finanzas");
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [aiEntries, setAiEntries] = useState<AiEntry[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [internalAccounts, setInternalAccounts] = useState<InternalAccount[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rev, ai, tenantsRes, intRes] = await Promise.all([
        fetch("/api/operator/revenue").then((r) => r.json() as Promise<{ ok: boolean; data: RevenueData }>),
        fetch("/api/operator/ai-costs?saasId=socialflow").then((r) => r.json() as Promise<{ ok: boolean; entries: AiEntry[] }>),
        fetch("/api/operator/socialflow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "list_tenants" }),
        }).then((r) => r.json() as Promise<{ action: string; result: { tenants: Tenant[] } }>),
        fetch("/api/operator/internal-accounts?saasSlug=socialflow").then((r) => r.json() as Promise<{ ok: boolean; accounts: InternalAccount[] }>),
      ]);

      if (rev.ok) setRevenue(rev.data);
      if (ai.ok) setAiEntries(ai.entries ?? []);
      if (tenantsRes.action === "list_tenants") setTenants(tenantsRes.result?.tenants ?? []);
      if (intRes.ok) setInternalAccounts(intRes.accounts ?? []);
    } catch {
      // silently ignore — partial data is fine
    } finally {
      setLoading(false);
    }
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
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center shadow shadow-blue-200">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">Panel Socialcors</h2>
            <p className="text-xs text-gray-500">Finanzas · Clientes · IA · Cuentas internas</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {loading ? "Cargando…" : "↻ Actualizar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 px-6 overflow-x-auto">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? TAB_ACTIVE : TAB_INACTIVE}
            >
              {t}
              {t === "Cuentas Internas" && internalAccounts.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#3b82f6] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {internalAccounts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && tab !== "Cuentas Internas" ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Cargando…
          </div>
        ) : tab === "Finanzas" ? (
          <FinanzasSection data={revenue} />
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
  );
}
