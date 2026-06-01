import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("returns planning-only approval when all gates are healthy", async () => {
    const report = await prepareSocialflowProductionApprovalPack();

    expect(report.readyForApproval).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.approvalScope).toBe("APPROVAL_FOR_PLANNING_ONLY");
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_APPROVAL_PACK_READY");
    expect(report.routeDnsAssessment.productionRouteNotReadyByDesign).toBe(true);
    expect(report.goNoGoRecommendation).toContain("PLANNING_ONLY");
  });

  it("blocks approval when route/dns has critical blockers", async () => {
    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ...baseRouteDns(),
      ok: false,
      status: "ROUTING_BLOCKER",
      blockers: ["READINESS_ROUTE_INCORRECT"],
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.productionBlockers).toContain("ROUTE_DNS_CRITICAL_NOT_READY");
  });

  it("blocks approval when minimum monitoring is not reached", async () => {
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
    expect(report.productionBlockers).toContain("MINIMUM_MONITORING_NOT_REACHED");
  });

  it("blocks approval when drift is detected", async () => {
    vi.spyOn(cutoverModule, "checkProductionCutoverReadiness").mockResolvedValue({
      ...baseCutover(),
      readyForPlanning: false,
      blockedBy: ["SWITCHES_OFF"],
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.monitoringEvidence.driftDetected).toBe(true);
    expect(report.productionBlockers).toContain("DRIFT_DETECTED");
  });

  it("blocks approval when configuration is not stable", async () => {
    vi.spyOn(cutoverModule, "checkProductionCutoverReadiness").mockResolvedValue({
      ...baseCutover(),
      readyForPlanning: false,
      configuration: {
        ...baseCutover().configuration,
        allowDeploy: false,
      },
      blockedBy: ["ALLOW_DEPLOY_FALSE"],
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.monitoringEvidence.stableConfig).toBe(false);
    expect(report.productionBlockers).toContain("STABLE_CONFIG_NOT_CONFIRMED");
  });

  it("blocks approval when parity fails", async () => {
    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue({
      ...baseParity(),
      ok: false,
      status: "PARITY_FAILED",
      exitCode: 1,
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.productionBlockers).toContain("PARITY_NOT_OK");
  });

  it("blocks approval when token leakage is detected", async () => {
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
    expect(report.productionBlockers).toContain("TOKEN_LEAKAGE_DETECTED");
  });

  it("blocks approval when production was touched", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ...baseSafetyGate(),
      ok: false,
      findings: {
        productionTouched: true,
      },
    });

    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForApproval).toBe(false);
    expect(report.currentStatus.productionTouched).toBe(true);
    expect(report.productionBlockers).toContain("PRODUCTION_TOUCHED");
  });

  it("never allows execution", async () => {
    const report = await prepareSocialflowProductionApprovalPack();
    expect(report.readyForExecution).toBe(false);
    expect(report.requiresHumanApproval).toBe(true);
  });

  it("generates valid JSON output", async () => {
    const report = await prepareSocialflowProductionApprovalPack({ json: true });
    expect(report).toHaveProperty("readyForApproval");
    expect(report).toHaveProperty("readyForExecution");
    expect(report).toHaveProperty("approvalScope");
    expect(report).toHaveProperty("routeDnsAssessment");
    expect(report).toHaveProperty("monitoringEvidence");
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
