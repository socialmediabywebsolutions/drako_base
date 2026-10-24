import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTenantAccess,
  findMembershipByTenantAndUser,
  hasRequiredWorkspaceRole,
  listTenantMembers,
  updateTenantMemberRole,
  UnauthorizedError,
} = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireTenantAccess: vi.fn(),
    findMembershipByTenantAndUser: vi.fn(),
    hasRequiredWorkspaceRole: vi.fn(),
    listTenantMembers: vi.fn(),
    updateTenantMemberRole: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/auth/campamento-core", () => ({
  findMembershipByTenantAndUser,
  hasRequiredWorkspaceRole,
  listTenantMembers,
  updateTenantMemberRole,
}));

import { PATCH } from "@/app/api/tenants/members/route";

describe("PATCH /api/tenants/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({
      tenantId: "tenant_1",
      session: {
        userId: "owner_1",
        email: "owner@workspace.test",
      },
    });
    findMembershipByTenantAndUser.mockResolvedValue({
      tenantId: "tenant_1",
      userId: "owner_1",
      role: "OWNER",
    });
    hasRequiredWorkspaceRole.mockReturnValue(true);
  });

  it("protects the last owner from demotion", async () => {
    listTenantMembers.mockResolvedValue([
      { id: "m1", userId: "owner_2", role: "OWNER" },
      { id: "m2", userId: "member_1", role: "MEMBER" },
    ]);

    const response = await PATCH(new Request("https://base.drako.systems/api/tenants/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "owner_2", role: "ADMIN" }),
    }));

    expect(response.status).toBe(409);
    expect(updateTenantMemberRole).not.toHaveBeenCalled();
  });

  it("updates the member role when the change is allowed", async () => {
    listTenantMembers.mockResolvedValue([
      { id: "m1", userId: "owner_1", role: "OWNER" },
      { id: "m2", userId: "admin_1", role: "ADMIN" },
      { id: "m3", userId: "member_1", role: "MEMBER" },
    ]);

    const response = await PATCH(new Request("https://base.drako.systems/api/tenants/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "member_1", role: "ADMIN" }),
    }));

    expect(response.status).toBe(200);
    expect(updateTenantMemberRole).toHaveBeenCalledWith({
      tenantId: "tenant_1",
      userId: "member_1",
      role: "ADMIN",
    });
  });
});
