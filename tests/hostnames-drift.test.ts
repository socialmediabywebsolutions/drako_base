import { describe, expect, it } from "vitest";
import { runHostnamesDriftChecks } from "../scripts/check-hostnames-drift";

const sourceOfTruthPath = "docs/config/workers-hostnames-expected-state.json";

describe("hostnames drifts", () => {
  it("passes when fixtures match expected", async () => {
    const result = await runHostnamesDriftChecks({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/hostnames-drifts/pass",
      writeReports: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.summary.blockersTotal).toBe(0);
  });

  it("fails with BLOCKER when hostname mismatch exists", async () => {
    const result = await runHostnamesDriftChecks({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/hostnames-drifts/drift-blocker",
      writeReports: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.summary.blockersTotal).toBeGreaterThan(0);
    expect(
      result.report.violations.some(
        (violation) =>
          violation.targetName === "drako.systems" &&
          (violation.checkCode === "hostnameMismatch" || violation.checkCode === "blockedServiceHit"),
      ),
    ).toBe(true);
  });
});
