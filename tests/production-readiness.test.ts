import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { runProductionReadinessAudits } from "../scripts/check-production-readiness";

const sourceOfTruthPath = "docs/config/production-audits-expected-state.json";

describe("production readiness audits", () => {
  const socialflowAuthsGuardBase = {
    targetName: "test:socialflow-auths-guard",
    socialflowBinding: "SOCIALFLOW_AUTHS_DB",
    reservedBindings: [
      "DRACO_DB",
      "SAASES_DB",
      "SOCIAL_DB",
      "DRAKOS_AUTHS_DB",
      "MENTORIAS_AUTHS_DB",
      "BASES_AUTHS_DB",
      "MENTORIA_DB",
    ],
  } as const;
  const socialflowAuthsGuardPassOverride = {
    ...socialflowAuthsGuardBase,
    configPaths: ["tests/fixtures/production-audits/socialflow-auths-guards/pass.wrangler.toml"],
  } as const;
  const mentoriaGuardBase = {
    targetName: "test:mentoria-db-guard",
    mentoriaBinding: "MENTORIA_DB",
    reservedBindings: [
      "DRACO_DB",
      "SOCIAL_DB",
      "DRAKOS_AUTHS_DB",
      "MENTORIAS_AUTHS_DB",
      "BASES_AUTHS_DB",
      "SOCIALFLOW_AUTHS_DB",
    ],
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
      socialflowAuthsGuardOverride: socialflowAuthsGuardPassOverride,
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
      socialflowAuthsGuardOverride: socialflowAuthsGuardPassOverride,
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
        ...socialflowAuthsGuardBase,
        configPaths: ["tests/fixtures/production-audits/socialflow-auths-guards/fail-shared-identity.wrangler.toml"],
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
        ...socialflowAuthsGuardBase,
        configPaths: ["tests/fixtures/production-audits/socialflow-auths-guards/fail-preview-prod-collision.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(
      result.report.violations.some((item) => item.checkCode === "socialflowAuthsBindingPreviewProdCollision"),
    ).toBe(true);
  });

  it("fails socialflow auths guard when SOCIALFLOW_AUTHS_DB is missing", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowAuthsGuardOverride: {
        ...socialflowAuthsGuardBase,
        configPaths: ["tests/fixtures/production-audits/socialflow-auths-guards/missing-binding.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowAuthsBindingMissing")).toBe(true);
  });

  it("passes when socialflow canonical hostname is present (phase inactive override)", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowAuthsGuardOverride: socialflowAuthsGuardPassOverride,
      socialflowDomainGuardOverride: socialflowDomainGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some(
        (item) => item.checkCode === "socialflowCanonicalHostnameMissing" && item.status === "PASS",
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
      socialflowAuthsGuardOverride: socialflowAuthsGuardPassOverride,
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
      socialflowAuthsGuardOverride: socialflowAuthsGuardPassOverride,
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
      socialflowAuthsGuardOverride: socialflowAuthsGuardPassOverride,
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

  it("fails mentoria db guard when MENTORIA_DB is not configured", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/missing-binding.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(
      result.report.violations.some(
        (item) => item.checkCode === "mentoriaBindingMissingTransitionalDebt" && item.severity === "BLOCKER",
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

  it("fails mentoria readiness when product code imports the global DB helper", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/pass.wrangler.toml"],
        productSourcePaths: ["tests/fixtures/production-audits/mentoria-db-guards/leaky-src"],
        forbiddenImportTokens: ['@/lib/db'],
        workerConfigPath: "tests/fixtures/production-audits/mentoria-db-guards/pass.wrangler.toml",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaGlobalDbImportLeakage")).toBe(true);
  });

  it("fails mentoria readiness when the worker still exposes forbidden D1 bindings", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaBindingGuardOverride: {
        ...mentoriaGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-db-guards/pass.wrangler.toml"],
        productSourcePaths: [],
        workerConfigPath: "tests/fixtures/production-audits/mentoria-db-guards/fail-worker-binding-leakage.wrangler.toml",
        forbiddenWorkerBindings: ["DRACO_DB", "DB", "SOCIAL_DB", "DRAKOS_AUTHS_DB", "BASES_AUTHS_DB", "SOCIALFLOW_AUTHS_DB"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaWorkerBindingLeakage")).toBe(true);
  });

  it("fails readiness when legacy auth DB fallback flag is enabled", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      legacyAuthDbFallbackFlagGuardOverride: {
        targetName: "test:legacy-auth-db-fallback-flag",
        configPaths: ["tests/fixtures/production-audits/auth-db-fallback-flag/enabled.wrangler.toml"],
        flagName: "ALLOW_LEGACY_AUTH_DB_FALLBACK",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "legacyAuthDbFallbackFlagEnabled")).toBe(true);
  });

  it("passes readiness fixtures with the current real SocialFlow auth D1 bindings", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.productionReady).toBe(true);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowAuthsBindingMissing")).toBe(false);
    expect(
      result.report.checks.some(
        (item) => item.checkCode === "socialflowAuthsBindingSharedIdentity" && item.status === "PASS",
      ),
    ).toBe(true);
    expect(
      result.report.checks.some(
        (item) => item.checkCode === "socialflowAuthsBindingPreviewProdCollision" && item.status === "PASS",
      ),
    ).toBe(true);
  });

  it("fails placeholder guard when a deployable wrangler config contains an invalid fake database id", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowAuthsGuardOverride: socialflowAuthsGuardPassOverride,
      deployablePlaceholderDatabaseIdGuardOverride: {
        targetName: "test:deployable-placeholder-guard",
        configPaths: ["tests/fixtures/production-audits/socialflow-auths-guards/placeholder-binding.wrangler.toml"],
        forbiddenDatabaseIds: ["00000000-0000-0000-0000-000000000000"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "deployablePlaceholderDatabaseIdPresent")).toBe(
      true,
    );
  });

  it("keeps deployable wrangler configs free of placeholder ids and binds SocialFlow auth canonically", async () => {
    const [rootWrangler, socialflowWrangler, mentoriasWrangler, localWrangler] = await Promise.all([
      fs.readFile("wrangler.workers.toml", "utf8"),
      fs.readFile("workers/socialflows/wrangler.workers.toml", "utf8"),
      fs.readFile("workers/mentorias/wrangler.workers.toml", "utf8"),
      fs.readFile("wrangler.jsonc", "utf8"),
    ]);

    expect(rootWrangler).not.toContain('database_id = "00000000-0000-0000-0000-000000000000"');
    expect(socialflowWrangler).not.toContain('database_id = "00000000-0000-0000-0000-000000000000"');
    expect(mentoriasWrangler).not.toContain('database_id = "00000000-0000-0000-0000-000000000000"');
    expect(rootWrangler).toContain('binding = "SOCIALFLOW_AUTHS_DB"');
    expect(rootWrangler).toContain('database_id = "f6f46e6a-487f-400a-a2d1-c6d23e88f9cf"');
    expect(rootWrangler).toContain('database_id = "8bac57fd-bff1-4f9a-9868-54ff1ad2359e"');
    expect(socialflowWrangler).toContain('binding = "SOCIALFLOW_AUTHS_DB"');
    expect(socialflowWrangler).toContain('database_id = "f6f46e6a-487f-400a-a2d1-c6d23e88f9cf"');
    expect(localWrangler).toContain('"binding": "SOCIALFLOW_AUTHS_DB"');
    expect(localWrangler).not.toContain('"binding": "saas_socialflow_auths_prod_db"');
    expect(rootWrangler).toContain('binding = "MENTORIA_DB"');
    expect(mentoriasWrangler).toContain('binding = "MENTORIA_DB"');
    expect(mentoriasWrangler).toContain('binding = "MENTORIAS_AUTHS_DB"');
    expect(mentoriasWrangler).not.toContain('binding = "DRACO_DB"');
    expect(mentoriasWrangler).not.toContain('binding = "DB"');
  });

  it("fails readiness when SocialFlow source leaks into another product or control plane", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowBoundaryGuardOverride: {
        targetName: "test:socialflow-boundary-guard",
        sourcePaths: ["tests/fixtures/production-audits/cross-saas-guards/socialflow-leak"],
        forbiddenTokens: ["/api/mentoria/"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowCrossSaasLeakage")).toBe(true);
  });

  it("fails readiness when operator source calls a final-user product API directly", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      operatorBoundaryGuardOverride: {
        targetName: "test:operator-boundary-guard",
        sourcePaths: ["tests/fixtures/production-audits/cross-saas-guards/operator-leak"],
        forbiddenTokens: ["/api/mentoria/health/system"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "operatorFinalUserApiLeakage")).toBe(true);
  });

  it("fails readiness when owner/campobase compat routes drift away from operator-only bridges", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      legacyCompatRouteGuardOverride: {
        targetName: "test:legacy-compat-route-guard",
        routeDirs: ["tests/fixtures/production-audits/legacy-compat-guards/drift"],
        requiredAnyTokens: ['@/app/api/operator/', '@/app/api/factory/'],
        forbiddenTokens: ['/api/mentoria/'],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "legacyCompatRouteDrift")).toBe(true);
  });
});
