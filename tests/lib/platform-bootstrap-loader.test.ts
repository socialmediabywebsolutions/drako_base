import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  listPlatformBootstrapDefinitions,
  resolvePlatformBootstrapDefinition,
  runPlatformBootstrap,
  validatePlatformBootstrapRegistry,
} from "@/lib/campamento-base/platform-bootstrap-loader";

describe("platform bootstrap loader", () => {
  it("registers canonical SocialFlow definition only in the neutral first pass", () => {
    const definitions = listPlatformBootstrapDefinitions();

    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      saasId: "socialflow",
      name: "SocialFlow",
      status: "READY",
    });
  });

  it("resolves canonical SocialFlow by exact and matched saasId", () => {
    const exact = resolvePlatformBootstrapDefinition(" socialflow ");
    const matched = resolvePlatformBootstrapDefinition("tenant_socialflow_alpha");

    expect(exact).toMatchObject({
      saasId: "socialflow",
      name: "SocialFlow",
    });
    expect(matched).toMatchObject({
      saasId: "socialflow",
      name: "SocialFlow",
    });
  });

  it("does not resolve unsupported legacy-owned domains in neutral first pass", () => {
    expect(resolvePlatformBootstrapDefinition("clinic")).toBeNull();
    expect(resolvePlatformBootstrapDefinition("taskops")).toBeNull();
    expect(resolvePlatformBootstrapDefinition("unknown_saas")).toBeNull();
  });

  it("returns READY for canonical SocialFlow run", async () => {
    const result = await runPlatformBootstrap("SOCIALFLOW");

    expect(result).toMatchObject({
      saasId: "socialflow",
      success: true,
      status: "READY",
    });
    expect(result.message).toContain("ready");
  });

  it("returns SKIPPED for Clinic and TaskOps during neutral-first scope", async () => {
    const clinic = await runPlatformBootstrap("clinic");
    const taskops = await runPlatformBootstrap("saas_taskops");

    expect(clinic).toMatchObject({
      saasId: "clinic",
      success: false,
      status: "SKIPPED",
    });
    expect(taskops).toMatchObject({
      saasId: "saas_taskops",
      success: false,
      status: "SKIPPED",
    });
  });

  it("returns FAILED for unknown or invalid saasId", async () => {
    const unknown = await runPlatformBootstrap("inventory");
    const empty = await runPlatformBootstrap("   ");

    expect(unknown).toMatchObject({
      saasId: "inventory",
      success: false,
      status: "FAILED",
    });
    expect(empty).toMatchObject({
      saasId: "   ",
      success: false,
      status: "FAILED",
    });
  });

  it("validates neutral registry entries as deterministic READY results", () => {
    const validation = validatePlatformBootstrapRegistry();

    expect(validation).toHaveLength(1);
    expect(validation[0]).toMatchObject({
      saasId: "socialflow",
      success: true,
      status: "READY",
    });
  });

  it("does not import frozen campobase namespace", () => {
    const source = readFileSync(
      "src/lib/campamento-base/platform-bootstrap-loader.ts",
      "utf8",
    );

    expect(source).not.toContain("@/lib/campobase/");
  });
});
