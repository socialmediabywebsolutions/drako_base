import { beforeEach, describe, expect, it, vi } from "vitest";
import { monitorSocialflowProductionDay } from "../scripts/monitor-socialflow-production-day";

describe("monitor-socialflow-production-day", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_BASE_URL;
    delete process.env.SOCIALFLOW_PRODUCTION_RUNTIME_BASE_URL;
  });

  it("returns blocked when production URL is not configured", async () => {
    const report = await monitorSocialflowProductionDay({ day: 1 });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_MONITOR_BLOCKED_UNTIL_ROUTE_CONFIGURED");
    expect(report.productionRouteConfigured).toBe(false);
    expect(report.productionTouched).toBe(false);
    expect(report.remoteWrites).toBe(0);
    expect(report.readyForCutover).toBe(false);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
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

    const report = await monitorSocialflowProductionDay({
      day: 2,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_MONITOR_OK");
    expect(report.day).toBe(2);
    expect(report.productionTouched).toBe(true);
    expect(report.productionTouchedBySafeReadOnlyChecks).toBe(true);
    expect(report.remoteWrites).toBe(0);
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
        status: 500,
        text: async () => "error",
      });

    const report = await monitorSocialflowProductionDay({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_MONITOR_FAILED");
  });

  it("returns token leakage blocker when tokens are detected", async () => {
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
        text: async () => '{"refresh_token":"secret-token-value"}',
      });

    const report = await monitorSocialflowProductionDay({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER");
    expect(report.tokenLeakageDetected).toBe(true);
  });

  it("supports json and markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await monitorSocialflowProductionDay({ day: 1, json: true });
    await monitorSocialflowProductionDay({ day: 1, markdown: true });
    const output = consoleLogSpy.mock.calls.flat().join("\n");

    expect(output).toContain("SOCIALFLOW_PRODUCTION_MONITOR_BLOCKED_UNTIL_ROUTE_CONFIGURED");
    expect(output).toContain("# SOCIALFLOW PRODUCTION MONITOR - DAY 1");
    consoleLogSpy.mockRestore();
  });
});
