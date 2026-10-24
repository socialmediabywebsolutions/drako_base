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

type TaxPortfolioSummary = {
  totalVatDueAllSaas: number;
  saasWithHighVat: number;
  saasWithNegativeMargin: number;
  items: Array<{
    saasId: string;
    vatDue: number;
    status: "OK" | "TIGHT" | "RISK";
    marginPercent?: number | null;
    periodKey: string;
  }>;
};

// Forma real que devuelve /api/operator/revenue
type RevenueBreakdown = {
  ok: boolean;
  data: {
    global_mrr_cents: number;
    global_active_tenants: number;
    global_churn_rate: number;
    breakdown: Record<string, {
      total_tenants: number;
      active_tenants: number;
      mrr_cents: number;
      past_due_count: number;
      churn_rate: number;
    }>;
  };
  timestamp: string;
};

type InternalAccount = {
  tenant_id: string;
  saas_slug: string;
  label: string | null;
  added_at: string;
};

type GrantStatus = "IDENTIFIED" | "EVALUATING" | "APPLYING" | "SUBMITTED" | "APPROVED" | "DENIED" | "WITHDRAWN";

type OperatorGrant = {
  id: string;
  name: string;
  entity: string;
  description: string | null;
  program: string | null;
  url: string | null;
  max_amount: number | null;
  grant_type: "GRANT" | "LOAN" | "SUBSIDY" | "ADVANCE";
  deadline: string | null;
  applied_at: string | null;
  outcome_at: string | null;
  status: GrantStatus;
  requirements: string | null;
  documents_generated: string | null;
  notes: string | null;
  ai_summary: string | null;
  ai_fit_score: number | null;
  created_at: string;
  updated_at: string;
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

type Section = "dashboard" | "finanzas" | "fiscal" | "ayudas" | "socialcors" | "cuentas" | "mentoria" | "infraestructura" | "configuracion";

const MENU: { id: Section; icon: string; label: string }[] = [
  { id: "dashboard",       icon: "🏠", label: "Dashboard" },
  { id: "finanzas",        icon: "💰", label: "Finanzas" },
  { id: "fiscal",          icon: "📊", label: "Fiscal & IVA" },
  { id: "ayudas",          icon: "🎯", label: "Ayudas & Subvenciones" },
  { id: "socialcors",      icon: "📱", label: "Socialcors" },
  { id: "cuentas",         icon: "🔑", label: "Cuentas Internas" },
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

  // tax portfolio real
  const [taxPortfolio, setTaxPortfolio] = useState<TaxPortfolioSummary | null>(null);
  const [taxPortfolioLoading, setTaxPortfolioLoading] = useState(true);

  // revenue Stripe real
  const [revenue, setRevenue] = useState<RevenueBreakdown | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

  // cuentas internas
  const [internalAccounts, setInternalAccounts] = useState<InternalAccount[]>([]);
  const [internalAccountsLoading, setInternalAccountsLoading] = useState(true);
  const [iaTenantId, setIaTenantId] = useState("");
  const [iaSaasSlug, setIaSaasSlug] = useState("socialflow");
  const [iaLabel, setIaLabel] = useState("");
  const [iaSaving, setIaSaving] = useState(false);
  const [iaDeleting, setIaDeleting] = useState<string | null>(null);
  const [iaMsg, setIaMsg] = useState<string | null>(null);

  // ayudas y subvenciones
  const [grants, setGrants] = useState<OperatorGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [grantsSearching, setGrantsSearching] = useState(false);
  const [grantsMsg, setGrantsMsg] = useState<string | null>(null);
  const [selectedGrant, setSelectedGrant] = useState<OperatorGrant | null>(null);
  const [grantDoc, setGrantDoc] = useState<string | null>(null);
  const [grantDocLoading, setGrantDocLoading] = useState(false);

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

  const loadTaxPortfolio = useCallback(async () => {
    setTaxPortfolioLoading(true);
    try {
      const res = await fetch("/api/operator/tax/summary", { cache: "no-store" });
      const data = await res.json() as { summary?: TaxPortfolioSummary };
      setTaxPortfolio(data?.summary ?? null);
    } catch { /* noop */ } finally { setTaxPortfolioLoading(false); }
  }, []);

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const res = await fetch("/api/operator/revenue", { cache: "no-store" });
      const data = await res.json() as RevenueBreakdown;
      setRevenue(data?.ok && data?.data ? data : null);
    } catch { /* noop */ } finally { setRevenueLoading(false); }
  }, []);

  const loadInternalAccounts = useCallback(async () => {
    setInternalAccountsLoading(true);
    try {
      const res = await fetch("/api/operator/internal-accounts", { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; items?: InternalAccount[] };
      setInternalAccounts(data?.items ?? []);
    } catch { /* noop */ } finally { setInternalAccountsLoading(false); }
  }, []);

  const addInternalAccount = useCallback(async () => {
    if (!iaTenantId.trim()) { setIaMsg("❌ El Tenant ID es obligatorio."); return; }
    setIaSaving(true);
    setIaMsg(null);
    try {
      const res = await fetch("/api/operator/internal-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: iaTenantId.trim(), saasSlug: iaSaasSlug, label: iaLabel.trim() || null }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Error al añadir");
      setIaMsg("✅ Cuenta añadida correctamente.");
      setIaTenantId("");
      setIaLabel("");
      await loadInternalAccounts();
    } catch (e) { setIaMsg(`❌ ${e instanceof Error ? e.message : "Error"}`); }
    finally { setIaSaving(false); }
  }, [iaTenantId, iaSaasSlug, iaLabel, loadInternalAccounts]);

  const deleteInternalAccount = useCallback(async (tenantId: string, saasSlug: string) => {
    setIaDeleting(`${tenantId}:${saasSlug}`);
    setIaMsg(null);
    try {
      const res = await fetch("/api/operator/internal-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, saasSlug }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Error al eliminar");
      setIaMsg("✅ Cuenta eliminada.");
      await loadInternalAccounts();
    } catch (e) { setIaMsg(`❌ ${e instanceof Error ? e.message : "Error"}`); }
    finally { setIaDeleting(null); }
  }, [loadInternalAccounts]);

  const loadGrants = useCallback(async () => {
    setGrantsLoading(true);
    try {
      const res = await fetch("/api/operator/grants", { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; items?: OperatorGrant[] };
      setGrants(data?.items ?? []);
    } catch { /* noop */ } finally { setGrantsLoading(false); }
  }, []);

  const searchGrants = useCallback(async () => {
    setGrantsSearching(true);
    setGrantsMsg(null);
    try {
      const res = await fetch("/api/operator/grants/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json() as { ok?: boolean; created?: number; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Error en búsqueda");
      setGrantsMsg(`✅ ${data.created ?? 0} ayuda(s) nueva(s) identificadas por la IA`);
      await loadGrants();
    } catch (e) {
      setGrantsMsg(`❌ ${e instanceof Error ? e.message : "Error en búsqueda IA"}`);
    } finally { setGrantsSearching(false); }
  }, [loadGrants]);

  const generateGrantDoc = useCallback(async (grantId: string, docType: string) => {
    setGrantDocLoading(true);
    setGrantDoc(null);
    try {
      const res = await fetch("/api/operator/grants/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId, docType }),
      });
      const data = await res.json() as { ok?: boolean; document?: string; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Error generando documento");
      setGrantDoc(data.document ?? null);
    } catch (e) {
      setGrantDoc(`Error: ${e instanceof Error ? e.message : "Error desconocido"}`);
    } finally { setGrantDocLoading(false); }
  }, []);

  const updateGrantStatus = useCallback(async (id: string, status: GrantStatus) => {
    try {
      await fetch("/api/operator/grants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await loadGrants();
    } catch { /* noop */ }
  }, [loadGrants]);

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
    void loadTaxPortfolio();
    void loadRevenue();
    void loadGrants();
    void loadInternalAccounts();
  }, [loadOwner, loadAccounting, loadTreasury, loadPortfolio, loadGrowth, loadActionQueue, loadEvents, loadDbHealth, loadDomains, loadFactory, loadMentoria, loadTaxPortfolio, loadRevenue, loadGrants, loadInternalAccounts]);

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
    // Usar datos reales del tax portfolio si están disponibles, si no fallback a estimación MRR
    const realVatDue = taxPortfolio?.totalVatDueAllSaas ?? null;
    const useRealData = !taxPortfolioLoading && taxPortfolio != null;

    // Valores a mostrar (reales o estimados)
    const displayIvaLiquidar = useRealData ? (realVatDue ?? ivaLiquidar) : ivaLiquidar;
    const displayIrpf = irpfEst; // IRPF siempre estimado (requiere datos del ejercicio completo)

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

        {/* IVA Modelo 303 — datos reales del motor fiscal */}
        <Card tone="glass" title="IVA Modelo 303 — trimestre actual" subtitle={useRealData ? "Datos calculados por el motor fiscal por SaaS" : "Estimación basada en MRR"}>
          {taxPortfolioLoading ? (
            <p className="text-sm text-gray-500">Calculando IVA real...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {useRealData ? (
                  <>
                    <K label="IVA total a liquidar" value={fmtEur(taxPortfolio!.totalVatDueAllSaas)} accent />
                    <K label="SaaS con IVA alto" value={String(taxPortfolio!.saasWithHighVat)} />
                    <K label="SaaS en pérdidas" value={String(taxPortfolio!.saasWithNegativeMargin)} />
                    <K label="SaaS calculados" value={String(taxPortfolio!.items.length)} />
                  </>
                ) : (
                  <>
                    <K label="Ingresos trimestre (est.)" value={fmtEur(qRevenue)} />
                    <K label="IVA recaudado (21%)" value={fmtEur(ivaRecaudado)} />
                    <K label="IVA soportado (gastos)" value={fmtEur(ivaSoportado)} />
                    <K label="IVA a liquidar (est.)" value={fmtEur(ivaLiquidar)} accent />
                  </>
                )}
              </div>

              {/* Desglose por SaaS */}
              {useRealData && taxPortfolio!.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="modern text-sm w-full" aria-label="IVA por SaaS">
                    <thead>
                      <tr><th>SaaS</th><th>Período</th><th>IVA a liquidar</th><th>Margen</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {taxPortfolio!.items.map((item) => (
                        <tr key={item.saasId}>
                          <td className="font-medium">{item.saasId}</td>
                          <td className="text-xs text-gray-400">{item.periodKey}</td>
                          <td className="font-semibold">{fmtEur(item.vatDue)}</td>
                          <td>{item.marginPercent != null ? `${item.marginPercent.toFixed(0)}%` : "—"}</td>
                          <td>
                            <Badge variant={item.status === "OK" ? "ok" : item.status === "TIGHT" ? "warn" : "err"}>
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!useRealData && (
                <p className="text-xs text-gray-500">
                  * Estimación: MRR ({fmtEur(accounting?.totalSubscriptionMRR)} × 3) y gastos fijos ({fmtEur(accounting?.vendorFixedMonthly)} × 3). Solo orientativo.
                </p>
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
        <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-5">
          <p className="font-bold text-blue-900 text-lg mb-3">💡 Total a pagar este trimestre ({fq.label})</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-blue-600">Modelo 303 (IVA neto){useRealData ? " · Motor real" : " · Estimado"}</p>
              <p className="text-2xl font-bold text-blue-800">{taxPortfolioLoading ? "…" : fmtEur(displayIvaLiquidar)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600">Modelo 130 (IRPF fraccionado)</p>
              <p className="text-2xl font-bold text-blue-800">{accountingLoading ? "…" : fmtEur(displayIrpf)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600">Total estimado</p>
              <p className="text-2xl font-bold text-blue-900">{(taxPortfolioLoading || accountingLoading) ? "…" : fmtEur(displayIvaLiquidar + displayIrpf)}</p>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-3">⚠️ Estimación orientativa. Confirma los importes exactos con tu gestoría antes de presentar.</p>
        </div>
      </div>
    );
  }

  function AyudasSection() {
    const GRANT_STATUS_LABELS: Record<GrantStatus, string> = {
      IDENTIFIED: "Identificada",
      EVALUATING: "Evaluando",
      APPLYING: "Postulando",
      SUBMITTED: "Presentada",
      APPROVED: "✅ Concedida",
      DENIED: "❌ Denegada",
      WITHDRAWN: "Retirada",
    };

    const GRANT_TYPE_LABELS: Record<string, string> = {
      GRANT: "Subvención",
      LOAN: "Préstamo",
      SUBSIDY: "Ayuda",
      ADVANCE: "Anticipo",
    };

    const activeGrants = grants.filter((g) => !["DENIED", "WITHDRAWN"].includes(g.status));
    const closedGrants = grants.filter((g) => ["APPROVED", "DENIED", "WITHDRAWN"].includes(g.status));
    const statusOrder: GrantStatus[] = ["APPLYING", "SUBMITTED", "EVALUATING", "IDENTIFIED", "APPROVED", "DENIED", "WITHDRAWN"];
    const sortedActive = [...activeGrants].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Ayudas & Subvenciones</h2>
            <p className="text-sm text-gray-500 mt-1">El agente IA busca convocatorias y genera los documentos de solicitud</p>
          </div>
          <Button
            variant="outline"
            disabled={grantsSearching}
            onClick={() => void searchGrants()}
          >
            {grantsSearching ? "🔍 Buscando ayudas..." : "🤖 Buscar ayudas con IA"}
          </Button>
        </div>

        {grantsMsg && (
          <div className={`rounded-2xl border px-5 py-3 text-sm ${grantsMsg.startsWith("✅") ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {grantsMsg}
          </div>
        )}

        {/* KPIs de ayudas */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <K label="Total identificadas" value={String(grants.length)} />
          <K label="En proceso" value={String(grants.filter((g) => ["EVALUATING", "APPLYING", "SUBMITTED"].includes(g.status)).length)} accent />
          <K label="Concedidas" value={String(grants.filter((g) => g.status === "APPROVED").length)} />
          <K label="Importe potencial" value={fmtEur(activeGrants.reduce((sum, g) => sum + (g.max_amount ?? 0), 0) / 100)} />
        </div>

        {/* Ayudas activas */}
        {grantsLoading ? (
          <p className="text-sm text-gray-500">Cargando ayudas...</p>
        ) : sortedActive.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500 text-lg">No hay ayudas activas.</p>
            <p className="text-sm text-gray-400 mt-2">Pulsa "Buscar ayudas con IA" y el agente identificará convocatorias para las que puedes presentarte.</p>
          </div>
        ) : (
          <Card tone="glass" title="Ayudas en seguimiento" subtitle="Convocatorias activas ordenadas por estado">
            <div className="space-y-3">
              {sortedActive.map((grant) => (
                <div
                  key={grant.id}
                  className={`rounded-xl border p-4 cursor-pointer transition-colors ${selectedGrant?.id === grant.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
                  onClick={() => { setSelectedGrant(selectedGrant?.id === grant.id ? null : grant); setGrantDoc(null); }}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={grant.status === "APPROVED" ? "ok" : grant.status === "APPLYING" || grant.status === "SUBMITTED" ? "warn" : "neutral"}>
                          {GRANT_STATUS_LABELS[grant.status]}
                        </Badge>
                        <Badge variant="neutral">{GRANT_TYPE_LABELS[grant.grant_type] ?? grant.grant_type}</Badge>
                        {grant.ai_fit_score != null && (
                          <span className="text-xs text-gray-500">Encaje: <strong className={grant.ai_fit_score >= 70 ? "text-green-600" : "text-amber-600"}>{grant.ai_fit_score}%</strong></span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 mt-1">{grant.name}</p>
                      <p className="text-xs text-gray-500">{grant.entity}{grant.program ? ` · ${grant.program}` : ""}</p>
                      {grant.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{grant.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {grant.max_amount && <p className="font-bold text-gray-800">hasta {fmtEur(grant.max_amount / 100)}</p>}
                      {grant.deadline && (
                        <p className="text-xs text-gray-500">
                          Cierre: {new Date(grant.deadline).toLocaleDateString("es-ES")}
                          {" "}({daysUntil(grant.deadline) > 0 ? `${daysUntil(grant.deadline)} días` : "Vencida"})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Panel expandido */}
                  {selectedGrant?.id === grant.id && (
                    <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
                      {grant.ai_summary && (
                        <div>
                          <p className="text-xs text-blue-700 font-semibold mb-1">🤖 Análisis IA</p>
                          <p className="text-sm text-gray-700">{grant.ai_summary}</p>
                        </div>
                      )}
                      {grant.requirements && (
                        <div>
                          <p className="text-xs text-gray-500 font-semibold mb-1">Requisitos principales</p>
                          <p className="text-sm text-gray-600">{grant.requirements}</p>
                        </div>
                      )}

                      {/* Cambiar estado */}
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-2">Cambiar estado</p>
                        <div className="flex flex-wrap gap-2">
                          {(["EVALUATING", "APPLYING", "SUBMITTED", "APPROVED", "DENIED", "WITHDRAWN"] as GrantStatus[]).map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={grant.status === s}
                              onClick={(e) => { e.stopPropagation(); void updateGrantStatus(grant.id, s); }}
                              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${grant.status === s ? "bg-blue-100 border-blue-300 text-blue-800 font-semibold" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"}`}
                            >
                              {GRANT_STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Generar documentos */}
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-2">Generar documentos con IA</p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={grantDocLoading}
                            onClick={(e) => { e.stopPropagation(); void generateGrantDoc(grant.id, "memoria_proyecto"); }}
                          >
                            {grantDocLoading ? "Generando..." : "📄 Memoria técnica"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={grantDocLoading}
                            onClick={(e) => { e.stopPropagation(); void generateGrantDoc(grant.id, "solicitud"); }}
                          >
                            {grantDocLoading ? "Generando..." : "📋 Solicitud formal"}
                          </Button>
                          {grant.url && (
                            <a href={grant.url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline">🔗 Ver convocatoria</Button>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Documento generado */}
                      {grantDocLoading && <p className="text-sm text-blue-600">Generando documento...</p>}
                      {grantDoc && !grantDocLoading && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 font-semibold mb-2">Documento generado</p>
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                            {grantDoc}
                          </div>
                          <button
                            type="button"
                            className="mt-2 text-xs text-blue-600 underline"
                            onClick={() => {
                              const blob = new Blob([grantDoc], { type: "text/plain" });
                              const a = document.createElement("a");
                              a.href = URL.createObjectURL(blob);
                              a.download = `${grant.name.replace(/\s+/g, "_")}.txt`;
                              a.click();
                            }}
                          >
                            Descargar documento
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Historial */}
        {closedGrants.length > 0 && (
          <Card tone="glass" title="Historial" subtitle="Ayudas concedidas, denegadas o retiradas">
            <div className="space-y-2">
              {closedGrants.map((grant) => (
                <div key={grant.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{grant.name}</p>
                    <p className="text-xs text-gray-500">{grant.entity} · {grant.outcome_at ? new Date(grant.outcome_at).toLocaleDateString("es-ES") : "—"}</p>
                  </div>
                  <Badge variant={grant.status === "APPROVED" ? "ok" : "err"}>{GRANT_STATUS_LABELS[grant.status]}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Info sobre el agente */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
          <p className="font-semibold text-gray-700 mb-2">ℹ️ Cómo funciona el agente de ayudas</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• El agente analiza el perfil de Drako (sector, NIF, SaaS, actividad) y busca convocatorias relevantes</li>
            <li>• Genera automáticamente la memoria técnica y solicitud formal adaptada a cada ayuda</li>
            <li>• Puedes seguir el estado de cada postulación desde este panel</li>
            <li>• Los documentos generados son un punto de partida — revisa y completa con tu gestor</li>
          </ul>
        </div>
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
          <button
            type="button"
            onClick={() => setSection("cuentas")}
            className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-left hover:border-emerald-400 transition-colors w-full"
          >
            <p className="text-lg font-bold text-emerald-800">🔑 Cuentas Internas</p>
            <p className="text-sm text-emerald-600 mt-2">Gestiona las cuentas blindadas con plan Pro para cada SaaS del ecosistema.</p>
            <p className="text-xs text-emerald-500 mt-3 font-semibold">Gestionar →</p>
          </button>
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

  function CuentasSection() {
    const SAAS_OPTIONS = [
      { slug: "socialflow",  label: "Socialcors" },
      { slug: "mentoria",    label: "Mentoría" },
      { slug: "cryptoia",    label: "Crypto IA" },
      { slug: "cazh",        label: "Cazh" },
      { slug: "rentia",      label: "Rentia" },
    ];

    // Agrupar por SaaS para mejor legibilidad
    const bySlug: Record<string, InternalAccount[]> = {};
    for (const acc of internalAccounts) {
      if (!bySlug[acc.saas_slug]) bySlug[acc.saas_slug] = [];
      bySlug[acc.saas_slug].push(acc);
    }

    // MRR real desde revenue route
    const revenueData = revenue?.data;

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cuentas Internas</h2>
            <p className="text-sm text-gray-500 mt-1">
              Cuentas blindadas con acceso Pro ilimitado en cada SaaS. No pasan por Stripe ni tienen límites de cuota.
            </p>
          </div>
          <span className="rounded-full bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1">
            {internalAccounts.length} cuenta{internalAccounts.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Revenue real de Socialcors */}
        {!revenueLoading && revenueData && (
          <Card tone="glass" title="Revenue Stripe real — Socialcors" subtitle="Solo suscripciones con stripe_customer_id + stripe_subscription_id">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <K label="MRR global (Stripe)" value={`${((revenueData.global_mrr_cents ?? 0) / 100).toLocaleString("es-ES", { minimumFractionDigits: 0 })} €`} accent />
              <K label="Clientes activos" value={String(revenueData.global_active_tenants ?? 0)} />
              <K label="Churn rate" value={`${((revenueData.global_churn_rate ?? 0) * 100).toFixed(1)}%`} />
              <K label="SaaS con datos" value={String(Object.keys(revenueData.breakdown ?? {}).length)} />
            </div>
            {Object.entries(revenueData.breakdown ?? {}).length > 0 && (
              <div className="mt-4 divide-y divide-gray-100">
                {Object.entries(revenueData.breakdown).map(([slug, b]) => (
                  <div key={slug} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-gray-700">{slug}</span>
                    <div className="flex items-center gap-6 text-gray-500">
                      <span>{b.active_tenants} activos</span>
                      {b.past_due_count > 0 && <span className="text-amber-600">{b.past_due_count} past_due</span>}
                      <span className="font-semibold text-gray-900">{((b.mrr_cents ?? 0) / 100).toLocaleString("es-ES")} €</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Añadir cuenta */}
        <Card tone="glass" title="Añadir cuenta interna" subtitle="La cuenta quedará blindada al plan Pro del SaaS elegido, sin límites de cuota">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Tenant ID *</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                placeholder="ej. drako|1234abcd"
                value={iaTenantId}
                onChange={(e) => setIaTenantId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">SaaS</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none bg-white"
                value={iaSaasSlug}
                onChange={(e) => setIaSaasSlug(e.target.value)}
              >
                {SAAS_OPTIONS.map((o) => (
                  <option key={o.slug} value={o.slug}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Etiqueta (opcional)</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                placeholder="ej. Cristóbal · uso propio"
                value={iaLabel}
                onChange={(e) => setIaLabel(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => { void addInternalAccount(); }}
                disabled={iaSaving || !iaTenantId.trim()}
              >
                {iaSaving ? "Añadiendo…" : "Añadir cuenta"}
              </Button>
            </div>
          </div>
          {iaMsg && (
            <p className={`mt-3 text-sm font-medium ${iaMsg.startsWith("✅") ? "text-green-700" : "text-red-600"}`}>{iaMsg}</p>
          )}
        </Card>

        {/* Lista de cuentas */}
        {internalAccountsLoading ? (
          <p className="text-sm text-gray-500">Cargando cuentas internas…</p>
        ) : internalAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <p className="text-2xl mb-2">🔑</p>
            <p className="text-gray-500 font-medium">Sin cuentas internas registradas</p>
            <p className="text-sm text-gray-400 mt-1">Añade la primera cuenta usando el formulario de arriba.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {SAAS_OPTIONS.filter((o) => bySlug[o.slug]?.length).map((o) => (
              <Card key={o.slug} tone="glass" title={o.label} subtitle={`${bySlug[o.slug].length} cuenta${bySlug[o.slug].length !== 1 ? "s" : ""} · Plan Pro siempre`}>
                <div className="divide-y divide-gray-100">
                  {bySlug[o.slug].map((acc) => {
                    const key = `${acc.tenant_id}:${acc.saas_slug}`;
                    return (
                      <div key={key} className="flex items-center justify-between py-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="bg-gray-100 rounded px-2 py-0.5 text-xs font-mono text-gray-700 break-all">
                              {acc.tenant_id}
                            </code>
                            {acc.label && (
                              <span className="text-gray-500">{acc.label}</span>
                            )}
                            <Badge variant="ok" size="sm">Pro</Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Añadida {acc.added_at ? new Date(acc.added_at).toLocaleDateString("es-ES") : "—"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { void deleteInternalAccount(acc.tenant_id, acc.saas_slug); }}
                          disabled={iaDeleting === key}
                          className="ml-4 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 whitespace-nowrap"
                        >
                          {iaDeleting === key ? "Eliminando…" : "Eliminar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
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
    ayudas:          AyudasSection(),
    socialcors:      SocialcorsSection(),
    cuentas:         CuentasSection(),
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
              {item.id === "ayudas" && grants.filter((g) => ["APPLYING", "SUBMITTED"].includes(g.status)).length > 0 && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-100 rounded-full px-1.5 py-0.5">
                  {grants.filter((g) => ["APPLYING", "SUBMITTED"].includes(g.status)).length}
                </span>
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
