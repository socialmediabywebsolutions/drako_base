import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../app/api/owner/governance/route";
import type { GovernanceRow } from "../lib/ops/operator-governance-view";

const mockRequireOwnerAccess = vi.fn();
const mockListView = vi.fn();

vi.mock("../lib/auth/session", () => {
  class UnauthorizedError extends Error {
    status = 401;
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
  return {
    requireOwnerAccess: (...args: unknown[]) => mockRequireOwnerAccess(...args),
    UnauthorizedError,
  };
});

vi.mock("../lib/ops/operator-governance-view", () => ({
  listOperatorGovernanceView: (...args: unknown[]) => mockListView(...args),
}));

describe("owner/governance API", () => {
  const baseRow: GovernanceRow = {
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
    auditStatus: "info",
    readinessState: "ready",
    overallGovernanceStatus: "HEALTHY",
    severity: "INFO",
    lastEventAt: "2024-01-01T00:00:00.000Z",
    lastAuditAt: "2024-01-01T00:00:00.000Z",
    lastProvisioningAt: "2024-01-01T00:00:00.000Z",
    lastBillingAt: "2024-01-01T00:00:00.000Z",
    blockers: [],
    warnings: [],
    signals: ["lifecycle:active"],
    recommendations: [],
    topIssue: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOwnerAccess.mockResolvedValue({ tenantId: "tenant-1" });
    mockListView.mockResolvedValue({ rows: [baseRow], summary: { total: 1, healthy: 1, warnings: 0, degraded: 0, blocked: 0 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires auth", async () => {
    const { UnauthorizedError } = await import("../lib/auth/session");
    mockRequireOwnerAccess.mockRejectedValue(new UnauthorizedError("unauthorized"));
    const res = await GET(new Request("http://localhost/api/owner/governance"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("unauthorized");
  });

  it("returns data with summary and meta", async () => {
    const res = await GET(new Request("http://localhost/api/owner/governance?status=BLOCKED&limit=10&offset=0&sort=recent"));
    expect(mockListView).toHaveBeenCalledWith({
      status: "BLOCKED",
      severity: undefined,
      lifecycle: undefined,
      billing: undefined,
      provisioning: undefined,
      domainStatus: undefined,
      saasSlug: undefined,
      search: undefined,
      limit: 10,
      offset: 0,
      sort: "recent",
      tenantId: "tenant-1",
    });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].actions).toBeDefined();
    expect(Array.isArray(json.data[0].actions)).toBe(true);
    expect(json.data[0].diagnosticSummary).toBeDefined();
    expect(typeof json.data[0].diagnosticSummary).toBe("string");
    expect(json.summary.total).toBe(1);
    expect(json.meta.limit).toBe(50);
    expect(json.meta.offset).toBe(0);
  });

  it("includes action shape and survives filters", async () => {
    const res = await GET(new Request("https://example.com/api/owner/governance?status=HEALTHY&limit=1&offset=0"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    const row = json.data[0];
    const sampleAction = row.actions[0];
    expect(sampleAction).toEqual(
      expect.objectContaining({ id: expect.any(String), label: expect.any(String), kind: expect.any(String), enabled: expect.any(Boolean) }),
    );
    expect(row.diagnosticSummary).toEqual(expect.any(String));
    expect(json.meta.limit).toBe(1);
    expect(json.meta.offset).toBe(0);
  });

  it("propagates filters", async () => {
    const url = "http://localhost/api/owner/governance?severity=WARN&lifecycle=active&billing=past_due&provisioning=FAILED&domainStatus=verifying&saasSlug=alpha&search=alpha";
    await GET(new Request(url));
    expect(mockListView).toHaveBeenCalledWith({
      status: undefined,
      severity: "WARN",
      lifecycle: "active",
      billing: "past_due",
      provisioning: "FAILED",
      domainStatus: "verifying",
      saasSlug: "alpha",
      search: "alpha",
      limit: undefined,
      offset: undefined,
      sort: "priority",
      tenantId: "tenant-1",
    });
  });

  it("handles internal errors without leaking details", async () => {
    mockListView.mockRejectedValue(new Error("boom"));
    const res = await GET(new Request("http://localhost/api/owner/governance"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("OWNER_GOVERNANCE_VIEW_ERROR");
  });
});
