import { beforeEach, describe, expect, it, vi } from "vitest";
import { smokeSocialflowProductionPostdeploy } from "../scripts/smoke-socialflow-production-postdeploy";

describe("smoke-socialflow-production-postdeploy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_BASE_URL;
    delete process.env.SOCIALFLOW_PRODUCTION_RUNTIME_BASE_URL;
  });

  it("returns blocked when production URL is not configured", async () => {
    const report = await smokeSocialflowProductionPostdeploy();
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_POSTDEPLOY_BLOCKED_UNTIL_ROUTE_CONFIGURED");
    expect(report.productionRouteConfigured).toBe(false);
    expect(report.productionTouched).toBe(false);
    expect(report.remoteWrites).toBe(0);
  });

  it("returns ok when health and readiness return 200", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ready":true}',
      });

    const report = await smokeSocialflowProductionPostdeploy({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_POSTDEPLOY_OK");
    expect(report.productionTouched).toBe(true);
  });

  it("returns failed when any endpoint fails", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "unavailable",
      });

    const report = await smokeSocialflowProductionPostdeploy({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_POSTDEPLOY_FAILED");
  });

  it("returns token leakage blocker when sensitive tokens are detected", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"access_token":"secret-token-value"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ready":true}',
      });

    const report = await smokeSocialflowProductionPostdeploy({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER");
    expect(report.tokenLeakageDetected).toBe(true);
  });

  it("supports json and markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await smokeSocialflowProductionPostdeploy({ json: true });
    await smokeSocialflowProductionPostdeploy({ markdown: true });
    const output = consoleLogSpy.mock.calls.flat().join("\n");

    expect(output).toContain("SOCIALFLOW_PRODUCTION_POSTDEPLOY_BLOCKED_UNTIL_ROUTE_CONFIGURED");
    expect(output).toContain("# SOCIALFLOW PRODUCTION POSTDEPLOY SMOKE");
    consoleLogSpy.mockRestore();
  });
});
