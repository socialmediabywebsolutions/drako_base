import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadRoute() {
  class UnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.name = "UnauthorizedError";
      this.status = status;
    }
  }

  class FactoryRecoveryOperationError extends Error {
    status: number;
    code: string;

    constructor(code: string, status = 400, message?: string) {
      super(message ?? code);
      this.name = "FactoryRecoveryOperationError";
      this.code = code;
      this.status = status;
    }
  }

  const requireOwnerAccess = vi.fn();
  const requestRetryJobOperation = vi.fn();

  vi.doMock("@/lib/auth/session", () => ({
    requireOwnerAccess,
    UnauthorizedError,
  }));

  vi.doMock("@/lib/factory/recovery-operations", () => ({
    FactoryRecoveryOperationError,
    requestRetryJobOperation,
  }));

  const { POST } = await import("@/app/api/owner/factory/recovery/retry-job/route");

  return {
    POST,
    requireOwnerAccess,
    requestRetryJobOperation,
    UnauthorizedError,
    FactoryRecoveryOperationError,
  };
}

describe("POST /api/owner/factory/recovery/retry-job", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    const { POST, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-job", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job_123" }),
    }) as any);

    expect(response.status).toBe(401);
  });

  it("returns 403 when role is not owner-level", async () => {
    const { POST, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-job", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job_123" }),
    }) as any);

    expect(response.status).toBe(403);
  });

  it("accepts a valid retry-job request", async () => {
    const { POST, requireOwnerAccess, requestRetryJobOperation } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    requestRetryJobOperation.mockResolvedValue({
      ok: true,
      accepted: true,
    });

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-job", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "corr_retry_job",
      },
      body: JSON.stringify({ jobId: "job_123" }),
    }) as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { ok: boolean; accepted: boolean };
    expect(payload).toEqual({
      ok: true,
      accepted: true,
    });
    expect(requestRetryJobOperation).toHaveBeenCalledWith({
      tenantId: "tenant_owner",
      jobId: "job_123",
      correlationId: "corr_retry_job",
    });
  });

  it("returns 400 for invalid input", async () => {
    const { POST, requireOwnerAccess, requestRetryJobOperation, FactoryRecoveryOperationError } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    requestRetryJobOperation.mockRejectedValue(new FactoryRecoveryOperationError("INVALID_JOB_ID", 400));

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-job", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "" }),
    }) as any);

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INVALID_JOB_ID");
  });
});
