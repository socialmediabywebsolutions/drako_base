import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCloudflareContextMock = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: getCloudflareContextMock,
}));

const originalEnv = { ...process.env };

describe("cf env build phase safety", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/cf");
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/cloudflare/context");
    vi.doUnmock("@/app/api/health/env/route");
    getCloudflareContextMock.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("keeps build-phase imports on the safe process boundary", async () => {
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.CI = "true";
    process.env.npm_lifecycle_event = "build";
    process.env.NEXTAUTH_SECRET = "next-secret";
    process.env.INTERNAL_API_SECRET = "internal-secret";

    const { env } = await import("@/lib/cf");
    const { safeEnv } = await import("@/lib/env");
    const { getCloudflareEnv, getFullCloudflareContext } = await import("@/lib/cloudflare/context");
    const healthRoute = await import("@/app/api/health/env/route");

    expect(env()).toBeNull();
    expect(safeEnv.NEXTAUTH_SECRET).toBe("next-secret");
    expect(getCloudflareEnv()).toEqual({ DB: null, KV: null, R2: null });
    expect(getFullCloudflareContext()).toBeNull();

    const response = await healthRoute.GET(
      new Request("https://drako.local/api/health/env", {
        headers: { "X-Drako-Origin-Secret": "internal-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.AI).toBe(false);
    expect(getCloudflareContextMock).not.toHaveBeenCalled();
  });

  it("uses Cloudflare context outside build phase when available", async () => {
    getCloudflareContextMock.mockReturnValue({
      env: { SESSION_SECRET: "worker-secret" },
    });

    delete process.env.NEXT_PHASE;

    const { env } = await import("@/lib/cf");

    expect(env()).toMatchObject({ SESSION_SECRET: "worker-secret" });
    expect(getCloudflareContextMock).toHaveBeenCalledTimes(1);
  });
});
