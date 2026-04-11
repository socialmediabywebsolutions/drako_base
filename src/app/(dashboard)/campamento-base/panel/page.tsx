"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";

type RevenueSnapshot = {
  global?: { mrr: number; activeSaas: number; activeSubscriptions?: number };
  bySaas?: Array<{ saasId: string; saasName: string; mrr: number; activeSubscriptions?: number }>;
  history?: Array<{ day: string; mrr: number }>;
};

type AccountingSnapshot = {
  totalSaas: number;
  totalSubscriptionMRR: number;
  vendorFixedMonthly?: number;
  totalEstimatedMarginPercent?: number;
  rows: Array<{
    saasId: string;
    saasName: string;
    slug: string;
    subscriptionMonthlyAmount?: number;
    profitabilityMarginPercent?: number;
    planLabel?: string;
  }>;
};

type EventsSnapshot = {
  criticalEvents: Array<{
    type: string;
    severity: string;
    message: string;
    createdAt: string;
    correlationId: string;
    saasSlug?: string | null;
  }>;
  rollups: Array<{
    day: string;
    saasSlug?: string | null;
    type: string;
    severity: string;
    count: number;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
};

type SocialflowSummary = {
  total?: number;
  enabled?: number;
  disabled?: number;
  lastRunAt?: string | null;
};

type GovernanceSummary = {
  total?: number;
  critical?: number;
  warning?: number;
  ok?: number;
};

type GovernanceMap = Record<string, { severity: string }>;
type SocialflowMap = Record<string, { enabled?: boolean }>;

export default function CampamentoBasePanelPage() {
  const [revenue, setRevenue] = useState<RevenueSnapshot | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  const [accounting, setAccounting] = useState<AccountingSnapshot | null>(null);
  const [accountingLoading, setAccountingLoading] = useState(true);
  const [accountingError, setAccountingError] = useState<string | null>(null);

  const [events, setEvents] = useState<EventsSnapshot | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [socialflow, setSocialflow] = useState<SocialflowSummary | null>(null);
  const [socialflowLoading, setSocialflowLoading] = useState(true);
  const [socialflowError, setSocialflowError] = useState<string | null>(null);
  const [socialflowMap, setSocialflowMap] = useState<SocialflowMap>({});

  const [governance, setGovernance] = useState<GovernanceSummary | null>(null);
  const [governanceLoading, setGovernanceLoading] = useState(true);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const [governanceMap, setGovernanceMap] = useState<GovernanceMap>({});

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    setRevenueError(null);
    try {
      const res = await fetch("/api/operator/revenue", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      // Try to extract a daily MRR history if provided by the API (best-effort, optional)
      let history: Array<{ day: string; mrr: number }> = [];
      const trySeries = (arr: any[]) =>
        arr
          .map((e) => ({
            day: String(e.day ?? e.date ?? e.d ?? e.ts ?? "").slice(0, 10),
            mrr: Number(e.mrr ?? e.value ?? e.total ?? e.amount ?? 0),
          }))
          .filter((x) => x.day);
      if (Array.isArray((data as any)?.history)) history = trySeries((data as any).history);
      else if (Array.isArray((data as any)?.daily)) history = trySeries((data as any).daily);
      else if (Array.isArray((data as any)?.byDay)) history = trySeries((data as any).byDay);
      else if (Array.isArray((data as any)?.by_date)) history = trySeries((data as any).by_date);

      setRevenue({
        global: data?.global
          ? {
              mrr: Number(data.global.mrr ?? 0),
              activeSaas: Number(data.global.activeSaas ?? data.global.activeTenants ?? 0),
              activeSubscriptions: Number(data.global.activeSubscriptions ?? 0),
            }
          : undefined,
        bySaas: Array.isArray(data?.bySaas)
          ? data.bySaas.map((row: any) => ({
              saasId: row.saasId,
              saasName: row.saasName ?? row.saasId,
              mrr: Number(row.mrr ?? 0),
              activeSubscriptions: Number(row.activeSubscriptions ?? 0),
            }))
          : [],
        history: history.length ? history : undefined,
      });
    } catch (error) {
      setRevenue(null);
      setRevenueError(error instanceof Error ? error.message : "No se pudo cargar revenue.");
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const loadSocialflow = useCallback(async () => {
    setSocialflowLoading(true);
    setSocialflowError(null);
    try {
      const res = await fetch("/api/operator/socialflow", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      const s: SocialflowSummary = { total: undefined, enabled: undefined, disabled: undefined, lastRunAt: null };
      if (data?.summary && typeof data.summary === "object") {
        s.total = Number(data.summary.total ?? data.summary.totalSaas ?? data.summary.count ?? 0);
        s.enabled = Number(data.summary.enabled ?? 0);
        s.disabled = Number(
          data.summary.disabled ?? (
            typeof s.total === "number" && typeof s.enabled === "number" ? Math.max(0, s.total - s.enabled) : 0
          ),
        );
        s.lastRunAt = (data.summary.lastRunAt as string | undefined) ?? null;
      } 
      const map: SocialflowMap = {};
      if (Array.isArray(data?.status)) {
        const total = data.status.length;
        const enabled = data.status.filter((x: any) => Boolean(x?.enabled)).length;
        s.total = total;
        s.enabled = enabled;
        s.disabled = Math.max(0, total - enabled);
        s.lastRunAt = null;
        for (const x of data.status as any[]) {
          const id = x?.saasId ?? x?.saas_id ?? x?.id ?? x?.projectId ?? null;
          const slug = x?.slug ?? x?.saasSlug ?? null;
          if (id != null) map[String(id)] = { enabled: Boolean(x?.enabled) };
          if (slug != null) map[`slug:${String(slug)}`] = { enabled: Boolean(x?.enabled) };
        }
      }
      if (!Array.isArray(data?.status) && Array.isArray(data?.items)) {
        for (const x of data.items as any[]) {
          const id = x?.saasId ?? x?.saas_id ?? x?.id ?? x?.projectId ?? null;
          const slug = x?.slug ?? x?.saasSlug ?? null;
          if (id != null) map[String(id)] = { enabled: Boolean(x?.enabled) };
          if (slug != null) map[`slug:${String(slug)}`] = { enabled: Boolean(x?.enabled) };
        }
      }
      setSocialflow(s);
      setSocialflowMap(map);
    } catch (error) {
      setSocialflow(null);
      setSocialflowError(error instanceof Error ? error.message : "No se pudo cargar SocialFlow.");
      setSocialflowMap({});
    } finally {
      setSocialflowLoading(false);
    }
  }, []);

  const loadGovernance = useCallback(async () => {
    setGovernanceLoading(true);
    setGovernanceError(null);
    try {
      const res = await fetch("/api/operator/governance", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      const rows: any[] = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      let critical = 0,
        warning = 0,
        ok = 0;
      const gmap: GovernanceMap = {};
      for (const r of rows) {
        const sev = String(r?.severity ?? r?.healthSeverity ?? r?.status ?? "").toUpperCase();
        const norm = sev.includes("CRITICAL") ? "CRITICAL" : sev.includes("WARN") ? "WARNING" : sev.includes("OK") ? "OK" : sev || "UNKNOWN";
        if (sev.includes("CRITICAL")) critical++;
        else if (sev.includes("WARN")) warning++;
        else ok++;
        const id = r?.saasId ?? r?.saas_id ?? r?.id ?? r?.projectId ?? null;
        const slug = r?.slug ?? r?.saasSlug ?? null;
        if (id != null) gmap[String(id)] = { severity: norm };
        if (slug != null) gmap[`slug:${String(slug)}`] = { severity: norm };
      }
      setGovernance({ total: rows.length, critical, warning, ok });
      setGovernanceMap(gmap);
    } catch (error) {
      setGovernance(null);
      setGovernanceError(error instanceof Error ? error.message : "No se pudo cargar governance.");
      setGovernanceMap({});
    } finally {
      setGovernanceLoading(false);
    }
  }, []);

  const loadAccounting = useCallback(async () => {
    setAccountingLoading(true);
    setAccountingError(null);
    try {
      const res = await fetch("/api/operator/accounting", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { snapshot?: AccountingSnapshot } | null;
      setAccounting(data?.snapshot ?? null);
    } catch (error) {
      setAccounting(null);
      setAccountingError(error instanceof Error ? error.message : "No se pudo cargar accounting.");
    } finally {
      setAccountingLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await fetch("/api/operator/events", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      const criticalEvents = Array.isArray(data?.criticalEvents)
        ? data.criticalEvents.map((e: any) => ({
            type: String(e.type),
            severity: String(e.severity),
            message: String(e.message ?? ""),
            createdAt: String(e.created_at ?? e.createdAt ?? new Date().toISOString()),
            correlationId: String(e.correlation_id ?? e.correlationId ?? ""),
            saasSlug: e.saas_slug ?? e.saasSlug ?? null,
          }))
        : [];
      const rollups = Array.isArray(data?.rollups)
        ? data.rollups.map((r: any) => ({
            day: String(r.day),
            saasSlug: r.saas_slug ?? r.saasSlug ?? null,
            type: String(r.type),
            severity: String(r.severity),
            count: Number(r.count ?? 0),
            firstSeenAt: String(r.first_seen_at ?? r.firstSeenAt ?? ""),
            lastSeenAt: String(r.last_seen_at ?? r.lastSeenAt ?? ""),
          }))
        : [];
      setEvents({ criticalEvents, rollups });
    } catch (error) {
      setEvents(null);
      setEventsError(error instanceof Error ? error.message : "No se pudieron cargar eventos.");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRevenue();
    void loadAccounting();
    void loadEvents();
    void loadSocialflow();
    void loadGovernance();
  }, [loadRevenue, loadAccounting, loadEvents, loadSocialflow, loadGovernance]);

  const kpis = useMemo(() => {
    const totalMRR = accounting?.totalSubscriptionMRR ?? revenue?.global?.mrr ?? 0;
    const totalSaas = accounting?.totalSaas ?? revenue?.global?.activeSaas ?? 0;
    const vendorFixed = accounting?.vendorFixedMonthly ?? 0;
    const approxMarginMonthly = Math.max(0, totalMRR - vendorFixed);
    const approxMarginRate = totalMRR > 0 ? approxMarginMonthly / totalMRR : 0;
    const activeSubs = revenue?.global?.activeSubscriptions ?? undefined;
    return { totalMRR, totalSaas, vendorFixed, approxMarginMonthly, approxMarginRate, activeSubs };
  }, [revenue, accounting]);

  const tableRows = useMemo(() => {
    const rows = accounting?.rows ?? [];
    const bySaasMrr = new Map<string, number>();
    const bySaasSubs = new Map<string, number>();
    (revenue?.bySaas ?? []).forEach((r: { saasId: string; mrr: number; activeSubscriptions?: number }) => {
      bySaasMrr.set(r.saasId, r.mrr);
      if (typeof r.activeSubscriptions === "number") bySaasSubs.set(r.saasId, r.activeSubscriptions);
    });

    // Fallback Ops severity using recent events by saasSlug
    const opsFromEventsBySlug = (() => {
      const map: Record<string, "CRITICAL" | "WARNING" | "OK"> = {};
      const criticalBySlug = new Set<string>();
      const warningBySlug = new Set<string>();
      for (const e of events?.criticalEvents ?? []) {
        const slug = (e.saasSlug ?? "").toString();
        if (!slug) continue;
        const sev = (e.severity ?? "").toUpperCase();
        if (sev.includes("CRITICAL")) criticalBySlug.add(slug);
        else if (sev.includes("WARN")) warningBySlug.add(slug);
      }
      // rollups can also be used to infer if there were recent warnings/criticals per slug
      for (const r of events?.rollups ?? []) {
        const slug = (r.saasSlug ?? "").toString();
        if (!slug) continue;
        const sev = (r.severity ?? "").toUpperCase();
        if (sev.includes("CRITICAL") && r.count > 0) criticalBySlug.add(slug);
        else if (sev.includes("WARN") && r.count > 0) warningBySlug.add(slug);
      }
      // Compute final map: CRITICAL > WARNING > OK
      const allSlugs = new Set<string>([...criticalBySlug, ...warningBySlug]);
      for (const slug of allSlugs) {
        if (criticalBySlug.has(slug)) map[slug] = "CRITICAL";
        else if (warningBySlug.has(slug)) map[slug] = "WARNING";
      }
      return map;
    })();
    return rows
      .map((row: AccountingSnapshot["rows"][number]) => {
        const mrr = row.subscriptionMonthlyAmount ?? bySaasMrr.get(row.saasId) ?? 0;
        const marginPct = row.profitabilityMarginPercent ?? undefined;
        const cost = typeof marginPct === "number" ? Math.max(0, mrr * (1 - marginPct)) : undefined;
        const marginEur = typeof marginPct === "number" ? Math.max(0, mrr * marginPct) : undefined;
        let ops = governanceMap[row.saasId]?.severity ?? (row.slug ? governanceMap[`slug:${row.slug}`]?.severity : undefined);
        if (!ops) {
          const viaEvents = row.slug ? opsFromEventsBySlug[row.slug] : undefined;
          ops = viaEvents ?? "OK";
        }
        if (!ops) {
          // default to OK when there is no evidence of issues
          ops = "OK";
        }
        const social = socialflowMap[row.saasId]?.enabled ?? (row.slug ? socialflowMap[`slug:${row.slug}`]?.enabled : undefined);
        return {
          saasId: row.saasId,
          saasName: row.saasName,
          planLabel: row.planLabel ?? "",
          slug: row.slug,
          mrr,
          marginPct,
          cost,
          marginEur,
          activeSubs: bySaasSubs.get(row.saasId),
          opsSeverity: ops,
          socialEnabled: social,
        };
      })
      .sort((a, b) => b.mrr - a.mrr);
  }, [accounting, revenue, governanceMap, socialflowMap, events]);

  const recentRollups = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const r of events?.rollups ?? []) {
      byDay[r.day] = (byDay[r.day] ?? 0) + r.count;
    }
    return Object.entries(byDay)
      .sort(([d1], [d2]) => (d1 < d2 ? 1 : -1))
      .slice(0, 7);
  }, [events]);

  const growth30d = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const r of events?.rollups ?? []) {
      byDay[r.day] = (byDay[r.day] ?? 0) + r.count;
    }
    const days = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));
    const last30 = days.slice(0, 30);
    const prev30 = days.slice(30, 60);
    const sum = (arr: string[]) => arr.reduce((acc, d) => acc + (byDay[d] ?? 0), 0);
    const current = sum(last30);
    const previous = sum(prev30);
    const delta = current - previous;
    const rate = previous > 0 ? delta / previous : (current > 0 ? 1 : 0);
    return { current, previous, delta, rate, series: last30.map((d) => ({ day: d, total: byDay[d] ?? 0 })) };
  }, [events]);

  const mrr30d = useMemo(() => {
    const hist = (revenue?.history ?? []).slice().sort((a, b) => (a.day < b.day ? 1 : -1));
    if (hist.length < 2) return null;
    const current = hist[0]?.mrr ?? 0;
    const past = hist[30]?.mrr;
    if (typeof past !== "number") return { current, previous: undefined, delta: undefined, rate: undefined } as const;
    const delta = current - past;
    const rate = past > 0 ? delta / past : (current > 0 ? 1 : 0);
    return { current, previous: past, delta, rate } as const;
  }, [revenue]);

  const handleExportCSV = useCallback(() => {
    const header = [
      "SaaS",
      "Plan",
      "MRR",
      "Subs_activas",
      "Coste",
      "Margen_EUR",
      "Margen_%",
      "Ops",
      "Social",
    ];
    const rows = tableRows.map((r) => [
      r.saasName ?? "",
      r.planLabel ?? "",
      String(Math.round(r.mrr ?? 0)),
      typeof r.activeSubs === "number" ? String(r.activeSubs) : "",
      typeof r.cost === "number" ? String(Math.round(r.cost)) : "",
      typeof r.marginEur === "number" ? String(Math.round(r.marginEur)) : "",
      typeof r.marginPct === "number" ? String(Math.round(r.marginPct * 100)) : "",
      r.opsSeverity ?? "",
      typeof r.socialEnabled === "boolean" ? (r.socialEnabled ? "ON" : "OFF") : "",
    ]);
    const csv = [header, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campobase_comparativa_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tableRows]);

  const growth7d = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const r of events?.rollups ?? []) {
      byDay[r.day] = (byDay[r.day] ?? 0) + r.count;
    }
    const days = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));
    const last7 = days.slice(0, 7);
    const prev7 = days.slice(7, 14);
    const sum = (arr: string[]) => arr.reduce((acc, d) => acc + (byDay[d] ?? 0), 0);
    const current = sum(last7);
    const previous = sum(prev7);
    const delta = current - previous;
    const rate = previous > 0 ? delta / previous : (current > 0 ? 1 : 0);
    return { current, previous, delta, rate };
  }, [events]);

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Campamento Base · Panel financiero-operativo (read-only)</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-500">MRR total</div>
            <div className="text-2xl font-bold">€ {kpis.totalMRR.toFixed(0)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-500">SaaS activos</div>
            <div className="text-2xl font-bold">{kpis.totalSaas}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-500">Coste vendor (mes)</div>
            <div className="text-2xl font-bold">€ {kpis.vendorFixed.toFixed(0)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-500">Margen aprox. (mes)</div>
            <div className="text-2xl font-bold">€ {kpis.approxMarginMonthly.toFixed(0)} <span className="text-sm text-gray-500">({(kpis.approxMarginRate * 100).toFixed(0)}%)</span></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="col-span-2">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Comparativa por SaaS</h2>
              <div className="flex items-center gap-3">
                {(accountingLoading || revenueLoading) && <span className="text-xs text-gray-500">Cargando…</span>}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Exportar CSV
                </button>
              </div>
            </div>
            {tableRows.length === 0 ? (
              <EmptyState title="Sin datos" subtitle="No hay filas de accounting disponibles." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">SaaS</th>
                      <th className="py-2 pr-4">Plan</th>
                      <th className="py-2 pr-4">Ops</th>
                      <th className="py-2 pr-4">Social</th>
                      <th className="py-2 pr-4">MRR</th>
                      <th className="py-2 pr-4">Subs activas</th>
                      <th className="py-2 pr-4">Coste €</th>
                      <th className="py-2 pr-4">Margen €</th>
                      <th className="py-2 pr-4">Margen %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.saasId} className="border-b last:border-b-0">
                        <td className="py-2 pr-4">{row.saasName}</td>
                        <td className="py-2 pr-4">{row.planLabel || "-"}</td>
                        <td className="py-2 pr-4">
                          {row.opsSeverity ? (
                            <Badge variant={row.opsSeverity === "CRITICAL" ? "err" : row.opsSeverity === "WARNING" ? "warn" : "ok"}>
                              {row.opsSeverity}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {typeof row.socialEnabled === "boolean" ? (
                            <Badge variant={row.socialEnabled ? "ok" : "neutral"}>{row.socialEnabled ? "ON" : "OFF"}</Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">€ {(row.mrr ?? 0).toFixed(0)}</td>
                        <td className="py-2 pr-4">{typeof row.activeSubs === "number" ? row.activeSubs : <span className="text-gray-400">-</span>}</td>
                        <td className="py-2 pr-4">{typeof row.cost === "number" ? `€ ${row.cost.toFixed(0)}` : <span className="text-gray-400">-</span>}</td>
                        <td className="py-2 pr-4">{typeof row.marginEur === "number" ? `€ ${row.marginEur.toFixed(0)}` : <span className="text-gray-400">-</span>}</td>
                        <td className="py-2 pr-4">
                          {typeof row.marginPct === "number" ? (
                            <Badge variant={row.marginPct >= 0.6 ? "ok" : row.marginPct >= 0.3 ? "warn" : "err"}>
                              {(row.marginPct * 100).toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Alertas operativas</h2>
              {eventsLoading && <span className="text-xs text-gray-500">Cargando…</span>}
            </div>
            {eventsError ? (
              <div className="text-sm text-red-600">{eventsError}</div>
            ) : (events?.criticalEvents?.length ?? 0) === 0 ? (
              <EmptyState title="Sin alertas críticas" subtitle="No hay eventos críticos recientes." />
            ) : (
              <ul className="space-y-2">
                {events!.criticalEvents.slice(0, 5).map((e) => (
                  <li key={e.correlationId} className="text-sm">
                    <Badge variant={e.severity === "CRITICAL" ? "err" : e.severity === "WARNING" ? "warn" : "neutral"} className="mr-2">
                      {e.severity}
                    </Badge>
                    <span className="font-medium">{e.type}</span> — {e.message}
                    <div className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Tendencias (eventos últimos días)</h2>
            {eventsLoading && <span className="text-xs text-gray-500">Cargando…</span>}
          </div>
          {(recentRollups.length ?? 0) === 0 ? (
            <EmptyState title="Sin tendencias" subtitle="Aún no hay rollups disponibles." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {recentRollups.map(([day, total]) => (
                <div key={day} className="text-sm">
                  <div className="text-gray-500">{day}</div>
                  <div className="text-xl font-semibold">{total}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <div className="p-3">
                <div className="text-xs text-gray-500">Eventos 7 días</div>
                <div className="text-xl font-semibold">{growth7d.current}</div>
                <div className="text-xs text-gray-500">vs prev 7d: {growth7d.delta >= 0 ? "+" : ""}{growth7d.delta} ({(growth7d.rate * 100).toFixed(0)}%)</div>
              </div>
            </Card>
            <Card>
              <div className="p-3">
                <div className="text-xs text-gray-500">Eventos 30 días</div>
                <div className="text-xl font-semibold">{growth30d.current}</div>
                <div className="text-xs text-gray-500">vs prev 30d: {growth30d.delta >= 0 ? "+" : ""}{growth30d.delta} ({(growth30d.rate * 100).toFixed(0)}%)</div>
              </div>
            </Card>
            {!!mrr30d && (
              <Card>
                <div className="p-3">
                  <div className="text-xs text-gray-500">MRR 30 días</div>
                  <div className="text-xl font-semibold">€ {(mrr30d.current ?? 0).toFixed(0)}</div>
                  {typeof mrr30d.delta === "number" ? (
                    <div className="text-xs text-gray-500">vs hace 30d: {mrr30d.delta >= 0 ? "+" : ""}{Math.round(mrr30d.delta)} ({typeof mrr30d.rate === "number" ? (mrr30d.rate * 100).toFixed(0) : "-"}%)</div>
                  ) : (
                    <div className="text-xs text-gray-400">Serie no disponible</div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">SocialFlow</h2>
              {socialflowLoading && <span className="text-xs text-gray-500">Cargando…</span>}
            </div>
            {socialflowError ? (
              <div className="text-sm text-red-600">{socialflowError}</div>
            ) : !socialflow || typeof socialflow.total === "undefined" ? (
              <EmptyState title="Sin datos" subtitle="No hay estado SocialFlow disponible." />
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="text-xl font-semibold">{socialflow.total}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Enabled</div>
                  <div className="text-xl font-semibold text-green-600">{socialflow.enabled ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Disabled</div>
                  <div className="text-xl font-semibold text-gray-600">{socialflow.disabled ?? "-"}</div>
                </div>
              </div>
            )}
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Governance</h2>
              {governanceLoading && <span className="text-xs text-gray-500">Cargando…</span>}
            </div>
            {!governance || governanceError ? (
              <EmptyState title="Sin datos" subtitle="No hay estado de governance disponible." />
            ) : (
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="text-xl font-semibold">{governance.total ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Críticos</div>
                  <div className="text-xl font-semibold text-red-600">{governance.critical ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Warn</div>
                  <div className="text-xl font-semibold text-amber-600">{governance.warning ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">OK</div>
                  <div className="text-xl font-semibold text-green-600">{governance.ok ?? 0}</div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
