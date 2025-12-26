"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { TextInput, TextArea } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import type { OwnerGrowthAutopilotAction, OwnerPortfolioSnapshot } from "@/lib/owner/types";
import type { OwnerActionQueuePriority } from "@/lib/owner/action-queue";
import type { DrakoTreasurySnapshot } from "@/lib/owner/vendor-types";
import { SAAS_PACK_DEFINITIONS } from "@/lib/packs/definitions";
import OwnerTasksBoard from "@/app/owner/OwnerTasksBoard";
import OwnerVendorSection from "@/app/owner/OwnerVendorSection";
import OwnerPricingSection from "@/app/owner/OwnerPricingSection";
import OwnerMarketingSection from "@/app/owner/OwnerMarketingSection";

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

type FactoryProvisioningRow = {
  id: string;
  saas_id: string;
  step: string;
  status: string;
  details: string | null;
  created_at: string;
};

type FactorySaasRow = {
  id: string;
  name: string;
  created_at: string;
};

type FactoryPricingRow = {
  saasId: string;
  status: "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER";
};

type FactoryMarketingRow = {
  saasId: string;
  verticalId: string | null;
  currentPackTier: string | null;
};

type FactoryAgentRow = {
  id: string;
  saas_id: string;
  estado: string;
  config: string;
  dept_nombre: string;
};

type FactoryItem = {
  saasId: string;
  saasName: string;
  createdAt: string;
  cloudflare?: FactoryProvisioningRow;
  stripe?: FactoryProvisioningRow;
  ai?: FactoryProvisioningRow;
  verticalId?: string | null;
  pricingStatus?: FactoryPricingRow["status"] | null;
  marketingPack?: string | null;
  agentsCount?: number;
  agentsSummary?: string | null;
  departmentsEnabledCount?: number;
  hasCoverageGap?: boolean;
  missingDepartments?: string[];
};

function normalizeFactoryStatus(status?: string | null): { label: string; badge: "ok" | "warn" | "err" } {
  const normalized = status?.toUpperCase() ?? "PENDING";
  if (normalized === "SUCCESS" || normalized === "COMPLETED") return { label: "SUCCESS", badge: "ok" };
  if (normalized === "ERROR" || normalized === "FAILED") return { label: "ERROR", badge: "err" };
  return { label: "PENDING", badge: "warn" };
}

function resolveFactoryStage(params: {
  cloudflare?: FactoryProvisioningRow;
  stripe?: FactoryProvisioningRow;
  ai?: FactoryProvisioningRow;
}): "IDEA" | "BLUEPRINT" | "PROVISIONING" | "ONLINE" {
  const statuses = [params.cloudflare?.status, params.stripe?.status, params.ai?.status].filter(Boolean);
  if (statuses.length === 0) return "IDEA";
  if (statuses.every((status) => status?.toUpperCase() === "SUCCESS")) return "ONLINE";
  if (statuses.some((status) => status?.toUpperCase() === "PENDING")) return "PROVISIONING";
  return "BLUEPRINT";
}

function summarizeAgents(items: FactoryAgentRow[]): {
  count: number;
  summary: string | null;
  departmentsEnabledCount: number;
  hasCoverageGap: boolean;
  missingDepartments: string[];
} {
  if (items.length === 0) {
    return {
      count: 0,
      summary: null,
      departmentsEnabledCount: 0,
      hasCoverageGap: true,
      missingDepartments: ["Accounting", "Support"],
    };
  }
  const departmentSummary = new Map<string, string>();
  const departmentsEnabled = new Set<string>();
  items.forEach((item) => {
    let packTier: string | null = null;
    let departmentId: string | null = null;
    try {
      const config = JSON.parse(item.config) as { packTier?: string; departmentId?: string } | null;
      packTier = config?.packTier ?? null;
      departmentId = config?.departmentId ?? null;
    } catch {
      packTier = null;
    }
    const deptKey = departmentId ?? item.dept_nombre;
    if (!departmentSummary.has(deptKey)) {
      departmentSummary.set(deptKey, packTier ?? "");
    }
    if (departmentId) {
      departmentsEnabled.add(departmentId);
    }
  });
  const summary = Array.from(departmentSummary.entries())
    .map(([dept, tier]) => (tier ? `${dept} ${tier}` : dept))
    .join(", ");
  const departmentsEnabledCount = departmentsEnabled.size;
  const missingDepartments: string[] = [];
  if (!departmentsEnabled.has("ACCOUNTING")) missingDepartments.push("Accounting");
  if (!departmentsEnabled.has("SUPPORT")) missingDepartments.push("Support");
  const hasCoverageGap = missingDepartments.length > 0;
  return { count: items.length, summary: summary || null, departmentsEnabledCount, hasCoverageGap, missingDepartments };
}

function resolveHealthBadge(level?: string | null): "ok" | "warn" | "err" {
  if (level === "CRITICAL") return "err";
  if (level === "WARN") return "warn";
  return "ok";
}

function resolveHealthStatusBadge(status?: string | null): "ok" | "warn" | "err" {
  if (status === "CRITICAL") return "err";
  if (status === "WARNING") return "warn";
  return "ok";
}

function resolveActionPriorityBadge(priority?: string | null): "err" | "warn" | "neutral" | "info" {
  if (priority === "CRITICAL") return "err";
  if (priority === "HIGH") return "warn";
  if (priority === "LOW") return "info";
  return "neutral";
}

function resolveActionStatusBadge(status?: string | null): "ok" | "warn" | "err" | "neutral" | "info" {
  if (status === "EXECUTED") return "ok";
  if (status === "OPEN") return "warn";
  if (status === "DISMISSED") return "neutral";
  if (status === "SNOOZED") return "info";
  return "neutral";
}

function resolveDomainStatusBadge(status?: string | null): "ok" | "warn" | "err" | "neutral" {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "active") return "ok";
  if (normalized === "paused") return "neutral";
  if (normalized === "error_check" || normalized === "error" || normalized === "failed") return "err";
  return "warn";
}

function resolveVerificationBadge(status?: string | null): "ok" | "warn" | "err" | "neutral" {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "verified") return "ok";
  if (normalized === "failed") return "err";
  if (normalized === "dns_pending" || normalized === "ssl_pending" || normalized === "routing_check") return "warn";
  return "neutral";
}

function resolveDbHealthBadge(status?: string | null): "ok" | "warn" | "err" | "neutral" {
  if (status === "CRITICAL") return "err";
  if (status === "WARNING") return "warn";
  if (status === "OK") return "ok";
  return "neutral";
}

export default function OwnerPage() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<OwnerPortfolioSnapshot | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [accounting, setAccounting] = useState<{
    totalSaas: number;
    totalSubscriptionMRR: number;
    totalEstimatedMarginPercent?: number;
    baselineLifeMonthly: number;
    baselineWorkMonthly: number;
    basicBaselineMonthly: number;
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
      worstCases: Array<{
        saasId: string;
        saasName: string;
        currentMonthlyPrice: number;
        estimatedVendorCostMonthly: number;
        recommendedMinPriceMonthly: number;
        status: "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER";
      }>;
    };
    pricingStatusBySaas: Record<string, "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER">;
    verticalBreakdown: Array<{ vertical: string; saasCount: number; mrr: number; avgMarginPercent?: number }>;
    taxSummary?: {
      totalVatDueAllSaas: number;
      saasWithHighVat: number;
      saasWithNegativeMargin: number;
    };
    departmentCoverageSummary?: {
      wellCoveredCount: number;
      partialCount: number;
      criticalGapCount: number;
      topGaps: Array<{
        saasId: string;
        saasName: string;
        verticalId: string | null;
        departmentsEnabled: string[];
        packsByDepartment: Record<string, string>;
        status: string;
        gaps: Array<{ departmentId: string; severity: string; reason: string }>;
      }>;
    };
    saasHealthSummary?: {
      total: number;
      good: number;
      warning: number;
      critical: number;
      topCritical: Array<{
        saasId: string;
        saasName: string;
        verticalId: string;
        healthScore: number;
        healthStatus: string;
        pricingStatus: string;
        departmentCoverageStatus: string;
        marketingStatus: string;
        signals: Array<{ kind: string; level: string; message: string }>;
      }>;
      topScaleCandidates: Array<{
        saasId: string;
        saasName: string;
        verticalId: string;
        healthScore: number;
        healthStatus: string;
        pricingStatus: string;
        departmentCoverageStatus: string;
        marketingStatus: string;
        signals: Array<{ kind: string; level: string; message: string }>;
      }>;
      items: Array<{
        saasId: string;
        saasName: string;
        verticalId: string;
        healthScore: number;
        healthStatus: string;
        pricingStatus: string;
        departmentCoverageStatus: string;
        marketingStatus: string;
        signals: Array<{ kind: string; level: string; message: string }>;
      }>;
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
  } | null>(null);
  const [accountingLoading, setAccountingLoading] = useState(true);
  const [accountingError, setAccountingError] = useState<string | null>(null);
  const [growthActions, setGrowthActions] = useState<OwnerGrowthAutopilotAction[]>([]);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [growthError, setGrowthError] = useState<string | null>(null);
  const [actionQueue, setActionQueue] = useState<{
    items: Array<{
      id: string;
      category: string;
      priority: OwnerActionQueuePriority;
      title: string;
      summary: string;
      source: string;
      status: "OPEN" | "EXECUTED" | "DISMISSED" | "SNOOZED";
      saasId?: string;
      saasName?: string;
      verticalId?: string;
    }>;
    stats: {
      total: number;
      byPriority: Record<OwnerActionQueuePriority, number>;
      byCategory: Record<string, number>;
      byStatus: Record<"OPEN" | "EXECUTED" | "DISMISSED" | "SNOOZED", number>;
    };
  } | null>(null);
  const [actionQueueLoading, setActionQueueLoading] = useState(true);
  const [actionQueueError, setActionQueueError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<OwnerActionQueuePriority | "ALL">("ALL");
  const [actionStatusFilter, setActionStatusFilter] = useState<"OPEN" | "HISTORY">("OPEN");
  const [actionQueueUpdatingId, setActionQueueUpdatingId] = useState<string | null>(null);
  const [treasury, setTreasury] = useState<DrakoTreasurySnapshot | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(true);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);
  const [eventsSnapshot, setEventsSnapshot] = useState<{
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
  } | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [dbHealth, setDbHealth] = useState<{
    status: "OK" | "WARNING" | "CRITICAL";
    appliedMigrations: { count: number; ids: string[] };
    missingMigrations: string[];
    driftFindings: Array<{
      type: string;
      table: string;
      column?: string;
      severity: string;
      message: string;
    }>;
  } | null>(null);
  const [dbHealthLoading, setDbHealthLoading] = useState(true);
  const [dbHealthError, setDbHealthError] = useState<string | null>(null);
  const [domains, setDomains] = useState<Array<{
    id: string;
    hostname: string;
    status: string;
    saasId: string;
    saasSlug: string;
    tenantId: string;
    lastError?: string | null;
    verificationStatus?: string | null;
    verificationReason?: string | null;
    retryCount?: number;
    updatedAt?: string;
    lastRoutingEvent?: {
      type: string;
      severity: string;
      createdAt: string;
      correlationId: string;
    } | null;
  }>>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [domainsUpdating, setDomainsUpdating] = useState(false);
  const [factoryItems, setFactoryItems] = useState<FactoryItem[]>([]);
  const [factoryLoading, setFactoryLoading] = useState(true);
  const [factoryError, setFactoryError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [healthFilter, setHealthFilter] = useState<"ALL" | "WARN_ONLY">("ALL");

  const healthItems = accounting?.saasHealthSummary?.items ?? [];
  const healthBySaasId = new Map(healthItems.map((item) => [item.saasId, item]));
  const healthOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, GOOD: 2 };
  const sortedHealthItems = healthItems
    .slice()
    .sort((a, b) => (healthOrder[a.healthStatus] ?? 3) - (healthOrder[b.healthStatus] ?? 3) || a.healthScore - b.healthScore);
  const filteredHealthItems = sortedHealthItems.filter((item) => {
    if (healthFilter === "ALL") return true;
    return item.healthStatus === "WARNING" || item.healthStatus === "CRITICAL";
  });
  const MAX_HEALTH_ROWS = 20;
  const healthTableItems = healthFilter === "ALL" ? filteredHealthItems.slice(0, MAX_HEALTH_ROWS) : filteredHealthItems;
  const dbHealthChecklist = (() => {
    if (!dbHealth) return "";
    const lines = [
      `DB Health: ${dbHealth.status}`,
      `Applied migrations: ${dbHealth.appliedMigrations.count}`,
    ];
    if (dbHealth.missingMigrations.length > 0) {
      lines.push("Missing migrations:");
      lines.push(...dbHealth.missingMigrations.map((id) => `- ${id}`));
    }
    if (dbHealth.driftFindings.length > 0) {
      lines.push("Drift findings:");
      lines.push(
        ...dbHealth.driftFindings.map(
          (finding) =>
            `- ${finding.table}${finding.column ? `.${finding.column}` : ""}: ${finding.message}`,
        ),
      );
    }
    return lines.join("\n");
  })();

  const loadOwner = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/owners", { cache: "no-store" });
      const data = (await res.json()) as { items?: Owner[] };
      const current = data.items?.[0] ?? null;
      setOwner(current);
      setName(current?.name ?? "");
      setNif(current?.nif ?? "");
      setAddress(current?.address ?? "");
      setEmail(current?.email ?? "");
      setPhone(current?.phone ?? "");
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar los datos fiscales.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError(null);
    try {
      const res = await fetch("/api/owner/portfolio", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { snapshot?: OwnerPortfolioSnapshot; message?: string } | null;
      setPortfolio(data?.snapshot ?? null);
    } catch (error) {
      setPortfolio(null);
      setPortfolioError(error instanceof Error ? error.message : "No se pudo cargar el portfolio.");
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  const loadAccounting = useCallback(async () => {
    setAccountingLoading(true);
    setAccountingError(null);
    try {
      const res = await fetch("/api/owner/accounting", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { snapshot?: typeof accounting } | null;
      setAccounting(data?.snapshot ?? null);
    } catch (error) {
      setAccounting(null);
      setAccountingError(error instanceof Error ? error.message : "No se pudo cargar el accounting.");
    } finally {
      setAccountingLoading(false);
    }
  }, []);

  const loadGrowthAutopilot = useCallback(async () => {
    setGrowthLoading(true);
    setGrowthError(null);
    try {
      const res = await fetch("/api/owner/autopilot", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { actions?: OwnerGrowthAutopilotAction[] } | null;
      setGrowthActions(data?.actions ?? []);
    } catch (error) {
      setGrowthActions([]);
      setGrowthError(error instanceof Error ? error.message : "No se pudo cargar el autopilot.");
    } finally {
      setGrowthLoading(false);
    }
  }, []);

  const loadActionQueue = useCallback(async () => {
    setActionQueueLoading(true);
    setActionQueueError(null);
    try {
      const res = await fetch("/api/owner/actions", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { snapshot?: typeof actionQueue } | null;
      setActionQueue(data?.snapshot ?? null);
    } catch (error) {
      setActionQueue(null);
      setActionQueueError(error instanceof Error ? error.message : "No se pudo cargar la action queue.");
    } finally {
      setActionQueueLoading(false);
    }
  }, []);

  const loadDomains = useCallback(async () => {
    setDomainsLoading(true);
    setDomainsError(null);
    try {
      const res = await fetch("/api/owner/domains", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { domains?: typeof domains } | null;
      setDomains(data?.domains ?? []);
    } catch (error) {
      setDomains([]);
      setDomainsError(error instanceof Error ? error.message : "No se pudieron cargar los dominios.");
    } finally {
      setDomainsLoading(false);
    }
  }, []);

  const verifyDomains = useCallback(
    async (payload: { scope: "all" | "saas" | "domain"; saasId?: string; domain?: string }) => {
      setDomainsUpdating(true);
      setDomainsError(null);
      try {
        const res = await fetch("/api/owner/domains/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error("No se pudo verificar dominios.");
        }
        await loadDomains();
      } catch (error) {
        console.error(error);
        setDomainsError(error instanceof Error ? error.message : "No se pudo verificar dominios.");
      } finally {
        setDomainsUpdating(false);
      }
    },
    [loadDomains],
  );

  const updateActionQueueStatus = useCallback(
    async (id: string, action: "EXECUTE" | "DISMISS" | "SNOOZE") => {
      setActionQueueUpdatingId(id);
      try {
        const endpoint =
          action === "EXECUTE"
            ? `/api/owner/actions/${id}/execute`
            : action === "DISMISS"
              ? `/api/owner/actions/${id}/dismiss`
              : `/api/owner/actions/${id}/snooze`;
        const body =
          action === "SNOOZE"
            ? { snoozedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
            : null;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          throw new Error("No se pudo actualizar la accion.");
        }
        await loadActionQueue();
      } catch (error) {
        console.error(error);
        setActionQueueError(error instanceof Error ? error.message : "No se pudo actualizar la accion.");
      } finally {
        setActionQueueUpdatingId((current) => (current === id ? null : current));
      }
    },
    [loadActionQueue],
  );

  const loadTreasury = useCallback(async () => {
    setTreasuryLoading(true);
    setTreasuryError(null);
    try {
      const res = await fetch("/api/owner/treasury/snapshot", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { snapshot?: DrakoTreasurySnapshot } | null;
      setTreasury(data?.snapshot ?? null);
    } catch (error) {
      setTreasury(null);
      setTreasuryError(error instanceof Error ? error.message : "No se pudo cargar la tesoreria.");
    } finally {
      setTreasuryLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await fetch("/api/owner/events", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as {
        criticalEvents?: Array<{
          type: string;
          severity: string;
          message: string;
          created_at: string;
          correlation_id: string;
          saas_slug?: string | null;
        }>;
        rollups?: Array<{
          day: string;
          saas_slug?: string | null;
          type: string;
          severity: string;
          count: number;
          first_seen_at: string;
          last_seen_at: string;
        }>;
      } | null;
      setEventsSnapshot({
        criticalEvents:
          data?.criticalEvents?.map((item) => ({
            type: item.type,
            severity: item.severity,
            message: item.message,
            createdAt: item.created_at,
            correlationId: item.correlation_id,
            saasSlug: item.saas_slug ?? null,
          })) ?? [],
        rollups:
          data?.rollups?.map((item) => ({
            day: item.day,
            saasSlug: item.saas_slug ?? null,
            type: item.type,
            severity: item.severity,
            count: item.count,
            firstSeenAt: item.first_seen_at,
            lastSeenAt: item.last_seen_at,
          })) ?? [],
      });
    } catch (error) {
      setEventsSnapshot(null);
      setEventsError(error instanceof Error ? error.message : "No se pudieron cargar los eventos.");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadDbHealth = useCallback(async () => {
    setDbHealthLoading(true);
    setDbHealthError(null);
    try {
      const res = await fetch("/api/owner/db/health", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("No se pudo cargar DB health.");
      }
      const data = (await res.json().catch(() => null)) as { snapshot?: typeof dbHealth } | null;
      setDbHealth(data?.snapshot ?? null);
    } catch (error) {
      setDbHealth(null);
      setDbHealthError(error instanceof Error ? error.message : "No se pudo cargar DB health.");
    } finally {
      setDbHealthLoading(false);
    }
  }, []);

  const loadFactory = useCallback(async () => {
    setFactoryLoading(true);
    setFactoryError(null);
    try {
      const [saasRes, provRes, pricingRes, marketingRes] = await Promise.all([
        fetch("/api/saas", { cache: "no-store" }),
        fetch("/api/provisioning", { cache: "no-store" }),
        fetch("/api/owner/saas-pricing/recommendations", { cache: "no-store" }),
        fetch("/api/owner/marketing", { cache: "no-store" }),
      ]);
      const saasData = (await saasRes.json().catch(() => null)) as { items?: FactorySaasRow[] } | null;
      const provData = (await provRes.json().catch(() => null)) as { items?: FactoryProvisioningRow[] } | null;
      const pricingData = pricingRes.ok
        ? ((await pricingRes.json().catch(() => null)) as { items?: FactoryPricingRow[] } | null)
        : null;
      const marketingData = marketingRes.ok
        ? ((await marketingRes.json().catch(() => null)) as { snapshot?: { items?: FactoryMarketingRow[] } } | null)
        : null;
      const saasItems = (saasData?.items ?? []).slice(0, 6);
      const provisioningItems = provData?.items ?? [];
      const pricingItems = pricingData?.items ?? [];
      const marketingItems = marketingData?.snapshot?.items ?? [];
      const pricingBySaas = new Map(pricingItems.map((item) => [item.saasId, item.status]));
      const marketingBySaas = new Map(marketingItems.map((item) => [item.saasId, item]));
      const mapped = saasItems.map((saas) => {
        const rows = provisioningItems.filter((item) => item.saas_id === saas.id);
        const getLatest = (step: string) => rows.find((row) => row.step === step);
        const marketing = marketingBySaas.get(saas.id);
        return {
          saasId: saas.id,
          saasName: saas.name,
          createdAt: saas.created_at,
          cloudflare: getLatest("cloudflare"),
          stripe: getLatest("stripe"),
          ai: getLatest("ai"),
          verticalId: marketing?.verticalId ?? null,
          marketingPack: marketing?.currentPackTier ?? null,
          pricingStatus: pricingBySaas.get(saas.id) ?? null,
        };
      });
      const agentSummaries = await Promise.all(
        saasItems.map(async (saas) => {
          try {
            const res = await fetch(`/api/saas-agents?saas_id=${encodeURIComponent(saas.id)}`);
            if (!res.ok) return { saasId: saas.id, items: [] as FactoryAgentRow[] };
            const data = (await res.json().catch(() => null)) as { items?: FactoryAgentRow[] } | null;
            return { saasId: saas.id, items: data?.items ?? [] };
          } catch {
            return { saasId: saas.id, items: [] as FactoryAgentRow[] };
          }
        }),
      );
      const agentSummaryBySaas = new Map(
        agentSummaries.map((entry) => {
          const summary = summarizeAgents(entry.items);
          return [entry.saasId, summary];
        }),
      );
      setFactoryItems(
        mapped.map((item) => {
          const summary = agentSummaryBySaas.get(item.saasId);
          return {
            ...item,
            agentsCount: summary?.count ?? 0,
            agentsSummary: summary?.summary ?? null,
            departmentsEnabledCount: summary?.departmentsEnabledCount ?? 0,
            hasCoverageGap: summary?.hasCoverageGap ?? false,
            missingDepartments: summary?.missingDepartments ?? [],
          };
        }),
      );
    } catch (error) {
      console.error(error);
      setFactoryError("No se pudo cargar el estado de SaaS Factory.");
      setFactoryItems([]);
    } finally {
      setFactoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOwner();
    void loadPortfolio();
    void loadAccounting();
    void loadGrowthAutopilot();
    void loadActionQueue();
    void loadTreasury();
    void loadFactory();
    void loadDomains();
    void loadEvents();
    void loadDbHealth();
  }, [
    loadOwner,
    loadPortfolio,
    loadAccounting,
    loadGrowthAutopilot,
    loadActionQueue,
    loadTreasury,
    loadFactory,
    loadDomains,
    loadEvents,
    loadDbHealth,
  ]);

  const criticalActions = growthActions.filter((action) => action.severity === "CRITICAL");
  const warningActions = growthActions.filter((action) => action.severity === "WARNING");
  const infoActions = growthActions.filter((action) => action.severity === "INFO");
  const actionPriorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  const actionItems = actionQueue?.items ?? [];
  const statusFilteredItems =
    actionStatusFilter === "OPEN"
      ? actionItems.filter((item) => item.status === "OPEN")
      : actionItems.filter((item) => item.status !== "OPEN");
  const filteredActionItems = statusFilteredItems.filter((item) =>
    actionFilter === "ALL" ? true : item.priority === actionFilter,
  );
  const visibleActionItems = filteredActionItems
    .slice()
    .sort(
      (a, b) =>
        (actionPriorityOrder[a.priority] ?? 4) - (actionPriorityOrder[b.priority] ?? 4) ||
        (a.saasName ?? "").localeCompare(b.saasName ?? "") ||
        a.title.localeCompare(b.title),
    );
  const topCriticalActions = actionItems.filter((item) => item.priority === "CRITICAL").slice(0, 5);

  const resolveTargetLabel = useCallback(
    (action: OwnerGrowthAutopilotAction) => {
      if (action.target.type === "SAAS" && action.target.saasId) {
        const row = accounting?.rows.find((item) => item.saasId === action.target.saasId);
        return row ? `SaaS: ${row.saasName}` : `SaaS: ${action.target.saasId}`;
      }
      if (action.target.type === "VERTICAL" && action.target.vertical) {
        return `Vertical: ${action.target.vertical}`;
      }
      if (action.target.type === "PACK" && action.target.packId) {
        const pack = SAAS_PACK_DEFINITIONS.find((item) => item.id === action.target.packId);
        return `Pack: ${pack?.label ?? action.target.packId}`;
      }
      if (action.target.type === "OWNER") {
        return "Owner baseline";
      }
      return "Portfolio";
    },
    [accounting?.rows],
  );

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setMessage("El nombre o razón social es obligatorio.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        id: owner?.id,
        name: name.trim(),
        nif: nif || null,
        address: address || null,
        email: email || null,
        phone: phone || null,
        country: owner?.country ?? "Spain",
        city: owner?.city ?? "Barcelona",
      };
      const method = owner ? "PATCH" : "POST";
      const res = await fetch("/api/owners", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; item?: Owner; error?: string };
      if (data.ok === false) {
        throw new Error(data.error ?? "No se pudo guardar el owner");
      }
      if (data.item) {
        setOwner(data.item);
        setName(data.item.name);
        setNif(data.item.nif ?? "");
        setAddress(data.item.address ?? "");
        setEmail(data.item.email ?? "");
        setPhone(data.item.phone ?? "");
      }
      setMessage("Datos fiscales guardados correctamente.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Error al guardar los datos");
    } finally {
      setSaving(false);
    }
  }, [address, email, name, nif, owner, phone]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Administración</p>
        <h1 className="text-3xl font-semibold">Owner Portfolio Control Tower</h1>
        <p className="text-sm text-[var(--muted)]">Visión agregada de todos tus SaaS y sus KPIs.</p>
      </div>

      <Card tone="glass" title="Catálogo de SaaS" subtitle="Activa nuevos verticales desde Campamento Base">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">
            ¿Necesitas otro SaaS (clínica, salón, grooming, lavandería)? Activa uno nuevo desde el catálogo.
          </p>
          <Link href="/owner/catalog">
            <Button variant="outline">Abrir catálogo</Button>
          </Link>
        </div>
      </Card>

      <Card tone="glass" title="Resumen global" subtitle="Indicadores combinados">
        {portfolioLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando portfolio...</p>
        ) : portfolioError ? (
          <p className="text-sm text-red-300">{portfolioError}</p>
        ) : !portfolio ? (
          <EmptyState title="Sin portfolio" subtitle="No hay SaaS asociados todavía." />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--muted)]">Total SaaS</p>
              <p className="text-xl font-semibold">{portfolio.totalSaas}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Margen medio</p>
              <p className="text-xl font-semibold">
                {typeof portfolio.highLevel.totalMarginAverage === "number"
                  ? `${portfolio.highLevel.totalMarginAverage.toFixed(0)}%`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Empleados</p>
              <p className="text-xl font-semibold">{portfolio.highLevel.totalEmployees ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Tareas abiertas</p>
              <p className="text-xl font-semibold">{portfolio.highLevel.totalOpenTasks ?? "—"}</p>
            </div>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Eventos del Imperio" subtitle="Criticos recientes + rollups diarios">
        {eventsLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando eventos...</p>
        ) : eventsError ? (
          <p className="text-sm text-red-300">{eventsError}</p>
        ) : !eventsSnapshot ? (
          <EmptyState title="Sin eventos" subtitle="No hay eventos disponibles todavia." />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Ultimos CRITICAL/SECURITY</p>
              {eventsSnapshot.criticalEvents.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No hay eventos criticos recientes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="modern text-sm" aria-label="Eventos criticos">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Severidad</th>
                        <th>SaaS</th>
                        <th>Mensaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventsSnapshot.criticalEvents.map((event) => (
                        <tr key={`${event.correlationId}-${event.createdAt}`}>
                          <td className="text-xs text-[var(--muted)]">{new Date(event.createdAt).toLocaleString()}</td>
                          <td>{event.type}</td>
                          <td>
                            <Badge variant="err">{event.severity}</Badge>
                          </td>
                          <td className="text-xs text-[var(--muted)]">{event.saasSlug ?? "—"}</td>
                          <td className="text-xs text-[var(--muted)]">{event.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Rollups diarios (14 dias)</p>
              {eventsSnapshot.rollups.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Sin rollups en los ultimos dias.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="modern text-sm" aria-label="Rollups diarios">
                    <thead>
                      <tr>
                        <th>Dia</th>
                        <th>Severidad</th>
                        <th>Tipo</th>
                        <th>SaaS</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventsSnapshot.rollups.map((rollup) => (
                        <tr key={`${rollup.day}-${rollup.type}-${rollup.severity}-${rollup.saasSlug ?? "global"}`}>
                          <td className="text-xs text-[var(--muted)]">{rollup.day}</td>
                          <td>
                            <Badge variant={resolveHealthBadge(rollup.severity)}>{rollup.severity}</Badge>
                          </td>
                          <td>{rollup.type}</td>
                          <td className="text-xs text-[var(--muted)]">{rollup.saasSlug ?? "global"}</td>
                          <td>{rollup.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card tone="glass" title="DB Health" subtitle="Estado de migraciones + drift">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">
            Verifica que D1 está al día antes de ejecutar cargas productivas.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadDbHealth} disabled={dbHealthLoading}>
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!dbHealthChecklist) return;
                void navigator?.clipboard?.writeText(dbHealthChecklist);
              }}
              disabled={!dbHealthChecklist}
            >
              Copy checklist
            </Button>
          </div>
        </div>
        <div className="mt-4">
          {dbHealthLoading ? (
            <p className="text-sm text-[var(--muted)]">Cargando DB health...</p>
          ) : dbHealthError ? (
            <p className="text-sm text-red-300">{dbHealthError}</p>
          ) : !dbHealth ? (
            <EmptyState title="Sin DB health" subtitle="No hay datos disponibles." />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={resolveDbHealthBadge(dbHealth.status)}>{dbHealth.status}</Badge>
                <span className="text-xs text-[var(--muted)]">
                  Applied migrations: {dbHealth.appliedMigrations.count}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  Missing: {dbHealth.missingMigrations.length}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  Drift findings: {dbHealth.driftFindings.length}
                </span>
              </div>
              {dbHealth.missingMigrations.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Migraciones faltantes</p>
                  <ul className="mt-2 space-y-1 text-sm text-red-200">
                    {dbHealth.missingMigrations.slice(0, 5).map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </div>
              )}
              {dbHealth.driftFindings.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Drift detectado</p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-200">
                    {dbHealth.driftFindings.slice(0, 5).map((finding, index) => (
                      <li key={`${finding.table}-${finding.column ?? "table"}-${index}`}>
                        {finding.table}
                        {finding.column ? `.${finding.column}` : ""}: {finding.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card tone="glass" title="Campamento Base — SaaS Factory" subtitle="Ultimos SaaS y estado de wiring">
        {factoryLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando SaaS Factory...</p>
        ) : factoryError ? (
          <p className="text-sm text-red-300">{factoryError}</p>
        ) : factoryItems.length === 0 ? (
          <EmptyState title="Sin SaaS Factory" subtitle="Aun no hay SaaS creados con provisioning." />
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Estado SaaS Factory">
                <thead>
                  <tr>
                    <th>SaaS</th>
                    <th>Vertical</th>
                    <th>Estado Factory</th>
                    <th>Pricing</th>
                    <th>Health</th>
                    <th>Marketing</th>
                    <th>Agents</th>
                    <th>Provisioning</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {factoryItems.map((item) => {
                    const cf = normalizeFactoryStatus(item.cloudflare?.status);
                    const stripe = normalizeFactoryStatus(item.stripe?.status);
                    const ai = normalizeFactoryStatus(item.ai?.status);
                    const stage = resolveFactoryStage({
                      cloudflare: item.cloudflare,
                      stripe: item.stripe,
                      ai: item.ai,
                    });
                    const health = healthBySaasId.get(item.saasId);
                    return (
                      <tr key={item.saasId}>
                        <td>
                          <div className="font-semibold">{item.saasName}</div>
                          <div className="text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</div>
                        </td>
                        <td>{item.verticalId ?? "—"}</td>
                        <td>{stage}</td>
                        <td>{item.pricingStatus ?? "—"}</td>
                        <td>
                          {health ? (
                            <Badge variant={resolveHealthStatusBadge(health.healthStatus)}>{health.healthStatus}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{item.marketingPack ?? "—"}</td>
                        <td>
                          {item.agentsSummary
                            ? `${item.agentsCount ?? 0} agents • ${item.agentsSummary}`
                            : item.agentsCount
                              ? `${item.agentsCount} agents`
                              : "—"}
                          {item.hasCoverageGap && item.missingDepartments && item.missingDepartments.length > 0 ? (
                            <span className="text-xs text-amber-200">
                              {" "}
                              (gap: no {item.missingDepartments.join(", ")})
                            </span>
                          ) : null}
                        </td>
                        <td className="space-x-2">
                          <Badge variant={cf.badge}>Cloudflare {cf.label}</Badge>
                          <Badge variant={stripe.badge}>Stripe {stripe.label}</Badge>
                          <Badge variant={ai.badge}>IA {ai.label}</Badge>
                        </td>
                        <td>
                          <Link href={`/saas/${item.saasId}`} className="text-[var(--brand)] font-semibold">
                            Ver SaaS
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span>Accesos rapidos:</span>
              <Link href="/saas/create" className="text-[var(--brand)]">Nuevo SaaS</Link>
              <Link href="/owner" className="text-[var(--brand)]">Pricing</Link>
              <Link href="/owner" className="text-[var(--brand)]">Tesoreria</Link>
              <Link href="/owner" className="text-[var(--brand)]">Marketing</Link>
              <Link href="/owner" className="text-[var(--brand)]">Tax</Link>
            </div>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Dominios del imperio" subtitle="Registro de hostnames activos y estado del routing">
        {domainsLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando dominios...</p>
        ) : domainsError ? (
          <p className="text-sm text-red-300">{domainsError}</p>
        ) : domains.length === 0 ? (
          <EmptyState title="Sin dominios" subtitle="No hay dominios registrados para este tenant." />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button
                size="sm"
                variant="outline"
                disabled={domainsUpdating}
                onClick={() => verifyDomains({ scope: "all" })}
              >
                Verify all pending
              </Button>
              <Button size="sm" variant="outline" disabled={domainsUpdating} onClick={() => loadDomains()}>
                Refresh
              </Button>
            </div>
            <div className="overflow-x-auto">
            <table className="modern text-sm" aria-label="Dominios del imperio">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>SaaS</th>
                  <th>Tenant</th>
                  <th>Status</th>
                  <th>Verificacion</th>
                  <th>Ultimo error</th>
                  <th>Retry</th>
                  <th>Updated</th>
                  <th>Ultimo evento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id}>
                    <td className="font-semibold">{domain.hostname}</td>
                    <td>{domain.saasSlug ?? domain.saasId}</td>
                    <td className="text-xs text-[var(--muted)]">{domain.tenantId}</td>
                    <td>
                      <Badge variant={resolveDomainStatusBadge(domain.status)}>{domain.status.toUpperCase()}</Badge>
                    </td>
                    <td className="text-xs text-[var(--muted)]">
                      <div className="flex flex-col gap-1">
                        <Badge variant={resolveVerificationBadge(domain.verificationStatus)}>
                          {domain.verificationStatus ? domain.verificationStatus.toUpperCase() : "—"}
                        </Badge>
                        {domain.verificationReason ? <span>{domain.verificationReason}</span> : null}
                      </div>
                    </td>
                    <td className="text-xs text-[var(--muted)]">{domain.lastError ?? "—"}</td>
                    <td className="text-xs text-[var(--muted)]">{domain.retryCount ?? 0}</td>
                    <td className="text-xs text-[var(--muted)]">
                      {domain.updatedAt ? new Date(domain.updatedAt).toLocaleString() : "—"}
                    </td>
                    <td className="text-xs text-[var(--muted)]">
                      {domain.lastRoutingEvent
                        ? `${domain.lastRoutingEvent.type} (${domain.lastRoutingEvent.severity})`
                        : "—"}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={domainsUpdating}
                        onClick={() => verifyDomains({ scope: "domain", domain: domain.hostname })}
                      >
                        Verify
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Department coverage" subtitle="Cobertura de departamentos IA por SaaS">
        {accountingLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando coverage...</p>
        ) : accountingError ? (
          <p className="text-sm text-red-300">{accountingError}</p>
        ) : !accounting?.departmentCoverageSummary ? (
          <EmptyState title="Sin coverage" subtitle="No hay datos de cobertura de departamentos." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="ok">WELL</Badge>
                <span>{accounting.departmentCoverageSummary.wellCoveredCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="warn">PARTIAL</Badge>
                <span>{accounting.departmentCoverageSummary.partialCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="err">CRITICAL</Badge>
                <span>{accounting.departmentCoverageSummary.criticalGapCount}</span>
              </div>
            </div>
            {accounting.departmentCoverageSummary.topGaps.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No hay gaps criticos en coverage.</p>
            ) : (
              <div className="space-y-3">
                {accounting.departmentCoverageSummary.topGaps.map((item) => {
                  const gaps = item.gaps.map((gap) => gap.departmentId).join(", ");
                  const departments = item.departmentsEnabled.join(", ");
                  return (
                    <div key={item.saasId} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/60 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[var(--text)]">{item.saasName}</p>
                          <p className="text-xs text-[var(--muted)]">{item.verticalId ?? "OTHER"}</p>
                        </div>
                        <Badge variant={item.status === "CRITICAL_GAP" ? "err" : "warn"}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-[var(--muted)]">Departamentos: {departments || "—"}</p>
                      <p className="text-xs text-amber-200">Gaps: {gaps || "—"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card tone="glass" title="SaaS health & priorities" subtitle="Prioridades por salud combinada">
        {accountingLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando health...</p>
        ) : accountingError ? (
          <p className="text-sm text-red-300">{accountingError}</p>
        ) : !accounting?.saasHealthSummary ? (
          <EmptyState title="Sin health" subtitle="No hay datos de salud disponibles." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-[var(--muted)]">Filtro:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHealthFilter("ALL")}
                  className={`rounded-full border px-3 py-1 transition ${
                    healthFilter === "ALL"
                      ? "border-[var(--brand)]/60 bg-[var(--brand)]/10 text-[var(--brand)]"
                      : "border-[var(--border)]/60 text-[var(--muted)]"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setHealthFilter("WARN_ONLY")}
                  className={`rounded-full border px-3 py-1 transition ${
                    healthFilter === "WARN_ONLY"
                      ? "border-amber-300/60 bg-amber-200/10 text-amber-200"
                      : "border-[var(--border)]/60 text-[var(--muted)]"
                  }`}
                >
                  Solo WARNING/CRITICAL
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="ok">GOOD</Badge>
                <span>{accounting.saasHealthSummary.good}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="warn">WARNING</Badge>
                <span>{accounting.saasHealthSummary.warning}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="err">CRITICAL</Badge>
                <span>{accounting.saasHealthSummary.critical}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span>Total: {accounting.saasHealthSummary.total}</span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase text-[var(--muted)]">Top critical</p>
                {accounting.saasHealthSummary.topCritical.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Sin SaaS criticos.</p>
                ) : (
                  accounting.saasHealthSummary.topCritical.map((item) => {
                    const keySignals = item.signals.filter((signal) => signal.level !== "INFO").slice(0, 2);
                    return (
                      <div key={item.saasId} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/60 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[var(--text)]">{item.saasName}</p>
                            <p className="text-xs text-[var(--muted)]">{item.verticalId}</p>
                          </div>
                          <Badge variant="err">CRITICAL</Badge>
                        </div>
                        <p className="mt-2 text-xs text-[var(--muted)]">Health score: {item.healthScore}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {keySignals.map((signal) => (
                            <Badge key={`${item.saasId}-${signal.kind}`} variant={resolveHealthBadge(signal.level)}>
                              {signal.kind}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase text-[var(--muted)]">Top scale candidates</p>
                {accounting.saasHealthSummary.topScaleCandidates.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Sin candidatos claros.</p>
                ) : (
                  accounting.saasHealthSummary.topScaleCandidates.map((item) => {
                    const keySignals = item.signals.filter((signal) => signal.level !== "INFO").slice(0, 2);
                    return (
                      <div key={item.saasId} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/60 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[var(--text)]">{item.saasName}</p>
                            <p className="text-xs text-[var(--muted)]">{item.verticalId}</p>
                          </div>
                          <Badge variant="ok">GOOD</Badge>
                        </div>
                        <p className="mt-2 text-xs text-[var(--muted)]">Health score: {item.healthScore}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {keySignals.length === 0 ? (
                            <Badge variant="ok">STABLE</Badge>
                          ) : (
                            keySignals.map((signal) => (
                              <Badge key={`${item.saasId}-${signal.kind}`} variant={resolveHealthBadge(signal.level)}>
                                {signal.kind}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase text-[var(--muted)]">Lista de SaaS (salud)</p>
              {healthTableItems.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Sin datos de salud para mostrar.</p>
              ) : (
                <div className="max-h-72 overflow-auto rounded-2xl border border-[var(--border)]/60">
                  <table className="modern text-sm" aria-label="SaaS health list">
                    <thead>
                      <tr>
                        <th>SaaS</th>
                        <th>Vertical</th>
                        <th>Health</th>
                        <th>Senales</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthTableItems.map((item) => {
                        const signalKinds = item.signals
                          .filter((signal) => signal.level !== "INFO")
                          .map((signal) => signal.kind)
                          .join(", ");
                        return (
                          <tr key={item.saasId}>
                            <td className="font-semibold">{item.saasName}</td>
                            <td>{item.verticalId ?? "OTHER"}</td>
                            <td>
                              <Badge variant={resolveHealthStatusBadge(item.healthStatus)}>{item.healthStatus}</Badge>
                            </td>
                            <td>{signalKinds || "—"}</td>
                            <td>{item.healthScore}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Owner Accounting & Strategy Board" subtitle="Ingresos por SaaS + margen estimado">
        {accountingLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando accounting...</p>
        ) : accountingError ? (
          <p className="text-sm text-red-300">{accountingError}</p>
        ) : !accounting ? (
          <EmptyState title="Sin datos" subtitle="No hay datos financieros para este owner." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-[var(--muted)]">SaaS activos</p>
                <p className="text-xl font-semibold">{accounting.totalSaas}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">MRR total</p>
                <p className="text-xl font-semibold">
                  {accounting.totalSubscriptionMRR ? `${accounting.totalSubscriptionMRR.toFixed(0)} €` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Margen estimado</p>
                <p className="text-xl font-semibold">
                  {typeof accounting.totalEstimatedMarginPercent === "number"
                    ? `${accounting.totalEstimatedMarginPercent.toFixed(0)}%`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Vertical más rentable</p>
                <p className="text-xl font-semibold">
                  {accounting.verticalBreakdown
                    .slice()
                    .sort((a, b) => (b.avgMarginPercent ?? 0) - (a.avgMarginPercent ?? 0))[0]?.vertical ?? "—"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Owner accounting">
                <thead>
                  <tr>
                    <th>SaaS</th>
                    <th>Vertical</th>
                    <th>Pack</th>
                    <th>Plan / Precio mes</th>
                    <th>Margen (%)</th>
                    <th>Estado</th>
                    <th>Pricing</th>
                    <th>CTA</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting.rows.map((row) => (
                    <tr key={row.saasId}>
                      <td className="font-semibold">{row.saasName}</td>
                      <td>{row.vertical ?? "OTHER"}</td>
                      <td>{row.packId ?? "—"}</td>
                      <td>
                        {row.planLabel ?? "—"}{" "}
                        {row.subscriptionMonthlyAmount ? `· ${row.subscriptionMonthlyAmount.toFixed(0)} ${row.currency ?? "€"}` : ""}
                      </td>
                      <td>{typeof row.profitabilityMarginPercent === "number" ? `${row.profitabilityMarginPercent.toFixed(0)}%` : "—"}</td>
                      <td>
                        <Badge
                          variant={
                            row.profitabilityStatus === "HEALTHY"
                              ? "ok"
                              : row.profitabilityStatus === "TIGHT"
                                ? "warn"
                                : row.profitabilityStatus === "AT_RISK"
                                  ? "err"
                                  : "neutral"
                          }
                        >
                          {row.profitabilityStatus ?? "UNKNOWN"}
                        </Badge>
                      </td>
                      <td>
                        {accounting.pricingStatusBySaas[row.saasId] ? (
                          <Badge
                            variant={
                              accounting.pricingStatusBySaas[row.saasId] === "UNDERWATER"
                                ? "err"
                                : accounting.pricingStatusBySaas[row.saasId] === "AT_RISK"
                                  ? "warn"
                                  : "ok"
                            }
                          >
                            {accounting.pricingStatusBySaas[row.saasId]}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">N/A</Badge>
                        )}
                      </td>
                      <td>
                        <Link href={`/saas/${row.saasId}`} className="text-[var(--brand)] text-xs font-semibold">
                          Abrir control
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <OwnerVendorSection />

      <Card tone="glass" title="Minimo vital & Campamento Base" subtitle="Cobertura de vida + vendor este mes">
        {accountingLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando baseline...</p>
        ) : accountingError ? (
          <p className="text-sm text-red-300">{accountingError}</p>
        ) : !accounting || accounting.totalBaselineMonthly <= 0 ? (
          <EmptyState title="Sin baseline" subtitle="Configura los gastos base para ver la cobertura mensual." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-[var(--muted)]">Vida</p>
                <p className="text-xl font-semibold">{accounting.baselineLifeMonthly.toFixed(0)} €</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Trabajo</p>
                <p className="text-xl font-semibold">{accounting.baselineWorkMonthly.toFixed(0)} €</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Vendor fijo</p>
                <p className="text-xl font-semibold">{accounting.vendorFixedMonthly.toFixed(0)} €</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Necesitas al mes</p>
                <p className="text-xl font-semibold">{accounting.totalBaselineMonthly.toFixed(0)} €</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Ingresos actuales</span>
                <span>{accounting.totalOwnerRevenueMonthly.toFixed(0)} €</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-[var(--border)]/60">
                <div
                  className="h-2 rounded-full bg-[var(--brand)]"
                  style={{ width: `${Math.min(100, accounting.baselineCoveragePercent * 100).toFixed(0)}%` }}
                />
              </div>
          </div>

          {accounting.baselineCovered ? (
            <p className="text-sm text-[var(--muted)]">Lo basico ya esta cubierto. A partir de aqui todo es margen y crecimiento.</p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Te faltan {accounting.baselineGapAmount.toFixed(0)} € para cubrir lo basico este mes.
            </p>
          )}
          <p className="text-xs text-[var(--muted)]">
            Tesoreria Campamento Base te indica cuanto reservar para impuestos, IA/infra y gastos personales.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Los precios recomendados por SaaS tienen en cuenta tus costes de vendor. Cuando los ingresos superan tu minimo vital + costes fijos,
            esta carta se marca como cubierta.
          </p>
        </div>
      )}
    </Card>

      <Card tone="glass" title="Tesoreria Campamento Base" subtitle="Reservas internas para impuestos, IA/infra y gastos personales">
        {treasuryLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando tesoreria...</p>
        ) : treasuryError ? (
          <p className="text-sm text-red-300">{treasuryError}</p>
        ) : !treasury ? (
          <EmptyState title="Sin tesoreria" subtitle="No hay cuentas de tesoreria configuradas en este entorno." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div>
                <p className="text-xs text-[var(--muted)]">Total cuentas</p>
                <p className="text-xl font-semibold">{treasury.totalBalance.toFixed(0)} €</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Reserva impuestos</p>
                <p className="text-xl font-semibold">{treasury.taxReserveBalance.toFixed(0)} €</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Reserva infra</p>
                <p className="text-xl font-semibold">{treasury.infraReserveBalance.toFixed(0)} €</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Reserva IA</p>
                <p className="text-xl font-semibold">{treasury.aiReserveBalance.toFixed(0)} €</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Gastos personales</p>
                <p className="text-xl font-semibold">{treasury.personalSpendingBalance.toFixed(0)} €</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Treasury reserves">
                <thead>
                  <tr>
                    <th>Reserva</th>
                    <th>Actual</th>
                    <th>Recomendada</th>
                    <th>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold">Impuestos (trimestre)</td>
                    <td>{treasury.taxReserveBalance.toFixed(0)} €</td>
                    <td>{treasury.recommendedTaxReserveThisQuarter.toFixed(0)} €</td>
                    <td>{treasury.taxReserveGap.toFixed(0)} €</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Infra (mes)</td>
                    <td>{treasury.infraReserveBalance.toFixed(0)} €</td>
                    <td>{treasury.recommendedInfraReserveThisMonth.toFixed(0)} €</td>
                    <td>{treasury.infraReserveGap.toFixed(0)} €</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">IA (mes)</td>
                    <td>{treasury.aiReserveBalance.toFixed(0)} €</td>
                    <td>{treasury.recommendedAiReserveThisMonth.toFixed(0)} €</td>
                    <td>{treasury.aiReserveGap.toFixed(0)} €</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm text-[var(--muted)]">
              {treasury.taxReserveGap > 0
                ? `Te faltan ${treasury.taxReserveGap.toFixed(0)} € para la reserva fiscal recomendada.`
                : "Reserva fiscal alineada con la recomendacion actual."}{" "}
              {treasury.personalSpendingBalance > 0
                ? `Tienes ${treasury.personalSpendingBalance.toFixed(0)} € disponibles para gasto personal.`
                : "Sin saldo disponible en gastos personales."}
            </p>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Estado de precios" subtitle="Resumen rapido de salud por SaaS">
        {accountingLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando estado de precios...</p>
        ) : accountingError ? (
          <p className="text-sm text-red-300">{accountingError}</p>
        ) : !accounting ? (
          <p className="text-sm text-[var(--muted)]">No hay datos de precios disponibles.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="err">UNDERWATER</Badge>
                <span>{accounting.saasPricingSummary.numUnderwater}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="warn">AT_RISK</Badge>
                <span>{accounting.saasPricingSummary.numAtRisk}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="ok">ABOVE_TARGET</Badge>
                <span>{accounting.saasPricingSummary.numAboveTarget}</span>
              </div>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {accounting.saasPricingSummary.numUnderwater > 0
                ? "Tienes SaaS que te hacen perder dinero cada mes. Revisa sus precios en “Precios por SaaS”."
                : accounting.saasPricingSummary.numAtRisk > 0
                  ? "Algunos SaaS tienen margen ajustado. Ajusta precio o upsell para proteger el margen."
                  : "Todos tus SaaS estan por encima del minimo recomendado. Campamento Base esta sano a nivel de precios."}
            </p>
          </div>
        )}
      </Card>

      <OwnerMarketingSection />

      <OwnerPricingSection />

      <Card tone="glass" title="Tax & Compliance overview" subtitle="IVA estimado y alertas fiscales (demo)">
        {accountingLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando impuestos...</p>
        ) : accounting?.taxSummary ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--muted)]">IVA estimado total</p>
              <p className="text-xl font-semibold">
                {accounting.taxSummary.totalVatDueAllSaas > 0
                  ? `${accounting.taxSummary.totalVatDueAllSaas.toFixed(0)} €`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">SaaS en riesgo fiscal</p>
              <p className="text-xl font-semibold">{accounting.taxSummary.saasWithHighVat}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Margen negativo</p>
              <p className="text-xl font-semibold">{accounting.taxSummary.saasWithNegativeMargin}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Sin datos fiscales disponibles.</p>
        )}
      </Card>

      <Card tone="glass" title="Campamento Base — Action queue" subtitle="Acciones unificadas por prioridad">
        {actionQueueLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando action queue...</p>
        ) : actionQueueError ? (
          <p className="text-sm text-red-300">{actionQueueError}</p>
        ) : !actionQueue ? (
          <EmptyState title="Sin acciones" subtitle="No hay acciones disponibles ahora mismo." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="err">CRITICAL</Badge>
                <span>{actionQueue.stats.byPriority.CRITICAL ?? 0}</span>
                <Badge variant="warn">HIGH</Badge>
                <span>{actionQueue.stats.byPriority.HIGH ?? 0}</span>
                <Badge variant="neutral">NORMAL</Badge>
                <span>{actionQueue.stats.byPriority.NORMAL ?? 0}</span>
                <Badge variant="info">LOW</Badge>
                <span>{actionQueue.stats.byPriority.LOW ?? 0}</span>
                <span className="text-[var(--muted)]">Total: {actionQueue.stats.total}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActionStatusFilter("OPEN")}
                  className={`rounded-full border px-3 py-1 transition ${
                    actionStatusFilter === "OPEN"
                      ? "border-[var(--brand)]/60 bg-[var(--brand)]/10 text-[var(--brand)]"
                      : "border-[var(--border)]/60 text-[var(--muted)]"
                  }`}
                >
                  OPEN
                </button>
                <button
                  type="button"
                  onClick={() => setActionStatusFilter("HISTORY")}
                  className={`rounded-full border px-3 py-1 transition ${
                    actionStatusFilter === "HISTORY"
                      ? "border-[var(--brand)]/60 bg-[var(--brand)]/10 text-[var(--brand)]"
                      : "border-[var(--border)]/60 text-[var(--muted)]"
                  }`}
                >
                  HISTORY
                </button>
                <button
                  type="button"
                  onClick={() => setActionFilter("ALL")}
                  className={`rounded-full border px-3 py-1 transition ${
                    actionFilter === "ALL"
                      ? "border-[var(--brand)]/60 bg-[var(--brand)]/10 text-[var(--brand)]"
                      : "border-[var(--border)]/60 text-[var(--muted)]"
                  }`}
                >
                  ALL
                </button>
                {(["CRITICAL", "HIGH", "NORMAL", "LOW"] as OwnerActionQueuePriority[]).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setActionFilter(priority)}
                    className={`rounded-full border px-3 py-1 transition ${
                      actionFilter === priority
                        ? "border-[var(--brand)]/60 bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "border-[var(--border)]/60 text-[var(--muted)]"
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>
            {topCriticalActions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[var(--muted)]">Top 5 CRITICAL:</span>
                {topCriticalActions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-full border border-rose-300/40 bg-rose-500/10 px-3 py-1 text-rose-200"
                    onClick={() => {
                      setActionFilter("CRITICAL");
                      setActionStatusFilter("OPEN");
                    }}
                  >
                    {item.saasName ?? item.title}
                  </button>
                ))}
              </div>
            ) : null}
            {visibleActionItems.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No hay acciones para el filtro actual.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="modern text-sm" aria-label="Action queue">
                  <thead>
                    <tr>
                      <th>Prioridad</th>
                      <th>SaaS</th>
                      <th>Categoria</th>
                      <th>Status</th>
                      <th>Resumen</th>
                      <th>Origen</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleActionItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Badge variant={resolveActionPriorityBadge(item.priority)}>{item.priority}</Badge>
                        </td>
                        <td>
                          <div className="font-semibold">{item.saasName ?? "—"}</div>
                          <div className="text-xs text-[var(--muted)]">{item.verticalId ?? "—"}</div>
                        </td>
                        <td>{item.category}</td>
                        <td>
                          <Badge variant={resolveActionStatusBadge(item.status)}>{item.status}</Badge>
                        </td>
                        <td className="max-w-[360px]">
                          <div className="text-xs text-[var(--muted)]">{item.title}</div>
                          <div className="text-xs">{item.summary}</div>
                        </td>
                        <td className="text-xs text-[var(--muted)]">{item.source}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionQueueUpdatingId === item.id || item.status !== "OPEN"}
                              onClick={() => updateActionQueueStatus(item.id, "EXECUTE")}
                            >
                              Execute
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionQueueUpdatingId === item.id || item.status !== "OPEN"}
                              onClick={() => updateActionQueueStatus(item.id, "DISMISS")}
                            >
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionQueueUpdatingId === item.id || item.status !== "OPEN"}
                              onClick={() => updateActionQueueStatus(item.id, "SNOOZE")}
                            >
                              Snooze +7d
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card tone="glass" title="Owner Growth Autopilot — Daily Playbook" subtitle="Acciones prioritarias para crecimiento y riesgo">
        {growthLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando autopilot...</p>
        ) : growthError ? (
          <p className="text-sm text-red-300">{growthError}</p>
        ) : growthActions.length === 0 ? (
          <EmptyState title="Sin acciones urgentes" subtitle="El portfolio está estable por ahora." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <Badge variant="err">CRITICAL</Badge>
              <span>{criticalActions.length}</span>
              <Badge variant="warn">WARNING</Badge>
              <span>{warningActions.length}</span>
              <Badge variant="neutral">INFO</Badge>
              <span>{infoActions.length}</span>
            </div>

            {[{ label: "CRITICAL", items: criticalActions }, { label: "WARNING", items: warningActions }, { label: "INFO", items: infoActions }].map(
              (group) =>
                group.items.length > 0 ? (
                  <div key={group.label} className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">{group.label}</p>
                    <div className="space-y-3">
                      {group.items.map((action) => (
                        <div key={action.id} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[var(--text)]">{action.title}</p>
                              <p className="text-xs text-[var(--muted)]">{action.description}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                                <Badge variant="neutral">{action.category}</Badge>
                                <span>{resolveTargetLabel(action)}</span>
                              </div>
                            </div>
                            {action.target.type === "SAAS" && action.target.saasId ? (
                              <Link href={`/saas/${action.target.saasId}`}>
                                <Button size="sm" variant="outline">Abrir SaaS</Button>
                              </Link>
                            ) : (
                              <Link href="/owner/catalog">
                                <Button size="sm" variant="outline">Ver catálogo</Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null,
            )}
          </div>
        )}
      </Card>

      <OwnerTasksBoard />

      <Card tone="glass" title="WhatsApp con Campamento Base" subtitle="Comandos para el platform owner (demo)">
        <div className="grid gap-3 md:grid-cols-2 text-xs text-[var(--muted)]">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[var(--text)]">Comandos sugeridos</p>
            <ul className="space-y-1">
              <li>• resumen portfolio</li>
              <li>• tareas hoy</li>
              <li>• riesgos</li>
              <li>• resumen impuestos</li>
              <li>• packs recomendados</li>
            </ul>
          </div>
          <p>
            Este flujo usa el número del platform owner y responde con métricas agregadas del portfolio. En producción se mapeará
            al número real de Campamento Base.
          </p>
        </div>
      </Card>

      <Card tone="glass" title="SaaS del portfolio" subtitle="Estado y KPIs por negocio">
        {portfolioLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando SaaS...</p>
        ) : !portfolio || portfolio.saas.length === 0 ? (
          <EmptyState title="Sin SaaS" subtitle="Asocia SaaS a clientes para ver el portfolio." />
        ) : (
          <div className="overflow-x-auto">
            <table className="modern text-sm" aria-label="Portfolio SaaS">
              <thead>
                <tr>
                  <th>SaaS</th>
                  <th>Pack</th>
                  <th>Margen</th>
                  <th>Fairness</th>
                  <th>ROI empleados</th>
                  <th>Social ROI</th>
                  <th>Autopilot</th>
                  <th>CTA</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.saas.map((item) => (
                  <tr key={item.saasId}>
                    <td className="font-semibold">{item.name}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{item.verticalPack?.label ?? "—"}</span>
                        {item.recommendedPackId && item.recommendedPackId === item.verticalPack?.id && (
                          <Badge variant="info">Recommended pack</Badge>
                        )}
                        {item.recommendedPackId && item.recommendedPackId !== item.verticalPack?.id && (
                          <Badge variant="neutral">
                            Recomendado: {SAAS_PACK_DEFINITIONS.find((pack) => pack.id === item.recommendedPackId)?.label ?? item.recommendedPackId}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td>{typeof item.keyMetrics.marginPercent === "number" ? `${item.keyMetrics.marginPercent.toFixed(0)}%` : "—"}</td>
                    <td>
                      <Badge
                        variant={
                          item.keyMetrics.hrFairnessStatus === "CRITICAL"
                            ? "err"
                            : item.keyMetrics.hrFairnessStatus === "WARNING"
                              ? "warn"
                              : "ok"
                        }
                      >
                        {item.keyMetrics.hrFairnessStatus ?? "—"}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        variant={
                          item.keyMetrics.employeesRoiStatus === "TIGHT"
                            ? "warn"
                            : item.keyMetrics.employeesRoiStatus === "LOW_ACTIVITY"
                              ? "neutral"
                              : "ok"
                        }
                      >
                        {item.keyMetrics.employeesRoiStatus ?? "—"}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        variant={
                          item.keyMetrics.socialRoiStatus === "GOOD"
                            ? "ok"
                            : item.keyMetrics.socialRoiStatus === "POOR"
                              ? "err"
                              : "neutral"
                        }
                      >
                        {item.keyMetrics.socialRoiStatus ?? "—"}
                      </Badge>
                    </td>
                    <td>
                      <span className="text-xs text-[var(--muted)]">
                        {item.autopilotSummary?.criticalActions ?? 0} / {item.autopilotSummary?.warningActions ?? 0} /{" "}
                        {item.autopilotSummary?.suggestionActions ?? 0}
                      </span>
                    </td>
                    <td>
                      <Link href={`/saas/${item.saasId}`} className="text-[var(--brand)] text-xs font-semibold">
                        Abrir panel
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Acciones rápidas" subtitle="Atajos para portfolio">
        {!portfolio || portfolio.saas.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No hay SaaS asociados.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link href={`/saas/${portfolio.saas[0].saasId}#tasks`}>
              <Button size="sm" variant="outline">Ver tareas abiertas</Button>
            </Link>
            <Link href={`/saas/${portfolio.saas[0].saasId}#packs`}>
              <Button size="sm" variant="outline">Ir a packs/blueprint</Button>
            </Link>
          </div>
        )}
      </Card>

      <Card tone="glass" title="Datos fiscales" subtitle="Información usada en facturación">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Cargando datos...</p>
        ) : (
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(evt) => {
              evt.preventDefault();
              void handleSave();
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Nombre / razón social</span>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="DRĀKO Systems" required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">NIF / CIF</span>
              <TextInput value={nif} onChange={(e) => setNif(e.target.value)} placeholder="B12345678" />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-[var(--muted)]">Dirección fiscal</span>
              <TextArea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección completa" rows={3} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Email de facturación</span>
              <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@drako.systems" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Teléfono</span>
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
            </label>
            <div className="md:col-span-2 flex items-center justify-between">
              <span className="text-sm text-[var(--muted)]">
                {message ?? "Estos datos se usarán en la facturación generada desde DRĀKO BASE."}
              </span>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {!loading && !owner && (
        <EmptyState
          title="Sin datos registrados"
          subtitle="Completa el formulario para crear la entidad principal"
        />
      )}
    </div>
  );
}
