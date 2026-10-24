import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnerAccess,
  requestRetryDomainVerifyOperation,
  UnauthorizedError,
  FactoryRecoveryOperationError,
} = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  class HoistedFactoryRecoveryOperationError extends Error {
    status: number;
    code: string;

    constructor(code: string, status = 400, message?: string) {
      super(message ?? code);
      this.code = code;
      this.status = status;
    }
  }

  return {
    requireOwnerAccess: vi.fn(),
    requestRetryDomainVerifyOperation: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
    FactoryRecoveryOperationError: HoistedFactoryRecoveryOperationError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/factory/recovery-operations", () => ({
  FactoryRecoveryOperationError,
  requestRetryDomainVerifyOperation,
}));

import { POST } from "@/app/api/owner/factory/recovery/retry-domain-verify/route";

describe("POST /api/owner/factory/recovery/retry-domain-verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-domain-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: "foo.drako.systems" }),
    }) as any);

    expect(response.status).toBe(401);
  });

  it("returns 403 when role is not owner-level", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await POST(new Request("https://drako.systems/api/owner/factory/recovery/retry-domain-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: "foo.drako.systems" }),
    }) as any);

    expect(response.status).toBe(403);
  });

  it("accepts a valid retry-domain request", async () => {
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
