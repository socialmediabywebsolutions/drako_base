import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { planFactoryOrchestratorRuntimeParity } from "@/lib/campamento-base/factory-orchestrator-runtime-parity";

describe("factory orchestrator runtime equivalent", () => {
  const legacyPrefix = ["@/lib", "campobase"].join("/") + "/";

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
});
