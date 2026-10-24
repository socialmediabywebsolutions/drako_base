/**
 * snapshot-db.ts
 *
 * Builds a CampamentoBaseSnapshot reading DB-direct lib functions.
 * - Zero HTTP calls
 * - Zero cookie dependency
 * - Safe fallbacks for every source
 * - Reusable by any conversational orchestrator: workers, agents, future SaaS
 *
 * Consumers:
 *   - conversation-router (campamento-base handler)
 *   - future: Mentoría orchestrator, SocialFlow agent, factory-generated SaaS
 */
import { queryAll, queryOne } from "@/lib/db";
import { buildOwnerAccountingSnapshot } from "@/lib/owner/accounting";
import { getCampoBaseSocialAutomationStatus } from "@/lib/campamento-base/socialflow-control-plane-service";
import { listOperatorGovernanceView } from "@/lib/ops/operator-governance-view";
import { getDemoOwner } from "@/lib/admin/demo-data";
import type {
  CampamentoBaseSnapshot,
  CriticalEvent,
  EventRollup,
  GovernanceSummary,
  Growth,
  Growth30WithSeries,
  SaasRow,
  SnapshotKpis,
  SocialflowSummary,
} from "./types";

export type SnapshotDbOptions = {
  tenantId: string;
  windowDays?: number;
};

// ── Pure computation helpers ──────────────────────────────────────────────────
// Intentionally NOT imported from snapshot.ts to preserve full decoupling.
// These are pure functions: no side effects, no network, no DB.

function computeKpis(accounting: {
  totalSubscriptionMRR?: number;
  totalSaas?: number;
  vendorFixedMonthly?: number;
} | null): SnapshotKpis {
  const totalMRR = Number(accounting?.totalSubscriptionMRR ?? 0);
  const totalSaas = Number(accounting?.totalSaas ?? 0);
  const vendorFixed = Number(accounting?.vendorFixedMonthly ?? 0);
  const approxMarginMonthly = Math.max(0, totalMRR - vendorFixed);
  const approxMarginRate = totalMRR > 0 ? approxMarginMonthly / totalMRR : 0;
  return { totalMRR, totalSaas, vendorFixedMonthly: vendorFixed, approxMarginMonthly, approxMarginRate };
}

function computeGrowth(rollups: EventRollup[], window: number): Growth {
  const byDay: Record<string, number> = {};
  for (const r of rollups) byDay[r.day] = (byDay[r.day] ?? 0) + r.count;
  const days = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));
  const lastN = days.slice(0, window);
  const prevN = days.slice(window, window * 2);
  const sum = (arr: string[]) => arr.reduce((acc, d) => acc + (byDay[d] ?? 0), 0);
  const current = sum(lastN);
  const previous = sum(prevN);
  const delta = current - previous;
  return { current, previous, delta, rate: previous > 0 ? delta / previous : current > 0 ? 1 : 0 };
}

function computeGrowth30WithSeries(rollups: EventRollup[]): Growth30WithSeries {
  const base = computeGrowth(rollups, 30);
  const byDay: Record<string, number> = {};
  for (const r of rollups) byDay[r.day] = (byDay[r.day] ?? 0) + r.count;
  const last30 = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1)).slice(0, 30);
  return { ...base, series: last30.map((d) => ({ day: d, total: byDay[d] ?? 0 })) };
}

function deriveOpsFromEvents(
  rollups: EventRollup[],
  criticalEvents: CriticalEvent[],
): Record<string, "CRITICAL" | "WARNING"> {
  const critical = new Set<string>();
  const warning = new Set<string>();
  for (const e of criticalEvents) {
    const slug = (e.saasSlug ?? "").toString();
    if (!slug) continue;
    if (e.severity.toUpperCase().includes("CRITICAL")) critical.add(slug);
    else if (e.severity.toUpperCase().includes("WARN")) warning.add(slug);
  }
  for (const r of rollups) {
    const slug = (r.saasSlug ?? "").toString();
    if (!slug) continue;
    if (r.severity.toUpperCase().includes("CRITICAL") && r.count > 0) critical.add(slug);
    else if (r.severity.toUpperCase().includes("WARN") && r.count > 0) warning.add(slug);
  }
  const map: Record<string, "CRITICAL" | "WARNING"> = {};
  for (const slug of new Set([...critical, ...warning])) {
    map[slug] = critical.has(slug) ? "CRITICAL" : "WARNING";
  }
  return map;
}

// ── Raw DB row types ──────────────────────────────────────────────────────────

type RawCriticalEventRow = {
  type: string;
  severity: string;
  message: string;
  created_at: string;
  correlation_id: string;
  saas_slug: string | null;
};

type RawRollupRow = {
  day: string;
  saas_slug: string | null;
  type: string;
  severity: string;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
};

// ── Main exported function ────────────────────────────────────────────────────

export async function buildCampamentoBaseSnapshotFromDb(
  opts: SnapshotDbOptions,
): Promise<CampamentoBaseSnapshot> {
  const { tenantId, windowDays = 14 } = opts;

  // 1. Resolve owner (required by accounting snapshot)
  // Reuse the same logic as runWhatsappAutomation to avoid drift
  const ownerRows = await queryAll<{ id: string }>(
    "SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
    tenantId,
  );
  const ownerId = ownerRows[0]?.id ?? getDemoOwner(tenantId)?.id;
  if (!ownerId) {
    throw new Error(`No owner found for tenant ${tenantId}`);
  }

  // 2. Accounting snapshot — direct lib call, no HTTP, no cookies
  type Accounting = Awaited<ReturnType<typeof buildOwnerAccountingSnapshot>>;
  let accounting: Accounting | null = null;
  if (ownerId) {
    try {
      accounting = await buildOwnerAccountingSnapshot({ tenantId, ownerId });
    } catch (err) {
      console.warn("[snapshot-db] accounting fallback", (err as Error).message);
    }
  }

  const kpis = computeKpis(accounting);

  // 3. Events — direct DB queries, same tables as /api/operator/events
  let criticalEvents: CriticalEvent[] = [];
  try {
    const raw = await queryAll<RawCriticalEventRow>(
      `SELECT e.type, e.severity, e.message, e.created_at, e.correlation_id,
              s.slug AS saas_slug
       FROM campamento_events e
       LEFT JOIN saas s ON s.id = e.saas_id AND s.tenant_id = e.tenant_id
       WHERE e.tenant_id = ?
         AND (e.severity = 'CRITICAL' OR e.type LIKE 'security.%')
       ORDER BY e.created_at DESC
       LIMIT 20`,
      tenantId,
    );
    criticalEvents = raw.map((e) => ({
      type: String(e.type),
      severity: String(e.severity),
      message: String(e.message ?? ""),
      createdAt: String(e.created_at),
      correlationId: String(e.correlation_id ?? ""),
      saasSlug: e.saas_slug ?? null,
    }));
  } catch (err) {
    console.warn("[snapshot-db] critical-events fallback", (err as Error).message);
  }

  let rollups: EventRollup[] = [];
  const dayCutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  try {
    const raw = await queryAll<RawRollupRow>(
      `SELECT day, saas_slug, type, severity, count, first_seen_at, last_seen_at
       FROM campamento_event_rollups_daily
       WHERE tenant_id = ? AND day >= ?
       ORDER BY day DESC, severity DESC`,
      tenantId,
      dayCutoff,
    );
    rollups = raw.map((r) => ({
      day: String(r.day),
      saasSlug: r.saas_slug ?? null,
      type: String(r.type),
      severity: String(r.severity),
      count: Number(r.count ?? 0),
      firstSeenAt: String(r.first_seen_at ?? ""),
      lastSeenAt: String(r.last_seen_at ?? ""),
    }));
  } catch (err) {
    console.warn("[snapshot-db] rollups fallback", (err as Error).message);
  }

  // 4. Socialflow status — direct lib call, no HTTP
  type SocialflowStatusResult = Awaited<ReturnType<typeof getCampoBaseSocialAutomationStatus>>;
  let socialflowStatus: SocialflowStatusResult | null = null;
  try {
    socialflowStatus = await getCampoBaseSocialAutomationStatus();
  } catch (err) {
    console.warn("[snapshot-db] socialflow fallback", (err as Error).message);
  }

  // 5. Governance — direct lib call, filtered by tenantId
  type GovernanceRows = Awaited<ReturnType<typeof listOperatorGovernanceView>>["rows"];
  let governanceRows: GovernanceRows = [];
  try {
    const result = await listOperatorGovernanceView({ tenantId, limit: 200 });
    governanceRows = result.rows;
  } catch (err) {
    console.warn("[snapshot-db] governance fallback", (err as Error).message);
  }

  // 6. Build governance severity map
  let gCritical = 0;
  let gWarning = 0;
  let gOk = 0;
  const gmap: Record<string, { severity: "CRITICAL" | "WARNING" | "OK" | "UNKNOWN" }> = {};
  for (const r of governanceRows) {
    const sev: "CRITICAL" | "WARNING" | "OK" | "UNKNOWN" =
      r.severity === "CRITICAL" ? "CRITICAL"
      : r.severity === "ERROR" || r.severity === "WARN" ? "WARNING"
      : r.severity === "INFO" ? "OK"
      : "UNKNOWN";
    if (sev === "CRITICAL") gCritical++;
    else if (sev === "WARNING") gWarning++;
    else if (sev === "OK") gOk++;
    if (r.saasId) gmap[String(r.saasId)] = { severity: sev };
    if (r.saasSlug) gmap[`slug:${r.saasSlug}`] = { severity: sev };
  }

  const opsFromEvents = deriveOpsFromEvents(rollups, criticalEvents);

  // 7. Socialflow per-saas map (filter by tenantId for correctness)
  const socialByTarget = new Map<string, boolean>();
  if (socialflowStatus) {
    for (const item of socialflowStatus.items) {
      if (item.tenantId === tenantId) {
        socialByTarget.set(item.saasId, item.enabled);
      }
    }
  }

  // 8. Build SaasRows from accounting.rows
  const saasRows: SaasRow[] = (accounting?.rows ?? [])
    .map((row): SaasRow => {
      const mrr = row.subscriptionMonthlyAmount ?? 0;
      const marginPct =
        typeof row.profitabilityMarginPercent === "number"
          ? row.profitabilityMarginPercent
          : undefined;
      const cost = typeof marginPct === "number" ? Math.max(0, mrr * (1 - marginPct)) : undefined;
      const marginEur = typeof marginPct === "number" ? Math.max(0, mrr * marginPct) : undefined;
      const opsSeverity: SaasRow["opsSeverity"] =
        gmap[row.saasId]?.severity
        ?? (row.slug ? gmap[`slug:${row.slug}`]?.severity : undefined)
        ?? (row.slug ? opsFromEvents[row.slug] : undefined)
        ?? "OK";
      const socialEnabled = socialByTarget.get(row.saasId);
      return {
        saasId: row.saasId,
        saasName: row.saasName,
        slug: row.slug ?? undefined,
        planLabel: row.planLabel ?? undefined,
        mrr,
        marginPct,
        cost,
        marginEur,
        opsSeverity,
        socialEnabled,
      };
    })
    .sort((a, b) => b.mrr - a.mrr);

  // 9. Socialflow summary
  const socialSummary: SocialflowSummary | null = socialflowStatus
    ? {
        total: socialflowStatus.total,
        enabled: socialflowStatus.enabled,
        disabled: socialflowStatus.disabled,
        lastRunAt: null,
      }
    : null;

  // 10. Governance summary
  const governanceSummary: GovernanceSummary | null = governanceRows.length
    ? { total: governanceRows.length, critical: gCritical, warning: gWarning, ok: gOk }
    : null;

  return {
    kpis,
    saas: saasRows,
    socialflow: socialSummary,
    governance: governanceSummary,
    events: {
      criticalEvents,
      rollups,
      growth7d: computeGrowth(rollups, 7),
      growth30d: computeGrowth30WithSeries(rollups),
    },
    mrr30d: null, // no history table available via direct DB path yet
  };
}
