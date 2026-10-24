import { describe, expect, it, vi } from "vitest";

vi.mock("../../runtime-env", () => ({
  getSocialFlowRuntimeEnv: () => null,
}));

vi.mock("./core", () => ({
  resolveLinkedInOAuthDiagnostics: () => ({
    callbackUrl: "https://socialflow.drako.systems/api/socialflow/linkedin/callback",
    origin: "https://socialflow.drako.systems",
    originSource: "test",
    runtime: "production",
    clientId: "ignored-client-id",
    clientIdSource: "test",
    pkceUsed: false,
  }),
}));

import { buildRuntimeLinkedInAuthorizationUrl } from "./client";

describe("runtime linkedin connect scopes", () => {
  it("includes w_member_social in oauth scope set", async () => {
    const result = await buildRuntimeLinkedInAuthorizationUrl({
      request: new Request("https://socialflow.drako.systems/api/socialflow/linkedin/connect?saasId=p2-24i-saas"),
      clientId: "client-id-1",
      tenantId: "tenant_socialflow_canary_staff",
      saasId: "p2-24i-saas",
      redirectTo: "/socialflow/settings/account?saasId=p2-24i-saas",
    });

    const url = new URL(result.authorizationUrl);
    const scope = url.searchParams.get("scope") ?? "";

    expect(scope.split(" ")).toContain("w_member_social");
  });
});
