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
  const mentoriaAuthsGuardBase = {
    targetName: "test:mentoria-auths-guard",
    mentoriasAuthBinding: "MENTORIAS_AUTHS_DB",
    reservedBindings: [
      "DRACO_DB",
      "MENTORIA_DB",
      "SOCIAL_DB",
      "DRAKOS_AUTHS_DB",
      "BASES_AUTHS_DB",
      "SOCIALFLOW_AUTHS_DB",
    ],
  } as const;
  const mentoriaAuthsGuardPassOverride = {
    ...mentoriaAuthsGuardBase,
    configPaths: ["tests/fixtures/production-audits/mentoria-auths-guards/pass.wrangler.toml"],
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
        forbiddenTokens: [
          'main = "../../.open-next/worker.js"',
          'directory = "../../.open-next/assets"',
          'main = "src/workers.ts"',
        ],
      },
      {
        filePath: "workers/socialflows/src/workers.ts",
        requiredTokens: ["SOCIALFLOW_RUNTIME_MISWIRED", "status: 500"],
        forbiddenTokens: ["success: true", "text/html", "status: 200"],
      },
      {
        filePath: "scripts/build-artifact-matrix-skeleton.mjs",
        requiredTokens: ['export { default } from', 'export * from', "artifact-manifest.json", "dedicated-wrapper"],
        forbiddenTokens: ["success: true", "text/html", "dummy worker", "placeholder HTML"],
      },
      {
        filePath: ".github/workflows/drako-factory-deploy.yml",
        requiredTokens: [
          "Verify SocialFlow dedicated artifact",
          "name: open-next-socialflows-build",
          "Upload SocialFlow dedicated artifact",
          "Download SocialFlow dedicated artifact",
          'grep -q \'export { default } from "../worker.js";\' .open-next/socialflows/worker.js',
          'grep -q \'export \\* from "../worker.js";\' .open-next/socialflows/worker.js',
          '"productKey": "socialflows"',
          '"artifactMode": "dedicated-wrapper"',
          '"generatedFrom": ".open-next/worker.js"',
          'grep -q \'main = "../../.open-next/socialflows/worker.js"\' workers/socialflows/wrangler.workers.toml',
          'grep -q \'directory = "../../.open-next/socialflows/assets"\' workers/socialflows/wrangler.workers.toml',
          "SOCIALFLOW_DEDICATED_ARTIFACT_NOT_ACTIVATED",
          "SOCIALFLOW_DEDICATED_ARTIFACT_FAKE",
        ],
      },
      {
        filePath: "packages/shared/workers-handlers/index.ts",
        forbiddenTokens: ['case "socialflow"', 'case "socialflows"'],
      },
    ],
  } as const;
  const socialflowStandalonePreparedGuardBase = {
    targetName: "test:socialflow-standalone-prepared",
    rules: [
      {
        filePath: "docs/config/open-next-artifact-matrix.json",
        requiredTokens: [
          '"preparedArtifacts"',
          '"key": "socialflows"',
          '"artifactName": "open-next-socialflows-standalone-prepared"',
          '"artifactMode": "standalone-prepared"',
          '"state": "prepared"',
          '"activationState": "inactive"',
          '"deployMode": "not-deployed"',
          '"workerPath": ".open-next/socialflows-standalone/worker.js"',
          '"assetsPath": ".open-next/socialflows-standalone/assets"',
          '"generatedFrom": ".open-next/worker.js"',
          '"artifactMode": "dedicated-wrapper"',
          '"currentWranglerMain": "../../.open-next/socialflows/worker.js"',
          '"currentWranglerAssetsDirectory": "../../.open-next/socialflows/assets"',
          '"preparedArtifactName": "open-next-socialflows-standalone-prepared"',
        ],
      },
      {
        filePath: "scripts/build-artifact-matrix-skeleton.mjs",
        requiredTokens: [
          "copyOpenNextRuntimeSubset",
          "emitPreparedStandaloneArtifact",
          'preparedArtifact?.artifactMode === "standalone-prepared"',
          'preparedArtifact?.activationState === "inactive"',
          'preparedArtifact?.deployMode === "not-deployed"',
          "preparedStandaloneArtifact",
          "artifact-manifest.json",
        ],
        forbiddenTokens: ["dummy worker", "placeholder HTML"],
      },
      {
        filePath: ".github/workflows/drako-factory-deploy.yml",
        requiredTokens: [
          "Verify SocialFlow standalone prepared artifact (inactive)",
          "Verify SocialFlow standalone remains inactive",
          "test -f .open-next/socialflows-standalone/worker.js",
          "test -d .open-next/socialflows-standalone/assets",
          "test -d .open-next/socialflows-standalone/server-functions",
          '"artifactMode": "standalone-prepared"',
          '"artifactState": "prepared"',
          '"activationState": "inactive"',
          '"deployMode": "not-deployed"',
          '"generatedFrom": ".open-next/worker.js"',
          "SOCIALFLOW_STANDALONE_PREPARED_IS_WRAPPER",
          "SOCIALFLOW_STANDALONE_PREPARED_FAKE",
          "SOCIALFLOW_STANDALONE_PREMATURE_ACTIVATION",
          'grep -q \'main = "../../.open-next/socialflows/worker.js"\' workers/socialflows/wrangler.workers.toml',
          'grep -q \'directory = "../../.open-next/socialflows/assets"\' workers/socialflows/wrangler.workers.toml',
        ],
        forbiddenTokens: [
          "Download SocialFlow standalone prepared artifact",
          "Deploy SocialFlow standalone",
          "name: open-next-socialflows-standalone-build",
        ],
      },
      {
        filePath: "workers/socialflows/wrangler.workers.toml",
        requiredTokens: [
          'main = "../../.open-next/socialflows/worker.js"',
          'directory = "../../.open-next/socialflows/assets"',
        ],
        forbiddenTokens: ["socialflows-standalone", "open-next-socialflows-standalone"],
      },
    ],
  } as const;
  const mentoriaRuntimeGuardBase = {
    targetName: "test:mentoria-runtime-guard",
    rules: [
      {
        filePath: "workers/mentorias/wrangler.workers.toml",
        requiredTokens: [
          'main = "../../.open-next/mentorias/worker.js"',
          'directory = "../../.open-next/mentorias/assets"',
          'binding = "MENTORIA_DB"',
          'binding = "MENTORIAS_AUTHS_DB"',
        ],
        forbiddenTokens: [
          'main = "../../.open-next/worker.js"',
          'directory = "../../.open-next/assets"',
          'main = "src/workers.ts"',
          'binding = "DRACO_DB"',
          'binding = "DB"',
          'binding = "SOCIAL_DB"',
        ],
      },
      {
        filePath: "scripts/build-artifact-matrix-skeleton.mjs",
        requiredTokens: [
          "emitDedicatedWrapperArtifact",
          'export { default } from',
          'export * from',
          "copyDir(globalAssetsAbsolute",
          "artifact-manifest.json",
          "generatedFrom",
          "dedicated-wrapper",
        ],
        forbiddenTokens: ["success: true", "text/html", "dummy worker", "placeholder HTML"],
      },
      {
        filePath: ".github/workflows/drako-factory-deploy.yml",
        requiredTokens: [
          "node scripts/patch-opennext-mentoria-runtime.mjs",
          "name: open-next-mentorias-build",
          "Download Mentoria dedicated artifact",
          "Verify Mentoria dedicated artifact",
          'grep -q \'export { default } from "../worker.js";\' .open-next/mentorias/worker.js',
          'grep -q \'export \\* from "../worker.js";\' .open-next/mentorias/worker.js',
          '"productKey": "mentorias"',
          '"generatedFrom": ".open-next/worker.js"',
          "MENTORIA_DEDICATED_ARTIFACT_FAKE",
        ],
        forbiddenTokens: [],
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
  const mentoriaSmokeGuardBase = {
    targetName: "test:mentoria-smoke-guard",
    rules: [
      {
        filePath: "scripts/local/mentoria-local-smoke.mjs",
        requiredTokens: [
          "/site/mentoria",
          "/api/mentorias/auths/registrations",
          "/api/mentorias/auths/logins",
          "/api/mentoria/onboarding",
          "/api/mentoria/workspace",
          "/api/mentoria/profile",
          "LANDING_PLACEHOLDER_HTML_DETECTED",
          "DUMMY_SUCCESS_RESPONSE_DETECTED",
          "CANONICAL_405_NOT_ALLOWED",
          'assertNot405("REGISTER"',
          'assertNot405("LOGIN"',
          'assertNot405("ONBOARDING_GET"',
          'assertNot405("ONBOARDING_POST"',
          'assertNot405("WORKSPACE"',
          'assertNot405("PROFILE"',
          "MENTORIA_SMOKE_OK",
        ],
        forbiddenTokens: ["expectedStatuses: [200, 401, 403, 405]", "405 accepted", "dummy success accepted"],
      },
      {
        filePath: "scripts/local/mentoria-local-qa.mjs",
        requiredTokens: [
          "wrangler",
          "workers/mentorias/wrangler.workers.toml",
          "ensureDedicatedArtifactWrapper",
          "MENTORIA_DEDICATED_ARTIFACT_MISSING",
          "scripts/local/mentoria-local-smoke.mjs",
        ],
      },
    ],
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
      artifactMode: "dedicated-wrapper",
      wranglerConfigPath: "workers/drakos/wrangler.workers.toml",
      currentWranglerMain: "../../.open-next/drakos/worker.js",
      currentWranglerAssetsDirectory: "../../.open-next/drakos/assets",
      plannedWorkerPath: ".open-next/drakos/worker.js",
      plannedAssetsPath: ".open-next/drakos/assets",
      dedicatedArtifactName: "open-next-drakos-build",
    },
    {
      key: "bases",
      workerName: "saas-bases-prod",
      artifactMode: "dedicated-wrapper",
      wranglerConfigPath: "workers/bases/wrangler.workers.toml",
      currentWranglerMain: "../../.open-next/bases/worker.js",
      currentWranglerAssetsDirectory: "../../.open-next/bases/assets",
      plannedWorkerPath: ".open-next/bases/worker.js",
      plannedAssetsPath: ".open-next/bases/assets",
      dedicatedArtifactName: "open-next-bases-build",
    },
    {
      key: "mentorias",
      workerName: "saas-mentorias-prod",
      artifactMode: "dedicated-wrapper",
      wranglerConfigPath: "workers/mentorias/wrangler.workers.toml",
      currentWranglerMain: "../../.open-next/mentorias/worker.js",
      currentWranglerAssetsDirectory: "../../.open-next/mentorias/assets",
      plannedWorkerPath: ".open-next/mentorias/worker.js",
      plannedAssetsPath: ".open-next/mentorias/assets",
      dedicatedArtifactName: "open-next-mentorias-build",
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
      preparedArtifactName: "open-next-socialflows-standalone-prepared",
    },
  ] as const;
  const artifactMatrixSkeletonGuardBase = {
    targetName: "test:artifact-matrix-skeleton",
    manifestPath: "docs/config/open-next-artifact-matrix.json",
    workflowPath: ".github/workflows/drako-factory-deploy.yml",
    buildScriptPath: "scripts/build-artifact-matrix-skeleton.mjs",
    expectedState: "partial-split",
    expectedDeployMode: "global-open-next-plus-drakos-bases-socialflows-and-mentorias-dedicated",
    expectedActiveArtifactName: "open-next-build",
    expectedDedicatedArtifacts: [
      {
        key: "drakos",
        artifactName: "open-next-drakos-build",
        workerPath: ".open-next/drakos/worker.js",
        assetsPath: ".open-next/drakos/assets",
      },
      {
        key: "bases",
        artifactName: "open-next-bases-build",
        workerPath: ".open-next/bases/worker.js",
        assetsPath: ".open-next/bases/assets",
      },
      {
        key: "mentorias",
        artifactName: "open-next-mentorias-build",
        workerPath: ".open-next/mentorias/worker.js",
        assetsPath: ".open-next/mentorias/assets",
      },
      {
        key: "socialflows",
        artifactName: "open-next-socialflows-build",
        workerPath: ".open-next/socialflows/worker.js",
        assetsPath: ".open-next/socialflows/assets",
      },
    ],
    expectedPreparedArtifacts: [
      {
        key: "socialflows",
        state: "prepared",
        artifactName: "open-next-socialflows-standalone-prepared",
        workerPath: ".open-next/socialflows-standalone/worker.js",
        assetsPath: ".open-next/socialflows-standalone/assets",
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
      "Verify Drakos dedicated artifact",
      "name: open-next-drakos-build",
      "Upload Drakos dedicated artifact",
      "Download Drakos dedicated artifact",
      "Verify Bases dedicated artifact",
      "name: open-next-bases-build",
      "Upload Bases dedicated artifact",
      "Download Bases dedicated artifact",
      "name: open-next-mentorias-build",
      "Download Mentoria dedicated artifact",
      "Verify Mentoria dedicated artifact",
      "name: open-next-socialflows-build",
      "Download SocialFlow dedicated artifact",
      "Verify SocialFlow dedicated artifact",
      "Verify SocialFlow standalone prepared artifact (inactive)",
      "Verify SocialFlow standalone remains inactive",
    ],
    buildScriptRequiredTokens: [
      "ARTIFACT_MATRIX_SKELETON_OK",
      "ARTIFACT_MATRIX_SKELETON_INVALID",
      "ARTIFACT_MATRIX_SKELETON_GLOBAL_BUILD_MISSING",
      "build/open-next-artifact-matrix",
      "export { default } from",
      "prepared-wrapper",
      "standalone-prepared",
      "copyOpenNextRuntimeSubset",
      "emitPreparedStandaloneArtifact",
      "preparedArtifacts",
      "artifact-manifest.json",
    ],
  } as const;
  const artifactMatrixPrematureActivationGuardBase = {
    targetName: "test:artifact-matrix-premature-activation",
    products: artifactMatrixProductsBase,
    workflowPath: ".github/workflows/drako-factory-deploy.yml",
    forbiddenWorkflowTokens: [
      "name: open-next-artifact-matrix-bases",
    ],
    allowedDedicatedProducts: ["drakos", "bases", "socialflows", "mentorias"],
  } as const;
  const globalDeployDriftGuardBase = {
    targetName: "test:global-deploy-drift",
    rules: [
      {
        filePath: ".github/workflows/build-worker.yml",
        requiredTokens: [
          "Archived Global Worker Deploy",
          "GLOBAL_WORKER_DEPLOY_ARCHIVED",
          ".github/workflows/drako-factory-deploy.yml",
          "only valid artifact matrix deploy lane",
          "exit 1",
        ],
        forbiddenTokens: [
          "worker-build",
          "npm run cf:build",
          "cloudflare/wrangler-action@v3",
          "deploy --config wrangler.workers.toml",
          "wrangler.workers.toml --env production",
          "path: .open-next/",
        ],
      },
      {
        filePath: ".github/workflows/drako-factory-deploy.yml",
        requiredTokens: [
          "artifact_matrix_skeleton:",
          "Download OpenNext build artifact",
          "Download Drakos dedicated artifact",
          "Download Bases dedicated artifact",
          "Download Mentoria dedicated artifact",
          "Download SocialFlow dedicated artifact",
          "Deploy in strict order (scheduler -> drakos -> mentorias -> bases -> socialflows)",
        ],
      },
    ],
  } as const;
  const drakosPreparedArtifactGuardBase = {
    targetName: "test:drakos-dedicated-artifact-activated",
    rules: [
      {
        filePath: "docs/config/open-next-artifact-matrix.json",
        requiredTokens: [
          '"dedicatedArtifacts"',
          '"key": "drakos"',
          '"artifactName": "open-next-drakos-build"',
          '"workerPath": ".open-next/drakos/worker.js"',
          '"assetsPath": ".open-next/drakos/assets"',
          '"artifactMode": "dedicated-wrapper"',
          '"currentWranglerMain": "../../.open-next/drakos/worker.js"',
          '"currentWranglerAssetsDirectory": "../../.open-next/drakos/assets"',
          '"dedicatedArtifactName": "open-next-drakos-build"',
        ],
      },
      {
        filePath: "scripts/build-artifact-matrix-skeleton.mjs",
        requiredTokens: [
          'product.artifactMode === "prepared-wrapper"',
          "preparedArtifacts",
          "preparedArtifactName",
          "artifactState",
          'splitActivated: product.artifactMode === "dedicated-wrapper"',
          'export { default } from',
          'export * from',
        ],
        forbiddenTokens: ["dummy worker", "placeholder HTML"],
      },
      {
        filePath: ".github/workflows/drako-factory-deploy.yml",
        requiredTokens: [
          "Verify Drakos dedicated artifact",
          "name: open-next-drakos-build",
          "Upload Drakos dedicated artifact",
          "Download Drakos dedicated artifact",
          "DRAKOS_DEDICATED_ARTIFACT_NOT_ACTIVATED",
          "DRAKOS_DEDICATED_ARTIFACT_FAKE",
          'grep -q \'main = "../../.open-next/drakos/worker.js"\' workers/drakos/wrangler.workers.toml',
        ],
        forbiddenTokens: [],
      },
      {
        filePath: "workers/drakos/wrangler.workers.toml",
        requiredTokens: ['main = "../../.open-next/drakos/worker.js"', 'directory = "../../.open-next/drakos/assets"'],
        forbiddenTokens: ['main = "../../.open-next/worker.js"', 'directory = "../../.open-next/assets"'],
      },
    ],
  } as const;
  const basesPreparedArtifactGuardBase = {
    targetName: "test:bases-dedicated-artifact-activated",
    rules: [
      {
        filePath: "docs/config/open-next-artifact-matrix.json",
        requiredTokens: [
          '"dedicatedArtifacts"',
          '"key": "bases"',
          '"artifactName": "open-next-bases-build"',
          '"workerPath": ".open-next/bases/worker.js"',
          '"assetsPath": ".open-next/bases/assets"',
          '"artifactMode": "dedicated-wrapper"',
          '"currentWranglerMain": "../../.open-next/bases/worker.js"',
          '"currentWranglerAssetsDirectory": "../../.open-next/bases/assets"',
          '"dedicatedArtifactName": "open-next-bases-build"',
        ],
      },
      {
        filePath: "scripts/build-artifact-matrix-skeleton.mjs",
        requiredTokens: [
          'product.artifactMode === "prepared-wrapper"',
          "preparedArtifacts",
          "preparedArtifactName",
          "artifactState",
          'splitActivated: product.artifactMode === "dedicated-wrapper"',
          'export { default } from',
          'export * from',
        ],
        forbiddenTokens: ["dummy worker", "placeholder HTML"],
      },
      {
        filePath: ".github/workflows/drako-factory-deploy.yml",
        requiredTokens: [
          "Verify Bases dedicated artifact",
          "name: open-next-bases-build",
          "Upload Bases dedicated artifact",
          "Download Bases dedicated artifact",
          "BASES_DEDICATED_ARTIFACT_NOT_ACTIVATED",
          "BASES_DEDICATED_ARTIFACT_FAKE",
          'grep -q \'main = "../../.open-next/bases/worker.js"\' workers/bases/wrangler.workers.toml',
        ],
        forbiddenTokens: [],
      },
      {
        filePath: "workers/bases/wrangler.workers.toml",
        requiredTokens: ['main = "../../.open-next/bases/worker.js"', 'directory = "../../.open-next/bases/assets"'],
        forbiddenTokens: ['main = "../../.open-next/worker.js"', 'directory = "../../.open-next/assets"'],
      },
    ],
  } as const;
  const mentoriaAuthsOperationalGuardBase = {
    targetName: "test:mentoria-auths-operational-guard",
    rules: [
      {
        filePath: ".github/workflows/drako-factory-deploy.yml",
        requiredTokens: [
          "wrangler d1 execute MENTORIAS_AUTHS_DB --remote --config workers/mentorias/wrangler.workers.toml --file migrations/0136_auths_isolations.sql",
          "wrangler d1 execute MENTORIA_DB --remote --config workers/mentorias/wrangler.workers.toml --file migrations/0160_mentoria_session_persistence.sql",
        ],
        forbiddenTokens: [
          "wrangler d1 execute DRACO_DB --remote --config wrangler.workers.toml --file migrations/0160_mentoria_session_persistence.sql",
        ],
      },
      {
        filePath: "scripts/local/mentoria-worker-local-migrate.mjs",
        requiredTokens: [
          'const productBinding = "MENTORIA_DB";',
          'const authBinding = "MENTORIAS_AUTHS_DB";',
          '"migrations/0136_auths_isolations.sql"',
        ],
      },
      {
        filePath: "scripts/local/mentoria-local-bootstrap.mjs",
        requiredTokens: [
          'const productBinding = "MENTORIA_DB";',
          'const authBinding = "MENTORIAS_AUTHS_DB";',
          "MENTORIA_LOCAL_BOOTSTRAP_OK product_binding=${productBinding} auth_binding=${authBinding}",
        ],
      },
    ],
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

  it("passes mentoria auths guard when binding is dedicated and preview/prod are isolated", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaAuthsGuardOverride: mentoriaAuthsGuardPassOverride,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some(
        (check) => check.checkCode === "mentoriaAuthsBindingSharedIdentity" && check.status === "PASS",
      ),
    ).toBe(true);
    expect(
      result.report.checks.some(
        (check) => check.checkCode === "mentoriaAuthsBindingPreviewProdCollision" && check.status === "PASS",
      ),
    ).toBe(true);
  });

  it("fails mentoria auths guard when binding reuses shared DRACO identity", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaAuthsGuardOverride: {
        ...mentoriaAuthsGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-auths-guards/fail-shared-identity.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaAuthsBindingSharedIdentity")).toBe(true);
  });

  it("fails mentoria auths guard when preview and production collide", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaAuthsGuardOverride: {
        ...mentoriaAuthsGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-auths-guards/fail-preview-prod-collision.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaAuthsBindingPreviewProdCollision")).toBe(true);
  });

  it("fails mentoria auths guard when MENTORIAS_AUTHS_DB is missing", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaAuthsGuardOverride: {
        ...mentoriaAuthsGuardBase,
        configPaths: ["tests/fixtures/production-audits/mentoria-auths-guards/missing-binding.wrangler.toml"],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaAuthsBindingMissing")).toBe(true);
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
    expect(rootWrangler).toContain('binding = "MENTORIAS_AUTHS_DB"');
    expect(rootWrangler).toContain('database_id = "6a6e3b5c-4d5e-4905-850a-b1e205203462"');
    expect(rootWrangler).toContain('database_id = "ad27b2c6-d990-4f26-a1c8-cffbf9f78924"');
    expect(rootWrangler).toContain('binding = "MENTORIA_DB"');
    expect(mentoriasWrangler).toContain('binding = "MENTORIA_DB"');
    expect(mentoriasWrangler).toContain('binding = "MENTORIAS_AUTHS_DB"');
    expect(mentoriasWrangler).toContain('database_id = "6a6e3b5c-4d5e-4905-850a-b1e205203462"');
    expect(mentoriasWrangler).toContain('main = "../../.open-next/mentorias/worker.js"');
    expect(mentoriasWrangler).toContain('directory = "../../.open-next/mentorias/assets"');
    expect(mentoriasWrangler).not.toContain('binding = "DRACO_DB"');
    expect(mentoriasWrangler).not.toContain('binding = "DB"');
    expect(localWrangler).toContain('"binding": "MENTORIAS_AUTHS_DB"');
    expect(localWrangler).toContain('"database_name": "mentorias_auths_local"');
    expect(localWrangler).toContain('"binding": "MENTORIA_DB"');
    expect(localWrangler).toContain('"database_name": "mentoria_db_local"');
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

  it("passes readiness when Mentoria runs on its dedicated transparent OpenNext wrapper", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaRuntimeGuardOverride: mentoriaRuntimeGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.checks.some((item) => item.checkCode === "mentoriaRuntimeGuardDrift" && item.status === "PASS")).toBe(true);
  });

  it("fails readiness when Mentoria drifts toward a fake worker or fake artifact generator", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaRuntimeGuardOverride: {
        targetName: "test:mentoria-runtime-guard-fake",
        rules: [
          {
            filePath: "tests/fixtures/production-audits/fake-runtime-guards/fake-worker.wrangler.toml",
            requiredTokens: ['main = "../../.open-next/mentorias/worker.js"'],
            forbiddenTokens: ['main = "src/workers.ts"'],
          },
          {
            filePath: "tests/fixtures/production-audits/fake-runtime-guards/fake-worker.ts",
            requiredTokens: ['export { default } from', "artifact-manifest.json"],
            forbiddenTokens: ["success: true", "text/html"],
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaRuntimeGuardDrift")).toBe(true);
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

  it("passes readiness when the Mentoria local smoke stays strict", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaSmokeGuardOverride: mentoriaSmokeGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some((item) => item.checkCode === "mentoriaStrictSmokeGuardDrift" && item.status === "PASS"),
    ).toBe(true);
  });

  it("fails readiness when the Mentoria local smoke becomes permissive", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaSmokeGuardOverride: {
        targetName: "test:mentoria-smoke-guard-permissive",
        rules: [
          {
            filePath: "tests/fixtures/production-audits/smoke-guards/permissive-socialflow-smoke.mjs",
            requiredTokens: mentoriaSmokeGuardBase.rules[0].requiredTokens,
            forbiddenTokens: mentoriaSmokeGuardBase.rules[0].forbiddenTokens,
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaStrictSmokeGuardDrift")).toBe(true);
  });

  it("passes readiness when Mentoria auth CI/local tooling stays aligned to dedicated auth/product bindings", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaAuthsOperationalGuardOverride: mentoriaAuthsOperationalGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some((item) => item.checkCode === "mentoriaAuthsOperationalDrift" && item.status === "PASS"),
    ).toBe(true);
  });

  it("fails readiness when Mentoria auth CI/tooling drifts back to DRACO_DB assumptions", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      mentoriaAuthsOperationalGuardOverride: {
        targetName: "test:mentoria-auths-operational-guard-drift",
        rules: [
          {
            filePath: "tests/fixtures/production-audits/mentoria-auths-guards/fail-operational-drift.yml",
            requiredTokens: mentoriaAuthsOperationalGuardBase.rules[0].requiredTokens,
            forbiddenTokens: mentoriaAuthsOperationalGuardBase.rules[0].forbiddenTokens,
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "mentoriaAuthsOperationalDrift")).toBe(true);
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

  it("passes readiness when artifact matrix skeleton is present and dedicated artifacts are active for all public products", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      artifactMatrixSkeletonGuardOverride: artifactMatrixSkeletonGuardBase,
      artifactMatrixPrematureActivationGuardOverride: artifactMatrixPrematureActivationGuardBase,
      globalDeployDriftGuardOverride: globalDeployDriftGuardBase,
      socialflowStandalonePreparedGuardOverride: socialflowStandalonePreparedGuardBase,
      drakosPreparedArtifactGuardOverride: drakosPreparedArtifactGuardBase,
      basesPreparedArtifactGuardOverride: basesPreparedArtifactGuardBase,
    });

    expect(result.exitCode).toBe(0);
    expect(
      result.report.checks.some((item) => item.checkCode === "artifactMatrixSkeletonDrift" && item.status === "PASS"),
    ).toBe(true);
    expect(
      result.report.checks.some((item) => item.checkCode === "artifactSplitPrematureActivation" && item.status === "PASS"),
    ).toBe(true);
    expect(
      result.report.checks.some((item) => item.checkCode === "globalDeployDrift" && item.status === "PASS"),
    ).toBe(true);
    expect(
      result.report.checks.some((item) => item.checkCode === "drakosPreparedArtifactGuardDrift" && item.status === "PASS"),
    ).toBe(true);
    expect(
      result.report.checks.some((item) => item.checkCode === "basesPreparedArtifactGuardDrift" && item.status === "PASS"),
    ).toBe(true);
    expect(
      result.report.checks.some((item) => item.checkCode === "socialflowStandalonePreparedGuardDrift" && item.status === "PASS"),
    ).toBe(true);
  });

  it("fails readiness when a manual workflow can deploy the global OpenNext worker", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      globalDeployDriftGuardOverride: {
        ...globalDeployDriftGuardBase,
        rules: [
          {
            ...globalDeployDriftGuardBase.rules[0],
            filePath: "tests/fixtures/production-audits/global-deploy-drift/build-worker-global-deploy.yml",
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "globalDeployDrift")).toBe(true);
  });

  it("fails readiness when SocialFlow dedicated artifact verification becomes weak", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowRuntimeGuardOverride: {
        ...socialflowRuntimeGuardBase,
        rules: [
          {
            filePath: "tests/fixtures/production-audits/artifact-matrix-guards/weak-socialflow-artifact-workflow.yml",
            requiredTokens: socialflowRuntimeGuardBase.rules[3].requiredTokens,
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowRuntimeGuardDrift")).toBe(true);
  });

  it("fails readiness when SocialFlow standalone is activated before the activation commit", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowStandalonePreparedGuardOverride: {
        ...socialflowStandalonePreparedGuardBase,
        rules: [
          {
            filePath: "tests/fixtures/production-audits/socialflow-standalone-guards/premature-standalone.wrangler.toml",
            requiredTokens: socialflowStandalonePreparedGuardBase.rules[3].requiredTokens,
            forbiddenTokens: socialflowStandalonePreparedGuardBase.rules[3].forbiddenTokens,
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowStandalonePreparedGuardDrift")).toBe(true);
  });

  it("fails readiness when CI tries to make SocialFlow standalone deployable", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      socialflowStandalonePreparedGuardOverride: {
        ...socialflowStandalonePreparedGuardBase,
        rules: [
          {
            filePath: "tests/fixtures/production-audits/socialflow-standalone-guards/deployable-standalone-workflow.yml",
            requiredTokens: socialflowStandalonePreparedGuardBase.rules[2].requiredTokens,
            forbiddenTokens: socialflowStandalonePreparedGuardBase.rules[2].forbiddenTokens,
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "socialflowStandalonePreparedGuardDrift")).toBe(true);
  });

  it("fails readiness when Drakos dedicated wrapper regresses to global runtime or becomes fake", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      drakosPreparedArtifactGuardOverride: {
        targetName: "test:drakos-dedicated-artifact-regression-or-fake",
        rules: [
          {
            filePath: "tests/fixtures/production-audits/artifact-matrix-guards/regressed-drakos-global-worker.wrangler.toml",
            requiredTokens: ['main = "../../.open-next/drakos/worker.js"', 'directory = "../../.open-next/drakos/assets"'],
            forbiddenTokens: ['main = "../../.open-next/worker.js"', 'directory = "../../.open-next/assets"'],
          },
          {
            filePath: "tests/fixtures/production-audits/fake-runtime-guards/fake-worker.ts",
            requiredTokens: ['export { default } from', 'export * from'],
            forbiddenTokens: ["success: true", "text/html"],
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "drakosPreparedArtifactGuardDrift")).toBe(true);
  });

  it("fails readiness when Bases dedicated wrapper regresses to global runtime or becomes fake", async () => {
    const result = await runProductionReadinessAudits({
      sourceOfTruthPath,
      fixturesDir: "tests/fixtures/production-audits/pass",
      writeReports: false,
      basesPreparedArtifactGuardOverride: {
        targetName: "test:bases-dedicated-artifact-regression-or-fake",
        rules: [
          {
            filePath: "tests/fixtures/production-audits/artifact-matrix-guards/regressed-bases-global-worker.wrangler.toml",
            requiredTokens: ['main = "../../.open-next/bases/worker.js"', 'directory = "../../.open-next/bases/assets"'],
            forbiddenTokens: ['main = "../../.open-next/worker.js"', 'directory = "../../.open-next/assets"'],
          },
          {
            filePath: "tests/fixtures/production-audits/fake-runtime-guards/fake-worker.ts",
            requiredTokens: ['export { default } from', 'export * from'],
            forbiddenTokens: ["success: true", "text/html"],
          },
        ],
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.violations.some((item) => item.checkCode === "basesPreparedArtifactGuardDrift")).toBe(true);
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
        allowedDedicatedProducts: [],
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
