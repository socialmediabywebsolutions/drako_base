import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    status: number;
    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireTenantAccess: vi.fn(),
    runAi: vi.fn(),
    enforceBilling: vi.fn(),
    resolveSaasContext: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess: mocks.requireTenantAccess,
  UnauthorizedError: mocks.UnauthorizedError,
}));

vi.mock("@/lib/ai/client", () => ({
  runAi: mocks.runAi,
}));

vi.mock("@/lib/billing/enforce-billing", () => ({
  enforceBilling: mocks.enforceBilling,
}));

vi.mock("@/lib/saas/resolve-saas-context", () => ({
  resolveSaasContext: mocks.resolveSaasContext,
}));

import { POST } from "@/app/api/ai/chat/route";

describe("/api/ai/chat auth hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    mocks.requireTenantAccess.mockRejectedValue(new mocks.UnauthorizedError("SESSION_REQUIRED", 401));

    const request = new Request("https://drako.systems/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mocks.runAi).not.toHaveBeenCalled();
  });
});
