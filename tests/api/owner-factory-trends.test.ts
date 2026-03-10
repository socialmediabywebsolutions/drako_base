import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadRoute() {
  class UnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.name = "UnauthorizedError";
      this.status = status;
    }
  }

  const requireOwnerAccess = vi.fn();
  const getFactoryTrends = vi.fn();

  vi.doMock("@/lib/auth/session", () => ({
    requireOwnerAccess,
    UnauthorizedError,
  }));

  vi.doMock("@/lib/factory/trends", () => ({
    getFactoryTrends,
  }));

  const { GET } = await import("@/app/api/owner/factory/trends/route");

  return {
    GET,
    requireOwnerAccess,
    getFactoryTrends,
    UnauthorizedError,
  };
}

describe("GET /api/owner/factory/trends", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    const { GET, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/trends") as any);

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    const { GET, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/trends") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with trend payload for owner", async () => {
    const { GET, requireOwnerAccess, getFactoryTrends } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryTrends.mockResolvedValue({
      limit: 10,
      recentJobs: [
        {
          jobId: "job_1",
          saasId: "saas_1",
          state: "FAILED",
          correlationId: "corr_1",
          createdAt: "2026-03-10T08:00:00.000Z",
          updatedAt: "2026-03-10T08:05:00.000Z",
          lastError: "fatal create failure",
        },
      ],
      recentDomains: [
        {
          domain: "foo.drako.systems",
          saasId: "saas_1",
          status: "pending",
          updatedAt: "2026-03-10T08:05:00.000Z",
        },
      ],
      recentFailures: [
        {
          jobId: "job_1",
          saasId: "saas_1",
          state: "FAILED",
          correlationId: "corr_1",
          updatedAt: "2026-03-10T08:05:00.000Z",
          lastError: "fatal create failure",
        },
      ],
      summary: {
        totalRecentFailed: 1,
        totalRecentDegraded: 0,
        totalRecentSucceeded: 0,
      },
      trendFlags: {
        failing: true,
        degraded: false,
        recovering: false,
      },
    });

    const response = await GET(new Request("https://drako.systems/api/owner/factory/trends") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      trends: {
        limit: number;
        recentJobs: Array<{ jobId: string; state: string }>;
        recentDomains: Array<{ domain: string }>;
        summary: { totalRecentFailed: number };
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.trends.limit).toBe(10);
    expect(payload.trends.recentJobs[0]).toMatchObject({
      jobId: "job_1",
      state: "FAILED",
    });
    expect(payload.trends.recentDomains[0]).toMatchObject({
      domain: "foo.drako.systems",
    });
    expect(payload.trends.summary.totalRecentFailed).toBe(1);
    expect(getFactoryTrends).toHaveBeenCalledWith("tenant_owner", { limit: undefined });
  });

  it("passes the validated limit query param to the service", async () => {
    const { GET, requireOwnerAccess, getFactoryTrends } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryTrends.mockResolvedValue({
      limit: 25,
      recentJobs: [],
      recentDomains: [],
      recentFailures: [],
      summary: {
        totalRecentFailed: 0,
        totalRecentDegraded: 0,
        totalRecentSucceeded: 0,
      },
      trendFlags: {
        failing: false,
        degraded: false,
        recovering: false,
      },
    });

    const response = await GET(
      new Request("https://drako.systems/api/owner/factory/trends?limit=25") as any,
    );

    expect(response.status).toBe(200);
    expect(getFactoryTrends).toHaveBeenCalledWith("tenant_owner", { limit: 25 });
  });
});
