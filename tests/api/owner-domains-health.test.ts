import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.name = "UnauthorizedError";
      this.status = status;
    }
  }

  return {
    requireOwnerAccess: vi.fn(),
    queryAll: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess: mocks.requireOwnerAccess,
  UnauthorizedError: mocks.UnauthorizedError,
}));

vi.mock("@/lib/db", () => ({
  queryAll: mocks.queryAll,
}));

import { GET } from "@/app/api/owner/domains/health/route";

describe("GET /api/owner/domains/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new mocks.UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/domains/health") as any);

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new mocks.UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/domains/health") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with degraded=true when thresholds are exceeded", async () => {
    mocks.requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    mocks.queryAll
      .mockResolvedValueOnce([
        {
          id: "domain_1",
          hostname: "a.drako.systems",
          status: "pending",
          saas_id: "saas_1",
          updated_at: "2026-03-05T10:00:00.000Z",
        },
        {
          id: "domain_2",
          hostname: "b.drako.systems",
          status: "pending",
          saas_id: "saas_2",
          updated_at: "2026-03-05T09:59:00.000Z",
        },
        {
          id: "domain_3",
          hostname: "c.drako.systems",
          status: "provisioning",
          saas_id: "saas_3",
          updated_at: "2026-03-05T09:58:00.000Z",
        },
        {
          id: "domain_4",
          hostname: "d.drako.systems",
          status: "pending",
          saas_id: "saas_4",
          updated_at: "2026-03-05T09:57:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          job_id: "job_1",
          saas_id: "saas_1",
          current_state: "DEGRADED",
          updated_at: "2026-03-05T10:00:00.000Z",
          last_error: "DOMAIN_VERIFY_FAILED:pending",
          hostname: "a.drako.systems",
          domain_status: "pending",
        },
      ]);

    const response = await GET(
      new Request("https://drako.systems/api/owner/domains/health?limit=50") as any,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      tenantId: string;
      pendingDomains: Array<{ hostname: string }>;
      degradedJobs: Array<{ jobId: string }>;
      recommendations: string[];
      slo: { degraded: boolean; pendingDomainsCount: number; degradedJobsCount: number };
    };

    expect(payload.ok).toBe(true);
    expect(payload.tenantId).toBe("tenant_owner");
    expect(payload.pendingDomains).toHaveLength(4);
    expect(payload.degradedJobs).toHaveLength(1);
    expect(payload.slo.pendingDomainsCount).toBe(4);
    expect(payload.slo.degradedJobsCount).toBe(1);
    expect(payload.slo.degraded).toBe(true);
    expect(payload.recommendations[0]).toContain("Re-run verify for hostname");
  });
});
