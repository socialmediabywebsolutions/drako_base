import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantAccess = vi.hoisted(() => vi.fn());
const buildSocialFlowLinkedInConnectUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess,
}));

vi.mock("@/lib/socialflow/linkedin/oauth", () => ({
  buildSocialFlowLinkedInConnectUrl,
}));

import { GET as canonicalGET } from "@/app/api/socialflow/linkedin/connect/route";
import { GET as legacyGET } from "@/app/api/social/linkedin/connect/route";

describe("LinkedIn connect routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({ tenantId: "tenant_socialflow" });
    buildSocialFlowLinkedInConnectUrl.mockReturnValue({
      authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization?client_id=linkedin-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fapi%2Fsocialflow%2Flinkedin%2Fcallback&state=encoded-state",
    });
  });

  it("redirects from the canonical route to linkedin authorization", async () => {
    const response = await canonicalGET(new Request("https://drako.local/api/socialflow/linkedin/connect?saasId=socialflow") as any);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("https://www.linkedin.com/oauth/v2/authorization");
    expect(location).toContain("client_id=linkedin-client-id");
    expect(location).toContain("state=encoded-state");
    expect(requireTenantAccess).toHaveBeenCalledTimes(1);
    expect(buildSocialFlowLinkedInConnectUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant_socialflow",
        saasId: "socialflow",
      }),
    );
  });

  it("keeps the canonical callback path for wrangler-local auth urls", async () => {
    const response = await canonicalGET(new Request("http://localhost:8787/api/socialflow/linkedin/connect?saasId=socialflow") as any);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(decodeURIComponent(location)).toContain("redirect_uri=http://localhost:8787/api/socialflow/linkedin/callback");
  });

  it("redirects the legacy route to the canonical route without executing oauth logic", async () => {
    const response = await legacyGET(new Request("https://drako.local/api/social/linkedin/connect?saasId=socialflow&redirectTo=%2Fsocialflow%2Fsettings%2Faccount") as any);

    expect(response.status).toBe(308);
    const location = response.headers.get("location") ?? "";
    expect(location).toBe("https://drako.local/api/socialflow/linkedin/connect?saasId=socialflow&redirectTo=%2Fsocialflow%2Fsettings%2Faccount");
    expect(requireTenantAccess).not.toHaveBeenCalled();
    expect(buildSocialFlowLinkedInConnectUrl).not.toHaveBeenCalled();
  });
});
