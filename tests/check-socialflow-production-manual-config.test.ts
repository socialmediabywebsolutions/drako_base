import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkSocialflowProductionManualConfig } from "../scripts/check-socialflow-production-manual-config";

const REQUIRED_ENV_KEYS = [
  "SOCIALFLOW_PRODUCTION_BASE_URL",
  "SOCIALFLOW_PRODUCTION_HEALTH_PATH",
  "SOCIALFLOW_PRODUCTION_READINESS_PATH",
  "SOCIALFLOW_PRODUCTION_EXPECTED_HOST",
  "SOCIALFLOW_PRODUCTION_APPROVAL_ID",
  "SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID",
  "SOCIALFLOW_PRODUCTION_ON_CALL_OWNER",
  "SOCIALFLOW_PRODUCTION_WINDOW_ID",
  "SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID",
  "SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID",
  "SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID",
] as const;

function clearRequiredEnv(): void {
  REQUIRED_ENV_KEYS.forEach((key) => {
    delete process.env[key];
  });
}

function setRequiredEnv(): void {
  process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://socialflow.example.com";
  process.env.SOCIALFLOW_PRODUCTION_HEALTH_PATH = "/api/socialflow/runtime/health";
  process.env.SOCIALFLOW_PRODUCTION_READINESS_PATH = "/api/socialflow/runtime/readiness";
  process.env.SOCIALFLOW_PRODUCTION_EXPECTED_HOST = "socialflow.example.com";
  process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID = "approval-123";
  process.env.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID = "rollback-123";
  process.env.SOCIALFLOW_PRODUCTION_ON_CALL_OWNER = "oncall-owner";
  process.env.SOCIALFLOW_PRODUCTION_WINDOW_ID = "window-123";
  process.env.SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID = "monitoring-plan-123";
  process.env.SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID = "smoke-sequence-123";
  process.env.SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID = "abort-criteria-123";
}

describe("check-socialflow-production-manual-config", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearRequiredEnv();
  });

  it("returns blocked when required variables are missing", async () => {
    const report = await checkSocialflowProductionManualConfig({ silent: true });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_BLOCKED");
    expect(report.manualConfigurationComplete).toBe(false);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.missingVariables.length).toBe(REQUIRED_ENV_KEYS.length);
  });

  it("returns ready-for-review when all required variables are present", async () => {
    setRequiredEnv();
    const report = await checkSocialflowProductionManualConfig({ silent: true });
    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW");
    expect(report.manualConfigurationComplete).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    report.variables.forEach((entry) => {
      expect(entry.presence).toBe("PRESENT");
      expect(entry.value).toBe("REDACTED");
    });
  });

  it("returns token-leakage blocker when sensitive token-like values are detected", async () => {
    setRequiredEnv();
    process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID = "access_token=very-sensitive";
    const report = await checkSocialflowProductionManualConfig({ silent: true });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_TOKEN_LEAKAGE_BLOCKER");
    expect(report.tokenLeakageDetected).toBe(true);
  });

  it("supports json and markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await checkSocialflowProductionManualConfig({ json: true });
    await checkSocialflowProductionManualConfig({ markdown: true });
    const output = consoleLogSpy.mock.calls.flat().join("\n");

    expect(output).toContain("SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_BLOCKED");
    expect(output).toContain("# SOCIALFLOW PRODUCTION MANUAL CONFIG CHECK");
    consoleLogSpy.mockRestore();
  });

  it("never prints raw environment values", async () => {
    setRequiredEnv();
    const sentinel = "SENTINEL_PRIVATE_VALUE_123456";
    process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID = sentinel;
    const consoleLogSpy = vi.spyOn(console, "log");

    await checkSocialflowProductionManualConfig();
    const output = consoleLogSpy.mock.calls.flat().join(" ");

    expect(output).not.toContain(sentinel);
    expect(output).toContain("REDACTED");
    consoleLogSpy.mockRestore();
  });
});
