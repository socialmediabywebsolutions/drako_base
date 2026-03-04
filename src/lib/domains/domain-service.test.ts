import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryAll: vi.fn(),
  run: vi.fn(),
  evaluateCustomDomainEntitlement: vi.fn(),
  isProductionEnvironment: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  queryAll: mocks.queryAll,
  run: mocks.run,
}));

vi.mock("@/lib/domains/entitlement-gate", () => ({
  evaluateCustomDomainEntitlement: mocks.evaluateCustomDomainEntitlement,
}));

vi.mock("@/lib/security/production-gate", () => ({
  isProductionEnvironment: mocks.isProductionEnvironment,
}));

import { DomainServiceError, verifyAndActivate } from "@/lib/domains/domain-service";

function buildSaasRow() {
  return {
    id: "saas_1",
    tenant_id: "tenant_1",
    slug: "app",
    trial_domain: "app.drako.systems",
    custom_domain: "app.client.com",
    domain_verify_token: "token_123",
    domain_status: "requested",
    domain_last_checked_at: null,
    domain_error: null,
  };
}

describe("domain-service canonical provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryAll.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM saas_instances")) return [buildSaasRow()];
      return [];
    });
    mocks.run.mockResolvedValue(true);
    mocks.evaluateCustomDomainEntitlement.mockResolvedValue({
      allowed: true,
      code: "ENTITLED",
      message: "ok",
      context: {},
    });
    mocks.isProductionEnvironment.mockReturnValue(true);
  });

  it("activates custom domain using Cloudflare Custom Hostnames endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Answer: [{ data: '"token_123"' }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, result: { id: "ch_123", status: "active" } }), {
          status: 200,
        }),
      );

    const result = await verifyAndActivate("tenant_1", "saas_1", {
      correlationId: "corr_1",
      envOverride: {
        CLOUDFLARE_API_TOKEN: "token",
        CLOUDFLARE_ZONE_ID: "zone_1",
      } as unknown as import("@/lib/cf").DracoEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe("DOMAIN_ACTIVE");
    expect(result.newStatus).toBe("active");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("/zones/zone_1/custom_hostnames?hostname=app.client.com"))).toBe(true);
    expect(urls.some((url) => url.includes("/zones/zone_1/custom_hostnames") && !url.includes("hostname="))).toBe(true);
    expect(urls.some((url) => url.includes("/pages/projects/"))).toBe(false);
  });

  it("fails closed in production when Cloudflare provider config is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Answer: [{ data: '"token_123"' }] }), { status: 200 }),
      );

    await expect(
      verifyAndActivate("tenant_1", "saas_1", {
        correlationId: "corr_2",
        envOverride: {} as unknown as import("@/lib/cf").DracoEnv,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      name: DomainServiceError.name,
      code: "DOMAIN_PROVIDER_MISCONFIGURED",
      httpStatus: 503,
    });
  });
});
