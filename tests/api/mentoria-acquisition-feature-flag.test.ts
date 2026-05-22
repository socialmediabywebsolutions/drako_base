import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentMentoriaSession: vi.fn(),
  acquisitionPublisherConstructor: vi.fn(),
  acquisitionSchedulerConstructor: vi.fn(),
  publisher: {
    getPerformanceMetrics: vi.fn(),
    trackClick: vi.fn(),
    trackSignup: vi.fn(),
    trackTrialStart: vi.fn(),
  },
  scheduler: {
    getScheduledPostsForNextDays: vi.fn(),
    generateAndScheduleDailyPosts: vi.fn(),
    getPendingPosts: vi.fn(),
    markAsPublished: vi.fn(),
    markAsFailed: vi.fn(),
  },
}));

vi.mock("@/lib/mentoria/auth/request", () => ({
  requireCurrentMentoriaSession: mocks.requireCurrentMentoriaSession,
}));

vi.mock("@/lib/mentoria/acquisition-publishing", () => ({
  AcquisitionPublisher: class AcquisitionPublisher {
    constructor() {
      mocks.acquisitionPublisherConstructor();
      return mocks.publisher;
    }
  },
}));

vi.mock("@/lib/mentoria/acquisition-scheduler", () => ({
  AcquisitionScheduler: class AcquisitionScheduler {
    constructor(params: { tenantId: string }) {
      mocks.acquisitionSchedulerConstructor(params);
      return mocks.scheduler;
    }
  },
}));

import { GET, POST } from "@/app/api/mentoria/acquisition/route";

describe("Acquisition API feature flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ACQUISITION_ENABLED;

    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_admin",
      email: "admin@example.com",
      tenantId: "tenant_a",
      role: "admin",
    });

    mocks.publisher.getPerformanceMetrics.mockResolvedValue({
      totalPosts: 0,
      totalClicks: 0,
      totalSignups: 0,
      totalTrialStarts: 0,
      conversionRate: 0,
    });
    mocks.publisher.trackClick.mockResolvedValue(undefined);
    mocks.publisher.trackSignup.mockResolvedValue(undefined);
    mocks.publisher.trackTrialStart.mockResolvedValue(undefined);

    mocks.scheduler.getScheduledPostsForNextDays.mockResolvedValue([]);
    mocks.scheduler.generateAndScheduleDailyPosts.mockResolvedValue([]);
    mocks.scheduler.getPendingPosts.mockResolvedValue([]);
    mocks.scheduler.markAsPublished.mockResolvedValue(undefined);
    mocks.scheduler.markAsFailed.mockResolvedValue(undefined);
  });

  it("keeps acquisition disabled by default and returns 501 when env var is missing", async () => {
    const response = await GET(new Request("https://mentoria.local/api/mentoria/acquisition", { method: "GET" }));
    const payload = (await response.json()) as { ok: boolean; error: string; message: string };

    expect(response.status).toBe(501);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("FEATURE_NOT_AVAILABLE");
    expect(payload.message).toContain("0186");
    expect(payload.message).toContain("not yet deployed");

    expect(mocks.acquisitionPublisherConstructor).not.toHaveBeenCalled();
    expect(mocks.acquisitionSchedulerConstructor).not.toHaveBeenCalled();
  });

  it("returns 501 and does not touch D1 classes when disabled explicitly", async () => {
    process.env.ACQUISITION_ENABLED = "false";

    const response = await POST(
      new Request("https://mentoria.local/api/mentoria/acquisition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_daily" }),
      })
    );
    const payload = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(501);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("FEATURE_NOT_AVAILABLE");

    expect(mocks.acquisitionPublisherConstructor).not.toHaveBeenCalled();
    expect(mocks.acquisitionSchedulerConstructor).not.toHaveBeenCalled();
  });

  it("requires admin context when feature is enabled", async () => {
    process.env.ACQUISITION_ENABLED = "true";
    mocks.requireCurrentMentoriaSession.mockResolvedValueOnce({
      userId: "user_student",
      email: "student@example.com",
      tenantId: "tenant_a",
      role: "student",
    });

    const response = await GET(new Request("https://mentoria.local/api/mentoria/acquisition", { method: "GET" }));
    const payload = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe("UNAUTHORIZED");
    expect(mocks.acquisitionPublisherConstructor).not.toHaveBeenCalled();
    expect(mocks.acquisitionSchedulerConstructor).not.toHaveBeenCalled();
  });

  it("uses admin tenant context for metrics when enabled", async () => {
    process.env.ACQUISITION_ENABLED = "true";

    const response = await GET(new Request("https://mentoria.local/api/mentoria/acquisition", { method: "GET" }));
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.acquisitionSchedulerConstructor).toHaveBeenCalledWith({ tenantId: "tenant_a" });
    expect(mocks.publisher.getPerformanceMetrics).toHaveBeenCalledWith("tenant_a");
    expect(mocks.scheduler.getScheduledPostsForNextDays).toHaveBeenCalledWith(7);
  });

  it("prevents cross-tenant tracking by forcing actor tenant over request payload", async () => {
    process.env.ACQUISITION_ENABLED = "true";

    const response = await POST(
      new Request("https://mentoria.local/api/mentoria/acquisition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "track_click",
          postId: "post_123",
          tenantId: "tenant_b",
        }),
      })
    );
    const payload = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe("Click tracked");
    expect(mocks.publisher.trackClick).toHaveBeenCalledWith("post_123", "tenant_a");
  });
});
