import { describe, expect, it } from "vitest";
import {
  resolveChildSaasWorkspaceKind,
  resolvePlatformSurfaceFromPath,
  resolveTenantWorkspaceEntryMode,
  shouldEnableNextAuthClient,
} from "@/lib/platform/surfaces";

describe("platform surface contract", () => {
  it("classifies /client as the tenant workspace", () => {
    expect(resolvePlatformSurfaceFromPath("/client")).toBe("tenant_workspace");
    expect(resolvePlatformSurfaceFromPath("/api/social/summary")).toBe("tenant_workspace_api");
  });

  it("classifies /site/panel as holding admin and onboarding as public onboarding", () => {
    expect(resolvePlatformSurfaceFromPath("/site/panel")).toBe("holding_admin");
    expect(resolvePlatformSurfaceFromPath("/site/onboarding")).toBe("public_onboarding");
  });

  it("enables next-auth only for drako onboarding/admin client hooks", () => {
    expect(shouldEnableNextAuthClient("/client")).toBe(false);
    expect(shouldEnableNextAuthClient("/site/onboarding")).toBe(true);
    expect(shouldEnableNextAuthClient("/site/panel")).toBe(true);
  });

  it("resolves tenant workspace entry mode for product, holding, and local demo", () => {
    expect(resolveTenantWorkspaceEntryMode({
      pathname: "/client",
      effectiveHost: "app.socialflow.example.com",
    })).toBe("product_operator");

    expect(resolveTenantWorkspaceEntryMode({
      pathname: "/client",
      effectiveHost: "bases.drako.systems",
    })).toBe("holding_operator");

    expect(resolveTenantWorkspaceEntryMode({
      pathname: "/client",
      effectiveHost: "localhost",
      localDemoEnabled: true,
    })).toBe("local_demo");
  });

  it("distinguishes owned SaaS workspace from customer-linked SaaS workspace", () => {
    expect(resolveChildSaasWorkspaceKind({})).toBe("owned_saas");
    expect(resolveChildSaasWorkspaceKind({ clientSaasId: "client_saas_1" })).toBe("client_saas");
  });
});
