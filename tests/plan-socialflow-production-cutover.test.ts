import { describe, it, expect, vi, beforeEach } from "vitest";
import { planProductionCutover } from "../scripts/plan-socialflow-production-cutover";
import * as cutoverReadinessModule from "../scripts/check-socialflow-production-cutover-readiness";

describe("plan-socialflow-production-cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not execute deploy", async () => {
    vi.spyOn(
      cutoverReadinessModule,
      "checkProductionCutoverReadiness"
    ).mockResolvedValue({
      ok: true,
      readyForPlanning: true,
      readyForExecution: false,
      status: "READY_FOR_PLANNING",
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
      blockedBy: ["STAKEHOLDER_APPROVAL_REQUIRED"],
      recommendation: "OK",
      nextAction: "STAKEHOLDER_APPROVAL",
    });

    const plan = await planProductionCutover();

    expect(plan.executionAllowed).toBe(false);
    expect(plan.deployCommand.doNotExecute).toBe(true);
    expect(plan.deployCommand.command).toContain("PLACEHOLDER");
  });

  it("does not touch production", async () => {
    vi.spyOn(
      cutoverReadinessModule,
      "checkProductionCutoverReadiness"
    ).mockResolvedValue({
      ok: true,
      readyForPlanning: true,
      readyForExecution: false,
      status: "READY",
      timestamp: new Date().toISOString(),
      monitoring: {} as any,
      configuration: {} as any,
      gates: {} as any,
      security: {
        productionTouched: false,
        remoteWrites: 0,
        tokenLeakageDetected: false,
      },
      blockedBy: [],
      recommendation: "OK",
      nextAction: "APPROVAL",
    });

    const plan = await planProductionCutover();

    expect(plan.executionAllowed).toBe(false);
    expect(plan.readiness.readyForExecution).toBe(false);
  });

  it("does not print secrets", async () => {
    vi.spyOn(
      cutoverReadinessModule,
      "checkProductionCutoverReadiness"
    ).mockResolvedValue({
      ok: true,
      readyForPlanning: true,
      readyForExecution: false,
      status: "READY",
      timestamp: new Date().toISOString(),
      monitoring: {} as any,
      configuration: {} as any,
      gates: {} as any,
      security: {} as any,
      blockedBy: [],
      recommendation: "OK",
      nextAction: "APPROVAL",
    });

    const plan = await planProductionCutover();
    const planStr = JSON.stringify(plan);

    // Detect real secret values (key=value patterns), not safe descriptive text
    expect(planStr).not.toMatch(/access_token\s*[:=]\s*[a-zA-Z0-9_-]{20,}/);
    expect(planStr).not.toMatch(/refresh_token\s*[:=]\s*[a-zA-Z0-9_-]{20,}/);
    expect(planStr).not.toMatch(/encrypted_access_token\s*[:=]\s*[a-zA-Z0-9_-]{20,}/);
    expect(planStr).not.toMatch(/SOCIALFLOW_CANARY_GATE_TOKEN\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]/); 
    expect(planStr).not.toMatch(/password\s*[:=]\s*[a-zA-Z0-9_-]{10,}/);
  });

  it("includes rollback commands", async () => {
    vi.spyOn(
      cutoverReadinessModule,
      "checkProductionCutoverReadiness"
    ).mockResolvedValue({
      ok: true,
      readyForPlanning: true,
      readyForExecution: false,
      status: "READY",
      timestamp: new Date().toISOString(),
      monitoring: {} as any,
      configuration: {} as any,
      gates: {} as any,
      security: {} as any,
      blockedBy: [],
      recommendation: "OK",
      nextAction: "APPROVAL",
    });

    const plan = await planProductionCutover();

    expect(plan.rollbackCommands.length).toBeGreaterThan(0);
    expect(plan.rollbackCommands.some((r) => r.criticalPath)).toBe(true);
  });

  it("includes approvals required", async () => {
    vi.spyOn(
      cutoverReadinessModule,
      "checkProductionCutoverReadiness"
    ).mockResolvedValue({
      ok: true,
      readyForPlanning: true,
      readyForExecution: false,
      status: "READY",
      timestamp: new Date().toISOString(),
      monitoring: {} as any,
      configuration: {} as any,
      gates: {} as any,
      security: {} as any,
      blockedBy: [],
      recommendation: "OK",
      nextAction: "APPROVAL",
    });

    const plan = await planProductionCutover();

    expect(plan.approvalsRequired.length).toBeGreaterThan(0);
    expect(plan.requiresHumanApproval).toBe(true);
  });

  it("includes planned commands", async () => {
    vi.spyOn(
      cutoverReadinessModule,
      "checkProductionCutoverReadiness"
    ).mockResolvedValue({
      ok: true,
      readyForPlanning: true,
      readyForExecution: false,
      status: "READY",
      timestamp: new Date().toISOString(),
      monitoring: {} as any,
      configuration: {} as any,
      gates: {} as any,
      security: {} as any,
      blockedBy: [],
      recommendation: "OK",
      nextAction: "APPROVAL",
    });

    const plan = await planProductionCutover();

    expect(plan.prechecks.length).toBeGreaterThan(0);
    expect(plan.smokeCommands.length).toBeGreaterThan(0);
    expect(plan.monitoringCommands.length).toBeGreaterThan(0);
    expect(plan.commandsArePlannedOnly).toBe(true);
  });

  it("generates valid JSON output", async () => {
    vi.spyOn(
      cutoverReadinessModule,
      "checkProductionCutoverReadiness"
    ).mockResolvedValue({
      ok: true,
      readyForPlanning: true,
      readyForExecution: false,
      status: "READY",
      timestamp: new Date().toISOString(),
      monitoring: {} as any,
      configuration: {} as any,
      gates: {} as any,
      security: {} as any,
      blockedBy: [],
      recommendation: "OK",
      nextAction: "APPROVAL",
    });

    const plan = await planProductionCutover({ json: true });

    expect(plan).toHaveProperty("executionAllowed");
    expect(plan).toHaveProperty("requiresHumanApproval");
    expect(plan).toHaveProperty("commandsArePlannedOnly");
    expect(plan).toHaveProperty("prechecks");
    expect(plan).toHaveProperty("deployCommand");
    expect(plan).toHaveProperty("rollbackCommands");
    expect(plan).toHaveProperty("approvalsRequired");
    expect(() => JSON.stringify(plan)).not.toThrow();
  });

  it("blocks execution", async () => {
    vi.spyOn(
      cutoverReadinessModule,
      "checkProductionCutoverReadiness"
    ).mockResolvedValue({
      ok: true,
      readyForPlanning: true,
      readyForExecution: false,
      status: "READY",
      timestamp: new Date().toISOString(),
      monitoring: {} as any,
      configuration: {} as any,
      gates: {} as any,
      security: {} as any,
      blockedBy: [],
      recommendation: "OK",
      nextAction: "APPROVAL",
    });

    const plan = await planProductionCutover();

    expect(plan.executionAllowed).toBe(false);
    expect(plan.readiness.readyForExecution).toBe(false);
    expect(plan.deployCommand.doNotExecute).toBe(true);
    expect(plan.deployCommand.warning).toContain("DO NOT EXECUTE");
  });
});
