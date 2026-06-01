import { beforeEach, describe, expect, it, vi } from "vitest";
import { smokeSocialflowProductionReadiness } from "../scripts/smoke-socialflow-production-readiness";

describe("smoke-socialflow-production-readiness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_BASE_URL;
    delete process.env.SOCIALFLOW_PRODUCTION_RUNTIME_BASE_URL;
  });

  it("returns blocked when production URL is not configured", async () => {
    const report = await smokeSocialflowProductionReadiness();
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_READINESS_BLOCKED_UNTIL_ROUTE_CONFIGURED");
    expect(report.productionRouteConfigured).toBe(false);
    expect(report.productionTouched).toBe(false);
    expect(report.remoteWrites).toBe(0);
  });

  it("returns ok on 200 response", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ready":true}',
    });

    const report = await smokeSocialflowProductionReadiness({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_READINESS_OK");
    expect(report.httpStatus).toBe(200);
    expect(report.productionTouched).toBe(true);
  });

  it("returns failed on non-2xx response", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "internal error",
    });

    const report = await smokeSocialflowProductionReadiness({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_READINESS_FAILED");
    expect(report.httpStatus).toBe(500);
  });

  it("returns token leakage blocker if sensitive tokens are detected", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"refresh_token":"secret-token-value"}',
    });

    const report = await smokeSocialflowProductionReadiness({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER");
    expect(report.tokenLeakageDetected).toBe(true);
  });

  it("supports json and markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await smokeSocialflowProductionReadiness({ json: true });
    await smokeSocialflowProductionReadiness({ markdown: true });
    const output = consoleLogSpy.mock.calls.flat().join("\n");

    expect(output).toContain("SOCIALFLOW_PRODUCTION_READINESS_BLOCKED_UNTIL_ROUTE_CONFIGURED");
    expect(output).toContain("# SOCIALFLOW PRODUCTION READINESS SMOKE");
    consoleLogSpy.mockRestore();
  });
});
