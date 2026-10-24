import { beforeEach, describe, expect, it, vi } from "vitest";

const handleSocialFlowLinkedInCallback = vi.hoisted(() => vi.fn());
const resolveSocialFlowLinkedInCallbackSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/socialflow/linkedin/oauth", () => ({
  handleSocialFlowLinkedInCallback,
  resolveSocialFlowLinkedInCallbackSession,
}));

import { GET as canonicalGET } from "@/app/api/socialflow/linkedin/callback/route";
import { GET as legacyGET } from "@/app/api/social/linkedin/callback/route";
import { GET as authBridgeGET } from "@/app/auth/linkedin/callback/route";

describe("LinkedIn callback routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveSocialFlowLinkedInCallbackSession.mockResolvedValue({ tenantId: "tenant-query" });
  });

  it("redirects the canonical callback to the SocialFlow workspace on success", async () => {
    handleSocialFlowLinkedInCallback.mockResolvedValue({
      ok: true,
      tenantId: "tenant-query",
      saasId: "saas-query",
      redirectTo: "/socialflow/settings/account",
      persistence: {
        status: "persisted",
        accountId: "account-1",
        accountStatus: "CONNECTED_REAL",
      },
    });

    const response = await canonicalGET(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=abc&state=opaque") as any,
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://drako.local/socialflow/settings/account?linkedin=connected&provider=linkedin&status=persisted&saasId=saas-query&accountId=account-1",
    );
  });

  it("redirects the canonical callback with a controlled error payload on failure", async () => {
    handleSocialFlowLinkedInCallback.mockResolvedValue({
      ok: false,
      tenantId: "tenant-query",
      saasId: "saas-query",
      redirectTo: "/socialflow/settings/account",
      error: {
        code: "LINKEDIN_AUTHORIZATION_CODE_INVALID",
        message: "invalid code",
      },
    });

    const response = await canonicalGET(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=bad&state=opaque") as any,
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://drako.local/socialflow/settings/account?linkedin=error&provider=linkedin&code=LINKEDIN_AUTHORIZATION_CODE_INVALID&message=invalid+code&saasId=saas-query",
    );
  });

  it("redirects the legacy api callback to the canonical route preserving query params", async () => {
    const response = await legacyGET(
      new Request("https://drako.local/api/social/linkedin/callback?code=abc&state=opaque") as any,
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://drako.local/api/socialflow/linkedin/callback?code=abc&state=opaque",
    );
  });

  it("redirects the /auth callback bridge to the canonical route preserving query params", async () => {
    const response = await authBridgeGET(
      new Request("https://drako.local/auth/linkedin/callback?code=abc&state=opaque") as any,
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://drako.local/api/socialflow/linkedin/callback?code=abc&state=opaque",
    );
  });
});
