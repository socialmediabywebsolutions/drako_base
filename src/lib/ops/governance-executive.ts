import type { GovernanceSummary, GovernanceRow } from "./operator-governance-view";
import type { GovernanceAlert, GovernanceAlertSummary } from "./governance-alerts";

export type GovernanceExecutiveSnapshot = {
  generatedAt: string;
  governanceSummary: GovernanceSummary;
  alertsSummary: GovernanceAlertSummary;
  topHotspots: string[];
  topCriticalAlerts: GovernanceAlert[];
  topBlockedRows: GovernanceRow[];
  recommendations: string[];
};

export type GovernanceExecutiveDelta = {
  blockedDiff: number;
  degradedDiff: number;
  criticalAlertsDiff: number;
  escalationSuggestedDiff: number;
};

export type GovernanceExecutiveReport = {
  snapshot: GovernanceExecutiveSnapshot;
  previous?: GovernanceExecutiveSnapshot;
  delta?: GovernanceExecutiveDelta;
  executiveSummary?: string;
};

function pickTop<T>(list: T[], count = 3): T[] {
  return list.slice(0, count);
}

export function buildExecutiveSnapshot(params: {
  governanceSummary: GovernanceSummary;
  alertsSummary: GovernanceAlertSummary;
  rows: GovernanceRow[];
  alerts: GovernanceAlert[];
  generatedAt?: string;
}): GovernanceExecutiveSnapshot {
  const { governanceSummary, alertsSummary, rows, alerts } = params;
  const generatedAt = params.generatedAt ?? new Date().toISOString();

  const blockedRows = rows.filter((r) => r.overallGovernanceStatus === "BLOCKED");
  const degradedRows = rows.filter((r) => r.overallGovernanceStatus === "DEGRADED");
  const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL");

  const hotspots: string[] = [];
  if (governanceSummary.blocked > 0) hotspots.push("Blocked instances detected");
  if (governanceSummary.degraded > 0) hotspots.push("Degraded instances present");
  if (governanceSummary.billingIssues > 0) hotspots.push("Billing issues detected");
  if (governanceSummary.verifyingDomains > 0) hotspots.push("Domains pending verification");
  if (governanceSummary.lifecycleMismatches > 0) hotspots.push("Lifecycle mismatches present");
  if (criticalAlerts.length > 0) hotspots.push("Critical alerts active");

  const recommendations: string[] = [];
  if (governanceSummary.blocked > 0) recommendations.push("Prioritize clearing blocked instances");
  if (governanceSummary.degraded > 0) recommendations.push("Focus on degraded provisioning jobs");
  if (governanceSummary.billingIssues > 0) recommendations.push("Address billing past_due items");
  if (governanceSummary.verifyingDomains > 0) recommendations.push("Resolve pending domain verifications");
  if (governanceSummary.auditStale > 0) recommendations.push("Refresh stale audit signals");
  if (criticalAlerts.length > 0) recommendations.push("Review critical alerts and escalate if needed");
  if (recommendations.length === 0) recommendations.push("Governance stable; maintain monitoring");

  return {
    generatedAt,
    governanceSummary,
    alertsSummary,
    topHotspots: hotspots.slice(0, 5),
    topCriticalAlerts: pickTop(criticalAlerts, 5),
    topBlockedRows: pickTop(blockedRows.length ? blockedRows : degradedRows, 5),
    recommendations: pickTop(recommendations, 5),
  };
}

export function buildExecutiveDelta(current: GovernanceExecutiveSnapshot, previous: GovernanceExecutiveSnapshot): GovernanceExecutiveDelta {
  return {
    blockedDiff: current.governanceSummary.blocked - previous.governanceSummary.blocked,
    degradedDiff: current.governanceSummary.degraded - previous.governanceSummary.degraded,
    criticalAlertsDiff: current.alertsSummary.critical - previous.alertsSummary.critical,
    escalationSuggestedDiff: current.alertsSummary.escalationSuggested - previous.alertsSummary.escalationSuggested,
  };
}

export function buildExecutiveSummary(report: GovernanceExecutiveReport): string {
  const { snapshot, delta } = report;
  const parts: string[] = [];
  parts.push(`Generated at ${snapshot.generatedAt}`);
  parts.push(`Governance: total ${snapshot.governanceSummary.total}, blocked ${snapshot.governanceSummary.blocked}, degraded ${snapshot.governanceSummary.degraded}`);
  parts.push(`Alerts: total ${snapshot.alertsSummary.total}, critical ${snapshot.alertsSummary.critical}, escalation ${snapshot.alertsSummary.escalationSuggested}`);

  if (delta) {
    const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    parts.push(`Delta blocked ${fmt(delta.blockedDiff)}, degraded ${fmt(delta.degradedDiff)}, critical alerts ${fmt(delta.criticalAlertsDiff)}, escalation ${fmt(delta.escalationSuggestedDiff)}`);
  }

  if (snapshot.topHotspots.length) parts.push(`Hotspots: ${snapshot.topHotspots.join("; ")}`);
  if (snapshot.recommendations.length) parts.push(`Focus: ${snapshot.recommendations.join("; ")}`);

  return parts.join(" | ");
}
