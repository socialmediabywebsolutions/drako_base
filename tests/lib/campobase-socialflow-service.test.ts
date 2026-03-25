import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  registerAutomation,
  enableAutomation,
  disableAutomation,
  getAutomation,
  listAutomations,
  listAutomationExecutions,
  triggerAutomation,
  registerAutomationHandler,
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
    AutomationCoreError: HoistedAutomationCoreError,
  };
});

vi.mock("@/lib/automation-core", () => ({
  registerAutomation,
  enableAutomation,
  disableAutomation,
  getAutomation,
  listAutomations,
  listAutomationExecutions,
  getAutomationExecutionSummary: vi.fn(),
  triggerAutomation,
  registerAutomationHandler,
  AutomationCoreError,
}));

vi.mock("@/lib/social/ai/socialflow-engine", () => ({
  runSocialFlowEngine: vi.fn(),
}));

import {
  SOCIALFLOW_CONTENT_GENERATION_KEY,
  SOCIALFLOW_HEALTH_CHECK_KEY,
  SOCIALFLOW_AUTOMATION_KEY,
  disableCampoBaseSocialAutomationForSaas,
  enableCampoBaseSocialAutomationForSaas,
  getCampoBaseSocialAutomationStatus,
  listCampoBaseSocialAutomationRuns,
  listCampoBaseSocialAutomationRunsForSaas,
  registerCampoBaseSocialAutomation,
  registerCampoBaseSocialHealthCheck,
  runCampoBaseSocialHealthCheckForRegisteredSaas,
  runCampoBaseSocialAutomationForRegisteredSaas,
} from "@/lib/campobase/socialflow-service";

describe("campobase socialflow service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers SocialFlow automation in the automation core", async () => {
    registerAutomation.mockResolvedValue({
      id: "automation-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      displayName: "SocialFlow content generation",
      description: "desc",
      enabled: true,
      scheduleMode: "scheduled",
      frequencyUnit: "week",
      frequencyValue: 2,
      config: { niche: "fitness", tone: "direct", frequencyPerWeek: 2 },
      ownerScope: "OWNER",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const result = await registerCampoBaseSocialAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
    });

    expect(registerAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: SOCIALFLOW_AUTOMATION_KEY,
        scheduleMode: "scheduled",
        frequencyUnit: "week",
        frequencyValue: 2,
        config: { niche: "fitness", tone: "direct", frequencyPerWeek: 2 },
      }),
    );
    expect(result.enabled).toBe(true);
    expect(result.frequencyPerWeek).toBe(2);
  });

  it("registers SocialFlow health check as a second automation", async () => {
    registerAutomation.mockResolvedValue({
      id: "automation-2",
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_HEALTH_CHECK_KEY,
      displayName: "SocialFlow health check",
      description: "desc",
      enabled: true,
      scheduleMode: "manual",
      frequencyUnit: "day",
      frequencyValue: 1,
      config: { tone: "operational", frequencyPerWeek: 1 },
      ownerScope: "OWNER",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const result = await registerCampoBaseSocialHealthCheck({
      tenantId: "tenant-a",
      saasId: "saas-a",
      tone: "operational",
    });

    expect(registerAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        automationKey: SOCIALFLOW_HEALTH_CHECK_KEY,
        scheduleMode: "manual",
        frequencyUnit: "day",
      }),
    );
    expect(result.automationKey).toBe(SOCIALFLOW_HEALTH_CHECK_KEY);
  });

  it("runs registered SocialFlow automation through the automation core", async () => {
    triggerAutomation.mockResolvedValue({
      execution: { id: "execution-1" },
      result: {
        ok: true,
        summary: "Generated",
        metrics: { postsCount: 3, scheduledCount: 2 },
        output: {
          campaignId: "campaign-1",
          schedule: [{ postId: "post-1", scheduledAt: "2024-01-01T00:00:00.000Z" }],
        },
        error: null,
      },
    });

    const result = await runCampoBaseSocialAutomationForRegisteredSaas("tenant-a", "saas-a");

    expect(triggerAutomation).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      triggerType: "manual",
      triggeredBy: "owner",
    });
    expect(result.campaignId).toBe("campaign-1");
    expect(result.postsCount).toBe(3);
    expect(result.scheduledCount).toBe(2);
  });

  it("runs registered SocialFlow health check through the automation core", async () => {
    triggerAutomation.mockResolvedValue({
      execution: { id: "execution-2" },
      result: {
        ok: true,
        summary: "Health ok",
        metrics: { checksPassed: 3, checksFailed: 0 },
        output: { recommendedAction: "Ready for scheduling" },
        error: null,
      },
    });

    const result = await runCampoBaseSocialHealthCheckForRegisteredSaas("tenant-a", "saas-a");

    expect(triggerAutomation).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_HEALTH_CHECK_KEY,
      triggerType: "manual",
      triggeredBy: "owner",
    });
    expect(result.checksPassed).toBe(3);
    expect(result.recommendedAction).toBe("Ready for scheduling");
  });

  it("maps missing registration and disabled registration errors", async () => {
    triggerAutomation.mockRejectedValueOnce(new AutomationCoreError("AUTOMATION_NOT_REGISTERED"));
    await expect(runCampoBaseSocialAutomationForRegisteredSaas("tenant-a", "saas-a")).rejects.toThrow("NOT_CONFIGURED");

    triggerAutomation.mockRejectedValueOnce(new AutomationCoreError("AUTOMATION_DISABLED"));
    await expect(runCampoBaseSocialAutomationForRegisteredSaas("tenant-a", "saas-a")).rejects.toThrow("DISABLED");
  });

  it("returns SocialFlow status from the automation core", async () => {
    listAutomations.mockResolvedValue([
      {
        id: "automation-1",
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: SOCIALFLOW_AUTOMATION_KEY,
        displayName: "SocialFlow content generation",
        description: null,
        enabled: true,
        scheduleMode: "scheduled",
        frequencyUnit: "week",
        frequencyValue: 2,
        config: { niche: "fitness", tone: "direct", frequencyPerWeek: 2 },
        ownerScope: "OWNER",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "automation-2",
        tenantId: "tenant-b",
        saasId: "saas-b",
        automationKey: SOCIALFLOW_AUTOMATION_KEY,
        displayName: "SocialFlow content generation",
        description: null,
        enabled: false,
        scheduleMode: "scheduled",
        frequencyUnit: "week",
        frequencyValue: 3,
        config: { niche: "clinic", tone: "warm", frequencyPerWeek: 3 },
        ownerScope: "OWNER",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      },
      {
        id: "automation-3",
        tenantId: "tenant-c",
        saasId: "saas-c",
        automationKey: SOCIALFLOW_HEALTH_CHECK_KEY,
        displayName: "SocialFlow health check",
        description: null,
        enabled: true,
        scheduleMode: "manual",
        frequencyUnit: "day",
        frequencyValue: 1,
        config: { tone: "operational", frequencyPerWeek: 1 },
        ownerScope: "OWNER",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-03T00:00:00.000Z",
      },
    ]);

    const status = await getCampoBaseSocialAutomationStatus();

    expect(status.total).toBe(3);
    expect(status.enabled).toBe(2);
    expect(status.disabled).toBe(1);
    expect(status.items[0].niche).toBe("fitness");
    expect(status.items.some((item) => item.automationKey === SOCIALFLOW_HEALTH_CHECK_KEY)).toBe(true);
  });

  it("enables and disables a registered SocialFlow automation", async () => {
    enableAutomation.mockResolvedValue({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      displayName: "SocialFlow content generation",
      enabled: true,
      config: { niche: "fitness", tone: "direct", frequencyPerWeek: 2 },
      updatedAt: "2024-01-05T00:00:00.000Z",
    });
    disableAutomation.mockResolvedValue({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      displayName: "SocialFlow content generation",
      enabled: false,
      config: { niche: "fitness", tone: "direct", frequencyPerWeek: 2 },
      updatedAt: "2024-01-06T00:00:00.000Z",
    });

    const enabled = await enableCampoBaseSocialAutomationForSaas("tenant-a", "saas-a");
    const disabled = await disableCampoBaseSocialAutomationForSaas("tenant-a", "saas-a");

    expect(enabled.enabled).toBe(true);
    expect(disabled.enabled).toBe(false);
  });

  it("lists execution history through the automation core", async () => {
    listAutomationExecutions.mockResolvedValue([
      {
        id: "execution-1",
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: SOCIALFLOW_CONTENT_GENERATION_KEY,
        status: "SUCCESS",
        output: { campaignId: "campaign-1" },
        metrics: { postsCount: 2, scheduledCount: 1 },
        errorMessage: null,
        startedAt: "2024-01-01T00:00:00.000Z",
        finishedAt: "2024-01-01T00:05:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:05:00.000Z",
      },
      {
        id: "execution-2",
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: SOCIALFLOW_HEALTH_CHECK_KEY,
        status: "FAILED",
        output: null,
        metrics: {},
        errorMessage: "BOOM",
        startedAt: "2024-01-02T00:00:00.000Z",
        finishedAt: "2024-01-02T00:01:00.000Z",
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:01:00.000Z",
      },
    ]);

    const allRuns = await listCampoBaseSocialAutomationRuns();
    const saasRuns = await listCampoBaseSocialAutomationRunsForSaas("tenant-a", "saas-a");

    expect(allRuns).toHaveLength(2);
    expect(allRuns[0].campaignId).toBe("campaign-1");
    expect(allRuns[1].automationKey).toBe(SOCIALFLOW_HEALTH_CHECK_KEY);
    expect(saasRuns[1].error).toBe("BOOM");
  });
});
