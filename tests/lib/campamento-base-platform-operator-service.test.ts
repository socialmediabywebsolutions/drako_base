import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("campamento-base platform operator service", () => {
  it("does not import from frozen campobase namespace", () => {
    const source = readFileSync(
      "src/lib/campamento-base/platform-operator-service.ts",
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/campobase\//);
    expect(source).not.toMatch(/import\(["']@\/lib\/campobase\//);
  });

  it("exports expected public platform operator functions", async () => {
    const service = await import("@/lib/campamento-base/platform-operator-service");

    expect(typeof service.getPlatformOperatorSurface).toBe("function");
    expect(typeof service.refreshPlatformOperatorSurface).toBe("function");
    expect(typeof service.runPlatformAutomationAction).toBe("function");
    expect(typeof service.setPlatformAutomationEnabled).toBe("function");
    expect(typeof service.validatePlatformIntegration).toBe("function");
    expect(typeof service.executePlatformIntegrationOperation).toBe("function");
    expect(typeof service.resolvePlatformOperatorError).toBe("function");
  });

  it("keeps legacy campobase file as temporary adapter", () => {
    const source = readFileSync(
      "src/lib/campobase/platform-operator-service.ts",
      "utf8",
    );

    expect(source).toContain("temporary adapter");
    expect(source).toContain("@/lib/campamento-base/platform-operator-service");
  });

  it("preserves route compatibility through canonical service import", () => {
    const routeSource = readFileSync(
      "src/app/api/operator/platform/route.ts",
      "utf8",
    );

    expect(routeSource).toContain("@/lib/campamento-base/platform-operator-service");
    expect(routeSource).not.toContain("@/lib/campobase/platform-operator-service");
  });

  it("does not create new files named campobase", () => {
    const files = [
      "src/lib/campamento-base/platform-operator-service.ts",
      "tests/lib/campamento-base-platform-operator-service.test.ts",
    ];

    expect(files.some((file) => file.includes("campobase"))).toBe(false);
  });
});
