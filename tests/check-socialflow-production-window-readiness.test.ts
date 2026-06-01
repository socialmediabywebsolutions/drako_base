import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkSocialflowProductionWindowReadiness } from "../scripts/check-socialflow-production-window-readiness";

const WINDOW_KEYS = [
  "SOCIALFLOW_PRODUCTION_WINDOW_ID",
  "SOCIALFLOW_PRODUCTION_ON_CALL_OWNER",
  "SOCIALFLOW_PRODUCTION_APPROVAL_ID",
  "SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID",
  "SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID",
  "SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID",
  "SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID",
] as const;

function clearWindowEnv(): void {
  WINDOW_KEYS.forEach((key) => {
    delete process.env[key];
  });
}

function setWindowEnv(): void {
  process.env.SOCIALFLOW_PRODUCTION_WINDOW_ID = "window-123";
  process.env.SOCIALFLOW_PRODUCTION_ON_CALL_OWNER = "oncall-owner";
  process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID = "approval-123";
  process.env.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID = "rollback-plan-123";
  process.env.SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID = "monitoring-plan-123";
  process.env.SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID = "smoke-sequence-123";
  process.env.SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID = "abort-criteria-123";
}

describe("check-socialflow-production-window-readiness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearWindowEnv();
  });

  it("returns not-approved when governance ids are missing", async () => {
    const report = await checkSocialflowProductionWindowReadiness({ silent: true });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_WINDOW_NOT_APPROVED");
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.blockers).toContain("WINDOW_GOVERNANCE_METADATA_INCOMPLETE");
    expect(report.blockers).toContain("APPROVAL_ID_REQUIRED");
    expect(report.blockers).toContain("ON_CALL_OWNER_REQUIRED");
    expect(report.blockers).toContain("WINDOW_ID_REQUIRED");
  });

  it("returns ready-for-review when window governance and checklist evidence are present", async () => {
    setWindowEnv();
    const report = await checkSocialflowProductionWindowReadiness({ silent: true });
    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW");
    expect(report.monitoringPlanPresent).toBe(true);
    expect(report.smokeSequencePresent).toBe(true);
    expect(report.abortCriteriaPresent).toBe(true);
    expect(report.runbookPresent).toBe(true);
    expect(report.decisionPackPresent).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
  });

  it("supports json and markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await checkSocialflowProductionWindowReadiness({ json: true });
    await checkSocialflowProductionWindowReadiness({ markdown: true });
    const output = consoleLogSpy.mock.calls.flat().join("\n");

    expect(output).toContain("SOCIALFLOW_PRODUCTION_WINDOW_");
    expect(output).toContain("# SOCIALFLOW PRODUCTION WINDOW READINESS");
    consoleLogSpy.mockRestore();
  });

  it("never prints raw governance values", async () => {
    setWindowEnv();
    const sentinel = "SENTINEL_WINDOW_PRIVATE_VALUE_123456";
    process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID = sentinel;
    const consoleLogSpy = vi.spyOn(console, "log");

    await checkSocialflowProductionWindowReadiness();
    const output = consoleLogSpy.mock.calls.flat().join(" ");

    expect(output).not.toContain(sentinel);
    expect(output).toContain("REDACTED");
    consoleLogSpy.mockRestore();
  });
});
