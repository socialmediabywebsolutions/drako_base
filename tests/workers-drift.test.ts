import { describe, expect, it } from "vitest";
import { runWorkersDriftChecks } from "../scripts/check-workers-drift";

describe("workers drift checks", () => {
  it("detects blocker drift when archived worker is resurrected", async () => {
    const result = await runWorkersDriftChecks({
      sourceOfTruthPath: "docs/config/workers-expected-state.json",
      fixturesDir: "tests/fixtures/workers-drifts/drift-blocker",
      writeReports: false,
      autoRemediateArchived: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.workerName === "drako-base-3")).toBe(true);
    expect(result.report.violations.some((item) => item.severity === "BLOCKER")).toBe(true);
  });

  it("passes when fixtures match expected state", async () => {
    const result = await runWorkersDriftChecks({
      sourceOfTruthPath: "docs/config/workers-expected-state.json",
      fixturesDir: "tests/fixtures/workers-drifts/pass",
      writeReports: false,
      autoRemediateArchived: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.violations.length).toBe(0);
  });
});
