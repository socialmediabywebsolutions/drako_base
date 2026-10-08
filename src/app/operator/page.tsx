"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import type {
  OwnerGrowthAutopilotAction,
  OwnerPortfolioSnapshot,
} from "@/lib/operator/types";
import type { OperatorActionQueuePriority } from "@/lib/operator/action-queue";
import type { DrakoTreasurySnapshot } from "@/lib/operator/vendor-types";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Owner = {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

type AccountingSnapshot = {
  totalSaas: number;
  totalSubscriptionMRR: number;
  totalEstimatedMarginPercent?: number;
  baselineLifeMonthly: number;
  baselineWorkMonthly: number;
  vendorFixedMonthly: number;
  totalBaselineMonthly: number;
  totalOwnerRevenueMonthly: number;
  baselineCoveragePercent: number;
  baselineCovered: boolean;
  baselineGapAmount: number;
  saasPricingSummary: {
    numUnderwater: number;
    numAtRisk: number;
    numAboveTarget: number;
  };
  pricingStatusBySaas: Record<string, "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER">;
  verticalBreakdown: Array<{ vertical: string; saasCount: number; mrr: number; avgMarginPercent?: number }>;
  taxSummary?: {
    totalVatDueAllSaas: number;
    saasWithHighVat: number;
    saasWithNegativeMargin: number;
  };
  saasHealthSummary?: {
    total: number;
    good: number;
    warning: number;
    critical: number;
    topCritical: Array<{ saasId: string; saasName: string; healthScore: number; healthStatus: string; signals: Array<{ kind: string; level: string }> }>;
  };
  rows: Array<{
    saasId: string;
    saasName: string;
    slug: string;
    vertical?: string;
    packId?: string;
    planLabel?: string;
    subscriptionMonthlyAmount?: number;
    currency?: string;
    profitabilityMarginPercent?: number;
    profitabilityStatus?: string;
  }>;
};

type OperatorCriticalEvent = {
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  correlationId: string;
  saasSlug?: string | null;
};

type OperatorEventRollup = {
  day: string;
  saasSlug?: string | null;
  type: string;
  severity: string;
  count: number;
};

type MentoriaSystemHealth = {
  notifications: { pending: number; failed: number; abandoned: number; total: number };
  feedback: { pending: number; failed: number; total: number };
  publishes: { pending: number; failed: number; abandoned: number; total: number };
  criticalEvents: number;
  silence?: {
    studentsWithoutRecentFeedback: number;
    studentsWithoutRecentParentNotification: number;
    studentsWithoutRecentAcademicActivity: number;
  };
};

type ActionQueueItem = {
  id: string;
  category: string;
  priority: OperatorActionQueuePriority;
  title: string;
  summary: string;
  source: string;
  status: "OPEN" | "EXECUTED" | "DISMISSED" | "SNOOZED";
  saasId?: string;
  saasName?: string;
  verticalId?: string;
};

type FactoryItem = {
  saasId: string;
  saasName: string;
  createdAt: string;
  cloudflare?: { status: string } | null;
  stripe?: { status: string } | null;
  ai?: { status: string } | null;
  verticalId?: string | null;
  pricingStatus?: string | null;
  marketingPack?: string | null;
};

// ─── Sección activa ───────────────────────────────────────────────────────────

type Section = "dashboard" | "finanzas" | "fiscal" | "socialcors" | "mentoria" | "infraestructura" | "configuracion";

const MENU: { id: Section; icon: string; label: string }[] = [
  { id: "dashboard",       icon: "🏠", label: "Dashboard" },
  { id: "finanzas",        icon: "💰", label: "Finanzas" },
  { id: "fiscal",          icon: "📊", label: "Fiscal & IVA" },
  { id: "socialcors",      icon: "📱", label: "Socialcors" },
  { id: "mentoria",        icon: "🎓", label: "Mentoría" },
  { id: "infraestructura", icon: "🌐", label: "Infraestructura" },
  { id: "configuracion",   icon: "⚙️", label: "Configuración" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return "—";
  return n.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtEur(n: number | null | undefined) {
  if (n == null) return "—";
  return `${fmt(n)} €`;
}

function resolveFactoryStage(item: FactoryItem): "ONLINE" | "PROVISIONING" | "BLUEPRINT" | "IDEA" {
  const statuses = [item.cloudflare?.status, item.stripe?.status, item.ai?.status].filter(Boolean);
  if (statuses.length === 0) return "IDEA";
  if (statuses.every((s) => s?.toUpperCase() === "SUCCESS")) return "ONLINE";
  if (statuses.some((s) => s?.toUpperCase() === "PENDING")) return "PROVISIONING";
  return "BLUEPRINT";
}

function statusBadge(s?: string | null): "ok" | "warn" | "err" | "neutral" {
  const v = s?.toUpperCase() ?? "";
  if (v === "SUCCESS" || v === "COMPLETED" || v === "ACTIVE" || v === "OK" || v === "GOOD") return "ok";
  if (v === "ERROR" || v === "FAILED" || v === "CRITICAL" || v === "UNDERWATER") return "err";
  if (v === "PENDING" || v === "WARNING" || v === "AT_RISK" || v === "TIGHT") return "warn";
  return "neutral";
}

// ─── Fiscal España ────────────────────────────────────────────────────────────

function fiscalQuarter(): { q: number; year: number; deadline: string; label: string } {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  if (m <= 4)  return { q: 1, year: y,     deadline: `${y}-04-20`,     label: "T1" };
  if (m <= 7)  return { q: 2, year: y,     deadline: `${y}-07-20`,     label: "T2" };
  if (m <= 10) return { q: 3, year: y,     deadline: `${y}-10-20`,     label: "T3" };
  return         { q: 4, year: y,           deadline: `${y + 1}-01-20`, label: "T4" };
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function K({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-blue-600" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OwnerPage() {
  const [section, setSection] = useState<Section>("dashboard");

  // datos
  const [owner, setOwner] = useState<Owner | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerMsg, setOwnerMsg] = useState<string | null>(null);

  const [accounting, setAccounting] = useState<AccountingSnapshot | null>(null);
  const [accountingLoading, setAccountingLoading] = useState(true);

  const [treasury, setTreasury] = useState<DrakoTreasurySnapshot | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(true);

  const [portfolio, setPortfolio] = useState<OwnerPortfolioSnapshot | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const [growthActions, setGrowthActions] = useState<OwnerGrowthAutopilotAction[]>([]);
  const [growthLoading, setGrowthLoading] = useState(true);

  const [actionQueue, setActionQueue] = useState<{ items: ActionQueueItem[]; stats: { total: number; byPriority: Record<string, number>; byStatus: Record<string, number> } } | null>(null);
  const [actionQueueLoading, setActionQueueLoading] = useState(true);
  const [actionUpdatingId, setActionUpdatingId] = useState<string | null>(null);

  const [events, setEvents] = useState<{ criticalEvents: OperatorCriticalEvent[]; rollups: OperatorEventRollup[] } | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [dbHealth, setDbHealth] = useState<{ status: string; appliedMigrations: { count: number }; missingMigrations: string[]; driftFindings: Array<{ table: string; column?: string; message: string; severity: string }> } | null>(null);
  const [dbHealthLoading, setDbHealthLoading] = useState(true);

  const [domains, setDomains] = useState<Array<{ id: string; hostname: string; status: string; saasSlug: string; verificationStatus?: string | null; lastError?: string | null; retryCount?: number }>>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [domainsUpdating, setDomainsUpdating] = useState(false);

  const [factoryItems, setFactoryItems] = useState<FactoryItem[]>([]);
  const [factoryLoading, setFactoryLoading] = useState(true);

  const [mentoriaHealth, setMentoriaHealth] = useState<MentoriaSystemHealth | null>(null);
  const [mentoriaLoading, setMentoriaLoading] = useState(true);

  // form configuracion
  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // cargas
  const loadOwner = useCallback(async () => {
    setOwnerLoading(true);
    try {
      const res = await fetch("/api/owners", { cache: "no-store" });
      const data = await res.json() as { items?: Owner[] };
      const current = data.items?.[0] ?? null;
      setOwner(current);
      setName(current?.name ?? "");
      setNif(current?.nif ?? "");
      setAddress(current?.address ?? "");
      setEmail(current?.email ?? "");
      setPhone(current?.phone ?? "");
    } catch { /* noop */ } finally { setOwnerLoading(false); }
  }, []);

  const loadAccounting = useCallback(async () => {
    setAccountingLoading(true);
    try {
      const res = await fetch("/api/operator/accounting", { cache: "no-store" });
      const data = await res.json() as { snapshot?: AccountingSnapshot };
      setAccounting(data?.snapshot ?? null);
    } catch { /* noop */ } finally { setAccountingLoading(false); }
  }, []);

  const loadTreasury = useCallback(async () => {
    setTreasuryLoading(true);
    try {
      const res = await fetch("/api/operator/treasury/snapshot", { cache: "no-store" });
      const data = await res.json() as { snapshot?: DrakoTreasurySnapshot };
      setTreasury(data?.snapshot ?? null);
    } catch { /* noop */ } finally { setTreasuryLoading(false); }
  }, []);

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const res = await fetch("/api/operator/portfolio", { cache: "no-store" });
      const data = await res.json() as { snapshot?: OwnerPortfolioSnapshot };
      setPortfolio(data?.snapshot ?? null);
    } catch { /* noop */ } finally { setPortfolioLoading(false); }
  }, []);

  const loadGrowth = useCallback(async () => {
    setGrowthLoading(true);
    try {
      const res = await fetch("/api/operator/autopilot", { cache: "no-store" });
      const data = await res.json() as { actions?: OwnerGrowthAutopilotAction[] };
      setGrowthActions(data?.actions ?? []);
    } catch { /* noop */ } finally { setGrowthLoading(false); }
  }, []);

  const loadActionQueue = useCallback(async () => {
    setActionQueueLoading(true);
    try {
      const res = await fetch("/api/operator/actions", { cache: "no-store" });
      const data = await res.json() as { snapshot?: typeof actionQueue };
      setActionQueue(data?.snapshot ?? null);
    } catch { /* noop */ } finally { setActionQueueLoading(false); }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch("/api/operator/events", { cache: "no-store" });
      const data = await res.json() as { criticalEvents?: Array<{ type: string; severity: string; message: string; created_at: string; correlation_id: string; saas_slug?: string | null }>; rollups?: Array<{ day: string; saas_slug?: string | null; type: string; severity: string; count: number }> };
      setEvents({
        criticalEvents: (data?.criticalEvents ?? []).map((e) => ({ type: e.type, severity: e.severity, message: e.message, createdAt: e.created_at, correlationId: e.correlation_id, saasSlug: e.saas_slug ?? null })),
        rollups: (data?.rollups ?? []).map((r) => ({ day: r.day, saasSlug: r.saas_slug ?? null, type: r.type, severity: r.severity, count: r.count })),
      });
    } catch { /* noop */ } finally { setEventsLoading(false); }
  }, []);

  const loadDbHealth = useCallback(async () => {
    setDbHealthLoading(true);
    try {
      const res = await fetch("/api/operator/db/health", { cache: "no-store" });
      const data = await res.json() as { snapshot?: typeof dbHealth };
      setDbHealth(data?.snapshot ?? null);
    } catch { /* noop */ } finally { setDbHealthLoading(false); }
  }, []);

  const loadDomains = useCallback(async () => {
    setDomainsLoading(true);
    try {
      const res = await fetch("/api/operator/domains", { cache: "no-store" });
      const data = await res.json() as { domains?: typeof domains };
      setDomains(data?.domains ?? []);
    } catch { /* noop */ } finally { setDomainsLoading(false); }
  }, []);

  const loadFactory = useCallback(async () => {
    setFactoryLoading(true);
    try {
      const [saasRes, provRes] = await Promise.all([
        fetch("/api/operator/saas", { cache: "no-store" }),
        fetch("/api/provisioning", { cache: "no-store" }),
      ]);
      const saasData = await saasRes.json() as { items?: Array<{ id: string; name: string; created_at: string }> };
      const provData = await provRes.json() as { items?: Array<{ id: string; saas_id: string; step: string; status: string }> };
      const provBySaas = new Map<string, typeof provData.items>();
      for (const row of provData?.items ?? []) {
        const arr = provBySaas.get(row.saas_id) ?? [];
        arr.push(row);
        provBySaas.set(row.saas_id, arr);
      }
      setFactoryItems(
        (saasData?.items ?? []).slice(0, 8).map((saas) => {
          const rows = provBySaas.get(saas.id) ?? [];
          const get = (step: string) => rows.find((r) => r.step === step);
          return { saasId: saas.id, saasName: saas.name, createdAt: saas.created_at, cloudflare: get("cloudflare"), stripe: get("stripe"), ai: get("ai") };
        }),
      );
    } catch { /* noop */ } finally { setFactoryLoading(false); }
  }, []);

  const loadMentoria = useCallback(async () => {
    setMentoriaLoading(true);
    try {
      const res = await fetch("/api/operator/mentoria/health/system", { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; health?: MentoriaSystemHealth };
      setMentoriaHealth(data?.ok ? (data.health ?? null) : null);
    } catch { /* noop */ } finally { setMentoriaLoading(false); }
  }, []);

  const updateAction = useCallback(async (id: string, action: "EXECUTE" | "DISMISS" | "SNOOZE") => {
    setActionUpdatingId(id);
    try {
      const ep = action === "EXECUTE" ? `/api/operator/actions/${id}/execute` : action === "DISMISS" ? `/api/operator/actions/${id}/dismiss` : `/api/operator/actions/${id}/snooze`;
      const body = action === "SNOOZE" ? { snoozedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() } : null;
      await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      await loadActionQueue();
    } catch { /* noop */ } finally { setActionUpdatingId(null); }
  }, [loadActionQueue]);

  const handleSaveOwner = useCallback(async () => {
    if (!name.trim()) { setOwnerMsg("El nombre es obligatorio."); return; }
    setOwnerSaving(true);
    setOwnerMsg(null);
    try {
      const res = await fetch("/api/owners", {
        method: owner ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: owner?.id, name: name.trim(), nif: nif || null, address: address || null, email: email || null, phone: phone || null, country: "Spain", city: owner?.city ?? "" }),
      });
      const data = await res.json() as { ok?: boolean; item?: Owner; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Error al guardar");
      if (data.item) setOwner(data.item);
      setOwnerMsg("Datos guardados correctamente.");
    } catch (e) { setOwnerMsg(e instanceof Error ? e.message : "Error"); } finally { setOwnerSaving(false); }
  }, [name, nif, address, email, phone, owner]);

  useEffect(() => {
    void loadOwner();
    void loadAccounting();
    void loadTreasury();
    void loadPortfolio();
    void loadGrowth();
    void loadActionQueue();
    void loadEvents();
    void loadDbHealth();
    void loadDomains();
    void loadFactory();
    void loadMentoria();
  }, [loadOwner, loadAccounting, loadTreasury, loadPortfolio, loadGrowth, loadActionQueue, loadEvents, loadDbHealth, loadDomains, loadFactory, loadMentoria]);

  // ─── derived ───────────────────────────────────────────────────────────────
  const fq = fiscalQuarter();
  const daysLeft = daysUntil(fq.deadline);
  const qRevenue = accounting ? (accounting.totalSubscriptionMRR / 100) * 3 : 0;
  const ivaRecaudado = qRevenue * 0.21;
  const deducibleEst = (accounting?.vendorFixedMonthly ?? 0) * 3;
  const ivaSoportado = deducibleEst * 0.21;
  const ivaLiquidar = ivaRecaudado - ivaSoportado;
  const baseNet = qRevenue - deducibleEst;
  const irpfEst = Math.max(0, baseNet * 0.20);

  const openActions = (actionQueue?.items ?? []).filter((a) => a.status === "OPEN");
  const criticalOpen = openActions.filter((a) => a.priority === "CRITICAL");
  const highOpen = openActions.filter((a) => a.priority === "HIGH");

  // ─── Secciones ─────────────────────────────────────────────────────────────

  function DashboardSection() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard del holding</h2>
          <p className="text-sm text-gray-500 mt-1">Vista consolidada de todos los SaaS — Drako · Octubre 2026</p>
        </div>

        {/* Alerta fiscal */}
        {daysLeft <= 20 && daysLeft >= 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-800">Declaración {fq.label} en {daysLeft} días — vence el {fq.deadline}</p>
              <p className="text-sm text-amber-700 mt-0.5">IVA Modelo 303 + IRPF Modelo 130. Ve a <button type="button" onClick={() => setSection("fiscal")} className="underline font-semibold">Fiscal & IVA</button> para ver los importes.</p>
            </div>
          </div>
        )}

        {/* Alertas críticas */}
        {criticalOpen.length > 0 && (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4">
            <p className="font-semibold text-red-800 mb-2">🚨 {criticalOpen.length} acción(es) crítica(s) pendiente(s)</p>
            <div className="space-y-1">
              {criticalOpen.slice(0, 3).map((a) => (
                <p key={a.id} className="text-sm text-red-700">• {a.saasName ? `[${a.saasName}] ` : ""}{a.title}</p>
              ))}
            </div>
          </div>
        )}

        {/* KPIs globales */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <K label="MRR total holding" value={accountingLoading ? "…" : fmtEur(accounting?.totalSubscriptionMRR)} accent />
          <K label="ARR estimado" value={accountingLoading ? "…" : fmtEur((accounting?.totalSubscriptionMRR ?? 0) * 12)} />
          <K label="Ingreso diario" value={accountingLoading ? "…" : fmtEur((accounting?.totalSubscriptionMRR ?? 0) / 30)} />
          <K label="SaaS activos" value={accountingLoading ? "…" : String(accounting?.totalSaas ?? 0)} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <K label="Margen estimado" value={accountingLoading ? "…" : (accounting?.totalEstimatedMarginPercent != null ? `${accounting.totalEstimatedMarginPercent.toFixed(0)}%` : "—")} />
          <K label="Gastos fijos / mes" value={accountingLoading ? "…" : fmtEur(accounting?.totalBaselineMonthly)} />
          <K label="Acciones abiertas" value={actionQueueLoading ? "…" : String(openActions.length)} sub={criticalOpen.length > 0 ? `${criticalOpen.length} críticas` : undefined} />
          <K label="Eventos críticos hoy" value={eventsLoading ? "…" : String(events?.criticalEvents.length ?? 0)} />
        </div>

        {/* Cobertura baseline */}
        {!accountingLoading && accounting && (
          <Card tone="glass" title="Cobertura del mínimo vital" subtitle="¿Los ingresos cubren tus gastos base?">
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Ingresos: {fmtEur(accounting.totalOwnerRevenueMonthly)}</span>
                <span>Necesitas: {fmtEur(accounting.totalBaselineMonthly)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200">
                <div
                  className={`h-3 rounded-full transition-all ${accounting.baselineCovered ? "bg-blue-500" : "bg-amber-400"}`}
                  style={{ width: `${Math.min(100, (accounting.baselineCoveragePercent ?? 0) * 100).toFixed(0)}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {accounting.baselineCovered
                  ? `✅ Baseline cubierto. Margen libre: ${fmtEur(accounting.totalOwnerRevenueMonthly - accounting.totalBaselineMonthly)} / mes.`
                  : `⚠️ Te faltan ${fmtEur(accounting.baselineGapAmount)} para cubrir el mínimo este mes.`}
              </p>
            </div>
          </Card>
        )}

        {/* Autopilot top acciones */}
        {!growthLoading && growthActions.length > 0 && (
          <Card tone="glass" title="Autopilot — acciones prioritarias hoy" subtitle="Generadas por el sistema de crecimiento">
            <div className="space-y-2">
              {growthActions.filter((a) => a.severity === "CRITICAL" || a.severity === "WARNING").slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <Badge variant={a.severity === "CRITICAL" ? "err" : "warn"}>{a.severity}</Badge>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.title}</p>
                    <p className="text-xs text-gray-500">{a.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  function FinanzasSection() {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Finanzas del holding</h2>

        {/* KPIs financieros */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <K label="MRR total" value={accountingLoading ? "…" : fmtEur(accounting?.totalSubscriptionMRR)} accent />
          <K label="ARR" value={accountingLoading ? "…" : fmtEur((accounting?.totalSubscriptionMRR ?? 0) * 12)} />
          <K label="Margen neto estimado" value={accountingLoading ? "…" : fmtEur((accounting?.totalOwnerRevenueMonthly ?? 0) - (accounting?.totalBaselineMonthly ?? 0))} />
          <K label="Margen %" value={accountingLoading ? "…" : (accounting?.totalEstimatedMarginPercent != null ? `${accounting.totalEstimatedMarginPercent.toFixed(0)}%` : "—")} />
        </div>

        {/* Estado de precios */}
        {!accountingLoading && accounting && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{accounting.saasPricingSummary.numUnderwater}</p>
              <p className="text-sm text-red-700 mt-1">SaaS en pérdidas</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-3xl font-bold text-amber-600">{accounting.saasPricingSummary.numAtRisk}</p>
              <p className="text-sm text-amber-700 mt-1">SaaS en riesgo</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{accounting.saasPricingSummary.numAboveTarget}</p>
              <p className="text-sm text-green-700 mt-1">SaaS sanos</p>
            </div>
          </div>
        )}

        {/* Tabla ingresos por SaaS */}
        <Card tone="glass" title="Ingresos por SaaS" subtitle="MRR, margen y estado de precios">
          {accountingLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : !accounting?.rows.length ? (
            <p className="text-sm text-gray-500">Sin datos disponibles.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="modern text-sm w-full" aria-label="Ingresos por SaaS">
                <thead>
                  <tr>
                    <th>SaaS</th>
                    <th>Vertical</th>
                    <th>Plan</th>
                    <th>Precio / mes</th>
                    <th>Margen</th>
                    <th>Estado</th>
                    <th>Pricing</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting.rows.map((row) => (
                    <tr key={row.saasId}>
                      <td className="font-semibold">{row.saasName}</td>
                      <td>{row.vertical ?? "—"}</td>
                      <td>{row.planLabel ?? "—"}</td>
                      <td>{row.subscriptionMonthlyAmount ? fmtEur(row.subscriptionMonthlyAmount) : "—"}</td>
                      <td>{row.profitabilityMarginPercent != null ? `${row.profitabilityMarginPercent.toFixed(0)}%` : "—"}</td>
                      <td><Badge variant={statusBadge(row.profitabilityStatus)}>{row.profitabilityStatus ?? "—"}</Badge></td>
                      <td><Badge variant={statusBadge(accounting.pricingStatusBySaas[row.saasId])}>{accounting.pricingStatusBySaas[row.saasId] ?? "—"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Tesorería */}
        <Card tone="glass" title="Tesorería — reservas" subtitle="Reservas recomendadas para impuestos, IA e infraestructura">
          {treasuryLoading ? (
            <p className="text-sm text-gray-500">Cargando tesorería...</p>
          ) : !treasury ? (
            <p className="text-sm text-gray-500">Sin datos de tesorería.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <K label="Total cuentas" value={fmtEur(treasury.totalBalance)} />
                <K label="Reserva impuestos" value={fmtEur(treasury.taxReserveBalance)} />
                <K label="Reserva infra" value={fmtEur(treasury.infraReserveBalance)} />
                <K label="Reserva IA" value={fmtEur(treasury.aiReserveBalance)} />
              </div>
              <div className="overflow-x-auto">
                <table className="modern text-sm w-full" aria-label="Tesorería">
                  <thead>
                    <tr><th>Reserva</th><th>Actual</th><th>Recomendada</th><th>Gap</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-semibold">Impuestos (trimestre)</td>
                      <td>{fmtEur(treasury.taxReserveBalance)}</td>
                      <td>{fmtEur(treasury.recommendedTaxReserveThisQuarter)}</td>
                      <td className={treasury.taxReserveGap > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                        {treasury.taxReserveGap > 0 ? `–${fmtEur(treasury.taxReserveGap)}` : "✓ OK"}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Infra (mes)</td>
                      <td>{fmtEur(treasury.infraReserveBalance)}</td>
                      <td>{fmtEur(treasury.recommendedInfraReserveThisMonth)}</td>
                      <td className={treasury.infraReserveGap > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                        {treasury.infraReserveGap > 0 ? `–${fmtEur(treasury.infraReserveGap)}` : "✓ OK"}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">IA (mes)</td>
                      <td>{fmtEur(treasury.aiReserveBalance)}</td>
                      <td>{fmtEur(treasury.recommendedAiReserveThisMonth)}</td>
                      <td className={treasury.aiReserveGap > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                        {treasury.aiReserveGap > 0 ? `–${fmtEur(treasury.aiReserveGap)}` : "✓ OK"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        {/* Cola de acciones */}
        <Card tone="glass" title="Cola de acciones" subtitle="Acciones pendientes por prioridad">
          {actionQueueLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : openActions.length === 0 ? (
            <p className="text-sm text-gray-500">No hay acciones abiertas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="modern text-sm w-full" aria-label="Cola de acciones">
                <thead>
                  <tr><th>Prioridad</th><th>SaaS</th><th>Categoría</th><th>Título</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {openActions.sort((a, b) => ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[a.priority] ?? 4) - ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[b.priority] ?? 4)).slice(0, 20).map((item) => (
                    <tr key={item.id}>
                      <td><Badge variant={item.priority === "CRITICAL" ? "err" : item.priority === "HIGH" ? "warn" : "neutral"}>{item.priority}</Badge></td>
                      <td>{item.saasName ?? "—"}</td>
                      <td>{item.category}</td>
                      <td className="max-w-xs text-xs">{item.title}</td>
                      <td>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" disabled={actionUpdatingId === item.id} onClick={() => updateAction(item.id, "EXECUTE")}>✓</Button>
                          <Button size="sm" variant="outline" disabled={actionUpdatingId === item.id} onClick={() => updateAction(item.id, "DISMISS")}>✗</Button>
                          <Button size="sm" variant="outline" disabled={actionUpdatingId === item.id} onClick={() => updateAction(item.id, "SNOOZE")}>+7d</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  function FiscalSection() {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Fiscal & IVA — España</h2>

        {/* Calendario trimestral */}
        <div className={`rounded-2xl border px-5 py-4 ${daysLeft <= 7 ? "border-red-300 bg-red-50" : daysLeft <= 20 ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
          <p className="font-bold text-gray-900 text-lg">📅 Trimestre actual: {fq.label} {fq.year}</p>
          <p className={`text-sm mt-1 font-semibold ${daysLeft <= 7 ? "text-red-700" : daysLeft <= 20 ? "text-amber-700" : "text-blue-700"}`}>
            Vencimiento: {fq.deadline} — {daysLeft > 0 ? `${daysLeft} días` : daysLeft === 0 ? "¡HOY!" : "Vencido"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 md:grid-cols-4">
            {[{ label: "T1 → 20 abr", q: 1 }, { label: "T2 → 20 jul", q: 2 }, { label: "T3 → 20 oct", q: 3 }, { label: "T4 → 20 ene", q: 4 }].map((t) => (
              <div key={t.q} className={`rounded-lg px-3 py-2 ${t.q === fq.q ? "bg-blue-100 font-semibold text-blue-800" : "bg-white border border-gray-200"}`}>
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* IVA estimado trimestre */}
        <Card tone="glass" title="IVA Modelo 303 — estimación trimestral" subtitle="Basado en MRR actual × 3 meses">
          {accountingLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <K label="Ingresos trimestre" value={fmtEur(qRevenue)} />
                <K label="IVA recaudado (21%)" value={fmtEur(ivaRecaudado)} />
                <K label="IVA soportado (gastos)" value={fmtEur(ivaSoportado)} />
                <K label="IVA a liquidar" value={fmtEur(ivaLiquidar)} accent />
              </div>
              <p className="text-xs text-gray-500">
                * Estimación basada en MRR ({fmtEur(accounting?.totalSubscriptionMRR)} × 3) y gastos fijos ({fmtEur(accounting?.vendorFixedMonthly)} × 3). Solo orientativo — verifica con tu gestor.
              </p>
              {accounting?.taxSummary && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">IVA estimado (todos los SaaS)</p>
                    <p className="text-xl font-bold text-gray-800">{accounting.taxSummary.totalVatDueAllSaas > 0 ? fmtEur(accounting.taxSummary.totalVatDueAllSaas) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">SaaS en riesgo fiscal</p>
                    <p className="text-xl font-bold text-amber-600">{accounting.taxSummary.saasWithHighVat}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Con margen negativo</p>
                    <p className="text-xl font-bold text-red-600">{accounting.taxSummary.saasWithNegativeMargin}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* IRPF pago fraccionado */}
        <Card tone="glass" title="IRPF Modelo 130 — pago fraccionado" subtitle="Estimación para autónomos (20% del beneficio neto trimestral)">
          {accountingLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <K label="Beneficio neto trimestral" value={fmtEur(baseNet)} />
                <K label="IRPF estimado (20%)" value={fmtEur(irpfEst)} accent />
                <K label="Reserva tesorería fiscal" value={treasuryLoading ? "…" : fmtEur(treasury?.taxReserveBalance)} />
              </div>
              <p className="text-xs text-gray-500">
                Fórmula: (ingresos trimestre – gastos deducibles) × 20%. Ajusta el % con tu gestor según tu tramo real de IRPF.
              </p>
            </div>
          )}
        </Card>

        {/* Resumen total a pagar este trimestre */}
        {!accountingLoading && (
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-5">
            <p className="font-bold text-blue-900 text-lg mb-3">💡 Total a pagar este trimestre ({fq.label})</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-blue-600">Modelo 303 (IVA neto)</p>
                <p className="text-2xl font-bold text-blue-800">{fmtEur(ivaLiquidar)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600">Modelo 130 (IRPF fraccionado)</p>
                <p className="text-2xl font-bold text-blue-800">{fmtEur(irpfEst)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600">Total estimado</p>
                <p className="text-2xl font-bold text-blue-900">{fmtEur(ivaLiquidar + irpfEst)}</p>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3">⚠️ Estimación orientativa. Confirma los importes exactos con tu gestoría antes de presentar.</p>
          </div>
        )}
      </div>
    );
  }

  function SocialcorsSection() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Socialcors</h2>
            <p className="text-sm text-gray-500 mt-1">Panel de gestión del SaaS de redes sociales</p>
          </div>
          <Link href="/operator/socialflow">
            <Button variant="outline">Abrir panel completo →</Button>
          </Link>
        </div>

        {/* Acceso rápido */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link href="/operator/socialflow" className="block rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 hover:border-blue-400 transition-colors">
            <p className="text-lg font-bold text-blue-800">📊 Dashboard Socialcors</p>
            <p className="text-sm text-blue-600 mt-2">Clientes, ingresos, costes de IA, cuentas internas. Panel completo con todas las métricas del SaaS.</p>
            <p className="text-xs text-blue-500 mt-3 font-semibold">Abrir →</p>
          </Link>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <p className="text-lg font-bold text-gray-800">🔑 Cuentas internas</p>
            <p className="text-sm text-gray-600 mt-2">Gestiona las cuentas sin límites de Drako dentro del panel de Socialcors.</p>
            <Link href="/operator/socialflow">
              <Button variant="outline" size="sm" className="mt-3">Ir a Cuentas Internas</Button>
            </Link>
          </div>
        </div>

        {/* Portfolio SaaS snapshot */}
        {!portfolioLoading && portfolio && portfolio.saas.length > 0 && (
          <Card tone="glass" title="Resumen Socialcors" subtitle="Del portfolio del holding">
            {portfolio.saas.filter((s) => s.name?.toLowerCase().includes("social")).map((s) => (
              <div key={s.saasId} className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <K label="Margen" value={s.keyMetrics.marginPercent != null ? `${s.keyMetrics.marginPercent.toFixed(0)}%` : "—"} />
                <K label="Autopilot crítico" value={String(s.autopilotSummary?.criticalActions ?? 0)} />
                <K label="Autopilot warning" value={String(s.autopilotSummary?.warningActions ?? 0)} />
                <K label="HR fairness" value={s.keyMetrics.hrFairnessStatus ?? "—"} />
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  function MentoriaSection() {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Mentoría</h2>

        {mentoriaLoading ? (
          <p className="text-sm text-gray-500">Cargando salud del sistema...</p>
        ) : !mentoriaHealth ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-gray-500">Sin datos de sistema disponibles.</p>
            <p className="text-sm text-gray-400 mt-1">El SaaS puede estar en desarrollo o sin datos aún.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mentoriaHealth.criticalEvents > 0 && (
              <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4">
                <p className="font-semibold text-red-800">🚨 {mentoriaHealth.criticalEvents} evento(s) crítico(s)</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <K label="Notificaciones pendientes" value={String(mentoriaHealth.notifications.pending)} />
              <K label="Notificaciones fallidas" value={String(mentoriaHealth.notifications.failed)} />
              <K label="Feedback pendiente" value={String(mentoriaHealth.feedback.pending)} />
              <K label="Publicaciones pendientes" value={String(mentoriaHealth.publishes.pending)} />
            </div>
            {mentoriaHealth.silence && (
              <Card tone="glass" title="Silencio detectado" subtitle="Alumnos sin actividad reciente">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
                  <div>
                    <p className="text-gray-500">Sin feedback reciente</p>
                    <p className="text-xl font-bold text-gray-800">{mentoriaHealth.silence.studentsWithoutRecentFeedback}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Sin notif. a padres</p>
                    <p className="text-xl font-bold text-gray-800">{mentoriaHealth.silence.studentsWithoutRecentParentNotification}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Sin actividad académica</p>
                    <p className="text-xl font-bold text-gray-800">{mentoriaHealth.silence.studentsWithoutRecentAcademicActivity}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Datos del portfolio si los hay */}
        {!portfolioLoading && portfolio && (
          <Card tone="glass" title="Mentoría en el portfolio" subtitle="">
            {portfolio.saas.filter((s) => s.name?.toLowerCase().includes("mentor")).map((s) => (
              <div key={s.saasId} className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <K label="Margen" value={s.keyMetrics.marginPercent != null ? `${s.keyMetrics.marginPercent.toFixed(0)}%` : "—"} />
                <K label="Acciones críticas" value={String(s.autopilotSummary?.criticalActions ?? 0)} />
                <K label="HR fairness" value={s.keyMetrics.hrFairnessStatus ?? "—"} />
                <K label="Social ROI" value={s.keyMetrics.socialRoiStatus ?? "—"} />
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  function InfraSection() {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Infraestructura</h2>

        {/* DB Health */}
        <Card tone="glass" title="Base de datos — salud" subtitle="Migraciones aplicadas y drift en D1">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" onClick={loadDbHealth} disabled={dbHealthLoading}>Actualizar</Button>
          </div>
          {dbHealthLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : !dbHealth ? (
            <p className="text-sm text-gray-500">Sin datos de DB health.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant={statusBadge(dbHealth.status)}>{dbHealth.status}</Badge>
                <span className="text-sm text-gray-500">Migraciones aplicadas: <strong>{dbHealth.appliedMigrations.count}</strong></span>
                <span className="text-sm text-gray-500">Faltantes: <strong className={dbHealth.missingMigrations.length > 0 ? "text-red-600" : ""}>{dbHealth.missingMigrations.length}</strong></span>
                <span className="text-sm text-gray-500">Drift: <strong className={dbHealth.driftFindings.length > 0 ? "text-amber-600" : ""}>{dbHealth.driftFindings.length}</strong></span>
              </div>
              {dbHealth.missingMigrations.length > 0 && (
                <div>
                  <p className="text-xs text-red-600 font-semibold uppercase mb-1">Migraciones faltantes</p>
                  {dbHealth.missingMigrations.slice(0, 5).map((id) => <p key={id} className="text-xs text-red-500">{id}</p>)}
                </div>
              )}
              {dbHealth.driftFindings.length > 0 && (
                <div>
                  <p className="text-xs text-amber-600 font-semibold uppercase mb-1">Drift detectado</p>
                  {dbHealth.driftFindings.slice(0, 5).map((f, i) => (
                    <p key={i} className="text-xs text-amber-600">{f.table}{f.column ? `.${f.column}` : ""}: {f.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Dominios */}
        <Card tone="glass" title="Dominios activos" subtitle="Hostnames del ecosistema">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={loadDomains} disabled={domainsLoading || domainsUpdating}>Actualizar</Button>
            <Button variant="outline" size="sm" disabled={domainsUpdating} onClick={async () => {
              setDomainsUpdating(true);
              try { await fetch("/api/operator/domains/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "all" }) }); await loadDomains(); }
              catch { /* noop */ } finally { setDomainsUpdating(false); }
            }}>Verificar todos</Button>
          </div>
          {domainsLoading ? (
            <p className="text-sm text-gray-500">Cargando dominios...</p>
          ) : domains.length === 0 ? (
            <p className="text-sm text-gray-500">No hay dominios registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="modern text-sm w-full" aria-label="Dominios">
                <thead>
                  <tr><th>Hostname</th><th>SaaS</th><th>Estado</th><th>Verificación</th><th>Error</th></tr>
                </thead>
                <tbody>
                  {domains.map((d) => (
                    <tr key={d.id}>
                      <td className="font-semibold">{d.hostname}</td>
                      <td>{d.saasSlug}</td>
                      <td><Badge variant={statusBadge(d.status)}>{d.status.toUpperCase()}</Badge></td>
                      <td><Badge variant={statusBadge(d.verificationStatus)}>{d.verificationStatus?.toUpperCase() ?? "—"}</Badge></td>
                      <td className="text-xs text-gray-400">{d.lastError ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Eventos críticos */}
        <Card tone="glass" title="Eventos críticos recientes" subtitle="Últimos eventos del sistema">
          {eventsLoading ? (
            <p className="text-sm text-gray-500">Cargando eventos...</p>
          ) : !events || events.criticalEvents.length === 0 ? (
            <p className="text-sm text-green-600 font-medium">✅ Sin eventos críticos recientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="modern text-sm w-full" aria-label="Eventos">
                <thead>
                  <tr><th>Fecha</th><th>Tipo</th><th>Severidad</th><th>SaaS</th><th>Mensaje</th></tr>
                </thead>
                <tbody>
                  {events.criticalEvents.slice(0, 20).map((e) => (
                    <tr key={`${e.correlationId}-${e.createdAt}`}>
                      <td className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleString("es-ES")}</td>
                      <td className="text-xs">{e.type}</td>
                      <td><Badge variant={statusBadge(e.severity)}>{e.severity}</Badge></td>
                      <td className="text-xs text-gray-400">{e.saasSlug ?? "—"}</td>
                      <td className="text-xs text-gray-500">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Factory */}
        <Card tone="glass" title="SaaS Factory — estado de wiring" subtitle="Provisionamiento de cada SaaS en el ecosistema">
          {factoryLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : factoryItems.length === 0 ? (
            <p className="text-sm text-gray-500">Sin datos de factory.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="modern text-sm w-full" aria-label="Factory">
                <thead>
                  <tr><th>SaaS</th><th>Estado</th><th>Cloudflare</th><th>Stripe</th><th>IA</th></tr>
                </thead>
                <tbody>
                  {factoryItems.map((item) => {
                    const stage = resolveFactoryStage(item);
                    return (
                      <tr key={item.saasId}>
                        <td className="font-semibold">{item.saasName}</td>
                        <td><Badge variant={stage === "ONLINE" ? "ok" : stage === "PROVISIONING" ? "warn" : "neutral"}>{stage}</Badge></td>
                        <td><Badge variant={statusBadge(item.cloudflare?.status ?? "PENDING")}>{(item.cloudflare?.status ?? "PENDING").toUpperCase()}</Badge></td>
                        <td><Badge variant={statusBadge(item.stripe?.status ?? "PENDING")}>{(item.stripe?.status ?? "PENDING").toUpperCase()}</Badge></td>
                        <td><Badge variant={statusBadge(item.ai?.status ?? "PENDING")}>{(item.ai?.status ?? "PENDING").toUpperCase()}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  function ConfiguracionSection() {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Configuración</h2>

        <Card tone="glass" title="Datos fiscales del holding" subtitle="Nombre, NIF y dirección para facturas y declaraciones">
          {ownerLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre / Razón social *</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Drako Holding S.L."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">NIF / CIF</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    value={nif}
                    onChange={(e) => setNif(e.target.value)}
                    placeholder="B12345678"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@drako.systems"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Dirección fiscal</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle Principal 1, 28001 Madrid"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" disabled={ownerSaving} onClick={handleSaveOwner}>
                  {ownerSaving ? "Guardando..." : "Guardar datos"}
                </Button>
                {ownerMsg && <p className={`text-sm ${ownerMsg.includes("Error") || ownerMsg.includes("obligatorio") ? "text-red-600" : "text-green-600"}`}>{ownerMsg}</p>}
              </div>
            </div>
          )}
        </Card>

        <Card tone="glass" title="Accesos rápidos del ecosistema" subtitle="">
          <div className="flex flex-wrap gap-2">
            <Link href="/operator/socialflow"><Button variant="outline" size="sm">📱 Panel Socialcors</Button></Link>
            <Link href="/operator/catalog"><Button variant="outline" size="sm">📦 Catálogo SaaS</Button></Link>
            <Link href="/operator/governance"><Button variant="outline" size="sm">🏛 Gobernanza</Button></Link>
            <Link href="/operator/domains"><Button variant="outline" size="sm">🌐 Dominios</Button></Link>
            <Link href="/operator/platform"><Button variant="outline" size="sm">⚡ Plataforma</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Render principal ─────────────────────────────────────────────────────

  // Llamadas como funciones (no como componentes JSX) para evitar que React las
  // desmonte en cada re-render, lo que causaba pérdida de foco en los inputs.
  const sectionContent: Record<Section, React.ReactNode> = {
    dashboard:       DashboardSection(),
    finanzas:        FinanzasSection(),
    fiscal:          FiscalSection(),
    socialcors:      SocialcorsSection(),
    mentoria:        MentoriaSection(),
    infraestructura: InfraSection(),
    configuracion:   ConfiguracionSection(),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs horizontales */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
          {MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                section === item.id
                  ? "border-sky-500 text-sky-700"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.id === "fiscal" && daysLeft <= 20 && daysLeft >= 0 && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 rounded-full px-1.5 py-0.5">{daysLeft}d</span>
              )}
              {item.id === "dashboard" && criticalOpen.length > 0 && (
                <span className="text-[10px] font-bold text-red-600 bg-red-100 rounded-full px-1.5 py-0.5">{criticalOpen.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido */}
      <div className="p-6">
        {sectionContent[section]}
      </div>
    </div>
  );
}
