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
  const getFactoryStatus = vi.fn();

  vi.doMock("@/lib/auth/session", () => ({
    requireOwnerAccess,
    UnauthorizedError,
  }));

  vi.doMock("@/lib/factory/status", () => ({
    getFactoryStatus,
  }));

  const { GET } = await import("@/app/api/owner/factory/status/route");

  return {
    GET,
    requireOwnerAccess,
    getFactoryStatus,
    UnauthorizedError,
  };
}

describe("GET /api/owner/factory/status", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    const { GET, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/status") as any);

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    const { GET, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/status") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with the aggregated factory payload", async () => {
    const { GET, requireOwnerAccess, getFactoryStatus } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryStatus.mockResolvedValue({
      activeSaas: 4,
      jobs: {
        created: 1,
        running: 1,
        degraded: 0,
        failed: 0,
        succeeded: 12,
      },
      domains: {
        pending: 1,
        provisioning: 0,
        active: 4,
        failed: 0,
      },
      quota: {
        plan: "pro",
        maxSaas: 5,
        maxDomains: 10,
        maxConcurrentJobs: 3,
      },
      usage: {
        saasCount: 4,
        activeJobCount: 2,
        domainCount: 5,
      },
      limits: {
        saasRemaining: 1,
        jobSlotsRemaining: 1,
        domainsRemaining: 5,
      },
      slo: {
        degraded: false,
        failing: false,
      },
    });

    const response = await GET(new Request("https://drako.systems/api/owner/factory/status") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      factory: {
        activeSaas: number;
        jobs: { running: number };
        domains: { pending: number };
        quota: { plan: string };
        limits: { jobSlotsRemaining: number };
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.factory.activeSaas).toBe(4);
    expect(payload.factory.jobs.running).toBe(1);
    expect(payload.factory.domains.pending).toBe(1);
    expect(payload.factory.quota.plan).toBe("pro");
    expect(payload.factory.limits.jobSlotsRemaining).toBe(1);
    expect(getFactoryStatus).toHaveBeenCalledWith("tenant_owner");
  });
});
