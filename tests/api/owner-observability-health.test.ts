import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.name = "UnauthorizedError";
      this.status = status;
    }
  }

  return {
    requireOwnerAccess: vi.fn(),
    queryAll: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess: mocks.requireOwnerAccess,
  UnauthorizedError: mocks.UnauthorizedError,
}));

vi.mock("@/lib/db", () => ({
  queryAll: mocks.queryAll,
}));

import { GET } from "@/app/api/owner/observability/health/route";

describe("GET /api/owner/observability/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new mocks.UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/observability/health") as any);

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new mocks.UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/observability/health") as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with health payload and degraded=true when threshold is exceeded", async () => {
    mocks.requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    mocks.queryAll
      .mockResolvedValueOnce([
        { date: "2026-03-05", event_write_failures: 3, last_failure_at: "2026-03-05T10:00:00.000Z" },
        { date: "2026-03-04", event_write_failures: 3, last_failure_at: "2026-03-04T10:00:00.000Z" },
        { date: "2026-03-03", event_write_failures: 1, last_failure_at: "2026-03-03T10:00:00.000Z" },
      ])
      .mockResolvedValueOnce([
        {
          id: "fb_1",
          created_at: "2026-03-05T10:01:00.000Z",
          correlation_id: "corr_1",
          tenant_id: "tenant_owner",
          job_id: "job_1",
          step: "stripe",
          severity: "ERROR",
          message: "fallback write",
          error_message: "timeout",
        },
      ]);

    const response = await GET(
      new Request("https://drako.systems/api/owner/observability/health?limit=10") as any,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      tenantId: string;
      fallbackFailuresLast30Days: number;
      degraded: boolean;
      slo: { recentFailures: number; recentFailureThreshold: number };
      latestFallbacks: Array<{ id: string; correlationId: string }>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.tenantId).toBe("tenant_owner");
    expect(payload.fallbackFailuresLast30Days).toBe(7);
    expect(payload.degraded).toBe(true);
    expect(payload.slo.recentFailures).toBe(7);
    expect(payload.slo.recentFailureThreshold).toBe(5);
    expect(payload.latestFallbacks[0]).toMatchObject({ id: "fb_1", correlationId: "corr_1" });
  });
});
