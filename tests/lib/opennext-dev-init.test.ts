import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initOpenNextCloudflareForDevMock = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  initOpenNextCloudflareForDev: initOpenNextCloudflareForDevMock,
}));

const originalArgv = [...process.argv];
const originalEnv = { ...process.env };

describe("next config OpenNext dev init", () => {
  beforeEach(() => {
    vi.resetModules();
    initOpenNextCloudflareForDevMock.mockReset();
    process.argv = [...originalArgv];
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    process.env = { ...originalEnv };
  });

  it("does not initialize OpenNext dev helpers during build", async () => {
    process.env.npm_lifecycle_event = "build";
    process.argv = ["node", "next", "build"];

    await import("../../next.config");

    expect(initOpenNextCloudflareForDevMock).not.toHaveBeenCalled();
  });

  it("initializes OpenNext dev helpers during next dev", async () => {
    process.env.npm_lifecycle_event = "dev";
    process.argv = ["node", "next", "dev"];

    await import("../../next.config");

    expect(initOpenNextCloudflareForDevMock).toHaveBeenCalledTimes(1);
  });
});
