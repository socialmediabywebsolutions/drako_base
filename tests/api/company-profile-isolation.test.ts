import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    status: number;
    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  const first = vi.fn();
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare };

  return {
    requireTenantAccess: vi.fn(),
    UnauthorizedError,
    first,
    bind,
    prepare,
    db,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess: mocks.requireTenantAccess,
  UnauthorizedError: mocks.UnauthorizedError,
}));

vi.mock("@/lib/cf", () => ({
  env: () => ({ DRACO_DB: mocks.db }),
}));

import { GET } from "@/app/api/company-profile/route";

describe("/api/company-profile isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantAccess.mockResolvedValue({
      tenantId: "tenant_secure",
      session: { email: "owner@drako.systems", tenantId: "tenant_secure", role: "admin", issuedAt: Date.now() },
    });
    mocks.first.mockResolvedValue({
      user_email: "owner@drako.systems",
      company_name: "Secure Co",
      structured_context: "{}",
    });
  });

  it("ignores query email and uses authenticated session email", async () => {
    const request = new Request("https://drako.systems/api/company-profile?email=other@attacker.dev");

    const response = await GET(request as any);
    expect(response.status).toBe(200);
    expect(mocks.bind).toHaveBeenCalledTimes(1);
    expect(mocks.bind).toHaveBeenCalledWith("owner@drako.systems");
  });
});
