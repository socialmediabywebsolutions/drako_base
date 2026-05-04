import { describe, expect, it } from "vitest";
import { runProductionReadinessAudits } from "../scripts/check-production-readiness";

const sourceOfTruthPath = "docs/config/production-audits-expected-state.json";

describe("production readiness audits", () => {
  const mentoriaGuardBase = {
    targetName: "test:mentoria-db-guard",
    mentoriaBinding: "MENTORIA_DB",
    reservedBindings: ["DRACO_DB", "SOCIAL_DB", "MENTORIAS_AUTHS_DB", "BASES_AUTHS_DB", "SOCIALFLOW_AUTHS_DB"],
    fallbackFilePath: "src/lib/mentoria/get-mentoria-db.ts",
    fallbackToken: "env?.DRACO_DB",
  } as const;
  const socialflowDomainGuardBase = {
    targetName: "test:socialflow-canonical-domain",
    phase: "inactive",
    canonicalHostname: "socialflow.drako.systems",
    expectedWorker: "saas-socialflows-prod",
    compatibilityHostname: "socialflows.drako.systems",
    smokeEvidencePaths: ["tests/fixtures/production-audits/socialflow-domain-guards/smoke-present.txt"],
    smokeEvidenceTokens: ["socialflow.drako.systems", "/socialflow", "/api/socialflow"],
  } as const;

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

  it("keeps socialflow canonical hostname missing as non-blocking debt when phase is inactive", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowDomainGuardOverride: socialflowDomainGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.violations.some(
        (item) => item.checkCode === "socialflowCanonicalHostnameMissing" && item.severity === "WARN",
      ),
    ).toBe(true);
  });

  it("fails when socialflow canonical hostname is missing and phase is active", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/socialflow-domain-guards/active-missing-singular",
      writeReports: false,
      socialflowDomainGuardOverride: {
        ...socialflowDomainGuardBase,
        phase: "active",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowCanonicalHostnameMissing")).toBe(true);
  });

  it("passes when socialflow canonical hostname exists with expected worker during active phase", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/socialflow-domain-guards/active-singular-correct",
      writeReports: false,
      socialflowDomainGuardOverride: {
        ...socialflowDomainGuardBase,
        phase: "active",
      },
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some(
        (check) => check.checkCode === "socialflowCanonicalHostnameWrongWorker" && check.status === "PASS",
      ),
    ).toBe(true);
  });

  it("fails when socialflow canonical hostname points to an unexpected worker", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/socialflow-domain-guards/active-singular-wrong-worker",
      writeReports: false,
      socialflowDomainGuardOverride: {
        ...socialflowDomainGuardBase,
        phase: "active",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(
      result.report.violations.some((item) => item.checkCode === "socialflowCanonicalHostnameWrongWorker"),
    ).toBe(true);
  });

  it("warns when plural socialflow hostname exists but canonical singular is not active", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/socialflow-domain-guards/inactive-plural-no-singular",
      writeReports: false,
      socialflowDomainGuardOverride: socialflowDomainGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowPluralPrimaryWarning")).toBe(true);
  });

  it("passes mentoria db guard when binding is dedicated and preview/prod are isolated", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/pass.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some((check) => check.checkCode === "mentoriaBindingSharedIdentity" && check.status === "PASS"),
    ).toBe(true);
    expect(
      result.report.checks.some(
        (check) => check.checkCode === "mentoriaBindingPreviewProdCollision" && check.status === "PASS",
      ),
    ).toBe(true);
  });

  it("fails mentoria db guard when binding reuses DRACO_DB identity", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/fail-shared-draco.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaBindingSharedIdentity")).toBe(true);
  });

  it("fails mentoria db guard when binding reuses SOCIAL_DB identity", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/fail-shared-social.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaBindingSharedIdentity")).toBe(true);
  });

  it("fails mentoria db guard when binding reuses MENTORIAS_AUTHS_DB identity", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/fail-shared-mentorias-auths.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaBindingSharedIdentity")).toBe(true);
  });

  it("keeps readiness non-blocking when MENTORIA_DB is not configured yet", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/missing-binding.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.violations.some(
        (item) => item.checkCode === "mentoriaBindingMissingTransitionalDebt" && item.severity === "WARN",
      ),
    ).toBe(true);
  });

  it("fails mentoria db guard when preview collides with production identity", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/fail-preview-prod-collision.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(
      result.report.violations.some((item) => item.checkCode === "mentoriaBindingPreviewProdCollision"),
    ).toBe(true);
  });
});
