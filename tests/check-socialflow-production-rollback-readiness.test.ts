import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { checkSocialflowProductionRollbackReadiness } from "../scripts/check-socialflow-production-rollback-readiness";

const GOVERNANCE_KEYS = [
  "SOCIALFLOW_PRODUCTION_ON_CALL_OWNER",
  "SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID",
  "SOCIALFLOW_PRODUCTION_APPROVAL_ID",
  "SOCIALFLOW_PRODUCTION_WINDOW_ID",
] as const;

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "socialflow-production-planned-approval.json",
);

function clearGovernanceEnv(): void {
  GOVERNANCE_KEYS.forEach((key) => {
    delete process.env[key];
  });
}

function setGovernanceEnv(): void {
  process.env.SOCIALFLOW_PRODUCTION_ON_CALL_OWNER = "oncall-owner";
  process.env.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID = "rollback-plan-123";
  process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID = "approval-123";
  process.env.SOCIALFLOW_PRODUCTION_WINDOW_ID = "window-123";
}

describe("check-socialflow-production-rollback-readiness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearGovernanceEnv();
  });

  it("returns not-executable when governance metadata is missing", async () => {
    const report = await checkSocialflowProductionRollbackReadiness({ silent: true });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_NOT_EXECUTABLE");
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.blockers).toContain("ROLLBACK_EXECUTION_METADATA_INCOMPLETE");
  });

  it("returns ready-for-review when rollback documentation and governance metadata are present", async () => {
    setGovernanceEnv();
    const report = await checkSocialflowProductionRollbackReadiness({ silent: true });
    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW");
    expect(report.rollbackPlanDocumented).toBe(true);
    expect(report.rollbackCommandSetPlannedOnly).toBe(true);
    expect(report.restorePathDocumented).toBe(true);
    expect(report.postRollbackSmokeListDocumented).toBe(true);
    expect(report.abortConditionsDocumented).toBe(true);
    expect(report.noRealRollbackExecuted).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
  });

  it("returns ready-for-review when planned-only fixture metadata is provided", async () => {
    const report = await checkSocialflowProductionRollbackReadiness({ silent: true, fixture: FIXTURE_PATH });

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW");
    expect(report.fixtureMode).toBe(true);
    expect(report.productionTouchAllowed).toBe(false);
    expect(report.rollbackPlanDocumented).toBe(true);
    expect(report.rollbackCommandSetPlannedOnly).toBe(true);
    expect(report.restorePathDocumented).toBe(true);
    expect(report.postRollbackSmokeListDocumented).toBe(true);
    expect(report.abortConditionsDocumented).toBe(true);
    expect(report.noRealRollbackExecuted).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.rollbackOwner.presence).toBe("FIXTURE");
    expect(report.rollbackPlanId.presence).toBe("FIXTURE");
    expect(report.approvalId.presence).toBe("FIXTURE");
    expect(report.windowId.presence).toBe("FIXTURE");
  });

  it("supports json and markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await checkSocialflowProductionRollbackReadiness({ json: true });
    await checkSocialflowProductionRollbackReadiness({ markdown: true });
    const output = consoleLogSpy.mock.calls.flat().join("\n");

    expect(output).toContain("SOCIALFLOW_PRODUCTION_ROLLBACK_");
    expect(output).toContain("# SOCIALFLOW PRODUCTION ROLLBACK READINESS");
    consoleLogSpy.mockRestore();
  });

  it("never prints raw governance values", async () => {
    setGovernanceEnv();
    const sentinel = "SENTINEL_ROLLBACK_PRIVATE_VALUE_123456";
    process.env.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID = sentinel;
    const consoleLogSpy = vi.spyOn(console, "log");

    await checkSocialflowProductionRollbackReadiness();
    const output = consoleLogSpy.mock.calls.flat().join(" ");

    expect(output).not.toContain(sentinel);
    expect(output).toContain("REDACTED");
    consoleLogSpy.mockRestore();
  });

  it("never prints raw fixture governance values", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");

    await checkSocialflowProductionRollbackReadiness({ fixture: FIXTURE_PATH });
    const output = consoleLogSpy.mock.calls.flat().join(" ");

    expect(output).toContain("FIXTURE");
    expect(output).not.toContain("fixture-rollback-socialflow-planned-only");
    expect(output).not.toContain("fixture-approval-socialflow-planned-only");
    consoleLogSpy.mockRestore();
  });
});
