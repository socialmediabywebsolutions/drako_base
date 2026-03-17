import { describe, it, expect } from "vitest";
import { buildExecutiveSnapshot, buildExecutiveDelta, buildExecutiveSummary } from "../lib/ops/governance-executive";
import type { GovernanceSummary, GovernanceRow } from "../lib/ops/operator-governance-view";
import type { GovernanceAlert, GovernanceAlertSummary } from "../lib/ops/governance-alerts";

const baseGovSummary: GovernanceSummary = {
  total: 3,
  healthy: 1,
  warnings: 1,
  degraded: 0,
  blocked: 1,
  verifyingDomains: 0,
  provisioningRunning: 0,
  auditStale: 0,
  billingIssues: 0,
  lifecycleMismatches: 0,
  criticalBlockers: 1,
};

const baseAlertsSummary: GovernanceAlertSummary = {
  total: 2,
  critical: 1,
  degraded: 0,
  warnings: 1,
  escalationSuggested: 1,
};

const blockedRow: GovernanceRow = {
  saasId: "saas-1",
  saasSlug: "alpha",
  saasName: "Alpha",
  instanceId: "inst-1",
  domainId: "dom-1",
  tenantId: "tenant-1",
  lifecycleStatus: "active",
  billingStatus: "active",
  provisioningStatus: "FAILED",
  domainStatus: "failed",
  auditStatus: "ok",
  readinessState: null,
  overallGovernanceStatus: "BLOCKED",
  severity: "CRITICAL",
  lastEventAt: "2024-01-01T00:00:00.000Z",
  lastAuditAt: "2024-01-01T00:00:00.000Z",
  lastProvisioningAt: "2024-01-01T00:00:00.000Z",
  lastBillingAt: "2024-01-01T00:00:00.000Z",
  blockers: ["Provisioning failed"],
  warnings: [],
  signals: [],
  recommendations: ["Retry provisioning"],
  topIssue: "Provisioning failed",
};

const warningRow: GovernanceRow = {
  ...blockedRow,
  saasSlug: "beta",
  saasName: "Beta",
  provisioningStatus: "DEGRADED",
  overallGovernanceStatus: "WARNING",
  severity: "WARN",
  blockers: [],
  warnings: ["Audit signals missing or stale"],
  topIssue: "Audit stale",
};

const criticalAlert: GovernanceAlert = {
  id: "alpha:provisioning:failed",
  rowKey: "alpha",
  saasId: "saas-1",
  saasSlug: "alpha",
  instanceId: "inst-1",
  domainId: "dom-1",
  category: "provisioning",
  severity: "CRITICAL",
  title: "Provisioning failed",
  description: "Provisioning has failed",
  topIssue: "Provisioning failed",
  recommendations: ["Re-run health check"],
  createdAt: "2024-01-01T00:00:00.000Z",
  lastEventAt: "2024-01-01T00:00:00.000Z",
  escalationSuggested: true,
  escalationReason: "Provisioning failed",
  relatedActions: ["recheckProvisioningHealth"],
  diagnosticSummary: "test",
};

const warnAlert: GovernanceAlert = {
  ...criticalAlert,
  id: "beta:audit:stale",
  saasSlug: "beta",
  category: "audit",
  severity: "WARN",
  title: "Audit stale",
  escalationSuggested: false,
};

describe("buildExecutiveSnapshot", () => {
  it("builds snapshot with hotspots, blocked rows and critical alerts", () => {
    const snap = buildExecutiveSnapshot({
      governanceSummary: baseGovSummary,
      alertsSummary: baseAlertsSummary,
      rows: [blockedRow, warningRow],
      alerts: [criticalAlert, warnAlert],
      generatedAt: "2024-02-01T00:00:00.000Z",
    });

    expect(snap.generatedAt).toBe("2024-02-01T00:00:00.000Z");
    expect(snap.governanceSummary.blocked).toBe(1);
    expect(snap.alertsSummary.critical).toBe(1);
    expect(snap.topBlockedRows.length).toBeGreaterThan(0);
    expect(snap.topCriticalAlerts.length).toBe(1);
    expect(snap.topHotspots.length).toBeGreaterThan(0);
    expect(snap.recommendations.length).toBeGreaterThan(0);
  });

  it("keeps recommendations stable for healthy state", () => {
    const healthySummary: GovernanceSummary = { ...baseGovSummary, blocked: 0, degraded: 0, warnings: 0, healthy: 3, billingIssues: 0, verifyingDomains: 0, auditStale: 0, lifecycleMismatches: 0, criticalBlockers: 0 };
    const healthyAlerts: GovernanceAlertSummary = { ...baseAlertsSummary, critical: 0, total: 0, warnings: 0, escalationSuggested: 0 };
    const snap = buildExecutiveSnapshot({ governanceSummary: healthySummary, alertsSummary: healthyAlerts, rows: [], alerts: [] });
    expect(snap.recommendations[snap.recommendations.length - 1]).toContain("stable");
    expect(snap.topHotspots.length).toBe(0);
  });
});

describe("buildExecutiveDelta", () => {
  const snapPrev = buildExecutiveSnapshot({ governanceSummary: baseGovSummary, alertsSummary: baseAlertsSummary, rows: [blockedRow], alerts: [criticalAlert] });
  const snapSame = buildExecutiveSnapshot({ governanceSummary: baseGovSummary, alertsSummary: baseAlertsSummary, rows: [blockedRow], alerts: [criticalAlert] });
  const snapBetter = buildExecutiveSnapshot({ governanceSummary: { ...baseGovSummary, blocked: 0, degraded: 0 }, alertsSummary: { ...baseAlertsSummary, critical: 0, escalationSuggested: 0 }, rows: [warningRow], alerts: [warnAlert] });
  const snapWorse = buildExecutiveSnapshot({ governanceSummary: { ...baseGovSummary, blocked: 2, degraded: 1 }, alertsSummary: { ...baseAlertsSummary, critical: 2, escalationSuggested: 2 }, rows: [blockedRow, warningRow], alerts: [criticalAlert, warnAlert] });

  it("returns zero delta when equal", () => {
    const delta = buildExecutiveDelta(snapSame, snapPrev);
    expect(delta.blockedDiff).toBe(0);
    expect(delta.degradedDiff).toBe(0);
    expect(delta.criticalAlertsDiff).toBe(0);
    expect(delta.escalationSuggestedDiff).toBe(0);
  });

  it("returns negative deltas when improved", () => {
    const delta = buildExecutiveDelta(snapBetter, snapPrev);
    expect(delta.blockedDiff).toBeLessThanOrEqual(0);
    expect(delta.criticalAlertsDiff).toBeLessThanOrEqual(0);
  });

  it("returns positive deltas when worse", () => {
    const delta = buildExecutiveDelta(snapWorse, snapPrev);
    expect(delta.blockedDiff).toBeGreaterThan(0);
    expect(delta.criticalAlertsDiff).toBeGreaterThan(0);
    expect(delta.escalationSuggestedDiff).toBeGreaterThan(0);
  });
});

describe("buildExecutiveSummary", () => {
  const snapStable = buildExecutiveSnapshot({ governanceSummary: { ...baseGovSummary, blocked: 0, degraded: 0 }, alertsSummary: { ...baseAlertsSummary, critical: 0, escalationSuggested: 0 }, rows: [], alerts: [] });
  const snapRisk = buildExecutiveSnapshot({ governanceSummary: baseGovSummary, alertsSummary: baseAlertsSummary, rows: [blockedRow], alerts: [criticalAlert] });

  it("produces non-empty summary", () => {
    const text = buildExecutiveSummary({ snapshot: snapStable });
    expect(text.length).toBeGreaterThan(10);
  });

  it("mentions hotspots and recommendations", () => {
    const text = buildExecutiveSummary({ snapshot: snapRisk });
    expect(text).toContain("Blocked");
    expect(text).toContain("critical");
    expect(text).toContain("Hotspots");
    expect(text).toContain("Focus");
  });

  it("includes delta info when provided", () => {
    const delta = buildExecutiveDelta(snapRisk, snapStable);
    const text = buildExecutiveSummary({ snapshot: snapRisk, previous: snapStable, delta });
    expect(text).toContain("Delta blocked");
  });
});
