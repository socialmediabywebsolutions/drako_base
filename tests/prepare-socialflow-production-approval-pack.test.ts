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

describe("prepare-socialflow-production-approval-pack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const report = await prepareSocialflowProductionApprovalPack({ json: true });
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
    expect(report).toHaveProperty("noDeployConfirmation");
    expect(report).toHaveProperty("noProductionTouchConfirmation");
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
