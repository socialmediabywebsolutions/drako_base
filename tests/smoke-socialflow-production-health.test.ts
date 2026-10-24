import { beforeEach, describe, expect, it, vi } from "vitest";
import { smokeSocialflowProductionHealth } from "../scripts/smoke-socialflow-production-health";

describe("smoke-socialflow-production-health", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_BASE_URL;
    delete process.env.SOCIALFLOW_PRODUCTION_RUNTIME_BASE_URL;
  });

  it("returns blocked when production URL is not configured", async () => {
    const report = await smokeSocialflowProductionHealth();
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_HEALTH_BLOCKED_UNTIL_ROUTE_CONFIGURED");
    expect(report.productionRouteConfigured).toBe(false);
    expect(report.productionTouched).toBe(false);
    expect(report.remoteWrites).toBe(0);
  });

  it("returns ok on 200 response", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });

    const report = await smokeSocialflowProductionHealth({ fetchImpl: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_HEALTH_OK");
    expect(report.httpStatus).toBe(200);
    expect(report.productionTouched).toBe(true);
  });

  it("returns failed on non-2xx response", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    });

    const report = await smokeSocialflowProductionHealth({ fetchImpl: fetchMock as unknown as typeof fetch });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_HEALTH_FAILED");
    expect(report.httpStatus).toBe(503);
  });

  it("returns token leakage blocker if sensitive tokens are detected", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"access_token":"secret-token-value"}',
    });

    const report = await smokeSocialflowProductionHealth({ fetchImpl: fetchMock as unknown as typeof fetch });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER");
    expect(report.tokenLeakageDetected).toBe(true);
  });

  it("supports json and markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await smokeSocialflowProductionHealth({ json: true });
    await smokeSocialflowProductionHealth({ markdown: true });
    const output = consoleLogSpy.mock.calls.flat().join("\n");

    expect(output).toContain("SOCIALFLOW_PRODUCTION_HEALTH_BLOCKED_UNTIL_ROUTE_CONFIGURED");
    expect(output).toContain("# SOCIALFLOW PRODUCTION HEALTH SMOKE");
    consoleLogSpy.mockRestore();
  });
});
