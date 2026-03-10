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
  const getFactoryRecoveryCandidates = vi.fn();

  vi.doMock("@/lib/auth/session", () => ({
    requireOwnerAccess,
    UnauthorizedError,
  }));

  vi.doMock("@/lib/factory/recovery", () => ({
    getFactoryRecoveryCandidates,
  }));

  const { GET } = await import("@/app/api/owner/factory/auto-recovery/route");

  return {
    GET,
    requireOwnerAccess,
    getFactoryRecoveryCandidates,
    UnauthorizedError,
  };
}

describe("GET /api/owner/factory/auto-recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    const { GET, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/auto-recovery") as any);

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    const { GET, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/auto-recovery") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with recovery candidates", async () => {
    const { GET, requireOwnerAccess, getFactoryRecoveryCandidates } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryRecoveryCandidates.mockResolvedValue([
      {
        id: "recovery_job_failed_job_1",
        type: "retry_job",
        relatedJobId: "job_1",
        reason: "Failed provisioning jobs can be retried when the underlying error is transient.",
      },
    ]);

    const response = await GET(new Request("https://drako.systems/api/owner/factory/auto-recovery") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      recoveryCandidates: Array<{ id: string; type: string; relatedJobId?: string }>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.recoveryCandidates).toEqual([
      expect.objectContaining({
        id: "recovery_job_failed_job_1",
        type: "retry_job",
        relatedJobId: "job_1",
      }),
    ]);
    expect(getFactoryRecoveryCandidates).toHaveBeenCalledWith("tenant_owner", { limit: undefined });
  });

  it("passes the optional limit query param to the service", async () => {
    const { GET, requireOwnerAccess, getFactoryRecoveryCandidates } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryRecoveryCandidates.mockResolvedValue([]);

    const response = await GET(
      new Request("https://drako.systems/api/owner/factory/auto-recovery?limit=15") as any,
    );

    expect(response.status).toBe(200);
    expect(getFactoryRecoveryCandidates).toHaveBeenCalledWith("tenant_owner", { limit: 15 });
  });
});
