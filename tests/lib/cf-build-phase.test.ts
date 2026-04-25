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
    getCloudflareContextMock.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not request Cloudflare context during Next production build", async () => {
    process.env.NEXT_PHASE = "phase-production-build";

    const { env } = await import("@/lib/cf");

    expect(env()).toBeNull();
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
