import { beforeEach, describe, expect, it, vi } from "vitest";

const { createWorkspaceUserWithTenant } = vi.hoisted(() => ({
  createWorkspaceUserWithTenant: vi.fn(),
}));

vi.mock("@/lib/auth/campamento-core", () => ({
  createWorkspaceUserWithTenant,
}));

import { POST } from "@/app/api/auth/workspace/signup/route";

describe("POST /api/auth/workspace/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a workspace owner account", async () => {
    createWorkspaceUserWithTenant.mockResolvedValue({
      user: { id: "user_1", email: "owner@workspace.test", name: "Owner" },
      membership: { tenantId: "tenant_1", role: "OWNER" },
    });

    const response = await POST(new Request("https://base.drako.systems/api/auth/workspace/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "owner@workspace.test",
        password: "very-secure-password",
        name: "Owner",
        workspaceName: "Northstar Workspace",
      }),
    }));

    expect(response.status).toBe(201);
    expect(createWorkspaceUserWithTenant).toHaveBeenCalledWith({
      email: "owner@workspace.test",
      password: "very-secure-password",
      name: "Owner",
      tenantName: "Northstar Workspace",
    });
  });

  it("rejects invalid signup payloads", async () => {
    const response = await POST(new Request("https://base.drako.systems/api/auth/workspace/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@workspace.test", password: "short" }),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INVALID_INPUT");
  });
});
