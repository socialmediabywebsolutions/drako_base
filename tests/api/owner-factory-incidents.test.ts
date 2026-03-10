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
  const getFactoryIncidents = vi.fn();

  vi.doMock("@/lib/auth/session", () => ({
    requireOwnerAccess,
    UnauthorizedError,
  }));

  vi.doMock("@/lib/factory/incidents", () => ({
    getFactoryIncidents,
  }));

  const { GET } = await import("@/app/api/owner/factory/incidents/route");

  return {
    GET,
    requireOwnerAccess,
    getFactoryIncidents,
    UnauthorizedError,
  };
}

describe("GET /api/owner/factory/incidents", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    const { GET, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/incidents") as any);

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    const { GET, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/incidents") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with the incident feed for owner", async () => {
    const { GET, requireOwnerAccess, getFactoryIncidents } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryIncidents.mockResolvedValue({
      limit: 20,
      items: [
        {
          id: "job_failed_job_1",
          kind: "JOB_FAILED",
          severity: "critical",
          title: "Provisioning job failed",
          message: "Job job_1 failed during provisioning.",
          relatedJobId: "job_1",
          relatedSaasId: "saas_1",
          relatedDomain: null,
          state: "FAILED",
          createdAt: "2026-03-10T10:00:00.000Z",
          updatedAt: "2026-03-10T10:05:00.000Z",
        },
      ],
      summary: {
        total: 1,
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
      },
    });

    const response = await GET(new Request("https://drako.systems/api/owner/factory/incidents") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      incidents: {
        limit: number;
        items: Array<{ id: string; kind: string }>;
        summary: { total: number; critical: number };
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.incidents.limit).toBe(20);
    expect(payload.incidents.items[0]).toMatchObject({
      id: "job_failed_job_1",
      kind: "JOB_FAILED",
    });
    expect(payload.incidents.summary).toMatchObject({
      total: 1,
      critical: 1,
    });
    expect(getFactoryIncidents).toHaveBeenCalledWith("tenant_owner", { limit: undefined });
  });

  it("passes the parsed limit query param to the service", async () => {
    const { GET, requireOwnerAccess, getFactoryIncidents } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryIncidents.mockResolvedValue({
      limit: 50,
      items: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    });

    const response = await GET(
      new Request("https://drako.systems/api/owner/factory/incidents?limit=50") as any,
    );

    expect(response.status).toBe(200);
    expect(getFactoryIncidents).toHaveBeenCalledWith("tenant_owner", { limit: 50 });
  });
});
