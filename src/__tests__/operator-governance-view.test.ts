import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  deriveGovernanceRow,
  listOperatorGovernanceView,
  type GovernanceFilters,
  type GovernanceRow,
} from "../lib/ops/operator-governance-view";

type RawGovernanceRow = Parameters<typeof deriveGovernanceRow>[0];

const baseRow: RawGovernanceRow = {
  saas_id: "saas-1",
  saas_slug: "alpha",
  saas_name: "Alpha",
  saas_status: "active",
  instance_id: "inst-1",
  tenant_id: "tenant-1",
  instance_status: "active",
  lifecycle_status: "active",
  billing_status: "active",
  readiness_state: "ready",
  domain_id: "dom-1",
  domain_status: "active",
  provisioning_status: "SUCCESS",
  last_job_state: "SUCCESS",
  last_job_at: new Date().toISOString(),
  last_billing_severity: "info",
  last_billing_outcome: "processed",
  last_billing_at: new Date().toISOString(),
  last_audit_at: new Date().toISOString(),
};

function makeRow(overrides: Partial<RawGovernanceRow>): RawGovernanceRow {
  return { ...baseRow, ...overrides };
}

describe("deriveGovernanceRow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes lifecycle statuses", () => {
    const row = deriveGovernanceRow(makeRow({ lifecycle_status: "trial_active" }));
    expect(row.lifecycleStatus).toBe("active");
  });

  it("normalizes billing statuses", () => {
    const row = deriveGovernanceRow(makeRow({ billing_status: "past-due" }));
    expect(row.billingStatus).toBe("past_due");
  });

  it("normalizes provisioning statuses", () => {
    const row = deriveGovernanceRow(makeRow({ last_job_state: "STRIPE_PRODUCT_CREATED" }));
    expect(row.provisioningStatus).toBe("RUNNING");
  });

  it("normalizes domain statuses", () => {
    const row = deriveGovernanceRow(makeRow({ domain_status: "pending_manual" }));
    expect(row.domainStatus).toBe("verifying");
  });

  it("resolves INFO/HEALTHY when no issues", () => {
    const row = deriveGovernanceRow(makeRow({}));
    expect(row.severity).toBe("INFO");
    expect(row.overallGovernanceStatus).toBe("HEALTHY");
  });

  it("resolves WARNING when moderate issues present", () => {
    const row = deriveGovernanceRow(
      makeRow({
        domain_status: "verifying",
        last_job_at: "2023-12-31T00:00:00.000Z",
        provisioning_status: "RUNNING",
      }),
    );
    expect(row.severity).toBe("WARN");
    expect(row.overallGovernanceStatus).toBe("WARNING");
  });

  it("resolves ERROR/DEGRADED when active with past_due billing", () => {
    const row = deriveGovernanceRow(makeRow({ lifecycle_status: "active", billing_status: "past_due" }));
    expect(row.severity).toBe("ERROR");
    expect(row.overallGovernanceStatus).toBe("DEGRADED");
  });

  it("resolves CRITICAL/BLOCKED when provisioning failed", () => {
    const row = deriveGovernanceRow(makeRow({ provisioning_status: "FAILED", last_job_state: "FAILED" }));
    expect(row.severity).toBe("CRITICAL");
    expect(row.overallGovernanceStatus).toBe("BLOCKED");
    expect(row.blockers).toContain("Provisioning job failed");
  });

  it("resolves UNKNOWN when no signals present", () => {
    const row = deriveGovernanceRow(
      makeRow({
        lifecycle_status: null,
        instance_status: null,
        saas_status: null,
        billing_status: null,
        provisioning_status: null,
        last_job_state: null,
        domain_status: null,
      }),
    );
    expect(row.overallGovernanceStatus).toBe("UNKNOWN");
  });

  it("emits deterministic recommendation for archived with active billing", () => {
    const row = deriveGovernanceRow(makeRow({ lifecycle_status: "archived", billing_status: "active" }));
    expect(row.recommendations.some((r) => r.includes("billing subscription"))).toBe(true);
    expect(row.blockers).toContain("Lifecycle archived but billing still active");
  });

  it("flags stale audit and billing", () => {
    const row = deriveGovernanceRow(
      makeRow({
        last_billing_at: "2023-10-01T00:00:00.000Z",
        last_audit_at: "2023-09-01T00:00:00.000Z",
      }),
    );
    expect(row.warnings).toContain("Billing audit stale");
    expect(row.warnings).toContain("Audit signals missing or stale");
  });

  it("detects status mismatch between saas and instance", () => {
    const row = deriveGovernanceRow(makeRow({ saas_status: "active", instance_status: "paused" }));
    expect(row.warnings).toContain("Status mismatch between saas and instance");
  });
});

describe("listOperatorGovernanceView", () => {
  const mockQueryAll = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({ queryAll: mockQueryAll }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock("@/lib/db");
  });

  async function run(filters: GovernanceFilters = {}) {
    const { listOperatorGovernanceView: tested } = await import("@/lib/ops/operator-governance-view");
    return tested(filters);
  }

  it("sorts by priority (severity, blockers, recency)", async () => {
    mockQueryAll.mockResolvedValue([
      makeRow({ saas_slug: "high", provisioning_status: "FAILED", last_job_at: "2023-12-31T00:00:00.000Z" }),
      makeRow({ saas_slug: "low", provisioning_status: "SUCCESS", last_job_at: "2024-01-01T00:00:00.000Z" }),
    ]);
    const { rows } = await run({ sort: "priority" });
    expect(rows[0].saasSlug).toBe("high");
  });

  it("sorts by recent when requested", async () => {
    mockQueryAll.mockResolvedValue([
      makeRow({ saas_slug: "older", last_job_at: "2023-12-30T00:00:00.000Z" }),
      makeRow({ saas_slug: "newer", last_job_at: "2023-12-31T00:00:00.000Z" }),
    ]);
    const { rows } = await run({ sort: "recent" });
    expect(rows[0].saasSlug).toBe("newer");
  });

  it("applies filters (status, severity, lifecycle, billing, provisioning, domain, saasSlug, search, tenantId)", async () => {
    mockQueryAll.mockResolvedValue([
      makeRow({ saas_slug: "ok", provisioning_status: "SUCCESS", lifecycle_status: "active" }),
      makeRow({ saas_slug: "warn", domain_status: "verifying" }),
      makeRow({ saas_slug: "block", provisioning_status: "FAILED" }),
    ]);

    const { rows } = await run({ status: "BLOCKED", tenantId: "tenant-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].saasSlug).toBe("block");

    const { rows: severityRows } = await run({ severity: "WARN" });
    expect(severityRows.every((r: GovernanceRow) => r.severity === "WARN")).toBe(true);

    const { rows: lifecycleRows } = await run({ lifecycle: "active" });
    expect(lifecycleRows.every((r: GovernanceRow) => r.lifecycleStatus === "active")).toBe(true);

    const { rows: billingRows } = await run({ billing: "past_due" });
    expect(billingRows.every((r: GovernanceRow) => r.billingStatus === "past_due")).toBe(true);

    const { rows: provisioningRows } = await run({ provisioning: "FAILED" });
    expect(provisioningRows.every((r: GovernanceRow) => r.provisioningStatus === "FAILED")).toBe(true);

    const { rows: domainRows } = await run({ domainStatus: "verifying" });
    expect(domainRows.every((r: GovernanceRow) => r.domainStatus === "verifying")).toBe(true);

    const { rows: slugRows } = await run({ saasSlug: "ok" });
    expect(slugRows).toHaveLength(1);

    const { rows: searchRows } = await run({ search: "warn" });
    expect(searchRows.some((r: GovernanceRow) => r.saasSlug === "warn")).toBe(true);
  });

  it("paginates results", async () => {
    mockQueryAll.mockResolvedValue([
      makeRow({ saas_slug: "one" }),
      makeRow({ saas_slug: "two" }),
      makeRow({ saas_slug: "three" }),
    ]);
    const { rows, summary } = await run({ limit: 2, offset: 1 });
    expect(rows).toHaveLength(2);
    expect(rows[0].saasSlug).toBe("two");
    expect(summary.total).toBe(3);
  });

  it("computes advanced summary buckets", async () => {
    mockQueryAll.mockResolvedValue([
      makeRow({ saas_slug: "dom", domain_status: "verifying" }),
      makeRow({ saas_slug: "prov", provisioning_status: "RUNNING" }),
      makeRow({ saas_slug: "audit", last_billing_at: "2023-10-01T00:00:00.000Z", last_audit_at: "2023-09-01T00:00:00.000Z" }),
      makeRow({ saas_slug: "bill", billing_status: "past_due" }),
      makeRow({ saas_slug: "mismatch", saas_status: "active", instance_status: "paused" }),
      makeRow({ saas_slug: "block", provisioning_status: "FAILED", last_job_state: "FAILED" }),
    ]);
    const { summary } = await run();
    expect(summary.verifyingDomains).toBeGreaterThanOrEqual(1);
    expect(summary.provisioningRunning).toBeGreaterThanOrEqual(1);
    expect(summary.auditStale).toBeGreaterThanOrEqual(1);
    expect(summary.billingIssues).toBeGreaterThanOrEqual(1);
    expect(summary.lifecycleMismatches).toBeGreaterThanOrEqual(1);
    expect(summary.criticalBlockers).toBeGreaterThanOrEqual(1);
  });
});
