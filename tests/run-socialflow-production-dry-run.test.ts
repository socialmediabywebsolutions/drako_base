import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { runSocialflowProductionDryRun } from "../scripts/run-socialflow-production-dry-run";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "socialflow-production-planned-approval.json",
);

describe("run-socialflow-production-dry-run", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_PLANNED_APPROVAL_FIXTURE;
    delete process.env.SOCIALFLOW_PRODUCTION_BASE_URL;
    delete process.env.SOCIALFLOW_PRODUCTION_RUNTIME_BASE_URL;
    delete process.env.SOCIALFLOW_PRODUCTION_EXPECTED_HOST;
    delete process.env.SOCIALFLOW_PRODUCTION_HEALTH_PATH;
    delete process.env.SOCIALFLOW_PRODUCTION_READINESS_PATH;
    delete process.env.SOCIALFLOW_PRODUCTION_WINDOW_ID;
    delete process.env.SOCIALFLOW_PRODUCTION_ON_CALL_OWNER;
    delete process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID;
    delete process.env.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID;
    delete process.env.SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID;
    delete process.env.SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID;
    delete process.env.SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID;
  });

  it("returns blocked without a planned-only fixture and never touches fetch", async () => {
    const fetchSpy = vi.fn();
    const globalWithFetch = globalThis as typeof globalThis & { fetch: typeof fetch };
    const originalFetch = globalWithFetch.fetch;

    try {
      globalWithFetch.fetch = fetchSpy as unknown as typeof fetch;

      const report = await runSocialflowProductionDryRun();

      expect(report.ok).toBe(false);
      expect(report.status).toBe("SOCIALFLOW_PRODUCTION_DRY_RUN_BLOCKED");
      expect(report.fixtureMode).toBe(false);
      expect(report.dryRunRequired).toBe(true);
      expect(report.dryRunReadyForPlanning).toBe(false);
      expect(report.readyForExecution).toBe(false);
      expect(report.executionAllowed).toBe(false);
      expect(report.commandsArePlannedOnly).toBe(true);
      expect(report.requiresHumanApproval).toBe(true);
      expect(report.productionTouchAllowed).toBe(false);
      expect(report.productionTouched).toBe(false);
      expect(report.remoteWrites).toBe(0);
      expect(report.dryRunScriptPresent).toBe(true);
      expect(report.dryRunReportPresent).toBe(true);
      expect(report.blockers).toContain("DRY_RUN_FIXTURE_REQUIRED");
      expect(report.approvalPackStatus.status).toBe("SOCIALFLOW_PRODUCTION_APPROVAL_PACK_BLOCKED");
      expect(report.approvalPackStatus.dryRunStatus.status).toBe("SOCIALFLOW_PRODUCTION_DRY_RUN_BLOCKED");
      expect(report.executionPlanStatus.preExecution.some((step) => step.step === "Verify Dry Run Master Checklist")).toBe(true);
      expect(report.smokeHealthStatus.status).toBe("SOCIALFLOW_PRODUCTION_HEALTH_BLOCKED_UNTIL_ROUTE_CONFIGURED");
      expect(report.smokeReadinessStatus.status).toBe("SOCIALFLOW_PRODUCTION_READINESS_BLOCKED_UNTIL_ROUTE_CONFIGURED");
      expect(report.smokePostdeployStatus.status).toBe("SOCIALFLOW_PRODUCTION_POSTDEPLOY_BLOCKED_UNTIL_ROUTE_CONFIGURED");
      expect(report.monitorStatus.status).toBe("SOCIALFLOW_PRODUCTION_MONITOR_BLOCKED_UNTIL_ROUTE_CONFIGURED");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalWithFetch.fetch = originalFetch;
    }
  });

  it("returns ready for planning review in planned-only fixture mode without fetch", async () => {
    const fetchSpy = vi.fn();
    const consoleLogSpy = vi.spyOn(console, "log");
    const globalWithFetch = globalThis as typeof globalThis & { fetch: typeof fetch };
    const originalFetch = globalWithFetch.fetch;

    try {
      globalWithFetch.fetch = fetchSpy as unknown as typeof fetch;

      const report = await runSocialflowProductionDryRun({ fixture: FIXTURE_PATH, json: true });
      const output = consoleLogSpy.mock.calls.flat().join("\n");

      expect(report.ok).toBe(true);
      expect(report.status).toBe("SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW");
      expect(report.fixtureMode).toBe(true);
      expect(report.dryRunReadyForPlanning).toBe(true);
      expect(report.readyForExecution).toBe(false);
      expect(report.executionAllowed).toBe(false);
      expect(report.commandsArePlannedOnly).toBe(true);
      expect(report.requiresHumanApproval).toBe(true);
      expect(report.productionTouchAllowed).toBe(false);
      expect(report.dryRunScriptPresent).toBe(true);
      expect(report.dryRunReportPresent).toBe(true);
      expect(report.approvalPackStatus.readyForApproval).toBe(true);
      expect(report.approvalPackStatus.dryRunStatus.status).toBe("SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW");
      expect(report.approvalPackStatus.dryRunStatus.readyForPlanning).toBe(true);
      expect(report.executionPlanStatus.missingArtifacts).toEqual([]);
      expect(report.executionPlanStatus.preExecution.some((step) => step.step === "Verify Dry Run Master Checklist")).toBe(true);
      expect(report.smokeHealthStatus.status).toBe("SOCIALFLOW_PRODUCTION_HEALTH_BLOCKED_UNTIL_ROUTE_CONFIGURED");
      expect(report.smokeReadinessStatus.status).toBe("SOCIALFLOW_PRODUCTION_READINESS_BLOCKED_UNTIL_ROUTE_CONFIGURED");
      expect(report.smokePostdeployStatus.status).toBe("SOCIALFLOW_PRODUCTION_POSTDEPLOY_BLOCKED_UNTIL_ROUTE_CONFIGURED");
      expect(report.monitorStatus.status).toBe("SOCIALFLOW_PRODUCTION_MONITOR_BLOCKED_UNTIL_ROUTE_CONFIGURED");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(output).toContain("SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW");
      expect(output).toContain("\"status\": \"SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW\"");
    } finally {
      consoleLogSpy.mockRestore();
      globalWithFetch.fetch = originalFetch;
    }
  });

  it("blocks token leakage from env-backed values", async () => {
    process.env.SOCIALFLOW_PRODUCTION_BASE_URL = "https://access_token.example.com";
    const report = await runSocialflowProductionDryRun();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_DRY_RUN_TOKEN_LEAKAGE_BLOCKER");
    expect(report.tokenLeakageDetected).toBe(true);
    expect(report.blockers).toContain("TOKEN_LEAKAGE_DETECTED");
  });

  it("supports markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    try {
      await runSocialflowProductionDryRun({ fixture: FIXTURE_PATH, markdown: true });
      const output = consoleLogSpy.mock.calls.flat().join("\n");

      expect(output).toContain("# SOCIALFLOW PRODUCTION DRY-RUN MASTER");
      expect(output).toContain("SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW");
      expect(output).toContain("Verify Dry Run Master Checklist");
    } finally {
      consoleLogSpy.mockRestore();
    }
  });
});
