import { describe, expect, it } from "vitest";
import { assertTenantScopedRows } from "@/lib/export/wipeout-package";

describe("wipeout package tenant scoping", () => {
  it("accepts rows that stay inside tenant and saas scope", () => {
    const rows = [
      {
        tenant_id: "tenant-alpha",
        saas_id: "saas-socialflow",
        id: "row-1",
      },
    ];

    expect(assertTenantScopedRows(rows, {
      entity: "agent_work_logs",
      tenantId: "tenant-alpha",
      saasId: "saas-socialflow",
      requireSaasId: true,
    })).toEqual(rows);
  });

  it("rejects cross-tenant rows", () => {
    expect(() => assertTenantScopedRows([
      {
        tenant_id: "tenant-bravo",
        saas_id: "saas-socialflow",
        id: "row-1",
      },
    ], {
      entity: "economic_events",
      tenantId: "tenant-alpha",
      saasId: "saas-socialflow",
      requireSaasId: true,
    })).toThrow(/economic_events row escaped tenant isolation/);
  });

  it("rejects cross-saas rows", () => {
    expect(() => assertTenantScopedRows([
      {
        tenant_id: "tenant-alpha",
        saas_id: "saas-foreign",
        id: "row-1",
      },
    ], {
      entity: "saas_domains",
      tenantId: "tenant-alpha",
      saasId: "saas-socialflow",
      requireSaasId: true,
    })).toThrow(/saas_domains row escaped SaaS isolation/);
  });
});
