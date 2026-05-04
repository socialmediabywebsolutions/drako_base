import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  UnauthorizedError,
  requireOwnerAccess,
  getMentoriaOperatorSystemHealth,
} = vi.hoisted(() => {
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
    getMentoriaOperatorSystemHealth: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/mentoria/contracts/observability", () => ({
  getMentoriaOperatorSystemHealth,
}));

import { GET } from "@/app/api/operator/mentoria/health/system/route";

describe("operator Mentoria system health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the Mentoria operator observability contract for owner requests", async () => {
    const health = {
      notifications: { pending: 1, failed: 0, abandoned: 0, total: 5 },
      feedback: { pending: 0, failed: 1, total: 3 },
      publishes: { pending: 2, failed: 0, abandoned: 1, total: 4 },
      criticalEvents: 2,
      silence: {
        studentsWithoutRecentFeedback: 1,
        studentsWithoutRecentParentNotification: 0,
        studentsWithoutRecentAcademicActivity: 3,
      },
    };

    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_1" });
    getMentoriaOperatorSystemHealth.mockResolvedValue(health);

    const response = await GET(new Request("https://base.drako.systems/api/operator/mentoria/health/system"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      tenantId: "tenant_1",
      health,
    });
    expect(getMentoriaOperatorSystemHealth).toHaveBeenCalledWith({ tenantId: "tenant_1" });
  });

  it("fails closed when owner access is missing", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://base.drako.systems/api/operator/mentoria/health/system"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SESSION_REQUIRED",
    });
    expect(getMentoriaOperatorSystemHealth).not.toHaveBeenCalled();
  });
});
