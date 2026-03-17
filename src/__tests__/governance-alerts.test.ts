import { describe, it, expect } from "vitest";
import { deriveGovernanceAlerts, buildGovernanceAlertSummary } from "../lib/ops/governance-alerts";
import type { GovernanceRow } from "../lib/ops/operator-governance-view";

function row(overrides: Partial<GovernanceRow> = {}): GovernanceRow {
  return {
    saasId: "saas-1",
    saasSlug: "alpha",
    saasName: "Alpha",
    instanceId: "inst-1",
    domainId: "dom-1",
    tenantId: "tenant-1",
    lifecycleStatus: "active",
    billingStatus: "active",
    provisioningStatus: "SUCCESS",
    domainStatus: "active",
    auditStatus: "ok",
    readinessState: null,
    overallGovernanceStatus: "HEALTHY",
    severity: "INFO",
    lastEventAt: "2024-01-01T00:00:00.000Z",
    lastAuditAt: "2024-01-01T00:00:00.000Z",
    lastProvisioningAt: "2024-01-01T00:00:00.000Z",
    lastBillingAt: "2024-01-01T00:00:00.000Z",
    blockers: [],
    warnings: [],
    signals: [],
    recommendations: [],
    topIssue: null,
    ...overrides,
  };
}

describe("deriveGovernanceAlerts", () => {
  it("returns no alerts for healthy row", () => {
    const alerts = deriveGovernanceAlerts([row()]);
    expect(alerts.length).toBe(0);
  });

  it("creates critical alert for provisioning failed", () => {
    const alerts = deriveGovernanceAlerts([row({ provisioningStatus: "FAILED", overallGovernanceStatus: "BLOCKED", severity: "CRITICAL" })]);
    const alert = alerts.find((a) => a.category === "provisioning");
    expect(alert?.severity).toBe("CRITICAL");
    expect(alert?.escalationSuggested).toBe(true);
  });

  it("creates error alert for provisioning degraded", () => {
    const alerts = deriveGovernanceAlerts([row({ provisioningStatus: "DEGRADED", severity: "ERROR" })]);
    const alert = alerts.find((a) => a.category === "provisioning");
    expect(alert?.severity).toBe("ERROR");
    expect(alert?.escalationSuggested).toBe(true);
  });

  it("creates billing past_due alert", () => {
    const alerts = deriveGovernanceAlerts([row({ billingStatus: "past_due", severity: "ERROR" })]);
    const alert = alerts.find((a) => a.category === "billing");
    expect(alert).toBeDefined();
    expect(alert?.severity === "ERROR" || alert?.severity === "CRITICAL").toBe(true);
  });

  it("creates domain failure alert", () => {
    const alerts = deriveGovernanceAlerts([row({ domainStatus: "failed", severity: "CRITICAL", overallGovernanceStatus: "BLOCKED" })]);
    const alert = alerts.find((a) => a.category === "domain");
    expect(alert?.severity).toBe("CRITICAL");
    expect(alert?.escalationSuggested).toBe(true);
  });

  it("creates domain verifying warning", () => {
    const alerts = deriveGovernanceAlerts([row({ domainStatus: "verifying" })]);
    const alert = alerts.find((a) => a.category === "domain");
    expect(alert?.severity).toBe("WARN");
    expect(alert?.escalationSuggested).toBe(false);
  });

  it("creates lifecycle archived + billing active alert", () => {
    const alerts = deriveGovernanceAlerts([row({ lifecycleStatus: "archived", billingStatus: "active", severity: "ERROR" })]);
    const alert = alerts.find((a) => a.category === "lifecycle");
    expect(alert?.severity).toBe("ERROR");
    expect(alert?.escalationSuggested).toBe(true);
  });

  it("creates audit stale alert", () => {
    const alerts = deriveGovernanceAlerts([row({ warnings: ["Audit signals missing or stale"], severity: "WARN" })]);
    const alert = alerts.find((a) => a.category === "audit");
    expect(alert).toBeDefined();
    expect(alert?.severity === "WARN" || alert?.severity === "ERROR").toBe(true);
  });

  it("creates blocked fallback alert when no other", () => {
    const alerts = deriveGovernanceAlerts([row({ overallGovernanceStatus: "BLOCKED", severity: "CRITICAL", domainStatus: "active", provisioningStatus: "SUCCESS" })]);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.severity === "CRITICAL")).toBe(true);
  });
});

describe("buildGovernanceAlertSummary", () => {
  it("aggregates counts", () => {
    const alerts = deriveGovernanceAlerts([
      row({ provisioningStatus: "FAILED", overallGovernanceStatus: "BLOCKED", severity: "CRITICAL" }),
      row({ provisioningStatus: "DEGRADED", severity: "ERROR", saasSlug: "beta" }),
      row({ domainStatus: "verifying", severity: "WARN", saasSlug: "gamma" }),
    ]);
    const summary = buildGovernanceAlertSummary(alerts);
    expect(summary.total).toBe(alerts.length);
    expect(summary.critical).toBeGreaterThanOrEqual(1);
    expect(summary.degraded).toBeGreaterThanOrEqual(1);
    expect(summary.warnings).toBeGreaterThanOrEqual(1);
    expect(summary.escalationSuggested).toBeGreaterThanOrEqual(1);
  });
});
