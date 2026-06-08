import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("platform bootstrap loader contract document", () => {
  const contractPath = join(
    process.cwd(),
    "docs",
    "contracts",
    "campamento-base-platform-bootstrap-loader-contract-v1.md",
  );

  it("exists and defines canonical ownership and neutral boundary", () => {
    const source = readFileSync(contractPath, "utf8");

    expect(source).toContain("# Campamento Base Platform Bootstrap Loader Contract v1");
    expect(source).toContain("Campamento Base: canonical neutral control-plane orchestration boundary.");
    expect(source).toContain("SocialFlow: canonical platform already available at `src/lib/campamento-base/socialflow-platform.ts`.");
    expect(source).toContain("Clinic: independent vertical SaaS domain; not owned by Campamento Base runtime domain logic.");
    expect(source).toContain("TaskOps: transversal engine/module; not owned by Campamento Base runtime domain logic.");
    expect(source).toContain("Campobase: frozen temporary legacy compatibility layer under `src/lib/campobase/`.");
    expect(source).toContain("## 4. Neutral loader boundary");
    expect(source).toContain("src/lib/campamento-base/platform-bootstrap-loader.ts");
  });

  it("declares the minimum neutral loader API proposal", () => {
    const source = readFileSync(contractPath, "utf8");

    expect(source).toContain("PlatformBootstrapLoaderDefinition");
    expect(source).toContain("PlatformBootstrapLoaderResult");
    expect(source).toContain("PlatformBootstrapLoaderRegistry");
    expect(source).toContain("listPlatformBootstrapDefinitions");
    expect(source).toContain("resolvePlatformBootstrapDefinition");
    expect(source).toContain("runPlatformBootstrap");
    expect(source).toContain("validatePlatformBootstrapRegistry");
  });

  it("documents phased migration and constraints", () => {
    const source = readFileSync(contractPath, "utf8");

    expect(source).toContain("## 6. Migration strategy");
    expect(source).toContain("A. Create neutral loader module with deterministic contract API.");
    expect(source).toContain("B. Cover canonical SocialFlow first in neutral loader tests.");
    expect(source).toContain("C. Introduce temporary explicit adapters for Clinic/TaskOps only if needed");
    expect(source).toContain("D. Migrate `tests/lib/factory-orchestrator.test.ts`");
    expect(source).toContain("E. Migrate `tests/lib/campobase-platform-bootstrap.test.ts`");
    expect(source).toContain("F. After parity is proven, shrink guardrail from `8` to `7`, then `7` to `6` if both edges become removable.");

    expect(source).toContain("## 7. Non-goals");
    expect(source).toContain("- move Clinic or TaskOps domain logic into Campamento Base;");
    expect(source).toContain("- create any new import to `@/lib/campobase`.");
    expect(source).toContain("`create neutral platform bootstrap loader module and tests`");
  });

  it("does not propose creating new files named campobase", () => {
    const source = readFileSync(contractPath, "utf8").toLowerCase();

    const lines = source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) =>
        line.includes("src/lib/")
        && line.includes(".ts")
        && !line.startsWith("```"),
      );

    expect(lines.some((line) => line.includes("/campobase/") && line.includes("platform-bootstrap-loader"))).toBe(false);
  });
});
