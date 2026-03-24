import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  UnauthorizedError,
  requireOwnerAccess,
  getCampoBaseSocialAutomationStatus,
  runCampoBaseSocialAutomationForAllRegisteredSaas,
  runCampoBaseSocialAutomationForRegisteredSaas,
  enableCampoBaseSocialAutomationForSaas,
  disableCampoBaseSocialAutomationForSaas,
  listCampoBaseSocialAutomationRuns,
  listCampoBaseSocialAutomationRunsForSaas,
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
    getCampoBaseSocialAutomationStatus: vi.fn(),
    runCampoBaseSocialAutomationForAllRegisteredSaas: vi.fn(),
    runCampoBaseSocialAutomationForRegisteredSaas: vi.fn(),
    enableCampoBaseSocialAutomationForSaas: vi.fn(),
    disableCampoBaseSocialAutomationForSaas: vi.fn(),
    listCampoBaseSocialAutomationRuns: vi.fn(),
    listCampoBaseSocialAutomationRunsForSaas: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/campobase/socialflow-service", () => ({
  getCampoBaseSocialAutomationStatus,
  runCampoBaseSocialAutomationForAllRegisteredSaas,
  runCampoBaseSocialAutomationForRegisteredSaas,
  enableCampoBaseSocialAutomationForSaas,
  disableCampoBaseSocialAutomationForSaas,
}));

vi.mock("@/lib/campobase/social-automation-history", () => ({
  listCampoBaseSocialAutomationRuns,
  listCampoBaseSocialAutomationRunsForSaas,
}));

import { GET, POST } from "@/app/api/campobase/socialflow/route";

type StatusPayload = {
  total: number;
  enabled: number;
  disabled: number;
  items: Array<{
    tenantId: string;
    saasId: string;
    enabled: boolean;
    niche: string;
    tone: string;
    frequencyPerWeek: number;
    updatedAt: string;
  }>;
};

type HistoryPayload = Array<{
  id: string;
  tenantId: string;
  saasId: string;
  status: "SUCCESS" | "FAILED";
  campaignId: string | null;
  postsCount: number;
  scheduledCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
}>;

type SummaryPayload = {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
  failedRate: number;
  totalPosts: number;
  totalScheduled: number;
  latestRunAt: string | null;
  latestFailedRunAt: string | null;
};

const baseStatus: StatusPayload = {
  total: 1,
  enabled: 1,
  disabled: 0,
  items: [
    {
      tenantId: "tenant-1",
      saasId: "saas-1",
      enabled: true,
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ],
};

const baseHistory: HistoryPayload = [
  {
    id: "run-1",
    tenantId: "tenant-1",
    saasId: "saas-1",
    status: "SUCCESS",
    campaignId: "campaign-1",
    postsCount: 2,
    scheduledCount: 2,
    error: null,
    startedAt: "2024-01-01T00:00:00.000Z",
    finishedAt: "2024-01-01T00:05:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "run-2",
    tenantId: "tenant-1",
    saasId: "saas-1",
    status: "FAILED",
    campaignId: null,
    postsCount: 0,
    scheduledCount: 0,
    error: "BOOM",
    startedAt: "2024-02-01T00:00:00.000Z",
    finishedAt: "2024-02-01T00:02:00.000Z",
    createdAt: "2024-02-01T00:00:00.000Z",
  },
];

const baseSummary: SummaryPayload = {
  totalRuns: 2,
  successRuns: 1,
  failedRuns: 1,
  successRate: 0.5,
  failedRate: 0.5,
  totalPosts: 2,
  totalScheduled: 2,
  latestRunAt: "2024-02-01T00:00:00.000Z",
  latestFailedRunAt: "2024-02-01T00:00:00.000Z",
};

function buildRequest(body?: unknown) {
  return new Request("https://drako.systems/api/campobase/socialflow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/campobase/socialflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerAccess.mockResolvedValue({ tenantId: "owner" });
    getCampoBaseSocialAutomationStatus.mockResolvedValue(baseStatus);
    listCampoBaseSocialAutomationRuns.mockResolvedValue(baseHistory);
    listCampoBaseSocialAutomationRunsForSaas.mockResolvedValue(baseHistory);
  });

  it("GET returns 200 with status and history", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { status: StatusPayload; history: HistoryPayload };
    expect(payload.status).toEqual(baseStatus);
    expect(payload.history).toEqual(baseHistory);
    expect(listCampoBaseSocialAutomationRuns).toHaveBeenCalledWith(25);
  });

  it("GET returns summary for unfiltered history", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { summary: SummaryPayload };
    expect(payload.summary.totalRuns).toBe(baseSummary.totalRuns);
    expect(payload.summary.successRuns).toBe(baseSummary.successRuns);
    expect(payload.summary.failedRuns).toBe(baseSummary.failedRuns);
    expect(payload.summary.totalPosts).toBe(baseSummary.totalPosts);
    expect(payload.summary.totalScheduled).toBe(baseSummary.totalScheduled);
    expect(payload.summary.latestRunAt).toBe(baseSummary.latestRunAt);
    expect(payload.summary.latestFailedRunAt).toBe(baseSummary.latestFailedRunAt);
    expect(payload.summary.successRate).toBeCloseTo(baseSummary.successRate, 5);
    expect(payload.summary.failedRate).toBeCloseTo(baseSummary.failedRate, 5);
  });

  it("GET filters history when tenantId and saasId are provided", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow?tenantId=tenant-1&saasId=saas-1") as any);

    expect(response.status).toBe(200);
    expect(listCampoBaseSocialAutomationRunsForSaas).toHaveBeenCalledWith("tenant-1", "saas-1", 25);
  });

  it("GET uses limit when provided", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow?limit=10") as any);

    expect(response.status).toBe(200);
    expect(listCampoBaseSocialAutomationRuns).toHaveBeenCalledWith(10);
  });

  it("GET filters by status", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow?status=FAILED") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { history: HistoryPayload; summary: SummaryPayload };
    expect(payload.history).toEqual([baseHistory[1]]);
    expect(payload.summary.totalRuns).toBe(1);
    expect(payload.summary.failedRuns).toBe(1);
    expect(payload.summary.latestFailedRunAt).toBe("2024-02-01T00:00:00.000Z");
  });

  it("GET filters by date range", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow?dateFrom=2024-02-01&dateTo=2024-02-28") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { history: HistoryPayload; summary: SummaryPayload };
    expect(payload.history).toEqual([baseHistory[1]]);
    expect(payload.summary.totalRuns).toBe(1);
    expect(payload.summary.failedRuns).toBe(1);
  });

  it("GET combines tenantId, saasId, status, and limit", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow?tenantId=tenant-1&saasId=saas-1&status=SUCCESS&limit=10") as any);

    expect(response.status).toBe(200);
    expect(listCampoBaseSocialAutomationRunsForSaas).toHaveBeenCalledWith("tenant-1", "saas-1", 10);
    const payload = await response.json() as { history: HistoryPayload };
    expect(payload.history).toEqual([baseHistory[0]]);
  });

  it("GET falls back to default limit on invalid limit", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow?limit=bad") as any);

    expect(response.status).toBe(200);
    expect(listCampoBaseSocialAutomationRuns).toHaveBeenCalledWith(25);
  });

  it("GET ignores invalid status and dates", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow?status=INVALID&dateFrom=bad&dateTo=bad") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { history: HistoryPayload };
    expect(payload.history).toEqual(baseHistory);
  });

  it("GET ignores tenantId when saasId is missing", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow?tenantId=tenant-1") as any);

    expect(response.status).toBe(200);
    expect(listCampoBaseSocialAutomationRuns).toHaveBeenCalledWith(25);
    expect(listCampoBaseSocialAutomationRunsForSaas).not.toHaveBeenCalled();
  });

  it("GET enforces owner auth", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/campobase/socialflow") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string; message: string };
    expect(payload.code).toBe("UNAUTHORIZED");
    expect(payload.message).toBe("OWNER_REQUIRED");
  });

  it("POST run_all returns result and status", async () => {
    runCampoBaseSocialAutomationForAllRegisteredSaas.mockResolvedValue({
      total: 1,
      success: 1,
      failed: 0,
      results: [],
    });

    const response = await POST(buildRequest({ action: "run_all" }) as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { action: string; result: unknown; status: StatusPayload };
    expect(payload.action).toBe("run_all");
    expect(payload.result).toEqual({
      total: 1,
      success: 1,
      failed: 0,
      results: [],
    });
    expect(payload.status).toEqual(baseStatus);
    expect(runCampoBaseSocialAutomationForAllRegisteredSaas).toHaveBeenCalled();
  });

  it("POST run_one validates payload and returns result", async () => {
    runCampoBaseSocialAutomationForRegisteredSaas.mockResolvedValue({
      campaignId: "campaign-1",
      postsCount: 1,
      scheduledCount: 1,
      schedule: [{ postId: "post-1", scheduledAt: "2024-01-01T00:00:00Z" }],
    });

    const response = await POST(buildRequest({
      action: "run_one",
      tenantId: "tenant-1",
      saasId: "saas-1",
    }) as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { action: string; result: unknown; status: StatusPayload };
    expect(payload.action).toBe("run_one");
    expect(payload.result).toEqual(expect.objectContaining({ campaignId: "campaign-1", postsCount: 1, scheduledCount: 1 }));
    expect(runCampoBaseSocialAutomationForRegisteredSaas).toHaveBeenCalledWith("tenant-1", "saas-1");
  });

  it("POST enable returns result and status", async () => {
    enableCampoBaseSocialAutomationForSaas.mockResolvedValue({
      tenantId: "tenant-1",
      saasId: "saas-1",
      enabled: true,
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const response = await POST(buildRequest({
      action: "enable",
      tenantId: "tenant-1",
      saasId: "saas-1",
    }) as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { action: string; result: unknown; status: StatusPayload };
    expect(payload.action).toBe("enable");
    expect(payload.result).toEqual(expect.objectContaining({ enabled: true }));
    expect(payload.status).toEqual(baseStatus);
    expect(enableCampoBaseSocialAutomationForSaas).toHaveBeenCalledWith("tenant-1", "saas-1");
  });

  it("POST disable returns result and status", async () => {
    disableCampoBaseSocialAutomationForSaas.mockResolvedValue({
      tenantId: "tenant-1",
      saasId: "saas-1",
      enabled: false,
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const response = await POST(buildRequest({
      action: "disable",
      tenantId: "tenant-1",
      saasId: "saas-1",
    }) as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { action: string; result: unknown; status: StatusPayload };
    expect(payload.action).toBe("disable");
    expect(payload.result).toEqual(expect.objectContaining({ enabled: false }));
    expect(payload.status).toEqual(baseStatus);
    expect(disableCampoBaseSocialAutomationForSaas).toHaveBeenCalledWith("tenant-1", "saas-1");
  });

  it("POST returns 400 on invalid payload", async () => {
    const response = await POST(buildRequest({ action: "run_one" }) as any);

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("CAMPOBASE_SOCIALFLOW_INVALID_ACTION");
  });

  it("POST returns not configured when missing registry", async () => {
    runCampoBaseSocialAutomationForRegisteredSaas.mockRejectedValue(new Error("NOT_CONFIGURED"));

    const response = await POST(buildRequest({
      action: "run_one",
      tenantId: "tenant-1",
      saasId: "saas-1",
    }) as any);

    expect(response.status).toBe(404);
    const payload = await response.json() as { code: string; message: string };
    expect(payload.code).toBe("CAMPOBASE_SOCIALFLOW_NOT_CONFIGURED");
    expect(payload.message).toBe("NOT_CONFIGURED");
  });

  it("POST returns disabled when registry is disabled", async () => {
    runCampoBaseSocialAutomationForRegisteredSaas.mockRejectedValue(new Error("DISABLED"));

    const response = await POST(buildRequest({
      action: "run_one",
      tenantId: "tenant-1",
      saasId: "saas-1",
    }) as any);

    expect(response.status).toBe(409);
    const payload = await response.json() as { code: string; message: string };
    expect(payload.code).toBe("CAMPOBASE_SOCIALFLOW_DISABLED");
    expect(payload.message).toBe("DISABLED");
  });

  it("POST returns unexpected error on unknown failure", async () => {
    runCampoBaseSocialAutomationForRegisteredSaas.mockRejectedValue(new Error("BOOM"));

    const response = await POST(buildRequest({
      action: "run_one",
      tenantId: "tenant-1",
      saasId: "saas-1",
    }) as any);

    expect(response.status).toBe(500);
    const payload = await response.json() as { code: string; message: string };
    expect(payload.code).toBe("CAMPOBASE_SOCIALFLOW_UNEXPECTED_ERROR");
    expect(payload.message).toBe("BOOM");
  });
});
