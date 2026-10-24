import { describe, it, expect } from "vitest";
import { deriveGovernanceActions, buildDiagnosticSummary } from "../lib/ops/governance-actions";
import type { GovernanceRow } from "../lib/ops/operator-governance-view";

function baseRow(overrides: Partial<GovernanceRow> = {}): GovernanceRow {
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

function actionIds(row: GovernanceRow) {
  return deriveGovernanceActions(row).map((a) => a.id);
}

describe("deriveGovernanceActions", () => {
  it("returns minimal actions for healthy", () => {
    const ids = actionIds(baseRow());
    expect(ids).toContain("openSaasContext");
    expect(ids).toContain("copyDiagnosticSummary");
    expect(ids).toContain("exportRowDetails");
  });

  it("handles domain verifying with domainId", () => {
    const row = baseRow({ domainStatus: "verifying", domainId: "dom-10" });
    const actions = deriveGovernanceActions(row);
    const domain = actions.find((a) => a.id === "openDomainContext");
    const retry = actions.find((a) => a.id === "retryDomainVerification");
    expect(domain?.enabled).toBe(true);
    expect(retry?.enabled).toBe(true);
    expect(retry?.kind).toBe("safe_trigger");
  });

  it("handles domain verifying without domainId", () => {
    const row = baseRow({ domainStatus: "verifying", domainId: null });
    const actions = deriveGovernanceActions(row);
    const domain = actions.find((a) => a.id === "openDomainContext");
    const retry = actions.find((a) => a.id === "retryDomainVerification");
    expect(domain?.enabled).toBe(false);
    expect(domain?.reasonIfDisabled).toBeTruthy();
    expect(retry?.enabled).toBe(false);
    expect(retry?.reasonIfDisabled).toContain("No domain");
  });

  it("handles provisioning degraded", () => {
    const row = baseRow({ provisioningStatus: "DEGRADED" });
    const actions = deriveGovernanceActions(row);
    expect(actions.find((a) => a.id === "openProvisioningContext")?.enabled).toBe(true);
    expect(actions.find((a) => a.id === "recheckProvisioningHealth")?.enabled).toBe(true);
    expect(actions.find((a) => a.id === "escalateManualReview")?.enabled).toBe(false);
  });

  it("handles provisioning failed and blockers", () => {
    const row = baseRow({ provisioningStatus: "FAILED", blockers: ["Provisioning failed"] });
    const actions = deriveGovernanceActions(row);
    expect(actions.find((a) => a.id === "recheckProvisioningHealth")?.enabled).toBe(true);
    const escalate = actions.find((a) => a.id === "escalateManualReview");
    expect(escalate?.enabled).toBe(true);
    expect(escalate?.kind).toBe("handoff");
  });

  it("handles billing past_due", () => {
    const row = baseRow({ billingStatus: "past_due" });
    const actions = deriveGovernanceActions(row);
    expect(actions.find((a) => a.id === "openBillingContext")?.enabled).toBe(true);
  });

  it("handles audit stale as inspection/handoff", () => {
    const row = baseRow({ warnings: ["Audit signals missing or stale"], overallGovernanceStatus: "WARNING" });
    const actions = deriveGovernanceActions(row);
    expect(actions.find((a) => a.id === "copyDiagnosticSummary")?.enabled).toBe(true);
    expect(actions.find((a) => a.id === "escalateManualReview")?.enabled).toBe(false);
  });

  it("handles BLOCKED with blockers prioritizing handoff", () => {
    const row = baseRow({ overallGovernanceStatus: "BLOCKED", severity: "CRITICAL", blockers: ["Domain failure"] });
    const actions = deriveGovernanceActions(row);
    const escalate = actions.find((a) => a.id === "escalateManualReview");
    expect(escalate?.enabled).toBe(true);
    expect(actions.find((a) => a.id === "retryDomainVerification")?.kind).toBe("safe_trigger");
  });
});

describe("buildDiagnosticSummary", () => {
  it("includes key fields for healthy row", () => {
    const summary = buildDiagnosticSummary(baseRow());
    expect(summary).toContain("SaaS: alpha");
    expect(summary).toContain("Overall: HEALTHY");
    expect(summary).toContain("Severity: INFO");
  });

  it("includes top issue and blockers", () => {
    const summary = buildDiagnosticSummary(baseRow({ topIssue: "Domain down", blockers: ["DNS error"] }));
    expect(summary).toContain("Domain down");
    expect(summary).toContain("DNS error");
  });

  it("handles warnings and recommendations", () => {
    const summary = buildDiagnosticSummary(baseRow({ warnings: ["Audit stale"], recommendations: ["Re-run audit"] }));
    expect(summary).toContain("Audit stale");
    expect(summary).toContain("Re-run audit");
  });

  it("handles blocked state with blockers", () => {
    const summary = buildDiagnosticSummary(baseRow({ overallGovernanceStatus: "BLOCKED", severity: "CRITICAL", blockers: ["Provisioning failed"] }));
    expect(summary).toContain("BLOCKED");
    expect(summary).toContain("CRITICAL");
    expect(summary).toContain("Provisioning failed");
  });

  it("is not empty even without optional fields", () => {
    const summary = buildDiagnosticSummary(baseRow({ saasName: null, topIssue: null, blockers: [], warnings: [], recommendations: [] }));
    expect(summary.length).toBeGreaterThan(10);
  });
});
