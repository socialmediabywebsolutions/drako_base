import { describe, expect, it } from "vitest";
import { DEMO_TENANT_ID, resolveTenantId } from "@/lib/tenants/services";

describe("resolveTenantId", () => {
  it("prefers trusted middleware tenant header", () => {
    const request = new Request("https://drako.systems/api/test", {
      headers: {
        "x-drako-tenant-id": "tenant_trusted",
        "x-tenant-id": "tenant_untrusted",
      },
    });

    expect(resolveTenantId(request)).toBe("tenant_trusted");
  });

  it("ignores untrusted query/header overrides by default", () => {
    const request = new Request("https://drako.systems/api/test?tenantId=tenant_query", {
      headers: { "x-tenant-id": "tenant_header" },
    });

    expect(resolveTenantId(request)).toBe("");
  });

  it("allows explicit internal legacy override mode", () => {
    const request = new Request("https://drako.systems/api/test?tenantId=tenant_query");
    expect(resolveTenantId(request, { allowUntrustedOverride: true })).toBe("tenant_query");
  });
});
