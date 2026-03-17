import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWorkspaceSessionByToken } = vi.hoisted(() => ({
  getWorkspaceSessionByToken: vi.fn(),
}));

vi.mock("@/lib/auth/campamento-core", () => ({
  getWorkspaceSessionByToken,
}));

import { requireSession } from "@/lib/auth/session";

describe("workspace auth session fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAKO_ENABLE_DEMO_SESSION = "0";
  });

  it("accepts a NextAuth database session cookie for workspace APIs", async () => {
    getWorkspaceSessionByToken.mockResolvedValue({
      userId: "user_1",
      email: "operator@socialflow.test",
      name: "Operator",
      tenantId: "tenant_socialflow",
      tenantName: "SocialFlow Workspace",
      tenantSlug: "socialflow-workspace",
      role: "ADMIN",
      sessionToken: "session_token_1",
      expires: new Date(Date.now() + 60_000).toISOString(),
    });

    const request = new Request("https://drako.systems/api/social/summary?saasId=saas_1", {
      headers: {
        cookie: "next-auth.session-token=session_token_1",
      },
    });

    const session = await requireSession(request);

    expect(session.userId).toBe("user_1");
    expect(session.tenantId).toBe("tenant_socialflow");
    expect(session.role).toBe("ADMIN");
    expect(session.authMode).toBe("nextauth_database");
  });
});
