import { describe, expect, it } from "vitest";
import {
  isSocialFlowInstanceSlug,
  resolveClientTenantIdFromHeaders,
  shouldUseLocalDemoInstance,
} from "@/lib/socialflow-local";

describe("socialflow local resolution", () => {
  it("accepts the canonical and local SocialFlow slugs", () => {
    expect(isSocialFlowInstanceSlug("socialflow")).toBe(true);
    expect(isSocialFlowInstanceSlug("socialflows")).toBe(true);
    expect(isSocialFlowInstanceSlug("mentoria")).toBe(false);
  });

  it("trusts explicit tenant headers before any local demo behavior", () => {
    const headers = new Headers({
      "x-drako-tenant-id": "tenant_real_1",
      "x-drako-client-entry-mode": "local_demo",
    });

    expect(resolveClientTenantIdFromHeaders(headers)).toBe("tenant_real_1");
  });

  it("only enables demo tenant fallback when middleware marks the request as local_demo", () => {
    const standardHeaders = new Headers();
    const demoHeaders = new Headers({ "x-drako-client-entry-mode": "local_demo" });

    expect(shouldUseLocalDemoInstance(standardHeaders)).toBe(false);
    expect(resolveClientTenantIdFromHeaders(standardHeaders)).toBeNull();

    expect(shouldUseLocalDemoInstance(demoHeaders)).toBe(true);
    expect(resolveClientTenantIdFromHeaders(demoHeaders)).toBeTruthy();
  });
});
