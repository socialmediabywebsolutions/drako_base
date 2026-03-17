import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnerAccess,
  getFactoryRecoveryCandidates,
  UnauthorizedError,
} = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireOwnerAccess: vi.fn(),
    getFactoryRecoveryCandidates: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/factory/recovery", () => ({
  getFactoryRecoveryCandidates,
}));

import { GET } from "@/app/api/owner/factory/auto-recovery/route";

describe("GET /api/owner/factory/auto-recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/auto-recovery") as any);

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/auto-recovery") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with recovery candidates", async () => {
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
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryRecoveryCandidates.mockResolvedValue([]);

    const response = await GET(new Request("https://drako.systems/api/owner/factory/auto-recovery?limit=15") as any);

    expect(response.status).toBe(200);
    expect(getFactoryRecoveryCandidates).toHaveBeenCalledWith("tenant_owner", { limit: 15 });
  });
});
