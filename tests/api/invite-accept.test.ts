import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getTenantInviteByToken,
  getWorkspaceUserWithPasswordByEmail,
  createWorkspaceUser,
  createWorkspaceSession,
  acceptTenantInvite,
  getSession,
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
    getTenantInviteByToken: vi.fn(),
    getWorkspaceUserWithPasswordByEmail: vi.fn(),
    createWorkspaceUser: vi.fn(),
    createWorkspaceSession: vi.fn(),
    acceptTenantInvite: vi.fn(),
    getSession: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/campamento-core", () => ({
  getTenantInviteByToken,
  getWorkspaceUserWithPasswordByEmail,
  createWorkspaceUser,
  createWorkspaceSession,
  acceptTenantInvite,
}));

vi.mock("@/lib/auth/crypto", () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession,
  requireSession: vi.fn(),
  UnauthorizedError,
}));

import { POST } from "@/app/api/invites/accept/route";

describe("POST /api/invites/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantInviteByToken.mockResolvedValue({
      id: "invite_1",
      tenantId: "tenant_team",
      tenantName: "Northstar",
      tenantSlug: "northstar",
      email: "operator@northstar.test",
      role: "MEMBER",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdBy: "user_owner",
      token: "invite_token",
    });
  });

  it("creates a standalone user and accepts the invite when no session exists", async () => {
    getSession.mockResolvedValue(null);
    getWorkspaceUserWithPasswordByEmail.mockResolvedValue(null);
    createWorkspaceUser.mockResolvedValue({
      id: "user_new",
      email: "operator@northstar.test",
      name: "Operator",
    });
    createWorkspaceSession.mockResolvedValue({
      sessionToken: "session_token",
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    acceptTenantInvite.mockResolvedValue({
      tenantId: "tenant_team",
      userId: "user_new",
      role: "MEMBER",
    });

    const response = await POST(new Request("https://base.drako.systems/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invite_token", password: "very-secure-password", name: "Operator" }),
    }));

    expect(response.status).toBe(200);
    expect(createWorkspaceUser).toHaveBeenCalledWith({
      email: "operator@northstar.test",
      password: "very-secure-password",
      name: "Operator",
    });
    expect(acceptTenantInvite).toHaveBeenCalledWith({
      token: "invite_token",
      userId: "user_new",
      email: "operator@northstar.test",
    });
  });

  it("returns the invite-specific status when validation fails", async () => {
    getSession.mockResolvedValue({
      userId: "user_existing",
      email: "other@northstar.test",
    });
    acceptTenantInvite.mockRejectedValue(new Error("INVITE_EMAIL_MISMATCH"));

    const response = await POST(new Request("https://base.drako.systems/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invite_token" }),
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INVITE_EMAIL_MISMATCH");
  });
});
