import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHealthStatus: vi.fn(),
}));

vi.mock("@/lib/mentoria/resilience/orchestrator", () => ({
  getMentoriaOrchestrator: () => ({
    getHealthStatus: mocks.getHealthStatus,
  }),
}));

import { getMentoriaOperatorSystemHealth } from "@/lib/mentoria/contracts/observability";

describe("Mentoria operator observability contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads system health through the Mentoria public operator contract", async () => {
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

    mocks.getHealthStatus.mockResolvedValue(health);

    await expect(getMentoriaOperatorSystemHealth({ tenantId: " tenant_1 " })).resolves.toEqual(health);
    expect(mocks.getHealthStatus).toHaveBeenCalledWith("tenant_1");
  });

  it("fails closed when tenant id is missing", async () => {
    await expect(getMentoriaOperatorSystemHealth({ tenantId: " " })).rejects.toThrow(
      "MENTORIA_OBSERVABILITY_TENANT_REQUIRED",
    );
    expect(mocks.getHealthStatus).not.toHaveBeenCalled();
  });
});
