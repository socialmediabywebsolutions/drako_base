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
  const requestRetryDomainVerifyOperation = vi.fn();

  vi.doMock("@/lib/auth/session", () => ({
    requireOwnerAccess,
    UnauthorizedError,
  }));

  vi.doMock("@/lib/factory/recovery-operations", () => ({
    FactoryRecoveryOperationError,
    requestRetryDomainVerifyOperation,
  }));

  const { POST } = await import("@/app/api/owner/factory/recovery/retry-domain-verify/route");

  return {
    POST,
    requireOwnerAccess,
    requestRetryDomainVerifyOperation,
    UnauthorizedError,
    FactoryRecoveryOperationError,
  };
}

describe("POST /api/owner/factory/recovery/retry-domain-verify", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    const { POST, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-domain-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: "foo.drako.systems" }),
    }) as any);

    expect(response.status).toBe(401);
  });

  it("returns 403 when role is not owner-level", async () => {
    const { POST, requireOwnerAccess, UnauthorizedError } = await loadRoute();
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-domain-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: "foo.drako.systems" }),
    }) as any);

    expect(response.status).toBe(403);
  });

  it("accepts a valid retry-domain request", async () => {
    const { POST, requireOwnerAccess, requestRetryDomainVerifyOperation } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    requestRetryDomainVerifyOperation.mockResolvedValue({
      ok: true,
      accepted: true,
    });

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-domain-verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-drako-correlation-id": "corr_retry_domain",
      },
      body: JSON.stringify({ domain: "foo.drako.systems" }),
    }) as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { ok: boolean; accepted: boolean };
    expect(payload).toEqual({
      ok: true,
      accepted: true,
    });
    expect(requestRetryDomainVerifyOperation).toHaveBeenCalledWith({
      tenantId: "tenant_owner",
      domain: "foo.drako.systems",
      correlationId: "corr_retry_domain",
    });
  });

  it("returns 400 for invalid input", async () => {
    const { POST, requireOwnerAccess, requestRetryDomainVerifyOperation, FactoryRecoveryOperationError } = await loadRoute();
    requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
    requestRetryDomainVerifyOperation.mockRejectedValue(new FactoryRecoveryOperationError("INVALID_DOMAIN", 400));

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-domain-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: "bad domain" }),
    }) as any);

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INVALID_DOMAIN");
  });
});
