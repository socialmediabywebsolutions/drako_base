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
  const socialflowRuntimeGuardBase = {
    targetName: "test:socialflow-runtime-guard",
    rules: [
      {
        filePath: "workers/socialflows/wrangler.workers.toml",
        requiredTokens: [
          'main = "../../.open-next/socialflows/worker.js"',
          'directory = "../../.open-next/socialflows/assets"',
        ],
        forbiddenTokens: ['main = "src/workers.ts"'],
      },
      {
        filePath: "workers/socialflows/src/workers.ts",
        requiredTokens: ["SOCIALFLOW_RUNTIME_MISWIRED", "status: 500"],
        forbiddenTokens: ["success: true", "text/html", "status: 200"],
      },
      {
        filePath: "scripts/build-artifact-matrix-skeleton.mjs",
        requiredTokens: ['export { default } from', "artifact-manifest.json", "dedicated-wrapper"],
      },
      {
        filePath: "packages/shared/workers-handlers/index.ts",
        forbiddenTokens: ['case "socialflow"', 'case "socialflows"'],
      },
    ],
  } as const;
  const socialflowSmokeGuardBase = {
    targetName: "test:socialflow-smoke-guard",
    scriptPath: "scripts/smoke/socialflow-canonical-domain-smoke.mjs",
    canonicalApiPaths: [
      "/api/socialflow/profile",
      "/api/socialflow/campaigns?saasId=socialflow",
      "/api/socialflow/posts?saasId=socialflow",
    ],
    legacyGonePaths: ["/api/social/posts", "/api/social/linkedin/publish"],
    placeholderGuardTokens: ["placeholder token detected", "auth route did not render the SocialFlow auth page"],
  } as const;
  const legacyCompatInventoryGuardBase = {
    targetName: "test:legacy-compat-inventory",
    apiCompatDirs: ["src/app/api/owner", "src/app/api/campobase"],
    compatSurfaceDirs: ["src/app/owner", "src/app/campobase"],
    expectedApiCompatPaths: [
      "src/app/api/owner/accounting/route.ts",
      "src/app/api/owner/action-queue/route.ts",
      "src/app/api/owner/actions/route.ts",
      "src/app/api/owner/actions/[id]/decision/route.ts",
      "src/app/api/owner/actions/[id]/dismiss/route.ts",
      "src/app/api/owner/actions/[id]/execute/route.ts",
      "src/app/api/owner/actions/[id]/snooze/route.ts",
      "src/app/api/owner/actions/cleanup/route.ts",
      "src/app/api/owner/agents/route.ts",
      "src/app/api/owner/autopilot/route.ts",
      "src/app/api/owner/control-snapshot/route.ts",
      "src/app/api/owner/db/health/route.ts",
      "src/app/api/owner/domains/route.ts",
      "src/app/api/owner/domains/health/route.ts",
      "src/app/api/owner/domains/verify/route.ts",
      "src/app/api/owner/events/route.ts",
      "src/app/api/owner/events/rollup/route.ts",
      "src/app/api/owner/factory/actions/route.ts",
      "src/app/api/owner/factory/auto-recovery/route.ts",
      "src/app/api/owner/factory/incidents/route.ts",
      "src/app/api/owner/factory/recovery/retry-domain-verify/route.ts",
      "src/app/api/owner/factory/recovery/retry-job/route.ts",
      "src/app/api/owner/factory/status/route.ts",
      "src/app/api/owner/factory/trends/route.ts",
      "src/app/api/owner/governance/route.ts",
      "src/app/api/owner/governance/alerts/route.ts",
      "src/app/api/owner/marketing/route.ts",
      "src/app/api/owner/observability/failures/route.ts",
      "src/app/api/owner/observability/health/route.ts",
      "src/app/api/owner/orchestrator/route.ts",
      "src/app/api/owner/portfolio/route.ts",
      "src/app/api/owner/profile/route.ts",
      "src/app/api/owner/revenue/route.ts",
      "src/app/api/owner/saas-factory/create-saas/route.ts",
      "src/app/api/owner/saas-factory/jobs/[jobId]/route.ts",
      "src/app/api/owner/saas-pricing/recommendations/route.ts",
      "src/app/api/owner/support/tech/route.ts",
      "src/app/api/owner/support/tech/[id]/update/route.ts",
      "src/app/api/owner/support/tickets/route.ts",
      "src/app/api/owner/support/tickets/[id]/reply/route.ts",
      "src/app/api/owner/tasks/route.ts",
      "src/app/api/owner/tasks/materialize-from-growth-autopilot/route.ts",
      "src/app/api/owner/tasks/summary/route.ts",
      "src/app/api/owner/tax/summary/route.ts",
      "src/app/api/owner/treasury/snapshot/route.ts",
      "src/app/api/owner/vendor/expenses/route.ts",
      "src/app/api/owner/vendor/expenses/[id]/route.ts",
      "src/app/api/owner/vendor/snapshot/route.ts",
      "src/app/api/campobase/platform/route.ts",
      "src/app/api/campobase/socialflow/route.ts",
    ],
    expectedCompatSurfacePaths: [
      "src/app/owner/OwnerMarketingSection.tsx",
      "src/app/owner/OwnerPricingSection.tsx",
      "src/app/owner/OwnerTasksBoard.tsx",
      "src/app/owner/OwnerVendorSection.tsx",
      "src/app/owner/components/CampamentoCenterPanel.tsx",
      "src/app/owner/components/CampamentoLeftPanel.tsx",
      "src/app/owner/components/CampamentoProfile.tsx",
      "src/app/owner/components/CampamentoRightPanel.tsx",
      "src/app/owner/components/LegacyFiscalForm.tsx",
      "src/app/owner/catalog/page.tsx",
      "src/app/owner/domains/page.tsx",
      "src/app/owner/page.tsx",
      "src/app/owner/projects/page.tsx",
      "src/app/owner/projects/[id]/page.tsx",
      "src/app/owner/projects/create/page.tsx",
      "src/app/campobase/platform/page.tsx",
      "src/app/campobase/socialflow/page.tsx",
    ],
    redirectPageRules: [
      { filePath: "src/app/owner/page.tsx", requiredTokens: ['redirect(\"/operator\")'] },
      { filePath: "src/app/owner/catalog/page.tsx", requiredTokens: ['redirect(\"/operator/catalog\")'] },
      { filePath: "src/app/owner/domains/page.tsx", requiredTokens: ['redirect(\"/operator/domains\")'] },
      { filePath: "src/app/owner/projects/page.tsx", requiredTokens: ['redirect(\"/operator/projects\")'] },
      { filePath: "src/app/owner/projects/create/page.tsx", requiredTokens: ['redirect(\"/operator/projects/create\")'] },
      { filePath: "src/app/owner/projects/[id]/page.tsx", requiredTokens: ['/operator/projects/'] },
      { filePath: "src/app/campobase/socialflow/page.tsx", requiredTokens: ['redirect(\"/operator/socialflow\")'] },
      { filePath: "src/app/campobase/platform/page.tsx", requiredTokens: ["/operator/platform"] },
    ],
    forbiddenCompatSurfaceTokens: [
      "/api/mentoria/",
      "/api/socialflow/",
      "@/components/mentoria",
      "@/components/saas/socialflow",
      "@/lib/mentoria",
      "@/lib/socialflow",
    ],
  } as const;
  const legacyCompatTelemetryGuardBase = {
    targetName: "test:legacy-compat-telemetry",
    rules: [
      {
        filePath: "src/middleware.ts",
        requiredTokens: [
          "X-Drako-Legacy-Compat",
          "X-Drako-Sunset",
          "X-Drako-Control-Plane-Only",
          "X-Drako-Compat-Canonical",
          "legacy.compat.route.hit",
          "LEGACY_COMPAT_ROUTE_HIT",
        ],
      },
    ],
  } as const;
  const artifactMatrixProductsBase = [
    {
      key: "drakos",
      workerName: "saas-drakos-prod",
      artifactMode: "global-shared",
      wranglerConfigPath: "workers/drakos/wrangler.workers.toml",
      currentWranglerMain: "../../.open-next/worker.js",
      currentWranglerAssetsDirectory: "../../.open-next/assets",
      plannedWorkerPath: ".open-next/drakos/worker.js",
      plannedAssetsPath: ".open-next/drakos/assets",
    },
    {
      key: "bases",
      workerName: "saas-bases-prod",
      artifactMode: "global-shared",
      wranglerConfigPath: "workers/bases/wrangler.workers.toml",
      currentWranglerMain: "../../.open-next/worker.js",
      currentWranglerAssetsDirectory: "../../.open-next/assets",
      plannedWorkerPath: ".open-next/bases/worker.js",
      plannedAssetsPath: ".open-next/bases/assets",
    },
    {
      key: "mentorias",
      workerName: "saas-mentorias-prod",
      artifactMode: "global-shared",
      wranglerConfigPath: "workers/mentorias/wrangler.workers.toml",
      currentWranglerMain: "../../.open-next/worker.js",
      currentWranglerAssetsDirectory: "../../.open-next/assets",
      plannedWorkerPath: ".open-next/mentorias/worker.js",
      plannedAssetsPath: ".open-next/mentorias/assets",
    },
    {
      key: "socialflows",
      workerName: "saas-socialflows-prod",
      artifactMode: "dedicated-wrapper",
      wranglerConfigPath: "workers/socialflows/wrangler.workers.toml",
      currentWranglerMain: "../../.open-next/socialflows/worker.js",
      currentWranglerAssetsDirectory: "../../.open-next/socialflows/assets",
      plannedWorkerPath: ".open-next/socialflows/worker.js",
      plannedAssetsPath: ".open-next/socialflows/assets",
      dedicatedArtifactName: "open-next-socialflows-build",
    },
  ] as const;
  const artifactMatrixSkeletonGuardBase = {
    targetName: "test:artifact-matrix-skeleton",
    manifestPath: "docs/config/open-next-artifact-matrix.json",
    workflowPath: ".github/workflows/drako-factory-deploy.yml",
    buildScriptPath: "scripts/build-artifact-matrix-skeleton.mjs",
    expectedState: "partial-split",
    expectedDeployMode: "global-open-next-plus-socialflows-dedicated",
    expectedActiveArtifactName: "open-next-build",
    expectedDedicatedArtifacts: [
      {
        key: "socialflows",
        artifactName: "open-next-socialflows-build",
        workerPath: ".open-next/socialflows/worker.js",
        assetsPath: ".open-next/socialflows/assets",
      },
    ],
    expectedProducts: artifactMatrixProductsBase,
    workflowRequiredTokens: [
      "artifact_matrix_skeleton:",
      "Artifact Matrix Skeleton (${{ matrix.product }})",
      "pnpm build:artifacts:skeleton",
      "open-next-artifact-matrix-${{ matrix.product }}",
      "ARTIFACT_MATRIX_REQUIRE_GLOBAL_BUILD: \"1\"",
      "build/open-next-artifact-matrix/global",
      "name: open-next-build",
      "Download OpenNext build artifact",
      "name: open-next-socialflows-build",
      "Download SocialFlow dedicated artifact",
      "Verify SocialFlow dedicated artifact",
    ],
    buildScriptRequiredTokens: [
      "ARTIFACT_MATRIX_SKELETON_OK",
      "ARTIFACT_MATRIX_SKELETON_INVALID",
      "ARTIFACT_MATRIX_SKELETON_GLOBAL_BUILD_MISSING",
      "build/open-next-artifact-matrix",
      "export { default } from",
      "artifact-manifest.json",
    ],
  } as const;
  const artifactMatrixPrematureActivationGuardBase = {
    targetName: "test:artifact-matrix-premature-activation",
    products: artifactMatrixProductsBase,
    workflowPath: ".github/workflows/drako-factory-deploy.yml",
    forbiddenWorkflowTokens: [
      "name: open-next-artifact-matrix-drakos",
      "name: open-next-artifact-matrix-bases",
      "name: open-next-artifact-matrix-mentorias",
      "path: .open-next/drakos",
      "path: .open-next/bases",
      "path: .open-next/mentorias",
    ],
    allowedDedicatedProducts: ["socialflows"],
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

  it("passes readiness when SocialFlow runtime stays on the real OpenNext worker and its fallback is fail-closed", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowRuntimeGuardOverride: socialflowRuntimeGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.checks.some((item) => item.checkCode === "socialflowRuntimeGuardDrift" && item.status === "PASS")).toBe(true);
  });

  it("fails readiness when SocialFlow runtime drifts back to a fake worker or shared handler route", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowRuntimeGuardOverride: {
        targetName: "test:socialflow-runtime-guard-fake",
        rules: [
          {
            filePath: "tests/fixtures/production-audits/fake-runtime-guards/fake-worker.wrangler.toml",
            requiredTokens: ['main = "../../.open-next/worker.js"'],
            forbiddenTokens: ['main = "src/workers.ts"'],
          },
          {
            filePath: "tests/fixtures/production-audits/fake-runtime-guards/fake-worker.ts",
            requiredTokens: ["SOCIALFLOW_RUNTIME_MISWIRED", "status: 500"],
            forbiddenTokens: ["success: true", "text/html", "status: 200"],
          },
          {
            filePath: "tests/fixtures/production-audits/fake-runtime-guards/fake-shared-handlers.ts",
            forbiddenTokens: ['case "socialflow"', 'case "socialflows"'],
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowRuntimeGuardDrift")).toBe(true);
  });

  it("passes readiness when the SocialFlow canonical smoke stays strict", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowSmokeGuardOverride: socialflowSmokeGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some((item) => item.checkCode === "socialflowCanonicalSmokeGuardDrift" && item.status === "PASS"),
    ).toBe(true);
  });

  it("fails readiness when the SocialFlow canonical smoke becomes permissive", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowSmokeGuardOverride: {
        targetName: "test:socialflow-smoke-guard-permissive",
        scriptPath: "tests/fixtures/production-audits/smoke-guards/permissive-socialflow-smoke.mjs",
        canonicalApiPaths: socialflowSmokeGuardBase.canonicalApiPaths,
        legacyGonePaths: socialflowSmokeGuardBase.legacyGonePaths,
        placeholderGuardTokens: socialflowSmokeGuardBase.placeholderGuardTokens,
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowCanonicalSmokeGuardDrift")).toBe(true);
  });

  it("passes readiness when legacy compat inventory stays stable and operator-only", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      legacyCompatInventoryGuardOverride: legacyCompatInventoryGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.checks.some((item) => item.checkCode === "legacyCompatInventoryDrift" && item.status === "PASS")).toBe(true);
  });

  it("fails readiness when a new legacy compat route appears or a compat surface drifts", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      legacyCompatInventoryGuardOverride: {
        ...legacyCompatInventoryGuardBase,
        apiCompatDirs: ["tests/fixtures/production-audits/legacy-compat-inventory/extra-api"],
        compatSurfaceDirs: ["tests/fixtures/production-audits/legacy-compat-inventory/bad-surface"],
        expectedApiCompatPaths: [],
        expectedCompatSurfacePaths: ["tests/fixtures/production-audits/legacy-compat-inventory/bad-surface/page.tsx"],
        redirectPageRules: [
          {
            filePath: "tests/fixtures/production-audits/legacy-compat-inventory/bad-surface/page.tsx",
            requiredTokens: ['redirect("/operator")'],
          },
        ],
        forbiddenCompatSurfaceTokens: ["/api/socialflow/"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "legacyCompatInventoryDrift")).toBe(true);
  });

  it("passes readiness when middleware keeps sunset telemetry markers for legacy compat", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      legacyCompatTelemetryGuardOverride: legacyCompatTelemetryGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some((item) => item.checkCode === "legacyCompatTelemetryGuardMissing" && item.status === "PASS"),
    ).toBe(true);
  });

  it("fails readiness when middleware loses legacy compat sunset telemetry markers", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      legacyCompatTelemetryGuardOverride: {
        targetName: "test:legacy-compat-telemetry-missing",
        rules: [
          {
            filePath: "tests/fixtures/production-audits/legacy-compat-telemetry/missing-middleware.ts",
            requiredTokens: legacyCompatTelemetryGuardBase.rules[0].requiredTokens,
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "legacyCompatTelemetryGuardMissing")).toBe(true);
  });

  it("passes readiness when artifact matrix skeleton is present and deploy remains global", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      artifactMatrixSkeletonGuardOverride: artifactMatrixSkeletonGuardBase,
      artifactMatrixPrematureActivationGuardOverride: artifactMatrixPrematureActivationGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some((item) => item.checkCode === "artifactMatrixSkeletonDrift" && item.status === "PASS"),
    ).toBe(true);
    expect(
      result.report.checks.some((item) => item.checkCode === "artifactSplitPrematureActivation" && item.status === "PASS"),
    ).toBe(true);
  });

  it("fails readiness when the artifact matrix skeleton source of truth drifts", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      artifactMatrixSkeletonGuardOverride: {
        ...artifactMatrixSkeletonGuardBase,
        manifestPath: "tests/fixtures/production-audits/artifact-matrix-guards/drift-manifest.json",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "artifactMatrixSkeletonDrift")).toBe(true);
  });

  it("fails readiness when a worker or workflow acts like per-product artifacts are already active", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      artifactMatrixPrematureActivationGuardOverride: {
        ...artifactMatrixPrematureActivationGuardBase,
        products: [
          {
            ...artifactMatrixPrematureActivationGuardBase.products[0],
            wranglerConfigPath: "tests/fixtures/production-audits/artifact-matrix-guards/premature-worker.wrangler.toml",
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "artifactSplitPrematureActivation")).toBe(true);
  });
});
