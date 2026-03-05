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

import { GET } from "@/app/api/owner/observability/failures/route";

describe("GET /api/owner/observability/failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new mocks.UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/observability/failures") as any);
    expect(response.status).toBe(401);

    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 403 when role is not owner-level", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new mocks.UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/observability/failures") as any);
    expect(response.status).toBe(403);

    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("OWNER_ROLE_REQUIRED");
  });

  it("returns 200 with failures and metrics for owner", async () => {
    mocks.requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    mocks.queryAll
      .mockResolvedValueOnce([
        {
          id: "fallback_1",
          created_at: "2026-03-05T08:00:00.000Z",
          correlation_id: "corr_1",
          tenant_id: "tenant_owner",
          job_id: "job_1",
          step: "stripe",
          severity: "ERROR",
          message: "Stripe step failed to write event",
          error_message: "timeout",
        },
      ])
      .mockResolvedValueOnce([
        {
          date: "2026-03-05",
          event_write_failures: 3,
          last_failure_at: "2026-03-05T08:00:00.000Z",
        },
      ]);

    const response = await GET(
      new Request("https://drako.systems/api/owner/observability/failures?limit=50") as any,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      tenantId: string;
      failures: Array<{ id: string; correlationId: string; jobId: string }>;
      metrics: Array<{ date: string; eventWriteFailures: number }>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.tenantId).toBe("tenant_owner");
    expect(payload.failures[0]).toMatchObject({
      id: "fallback_1",
      correlationId: "corr_1",
      jobId: "job_1",
    });
    expect(payload.metrics[0]).toMatchObject({
      date: "2026-03-05",
      eventWriteFailures: 3,
    });
  });
});
