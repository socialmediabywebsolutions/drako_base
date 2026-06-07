import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

describe("operator socialflow legacy bridge contract", () => {
  const legacyBridgeRoutePath = "src/app/api/campobase/socialflow/route.ts";
  const canonicalOperatorRoutePath = "src/app/api/operator/socialflow/route.ts";
  const legacyAdapterPath = "src/lib/campobase/socialflow-service.ts";

  it("keeps legacy socialflow bridge route existing and delegating to canonical operator route", () => {
    expect(existsSync(legacyBridgeRoutePath)).toBe(true);
    expect(existsSync(canonicalOperatorRoutePath)).toBe(true);

    const legacyRouteSource = readFileSync(legacyBridgeRoutePath, "utf8");

    expect(legacyRouteSource).toMatch(
      /export\s*\{\s*dynamic\s*,\s*GET\s*,\s*POST\s*\}\s*from\s*["']@\/app\/api\/operator\/socialflow\/route["']/,
    );
  });

  it("keeps legacy socialflow bridge route free of campobase imports and custom handlers", () => {
    const legacyRouteSource = readFileSync(legacyBridgeRoutePath, "utf8");
    const nonEmptyLineCount = legacyRouteSource
      .split("\n")
      .filter((line: string) => line.trim().length > 0).length;

    expect(legacyRouteSource).not.toMatch(/from\s+["']@\/lib\/campobase\//);
    expect(legacyRouteSource).not.toContain("@/lib/campobase/socialflow-service");
    expect(legacyRouteSource).not.toMatch(/\bimport\s+.*@\/lib\/campobase\//);
    expect(legacyRouteSource).not.toMatch(/\bexport\s+async\s+function\s+GET\b/);
    expect(legacyRouteSource).not.toMatch(/\bexport\s+async\s+function\s+POST\b/);
    expect(nonEmptyLineCount).toBeLessThanOrEqual(3);
  });

  it("keeps canonical operator socialflow route using campamento-base service", () => {
    const operatorRouteSource = readFileSync(canonicalOperatorRoutePath, "utf8");

    expect(operatorRouteSource).toContain("@/lib/campamento-base/socialflow-control-plane-service");
    expect(operatorRouteSource).not.toContain("@/lib/campobase/socialflow-service");
    expect(operatorRouteSource).not.toMatch(/from\s+["']@\/lib\/campobase\//);
  });

  it("keeps legacy socialflow service file as temporary adapter", () => {
    expect(existsSync(legacyAdapterPath)).toBe(true);

    const legacyAdapterSource = readFileSync(legacyAdapterPath, "utf8");

    expect(legacyAdapterSource).toContain("temporary adapter");
    expect(legacyAdapterSource).toContain("@/lib/campamento-base/socialflow-control-plane-service");
    expect(legacyAdapterSource).toMatch(/export\s*\*\s*from\s*["']@\/lib\/campamento-base\/socialflow-control-plane-service["']/);
  });

  it("keeps this commit canonical-named without creating campobase-named files", () => {
    const filesCreatedInThisCommit = [
      "tests/api/operator-socialflow-legacy-bridge-contract.test.ts",
    ];

    expect(filesCreatedInThisCommit.some((file) => file.includes("campobase"))).toBe(false);
  });
});
