import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentMentoriaSession: vi.fn(),
  getHealthStatus: vi.fn(),
}));

vi.mock("@/lib/mentoria/auth/request", () => ({
  requireCurrentMentoriaSession: mocks.requireCurrentMentoriaSession,
}));

vi.mock("@/lib/mentoria/resilience/orchestrator", () => ({
  getMentoriaOrchestrator: () => ({
    getHealthStatus: mocks.getHealthStatus,
  }),
}));

import { GET } from "@/app/api/mentoria/health/system/route";

describe("mentoria system health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns resilience health for authenticated tenant", async () => {
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_1",
      email: "family@example.com",
      tenantId: "tenant_1",
      role: "user",
    });
    mocks.getHealthStatus.mockResolvedValue({
      notifications: { pending: 1, failed: 2, abandoned: 0, total: 8 },
      feedback: { pending: 0, failed: 1, total: 3 },
      publishes: { pending: 2, failed: 0, abandoned: 1, total: 4 },
      criticalEvents: 5,
      silence: {
        studentsWithoutRecentFeedback: 2,
        studentsWithoutRecentParentNotification: 1,
        studentsWithoutRecentAcademicActivity: 3,
      },
    });

    const response = await GET(new Request("https://mentoria.drako.systems/api/mentoria/health/system"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      tenantId: "tenant_1",
      health: {
        notifications: { failed: 2 },
        feedback: { total: 3 },
        publishes: { abandoned: 1 },
        criticalEvents: 5,
        silence: { studentsWithoutRecentAcademicActivity: 3 },
      },
    });
    expect(mocks.getHealthStatus).toHaveBeenCalledWith("tenant_1");
  });

  it("fails closed when session is missing", async () => {
    mocks.requireCurrentMentoriaSession.mockRejectedValue(new Error("SESSION_REQUIRED"));

    const response = await GET(new Request("https://mentoria.drako.systems/api/mentoria/health/system"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SESSION_REQUIRED",
    });
  });
});
