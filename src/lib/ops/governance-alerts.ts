import type { GovernanceRow } from "./operator-governance-view";
import { buildDiagnosticSummary } from "./governance-actions";

export type GovernanceAlertSeverity = "CRITICAL" | "ERROR" | "WARN" | "INFO";
export type GovernanceAlertCategory = "billing" | "provisioning" | "domain" | "lifecycle" | "audit" | "consistency";

export type GovernanceAlert = {
  id: string;
  rowKey: string;
  saasId: string | null;
  saasSlug: string;
  instanceId: string | null;
  domainId: string | null;
  category: GovernanceAlertCategory;
  severity: GovernanceAlertSeverity;
  title: string;
  description: string;
  topIssue: string | null;
  recommendations: string[];
  createdAt: string | null;
  lastEventAt: string | null;
  escalationSuggested: boolean;
  escalationReason?: string | null;
  relatedActions: string[];
  diagnosticSummary: string;
};

export type GovernanceAlertSummary = {
  total: number;
  critical: number;
  degraded: number;
  warnings: number;
  escalationSuggested: number;
};

function severityRank(sev: GovernanceAlertSeverity): number {
  if (sev === "CRITICAL") return 3;
  if (sev === "ERROR") return 2;
  if (sev === "WARN") return 1;
  return 0;
}

function alertId(row: GovernanceRow, category: GovernanceAlertCategory, suffix: string) {
  return `${row.saasSlug}:${category}:${suffix}`;
}

function pickCreatedAt(row: GovernanceRow): string | null {
  return row.lastEventAt || row.lastProvisioningAt || row.lastBillingAt || row.lastAuditAt || null;
}

export function deriveGovernanceAlerts(rows: GovernanceRow[]): GovernanceAlert[] {
  const alerts: GovernanceAlert[] = [];

  for (const row of rows) {
    const base = {
      rowKey: row.saasSlug,
      saasId: row.saasId,
      saasSlug: row.saasSlug,
      instanceId: row.instanceId,
      domainId: row.domainId,
      topIssue: row.topIssue,
      recommendations: row.recommendations,
      createdAt: pickCreatedAt(row),
      lastEventAt: row.lastEventAt,
      diagnosticSummary: buildDiagnosticSummary(row),
    };

    // Billing
    if (row.billingStatus === "past_due") {
      const severity: GovernanceAlertSeverity = row.severity === "CRITICAL" || row.overallGovernanceStatus === "BLOCKED" ? "CRITICAL" : "ERROR";
      alerts.push({
        id: alertId(row, "billing", "past_due"),
        category: "billing",
        severity,
        title: "Billing past due",
        description: "Billing status is past due and may impact service access.",
        escalationSuggested: severityRank(severity) >= 2,
        escalationReason: "Billing past due",
        relatedActions: ["openBillingContext"],
        ...base,
      });
    }

    // Provisioning
    if (row.provisioningStatus === "FAILED") {
      alerts.push({
        id: alertId(row, "provisioning", "failed"),
        category: "provisioning",
        severity: "CRITICAL",
        title: "Provisioning failed",
        description: "Provisioning has failed and requires operator intervention.",
        escalationSuggested: true,
        escalationReason: "Provisioning failed",
        relatedActions: ["openProvisioningContext", "recheckProvisioningHealth", "escalateManualReview"],
        ...base,
      });
    } else if (row.provisioningStatus === "DEGRADED") {
      alerts.push({
        id: alertId(row, "provisioning", "degraded"),
        category: "provisioning",
        severity: "ERROR",
        title: "Provisioning degraded",
        description: "Provisioning is degraded; investigate job health.",
        escalationSuggested: true,
        escalationReason: "Provisioning degraded",
        relatedActions: ["openProvisioningContext", "recheckProvisioningHealth"],
        ...base,
      });
    }

    // Domain
    if (row.domainStatus === "failed" || row.domainStatus === "locked") {
      alerts.push({
        id: alertId(row, "domain", "failed"),
        category: "domain",
        severity: "CRITICAL",
        title: "Domain failure",
        description: "Custom domain is failed or locked; traffic may be impacted.",
        escalationSuggested: true,
        escalationReason: "Domain failed or locked",
        relatedActions: ["openDomainContext", "retryDomainVerification", "escalateManualReview"],
        ...base,
      });
    } else if (row.domainStatus === "verifying") {
      alerts.push({
        id: alertId(row, "domain", "verifying"),
        category: "domain",
        severity: "WARN",
        title: "Domain pending verification",
        description: "Domain is still verifying; confirm DNS or certificate status.",
        escalationSuggested: false,
        escalationReason: null,
        relatedActions: ["openDomainContext", "retryDomainVerification"],
        ...base,
      });
    }

    // Lifecycle / consistency
    if (row.lifecycleStatus === "archived" && row.billingStatus === "active") {
      alerts.push({
        id: alertId(row, "lifecycle", "archived-billing-active"),
        category: "lifecycle",
        severity: "ERROR",
        title: "Archived but billing active",
        description: "Instance archived while billing is active; reconcile states.",
        escalationSuggested: true,
        escalationReason: "Archived with billing active",
        relatedActions: ["openBillingContext", "openSaasContext", "escalateManualReview"],
        ...base,
      });
    }

    if (row.warnings.includes("Status mismatch between saas and instance")) {
      alerts.push({
        id: alertId(row, "consistency", "lifecycle-mismatch"),
        category: "consistency",
        severity: "WARN",
        title: "Lifecycle mismatch",
        description: "SaaS and instance lifecycle are inconsistent.",
        escalationSuggested: false,
        escalationReason: "Resolve lifecycle mismatch",
        relatedActions: ["openSaasContext"],
        ...base,
      });
    }

    // Audit
    if (row.warnings.includes("Audit signals missing or stale")) {
      alerts.push({
        id: alertId(row, "audit", "stale"),
        category: "audit",
        severity: row.severity === "ERROR" || row.overallGovernanceStatus === "DEGRADED" ? "ERROR" : "WARN",
        title: "Audit signals stale",
        description: "Billing/audit signals are stale; refresh audit pipeline.",
        escalationSuggested: false,
        escalationReason: "Audit stale",
        relatedActions: ["copyDiagnosticSummary"],
        ...base,
      });
    }

    // Blocked overall -> ensure at least one alert
    if (row.overallGovernanceStatus === "BLOCKED" && !alerts.some((a) => a.rowKey === row.saasSlug)) {
      alerts.push({
        id: alertId(row, "consistency", "blocked"),
        category: "consistency",
        severity: "CRITICAL",
        title: "Instance blocked",
        description: "Instance is blocked; see blockers for details.",
        escalationSuggested: true,
        escalationReason: "Blocked instance",
        relatedActions: ["escalateManualReview", "copyDiagnosticSummary"],
        ...base,
      });
    }
  }

  return alerts;
}

export function buildGovernanceAlertSummary(alerts: GovernanceAlert[]): GovernanceAlertSummary {
  return alerts.reduce(
    (acc, a) => {
      acc.total += 1;
      if (a.severity === "CRITICAL") acc.critical += 1;
      if (a.severity === "ERROR") acc.degraded += 1;
      if (a.severity === "WARN") acc.warnings += 1;
      if (a.escalationSuggested) acc.escalationSuggested += 1;
      return acc;
    },
    { total: 0, critical: 0, degraded: 0, warnings: 0, escalationSuggested: 0 },
  );
}

export function filterAndSortAlerts(
  alerts: GovernanceAlert[],
  filters: {
    severity?: GovernanceAlertSeverity;
    category?: GovernanceAlertCategory;
    saasSlug?: string;
    escalationSuggested?: boolean;
    search?: string;
    sort?: "priority" | "recent";
  },
): GovernanceAlert[] {
  const filtered = alerts.filter((a) => {
    if (filters.severity && a.severity !== filters.severity) return false;
    if (filters.category && a.category !== filters.category) return false;
    if (typeof filters.escalationSuggested === "boolean" && a.escalationSuggested !== filters.escalationSuggested) return false;
    if (filters.saasSlug && a.saasSlug !== filters.saasSlug) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = [a.title, a.description, a.saasSlug, a.topIssue ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (filters.sort === "recent") {
    return filtered.sort((a, b) => (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? ""));
  }

  // priority: severity rank desc, escalation suggested first, then recency
  return filtered.sort((a, b) => {
    const esc = Number(b.escalationSuggested) - Number(a.escalationSuggested);
    if (esc !== 0) return esc;
    const sevDiff = severityRank(b.severity) - severityRank(a.severity);
    if (sevDiff !== 0) return sevDiff;
    return (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? "");
  });
}
