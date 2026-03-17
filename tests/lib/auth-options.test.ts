import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateWorkspaceCredentials,
  ensureUserHasWorkspace,
  getWorkspaceUserById,
  getWorkspaceUserByEmail,
  resolveActiveMembershipForUser,
} = vi.hoisted(() => ({
  validateWorkspaceCredentials: vi.fn(),
  ensureUserHasWorkspace: vi.fn(),
  getWorkspaceUserById: vi.fn(),
  getWorkspaceUserByEmail: vi.fn(),
  resolveActiveMembershipForUser: vi.fn(),
}));

vi.mock("@/lib/auth/nextauth-adapter", () => ({
  DrakoD1AuthAdapter: vi.fn(() => ({ createUser: vi.fn() })),
}));

vi.mock("@/lib/auth/campamento-core", () => ({
  ensureUserHasWorkspace,
  getWorkspaceUserByEmail,
  getWorkspaceUserById,
  resolveActiveMembershipForUser,
  validateWorkspaceCredentials,
}));

vi.mock("@/lib/env", () => ({
  safeEnv: {},
}));

import { authOptions } from "@/lib/auth";

describe("workspace auth options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes credentials as the canonical workspace login provider", async () => {
    const credentialsProvider = authOptions.providers[0] as any;

    expect(credentialsProvider.id).toBe("credentials");
    expect(credentialsProvider.type).toBe("credentials");
  });

  it("ensures a user has a workspace at sign-in time", async () => {
    const allowed = await authOptions.callbacks?.signIn?.({
      user: { id: "user_2", email: "operator@workspace.test", name: "Operator" },
      account: null,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    } as any);

    expect(allowed).toBe(true);
    expect(ensureUserHasWorkspace).toHaveBeenCalledWith({
      userId: "user_2",
      email: "operator@workspace.test",
      name: "Operator",
    });
  });
});
