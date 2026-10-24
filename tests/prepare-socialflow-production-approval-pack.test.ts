import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { prepareSocialflowProductionApprovalPack } from "../scripts/prepare-socialflow-production-approval-pack";
import * as cutoverModule from "../scripts/check-socialflow-production-cutover-readiness";
import * as parityModule from "../scripts/check-socialflow-nonprod-ownership-parity";
import * as routeDnsModule from "../scripts/check-socialflow-route-dns-readiness";
import * as safetyGateModule from "../scripts/check-socialflow-production-safety-gate";

const baseSafetyGate = () =>
  ({
    ok: true,
    status: "SOCIALFLOW_PRODUCTION_SAFETY_GATE_OK",
    timestamp: new Date().toISOString(),
    checks: {
      gateProtectionActive: true,
    },
    findings: {},
    blockers: [],
    recommendation: "OK",
  }) as any;

const baseRouteDns = () =>
  ({
    ok: true,
    status: "CANARY_ROUTE_READY",
    timestamp: new Date().toISOString(),
    canaryRoutes: {} as any,
    productionRoutes: {
      productionHostNotReady: true,
      productionHostValue: null,
      notReadyByDesign: true,
    },
    blockers: [],
    recommendation: "OK",
  }) as any;

const baseCutover = () =>
  ({
    ok: true,
    readyForPlanning: true,
    readyForExecution: false,
    status: "SOCIALFLOW_PRODUCTION_CUTOVER_READY_FOR_PLANNING",
    timestamp: new Date().toISOString(),
    monitoring: {
      daysCompleted: 3,
      minimumMonitoringReached: true,
      recommendedMonitoringTarget: 7,
      recommendedMonitoringReached: false,
    },
    configuration: {
      allSwitchesOn: true,
      deployable: true,
      allowDeploy: true,
    },
    gates: {
      safetyGateOk: true,
      routeDnsReadyOk: true,
      parityOk: true,
      rollbackReady: true,
      tokenSafe: true,
    },
    security: {
      productionTouched: false,
      remoteWrites: 0,
      tokenLeakageDetected: false,
    },
    blockedBy: [],
    recommendation: "OK",
    nextAction: "STAKEHOLDER_APPROVAL",
  }) as any;

const baseParity = () =>
  ({
    ok: true,
    status: "PARITY_OK",
    exitCode: 0,
    remoteWrites: 0,
  }) as any;

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "socialflow-production-planned-approval.json",
);

describe("prepare-socialflow-production-approval-pack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_PLANNED_APPROVAL_FIXTURE;
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue(baseSafetyGate());
    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue(baseRouteDns());
    vi.spyOn(cutoverModule, "checkProductionCutoverReadiness").mockResolvedValue(baseCutover());
    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(baseParity());
  });

  it("returns planning approval ready but never execution ready", async () => {
    const report = await prepareSocialflowProductionApprovalPack();

    expect(report.readyForApproval).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_APPROVAL_PACK_READY_FOR_PLANNING_APPROVAL");
    expect(report.executionReadinessStatus).toBe("SOCIALFLOW_PRODUCTION_APPROVAL_PACK_NOT_READY_FOR_EXECUTION");
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.approvalScope).toBe("APPROVAL_FOR_PLANNING_ONLY");
    expect(report.routingReviewStatus.status).toBe("SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_BLOCKED");
    expect(report.routingReviewStatus.routingReviewPackPresent).toBe(true);
    expect(report.routingReviewStatus.routingReviewScriptPresent).toBe(true);
    expect(report.routingReviewStatus.readyForPlanning).toBe(false);
    expect(report.routingReviewStatus.readyForExecution).toBe(false);
    expect(report.routingReviewStatus.executionAllowed).toBe(false);
    expect(report.routingReviewStatus.commandsArePlannedOnly).toBe(true);
    expect(report.routingReviewStatus.requiresHumanApproval).toBe(true);
    expect(report.routingReviewStatus.manualConfigurationRequired).toBe(true);
    expect(report.routingReviewStatus.dnsRoutingRequired).toBe(true);
    expect(report.routingReviewStatus.productionTouchAllowed).toBe(false);
    expect(report.rollbackDrillRequired).toBe(true);
    expect(report.rollbackDrillSatisfiedForReview).toBe(false);
    expect(report.rollbackDrillStatus.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_BLOCKED");
    expect(report.rollbackDrillStatus.rollbackDrillPackPresent).toBe(true);
    expect(report.rollbackDrillStatus.rollbackDrillScriptPresent).toBe(true);
    expect(report.rollbackDrillStatus.readyForPlanning).toBe(false);
    expect(report.rollbackDrillStatus.readyForExecution).toBe(false);
    expect(report.rollbackDrillStatus.executionAllowed).toBe(false);
    expect(report.rollbackDrillStatus.commandsArePlannedOnly).toBe(true);
    expect(report.rollbackDrillStatus.requiresHumanApproval).toBe(true);
    expect(report.rollbackDrillStatus.productionTouchAllowed).toBe(false);
  });

  it("keeps fixture-mode review readiness planned-only", async () => {
    const report = await prepareSocialflowProductionApprovalPack({ fixture: FIXTURE_PATH });

    expect(report.fixtureMode).toBe(true);
    expect(report.productionTouchAllowed).toBe(false);
    expect(report.readyForApproval).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.approvalScope).toBe("APPROVAL_FOR_PLANNING_ONLY");
    expect(report.dryRunRequired).toBe(true);
    expect(report.dryRunReadyForPlanning).toBe(true);
    expect(report.dryRunReadyForExecution).toBe(false);
    expect(report.dryRunStatus.status).toBe("SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW");
    expect(report.dryRunStatus.dryRunScriptPresent).toBe(true);
    expect(report.dryRunStatus.dryRunReportPresent).toBe(true);
    expect(report.dryRunStatus.readyForPlanning).toBe(true);
    expect(report.dryRunStatus.readyForExecution).toBe(false);
    expect(report.dryRunStatus.executionAllowed).toBe(false);
    expect(report.dryRunStatus.commandsArePlannedOnly).toBe(true);
    expect(report.dryRunStatus.requiresHumanApproval).toBe(true);
    expect(report.dryRunStatus.productionTouchAllowed).toBe(false);
    expect(report.manualConfigurationSatisfiedForReview).toBe(true);
    expect(report.rollbackSatisfiedForReview).toBe(true);
    expect(report.monitoringSatisfiedForReview).toBe(true);
    expect(report.productionWindowSatisfiedForReview).toBe(true);
    expect(report.manualConfigStatus.status).toBe("SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW");
    expect(report.rollbackReadinessStatus.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW");
    expect(report.productionWindowStatus.status).toBe("SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW");
    expect(report.routingReviewStatus.status).toBe("SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING");
    expect(report.routingReviewStatus.routingReviewPackPresent).toBe(true);
    expect(report.routingReviewStatus.routingReviewScriptPresent).toBe(true);
    expect(report.routingReviewStatus.readyForPlanning).toBe(true);
    expect(report.routingReviewStatus.readyForExecution).toBe(false);
    expect(report.routingReviewStatus.executionAllowed).toBe(false);
    expect(report.routingReviewStatus.commandsArePlannedOnly).toBe(true);
    expect(report.routingReviewStatus.requiresHumanApproval).toBe(true);
    expect(report.rollbackDrillRequired).toBe(true);
    expect(report.rollbackDrillSatisfiedForReview).toBe(true);
    expect(report.rollbackDrillStatus.status).toBe("SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW");
    expect(report.rollbackDrillStatus.rollbackDrillPackPresent).toBe(true);
    expect(report.rollbackDrillStatus.rollbackDrillScriptPresent).toBe(true);
    expect(report.rollbackDrillStatus.readyForPlanning).toBe(true);
    expect(report.rollbackDrillStatus.readyForExecution).toBe(false);
    expect(report.rollbackDrillStatus.executionAllowed).toBe(false);
    expect(report.rollbackDrillStatus.commandsArePlannedOnly).toBe(true);
    expect(report.rollbackDrillStatus.requiresHumanApproval).toBe(true);
    expect(report.rollbackDrillStatus.productionTouchAllowed).toBe(false);
    expect(safetyGateModule.checkProductionSafetyGate).not.toHaveBeenCalled();
    expect(routeDnsModule.checkRouteDnsReadiness).not.toHaveBeenCalled();
    expect(cutoverModule.checkProductionCutoverReadiness).not.toHaveBeenCalled();
    expect(parityModule.runCheckSocialflowNonprodOwnershipParity).not.toHaveBeenCalled();
  });

  it("keeps required execution blockers even when planning approval is ready", async () => {
    const report = await prepareSocialflowProductionApprovalPack();

    expect(report.manualConfigurationRequired).toBe(true);
    expect(report.dnsRoutingRequired).toBe(true);
    expect(report.rollbackRequired).toBe(true);
    expect(report.monitoringRequired).toBe(true);
    expect(report.humanApprovalRequired).toBe(true);
    expect(report.blockers).toContain("MANUAL_CONFIGURATION_REQUIRED_FOR_EXECUTION");
    expect(report.blockers).toContain("DNS_ROUTING_REQUIRED_FOR_EXECUTION");
    expect(report.blockers).toContain("ROLLBACK_VALIDATION_REQUIRED_FOR_EXECUTION");
    expect(report.blockers).toContain("PRODUCTION_MONITORING_REQUIRED_FOR_EXECUTION");
    expect(report.blockers).toContain("HUMAN_APPROVAL_REQUIRED_FOR_EXECUTION");
  });

  it("blocks planning approval when route/dns has critical blockers", async () => {
    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ...baseRouteDns(),
      ok: false,
      status: "ROUTING_BLOCKER",
      blockers: ["READINESS_ROUTE_INCORRECT"],
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_APPROVAL_PACK_BLOCKED");
    expect(report.blockers).toContain("ROUTE_DNS_CRITICAL_NOT_READY");
  });

  it("blocks planning approval when rollback command readiness is false", async () => {
    vi.spyOn(cutoverModule, "checkProductionCutoverReadiness").mockResolvedValue({
      ...baseCutover(),
      gates: {
        ...baseCutover().gates,
        rollbackReady: false,
      },
      readyForPlanning: false,
      blockedBy: ["ROLLBACK_NOT_READY"],
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.blockers).toContain("ROLLBACK_NOT_READY");
  });

  it("blocks planning approval when minimum monitoring is not reached", async () => {
    vi.spyOn(cutoverModule, "checkProductionCutoverReadiness").mockResolvedValue({
      ...baseCutover(),
      readyForPlanning: false,
      monitoring: {
        ...baseCutover().monitoring,
        minimumMonitoringReached: false,
        daysCompleted: 2,
      },
      blockedBy: ["MINIMUM_MONITORING_NOT_REACHED"],
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.blockers).toContain("MINIMUM_MONITORING_NOT_REACHED");
  });

  it("blocks planning approval when parity fails", async () => {
    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue({
      ...baseParity(),
      ok: false,
      status: "PARITY_FAILED",
      exitCode: 1,
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.blockers).toContain("PARITY_NOT_OK");
  });

  it("blocks planning approval when token leakage is detected", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ...baseSafetyGate(),
      ok: false,
      findings: {
        tokenLeakageDetected: true,
      },
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.currentStatus.tokenLeakageDetected).toBe(true);
    expect(report.blockers).toContain("TOKEN_LEAKAGE_DETECTED");
  });

  it("tracks artifacts and execution plan status", async () => {
    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.productionTemplateStatus.path).toBe("apps/socialflow-runtime/wrangler.production.toml");
    expect(report.smokesStatus.status).toBe("ALL_PRESENT");
    expect(report.monitorStatus.status).toBe("PRESENT");
    expect(report.executionPlanStatus.missingArtifacts).toEqual([]);
    expect(report.executionPlanStatus.status).toBe(
      "SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_BLOCKED_PENDING_MANUAL_APPROVAL",
    );
    expect(report.manualConfigStatus.status).toMatch(/SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_/);
    expect(report.rollbackReadinessStatus.status).toMatch(/SOCIALFLOW_PRODUCTION_ROLLBACK_/);
    expect(report.productionWindowStatus.status).toMatch(/SOCIALFLOW_PRODUCTION_WINDOW_/);
    expect(report.monitoringReadinessStatus.status).toMatch(/PRODUCTION_MONITORING_/);
  });

  it("confirms runbook and decision pack files exist", () => {
    const runbookPath = path.join(
      process.cwd(),
      "docs",
      "runbooks",
      "socialflow-production-controlled-execution.md",
    );
    const decisionPackPath = path.join(
      process.cwd(),
      "docs",
      "architecture",
      "socialflow-production-approval-pack.md",
    );

    expect(existsSync(runbookPath)).toBe(true);
    expect(existsSync(decisionPackPath)).toBe(true);
  });

  it("generates valid JSON output", async () => {
    const report = await prepareSocialflowProductionApprovalPack({ json: true, fixture: FIXTURE_PATH });
    expect(report).toHaveProperty("readinessSummary");
    expect(report).toHaveProperty("manualConfigurationRequired");
    expect(report).toHaveProperty("dnsRoutingRequired");
    expect(report).toHaveProperty("rollbackRequired");
    expect(report).toHaveProperty("monitoringRequired");
    expect(report).toHaveProperty("humanApprovalRequired");
    expect(report).toHaveProperty("productionTemplateStatus");
    expect(report).toHaveProperty("smokesStatus");
    expect(report).toHaveProperty("monitorStatus");
    expect(report).toHaveProperty("executionPlanStatus");
    expect(report).toHaveProperty("blockers");
    expect(report).toHaveProperty("approvals");
    expect(report).toHaveProperty("manualConfigStatus");
    expect(report).toHaveProperty("rollbackReadinessStatus");
    expect(report).toHaveProperty("productionWindowStatus");
    expect(report).toHaveProperty("monitoringReadinessStatus");
    expect(report).toHaveProperty("routingReviewStatus");
    expect(report).toHaveProperty("noDeployConfirmation");
    expect(report).toHaveProperty("noProductionTouchConfirmation");
    expect(report).toHaveProperty("fixtureMode");
    expect(report).toHaveProperty("productionTouchAllowed");
    expect(report).toHaveProperty("manualConfigurationSatisfiedForReview");
    expect(report).toHaveProperty("rollbackSatisfiedForReview");
    expect(report).toHaveProperty("rollbackDrillRequired");
    expect(report).toHaveProperty("rollbackDrillSatisfiedForReview");
    expect(report).toHaveProperty("rollbackDrillStatus");
    expect(report).toHaveProperty("dryRunRequired");
    expect(report).toHaveProperty("dryRunReadyForPlanning");
    expect(report).toHaveProperty("dryRunReadyForExecution");
    expect(report).toHaveProperty("dryRunStatus");
    expect(report).toHaveProperty("monitoringSatisfiedForReview");
    expect(report).toHaveProperty("productionWindowSatisfiedForReview");
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it("does not print secrets", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await prepareSocialflowProductionApprovalPack();

    const allLogs = consoleLogSpy.mock.calls.flat().join(" ");
    const secretPatterns = [
      /SOCIALFLOW_CANARY_GATE_TOKEN\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
      /access_token\s*[:=]\s*[a-zA-Z0-9_-]{20,}/i,
      /password\s*[:=]\s*[a-zA-Z0-9_-]{10,}/i,
      /secret\s*[:=]\s*['"][a-zA-Z0-9_-]{10,}['"]/i,
    ];
    secretPatterns.forEach((pattern) => {
      expect(allLogs).not.toMatch(pattern);
    });
    consoleLogSpy.mockRestore();
  });
});
