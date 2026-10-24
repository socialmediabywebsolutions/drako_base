import { beforeEach, describe, expect, it, vi } from "vitest";

const { UnauthorizedError, requireOwnerAccess, getFactoryOperatorActions } = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.name = "UnauthorizedError";
      this.status = status;
    }
  }

  return {
    UnauthorizedError: HoistedUnauthorizedError,
    requireOwnerAccess: vi.fn(),
    getFactoryOperatorActions: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/factory/actions", () => ({
  getFactoryOperatorActions,
}));

import { GET } from "@/app/api/owner/factory/actions/route";

describe("GET /api/owner/factory/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/actions") as any);

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/factory/actions") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with recommended actions", async () => {
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryOperatorActions.mockResolvedValue([
      {
        id: "action_job_failed_job_1",
        severity: "critical",
        title: "Investigate failed provisioning job",
        description: "Job job_1 failed during provisioning.",
        recommendation: "Inspect job logs and retry provisioning if the error is transient.",
        relatedIncidentId: "job_failed_job_1",
        relatedJobId: "job_1",
        relatedDomain: null,
      },
    ]);

    const response = await GET(new Request("https://drako.systems/api/owner/factory/actions") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      actions: Array<{ id: string; severity: string; title: string }>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.actions).toEqual([
      expect.objectContaining({
        id: "action_job_failed_job_1",
        severity: "critical",
        title: "Investigate failed provisioning job",
      }),
    ]);
    expect(getFactoryOperatorActions).toHaveBeenCalledWith("tenant_owner", { limit: undefined });
  });

  it("passes the optional limit query param to the service", async () => {
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    getFactoryOperatorActions.mockResolvedValue([]);

    const response = await GET(
      new Request("https://drako.systems/api/owner/factory/actions?limit=15") as any,
    );

    expect(response.status).toBe(200);
    expect(getFactoryOperatorActions).toHaveBeenCalledWith("tenant_owner", { limit: 15 });
  });
});
