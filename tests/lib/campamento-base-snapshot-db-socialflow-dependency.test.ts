import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("campamento-base snapshot-db socialflow dependency", () => {
  it("uses canonical socialflow service and not legacy campobase adapter", () => {
    const source = readFileSync(
      "src/lib/campamento-base/orchestrator/snapshot-db.ts",
      "utf8",
    );

    expect(source).toContain("@/lib/campamento-base/socialflow-control-plane-service");
    expect(source).not.toContain("@/lib/campobase/socialflow-service");
    expect(source).not.toContain("@/lib/campobase/");
  });

  it("keeps legacy adapter file intact", () => {
    const source = readFileSync(
      "src/lib/campobase/socialflow-service.ts",
      "utf8",
    );

    expect(source).toContain("temporary adapter");
    expect(source).toContain("export * from \"@/lib/campamento-base/socialflow-control-plane-service\";");
    expect(source).not.toContain("@/lib/socialflow/contracts/campobase");
  });

  it("remains compatible with namespace freeze guardrail setup", () => {
    const source = readFileSync(
      "tests/architecture/campobase-namespace-freeze.test.ts",
      "utf8",
    );

    expect(source).toContain("FROZEN_CAMPOBASE_IMPORT_ALLOWLIST");
    expect(source).toContain("@/lib/campobase/socialflow-service");
  });
});
