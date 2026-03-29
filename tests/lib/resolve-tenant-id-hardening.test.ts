import { describe, expect, it } from "vitest";

import { resolveTenantId } from "@/lib/tenants/services";

describe("resolveTenantId hardening", () => {
  it("does not accept untrusted overrides or demo fallback by default", () => {
    const request = new Request("https://drako.systems/api/test?tenantId=query_tenant", {
      headers: {
        "x-tenant-id": "header_tenant",
      },
    });

    expect(resolveTenantId(request)).toBe("");
  });

  it("accepts only the trusted tenant header unless explicit override mode is enabled", () => {
    const request = new Request("https://drako.systems/api/test?tenantId=query_tenant", {
      headers: {
        "x-drako-tenant-id": "trusted_tenant",
        "x-tenant-id": "header_tenant",
      },
    });

    expect(resolveTenantId(request)).toBe("trusted_tenant");
  });
});
