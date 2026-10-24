import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { simulateSocialflowProductionRollback } from "../scripts/simulate-socialflow-production-rollback";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "socialflow-production-planned-approval.json",
);

function createRealDomainFixture(): string {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "socialflow-rollback-drill-real-domain-"));
  const fixturePath = path.join(tmpDir, "rollback-drill-real-domain.json");
  writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        approvalId: "fixture-approval-socialflow-planned-only",
        rollbackPlanId: "fixture-rollback-socialflow-planned-only",
        onCallOwner: "fixture-on-call-owner",
        productionWindowId: "fixture-window-socialflow-planned-only",
        productionBaseUrl: "https://socialflow.example.com",
        expectedHost: "socialflow.example.com",
        healthPath: "/api/socialflow/health",
        readinessPath: "/api/socialflow/readiness",
        monitoringPlanId: "fixture-monitoring-socialflow-planned-only",
        smokeSequenceId: "fixture-smoke-sequence-socialflow-planned-only",
        abortCriteriaId: "fixture-abort-criteria-socialflow-planned-only",
        humanApprovalRecorded: false,
        plannedOnly: true,
        productionTouchAllowed: false,
      },
      null,
      2,
    ),
    "utf8",
  );
  return fixturePath;
}

function createSensitiveFixture(): string {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "socialflow-rollback-drill-sensitive-"));
  const fixturePath = path.join(tmpDir, "rollback-drill-sensitive.json");
  writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        approvalId: "access_token:leak",
        rollbackPlanId: "fixture-rollback-socialflow-planned-only",
        onCallOwner: "fixture-on-call-owner",
        productionWindowId: "fixture-window-socialflow-planned-only",
        productionBaseUrl: "https://socialflow.example.invalid",
        expectedHost: "socialflow.example.invalid",
        healthPath: "/api/socialflow/health",
        readinessPath: "/api/socialflow/readiness",
        monitoringPlanId: "fixture-monitoring-socialflow-planned-only",
        smokeSequenceId: "fixture-smoke-sequence-socialflow-planned-only",
        abortCriteriaId: "fixture-abort-criteria-socialflow-planned-only",
        humanApprovalRecorded: false,
        plannedOnly: true,
        productionTouchAllowed: false,
      },
      null,
      2,
    ),
    "utf8",
  );
  return fixturePath;
}

describe("simulate-socialflow-production-rollback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_PLANNED_APPROVAL_FIXTURE;
  });

  it("returns blocked when no planned-only fixture is available", async () => {
    const report = await simulateSocialflowProductionRollback({ silent: true });

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_BLOCKED");
    expect(report.fixtureMode).toBe(false);
    expect(report.productionTouchAllowed).toBe(false);
    expect(report.rollbackExecutable).toBe(false);
    expect(report.rollbackCommandsPlannedOnly).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.noRealRollbackExecuted).toBe(true);
    expect(report.productionTouched).toBe(false);
    expect(report.remoteWrites).toBe(0);
    expect(report.blockers).toContain("PLANNED_ONLY_FIXTURE_REQUIRED");
  });

  it("returns ready-for-review with the planned-only invalid-host fixture", async () => {
    const report = await simulateSocialflowProductionRollback({ silent: true, fixture: FIXTURE_PATH });

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW");
    expect(report.fixtureMode).toBe(true);
    expect(report.productionTouchAllowed).toBe(false);
    expect(report.rollbackExecutable).toBe(false);
    expect(report.rollbackCommandsPlannedOnly).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.noRealRollbackExecuted).toBe(true);
    expect(report.productionTouched).toBe(false);
    expect(report.remoteWrites).toBe(0);
    expect(report.routingReviewPackPresent).toBe(true);
    expect(report.controlledExecutionRunbookPresent).toBe(true);
    expect(report.productionApprovalPackPresent).toBe(true);
    expect(report.rollbackDrillPackPresent).toBe(true);
    expect(report.rollbackDrillScriptPresent).toBe(true);
    expect(report.drillChecklist.abortConditionsDocumented).toBe(true);
    expect(report.drillChecklist.plannedRollbackSequenceDocumented).toBe(true);
    expect(report.drillChecklist.routingRestoreDocumented).toBe(true);
    expect(report.drillChecklist.workerTargetRestoreDocumented).toBe(true);
    expect(report.drillChecklist.configRestoreDocumented).toBe(true);
    expect(report.drillChecklist.postRollbackSmokeDocumented).toBe(true);
    expect(report.drillChecklist.postRollbackMonitoringDocumented).toBe(true);
    expect(report.drillChecklist.evidenceRequiredDocumented).toBe(true);
    expect(report.drillChecklist.humanApprovalRequiredDocumented).toBe(true);
    expect(report.drillChecklist.futureExecutionGateDocumented).toBe(true);
    expect(report.drillChecklist.noRealRollbackDecisionDocumented).toBe(true);
    expect(report.approvalId.presence).toBe("FIXTURE");
    expect(report.rollbackPlanId.presence).toBe("FIXTURE");
    expect(report.onCallOwner.presence).toBe("FIXTURE");
    expect(report.productionWindowId.presence).toBe("FIXTURE");
    expect(report.abortCriteriaId.presence).toBe("FIXTURE");
    expect(report.smokeSequenceId.presence).toBe("FIXTURE");
    expect(report.monitoringPlanId.presence).toBe("FIXTURE");
  });

  it("blocks a fixture that uses a real domain", async () => {
    const fixturePath = createRealDomainFixture();

    try {
      const report = await simulateSocialflowProductionRollback({ silent: true, fixture: fixturePath });

      expect(report.ok).toBe(false);
      expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_BLOCKED");
      expect(report.productionTouchAllowed).toBe(false);
      expect(report.readyForExecution).toBe(false);
      expect(report.executionAllowed).toBe(false);
      expect(report.commandsArePlannedOnly).toBe(true);
      expect(report.requiresHumanApproval).toBe(true);
      expect(report.blockers).toContain("FIXTURE_VALIDATION_FAILED");
      expect(report.blockers.length).toBeGreaterThan(0);
    } finally {
      rmSync(path.dirname(fixturePath), { recursive: true, force: true });
    }
  });

  it("blocks token-like values and does not leak them", async () => {
    const fixturePath = createSensitiveFixture();
    const consoleLogSpy = vi.spyOn(console, "log");

    try {
      const report = await simulateSocialflowProductionRollback({ json: true, fixture: fixturePath });
      const output = consoleLogSpy.mock.calls.flat().join(" ");

      expect(report.ok).toBe(false);
      expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_TOKEN_LEAKAGE_BLOCKER");
      expect(report.blockers).toContain("TOKEN_LEAKAGE_DETECTED");
      expect(output).not.toContain("access_token:leak");
    } finally {
      consoleLogSpy.mockRestore();
      rmSync(path.dirname(fixturePath), { recursive: true, force: true });
    }
  });

  it("supports json and markdown output without network calls", async () => {
    const fetchSpy = vi.fn();
    const consoleLogSpy = vi.spyOn(console, "log");
    const globalWithFetch = globalThis as typeof globalThis & { fetch: typeof fetch };
    const originalFetch = globalWithFetch.fetch;

    try {
      globalWithFetch.fetch = fetchSpy as unknown as typeof fetch;

      await simulateSocialflowProductionRollback({ json: true, fixture: FIXTURE_PATH });
      await simulateSocialflowProductionRollback({ markdown: true, fixture: FIXTURE_PATH });
      const output = consoleLogSpy.mock.calls.flat().join("\n");

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(output).toContain("SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW");
      expect(output).toContain("# SOCIALFLOW PRODUCTION ROLLBACK DRILL");
      expect(output).toContain("FIXTURE");
      expect(output).not.toContain("socialflow.example.invalid");
    } finally {
      consoleLogSpy.mockRestore();
      globalWithFetch.fetch = originalFetch;
    }
  });
});
