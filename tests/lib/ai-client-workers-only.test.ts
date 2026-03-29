import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
}));

vi.mock("@/lib/cf", () => ({
  env: mocks.env,
}));

describe("runAi workers-only runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the Cloudflare AI binding directly and never falls back to fetch", async () => {
    const run = vi.fn().mockResolvedValue({ response: "binding-response" });
    mocks.env.mockReturnValue({
      AI: { run },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { runAi } = await import("@/lib/ai/client");
    const response = await runAi({
      tenantId: "tenant_1",
      mode: "fast",
      messages: [{ role: "user", content: "ping" }],
      cache: false,
    });

    expect(response.ok).toBe(true);
    expect(response.provider).toBe("workers-ai");
    expect(response.content).toBe("binding-response");
    expect(run).toHaveBeenCalledWith(
      "@cf/meta/llama-3-8b-instruct",
      expect.objectContaining({
        messages: [{ role: "user", content: "ping" }],
      }),
      expect.objectContaining({
        cacheTtl: 0,
        skipCache: true,
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed when the AI binding is unavailable", async () => {
    mocks.env.mockReturnValue({
      AI: undefined,
    });

    const { runAi } = await import("@/lib/ai/client");

    await expect(
      runAi({
        tenantId: "tenant_1",
        mode: "smart",
        messages: [{ role: "user", content: "ping" }],
      }),
    ).rejects.toThrow("DRAKO_AI_NOT_AVAILABLE");
  });
});
