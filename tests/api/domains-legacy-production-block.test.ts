import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/security/production-gate", () => ({
  isProductionEnvironment: vi.fn(() => true),
}));

import { PATCH as patchLegacySaasDomain } from "@/app/api/saas/domain/route";

describe("legacy domains routes blocked in production", () => {
  it("blocks PATCH /api/saas/domain with 410", async () => {
    const response = await patchLegacySaasDomain(
      new Request("https://drako.systems/api/saas/domain", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId: "saas_1", publicDomain: "app.client.com" }),
      }),
    );

    expect(response.status).toBe(410);
    const payload = (await response.json()) as { code: string; message: string };
    expect(payload.code).toBe("LEGACY_SAAS_DOMAIN_ROUTE_BLOCKED");
    expect(payload.message).toContain("/api/domains/request");
  });
});
