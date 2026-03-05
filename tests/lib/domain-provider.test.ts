import { describe, expect, it, vi } from "vitest";
import { createDomainBinding, DomainProviderError } from "@/lib/domains/domain-provider";

describe("domain provider (workers custom domains)", () => {
  it("creates a domain binding successfully", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, result: { id: "ch_123", status: "pending" } }), { status: 200 }),
      );

    const result = await createDomainBinding({
      hostname: "app.client.com",
      correlationId: "corr_1",
      envOverride: {
        CLOUDFLARE_API_TOKEN: "token",
        CLOUDFLARE_ZONE_ID: "zone_1",
      } as unknown as import("@/lib/cf").DracoEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      hostname: "app.client.com",
      bindingId: "ch_123",
      providerStatus: "pending",
      alreadyExists: false,
    });
  });

  it("fails closed when provider config is missing", async () => {
    await expect(
      createDomainBinding({
        hostname: "app.client.com",
        correlationId: "corr_2",
        envOverride: {} as unknown as import("@/lib/cf").DracoEnv,
      }),
    ).rejects.toMatchObject({
      name: DomainProviderError.name,
      code: "DOMAIN_PROVIDER_MISCONFIGURED",
      httpStatus: 503,
      correlationId: "corr_2",
    });
  });

  it("returns already exists when custom hostname is already present", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, result: [{ id: "ch_existing", hostname: "app.client.com", status: "active" }] }),
        { status: 200 },
      ),
    );

    const result = await createDomainBinding({
      hostname: "app.client.com",
      correlationId: "corr_3",
      envOverride: {
        CLOUDFLARE_API_TOKEN: "token",
        CLOUDFLARE_ZONE_ID: "zone_1",
      } as unknown as import("@/lib/cf").DracoEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      hostname: "app.client.com",
      bindingId: "ch_existing",
      providerStatus: "active",
      alreadyExists: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
