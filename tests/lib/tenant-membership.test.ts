import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSession, findMembershipByTenantAndUser, setUserActiveTenant, UnauthorizedError } = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireSession: vi.fn(),
    findMembershipByTenantAndUser: vi.fn(),
    setUserActiveTenant: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireSession,
  UnauthorizedError,
}));

vi.mock("@/lib/auth/campamento-core", () => ({
  findMembershipByTenantAndUser,
  setUserActiveTenant,
}));

import { POST } from "@/app/api/tenants/switch/route";

describe("POST /api/tenants/switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches the active tenant when the user is a member", async () => {
    requireSession.mockResolvedValue({
      userId: "user_1",
      email: "operator@drako.systems",
      tenantId: "tenant_old",
      role: "ADMIN",
      issuedAt: Date.now(),
    });
    findMembershipByTenantAndUser.mockResolvedValue({
      tenantId: "tenant_new",
      userId: "user_1",
      role: "ADMIN",
    });
    setUserActiveTenant.mockResolvedValue(true);

    const response = await POST(new Request("https://drako.systems/api/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_new" }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { ok: boolean; tenantId: string };
    expect(payload.ok).toBe(true);
    expect(payload.tenantId).toBe("tenant_new");
    expect(setUserActiveTenant).toHaveBeenCalledWith("user_1", "tenant_new");
  });

  it("rejects a tenant switch when the user does not belong to the tenant", async () => {
    requireSession.mockResolvedValue({
      userId: "user_1",
      email: "operator@drako.systems",
      tenantId: "tenant_old",
      role: "ADMIN",
      issuedAt: Date.now(),
    });
    findMembershipByTenantAndUser.mockResolvedValue(null);

    const response = await POST(new Request("https://drako.systems/api/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_other" }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("TENANT_ACCESS_DENIED");
  });
});
