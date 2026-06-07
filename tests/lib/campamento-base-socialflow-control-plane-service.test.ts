import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const {
  fetchSocialFlowObservabilitySnapshot,
  postSocialFlowOperatorAction,
  triggerSocialFlowAutomation,
  SocialFlowControlPlaneInternalApiError,
} = vi.hoisted(() => {
  class HoistedSocialFlowControlPlaneInternalApiError extends Error {
    status: number;
    code: "INTERNAL_API_BAD_REQUEST" | "INTERNAL_API_UNAUTHORIZED" | "INTERNAL_API_FORBIDDEN";
    requestId: string;

    constructor(input: {
      status: number;
      code: "INTERNAL_API_BAD_REQUEST" | "INTERNAL_API_UNAUTHORIZED" | "INTERNAL_API_FORBIDDEN";
      message: string;
      requestId: string;
    }) {
      super(input.message);
      this.name = "SocialFlowControlPlaneInternalApiError";
      this.status = input.status;
      this.code = input.code;
      this.requestId = input.requestId;
    }
  }

  return {
    fetchSocialFlowObservabilitySnapshot: vi.fn(),
    postSocialFlowOperatorAction: vi.fn(),
    triggerSocialFlowAutomation: vi.fn(),
    SocialFlowControlPlaneInternalApiError: HoistedSocialFlowControlPlaneInternalApiError,
  };
});

const {
  registerAutomation,
  enableAutomation,
  disableAutomation,
  getAutomation,
  listAutomations,
  listAutomationExecutions,
  triggerAutomation,
  registerAutomationHandler,
  getAutomationExecutionSummary,
  AutomationCoreError,
} = vi.hoisted(() => {
  class HoistedAutomationCoreError extends Error {
    code: string;

    constructor(code: string, message?: string) {
      super(message ?? code);
      this.name = "AutomationCoreError";
      this.code = code;
    }
  }

  return {
    registerAutomation: vi.fn(),
    enableAutomation: vi.fn(),
    disableAutomation: vi.fn(),
    getAutomation: vi.fn(),
    listAutomations: vi.fn(),
    listAutomationExecutions: vi.fn(),
    triggerAutomation: vi.fn(),
    registerAutomationHandler: vi.fn(),
    getAutomationExecutionSummary: vi.fn(),
    AutomationCoreError: HoistedAutomationCoreError,
  };
});

vi.mock("@/lib/capabilities/internal-api-clients/socialflow-control-plane", () => ({
  fetchSocialFlowObservabilitySnapshot,
  postSocialFlowOperatorAction,
  triggerSocialFlowAutomation,
  SocialFlowControlPlaneInternalApiError,
}));

vi.mock("@/lib/automation-core", () => ({
  registerAutomation,
  enableAutomation,
  disableAutomation,
  getAutomation,
  listAutomations,
  listAutomationExecutions,
  triggerAutomation,
  registerAutomationHandler,
  getAutomationExecutionSummary,
  AutomationCoreError,
}));

import {
  getCampoBaseSocialFlowObservability,
  runCampoBaseSocialAutomation,
  runCampoBaseSocialFlowOperatorAction,
} from "@/lib/campamento-base/socialflow-control-plane-service";

describe("campamento-base socialflow control-plane service", () => {
  it("does not import forbidden modules", () => {
    const source = readFileSync(
      "src/lib/campamento-base/socialflow-control-plane-service.ts",
      "utf8",
    );

    expect(source).not.toContain("@/lib/socialflow/contracts/campobase");
    expect(source).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(source).not.toContain("@/lib/campobase/socialflow-service");
    expect(source).not.toContain("@/lib/campobase/");
  });

  it("uses neutral control-plane client", () => {
    const source = readFileSync(
      "src/lib/campamento-base/socialflow-control-plane-service.ts",
      "utf8",
    );

    expect(source).toContain("@/lib/capabilities/internal-api-clients/socialflow-control-plane");
    expect(source).toContain("triggerSocialFlowAutomation");
    expect(source).toContain("fetchSocialFlowObservabilitySnapshot");
    expect(source).toContain("postSocialFlowOperatorAction");
  });

  it("returns legacy-compatible automation shape", async () => {
    triggerSocialFlowAutomation.mockResolvedValue({
      service: "socialflow",
      runtime: "monolith",
      accepted: true,
      automationId: "auto-123",
      automationType: "generate_schedule",
      requestId: "req-1",
      tenantId: "tenant-a",
      timestamp: "2026-06-06T00:00:00.000Z",
      status: "queued",
    });

    const result = await runCampoBaseSocialAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    expect(result).toEqual({
      campaignId: "auto-123",
      postsCount: 0,
      scheduledCount: 0,
      schedule: [],
    });
  });

  it("returns legacy-compatible observability shape", async () => {
    fetchSocialFlowObservabilitySnapshot.mockResolvedValue({
      service: "socialflow",
      runtime: "monolith",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-obs",
      tenantId: "tenant-a",
      status: "ok",
      metrics: {
        activeAutomations: 2,
        queuedJobs: 5,
        failedJobsLast24h: 1,
        successfulJobsLast24h: 9,
        averageLatencyMs: 42,
      },
      recentErrors: [
        {
          code: "WARN_1",
          message: "warning",
          occurredAt: "2026-06-06T00:00:00.000Z",
        },
      ],
      warnings: ["SOCIALFLOW_OBSERVABILITY_SNAPSHOT_NEUTRAL_VALUES"],
    });

    const result = await getCampoBaseSocialFlowObservability("tenant-a", "saas-a");

    expect(result.tenantId).toBe("tenant-a");
    expect(result.saasId).toBe("saas-a");
    expect(result.health.status).toBe("healthy");
    expect(result.scheduler.dueScheduledPosts).toBe(5);
    expect(result.posts.total).toBe(0);
    expect(Array.isArray(result.recentIncidents)).toBe(true);
  });

  it("handles client errors in controlled way for observability", async () => {
    fetchSocialFlowObservabilitySnapshot.mockRejectedValue(
      new SocialFlowControlPlaneInternalApiError({
        status: 500,
        code: "INTERNAL_API_BAD_REQUEST",
        message: "boom",
        requestId: "req-err",
      }),
    );

    const result = await getCampoBaseSocialFlowObservability("tenant-x", "saas-x");

    expect(result.health.status).toBe("unknown");
    expect(result.health.recommendation).toContain("temporarily unavailable");
  });

  it("returns operator action shape compatible with legacy", async () => {
    postSocialFlowOperatorAction.mockResolvedValue({
      service: "socialflow",
      runtime: "monolith",
      accepted: true,
      actionId: "op-1",
      actionType: "request_diagnostics",
      requestId: "req-op",
      tenantId: "tenant-a",
      timestamp: "2026-06-06T00:00:00.000Z",
      status: "queued",
    });

    const result = await runCampoBaseSocialFlowOperatorAction({
      action: "recover_stale_publishing",
      tenantId: "tenant-a",
      saasId: "saas-a",
    });

    expect(result.action).toBe("recover_stale_publishing");
    expect(result.message).toContain("queued via control-plane");
    expect(result.items).toEqual([]);
  });

  it("does not create any new file named campobase", () => {
    const files = [
      "src/lib/campamento-base/socialflow-control-plane-service.ts",
      "tests/lib/campamento-base-socialflow-control-plane-service.test.ts",
    ];
    expect(files.some((file) => file.includes("campobase"))).toBe(false);
  });
});
