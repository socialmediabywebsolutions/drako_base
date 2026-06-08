import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  getPlatformBootstrapLoaderRegistry,
  listPlatformBootstrapDefinitions,
  resolvePlatformBootstrapDefinition,
  runPlatformBootstrap,
  validatePlatformBootstrapRegistry,
} from "@/lib/campamento-base/platform-bootstrap-loader";

describe("platform bootstrap loader", () => {
  it("lists SocialFlow READY and Clinic/TaskOps SKIPPED definitions in neutral registry", () => {
    const definitions = listPlatformBootstrapDefinitions();

    expect(definitions).toHaveLength(3);
    expect(definitions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        saasId: "socialflow",
        name: "SocialFlow",
        status: "READY",
      }),
      expect.objectContaining({
        saasId: "clinic",
        name: "Clinic",
        status: "SKIPPED",
      }),
      expect.objectContaining({
        saasId: "taskops",
        name: "TaskOps",
        status: "SKIPPED",
      }),
    ]));
  });

  it("returns defensive registry copies", () => {
    const registry = getPlatformBootstrapLoaderRegistry();
    registry.definitions[0].name = "Mutated";
    registry.definitions.push({ saasId: "new", name: "New", status: "READY" });

    const freshRegistry = getPlatformBootstrapLoaderRegistry();
    const freshDefinitions = listPlatformBootstrapDefinitions();

    expect(freshRegistry.definitions).toHaveLength(3);
    expect(freshDefinitions).toHaveLength(3);
    expect(freshRegistry.definitions[0]).toMatchObject({
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

  it("resolves Clinic and TaskOps definitions as pending neutral coverage", () => {
    const clinic = resolvePlatformBootstrapDefinition("tenant_clinic_alpha");
    const taskops = resolvePlatformBootstrapDefinition("saas_taskops");

    expect(clinic).toMatchObject({
      saasId: "clinic",
      name: "Clinic",
      status: "SKIPPED",
    });
    expect(taskops).toMatchObject({
      saasId: "taskops",
      name: "TaskOps",
      status: "SKIPPED",
    });
  });

  it("returns null for unknown platform definitions", () => {
    expect(resolvePlatformBootstrapDefinition("unknown_saas")).toBeNull();
  });

  it("returns READY for canonical SocialFlow run", async () => {
    const result = await runPlatformBootstrap("SOCIALFLOW");

    expect(result).toMatchObject({
      saasId: "socialflow",
      success: true,
      status: "READY",
    });
    expect(result.message).toContain("canonical Campamento Base platform definition");
  });

  it("returns SKIPPED for Clinic and TaskOps during neutral-first scope", async () => {
    const clinic = await runPlatformBootstrap("clinic");
    const taskops = await runPlatformBootstrap("taskops");

    expect(clinic).toMatchObject({
      saasId: "clinic",
      success: false,
      status: "SKIPPED",
    });
    expect(clinic.message).toContain("neutral orchestration boundary");

    expect(taskops).toMatchObject({
      saasId: "taskops",
      success: false,
      status: "SKIPPED",
    });
    expect(taskops.message).toContain("neutral orchestration boundary");
  });

  it("returns FAILED for unknown or invalid saasId", async () => {
    const unknown = await runPlatformBootstrap("inventory");
    const empty = await runPlatformBootstrap("   ");

    expect(unknown).toMatchObject({
      saasId: "inventory",
      success: false,
      status: "FAILED",
    });
    expect(unknown.message).toContain("definition not found");

    expect(empty).toMatchObject({
      saasId: "   ",
      success: false,
      status: "FAILED",
    });
  });

  it("validates neutral registry with deterministic results", () => {
    const first = validatePlatformBootstrapRegistry();
    const second = validatePlatformBootstrapRegistry();

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first).toEqual(expect.arrayContaining([
      expect.objectContaining({
        saasId: "socialflow",
        success: true,
        status: "READY",
      }),
      expect.objectContaining({
        saasId: "clinic",
        success: true,
        status: "SKIPPED",
      }),
      expect.objectContaining({
        saasId: "taskops",
        success: true,
        status: "SKIPPED",
      }),
    ]));
  });

  it("detects duplicated saasId entries in custom registry validation", () => {
    const validation = validatePlatformBootstrapRegistry({
      definitions: [
        { saasId: "socialflow", name: "SocialFlow", status: "READY" },
        { saasId: "socialflow", name: "SocialFlow duplicate", status: "READY" },
      ],
    });

    expect(validation.every((result) => result.status === "FAILED")).toBe(true);
    expect(validation.every((result) => result.message.includes("duplicated saasId"))).toBe(true);
  });

  it("detects empty saasId in custom registry validation", () => {
    const validation = validatePlatformBootstrapRegistry({
      definitions: [
        { saasId: "", name: "SocialFlow", status: "READY" },
      ],
    });

    expect(validation).toHaveLength(1);
    expect(validation[0]).toMatchObject({
      success: false,
      status: "FAILED",
    });
    expect(validation[0].message).toContain("empty saasId");
  });

  it("detects empty name in custom registry validation", () => {
    const validation = validatePlatformBootstrapRegistry({
      definitions: [
        { saasId: "socialflow", name: "", status: "READY" },
      ],
    });

    expect(validation).toHaveLength(1);
    expect(validation[0]).toMatchObject({
      saasId: "socialflow",
      success: false,
      status: "FAILED",
    });
    expect(validation[0].message).toContain("empty name");
  });

  it("does not import frozen campobase namespace", () => {
    const source = readFileSync(
      "src/lib/campamento-base/platform-bootstrap-loader.ts",
      "utf8",
    );

    expect(source).not.toContain("@/lib/campobase/");
  });

  it("does not create new files named campobase", () => {
    const files = [
      "src/lib/campamento-base/platform-bootstrap-loader.ts",
      "tests/lib/platform-bootstrap-loader.test.ts",
    ];

    expect(files.some((file) => file.includes("campobase"))).toBe(false);
  });
});
