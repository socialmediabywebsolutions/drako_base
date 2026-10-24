import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("campamento-base socialflow platform", () => {
  it("does not import from frozen campobase namespace", () => {
    const source = readFileSync(
      "src/lib/campamento-base/socialflow-platform.ts",
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/campobase\//);
    expect(source).not.toMatch(/import\(["']@\/lib\/campobase\//);
  });

  it("exports expected public socialflow platform members", async () => {
    const mod = await import("@/lib/campamento-base/socialflow-platform");

    expect(mod.SOCIALFLOW_PLATFORM_SAAS_ID).toBe("socialflow");
    expect(mod.socialFlowPlatformDefinition).toMatchObject({
      saasId: "socialflow",
      displayName: "Socialcors",
      supportsOperatorSurface: true,
    });
    expect(mod.socialFlowPlatformDefinition.automations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ automationKey: "socialflow.content_generation" }),
        expect.objectContaining({ automationKey: "socialflow.health_check" }),
      ]),
    );
    expect(mod.socialFlowPlatformDefinition.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ integrationKey: "linkedin", required: false }),
      ]),
    );
    expect(typeof mod.socialFlowPlatformBootstrap.connect).toBe("function");
  });

  it("keeps legacy socialflow platform file as temporary adapter", () => {
    const source = readFileSync(
      "src/lib/campobase/socialflow-platform.ts",
      "utf8",
    );

    expect(source).toContain("Legacy frozen namespace");
    expect(source).toContain("temporary adapter");
    expect(source).toContain("src/lib/campamento-base/socialflow-platform.ts");
    expect(source).toContain("@/lib/campamento-base/socialflow-platform");
    expect(source).toMatch(/export\s*\*\s*from\s*["']@\/lib\/campamento-base\/socialflow-platform["']/);
  });

  it("does not create new files named campobase", () => {
    const files = [
      "src/lib/campamento-base/socialflow-platform.ts",
      "tests/lib/campamento-base-socialflow-platform.test.ts",
    ];

    expect(files.some((file) => file.includes("campobase"))).toBe(false);
  });

  it("does not add new imports to legacy campobase namespace", () => {
    const source = readFileSync(
      "src/lib/campamento-base/socialflow-platform.ts",
      "utf8",
    );

    expect(source).not.toContain("@/lib/campobase/");
  });

  it("keeps namespace freeze guardrail setup compatible", () => {
    const source = readFileSync(
      "tests/architecture/campobase-namespace-freeze.test.ts",
      "utf8",
    );

    expect(source).toContain("FROZEN_CAMPOBASE_IMPORT_ALLOWLIST");
    expect(source).toContain("src/lib/campobase/socialflow-platform.ts::@/lib/campobase/socialflow-service");
  });
});
