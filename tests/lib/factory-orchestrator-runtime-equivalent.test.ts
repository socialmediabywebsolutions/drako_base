import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { planFactoryOrchestratorRuntimeParity } from "@/lib/campamento-base/factory-orchestrator-runtime-parity";
import { runPlatformBootstrap } from "@/lib/campamento-base/platform-bootstrap-loader";

type NeutralFactorySideEffectLog = {
  type:
    | "RESOLVE_PLATFORM"
    | "RUN_BOOTSTRAP"
    | "REGISTER_AUTOMATION"
    | "ENSURE_INTEGRATION"
    | "EXECUTE_HANDLER"
    | "SKIP_LEGACY_RUNTIME";
  saasId: string;
  tenantId: string | null;
  status: "READY" | "SKIPPED" | "FAILED";
  metadata?: Record<string, unknown>;
};

const capturedSideEffects = vi.hoisted(() => new Map<string, NeutralFactorySideEffectLog[]>());
const mockRegisterAutomation = vi.hoisted(() => vi.fn());
const mockConnectIntegration = vi.hoisted(() => vi.fn());
const mockExecuteHandler = vi.hoisted(() => vi.fn());

vi.mock("@/lib/automation-core", () => ({
  registerAutomation: mockRegisterAutomation,
}));

vi.mock("@/lib/integration-core", () => ({
  connectIntegration: mockConnectIntegration,
}));

function logNeutralSideEffect(
  executionId: string,
  log: NeutralFactorySideEffectLog,
): void {
  if (!capturedSideEffects.has(executionId)) {
    capturedSideEffects.set(executionId, []);
  }
  capturedSideEffects.get(executionId)!.push(log);
}

async function executeNeutralFactoryBootstrap(input: {
  saasId: string;
  tenantId?: string;
  executionId: string;
}): Promise<{
  success: boolean;
  sideEffects: NeutralFactorySideEffectLog[];
  handlerResult?: { ok: boolean; summary: string; metrics?: Record<string, number> };
}> {
  const { saasId, tenantId = null, executionId } = input;
  capturedSideEffects.set(executionId, []);

  const parity = await planFactoryOrchestratorRuntimeParity({ saasId, tenantId: tenantId ?? undefined });

  logNeutralSideEffect(executionId, {
    type: "RESOLVE_PLATFORM",
    saasId: parity.saasId,
    tenantId: parity.tenantId,
    status: parity.platformResolved ? "READY" : "FAILED",
  });

  if (!parity.platformResolved) {
    return {
      success: false,
      sideEffects: capturedSideEffects.get(executionId) || [],
    };
  }

  const bootstrap = await runPlatformBootstrap(parity.saasId);

  logNeutralSideEffect(executionId, {
    type: "RUN_BOOTSTRAP",
    saasId: parity.saasId,
    tenantId: parity.tenantId,
    status: bootstrap.status,
  });

  if (bootstrap.status === "READY") {
    mockRegisterAutomation({
      tenantId: parity.tenantId,
      saasId: parity.saasId,
      automationKey: `${parity.saasId}.neutral_automation`,
    });

    logNeutralSideEffect(executionId, {
      type: "REGISTER_AUTOMATION",
      saasId: parity.saasId,
      tenantId: parity.tenantId,
      status: "READY",
      metadata: { automationKey: `${parity.saasId}.neutral_automation` },
    });

    mockConnectIntegration({
      tenantId: parity.tenantId,
      saasId: parity.saasId,
      integrationKey: "neutral_integration",
    });

    logNeutralSideEffect(executionId, {
      type: "ENSURE_INTEGRATION",
      saasId: parity.saasId,
      tenantId: parity.tenantId,
      status: "READY",
      metadata: { integrationKey: "neutral_integration" },
    });

    const handlerResult = await mockExecuteHandler({
      executionId,
      tenantId: parity.tenantId,
      saasId: parity.saasId,
      automationKey: `${parity.saasId}.neutral_automation`,
    });

    logNeutralSideEffect(executionId, {
      type: "EXECUTE_HANDLER",
      saasId: parity.saasId,
      tenantId: parity.tenantId,
      status: "READY",
      metadata: { handlerExecuted: true },
    });

    return {
      success: true,
      sideEffects: capturedSideEffects.get(executionId) || [],
      handlerResult,
    };
  }

  logNeutralSideEffect(executionId, {
    type: "SKIP_LEGACY_RUNTIME",
    saasId: parity.saasId,
    tenantId: parity.tenantId,
    status: bootstrap.status,
  });

  return {
    success: false,
    sideEffects: capturedSideEffects.get(executionId) || [],
  };
}

describe("factory orchestrator runtime equivalent", () => {
  const legacyPrefix = ["@/lib", "campobase"].join("/") + "/";

  beforeEach(() => {
    vi.clearAllMocks();
    capturedSideEffects.clear();

    mockRegisterAutomation.mockReturnValue(undefined);
    mockConnectIntegration.mockReturnValue(undefined);
    mockExecuteHandler.mockResolvedValue({
      ok: true,
      summary: "Neutral handler execution completed",
      metrics: { processed: 1 },
    });
  });

  it("does not import frozen campobase namespace in test or module", () => {
    const testSource = readFileSync(
      "tests/lib/factory-orchestrator-runtime-equivalent.test.ts",
      "utf8",
    );
    const moduleSource = readFileSync(
      "src/lib/campamento-base/factory-orchestrator-runtime-parity.ts",
      "utf8",
    );

    expect(testSource).not.toContain(legacyPrefix);
    expect(moduleSource).not.toContain(legacyPrefix);
  });

  it("covers SocialFlow dynamic SaaS path with READY bootstrap and full effects", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
      tenantId: "tenant_factory_socialflow",
    });

    expect(result.platformResolved).toBe(true);
    expect(result.bootstrapStatus).toBe("READY");
    expect(result.success).toBe(true);
    expect(result.tenantId).toBe("tenant_factory_socialflow");
    expect(result.saasId).toBe("socialflow");
    expect(result.effects).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "REGISTER_AUTOMATION",
      "ENSURE_INTEGRATION",
    ]);
    expect(result.message).toContain("canonical Campamento Base platform definition");
  });

  it("covers Clinic dynamic SaaS path with SKIPPED bootstrap and no legacy execution", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "clinic",
      tenantId: "tenant_factory_clinic",
    });

    expect(result.platformResolved).toBe(true);
    expect(result.bootstrapStatus).toBe("SKIPPED");
    expect(result.success).toBe(false);
    expect(result.tenantId).toBe("tenant_factory_clinic");
    expect(result.saasId).toBe("clinic");
    expect(result.effects).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "SKIP_LEGACY_RUNTIME",
    ]);
    expect(result.message).toContain("neutral orchestration boundary");
    expect(result.message).toContain("future adapter");
  });

  it("covers TaskOps dynamic SaaS path with SKIPPED bootstrap and no legacy execution", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "taskops",
      tenantId: "tenant_factory_taskops",
    });

    expect(result.platformResolved).toBe(true);
    expect(result.bootstrapStatus).toBe("SKIPPED");
    expect(result.success).toBe(false);
    expect(result.tenantId).toBe("tenant_factory_taskops");
    expect(result.saasId).toBe("taskops");
    expect(result.effects).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "SKIP_LEGACY_RUNTIME",
    ]);
    expect(result.message).toContain("neutral orchestration boundary");
    expect(result.message).toContain("future adapter");
  });

  it("covers unknown SaaS with FAILED bootstrap and minimal effects", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "runtime_ops_unknown",
      tenantId: "tenant_factory_unknown",
    });

    expect(result.platformResolved).toBe(false);
    expect(result.bootstrapStatus).toBe("FAILED");
    expect(result.success).toBe(false);
    expect(result.tenantId).toBe("tenant_factory_unknown");
    expect(result.saasId).toBe("runtime_ops_unknown");
    expect(result.effects).toEqual(["RESOLVE_PLATFORM"]);
    expect(result.message).toContain("definition not found");
  });

  it("covers empty saasId with FAILED bootstrap and stable message", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "   ",
      tenantId: "tenant_factory_empty",
    });

    expect(result.platformResolved).toBe(false);
    expect(result.bootstrapStatus).toBe("FAILED");
    expect(result.success).toBe(false);
    expect(result.tenantId).toBe("tenant_factory_empty");
    expect(result.saasId).toBe("");
    expect(result.effects).toEqual(["RESOLVE_PLATFORM"]);
    expect(result.message).toBe("Factory orchestrator runtime parity requires a non-empty saasId.");
  });

  it("returns deterministic results for repeated calls with same input", async () => {
    const input = {
      saasId: "socialflow",
      tenantId: "tenant_factory_determinism",
    };

    const first = await planFactoryOrchestratorRuntimeParity(input);
    const second = await planFactoryOrchestratorRuntimeParity(input);
    const third = await planFactoryOrchestratorRuntimeParity(input);

    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(first.effects).toEqual(second.effects);
    expect(first.message).toBe(second.message);
  });

  it("maintains stable effect ordering across all paths", async () => {
    const socialflow = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
      tenantId: "tenant_order",
    });
    const clinic = await planFactoryOrchestratorRuntimeParity({
      saasId: "clinic",
      tenantId: "tenant_order",
    });
    const taskops = await planFactoryOrchestratorRuntimeParity({
      saasId: "taskops",
      tenantId: "tenant_order",
    });
    const unknown = await planFactoryOrchestratorRuntimeParity({
      saasId: "unknown_platform",
      tenantId: "tenant_order",
    });

    expect(socialflow.effects[0]).toBe("RESOLVE_PLATFORM");
    expect(socialflow.effects[1]).toBe("RUN_BOOTSTRAP");
    expect(socialflow.effects[2]).toBe("REGISTER_AUTOMATION");
    expect(socialflow.effects[3]).toBe("ENSURE_INTEGRATION");

    expect(clinic.effects[0]).toBe("RESOLVE_PLATFORM");
    expect(clinic.effects[1]).toBe("RUN_BOOTSTRAP");
    expect(clinic.effects[2]).toBe("SKIP_LEGACY_RUNTIME");

    expect(taskops.effects[0]).toBe("RESOLVE_PLATFORM");
    expect(taskops.effects[1]).toBe("RUN_BOOTSTRAP");
    expect(taskops.effects[2]).toBe("SKIP_LEGACY_RUNTIME");

    expect(unknown.effects[0]).toBe("RESOLVE_PLATFORM");
    expect(unknown.effects.length).toBe(1);
  });

  it("preserves tenantId context through all runtime parity paths", async () => {
    const withTenant = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
      tenantId: "tenant_context_preserved",
    });
    const withoutTenant = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
    });

    expect(withTenant.tenantId).toBe("tenant_context_preserved");
    expect(withoutTenant.tenantId).toBeNull();
  });

  it("provides stable messages for all bootstrap status outcomes", async () => {
    const ready = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
      tenantId: "tenant_msg",
    });
    const skippedClinic = await planFactoryOrchestratorRuntimeParity({
      saasId: "clinic",
      tenantId: "tenant_msg",
    });
    const skippedTaskOps = await planFactoryOrchestratorRuntimeParity({
      saasId: "taskops",
      tenantId: "tenant_msg",
    });
    const failed = await planFactoryOrchestratorRuntimeParity({
      saasId: "unknown_platform",
      tenantId: "tenant_msg",
    });

    expect(ready.message).toBeTruthy();
    expect(ready.message.length).toBeGreaterThan(0);

    expect(skippedClinic.message).toBeTruthy();
    expect(skippedClinic.message.length).toBeGreaterThan(0);

    expect(skippedTaskOps.message).toBeTruthy();
    expect(skippedTaskOps.message.length).toBeGreaterThan(0);

    expect(failed.message).toBeTruthy();
    expect(failed.message.length).toBeGreaterThan(0);
  });

  it("executes neutral side effects for SocialFlow READY path with mocked dependencies", async () => {
    const result = await executeNeutralFactoryBootstrap({
      saasId: "socialflow",
      tenantId: "tenant_neutral_sf",
      executionId: "exec_sf_1",
    });

    expect(result.success).toBe(true);
    expect(result.sideEffects).toHaveLength(5);
    expect(result.sideEffects[0]).toMatchObject({
      type: "RESOLVE_PLATFORM",
      saasId: "socialflow",
      tenantId: "tenant_neutral_sf",
      status: "READY",
    });
    expect(result.sideEffects[1]).toMatchObject({
      type: "RUN_BOOTSTRAP",
      saasId: "socialflow",
      status: "READY",
    });
    expect(result.sideEffects[2]).toMatchObject({
      type: "REGISTER_AUTOMATION",
      saasId: "socialflow",
      status: "READY",
    });
    expect(result.sideEffects[3]).toMatchObject({
      type: "ENSURE_INTEGRATION",
      saasId: "socialflow",
      status: "READY",
    });
    expect(result.sideEffects[4]).toMatchObject({
      type: "EXECUTE_HANDLER",
      saasId: "socialflow",
      status: "READY",
    });

    expect(mockRegisterAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant_neutral_sf",
        saasId: "socialflow",
        automationKey: "socialflow.neutral_automation",
      }),
    );
    expect(mockConnectIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant_neutral_sf",
        saasId: "socialflow",
        integrationKey: "neutral_integration",
      }),
    );
    expect(mockExecuteHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        executionId: "exec_sf_1",
        tenantId: "tenant_neutral_sf",
        saasId: "socialflow",
        automationKey: "socialflow.neutral_automation",
      }),
    );

    expect(result.handlerResult).toMatchObject({
      ok: true,
      summary: expect.any(String),
    });
  });

  it("executes neutral side effects for Clinic SKIPPED path without legacy runtime", async () => {
    const result = await executeNeutralFactoryBootstrap({
      saasId: "clinic",
      tenantId: "tenant_neutral_clinic",
      executionId: "exec_clinic_1",
    });

    expect(result.success).toBe(false);
    expect(result.sideEffects).toHaveLength(3);
    expect(result.sideEffects[0]).toMatchObject({
      type: "RESOLVE_PLATFORM",
      saasId: "clinic",
      tenantId: "tenant_neutral_clinic",
      status: "READY",
    });
    expect(result.sideEffects[1]).toMatchObject({
      type: "RUN_BOOTSTRAP",
      saasId: "clinic",
      status: "SKIPPED",
    });
    expect(result.sideEffects[2]).toMatchObject({
      type: "SKIP_LEGACY_RUNTIME",
      saasId: "clinic",
      status: "SKIPPED",
    });

    expect(mockRegisterAutomation).not.toHaveBeenCalled();
    expect(mockConnectIntegration).not.toHaveBeenCalled();
    expect(mockExecuteHandler).not.toHaveBeenCalled();
    expect(result.handlerResult).toBeUndefined();
  });

  it("executes neutral side effects for TaskOps SKIPPED path without legacy runtime", async () => {
    const result = await executeNeutralFactoryBootstrap({
      saasId: "taskops",
      tenantId: "tenant_neutral_taskops",
      executionId: "exec_taskops_1",
    });

    expect(result.success).toBe(false);
    expect(result.sideEffects).toHaveLength(3);
    expect(result.sideEffects[0]).toMatchObject({
      type: "RESOLVE_PLATFORM",
      saasId: "taskops",
      tenantId: "tenant_neutral_taskops",
      status: "READY",
    });
    expect(result.sideEffects[1]).toMatchObject({
      type: "RUN_BOOTSTRAP",
      saasId: "taskops",
      status: "SKIPPED",
    });
    expect(result.sideEffects[2]).toMatchObject({
      type: "SKIP_LEGACY_RUNTIME",
      saasId: "taskops",
      status: "SKIPPED",
    });

    expect(mockRegisterAutomation).not.toHaveBeenCalled();
    expect(mockConnectIntegration).not.toHaveBeenCalled();
    expect(mockExecuteHandler).not.toHaveBeenCalled();
    expect(result.handlerResult).toBeUndefined();
  });

  it("executes neutral side effects for unknown SaaS with FAILED resolution", async () => {
    const result = await executeNeutralFactoryBootstrap({
      saasId: "unknown_platform",
      tenantId: "tenant_neutral_unknown",
      executionId: "exec_unknown_1",
    });

    expect(result.success).toBe(false);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toMatchObject({
      type: "RESOLVE_PLATFORM",
      saasId: "unknown_platform",
      tenantId: "tenant_neutral_unknown",
      status: "FAILED",
    });

    expect(mockRegisterAutomation).not.toHaveBeenCalled();
    expect(mockConnectIntegration).not.toHaveBeenCalled();
    expect(mockExecuteHandler).not.toHaveBeenCalled();
    expect(result.handlerResult).toBeUndefined();
  });

  it("maintains deterministic side effect logs for repeated executions", async () => {
    const first = await executeNeutralFactoryBootstrap({
      saasId: "socialflow",
      tenantId: "tenant_determinism",
      executionId: "exec_det_1",
    });
    const second = await executeNeutralFactoryBootstrap({
      saasId: "socialflow",
      tenantId: "tenant_determinism",
      executionId: "exec_det_2",
    });

    expect(first.sideEffects.length).toBe(second.sideEffects.length);
    expect(first.sideEffects.map((e) => e.type)).toEqual(second.sideEffects.map((e) => e.type));
    expect(first.success).toBe(second.success);
  });

  it("preserves side effect ordering across all execution paths", async () => {
    const socialflow = await executeNeutralFactoryBootstrap({
      saasId: "socialflow",
      tenantId: "tenant_order",
      executionId: "exec_order_sf",
    });
    const clinic = await executeNeutralFactoryBootstrap({
      saasId: "clinic",
      tenantId: "tenant_order",
      executionId: "exec_order_clinic",
    });
    const taskops = await executeNeutralFactoryBootstrap({
      saasId: "taskops",
      tenantId: "tenant_order",
      executionId: "exec_order_taskops",
    });
    const unknown = await executeNeutralFactoryBootstrap({
      saasId: "unknown_platform",
      tenantId: "tenant_order",
      executionId: "exec_order_unknown",
    });

    expect(socialflow.sideEffects.map((e) => e.type)).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "REGISTER_AUTOMATION",
      "ENSURE_INTEGRATION",
      "EXECUTE_HANDLER",
    ]);

    expect(clinic.sideEffects.map((e) => e.type)).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "SKIP_LEGACY_RUNTIME",
    ]);

    expect(taskops.sideEffects.map((e) => e.type)).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "SKIP_LEGACY_RUNTIME",
    ]);

    expect(unknown.sideEffects.map((e) => e.type)).toEqual(["RESOLVE_PLATFORM"]);
  });
});
