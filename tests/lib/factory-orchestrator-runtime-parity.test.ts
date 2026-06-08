import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { runPlatformBootstrap } from "@/lib/campamento-base/platform-bootstrap-loader";
import { planFactoryOrchestratorRuntimeParity } from "@/lib/campamento-base/factory-orchestrator-runtime-parity";

describe("factory orchestrator runtime parity", () => {
  const legacyPrefix = ["@/lib", "campobase"].join("/") + "/";

  it("does not import frozen campobase namespace", () => {
    const source = readFileSync(
      "src/lib/campamento-base/factory-orchestrator-runtime-parity.ts",
      "utf8",
    );

    expect(source).not.toContain(legacyPrefix);
  });

  it("returns READY flow and deterministic effects for SocialFlow", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
      tenantId: "tenant_socialflow",
    });

    expect(result).toMatchObject({
      saasId: "socialflow",
      tenantId: "tenant_socialflow",
      platformResolved: true,
      bootstrapStatus: "READY",
      success: true,
    });
    expect(result.effects).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "REGISTER_AUTOMATION",
      "ENSURE_INTEGRATION",
    ]);
  });

  it("returns SKIPPED flow for Clinic without legacy runtime execution", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "clinic",
      tenantId: "tenant_clinic",
    });

    expect(result).toMatchObject({
      saasId: "clinic",
      tenantId: "tenant_clinic",
      platformResolved: true,
      bootstrapStatus: "SKIPPED",
      success: false,
    });
    expect(result.effects).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "SKIP_LEGACY_RUNTIME",
    ]);
  });

  it("returns SKIPPED flow for TaskOps without legacy runtime execution", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "taskops",
      tenantId: "tenant_taskops",
    });

    expect(result).toMatchObject({
      saasId: "taskops",
      tenantId: "tenant_taskops",
      platformResolved: true,
      bootstrapStatus: "SKIPPED",
      success: false,
    });
    expect(result.effects).toEqual([
      "RESOLVE_PLATFORM",
      "RUN_BOOTSTRAP",
      "SKIP_LEGACY_RUNTIME",
    ]);
  });

  it("returns FAILED for unknown platform resolution", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "runtime_ops_unknown",
      tenantId: "tenant_unknown",
    });

    expect(result).toMatchObject({
      saasId: "runtime_ops_unknown",
      tenantId: "tenant_unknown",
      platformResolved: false,
      bootstrapStatus: "FAILED",
      success: false,
    });
    expect(result.effects).toEqual(["RESOLVE_PLATFORM"]);
  });

  it("returns FAILED for empty saasId with stable message", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "   ",
    });

    expect(result).toMatchObject({
      saasId: "",
      tenantId: null,
      platformResolved: false,
      bootstrapStatus: "FAILED",
      success: false,
    });
    expect(result.message).toBe("Factory orchestrator runtime parity requires a non-empty saasId.");
    expect(result.effects).toEqual(["RESOLVE_PLATFORM"]);
  });

  it("keeps tenantId as null when not provided", async () => {
    const result = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
    });

    expect(result.tenantId).toBeNull();
  });

  it("uses neutral loader result semantics for status and message", async () => {
    const parity = await planFactoryOrchestratorRuntimeParity({
      saasId: "clinic",
      tenantId: "tenant_clinic",
    });
    const loader = await runPlatformBootstrap("clinic");

    expect(parity.bootstrapStatus).toBe(loader.status);
    expect(parity.message).toBe(loader.message);
  });

  it("returns deterministic and stable effect ordering", async () => {
    const first = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
      tenantId: "tenant_socialflow",
    });
    const second = await planFactoryOrchestratorRuntimeParity({
      saasId: "socialflow",
      tenantId: "tenant_socialflow",
    });

    expect(first.effects).toEqual(second.effects);
    expect(first).toEqual(second);
  });

  it("does not create new files named campobase or add campobase imports", () => {
    const files = [
      "src/lib/campamento-base/factory-orchestrator-runtime-parity.ts",
      "tests/lib/factory-orchestrator-runtime-parity.test.ts",
    ];

    expect(files.some((file) => file.includes("campobase"))).toBe(false);

    const source = readFileSync(
      "tests/lib/factory-orchestrator-runtime-parity.test.ts",
      "utf8",
    );
    expect(source).not.toContain(legacyPrefix);
  });
});
