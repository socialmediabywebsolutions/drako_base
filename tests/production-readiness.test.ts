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

  it("passes socialflow auths guard when binding is dedicated and preview/prod are isolated", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowAuthsGuardOverride: {
        targetName: "test:socialflow-auths-guard",
        configPaths: ["tests/fixtures/production-audits/socialflow-auths-guards/pass.wrangler.toml"],
        socialflowBinding: "SOCIALFLOW_AUTHS_DB",
        reservedBindings: ["DRACO_DB", "SOCIAL_DB", "MENTORIAS_AUTHS_DB", "BASES_AUTHS_DB"],
      },
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some(
        (check) => check.checkCode === "socialflowAuthsBindingSharedIdentity" && check.status === "PASS",
      ),
    ).toBe(true);
    expect(
      result.report.checks.some(
        (check) => check.checkCode === "socialflowAuthsBindingPreviewProdCollision" && check.status === "PASS",
      ),
    ).toBe(true);
  });

  it("fails socialflow auths guard when binding reuses shared DRACO identity", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowAuthsGuardOverride: {
        targetName: "test:socialflow-auths-guard",
        configPaths: ["tests/fixtures/production-audits/socialflow-auths-guards/fail-shared-identity.wrangler.toml"],
        socialflowBinding: "SOCIALFLOW_AUTHS_DB",
        reservedBindings: ["DRACO_DB", "SOCIAL_DB", "MENTORIAS_AUTHS_DB", "BASES_AUTHS_DB"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(
      result.report.violations.some((item) => item.checkCode === "socialflowAuthsBindingSharedIdentity"),
    ).toBe(true);
  });

  it("fails socialflow auths guard when preview and production collide", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowAuthsGuardOverride: {
        targetName: "test:socialflow-auths-guard",
        configPaths: ["tests/fixtures/production-audits/socialflow-auths-guards/fail-preview-prod-collision.wrangler.toml"],
        socialflowBinding: "SOCIALFLOW_AUTHS_DB",
        reservedBindings: ["DRACO_DB", "SOCIAL_DB", "MENTORIAS_AUTHS_DB", "BASES_AUTHS_DB"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(
      result.report.violations.some((item) => item.checkCode === "socialflowAuthsBindingPreviewProdCollision"),
    ).toBe(true);
  });
});
