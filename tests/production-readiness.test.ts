import { describe, expect, it } from "vitest";
import { runProductionReadinessAudits } from "../scripts/check-production-readiness";

const sourceOfTruthPath = "docs/config/production-audits-expected-state.json";

describe("production readiness audits", () => {
  it("passes when fixtures match expected", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.productionReady).toBe(true);
    expect(result.report.summary.blockersTotal).toBe(0);
    expect(result.report.checks.some((check) => check.checkCode === "legacyProductionGuardMissing")).toBe(true);
  });

  it("fails with blockers when critical mismatches exist", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/fail-blocker",
      writeReports: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.productionReady).toBe(false);
    expect(result.report.summary.blockersTotal).toBeGreaterThan(0);
    expect(
      result.report.violations.some(
        (violation) =>
          violation.targetName.includes("drako.systems") ||
          violation.targetName.includes("drako_db_prod.users") ||
          violation.targetName.includes("drako-base-3"),
      ),
    ).toBe(true);
  });

  it("fails when a legacy production guard token is missing", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      legacyGuardsOverride: [
        {
          targetName: "legacy:create-saas-route",
          filePath: "src/app/api/saas/route.ts",
          mustInclude: ["__TOKEN_THAT_DOES_NOT_EXIST__"],
        },
      ],
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "legacyProductionGuardMissing")).toBe(true);
  });
});
