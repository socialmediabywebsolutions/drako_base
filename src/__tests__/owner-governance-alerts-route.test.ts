import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../app/api/owner/governance/alerts/route";
import { UnauthorizedError } from "../lib/auth/session";
import type { GovernanceRow } from "../lib/ops/operator-governance-view";

vi.mock("../lib/auth/session", () => ({
  requireOwnerAccess: vi.fn(),
  UnauthorizedError: class extends Error {
    status = 401;
    constructor() {
      super("unauthorized");
    }
  },
}));

vi.mock("../lib/ops/operator-governance-view", () => ({
  listOperatorGovernanceView: vi.fn(),
}));

const mockRequireOwnerAccess = require("../lib/auth/session").requireOwnerAccess as unknown as ReturnType<typeof vi.fn>;
const mockListView = require("../lib/ops/operator-governance-view").listOperatorGovernanceView as unknown as ReturnType<typeof vi.fn>;

function makeRow(overrides: Partial<GovernanceRow> = {}): GovernanceRow {
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

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireOwnerAccess.mockResolvedValue({ tenantId: "tenant-1" });
});

describe("/api/owner/governance/alerts", () => {
  it("requires auth", async () => {
    mockRequireOwnerAccess.mockRejectedValueOnce(new UnauthorizedError());
    const res = await GET(new Request("https://example.com/api/owner/governance/alerts"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("returns data, summary, meta", async () => {
    mockListView.mockResolvedValue({
      rows: [makeRow({ provisioningStatus: "FAILED", overallGovernanceStatus: "BLOCKED", severity: "CRITICAL" })],
      summary: { total: 1, healthy: 0, warnings: 0, degraded: 0, blocked: 1, verifyingDomains: 0, provisioningRunning: 0, auditStale: 0, billingIssues: 0, lifecycleMismatches: 0, criticalBlockers: 1 },
    });

    const res = await GET(new Request("https://example.com/api/owner/governance/alerts"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.summary).toEqual(expect.objectContaining({ total: expect.any(Number), critical: expect.any(Number), degraded: expect.any(Number), warnings: expect.any(Number), escalationSuggested: expect.any(Number) }));
    expect(json.meta).toEqual(expect.objectContaining({ total: expect.any(Number), limit: expect.any(Number), offset: expect.any(Number), hasMore: expect.any(Boolean), filters: expect.any(Object) }));
    const alert = json.data[0];
    expect(alert).toEqual(expect.objectContaining({ id: expect.any(String), severity: expect.any(String), category: expect.any(String), title: expect.any(String), escalationSuggested: expect.any(Boolean), diagnosticSummary: expect.any(String), relatedActions: expect.any(Array) }));
  });

  it("applies filters (severity/category/saasSlug/escalationSuggested/search)", async () => {
    const rows = [
      makeRow({ saasSlug: "alpha", provisioningStatus: "FAILED", overallGovernanceStatus: "BLOCKED", severity: "CRITICAL" }),
      makeRow({ saasSlug: "beta", billingStatus: "past_due", severity: "ERROR", topIssue: "billing" }),
    ];
    mockListView.mockResolvedValue({ rows, summary: { total: rows.length, healthy: 0, warnings: 0, degraded: 1, blocked: 1, verifyingDomains: 0, provisioningRunning: 0, auditStale: 0, billingIssues: 1, lifecycleMismatches: 0, criticalBlockers: 1 } });

    const url = "https://example.com/api/owner/governance/alerts?severity=CRITICAL&category=provisioning&saasSlug=alpha&escalationSuggested=true&search=alpha";
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(1);
    const alert = json.data[0];
    expect(alert.severity).toBe("CRITICAL");
    expect(alert.category).toBe("provisioning");
    expect(alert.saasSlug).toBe("alpha");
    expect(alert.escalationSuggested).toBe(true);
  });

  it("supports pagination and hasMore", async () => {
    const rows = [makeRow({ saasSlug: "one", provisioningStatus: "FAILED", severity: "CRITICAL", overallGovernanceStatus: "BLOCKED" }), makeRow({ saasSlug: "two", billingStatus: "past_due", severity: "ERROR" })];
    mockListView.mockResolvedValue({ rows, summary: { total: rows.length, healthy: 0, warnings: 0, degraded: 1, blocked: 1, verifyingDomains: 0, provisioningRunning: 0, auditStale: 0, billingIssues: 1, lifecycleMismatches: 0, criticalBlockers: 1 } });

    const res = await GET(new Request("https://example.com/api/owner/governance/alerts?limit=1&offset=0&sort=priority"));
    const json = await res.json();
    expect(json.data.length).toBe(1);
    expect(json.meta.hasMore).toBe(true);
    const resPage2 = await GET(new Request("https://example.com/api/owner/governance/alerts?limit=1&offset=1&sort=priority"));
    const json2 = await resPage2.json();
    expect(json2.data.length).toBe(1);
    expect(json2.meta.hasMore).toBe(false);
  });

  it("handles recent sort", async () => {
    const rows = [
      makeRow({ saasSlug: "alpha", provisioningStatus: "FAILED", severity: "CRITICAL", lastEventAt: "2024-02-01T00:00:00.000Z" }),
      makeRow({ saasSlug: "beta", billingStatus: "past_due", severity: "ERROR", lastEventAt: "2024-03-01T00:00:00.000Z" }),
    ];
    mockListView.mockResolvedValue({ rows, summary: { total: rows.length, healthy: 0, warnings: 0, degraded: 1, blocked: 1, verifyingDomains: 0, provisioningRunning: 0, auditStale: 0, billingIssues: 1, lifecycleMismatches: 0, criticalBlockers: 1 } });
    const res = await GET(new Request("https://example.com/api/owner/governance/alerts?sort=recent"));
    const json = await res.json();
    expect(json.data[0].saasSlug).toBe("beta");
  });

  it("returns safe error on internal failure", async () => {
    mockListView.mockRejectedValueOnce(new Error("boom"));
    const res = await GET(new Request("https://example.com/api/owner/governance/alerts"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("internal_error");
  });
});
