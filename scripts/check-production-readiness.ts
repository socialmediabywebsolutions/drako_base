import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SeverityLevel = "BLOCKER" | "WARN";
type CheckStatus = "PASS" | "FAIL" | "N/A";
type WorkerStatus = "ACTIVE" | "ARCHIVED";

type ProductionAuditsExpectedState = {
  meta: {
    updatedAt: string;
    owner: string;
    notes?: string;
  };
  phaseGates?: {
    socialflowCanonicalDomain?: {
      active?: boolean;
      canonicalHostname?: string;
      expectedWorker?: string;
      compatibilityHostname?: string;
      smokeEvidencePaths?: string[];
      smokeEvidenceTokens?: string[];
    };
  };
  criticalWorkers: Array<{
    workerName: string;
    expectedStatus: WorkerStatus;
    expectedSubdomain?: {
      enabled: boolean;
      previewsEnabled: boolean;
    };
    expectedSchedulesCount?: number;
    expectedDomainsCount?: number;
    expectedRoutesCount?: number;
  }>;
  criticalHostnames: Array<{
    hostname: string;
    expectedService: string;
  }>;
  criticalRoutes: Array<{
    pattern: string;
    expectedScript: string;
  }>;
  blockedMappings: {
    services: string[];
    scripts: string[];
  };
  criticalDatastores: {
    d1DatabaseNames: string[];
    r2BucketNames: string[];
    kvNamespaceNames: string[];
    queueNames: string[];
    durableObjectClassNames: string[];
  };
  criticalTables: Array<{
    databaseName: string;
    tables: Array<{
      tableName: string;
      requiredColumns: string[];
    }>;
  }>;
  severities: {
    criticalWorkerMissing: SeverityLevel;
    criticalWorkerArchivedMismatch: SeverityLevel;
    criticalWorkerSubdomainMismatch: SeverityLevel;
    criticalWorkerSchedulesMismatch: SeverityLevel;
    criticalHostnameMissing: SeverityLevel;
    criticalHostnameMismatch: SeverityLevel;
    criticalRouteMissing: SeverityLevel;
    criticalRouteMismatch: SeverityLevel;
    blockedServiceHit: SeverityLevel;
    blockedScriptHit: SeverityLevel;
    criticalD1Missing: SeverityLevel;
    criticalR2Missing: SeverityLevel;
    criticalKvMissing: SeverityLevel;
    criticalQueueMissing: SeverityLevel;
    criticalDurableObjectMissing: SeverityLevel;
    criticalTableMissing: SeverityLevel;
    criticalColumnMissing: SeverityLevel;
    onboardingColumnsMismatch: SeverityLevel;
  };
};

type WorkersDomainRecord = {
  hostname: string;
  service: string;
};

type WorkersRouteRecord = {
  pattern: string;
  script: string;
};

type WorkersStateRecord = {
  workerName: string;
  scriptExists: boolean;
  subdomain: {
    enabled: boolean;
    previewsEnabled: boolean;
  } | null;
  schedulesCount: number;
  domainsCount: number;
  routesCount: number;
};

type D1TablesRecord = {
  databaseName: string;
  tables: string[];
  columnsByTables: Record<string, string[]>;
};

type CheckCode =
  | "criticalWorkerMissing"
  | "criticalWorkerArchivedMismatch"
  | "criticalWorkerSubdomainMismatch"
  | "criticalWorkerSchedulesMismatch"
  | "criticalHostnameMissing"
  | "criticalHostnameMismatch"
  | "criticalRouteMissing"
  | "criticalRouteMismatch"
  | "blockedServiceHit"
  | "blockedScriptHit"
  | "criticalD1Missing"
  | "criticalR2Missing"
  | "criticalKvMissing"
  | "criticalQueueMissing"
  | "criticalDurableObjectMissing"
  | "criticalTableMissing"
  | "criticalColumnMissing"
  | "onboardingColumnsMismatch"
  | "legacyProductionGuardMissing"
  | "legacyAuthDbFallbackFlagEnabled"
  | "deployablePlaceholderDatabaseIdPresent"
  | "socialflowAuthsBindingMissing"
  | "socialflowAuthsBindingSharedIdentity"
  | "socialflowAuthsBindingNamingViolation"
  | "socialflowAuthsBindingPreviewProdCollision"
  | "mentoriaAuthsBindingMissing"
  | "mentoriaAuthsBindingSharedIdentity"
  | "mentoriaAuthsBindingNamingViolation"
  | "mentoriaAuthsBindingPreviewProdCollision"
  | "socialflowCanonicalHostnameMissing"
  | "socialflowCanonicalHostnameWrongWorker"
  | "socialflowPluralPrimaryWarning"
  | "socialflowCanonicalSmokeMissing"
  | "mentoriaBindingMissingTransitionalDebt"
  | "mentoriaBindingSharedIdentity"
  | "mentoriaBindingPreviewProdCollision"
  | "mentoriaDbFallbackTransitionalDebt"
  | "mentoriaGlobalDbImportLeakage"
  | "mentoriaWorkerBindingLeakage"
  | "socialflowCrossSaasLeakage"
  | "operatorFinalUserApiLeakage"
  | "legacyCompatRouteDrift"
  | "socialflowRuntimeGuardDrift"
  | "mentoriaRuntimeGuardDrift"
  | "socialflowCanonicalSmokeGuardDrift"
  | "mentoriaStrictSmokeGuardDrift"
  | "legacyCompatInventoryDrift"
  | "legacyCompatTelemetryGuardMissing"
  | "artifactMatrixSkeletonDrift"
  | "artifactSplitPrematureActivation"
  | "drakosPreparedArtifactGuardDrift"
  | "basesPreparedArtifactGuardDrift"
  | "mentoriaAuthsOperationalDrift";

type CheckRecord = {
  checkCode: CheckCode;
  severity: SeverityLevel;
  status: CheckStatus;
  targetType:
    | "worker"
    | "hostname"
    | "route"
    | "domain"
    | "route_global"
    | "datastore_d1"
    | "datastore_r2"
    | "datastore_kv"
    | "datastore_queue"
    | "durable_object"
    | "d1_table"
    | "d1_column"
    | "code_guard";
  targetName: string;
  expected: unknown;
  actual: unknown;
  details: string;
};

type ViolationRecord = Omit<CheckRecord, "status">;

type ProductionReadinessReport = {
  timestamp: string;
  mode: "real" | "fixtures";
  sourceOfTruthPath: string;
  fixturesDir: string | null;
  productionReady: boolean;
  summary: {
    checksTotal: number;
    checksPass: number;
    checksFail: number;
    checksNa: number;
    violationsTotal: number;
    blockersTotal: number;
    warningsTotal: number;
  };
  checks: CheckRecord[];
  violations: ViolationRecord[];
  snapshots: {
    workers: WorkersStateRecord[];
    domains: WorkersDomainRecord[];
    routes: WorkersRouteRecord[];
    d1DatabaseNames: string[];
    r2BucketNames: string[];
    kvNamespaceNames: string[];
    queueNames: string[];
    durableObjectClassNames: string[];
    d1TablesByDatabases: D1TablesRecord[];
  };
};

type CloudflareApiResponse<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ code: number; message: string }>;
};

type ProductionAuditsRunOptions = {
  sourceOfTruthPath?: string;
  fixturesDir?: string;
  writeReports?: boolean;
  reportJsonPath?: string;
  reportMarkdownPath?: string;
  legacyGuardsOverride?: LegacyProductionGuard[];
  legacyAuthDbFallbackFlagGuardOverride?: LegacyAuthDbFallbackFlagGuard;
  deployablePlaceholderDatabaseIdGuardOverride?: DeployablePlaceholderDatabaseIdGuard;
  socialflowAuthsGuardOverride?: SocialflowAuthsBindingGuard;
  mentoriaAuthsGuardOverride?: MentoriaAuthsBindingGuard;
  socialflowDomainGuardOverride?: SocialflowDomainGuard;
  mentoriaBindingGuardOverride?: MentoriaBindingGuard;
  socialflowBoundaryGuardOverride?: SourceBoundaryGuard;
  operatorBoundaryGuardOverride?: SourceBoundaryGuard;
  legacyCompatRouteGuardOverride?: CompatRouteGuard;
  socialflowRuntimeGuardOverride?: FileTokenGuard;
  mentoriaRuntimeGuardOverride?: FileTokenGuard;
  socialflowSmokeGuardOverride?: SocialflowSmokeGuard;
  mentoriaSmokeGuardOverride?: FileTokenGuard;
  legacyCompatInventoryGuardOverride?: LegacyCompatInventoryGuard;
  legacyCompatTelemetryGuardOverride?: FileTokenGuard;
  artifactMatrixSkeletonGuardOverride?: ArtifactMatrixSkeletonGuard;
  artifactMatrixPrematureActivationGuardOverride?: ArtifactMatrixPrematureActivationGuard;
  drakosPreparedArtifactGuardOverride?: FileTokenGuard;
  basesPreparedArtifactGuardOverride?: FileTokenGuard;
  mentoriaAuthsOperationalGuardOverride?: FileTokenGuard;
};

type LegacyProductionGuard = {
  targetName: string;
  filePath: string;
  mustInclude: string[];
};

type LegacyAuthDbFallbackFlagGuard = {
  targetName: string;
  configPaths: string[];
  flagName: string;
};

type DeployablePlaceholderDatabaseIdGuard = {
  targetName: string;
  configPaths: string[];
  forbiddenDatabaseIds: string[];
};

type SocialflowAuthsBindingGuard = {
  targetName: string;
  configPaths: string[];
  socialflowBinding: string;
  reservedBindings: string[];
};

type MentoriaAuthsBindingGuard = {
  targetName: string;
  configPaths: string[];
  mentoriasAuthBinding: string;
  reservedBindings: string[];
};

type MentoriaBindingGuard = {
  targetName: string;
  configPaths: string[];
  mentoriaBinding: string;
  reservedBindings: string[];
  fallbackFilePath: string;
  fallbackToken: string;
  productSourcePaths?: string[];
  forbiddenImportTokens?: string[];
  workerConfigPath?: string;
  forbiddenWorkerBindings?: string[];
};

type SocialflowDomainGuard = {
  targetName: string;
  phase: "inactive" | "active";
  canonicalHostname: string;
  expectedWorker: string;
  compatibilityHostname: string;
  smokeEvidencePaths: string[];
  smokeEvidenceTokens: string[];
};

type SourceBoundaryGuard = {
  targetName: string;
  sourcePaths: string[];
  forbiddenTokens: string[];
};

type CompatRouteGuard = {
  targetName: string;
  routeDirs: string[];
  requiredAnyTokens: string[];
  forbiddenTokens: string[];
};

type FileTokenRule = {
  filePath: string;
  requiredTokens?: string[];
  forbiddenTokens?: string[];
};

type FileTokenGuard = {
  targetName: string;
  rules: FileTokenRule[];
};

type SocialflowSmokeGuard = {
  targetName: string;
  scriptPath: string;
  canonicalApiPaths: string[];
  legacyGonePaths: string[];
  placeholderGuardTokens: string[];
};

type LegacyCompatInventoryGuard = {
  targetName: string;
  apiCompatDirs: string[];
  compatSurfaceDirs: string[];
  expectedApiCompatPaths: string[];
  expectedCompatSurfacePaths: string[];
  redirectPageRules: FileTokenRule[];
  forbiddenCompatSurfaceTokens: string[];
};

type ArtifactMatrixProduct = {
  key: string;
  workerName: string;
  artifactMode?: "global-shared" | "dedicated-wrapper" | "prepared-wrapper";
  artifactState?: string;
  wranglerConfigPath: string;
  currentWranglerMain: string;
  currentWranglerAssetsDirectory: string;
  plannedWorkerPath: string;
  plannedAssetsPath: string;
  dedicatedArtifactName?: string;
  preparedArtifactName?: string;
};

type ArtifactMatrixSkeletonGuard = {
  targetName: string;
  manifestPath: string;
  workflowPath: string;
  buildScriptPath: string;
  expectedState: string;
  expectedDeployMode: string;
  expectedActiveArtifactName: string;
  expectedDedicatedArtifacts?: Array<{
    key: string;
    artifactName: string;
    workerPath: string;
    assetsPath: string;
  }>;
  expectedPreparedArtifacts?: Array<{
    key: string;
    state: string;
    artifactName: string;
    workerPath: string;
    assetsPath: string;
  }>;
  expectedProducts: ArtifactMatrixProduct[];
  workflowRequiredTokens: string[];
  buildScriptRequiredTokens: string[];
};

type ArtifactMatrixPrematureActivationGuard = {
  targetName: string;
  products: ArtifactMatrixProduct[];
  workflowPath: string;
  forbiddenWorkflowTokens: string[];
  allowedDedicatedProducts?: string[];
};

type D1BindingRecord = {
  binding: string;
  databaseName: string | null;
  databaseId: string | null;
  filePath: string;
  section: string;
};

const DEFAULT_SOURCE_OF_TRUTH_PATH = "docs/config/production-audits-expected-state.json";
const DEFAULT_REPORT_JSON_PATH = "docs/audits/production-readiness-latest.json";
const DEFAULT_REPORT_MARKDOWN_PATH = "docs/audits/production-readiness-latest.md";
const LEGACY_GUARD_DEFAULT_SEVERITY: SeverityLevel = "BLOCKER";
const SOCIALFLOW_AUTHS_GUARD_SEVERITY: SeverityLevel = "BLOCKER";
const MENTORIA_GUARD_BLOCKER_SEVERITY: SeverityLevel = "BLOCKER";
const LOCAL_OR_FAIL_CLOSED_DATABASE_IDS = new Set(["local-dev"]);
const LOCAL_COLLAPSED_DATABASE_NAMES = new Set(["drako_db_local"]);

const DEFAULT_LEGACY_AUTH_DB_FALLBACK_FLAG_GUARD: LegacyAuthDbFallbackFlagGuard = {
  targetName: "auth-db-fallback:legacy-flag",
  configPaths: [
    "wrangler.workers.toml",
    "workers/mentorias/wrangler.workers.toml",
    "workers/socialflows/wrangler.workers.toml",
  ],
  flagName: "ALLOW_LEGACY_AUTH_DB_FALLBACK",
};

const DEFAULT_DEPLOYABLE_PLACEHOLDER_DATABASE_ID_GUARD: DeployablePlaceholderDatabaseIdGuard = {
  targetName: "deployable-configs:no-placeholder-d1-ids",
  configPaths: [
    "wrangler.workers.toml",
    "workers/drakos/wrangler.workers.toml",
    "workers/bases/wrangler.workers.toml",
    "workers/mentorias/wrangler.workers.toml",
    "workers/socialflows/wrangler.workers.toml",
  ],
  forbiddenDatabaseIds: ["00000000-0000-0000-0000-000000000000"],
};

const DEFAULT_SOCIALFLOW_AUTHS_BINDING_GUARD: SocialflowAuthsBindingGuard = {
  targetName: "socialflow:auths-binding-dedicated",
  configPaths: [
    "wrangler.jsonc",
    "wrangler.workers.toml",
    "workers/socialflows/wrangler.workers.toml",
  ],
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
};

const DEFAULT_MENTORIA_AUTHS_BINDING_GUARD: MentoriaAuthsBindingGuard = {
  targetName: "mentoria:auths-binding-dedicated",
  configPaths: [
    "wrangler.jsonc",
    "wrangler.workers.toml",
    "workers/mentorias/wrangler.workers.toml",
  ],
  mentoriasAuthBinding: "MENTORIAS_AUTHS_DB",
  reservedBindings: [
    "DRACO_DB",
    "MENTORIA_DB",
    "SOCIAL_DB",
    "DRAKOS_AUTHS_DB",
    "BASES_AUTHS_DB",
    "SOCIALFLOW_AUTHS_DB",
  ],
};

const DEFAULT_SOCIALFLOW_DOMAIN_GUARD: SocialflowDomainGuard = {
  targetName: "socialflow:canonical-domain-expected-state",
  phase: "inactive",
  canonicalHostname: "socialflow.drako.systems",
  expectedWorker: "saas-socialflows-prod",
  compatibilityHostname: "socialflows.drako.systems",
  smokeEvidencePaths: [".github/workflows/drako-factory-deploy.yml"],
  smokeEvidenceTokens: ["socialflow.drako.systems", "/socialflow", "/api/socialflow"],
};

const DEFAULT_SOCIALFLOW_BOUNDARY_GUARD: SourceBoundaryGuard = {
  targetName: "socialflow:no-cross-saas-leakage",
  sourcePaths: [
    "src/modules/socialflow-app",
    "src/components/layouts/socialflow-shell.tsx",
    "src/app/socialflow",
  ],
  forbiddenTokens: [
    "@/components/mentoria",
    "@/lib/mentoria",
    "/api/mentoria/",
    "@/lib/campobase",
    "@/lib/campamento-base",
    "@/lib/auth/campamento-core",
    "@/components/operator",
    "@/components/owner",
    "/api/operator/",
    "/api/owner/",
    "/api/campobase/",
    "/api/campamento-base/",
  ],
};

const DEFAULT_OPERATOR_BOUNDARY_GUARD: SourceBoundaryGuard = {
  targetName: "operator:no-final-user-product-api-leakage",
  sourcePaths: [
    "src/app/operator",
    "src/app/api/operator",
    "src/lib/campobase",
    "src/lib/campamento-base",
  ],
  forbiddenTokens: [
    "/api/mentoria/",
    "/api/socialflow/",
    "@/components/mentoria",
    "@/components/saas/socialflow",
  ],
};

const DEFAULT_LEGACY_COMPAT_ROUTE_GUARD: CompatRouteGuard = {
  targetName: "legacy-compat:owner-campobase-control-plane-only",
  routeDirs: [
    "src/app/api/owner",
    "src/app/api/campobase",
  ],
  requiredAnyTokens: [
    '@/app/api/operator/',
    '@/app/api/factory/',
  ],
  forbiddenTokens: [
    '@/app/api/mentoria',
    '@/app/api/socialflow',
    '/api/mentoria/',
    '/api/socialflow/',
  ],
};

const DEFAULT_LEGACY_COMPAT_INVENTORY_GUARD: LegacyCompatInventoryGuard = {
  targetName: "legacy-compat:inventory-locked",
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
    { filePath: "src/app/owner/page.tsx", requiredTokens: ['redirect("/operator")'] },
    { filePath: "src/app/owner/catalog/page.tsx", requiredTokens: ['redirect("/operator/catalog")'] },
    { filePath: "src/app/owner/domains/page.tsx", requiredTokens: ['redirect("/operator/domains")'] },
    { filePath: "src/app/owner/projects/page.tsx", requiredTokens: ['redirect("/operator/projects")'] },
    { filePath: "src/app/owner/projects/create/page.tsx", requiredTokens: ['redirect("/operator/projects/create")'] },
    { filePath: "src/app/owner/projects/[id]/page.tsx", requiredTokens: ['redirect(`/operator/projects/${resolved.id}`)'] },
    { filePath: "src/app/campobase/socialflow/page.tsx", requiredTokens: ['redirect("/operator/socialflow")'] },
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
};

const DEFAULT_LEGACY_COMPAT_TELEMETRY_GUARD: FileTokenGuard = {
  targetName: "legacy-compat:telemetry-and-sunset-markers",
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
};

const DEFAULT_ARTIFACT_MATRIX_PRODUCTS: ArtifactMatrixProduct[] = [
  {
    key: "drakos",
    workerName: "saas-drakos-prod",
    artifactMode: "prepared-wrapper",
    artifactState: "skeleton/prepared",
    wranglerConfigPath: "workers/drakos/wrangler.workers.toml",
    currentWranglerMain: "../../.open-next/worker.js",
    currentWranglerAssetsDirectory: "../../.open-next/assets",
    plannedWorkerPath: ".open-next/drakos/worker.js",
    plannedAssetsPath: ".open-next/drakos/assets",
    preparedArtifactName: "open-next-drakos-build",
  },
  {
    key: "bases",
    workerName: "saas-bases-prod",
    artifactMode: "prepared-wrapper",
    artifactState: "skeleton/prepared",
    wranglerConfigPath: "workers/bases/wrangler.workers.toml",
    currentWranglerMain: "../../.open-next/worker.js",
    currentWranglerAssetsDirectory: "../../.open-next/assets",
    plannedWorkerPath: ".open-next/bases/worker.js",
    plannedAssetsPath: ".open-next/bases/assets",
    preparedArtifactName: "open-next-bases-build",
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
  },
];

const DEFAULT_ARTIFACT_MATRIX_SKELETON_GUARD: ArtifactMatrixSkeletonGuard = {
  targetName: "artifact-matrix:skeleton-prepared-global-still-active",
  manifestPath: "docs/config/open-next-artifact-matrix.json",
  workflowPath: ".github/workflows/drako-factory-deploy.yml",
  buildScriptPath: "scripts/build-artifact-matrix-skeleton.mjs",
  expectedState: "partial-split",
  expectedDeployMode: "global-open-next-plus-socialflows-and-mentorias-dedicated",
  expectedActiveArtifactName: "open-next-build",
  expectedDedicatedArtifacts: [
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
      key: "drakos",
      state: "skeleton/prepared",
      artifactName: "open-next-drakos-build",
      workerPath: ".open-next/drakos/worker.js",
      assetsPath: ".open-next/drakos/assets",
    },
    {
      key: "bases",
      state: "skeleton/prepared",
      artifactName: "open-next-bases-build",
      workerPath: ".open-next/bases/worker.js",
      assetsPath: ".open-next/bases/assets",
    },
  ],
  expectedProducts: DEFAULT_ARTIFACT_MATRIX_PRODUCTS,
  workflowRequiredTokens: [
    "artifact_matrix_skeleton:",
    "Artifact Matrix Skeleton (${{ matrix.product }})",
    "pnpm build:artifacts:skeleton",
    "open-next-artifact-matrix-${{ matrix.product }}",
    "ARTIFACT_MATRIX_REQUIRE_GLOBAL_BUILD: \"1\"",
    "build/open-next-artifact-matrix/global",
    "name: open-next-build",
    "Download OpenNext build artifact",
    "Verify Drakos prepared artifact remains inactive",
    "Verify Bases prepared artifact remains inactive",
    "name: open-next-mentorias-build",
    "Download Mentoria dedicated artifact",
    "Verify Mentoria dedicated artifact",
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
    "prepared-wrapper",
    "preparedArtifacts",
    "artifact-manifest.json",
  ],
};

const DEFAULT_ARTIFACT_MATRIX_PREMATURE_ACTIVATION_GUARD: ArtifactMatrixPrematureActivationGuard = {
  targetName: "artifact-matrix:no-premature-worker-switch",
  products: DEFAULT_ARTIFACT_MATRIX_PRODUCTS,
  workflowPath: ".github/workflows/drako-factory-deploy.yml",
  forbiddenWorkflowTokens: [
    "name: open-next-artifact-matrix-drakos",
    "name: open-next-artifact-matrix-bases",
    "name: open-next-drakos-build",
    "Upload Drakos dedicated artifact",
    "Download Drakos dedicated artifact",
    "name: open-next-bases-build",
    "Upload Bases dedicated artifact",
    "Download Bases dedicated artifact",
    "path: .open-next/drakos",
    "path: .open-next/bases",
  ],
  allowedDedicatedProducts: ["socialflows", "mentorias"],
};

const DEFAULT_DRAKOS_PREPARED_ARTIFACT_GUARD: FileTokenGuard = {
  targetName: "drakos:prepared-artifact-not-activated",
  rules: [
    {
      filePath: "docs/config/open-next-artifact-matrix.json",
      requiredTokens: [
        '"preparedArtifacts"',
        '"key": "drakos"',
        '"state": "skeleton/prepared"',
        '"artifactName": "open-next-drakos-build"',
        '"workerPath": ".open-next/drakos/worker.js"',
        '"assetsPath": ".open-next/drakos/assets"',
        '"artifactMode": "prepared-wrapper"',
        '"currentWranglerMain": "../../.open-next/worker.js"',
        '"currentWranglerAssetsDirectory": "../../.open-next/assets"',
        '"preparedArtifactName": "open-next-drakos-build"',
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
        "Verify Drakos prepared artifact remains inactive",
        'test -f .open-next/drakos/worker.js',
        'grep -q \'main = "../../.open-next/worker.js"\' workers/drakos/wrangler.workers.toml',
        "DRAKOS_PREPARED_ARTIFACT_PREMATURELY_ACTIVATED",
        "DRAKOS_PREPARED_ARTIFACT_FAKE",
      ],
      forbiddenTokens: [
        "name: open-next-drakos-build",
        "Upload Drakos dedicated artifact",
        "Download Drakos dedicated artifact",
        "path: .open-next/drakos",
      ],
    },
    {
      filePath: "workers/drakos/wrangler.workers.toml",
      requiredTokens: ['main = "../../.open-next/worker.js"', 'directory = "../../.open-next/assets"'],
      forbiddenTokens: ['main = "../../.open-next/drakos/worker.js"', 'directory = "../../.open-next/drakos/assets"'],
    },
  ],
};

const DEFAULT_BASES_PREPARED_ARTIFACT_GUARD: FileTokenGuard = {
  targetName: "bases:prepared-artifact-not-activated",
  rules: [
    {
      filePath: "docs/config/open-next-artifact-matrix.json",
      requiredTokens: [
        '"preparedArtifacts"',
        '"key": "bases"',
        '"state": "skeleton/prepared"',
        '"artifactName": "open-next-bases-build"',
        '"workerPath": ".open-next/bases/worker.js"',
        '"assetsPath": ".open-next/bases/assets"',
        '"artifactMode": "prepared-wrapper"',
        '"currentWranglerMain": "../../.open-next/worker.js"',
        '"currentWranglerAssetsDirectory": "../../.open-next/assets"',
        '"preparedArtifactName": "open-next-bases-build"',
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
        "Verify Bases prepared artifact remains inactive",
        'test -f .open-next/bases/worker.js',
        'grep -q \'main = "../../.open-next/worker.js"\' workers/bases/wrangler.workers.toml',
        "BASES_PREPARED_ARTIFACT_PREMATURELY_ACTIVATED",
        "BASES_PREPARED_ARTIFACT_FAKE",
      ],
      forbiddenTokens: [
        "name: open-next-bases-build",
        "Upload Bases dedicated artifact",
        "Download Bases dedicated artifact",
        "path: .open-next/bases",
      ],
    },
    {
      filePath: "workers/bases/wrangler.workers.toml",
      requiredTokens: ['main = "../../.open-next/worker.js"', 'directory = "../../.open-next/assets"'],
      forbiddenTokens: ['main = "../../.open-next/bases/worker.js"', 'directory = "../../.open-next/bases/assets"'],
    },
  ],
};

const DEFAULT_SOCIALFLOW_RUNTIME_GUARD: FileTokenGuard = {
  targetName: "socialflow:runtime-real-worker-only",
  rules: [
    {
      filePath: "workers/socialflows/wrangler.workers.toml",
      requiredTokens: ['main = "../../.open-next/socialflows/worker.js"', 'directory = "../../.open-next/socialflows/assets"', 'pattern = "socialflow.drako.systems"'],
      forbiddenTokens: ['main = "src/workers.ts"', 'main = "./src/workers.ts"'],
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
};

const DEFAULT_MENTORIA_RUNTIME_GUARD: FileTokenGuard = {
  targetName: "mentoria:runtime-real-wrapper-only",
  rules: [
    {
      filePath: "workers/mentorias/wrangler.workers.toml",
      requiredTokens: [
        'main = "../../.open-next/mentorias/worker.js"',
        'directory = "../../.open-next/mentorias/assets"',
        'pattern = "mentoria.drako.systems"',
        'binding = "MENTORIA_DB"',
        'binding = "MENTORIAS_AUTHS_DB"',
      ],
      forbiddenTokens: [
        'main = "../../.open-next/worker.js"',
        'directory = "../../.open-next/assets"',
        'main = "src/workers.ts"',
        'main = "./src/workers.ts"',
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
      forbiddenTokens: ["path: .open-next/drakos", "path: .open-next/bases"],
    },
  ],
};

const DEFAULT_MENTORIA_AUTHS_OPERATIONAL_GUARD: FileTokenGuard = {
  targetName: "mentoria:auth-operational-drift",
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
};

const DEFAULT_SOCIALFLOW_SMOKE_GUARD: SocialflowSmokeGuard = {
  targetName: "socialflow:canonical-smoke-strict",
  scriptPath: "scripts/smoke/socialflow-canonical-domain-smoke.mjs",
  canonicalApiPaths: [
    "/api/socialflow/profile",
    "/api/socialflow/campaigns?saasId=socialflow",
    "/api/socialflow/posts?saasId=socialflow",
  ],
  legacyGonePaths: ["/api/social/posts", "/api/social/linkedin/publish"],
  placeholderGuardTokens: ["placeholder token detected", "auth route did not render the SocialFlow auth page"],
};

const DEFAULT_MENTORIA_SMOKE_GUARD: FileTokenGuard = {
  targetName: "mentoria:local-smoke-strict",
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
};

const DEFAULT_MENTORIA_BINDING_GUARD: MentoriaBindingGuard = {
  targetName: "mentoria:db-binding-dedicated",
  configPaths: ["wrangler.jsonc", "wrangler.workers.toml", "workers/mentorias/wrangler.workers.toml"],
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
  productSourcePaths: ["src/lib/mentoria", "src/app/api/mentoria"],
  forbiddenImportTokens: ['@/lib/db'],
  workerConfigPath: "workers/mentorias/wrangler.workers.toml",
  forbiddenWorkerBindings: ["DRACO_DB", "DB", "SOCIAL_DB", "DRAKOS_AUTHS_DB", "BASES_AUTHS_DB", "SOCIALFLOW_AUTHS_DB"],
};
const DEFAULT_LEGACY_PRODUCTION_GUARDS: LegacyProductionGuard[] = [
  {
    targetName: "legacy:create-saas-route",
    filePath: "src/app/api/saas/route.ts",
    mustInclude: ["LEGACY_SAAS_CREATE_BLOCKED", "/api/owner/saas-factory/create-saas", "status: 410"],
  },
  {
    targetName: "legacy:provision-commit-route",
    filePath: "src/app/api/provision/commit/route.ts",
    mustInclude: ["LEGACY_PROVISION_COMMIT_BLOCKED", "/api/owner/saas-factory/create-saas", "status: 410"],
  },
  {
    targetName: "legacy:saas-domain-route",
    filePath: "src/app/api/saas/domain/route.ts",
    mustInclude: ["LEGACY_SAAS_DOMAIN_ROUTE_BLOCKED", "/api/domains/request", "status: 410"],
  },
  {
    targetName: "legacy:saas-factory-queue-consumer",
    filePath: "src/workers/saas-factory-consumer.ts",
    mustInclude: ["LEGACY_SAAS_FACTORY_QUEUE_BLOCKED", "legacy.saas_factory_queue.blocked", "message.ack"],
  },
  {
    targetName: "legacy:drako-base-3-preview-social-db-fail-closed",
    filePath: "wrangler.workers.toml",
    mustInclude: [
      "LEGACY_PREVIEW_SOCIAL_DB_FAIL_CLOSED",
      "drako-base-3 preview stays unbound for SocialFlow data",
      "Do not add SOCIAL_DB",
    ],
  },
];

function resolveSocialflowDomainGuard(
  config: ProductionAuditsExpectedState,
  override?: SocialflowDomainGuard,
): SocialflowDomainGuard {
  if (override) {
    return override;
  }

  const phaseGate = config.phaseGates?.socialflowCanonicalDomain;
  return {
    ...DEFAULT_SOCIALFLOW_DOMAIN_GUARD,
    phase: phaseGate?.active ? "active" : "inactive",
    canonicalHostname: phaseGate?.canonicalHostname ?? DEFAULT_SOCIALFLOW_DOMAIN_GUARD.canonicalHostname,
    expectedWorker: phaseGate?.expectedWorker ?? DEFAULT_SOCIALFLOW_DOMAIN_GUARD.expectedWorker,
    compatibilityHostname: phaseGate?.compatibilityHostname ?? DEFAULT_SOCIALFLOW_DOMAIN_GUARD.compatibilityHostname,
    smokeEvidencePaths: phaseGate?.smokeEvidencePaths ?? DEFAULT_SOCIALFLOW_DOMAIN_GUARD.smokeEvidencePaths,
    smokeEvidenceTokens: phaseGate?.smokeEvidenceTokens ?? DEFAULT_SOCIALFLOW_DOMAIN_GUARD.smokeEvidenceTokens,
  };
}

function stripQuotes(value: string): string {
  return value.replace(/^"+|"+$/g, "");
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return stripQuotes(value);
}

function resolveAbsolutePath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

async function listTypeScriptFilesRecursively(relativeDir: string): Promise<string[]> {
  const absoluteDir = resolveAbsolutePath(relativeDir);
  try {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const relativeEntryPath = path.join(relativeDir, entry.name);
        if (entry.isDirectory()) {
          return listTypeScriptFilesRecursively(relativeEntryPath);
        }
        return /\.(ts|tsx)$/.test(entry.name) ? [relativeEntryPath] : [];
      }),
    );
    return nested.flat();
  } catch {
    return [];
  }
}

async function listTypeScriptSources(relativePath: string): Promise<string[]> {
  const absolutePath = resolveAbsolutePath(relativePath);
  try {
    const stat = await fs.stat(absolutePath);
    if (stat.isDirectory()) {
      return listTypeScriptFilesRecursively(relativePath);
    }
    return /\.(ts|tsx)$/.test(relativePath) ? [relativePath] : [];
  } catch {
    return [];
  }
}

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeFileSafe(absolutePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

function validateConfig(config: ProductionAuditsExpectedState): void {
  if (!Array.isArray(config.criticalWorkers) || config.criticalWorkers.length === 0) {
    throw new Error("production-audits-expected-state.json must include criticalWorkers.");
  }
  if (!Array.isArray(config.criticalHostnames) || config.criticalHostnames.length === 0) {
    throw new Error("production-audits-expected-state.json must include criticalHostnames.");
  }
  if (!Array.isArray(config.criticalRoutes)) {
    throw new Error("production-audits-expected-state.json must include criticalRoutes.");
  }
  if (!config.criticalDatastores) {
    throw new Error("production-audits-expected-state.json must include criticalDatastores.");
  }
  if (!Array.isArray(config.criticalTables)) {
    throw new Error("production-audits-expected-state.json must include criticalTables.");
  }
}

async function requestCloudflareApi<T>(params: {
  apiToken: string;
  pathName: string;
}): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${params.pathName}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.apiToken}`,
      "content-type": "application/json",
    },
  });
  const payload = (await response.json()) as CloudflareApiResponse<T>;
  if (!response.ok || payload.success === false) {
    const details = payload.errors?.map((item) => `${item.code}:${item.message}`).join(", ") || response.statusText;
    throw new Error(`Cloudflare API error for ${params.pathName}: ${details}`);
  }
  return payload.result as T;
}

function extractWrappedArrays<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object" && "result" in value) {
    const wrapped = value as { success?: boolean; result?: unknown };
    if (wrapped.success === false) {
      throw new Error("Fixture payload has success=false.");
    }
    if (Array.isArray(wrapped.result)) {
      return wrapped.result as T[];
    }
    if (wrapped.result && typeof wrapped.result === "object") {
      const objectResult = wrapped.result as Record<string, unknown>;
      if (Array.isArray(objectResult.buckets)) {
        return objectResult.buckets as T[];
      }
    }
  }
  return [];
}

function normalizeDomains(records: unknown[]): WorkersDomainRecord[] {
  return records
    .map((record) => record as Partial<WorkersDomainRecord>)
    .filter((record) => typeof record.hostname === "string" && typeof record.service === "string")
    .map((record) => ({
      hostname: record.hostname!.toLowerCase(),
      service: record.service!,
    }));
}

function normalizeRoutes(records: unknown[]): WorkersRouteRecord[] {
  return records
    .map((record) => record as Partial<WorkersRouteRecord>)
    .filter((record) => typeof record.pattern === "string" && typeof record.script === "string")
    .map((record) => ({
      pattern: record.pattern!,
      script: record.script!,
    }));
}

function normalizeNames(records: unknown[], keys: string[]): string[] {
  return records
    .map((record) => {
      if (!record || typeof record !== "object") return "";
      const objectRecord = record as Record<string, unknown>;
      for (const key of keys) {
        if (typeof objectRecord[key] === "string") return objectRecord[key] as string;
      }
      return "";
    })
    .filter((item) => item.length > 0);
}

function parseWorkersScriptNames(records: unknown[]): string[] {
  return records
    .map((record) => {
      if (!record || typeof record !== "object") return "";
      const item = record as Record<string, unknown>;
      if (typeof item.id === "string") return item.id;
      if (typeof item.name === "string") return item.name;
      if (typeof item.script === "string") return item.script;
      return "";
    })
    .filter((item) => item.length > 0);
}

function safeWorkerName(workerName: string): string {
  if (!/^[a-z0-9_-]+$/i.test(workerName)) {
    throw new Error(`Unsafe worker name for command execution: ${workerName}`);
  }
  return workerName;
}

function safeDatabaseName(databaseName: string): string {
  if (!/^[a-z0-9_-]+$/i.test(databaseName)) {
    throw new Error(`Unsafe database name for command execution: ${databaseName}`);
  }
  return databaseName;
}

function executeD1QueryRemote(databaseName: string, sqlCommand: string): Array<Record<string, unknown>> {
  const command = `npx wrangler d1 execute ${safeDatabaseName(
    databaseName,
  )} --remote --json --command ${JSON.stringify(sqlCommand)}`;
  const stdout = execSync(command, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  const payload = JSON.parse(stdout) as Array<{ results?: Array<Record<string, unknown>> }>;
  return payload[0]?.results ?? [];
}

async function collectRealSnapshots(config: ProductionAuditsExpectedState): Promise<ProductionReadinessReport["snapshots"]> {
  const apiToken = readRequiredEnv("CLOUDFLARE_API_TOKEN");
  const accountId = readRequiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const zoneId = readRequiredEnv("CLOUDFLARE_ZONE_ID");

  const domainsPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/workers/domains`,
  });
  const routesPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/zones/${zoneId}/workers/routes`,
  });
  const scriptsPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/workers/scripts`,
  });
  const d1Payload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/d1/database`,
  });
  const r2Payload = await requestCloudflareApi<{ buckets?: unknown[] } | unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/r2/buckets`,
  });
  const kvPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/storage/kv/namespaces?per_page=100`,
  });
  const queuesPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/queues`,
  });

  const domains = normalizeDomains(domainsPayload);
  const routes = normalizeRoutes(routesPayload);
  const workersScriptNames = new Set(parseWorkersScriptNames(scriptsPayload));
  const d1DatabaseNames = normalizeNames(d1Payload, ["name"]);
  const r2BucketsRaw = Array.isArray(r2Payload) ? r2Payload : r2Payload.buckets ?? [];
  const r2BucketNames = normalizeNames(r2BucketsRaw, ["name"]);
  const kvNamespaceNames = normalizeNames(kvPayload, ["title", "name"]);
  const queueNames = normalizeNames(queuesPayload, ["queue_name", "name"]);

  const workers: WorkersStateRecord[] = [];
  const durableObjectClassNamesSet = new Set<string>();
  for (const worker of config.criticalWorkers) {
    const workerName = safeWorkerName(worker.workerName);
    const scriptExists = workersScriptNames.has(workerName);

    let subdomain: WorkersStateRecord["subdomain"] = null;
    let schedulesCount = 0;

    if (scriptExists) {
      try {
        const subdomainPayload = await requestCloudflareApi<{ enabled: boolean; previews_enabled: boolean }>({
          apiToken,
          pathName: `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
        });
        subdomain = {
          enabled: Boolean(subdomainPayload.enabled),
          previewsEnabled: Boolean(subdomainPayload.previews_enabled),
        };
      } catch {
        subdomain = null;
      }

      try {
        const schedulesPayload = await requestCloudflareApi<{ schedules?: Array<{ cron: string }> }>({
          apiToken,
          pathName: `/accounts/${accountId}/workers/scripts/${workerName}/schedules`,
        });
        schedulesCount = (schedulesPayload.schedules ?? []).length;
      } catch {
        schedulesCount = 0;
      }

      try {
        const settingsPayload = await requestCloudflareApi<{ bindings?: Array<Record<string, unknown>> }>({
          apiToken,
          pathName: `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
        });
        for (const binding of settingsPayload.bindings ?? []) {
          if (binding.type === "durable_object_namespace" && typeof binding.class_name === "string") {
            durableObjectClassNamesSet.add(binding.class_name);
          }
        }
      } catch {
        // Keep audit read-only and non-fatal for optional durable object inventory.
      }
    }

    workers.push({
      workerName,
      scriptExists,
      subdomain,
      schedulesCount,
      domainsCount: domains.filter((item) => item.service === workerName).length,
      routesCount: routes.filter((item) => item.script === workerName).length,
    });
  }

  const d1TablesByDatabases: D1TablesRecord[] = [];
  for (const database of config.criticalTables) {
    const databaseName = safeDatabaseName(database.databaseName);
    if (!d1DatabaseNames.includes(databaseName)) {
      d1TablesByDatabases.push({
        databaseName,
        tables: [],
        columnsByTables: {},
      });
      continue;
    }

    const tableRows = executeD1QueryRemote(
      databaseName,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
    );
    const tableNames = tableRows
      .map((item) => item.name)
      .filter((item): item is string => typeof item === "string" && !item.startsWith("_cf_"));
    const columnsByTables: Record<string, string[]> = {};
    const requiredTableNames = new Set(database.tables.map((item) => item.tableName));

    for (const tableName of tableNames) {
      if (!requiredTableNames.has(tableName)) {
        continue;
      }
      const pragmaRows = executeD1QueryRemote(databaseName, `PRAGMA table_info('${tableName.replace(/'/g, "''")}');`);
      columnsByTables[tableName] = pragmaRows
        .map((item) => item.name)
        .filter((item): item is string => typeof item === "string");
    }

    d1TablesByDatabases.push({
      databaseName,
      tables: tableNames,
      columnsByTables,
    });
  }

  return {
    workers,
    domains,
    routes,
    d1DatabaseNames,
    r2BucketNames,
    kvNamespaceNames,
    queueNames,
    durableObjectClassNames: Array.from(durableObjectClassNamesSet).sort(),
    d1TablesByDatabases,
  };
}

async function collectFixturesSnapshots(fixturesDir: string): Promise<ProductionReadinessReport["snapshots"]> {
  const absoluteDir = resolveAbsolutePath(fixturesDir);

  const domainsPayload = await readJsonFile<unknown>(path.join(absoluteDir, "domains.json"));
  const routesPayload = await readJsonFile<unknown>(path.join(absoluteDir, "routes.json"));
  const scriptsPayload = await readJsonFile<unknown>(path.join(absoluteDir, "scripts.json"));
  const workersPayload = await readJsonFile<unknown>(path.join(absoluteDir, "workers-states.json"));
  const d1Payload = await readJsonFile<unknown>(path.join(absoluteDir, "d1-databases.json"));
  const r2Payload = await readJsonFile<unknown>(path.join(absoluteDir, "r2-buckets.json"));
  const kvPayload = await readJsonFile<unknown>(path.join(absoluteDir, "kv-namespaces.json"));
  const queuesPayload = await readJsonFile<unknown>(path.join(absoluteDir, "queues.json"));
  const durableObjectsPayload = await readJsonFile<unknown>(path.join(absoluteDir, "durable-objects.json"));
  const d1TablesPayload = await readJsonFile<unknown>(path.join(absoluteDir, "d1-tables.json"));

  const domains = normalizeDomains(extractWrappedArrays<unknown>(domainsPayload));
  const routes = normalizeRoutes(extractWrappedArrays<unknown>(routesPayload));
  const scriptNames = parseWorkersScriptNames(extractWrappedArrays<unknown>(scriptsPayload));
  const workersStatesRaw =
    workersPayload && typeof workersPayload === "object" && "result" in (workersPayload as Record<string, unknown>)
      ? ((workersPayload as { result?: unknown }).result as unknown)
      : workersPayload;
  const workers = Array.isArray(workersStatesRaw) ? workersStatesRaw : [];
  const d1DatabaseNames = normalizeNames(extractWrappedArrays<unknown>(d1Payload), ["name"]);
  const r2BucketNames = normalizeNames(extractWrappedArrays<unknown>(r2Payload), ["name"]);
  const kvNamespaceNames = normalizeNames(extractWrappedArrays<unknown>(kvPayload), ["title", "name"]);
  const queueNames = normalizeNames(extractWrappedArrays<unknown>(queuesPayload), ["queue_name", "name"]);
  const durableObjectClassNames = normalizeNames(extractWrappedArrays<unknown>(durableObjectsPayload), [
    "class_name",
    "className",
    "name",
  ]);

  const d1TablesRaw =
    d1TablesPayload && typeof d1TablesPayload === "object" && "result" in (d1TablesPayload as Record<string, unknown>)
      ? ((d1TablesPayload as { result?: unknown }).result as unknown)
      : d1TablesPayload;
  const d1TablesByDatabases = Array.isArray(d1TablesRaw) ? (d1TablesRaw as D1TablesRecord[]) : [];

  const workersByNames = new Map<string, WorkersStateRecord>();
  for (const worker of workers as Array<Record<string, unknown>>) {
    if (typeof worker.workerName !== "string") continue;
    workersByNames.set(worker.workerName, {
      workerName: worker.workerName,
      scriptExists:
        typeof worker.scriptExists === "boolean" ? worker.scriptExists : scriptNames.includes(worker.workerName),
      subdomain:
        worker.subdomain && typeof worker.subdomain === "object"
          ? {
              enabled: Boolean((worker.subdomain as Record<string, unknown>).enabled),
              previewsEnabled: Boolean((worker.subdomain as Record<string, unknown>).previewsEnabled),
            }
          : null,
      schedulesCount: typeof worker.schedulesCount === "number" ? worker.schedulesCount : 0,
      domainsCount: typeof worker.domainsCount === "number" ? worker.domainsCount : domains.filter((item) => item.service === worker.workerName).length,
      routesCount: typeof worker.routesCount === "number" ? worker.routesCount : routes.filter((item) => item.script === worker.workerName).length,
    });
  }

  const mergedWorkers: WorkersStateRecord[] = scriptNames.map((scriptName) => {
    const existing = workersByNames.get(scriptName);
    if (existing) return existing;
    return {
      workerName: scriptName,
      scriptExists: true,
      subdomain: null,
      schedulesCount: 0,
      domainsCount: domains.filter((item) => item.service === scriptName).length,
      routesCount: routes.filter((item) => item.script === scriptName).length,
    };
  });

  return {
    workers: mergedWorkers,
    domains,
    routes,
    d1DatabaseNames,
    r2BucketNames,
    kvNamespaceNames,
    queueNames,
    durableObjectClassNames,
    d1TablesByDatabases,
  };
}

function pushCheck(checks: CheckRecord[], check: CheckRecord): void {
  checks.push(check);
}

function buildChecks(config: ProductionAuditsExpectedState, snapshots: ProductionReadinessReport["snapshots"]): CheckRecord[] {
  const checks: CheckRecord[] = [];
  const workersByNames = new Map(snapshots.workers.map((item) => [item.workerName, item]));
  const domainsByHostnames = new Map(snapshots.domains.map((item) => [item.hostname.toLowerCase(), item]));
  const routesByPatterns = new Map(snapshots.routes.map((item) => [item.pattern, item]));
  const tablesByDatabases = new Map(snapshots.d1TablesByDatabases.map((item) => [item.databaseName, item]));

  for (const criticalWorker of config.criticalWorkers) {
    const actual = workersByNames.get(criticalWorker.workerName);
    const existsStatus: CheckStatus = actual?.scriptExists ? "PASS" : "FAIL";
    pushCheck(checks, {
      checkCode: "criticalWorkerMissing",
      severity: config.severities.criticalWorkerMissing,
      status:
        criticalWorker.expectedStatus === "ACTIVE"
          ? existsStatus
          : actual?.scriptExists
            ? "PASS"
            : "N/A",
      targetType: "worker",
      targetName: criticalWorker.workerName,
      expected: criticalWorker.expectedStatus === "ACTIVE" ? "script exists" : "archived script optional",
      actual: actual?.scriptExists ? "script exists" : "script missing",
      details: actual?.scriptExists
        ? `Worker ${criticalWorker.workerName} exists in scripts inventory.`
        : `Worker ${criticalWorker.workerName} is missing in scripts inventory.`,
    });

    if (!actual?.scriptExists) {
      continue;
    }

    if (criticalWorker.expectedStatus === "ARCHIVED") {
      const archivedPass =
        actual.domainsCount === (criticalWorker.expectedDomainsCount ?? 0) &&
        actual.routesCount === (criticalWorker.expectedRoutesCount ?? 0) &&
        actual.schedulesCount === (criticalWorker.expectedSchedulesCount ?? 0) &&
        (!criticalWorker.expectedSubdomain ||
          (actual.subdomain !== null &&
            actual.subdomain.enabled === criticalWorker.expectedSubdomain.enabled &&
            actual.subdomain.previewsEnabled === criticalWorker.expectedSubdomain.previewsEnabled));

      pushCheck(checks, {
        checkCode: "criticalWorkerArchivedMismatch",
        severity: config.severities.criticalWorkerArchivedMismatch,
        status: archivedPass ? "PASS" : "FAIL",
        targetType: "worker",
        targetName: criticalWorker.workerName,
        expected: {
          domainsCount: criticalWorker.expectedDomainsCount ?? 0,
          routesCount: criticalWorker.expectedRoutesCount ?? 0,
          schedulesCount: criticalWorker.expectedSchedulesCount ?? 0,
          subdomain: criticalWorker.expectedSubdomain ?? null,
        },
        actual: {
          domainsCount: actual.domainsCount,
          routesCount: actual.routesCount,
          schedulesCount: actual.schedulesCount,
          subdomain: actual.subdomain,
        },
        details: archivedPass
          ? `Archived worker ${criticalWorker.workerName} remains fenced.`
          : `Archived worker ${criticalWorker.workerName} has unexpected ingress exposure.`,
      });
    }

    if (criticalWorker.expectedSubdomain) {
      const matchesSubdomain =
        actual.subdomain !== null &&
        actual.subdomain.enabled === criticalWorker.expectedSubdomain.enabled &&
        actual.subdomain.previewsEnabled === criticalWorker.expectedSubdomain.previewsEnabled;
      pushCheck(checks, {
        checkCode: "criticalWorkerSubdomainMismatch",
        severity: config.severities.criticalWorkerSubdomainMismatch,
        status: matchesSubdomain ? "PASS" : "FAIL",
        targetType: "worker",
        targetName: criticalWorker.workerName,
        expected: criticalWorker.expectedSubdomain,
        actual: actual.subdomain,
        details: matchesSubdomain
          ? `Worker ${criticalWorker.workerName} subdomain matches expected state.`
          : `Worker ${criticalWorker.workerName} subdomain does not match expected state.`,
      });
    }

    if (typeof criticalWorker.expectedSchedulesCount === "number") {
      const matchesSchedules = actual.schedulesCount === criticalWorker.expectedSchedulesCount;
      pushCheck(checks, {
        checkCode: "criticalWorkerSchedulesMismatch",
        severity: config.severities.criticalWorkerSchedulesMismatch,
        status: matchesSchedules ? "PASS" : "FAIL",
        targetType: "worker",
        targetName: criticalWorker.workerName,
        expected: criticalWorker.expectedSchedulesCount,
        actual: actual.schedulesCount,
        details: matchesSchedules
          ? `Worker ${criticalWorker.workerName} schedules count matches expected.`
          : `Worker ${criticalWorker.workerName} schedules count does not match expected.`,
      });
    }
  }

  for (const hostnameMapping of config.criticalHostnames) {
    const domain = domainsByHostnames.get(hostnameMapping.hostname.toLowerCase());
    const isMissing = !domain;
    pushCheck(checks, {
      checkCode: "criticalHostnameMissing",
      severity: config.severities.criticalHostnameMissing,
      status: isMissing ? "FAIL" : "PASS",
      targetType: "hostname",
      targetName: hostnameMapping.hostname,
      expected: "present",
      actual: isMissing ? "missing" : "present",
      details: isMissing
        ? `Critical hostname ${hostnameMapping.hostname} is missing from workers domains.`
        : `Critical hostname ${hostnameMapping.hostname} exists.`,
    });

    if (!domain) {
      pushCheck(checks, {
        checkCode: "criticalHostnameMismatch",
        severity: config.severities.criticalHostnameMismatch,
        status: "N/A",
        targetType: "hostname",
        targetName: hostnameMapping.hostname,
        expected: hostnameMapping.expectedService,
        actual: null,
        details: `Ownership check skipped because hostname ${hostnameMapping.hostname} is missing.`,
      });
    } else {
      const matchesService = domain.service === hostnameMapping.expectedService;
      pushCheck(checks, {
        checkCode: "criticalHostnameMismatch",
        severity: config.severities.criticalHostnameMismatch,
        status: matchesService ? "PASS" : "FAIL",
        targetType: "hostname",
        targetName: hostnameMapping.hostname,
        expected: hostnameMapping.expectedService,
        actual: domain.service,
        details: matchesService
          ? `Hostname ${hostnameMapping.hostname} points to expected service.`
          : `Hostname ${hostnameMapping.hostname} points to unexpected service.`,
      });
    }
  }

  for (const routeMapping of config.criticalRoutes) {
    const route = routesByPatterns.get(routeMapping.pattern);
    if (!route) {
      pushCheck(checks, {
        checkCode: "criticalRouteMissing",
        severity: config.severities.criticalRouteMissing,
        status: "FAIL",
        targetType: "route",
        targetName: routeMapping.pattern,
        expected: "present",
        actual: "missing",
        details: `Critical route ${routeMapping.pattern} is missing.`,
      });
      pushCheck(checks, {
        checkCode: "criticalRouteMismatch",
        severity: config.severities.criticalRouteMismatch,
        status: "N/A",
        targetType: "route",
        targetName: routeMapping.pattern,
        expected: routeMapping.expectedScript,
        actual: null,
        details: `Route ownership check skipped because ${routeMapping.pattern} is missing.`,
      });
    } else {
      pushCheck(checks, {
        checkCode: "criticalRouteMissing",
        severity: config.severities.criticalRouteMissing,
        status: "PASS",
        targetType: "route",
        targetName: routeMapping.pattern,
        expected: "present",
        actual: "present",
        details: `Critical route ${routeMapping.pattern} exists.`,
      });
      const matchesScript = route.script === routeMapping.expectedScript;
      pushCheck(checks, {
        checkCode: "criticalRouteMismatch",
        severity: config.severities.criticalRouteMismatch,
        status: matchesScript ? "PASS" : "FAIL",
        targetType: "route",
        targetName: routeMapping.pattern,
        expected: routeMapping.expectedScript,
        actual: route.script,
        details: matchesScript
          ? `Critical route ${routeMapping.pattern} points to expected script.`
          : `Critical route ${routeMapping.pattern} points to unexpected script.`,
      });
    }
  }

  for (const domain of snapshots.domains) {
    const blocked = config.blockedMappings.services.includes(domain.service);
    pushCheck(checks, {
      checkCode: "blockedServiceHit",
      severity: config.severities.blockedServiceHit,
      status: blocked ? "FAIL" : "PASS",
      targetType: "domain",
      targetName: domain.hostname,
      expected: `service NOT IN [${config.blockedMappings.services.join(", ")}]`,
      actual: domain.service,
      details: blocked
        ? `Blocked service ${domain.service} is attached to ${domain.hostname}.`
        : `Domain ${domain.hostname} is not attached to blocked services.`,
    });
  }

  for (const route of snapshots.routes) {
    const blocked = config.blockedMappings.scripts.includes(route.script);
    pushCheck(checks, {
      checkCode: "blockedScriptHit",
      severity: config.severities.blockedScriptHit,
      status: blocked ? "FAIL" : "PASS",
      targetType: "route_global",
      targetName: route.pattern,
      expected: `script NOT IN [${config.blockedMappings.scripts.join(", ")}]`,
      actual: route.script,
      details: blocked
        ? `Blocked script ${route.script} is attached to ${route.pattern}.`
        : `Route ${route.pattern} is not attached to blocked scripts.`,
    });
  }

  for (const databaseName of config.criticalDatastores.d1DatabaseNames) {
    const present = snapshots.d1DatabaseNames.includes(databaseName);
    pushCheck(checks, {
      checkCode: "criticalD1Missing",
      severity: config.severities.criticalD1Missing,
      status: present ? "PASS" : "FAIL",
      targetType: "datastore_d1",
      targetName: databaseName,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `D1 database ${databaseName} exists.` : `D1 database ${databaseName} is missing.`,
    });
  }

  for (const bucketName of config.criticalDatastores.r2BucketNames) {
    const present = snapshots.r2BucketNames.includes(bucketName);
    pushCheck(checks, {
      checkCode: "criticalR2Missing",
      severity: config.severities.criticalR2Missing,
      status: present ? "PASS" : "FAIL",
      targetType: "datastore_r2",
      targetName: bucketName,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `R2 bucket ${bucketName} exists.` : `R2 bucket ${bucketName} is missing.`,
    });
  }

  for (const namespaceName of config.criticalDatastores.kvNamespaceNames) {
    const present = snapshots.kvNamespaceNames.includes(namespaceName);
    pushCheck(checks, {
      checkCode: "criticalKvMissing",
      severity: config.severities.criticalKvMissing,
      status: present ? "PASS" : "FAIL",
      targetType: "datastore_kv",
      targetName: namespaceName,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `KV namespace ${namespaceName} exists.` : `KV namespace ${namespaceName} is missing.`,
    });
  }

  for (const queueName of config.criticalDatastores.queueNames) {
    const present = snapshots.queueNames.includes(queueName);
    pushCheck(checks, {
      checkCode: "criticalQueueMissing",
      severity: config.severities.criticalQueueMissing,
      status: present ? "PASS" : "FAIL",
      targetType: "datastore_queue",
      targetName: queueName,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `Queue ${queueName} exists.` : `Queue ${queueName} is missing.`,
    });
  }

  for (const className of config.criticalDatastores.durableObjectClassNames) {
    const present = snapshots.durableObjectClassNames.includes(className);
    pushCheck(checks, {
      checkCode: "criticalDurableObjectMissing",
      severity: config.severities.criticalDurableObjectMissing,
      status: present ? "PASS" : "FAIL",
      targetType: "durable_object",
      targetName: className,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `Durable object class ${className} exists.` : `Durable object class ${className} is missing.`,
    });
  }

  for (const tableRequirement of config.criticalTables) {
    const databaseSnapshot = tablesByDatabases.get(tableRequirement.databaseName);
    const databasePresent = snapshots.d1DatabaseNames.includes(tableRequirement.databaseName);
    if (!databasePresent || !databaseSnapshot) {
      for (const table of tableRequirement.tables) {
        pushCheck(checks, {
          checkCode: "criticalTableMissing",
          severity: config.severities.criticalTableMissing,
          status: "FAIL",
          targetType: "d1_table",
          targetName: `${tableRequirement.databaseName}.${table.tableName}`,
          expected: "present",
          actual: "database missing",
          details: `Table check skipped because database ${tableRequirement.databaseName} is missing.`,
        });
      }
      continue;
    }

    for (const table of tableRequirement.tables) {
      const tableExists = databaseSnapshot.tables.includes(table.tableName);
      pushCheck(checks, {
        checkCode: "criticalTableMissing",
        severity: config.severities.criticalTableMissing,
        status: tableExists ? "PASS" : "FAIL",
        targetType: "d1_table",
        targetName: `${tableRequirement.databaseName}.${table.tableName}`,
        expected: "present",
        actual: tableExists ? "present" : "missing",
        details: tableExists
          ? `Table ${tableRequirement.databaseName}.${table.tableName} exists.`
          : `Table ${tableRequirement.databaseName}.${table.tableName} is missing.`,
      });

      if (!tableExists) {
        continue;
      }

      const columns = databaseSnapshot.columnsByTables[table.tableName] ?? [];
      for (const columnName of table.requiredColumns) {
        const columnExists = columns.includes(columnName);
        pushCheck(checks, {
          checkCode: "criticalColumnMissing",
          severity: config.severities.criticalColumnMissing,
          status: columnExists ? "PASS" : "FAIL",
          targetType: "d1_column",
          targetName: `${tableRequirement.databaseName}.${table.tableName}.${columnName}`,
          expected: "present",
          actual: columnExists ? "present" : "missing",
          details: columnExists
            ? `Column ${tableRequirement.databaseName}.${table.tableName}.${columnName} exists.`
            : `Column ${tableRequirement.databaseName}.${table.tableName}.${columnName} is missing.`,
        });
      }
    }

    const usersColumns = databaseSnapshot.columnsByTables.users ?? [];
    if (databaseSnapshot.tables.includes("users")) {
      const onboardingExists = usersColumns.includes("onboarding_completed");
      pushCheck(checks, {
        checkCode: "onboardingColumnsMismatch",
        severity: config.severities.onboardingColumnsMismatch,
        status: onboardingExists ? "PASS" : "FAIL",
        targetType: "d1_column",
        targetName: `${tableRequirement.databaseName}.users.onboarding_completed`,
        expected: "present",
        actual: onboardingExists ? "present" : "missing",
        details: onboardingExists
          ? `Onboarding column exists in ${tableRequirement.databaseName}.users.`
          : `Onboarding column is missing in ${tableRequirement.databaseName}.users.`,
      });
    } else {
      pushCheck(checks, {
        checkCode: "onboardingColumnsMismatch",
        severity: config.severities.onboardingColumnsMismatch,
        status: "N/A",
        targetType: "d1_column",
        targetName: `${tableRequirement.databaseName}.users.onboarding_completed`,
        expected: "present",
        actual: "table missing",
        details: `Onboarding column check skipped because users table is missing in ${tableRequirement.databaseName}.`,
      });
    }
  }

  return checks;
}

async function buildLegacyProductionGuardChecks(guards: LegacyProductionGuard[]): Promise<CheckRecord[]> {
  const checks: CheckRecord[] = [];

  for (const guard of guards) {
    let content = "";
    let readError: string | null = null;
    try {
      content = await fs.readFile(resolveAbsolutePath(guard.filePath), "utf8");
    } catch (error) {
      readError = error instanceof Error ? error.message : String(error);
    }

    const missingTokens = readError
      ? guard.mustInclude
      : guard.mustInclude.filter((token) => !content.includes(token));
    const passed = missingTokens.length === 0;

    checks.push({
      checkCode: "legacyProductionGuardMissing",
      severity: LEGACY_GUARD_DEFAULT_SEVERITY,
      status: passed ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: guard.mustInclude,
      actual: readError ? `READ_ERROR:${readError}` : missingTokens.length === 0 ? "all_tokens_present" : missingTokens,
      details: passed
        ? `Legacy production guard verified in ${guard.filePath}.`
        : `Legacy production guard drift detected in ${guard.filePath}. Missing tokens: ${missingTokens.join(", ")}`,
    });
  }

  return checks;
}

async function buildLegacyAuthDbFallbackFlagChecks(
  guard: LegacyAuthDbFallbackFlagGuard,
): Promise<CheckRecord[]> {
  const detections: string[] = [];

  for (const filePath of guard.configPaths) {
    let content = "";
    try {
      content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.includes(guard.flagName)) continue;
      if (line.trimStart().startsWith("#")) continue;
      if (line.includes('"1"') || line.includes("'1'") || /\b1\b/.test(line)) {
        detections.push(`${filePath}:${index + 1}`);
      }
    }
  }

  return [
    {
      checkCode: "legacyAuthDbFallbackFlagEnabled",
      severity: "BLOCKER",
      status: detections.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: `${guard.flagName} disabled in production configs`,
      actual: detections.length === 0 ? "not_enabled" : detections,
      details:
        detections.length === 0
          ? `${guard.flagName} is not enabled in scanned configs.`
          : `${guard.flagName} is enabled in production-facing config and must be removed before production.`,
    },
  ];
}

function parseTomlSection(line: string): string | null {
  const match = line.match(/^\s*\[([^\]]+)\]\s*$/);
  return match ? match[1] : null;
}

function parseBindingValue(line: string): string | null {
  const tomlMatch = line.match(/^\s*binding\s*=\s*"([^"]+)"/);
  if (tomlMatch) return tomlMatch[1];
  const jsoncMatch = line.match(/^\s*"binding"\s*:\s*"([^"]+)"/);
  return jsoncMatch ? jsoncMatch[1] : null;
}

function parseDatabaseNameValue(line: string): string | null {
  const tomlMatch = line.match(/^\s*database_name\s*=\s*"([^"]+)"/);
  if (tomlMatch) return tomlMatch[1];
  const jsoncMatch = line.match(/^\s*"database_name"\s*:\s*"([^"]+)"/);
  return jsoncMatch ? jsoncMatch[1] : null;
}

function parseDatabaseIdValue(line: string): string | null {
  const tomlMatch = line.match(/^\s*database_id\s*=\s*"([^"]+)"/);
  if (tomlMatch) return tomlMatch[1];
  const jsoncMatch = line.match(/^\s*"database_id"\s*:\s*"([^"]+)"/);
  return jsoncMatch ? jsoncMatch[1] : null;
}

function parseD1BindingsFromContent(content: string, filePath: string): D1BindingRecord[] {
  if (filePath.endsWith(".toml")) {
    return parseD1BindingsFromToml(content, filePath);
  }
  return parseD1BindingsFromJsonc(content, filePath);
}

function parseD1BindingsFromToml(content: string, filePath: string): D1BindingRecord[] {
  const lines = content.split(/\r?\n/);
  const records: D1BindingRecord[] = [];
  let currentSection = "root";
  let currentBlock:
    | {
        section: string;
        binding: string | null;
        databaseName: string | null;
        databaseId: string | null;
      }
    | null = null;

  const flushCurrentBlock = () => {
    if (!currentBlock?.binding) return;
    records.push({
      binding: currentBlock.binding,
      databaseName: currentBlock.databaseName,
      databaseId: currentBlock.databaseId,
      filePath,
      section: currentBlock.section,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const section = parseTomlSection(line);
    if (section) {
      currentSection = section;
      continue;
    }

    const d1BlockMatch = line.match(/^\s*\[\[([^\]]*d1_databases)\]\]\s*$/);
    if (d1BlockMatch) {
      flushCurrentBlock();
      currentBlock = {
        section: d1BlockMatch[1],
        binding: null,
        databaseName: null,
        databaseId: null,
      };
      continue;
    }

    if (!currentBlock) {
      continue;
    }

    if (/^\s*\[\[/.test(line) && !d1BlockMatch) {
      flushCurrentBlock();
      currentBlock = null;
      continue;
    }

    const binding = parseBindingValue(line);
    if (binding) {
      currentBlock.binding = binding;
      continue;
    }

    const databaseName = parseDatabaseNameValue(line);
    if (databaseName) {
      currentBlock.databaseName = databaseName;
      continue;
    }

    const databaseId = parseDatabaseIdValue(line);
    if (databaseId) {
      currentBlock.databaseId = databaseId;
    }
  }

  flushCurrentBlock();
  return records;
}

function parseD1BindingsFromJsonc(content: string, filePath: string): D1BindingRecord[] {
  const lines = content.split(/\r?\n/);
  const records: D1BindingRecord[] = [];
  let currentSection = "root";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const section = parseTomlSection(line);
    if (section) {
      currentSection = section;
    }

    const binding = parseBindingValue(line);
    if (!binding) continue;

    let databaseName: string | null = null;
    let databaseId: string | null = null;

    for (let scan = Math.max(0, index - 8); scan <= Math.min(lines.length - 1, index + 8); scan += 1) {
      const scanLine = lines[scan];
      if (!databaseName) {
        databaseName = parseDatabaseNameValue(scanLine);
      }
      if (!databaseId) {
        databaseId = parseDatabaseIdValue(scanLine);
      }
      if (databaseName && databaseId) break;
    }

    records.push({
      binding,
      databaseName,
      databaseId,
      filePath,
      section: currentSection,
    });
  }

  return records;
}

function isLocalOrFailClosedId(value: string | null): boolean {
  return value ? LOCAL_OR_FAIL_CLOSED_DATABASE_IDS.has(value) : false;
}

function isLocalCollapsedName(value: string | null): boolean {
  return value ? LOCAL_COLLAPSED_DATABASE_NAMES.has(value) : false;
}

function isPreviewRecord(record: D1BindingRecord): boolean {
  const section = record.section.toLowerCase();
  if (section.includes("production")) return false;
  return section.includes("preview") || record.filePath.toLowerCase().includes("preview");
}

function isProductionRecord(record: D1BindingRecord): boolean {
  return record.section.toLowerCase().includes("production");
}

async function buildDeployablePlaceholderDatabaseIdChecks(
  guard: DeployablePlaceholderDatabaseIdGuard,
): Promise<CheckRecord[]> {
  const violations: string[] = [];

  for (const filePath of guard.configPaths) {
    let content = "";
    try {
      content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
    } catch {
      continue;
    }

    for (const forbiddenDatabaseId of guard.forbiddenDatabaseIds) {
      if (content.includes(forbiddenDatabaseId)) {
        violations.push(`${filePath} contains forbidden database_id ${forbiddenDatabaseId}`);
      }
    }
  }

  return [
    {
      checkCode: "deployablePlaceholderDatabaseIdPresent",
      severity: "BLOCKER",
      status: violations.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: `deployable wrangler configs avoid placeholder database ids [${guard.forbiddenDatabaseIds.join(", ")}]`,
      actual: violations.length === 0 ? "no_placeholder_ids_detected" : violations,
      details:
        violations.length === 0
          ? "No deployable wrangler config contains a placeholder D1 database_id."
          : "Deployable wrangler config still contains a placeholder D1 database_id that Cloudflare will reject.",
    },
  ];
}

async function buildSocialflowAuthsBindingGuardChecks(guard: SocialflowAuthsBindingGuard): Promise<CheckRecord[]> {
  const checks: CheckRecord[] = [];
  const allRecords: D1BindingRecord[] = [];

  for (const filePath of guard.configPaths) {
    let content = "";
    try {
      content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
    } catch {
      continue;
    }
    allRecords.push(...parseD1BindingsFromContent(content, filePath));
  }

  const socialflowAuthsRecords = allRecords.filter((record) => record.binding === guard.socialflowBinding);
  const reservedRecords = allRecords.filter((record) => guard.reservedBindings.includes(record.binding));

  if (socialflowAuthsRecords.length === 0) {
    checks.push({
      checkCode: "socialflowAuthsBindingMissing",
      severity: SOCIALFLOW_AUTHS_GUARD_SEVERITY,
      status: "FAIL",
      targetType: "code_guard",
      targetName: `${guard.targetName}:missing_binding`,
      expected: `${guard.socialflowBinding} configured`,
      actual: "binding_not_present",
      details: `${guard.socialflowBinding} binding is required for socialflow auth and is missing from scanned configs. Provision dedicated D1s with "pnpm exec wrangler d1 create saas_socialflow_auths_prod_db" and "pnpm exec wrangler d1 create saas_socialflow_auths_preview_db", then bind the returned ids in deployable SocialFlow wrangler configs. Until then, auth must remain fail-closed and deploy is intentionally blocked by readiness.`,
    });
    checks.push({
      checkCode: "socialflowAuthsBindingSharedIdentity",
      severity: SOCIALFLOW_AUTHS_GUARD_SEVERITY,
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:shared_identity`,
      expected: `${guard.socialflowBinding} configured`,
      actual: "binding_not_present_yet",
      details: `Guard armed for future cutover: ${guard.socialflowBinding} is not configured yet.`,
    });
    checks.push({
      checkCode: "socialflowAuthsBindingNamingViolation",
      severity: SOCIALFLOW_AUTHS_GUARD_SEVERITY,
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:naming`,
      expected: "database_name includes socialflow + auth",
      actual: "binding_not_present_yet",
      details: `Naming policy deferred until ${guard.socialflowBinding} exists in config.`,
    });
    checks.push({
      checkCode: "socialflowAuthsBindingPreviewProdCollision",
      severity: SOCIALFLOW_AUTHS_GUARD_SEVERITY,
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:preview_prod_collision`,
      expected: "preview and production use distinct physical identities",
      actual: "binding_not_present_yet",
      details: `Preview/prod collision check deferred until ${guard.socialflowBinding} is configured.`,
    });
    return checks;
  }

  const sharedIdentityViolations: string[] = [];
  for (const socialflowRecord of socialflowAuthsRecords) {
    for (const reserved of reservedRecords) {
      const sameId =
        socialflowRecord.databaseId &&
        reserved.databaseId &&
        socialflowRecord.databaseId === reserved.databaseId &&
        !isLocalOrFailClosedId(socialflowRecord.databaseId);
      const sameName =
        socialflowRecord.databaseName &&
        reserved.databaseName &&
        socialflowRecord.databaseName === reserved.databaseName &&
        !isLocalCollapsedName(socialflowRecord.databaseName);
      if (sameId || sameName) {
        sharedIdentityViolations.push(
          `${socialflowRecord.filePath} (${socialflowRecord.section}) shares identity with ${reserved.binding} in ${reserved.filePath} (${reserved.section})`,
        );
      }
    }
  }

  checks.push({
    checkCode: "socialflowAuthsBindingSharedIdentity",
    severity: SOCIALFLOW_AUTHS_GUARD_SEVERITY,
    status: sharedIdentityViolations.length === 0 ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:shared_identity`,
    expected: `no identity overlap with [${guard.reservedBindings.join(", ")}]`,
    actual: sharedIdentityViolations.length === 0 ? "no_overlap_detected" : sharedIdentityViolations,
    details:
      sharedIdentityViolations.length === 0
        ? `${guard.socialflowBinding} uses a dedicated physical identity in scanned configs.`
        : `${guard.socialflowBinding} overlaps with reserved bindings.`,
  });

  const namingViolations = socialflowAuthsRecords
    .filter((record) => {
      if (!record.databaseName || isLocalCollapsedName(record.databaseName)) return false;
      const lower = record.databaseName.toLowerCase();
      return !lower.includes("socialflow") || !lower.includes("auth");
    })
    .map((record) => `${record.filePath} (${record.section}) => ${record.databaseName}`);

  checks.push({
    checkCode: "socialflowAuthsBindingNamingViolation",
    severity: SOCIALFLOW_AUTHS_GUARD_SEVERITY,
    status: namingViolations.length === 0 ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:naming`,
    expected: "database_name includes socialflow + auth (except local collapsed dev)",
    actual: namingViolations.length === 0 ? "naming_valid" : namingViolations,
    details:
      namingViolations.length === 0
        ? `${guard.socialflowBinding} naming matches dedicated auth policy.`
        : `${guard.socialflowBinding} naming violates dedicated auth policy.`,
  });

  const previewRecords = socialflowAuthsRecords.filter(isPreviewRecord);
  const productionRecords = socialflowAuthsRecords.filter(isProductionRecord);
  const previewProdCollisions: string[] = [];
  if (previewRecords.length > 0 && productionRecords.length > 0) {
    for (const previewRecord of previewRecords) {
      for (const productionRecord of productionRecords) {
        const sameId =
          previewRecord.databaseId &&
          productionRecord.databaseId &&
          previewRecord.databaseId === productionRecord.databaseId &&
          !isLocalOrFailClosedId(previewRecord.databaseId);
        const sameName =
          previewRecord.databaseName &&
          productionRecord.databaseName &&
          previewRecord.databaseName === productionRecord.databaseName &&
          !isLocalCollapsedName(previewRecord.databaseName);
        if (sameId || sameName) {
          previewProdCollisions.push(
            `${previewRecord.filePath} (${previewRecord.section}) collides with ${productionRecord.filePath} (${productionRecord.section})`,
          );
        }
      }
    }
  }

  checks.push({
    checkCode: "socialflowAuthsBindingPreviewProdCollision",
    severity: SOCIALFLOW_AUTHS_GUARD_SEVERITY,
    status:
      previewRecords.length > 0 && productionRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "PASS"
          : "FAIL"
        : "N/A",
    targetType: "code_guard",
    targetName: `${guard.targetName}:preview_prod_collision`,
    expected: "preview and production use distinct physical identities",
    actual:
      previewRecords.length > 0 && productionRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "distinct"
          : previewProdCollisions
        : "not_enough_context",
    details:
      previewRecords.length > 0 && productionRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "Preview/production identities are isolated."
          : "Preview/production identities collide."
        : "Preview/production collision check skipped (missing preview or production binding evidence).",
  });

  return checks;
}

async function buildMentoriaAuthsBindingGuardChecks(guard: MentoriaAuthsBindingGuard): Promise<CheckRecord[]> {
  const checks: CheckRecord[] = [];
  const allRecords: D1BindingRecord[] = [];

  for (const filePath of guard.configPaths) {
    let content = "";
    try {
      content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
    } catch {
      continue;
    }
    allRecords.push(...parseD1BindingsFromContent(content, filePath));
  }

  const mentoriasAuthsRecords = allRecords.filter((record) => record.binding === guard.mentoriasAuthBinding);
  const reservedRecords = allRecords.filter((record) => guard.reservedBindings.includes(record.binding));

  if (mentoriasAuthsRecords.length === 0) {
    checks.push({
      checkCode: "mentoriaAuthsBindingMissing",
      severity: "BLOCKER",
      status: "FAIL",
      targetType: "code_guard",
      targetName: `${guard.targetName}:missing_binding`,
      expected: `${guard.mentoriasAuthBinding} configured`,
      actual: "binding_not_present",
      details: `${guard.mentoriasAuthBinding} binding is required for Mentoría auth. Provision dedicated D1s with "pnpm exec wrangler d1 create mentorias_auths_prod_db" and "pnpm exec wrangler d1 create mentorias_auths_preview_db", then bind the returned ids in deployable Mentoría wrangler configs.`,
    });
    checks.push({
      checkCode: "mentoriaAuthsBindingSharedIdentity",
      severity: "BLOCKER",
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:shared_identity`,
      expected: `${guard.mentoriasAuthBinding} configured`,
      actual: "binding_not_present_yet",
      details: `Guard armed for future cutover: ${guard.mentoriasAuthBinding} is not configured yet.`,
    });
    checks.push({
      checkCode: "mentoriaAuthsBindingNamingViolation",
      severity: "BLOCKER",
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:naming`,
      expected: "database_name includes mentoria + auth",
      actual: "binding_not_present_yet",
      details: `Naming policy deferred until ${guard.mentoriasAuthBinding} exists in config.`,
    });
    checks.push({
      checkCode: "mentoriaAuthsBindingPreviewProdCollision",
      severity: "BLOCKER",
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:preview_prod_collision`,
      expected: "preview and production use distinct physical identities",
      actual: "binding_not_present_yet",
      details: `Preview/prod collision check deferred until ${guard.mentoriasAuthBinding} is configured.`,
    });
    return checks;
  }

  const sharedIdentityViolations: string[] = [];
  for (const authRecord of mentoriasAuthsRecords) {
    for (const reserved of reservedRecords) {
      const sameId =
        authRecord.databaseId &&
        reserved.databaseId &&
        authRecord.databaseId === reserved.databaseId &&
        !isLocalOrFailClosedId(authRecord.databaseId);
      const sameName =
        authRecord.databaseName &&
        reserved.databaseName &&
        authRecord.databaseName === reserved.databaseName &&
        !isLocalCollapsedName(authRecord.databaseName);
      if (sameId || sameName) {
        sharedIdentityViolations.push(
          `${authRecord.filePath} (${authRecord.section}) shares identity with ${reserved.binding} in ${reserved.filePath} (${reserved.section})`,
        );
      }
    }
  }

  checks.push({
    checkCode: "mentoriaAuthsBindingSharedIdentity",
    severity: "BLOCKER",
    status: sharedIdentityViolations.length === 0 ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:shared_identity`,
    expected: `no identity overlap with [${guard.reservedBindings.join(", ")}]`,
    actual: sharedIdentityViolations.length === 0 ? "no_overlap_detected" : sharedIdentityViolations,
    details:
      sharedIdentityViolations.length === 0
        ? `${guard.mentoriasAuthBinding} uses a dedicated physical identity in scanned configs.`
        : `${guard.mentoriasAuthBinding} overlaps with reserved bindings.`,
  });

  const namingViolations = mentoriasAuthsRecords
    .filter((record) => {
      if (!record.databaseName || isLocalCollapsedName(record.databaseName)) return false;
      const lower = record.databaseName.toLowerCase();
      return !lower.includes("mentoria") || !lower.includes("auth");
    })
    .map((record) => `${record.filePath} (${record.section}) => ${record.databaseName}`);

  checks.push({
    checkCode: "mentoriaAuthsBindingNamingViolation",
    severity: "BLOCKER",
    status: namingViolations.length === 0 ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:naming`,
    expected: "database_name includes mentoria + auth (except local collapsed dev)",
    actual: namingViolations.length === 0 ? "naming_valid" : namingViolations,
    details:
      namingViolations.length === 0
        ? `${guard.mentoriasAuthBinding} naming matches dedicated auth policy.`
        : `${guard.mentoriasAuthBinding} naming violates dedicated auth policy.`,
  });

  const previewRecords = mentoriasAuthsRecords.filter(isPreviewRecord);
  const productionRecords = mentoriasAuthsRecords.filter(isProductionRecord);
  const previewProdCollisions: string[] = [];
  if (previewRecords.length > 0 && productionRecords.length > 0) {
    for (const previewRecord of previewRecords) {
      for (const productionRecord of productionRecords) {
        const sameId =
          previewRecord.databaseId &&
          productionRecord.databaseId &&
          previewRecord.databaseId === productionRecord.databaseId &&
          !isLocalOrFailClosedId(previewRecord.databaseId);
        const sameName =
          previewRecord.databaseName &&
          productionRecord.databaseName &&
          previewRecord.databaseName === productionRecord.databaseName &&
          !isLocalCollapsedName(previewRecord.databaseName);
        if (sameId || sameName) {
          previewProdCollisions.push(
            `${previewRecord.filePath} (${previewRecord.section}) collides with ${productionRecord.filePath} (${productionRecord.section})`,
          );
        }
      }
    }
  }

  checks.push({
    checkCode: "mentoriaAuthsBindingPreviewProdCollision",
    severity: "BLOCKER",
    status:
      previewRecords.length > 0 && productionRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "PASS"
          : "FAIL"
        : "N/A",
    targetType: "code_guard",
    targetName: `${guard.targetName}:preview_prod_collision`,
    expected: "preview and production use distinct physical identities",
    actual:
      previewRecords.length > 0 && productionRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "distinct"
          : previewProdCollisions
        : "not_enough_context",
    details:
      previewRecords.length > 0 && productionRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "Preview/production identities are isolated."
          : "Preview/production identities collide."
        : "Preview/production collision check skipped (missing preview or production binding evidence).",
  });

  return checks;
}

async function buildSocialflowDomainGuardChecks(
  guard: SocialflowDomainGuard,
  snapshots: ProductionReadinessReport["snapshots"],
): Promise<CheckRecord[]> {
  const checks: CheckRecord[] = [];
  const domainsByHostnames = new Map(snapshots.domains.map((item) => [item.hostname.toLowerCase(), item]));
  const canonicalDomain = domainsByHostnames.get(guard.canonicalHostname.toLowerCase());
  const compatibilityDomain = domainsByHostnames.get(guard.compatibilityHostname.toLowerCase());
  const phaseIsActive = guard.phase === "active";
  const canonicalPresent = Boolean(canonicalDomain);
  const canonicalMatchesWorker = canonicalDomain?.service === guard.expectedWorker;
  const canonicalHealthy = canonicalPresent && canonicalMatchesWorker;

  checks.push({
    checkCode: "socialflowCanonicalHostnameMissing",
    severity: phaseIsActive ? "BLOCKER" : "WARN",
    status: canonicalPresent ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:canonical_hostname`,
    expected: `${guard.canonicalHostname} present`,
    actual: canonicalPresent ? "present" : "missing",
    details: canonicalPresent
      ? `Canonical SocialFlow hostname ${guard.canonicalHostname} is present in domain snapshots.`
      : phaseIsActive
        ? `Canonical SocialFlow hostname ${guard.canonicalHostname} is missing while phase gate is active.`
        : `Canonical SocialFlow hostname ${guard.canonicalHostname} is still pending; phase gate is inactive so this remains transitional debt.`,
  });

  checks.push({
    checkCode: "socialflowCanonicalHostnameWrongWorker",
    severity: "BLOCKER",
    status: !canonicalPresent ? "N/A" : canonicalMatchesWorker ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:canonical_worker`,
    expected: `${guard.canonicalHostname} -> ${guard.expectedWorker}`,
    actual: !canonicalPresent ? "hostname_missing" : canonicalDomain?.service ?? "unknown",
    details: !canonicalPresent
      ? `Worker ownership check skipped because ${guard.canonicalHostname} is missing.`
      : canonicalMatchesWorker
        ? `Canonical SocialFlow hostname points to ${guard.expectedWorker}.`
        : `Canonical SocialFlow hostname points to ${canonicalDomain?.service}, expected ${guard.expectedWorker}.`,
  });

  const pluralLooksPrimary =
    compatibilityDomain && (!canonicalHealthy || compatibilityDomain.service !== guard.expectedWorker);
  checks.push({
    checkCode: "socialflowPluralPrimaryWarning",
    severity: "WARN",
    status: !compatibilityDomain ? "PASS" : pluralLooksPrimary ? "FAIL" : "PASS",
    targetType: "code_guard",
    targetName: `${guard.targetName}:plural_compatibility`,
    expected: canonicalHealthy
      ? `${guard.compatibilityHostname} remains compatibility host, not primary`
      : `${guard.compatibilityHostname} may exist as transitional compatibility host`,
    actual: !compatibilityDomain ? "not_present" : `${guard.compatibilityHostname} -> ${compatibilityDomain.service}`,
    details: !compatibilityDomain
      ? `Compatibility hostname ${guard.compatibilityHostname} is not configured in snapshots.`
      : pluralLooksPrimary
        ? `Compatibility hostname ${guard.compatibilityHostname} appears to remain primary because canonical hostname is missing/misaligned or plural points outside expected worker.`
        : `Compatibility hostname ${guard.compatibilityHostname} is present while canonical hostname is healthy; treated as compatibility state.`,
  });

  if (!phaseIsActive) {
    checks.push({
      checkCode: "socialflowCanonicalSmokeMissing",
      severity: "WARN",
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:canonical_smoke`,
      expected: "canonical smoke evidence configured",
      actual: "phase_inactive",
      details: "Canonical smoke evidence check is deferred until socialflow canonical domain phase is active.",
    });
    return checks;
  }

  const missingPaths: string[] = [];
  const contents: Array<{ filePath: string; content: string }> = [];
  for (const evidencePath of guard.smokeEvidencePaths) {
    try {
      const absolutePath = resolveAbsolutePath(evidencePath);
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile()) {
        missingPaths.push(`${evidencePath} (not a file)`);
        continue;
      }
      const content = await fs.readFile(absolutePath, "utf8");
      contents.push({ filePath: evidencePath, content });
    } catch {
      missingPaths.push(evidencePath);
    }
  }

  const missingTokens = guard.smokeEvidenceTokens.filter(
    (token) => !contents.some((item) => item.content.includes(token)),
  );
  const smokeEvidencePass = missingPaths.length === 0 && missingTokens.length === 0;
  checks.push({
    checkCode: "socialflowCanonicalSmokeMissing",
    severity: "BLOCKER",
    status: smokeEvidencePass ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:canonical_smoke`,
    expected: {
      files: guard.smokeEvidencePaths,
      mustInclude: guard.smokeEvidenceTokens,
    },
    actual: smokeEvidencePass
      ? "evidence_present"
      : {
          missingPaths,
          missingTokens,
        },
    details: smokeEvidencePass
      ? "Canonical smoke evidence is present for active domain phase."
      : "Canonical smoke evidence is missing while socialflow canonical domain phase is active.",
  });

  return checks;
}

async function buildMentoriaBindingGuardChecks(guard: MentoriaBindingGuard): Promise<CheckRecord[]> {
  const checks: CheckRecord[] = [];
  const allRecords: D1BindingRecord[] = [];

  for (const filePath of guard.configPaths) {
    let content = "";
    try {
      content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
    } catch {
      continue;
    }
    allRecords.push(...parseD1BindingsFromContent(content, filePath));
  }

  const mentoriaRecords = allRecords.filter((record) => record.binding === guard.mentoriaBinding);
  const reservedRecords = allRecords.filter((record) => guard.reservedBindings.includes(record.binding));

  if (mentoriaRecords.length === 0) {
    checks.push({
      checkCode: "mentoriaBindingMissingTransitionalDebt",
      severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
      status: "FAIL",
      targetType: "code_guard",
      targetName: `${guard.targetName}:missing_binding`,
      expected: `${guard.mentoriaBinding} configured`,
      actual: "binding_not_present",
      details: `${guard.mentoriaBinding} binding is required for Mentoria product runtime and is missing from scanned configs.`,
    });
    checks.push({
      checkCode: "mentoriaBindingSharedIdentity",
      severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:shared_identity`,
      expected: `${guard.mentoriaBinding} configured`,
      actual: "binding_not_present_yet",
      details: `Shared-identity guard is armed for future cutover: ${guard.mentoriaBinding} is not configured yet.`,
    });
    checks.push({
      checkCode: "mentoriaBindingPreviewProdCollision",
      severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
      status: "N/A",
      targetType: "code_guard",
      targetName: `${guard.targetName}:preview_prod_collision`,
      expected: "preview and production use distinct physical identities",
      actual: "binding_not_present_yet",
      details: `Preview/prod collision check is deferred until ${guard.mentoriaBinding} exists.`,
    });
    return checks;
  }

  checks.push({
    checkCode: "mentoriaBindingMissingTransitionalDebt",
    severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
    status: "PASS",
    targetType: "code_guard",
    targetName: `${guard.targetName}:missing_binding`,
    expected: `${guard.mentoriaBinding} configured`,
    actual: "binding_present",
    details: `${guard.mentoriaBinding} is present in config.`,
  });

  const sharedIdentityViolations: string[] = [];
  for (const mentoriaRecord of mentoriaRecords) {
    for (const reserved of reservedRecords) {
      const sameId =
        mentoriaRecord.databaseId &&
        reserved.databaseId &&
        mentoriaRecord.databaseId === reserved.databaseId &&
        !isLocalOrFailClosedId(mentoriaRecord.databaseId);
      const sameName =
        mentoriaRecord.databaseName &&
        reserved.databaseName &&
        mentoriaRecord.databaseName === reserved.databaseName &&
        !isLocalCollapsedName(mentoriaRecord.databaseName);
      if (sameId || sameName) {
        sharedIdentityViolations.push(
          `${mentoriaRecord.filePath} (${mentoriaRecord.section}) shares identity with ${reserved.binding} in ${reserved.filePath} (${reserved.section})`,
        );
      }
    }
  }

  checks.push({
    checkCode: "mentoriaBindingSharedIdentity",
    severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
    status: sharedIdentityViolations.length === 0 ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:shared_identity`,
    expected: `no identity overlap with [${guard.reservedBindings.join(", ")}]`,
    actual: sharedIdentityViolations.length === 0 ? "no_overlap_detected" : sharedIdentityViolations,
    details:
      sharedIdentityViolations.length === 0
        ? `${guard.mentoriaBinding} uses a dedicated physical identity in scanned configs.`
        : `${guard.mentoriaBinding} overlaps with reserved bindings.`,
  });

  const previewRecords = mentoriaRecords.filter(isPreviewRecord);
  const nonPreviewMentoriaRecords = mentoriaRecords.filter((record) => !isPreviewRecord(record));
  const reservedProductionRecords = reservedRecords.filter((record) => !isPreviewRecord(record));
  const previewProdCollisions: string[] = [];

  for (const previewRecord of previewRecords) {
    const previewHasMarker =
      (previewRecord.databaseName?.toLowerCase().includes("preview") ?? false) ||
      isLocalOrFailClosedId(previewRecord.databaseId);
    if (!previewHasMarker) {
      previewProdCollisions.push(
        `${previewRecord.filePath} (${previewRecord.section}) is neither fail-closed nor explicitly preview-marked`,
      );
    }

    for (const candidate of [...nonPreviewMentoriaRecords, ...reservedProductionRecords]) {
      const sameId =
        previewRecord.databaseId &&
        candidate.databaseId &&
        previewRecord.databaseId === candidate.databaseId &&
        !isLocalOrFailClosedId(previewRecord.databaseId);
      const sameName =
        previewRecord.databaseName &&
        candidate.databaseName &&
        previewRecord.databaseName === candidate.databaseName &&
        !isLocalCollapsedName(previewRecord.databaseName);
      if (sameId || sameName) {
        previewProdCollisions.push(
          `${previewRecord.filePath} (${previewRecord.section}) collides with ${candidate.binding} in ${candidate.filePath} (${candidate.section})`,
        );
      }
    }
  }

  checks.push({
    checkCode: "mentoriaBindingPreviewProdCollision",
    severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
    status:
      previewRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "PASS"
          : "FAIL"
        : "N/A",
    targetType: "code_guard",
    targetName: `${guard.targetName}:preview_prod_collision`,
    expected: "preview must be isolated from production identities and be fail-closed or preview-marked",
    actual:
      previewRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "isolated_and_marked"
          : previewProdCollisions
        : "preview_not_configured",
    details:
      previewRecords.length > 0
        ? previewProdCollisions.length === 0
          ? "Preview identity is isolated and clearly marked."
          : "Preview identity collides with production or is not clearly marked."
        : "Preview collision check skipped because no preview binding evidence exists.",
  });

  return checks;
}

async function buildMentoriaFallbackDebtChecks(guard: MentoriaBindingGuard): Promise<CheckRecord[]> {
  let content = "";
  let readError: string | null = null;

  try {
    content = await fs.readFile(resolveAbsolutePath(guard.fallbackFilePath), "utf8");
  } catch (error) {
    readError = error instanceof Error ? error.message : String(error);
  }

  const fallbackStillPresent = readError ? true : content.includes(guard.fallbackToken);
  return [
    {
      checkCode: "mentoriaDbFallbackTransitionalDebt",
      severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
      status: fallbackStillPresent ? "FAIL" : "PASS",
      targetType: "code_guard",
      targetName: `${guard.targetName}:fallback_transitional_debt`,
      expected: `${guard.fallbackToken} removed`,
      actual: readError ? `READ_ERROR:${readError}` : fallbackStillPresent ? "fallback_present" : "fallback_removed",
      details: readError
        ? `Unable to verify DRACO_DB fallback removal in ${guard.fallbackFilePath}.`
        : fallbackStillPresent
          ? `Fallback to DRACO_DB is still present in ${guard.fallbackFilePath}.`
          : `DRACO_DB fallback token is no longer present in ${guard.fallbackFilePath}.`,
    },
  ];
}

async function buildMentoriaBoundaryLeakageChecks(guard: MentoriaBindingGuard): Promise<CheckRecord[]> {
  const checks: CheckRecord[] = [];
  const forbiddenImportTokens = guard.forbiddenImportTokens ?? [];
  const productSourcePaths = guard.productSourcePaths ?? [];
  const offendingImports: string[] = [];

  for (const relativeDir of productSourcePaths) {
    const files = await listTypeScriptFilesRecursively(relativeDir);
    for (const filePath of files) {
      const content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
      for (const token of forbiddenImportTokens) {
        if (content.includes(token)) {
          offendingImports.push(`${filePath} imports ${token}`);
        }
      }
    }
  }

  checks.push({
    checkCode: "mentoriaGlobalDbImportLeakage",
    severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
    status: offendingImports.length === 0 ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:global_db_import_leakage`,
    expected: "Mentoria product code does not import global DB helpers",
    actual: offendingImports.length === 0 ? "no_forbidden_imports" : offendingImports,
    details:
      offendingImports.length === 0
        ? "Mentoria product code is isolated from @/lib/db."
        : "Mentoria product code still imports a global DB helper.",
  });

  const forbiddenWorkerBindings = guard.forbiddenWorkerBindings ?? [];
  const workerConfigPath = guard.workerConfigPath;
  let workerBindingLeakage: string[] = [];
  let workerReadError: string | null = null;

  if (workerConfigPath) {
    try {
      const content = await fs.readFile(resolveAbsolutePath(workerConfigPath), "utf8");
      const records = parseD1BindingsFromContent(content, workerConfigPath);
      workerBindingLeakage = records
        .filter((record) => forbiddenWorkerBindings.includes(record.binding))
        .map((record) => `${record.binding} present in ${record.filePath} (${record.section})`);
    } catch (error) {
      workerReadError = error instanceof Error ? error.message : String(error);
    }
  }

  checks.push({
    checkCode: "mentoriaWorkerBindingLeakage",
    severity: MENTORIA_GUARD_BLOCKER_SEVERITY,
    status: workerReadError ? "FAIL" : workerBindingLeakage.length === 0 ? "PASS" : "FAIL",
    targetType: "code_guard",
    targetName: `${guard.targetName}:worker_binding_leakage`,
    expected: "Mentoria worker binds only MENTORIA_DB + MENTORIAS_AUTHS_DB for D1",
    actual: workerReadError ? `READ_ERROR:${workerReadError}` : workerBindingLeakage.length === 0 ? "no_forbidden_bindings" : workerBindingLeakage,
    details: workerReadError
      ? `Unable to verify worker bindings in ${workerConfigPath}.`
      : workerBindingLeakage.length === 0
        ? "Mentoria worker D1 bindings are limited to product/auth surfaces."
        : "Mentoria worker still exposes forbidden D1 bindings.",
  });

  return checks;
}

async function buildSourceBoundaryChecks(
  guard: SourceBoundaryGuard,
  checkCode: "socialflowCrossSaasLeakage" | "operatorFinalUserApiLeakage",
  detailsWhenPass: string,
  detailsWhenFail: string,
): Promise<CheckRecord[]> {
  const offendingTokens: string[] = [];

  for (const sourcePath of guard.sourcePaths) {
    const files = await listTypeScriptSources(sourcePath);
    for (const filePath of files) {
      const content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
      for (const token of guard.forbiddenTokens) {
        if (content.includes(token)) {
          offendingTokens.push(`${filePath} contains ${token}`);
        }
      }
    }
  }

  return [
    {
      checkCode,
      severity: "BLOCKER",
      status: offendingTokens.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: `no forbidden tokens [${guard.forbiddenTokens.join(", ")}]`,
      actual: offendingTokens.length === 0 ? "no_forbidden_tokens" : offendingTokens,
      details: offendingTokens.length === 0 ? detailsWhenPass : detailsWhenFail,
    },
  ];
}

async function buildLegacyCompatRouteChecks(guard: CompatRouteGuard): Promise<CheckRecord[]> {
  const offendingRoutes: string[] = [];

  for (const routeDir of guard.routeDirs) {
    const files = await listTypeScriptFilesRecursively(routeDir);
    for (const filePath of files) {
      const content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
      const hasRequiredBridge = guard.requiredAnyTokens.some((token) => content.includes(token));
      const presentForbidden = guard.forbiddenTokens.filter((token) => content.includes(token));

      if (!hasRequiredBridge || presentForbidden.length > 0) {
        offendingRoutes.push(
          `${filePath} bridge=${hasRequiredBridge ? "ok" : "missing"} forbidden=[${presentForbidden.join(", ") || "none"}]`,
        );
      }
    }
  }

  return [
    {
      checkCode: "legacyCompatRouteDrift",
      severity: "BLOCKER",
      status: offendingRoutes.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: "owner/campobase compat routes stay pinned to control-plane bridges",
      actual: offendingRoutes.length === 0 ? "control_plane_compat" : offendingRoutes,
      details:
        offendingRoutes.length === 0
          ? "Legacy owner/campobase routes remain explicit control-plane compatibility bridges."
          : "A legacy owner/campobase route drifted away from the control-plane compatibility contract.",
    },
  ];
}

function normalizeRelativeFileList(paths: string[]): string[] {
  return Array.from(new Set(paths.map((filePath) => filePath.replace(/\\/g, "/")))).sort();
}

async function buildLegacyCompatInventoryChecks(guard: LegacyCompatInventoryGuard): Promise<CheckRecord[]> {
  const actualApiCompatPaths = normalizeRelativeFileList(
    (
      await Promise.all(guard.apiCompatDirs.map((relativeDir) => listTypeScriptFilesRecursively(relativeDir)))
    ).flat(),
  );
  const expectedApiCompatPaths = normalizeRelativeFileList(guard.expectedApiCompatPaths);

  const actualCompatSurfacePaths = normalizeRelativeFileList(
    (
      await Promise.all(guard.compatSurfaceDirs.map((relativeDir) => listTypeScriptFilesRecursively(relativeDir)))
    ).flat(),
  );
  const expectedCompatSurfacePaths = normalizeRelativeFileList(guard.expectedCompatSurfacePaths);

  const missingApiCompatPaths = expectedApiCompatPaths.filter((filePath) => !actualApiCompatPaths.includes(filePath));
  const extraApiCompatPaths = actualApiCompatPaths.filter((filePath) => !expectedApiCompatPaths.includes(filePath));
  const missingCompatSurfacePaths = expectedCompatSurfacePaths.filter((filePath) => !actualCompatSurfacePaths.includes(filePath));
  const extraCompatSurfacePaths = actualCompatSurfacePaths.filter((filePath) => !expectedCompatSurfacePaths.includes(filePath));

  const redirectRuleFailures: string[] = [];
  for (const rule of guard.redirectPageRules) {
    let content = "";
    try {
      content = await fs.readFile(resolveAbsolutePath(rule.filePath), "utf8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      redirectRuleFailures.push(`${rule.filePath} read_error=${reason}`);
      continue;
    }

    for (const token of rule.requiredTokens ?? []) {
      if (!content.includes(token)) {
        redirectRuleFailures.push(`${rule.filePath} missing ${token}`);
      }
    }

    for (const token of rule.forbiddenTokens ?? []) {
      if (content.includes(token)) {
        redirectRuleFailures.push(`${rule.filePath} contains forbidden ${token}`);
      }
    }
  }

  const forbiddenCompatSurfaceHits: string[] = [];
  for (const filePath of actualCompatSurfacePaths) {
    const content = await fs.readFile(resolveAbsolutePath(filePath), "utf8");
    for (const token of guard.forbiddenCompatSurfaceTokens) {
      if (content.includes(token)) {
        forbiddenCompatSurfaceHits.push(`${filePath} contains ${token}`);
      }
    }
  }

  const failures = [
    ...missingApiCompatPaths.map((filePath) => `missing api compat path ${filePath}`),
    ...extraApiCompatPaths.map((filePath) => `unexpected api compat path ${filePath}`),
    ...missingCompatSurfacePaths.map((filePath) => `missing compat surface ${filePath}`),
    ...extraCompatSurfacePaths.map((filePath) => `unexpected compat surface ${filePath}`),
    ...redirectRuleFailures,
    ...forbiddenCompatSurfaceHits,
  ];

  return [
    {
      checkCode: "legacyCompatInventoryDrift",
      severity: "BLOCKER",
      status: failures.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: {
        apiCompatPaths: expectedApiCompatPaths,
        compatSurfacePaths: expectedCompatSurfacePaths,
      },
      actual:
        failures.length === 0
          ? {
              apiCompatPaths: actualApiCompatPaths,
              compatSurfacePaths: actualCompatSurfacePaths,
            }
          : failures,
      details:
        failures.length === 0
          ? "Legacy compat inventory stays fixed, redirects remain active, and compat UI stays control-plane-only."
          : "Legacy compat inventory drifted or a compat surface stopped behaving as a controlled bridge.",
    },
  ];
}

async function buildFileTokenGuardChecks(
  guard: FileTokenGuard,
  checkCode:
    | "socialflowRuntimeGuardDrift"
    | "mentoriaRuntimeGuardDrift"
    | "mentoriaStrictSmokeGuardDrift"
    | "legacyCompatTelemetryGuardMissing"
    | "drakosPreparedArtifactGuardDrift"
    | "basesPreparedArtifactGuardDrift"
    | "mentoriaAuthsOperationalDrift",
  passDetails: string,
  failDetails: string,
): Promise<CheckRecord[]> {
  const failures: string[] = [];

  for (const rule of guard.rules) {
    let content = "";
    try {
      content = await fs.readFile(resolveAbsolutePath(rule.filePath), "utf8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${rule.filePath} read_error=${reason}`);
      continue;
    }

    for (const token of rule.requiredTokens ?? []) {
      if (!content.includes(token)) {
        failures.push(`${rule.filePath} missing ${token}`);
      }
    }

    for (const token of rule.forbiddenTokens ?? []) {
      if (content.includes(token)) {
        failures.push(`${rule.filePath} contains forbidden ${token}`);
      }
    }
  }

  return [
    {
      checkCode,
      severity: "BLOCKER",
      status: failures.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: "all runtime guard rules satisfied",
      actual: failures.length === 0 ? "runtime_guard_ok" : failures,
      details: failures.length === 0 ? passDetails : failDetails,
    },
  ];
}

async function buildArtifactMatrixSkeletonChecks(guard: ArtifactMatrixSkeletonGuard): Promise<CheckRecord[]> {
  const failures: string[] = [];
  let manifest:
    | {
        state?: string;
        deployMode?: string;
        activeArtifact?: { artifactName?: string };
        dedicatedArtifacts?: Array<{ key?: string; artifactName?: string; workerPath?: string; assetsPath?: string }>;
        preparedArtifacts?: Array<{ key?: string; state?: string; artifactName?: string; workerPath?: string; assetsPath?: string }>;
        products?: ArtifactMatrixProduct[];
      }
    | null = null;

  try {
    manifest = JSON.parse(await fs.readFile(resolveAbsolutePath(guard.manifestPath), "utf8")) as {
      state?: string;
      deployMode?: string;
      activeArtifact?: { artifactName?: string };
      products?: ArtifactMatrixProduct[];
      preparedArtifacts?: Array<{ key?: string; state?: string; artifactName?: string; workerPath?: string; assetsPath?: string }>;
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    failures.push(`${guard.manifestPath} read_error=${reason}`);
  }

  if (manifest) {
    if (manifest.state !== guard.expectedState) {
      failures.push(`${guard.manifestPath} state expected ${guard.expectedState} got ${String(manifest.state)}`);
    }
    if (manifest.deployMode !== guard.expectedDeployMode) {
      failures.push(`${guard.manifestPath} deployMode expected ${guard.expectedDeployMode} got ${String(manifest.deployMode)}`);
    }
    if (manifest.activeArtifact?.artifactName !== guard.expectedActiveArtifactName) {
      failures.push(
        `${guard.manifestPath} active artifact expected ${guard.expectedActiveArtifactName} got ${String(manifest.activeArtifact?.artifactName)}`,
      );
    }
    const expectedDedicatedArtifacts = guard.expectedDedicatedArtifacts ?? [];
    const manifestDedicatedArtifacts = manifest.dedicatedArtifacts ?? [];
    for (const expectedDedicatedArtifact of expectedDedicatedArtifacts) {
      const actualDedicatedArtifact = manifestDedicatedArtifacts.find((artifact) => artifact.key === expectedDedicatedArtifact.key);
      if (!actualDedicatedArtifact) {
        failures.push(`${guard.manifestPath} missing dedicated artifact ${expectedDedicatedArtifact.key}`);
        continue;
      }
      for (const [field, expectedValue] of Object.entries(expectedDedicatedArtifact)) {
        if ((actualDedicatedArtifact as Record<string, unknown>)[field] !== expectedValue) {
          failures.push(
            `${guard.manifestPath} dedicated artifact ${expectedDedicatedArtifact.key} field ${field} expected ${expectedValue} got ${String(
              (actualDedicatedArtifact as Record<string, unknown>)[field],
            )}`,
          );
        }
      }
    }
    for (const actualDedicatedArtifact of manifestDedicatedArtifacts) {
      if (!expectedDedicatedArtifacts.some((artifact) => artifact.key === actualDedicatedArtifact.key)) {
        failures.push(`${guard.manifestPath} unexpected dedicated artifact ${String(actualDedicatedArtifact.key)}`);
      }
    }
    const expectedPreparedArtifacts = guard.expectedPreparedArtifacts ?? [];
    const manifestPreparedArtifacts = manifest.preparedArtifacts ?? [];
    for (const expectedPreparedArtifact of expectedPreparedArtifacts) {
      const actualPreparedArtifact = manifestPreparedArtifacts.find((artifact) => artifact.key === expectedPreparedArtifact.key);
      if (!actualPreparedArtifact) {
        failures.push(`${guard.manifestPath} missing prepared artifact ${expectedPreparedArtifact.key}`);
        continue;
      }
      for (const [field, expectedValue] of Object.entries(expectedPreparedArtifact)) {
        if ((actualPreparedArtifact as Record<string, unknown>)[field] !== expectedValue) {
          failures.push(
            `${guard.manifestPath} prepared artifact ${expectedPreparedArtifact.key} field ${field} expected ${expectedValue} got ${String(
              (actualPreparedArtifact as Record<string, unknown>)[field],
            )}`,
          );
        }
      }
    }
    for (const actualPreparedArtifact of manifestPreparedArtifacts) {
      if (!expectedPreparedArtifacts.some((artifact) => artifact.key === actualPreparedArtifact.key)) {
        failures.push(`${guard.manifestPath} unexpected prepared artifact ${String(actualPreparedArtifact.key)}`);
      }
    }

    const manifestProducts = new Map((manifest.products ?? []).map((product) => [product.key, product]));
    for (const expectedProduct of guard.expectedProducts) {
      const actualProduct = manifestProducts.get(expectedProduct.key);
      if (!actualProduct) {
        failures.push(`${guard.manifestPath} missing product ${expectedProduct.key}`);
        continue;
      }

      for (const [field, expectedValue] of Object.entries(expectedProduct)) {
        if ((actualProduct as Record<string, unknown>)[field] !== expectedValue) {
          failures.push(
            `${guard.manifestPath} product ${expectedProduct.key} field ${field} expected ${expectedValue} got ${String(
              (actualProduct as Record<string, unknown>)[field],
            )}`,
          );
        }
      }
    }

    const manifestProductKeys = new Set((manifest.products ?? []).map((product) => product.key));
    for (const productKey of manifestProductKeys) {
      if (!guard.expectedProducts.some((product) => product.key === productKey)) {
        failures.push(`${guard.manifestPath} unexpected product ${productKey}`);
      }
    }
  }

  for (const token of guard.workflowRequiredTokens) {
    const workflowContent = await fs.readFile(resolveAbsolutePath(guard.workflowPath), "utf8");
    if (!workflowContent.includes(token)) {
      failures.push(`${guard.workflowPath} missing ${token}`);
    }
  }

  const buildScriptContent = await fs.readFile(resolveAbsolutePath(guard.buildScriptPath), "utf8");
  for (const token of guard.buildScriptRequiredTokens) {
    if (!buildScriptContent.includes(token)) {
      failures.push(`${guard.buildScriptPath} missing ${token}`);
    }
  }

  return [
    {
      checkCode: "artifactMatrixSkeletonDrift",
      severity: "BLOCKER",
      status: failures.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: {
        state: guard.expectedState,
        deployMode: guard.expectedDeployMode,
        activeArtifactName: guard.expectedActiveArtifactName,
        products: guard.expectedProducts.map((product) => product.key),
      },
      actual: failures.length === 0 ? "artifact_matrix_skeleton_ok" : failures,
      details:
        failures.length === 0
          ? "Artifact matrix skeleton stays documented, CI keeps generating metadata, and the active deploy artifact remains global while approved dedicated wrappers stay explicit."
          : "Artifact matrix skeleton drifted, lost its shared source of truth, or CI stopped advertising the planned per-product split safely.",
    },
  ];
}

async function buildArtifactMatrixPrematureActivationChecks(
  guard: ArtifactMatrixPrematureActivationGuard,
): Promise<CheckRecord[]> {
  const failures: string[] = [];
  const workflowContent = await fs.readFile(resolveAbsolutePath(guard.workflowPath), "utf8");

  for (const token of guard.forbiddenWorkflowTokens) {
    if (workflowContent.includes(token)) {
      failures.push(`${guard.workflowPath} contains forbidden ${token}`);
    }
  }

  for (const product of guard.products) {
    const workerConfigContent = await fs.readFile(resolveAbsolutePath(product.wranglerConfigPath), "utf8");
    const dedicatedAllowed = (guard.allowedDedicatedProducts ?? []).includes(product.key);
    if (!workerConfigContent.includes(`main = "${product.currentWranglerMain}"`)) {
      failures.push(`${product.wranglerConfigPath} no longer points to ${product.currentWranglerMain}`);
    }
    if (!workerConfigContent.includes(`directory = "${product.currentWranglerAssetsDirectory}"`)) {
      failures.push(`${product.wranglerConfigPath} no longer points assets to ${product.currentWranglerAssetsDirectory}`);
    }
    if (!dedicatedAllowed) {
      if (workerConfigContent.includes(product.plannedWorkerPath)) {
        failures.push(`${product.wranglerConfigPath} points to planned artifact ${product.plannedWorkerPath}`);
      }
      if (workerConfigContent.includes(product.plannedAssetsPath)) {
        failures.push(`${product.wranglerConfigPath} points assets to planned artifact ${product.plannedAssetsPath}`);
      }
    }
  }

  return [
    {
      checkCode: "artifactSplitPrematureActivation",
      severity: "BLOCKER",
      status: failures.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: "only approved products use dedicated wrapper artifacts while the global deploy artifact remains open-next-build",
      actual: failures.length === 0 ? "artifact_split_inactive" : failures,
      details:
        failures.length === 0
          ? "Only SocialFlow and Mentoria are allowed to run on dedicated wrapper artifacts while Drako and Bases remain on the global OpenNext bundle."
          : "A worker or workflow started acting as if per-product artifacts were active outside the allowed SocialFlow and Mentoria splits.",
    },
  ];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseExpectedStatusesForPath(scriptContent: string, routePath: string): number[] | null {
  const escapedPath = escapeRegExp(routePath);
  const blockPattern = new RegExp(
    `path:\\s*"${escapedPath}"[\\s\\S]*?expectedStatuses:\\s*\\[([^\\]]+)\\]`,
    "m",
  );
  const match = scriptContent.match(blockPattern);
  if (!match) {
    return null;
  }

  return match[1]
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));
}

async function buildSocialflowSmokeGuardChecks(guard: SocialflowSmokeGuard): Promise<CheckRecord[]> {
  let content = "";
  try {
    content = await fs.readFile(resolveAbsolutePath(guard.scriptPath), "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return [
      {
        checkCode: "socialflowCanonicalSmokeGuardDrift",
        severity: "BLOCKER",
        status: "FAIL",
        targetType: "code_guard",
        targetName: guard.targetName,
        expected: `readable smoke script at ${guard.scriptPath}`,
        actual: `READ_ERROR:${reason}`,
        details: "Unable to verify the canonical SocialFlow smoke script.",
      },
    ];
  }

  const violations: string[] = [];

  for (const token of guard.placeholderGuardTokens) {
    if (!content.includes(token)) {
      violations.push(`missing placeholder guard token ${token}`);
    }
  }

  for (const routePath of guard.canonicalApiPaths) {
    const statuses = parseExpectedStatusesForPath(content, routePath);
    if (!statuses) {
      violations.push(`missing canonical API check for ${routePath}`);
      continue;
    }
    if (statuses.includes(405)) {
      violations.push(`canonical API ${routePath} accepts 405`);
    }
  }

  for (const routePath of guard.legacyGonePaths) {
    const statuses = parseExpectedStatusesForPath(content, routePath);
    if (!statuses) {
      violations.push(`missing legacy gone check for ${routePath}`);
      continue;
    }
    if (statuses.length !== 1 || statuses[0] !== 410) {
      violations.push(`legacy route ${routePath} is not pinned to 410`);
    }
  }

  return [
    {
      checkCode: "socialflowCanonicalSmokeGuardDrift",
      severity: "BLOCKER",
      status: violations.length === 0 ? "PASS" : "FAIL",
      targetType: "code_guard",
      targetName: guard.targetName,
      expected: "strict canonical smoke with 410 legacy routes and no canonical 405 acceptance",
      actual: violations.length === 0 ? "strict_smoke_ok" : violations,
      details:
        violations.length === 0
          ? "The canonical SocialFlow smoke script stays strict against placeholder HTML, canonical 405s and legacy route drift."
          : "The canonical SocialFlow smoke script became permissive or lost required checks.",
    },
  ];
}

function buildReport(params: {
  mode: "real" | "fixtures";
  sourceOfTruthPath: string;
  fixturesDir: string | null;
  snapshots: ProductionReadinessReport["snapshots"];
  checks: CheckRecord[];
}): ProductionReadinessReport {
  const violations: ViolationRecord[] = params.checks
    .filter((item) => item.status === "FAIL")
    .map((item) => ({
      checkCode: item.checkCode,
      severity: item.severity,
      targetType: item.targetType,
      targetName: item.targetName,
      expected: item.expected,
      actual: item.actual,
      details: item.details,
    }));

  const blockersTotal = violations.filter((item) => item.severity === "BLOCKER").length;
  const warningsTotal = violations.filter((item) => item.severity === "WARN").length;
  const checksPass = params.checks.filter((item) => item.status === "PASS").length;
  const checksFail = params.checks.filter((item) => item.status === "FAIL").length;
  const checksNa = params.checks.filter((item) => item.status === "N/A").length;

  return {
    timestamp: new Date().toISOString(),
    mode: params.mode,
    sourceOfTruthPath: params.sourceOfTruthPath,
    fixturesDir: params.fixturesDir,
    productionReady: blockersTotal === 0,
    summary: {
      checksTotal: params.checks.length,
      checksPass,
      checksFail,
      checksNa,
      violationsTotal: violations.length,
      blockersTotal,
      warningsTotal,
    },
    checks: params.checks,
    violations,
    snapshots: params.snapshots,
  };
}

function buildMarkdownReport(report: ProductionReadinessReport): string {
  const lines: string[] = [];
  lines.push("# Production Readiness Audit Report");
  lines.push("");
  lines.push(`- Timestamp: \`${report.timestamp}\``);
  lines.push(`- Mode: \`${report.mode}\``);
  lines.push(`- Source of truth: \`${report.sourceOfTruthPath}\``);
  lines.push(`- Fixtures dir: \`${report.fixturesDir ?? "n/a"}\``);
  lines.push(`- Production ready: \`${report.productionReady}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Checks total: ${report.summary.checksTotal}`);
  lines.push(`- Checks pass: ${report.summary.checksPass}`);
  lines.push(`- Checks fail: ${report.summary.checksFail}`);
  lines.push(`- Checks N/A: ${report.summary.checksNa}`);
  lines.push(`- Blockers: ${report.summary.blockersTotal}`);
  lines.push(`- Warnings: ${report.summary.warningsTotal}`);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push("| Check | Severity | Target | Status | Expected | Actual |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const check of report.checks) {
    lines.push(
      `| ${check.checkCode} | ${check.severity} | ${check.targetName} | ${check.status} | ${JSON.stringify(check.expected)} | ${JSON.stringify(check.actual)} |`,
    );
  }
  lines.push("");
  lines.push("## Violations");
  lines.push("");
  if (report.violations.length === 0) {
    lines.push("- None");
  } else {
    for (const violation of report.violations) {
      lines.push(
        `- ${violation.severity} ${violation.checkCode} @ ${violation.targetName}: expected=${JSON.stringify(violation.expected)} actual=${JSON.stringify(violation.actual)}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

async function writeReports(report: ProductionReadinessReport, reportJsonPath: string, reportMarkdownPath: string): Promise<void> {
  await writeFileSafe(resolveAbsolutePath(reportJsonPath), `${JSON.stringify(report, null, 2)}\n`);
  await writeFileSafe(resolveAbsolutePath(reportMarkdownPath), buildMarkdownReport(report));
}

function printViolations(report: ProductionReadinessReport): void {
  for (const violation of report.violations.filter((item) => item.severity === "BLOCKER")) {
    console.error(`PRODUCTION BLOCKER DETECTED: ${violation.checkCode}`);
    console.error(`TARGET: ${violation.targetName}`);
    console.error(`EXPECTED: ${JSON.stringify(violation.expected)}`);
    console.error(`ACTUAL: ${JSON.stringify(violation.actual)}`);
  }
  for (const violation of report.violations.filter((item) => item.severity === "WARN")) {
    console.warn(
      `PRODUCTION WARNING: ${violation.checkCode} @ ${violation.targetName} expected=${JSON.stringify(violation.expected)} actual=${JSON.stringify(violation.actual)}`,
    );
  }
}

export async function runProductionReadinessAudits(
  options: ProductionAuditsRunOptions = {},
): Promise<{ exitCode: number; report: ProductionReadinessReport }> {
  const sourceOfTruthPath = options.sourceOfTruthPath ?? DEFAULT_SOURCE_OF_TRUTH_PATH;
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? "";
  const mode: "real" | "fixtures" = fixturesDir ? "fixtures" : "real";
  const writeReportsEnabled = options.writeReports ?? true;
  const reportJsonPath = options.reportJsonPath ?? DEFAULT_REPORT_JSON_PATH;
  const reportMarkdownPath = options.reportMarkdownPath ?? DEFAULT_REPORT_MARKDOWN_PATH;

  const config = await readJsonFile<ProductionAuditsExpectedState>(resolveAbsolutePath(sourceOfTruthPath));
  validateConfig(config);

  const snapshots =
    mode === "fixtures" ? await collectFixturesSnapshots(fixturesDir) : await collectRealSnapshots(config);
  const checks = buildChecks(config, snapshots);
  const legacyGuards = options.legacyGuardsOverride ?? DEFAULT_LEGACY_PRODUCTION_GUARDS;
  const legacyGuardChecks = await buildLegacyProductionGuardChecks(legacyGuards);
  checks.push(...legacyGuardChecks);
  const legacyAuthDbFallbackFlagGuard =
    options.legacyAuthDbFallbackFlagGuardOverride ?? DEFAULT_LEGACY_AUTH_DB_FALLBACK_FLAG_GUARD;
  const legacyAuthDbFallbackFlagChecks = await buildLegacyAuthDbFallbackFlagChecks(legacyAuthDbFallbackFlagGuard);
  checks.push(...legacyAuthDbFallbackFlagChecks);
  const deployablePlaceholderDatabaseIdGuard =
    options.deployablePlaceholderDatabaseIdGuardOverride ?? DEFAULT_DEPLOYABLE_PLACEHOLDER_DATABASE_ID_GUARD;
  const deployablePlaceholderDatabaseIdChecks = await buildDeployablePlaceholderDatabaseIdChecks(
    deployablePlaceholderDatabaseIdGuard,
  );
  checks.push(...deployablePlaceholderDatabaseIdChecks);
  const socialflowAuthsGuard = options.socialflowAuthsGuardOverride ?? DEFAULT_SOCIALFLOW_AUTHS_BINDING_GUARD;
  const socialflowAuthsChecks = await buildSocialflowAuthsBindingGuardChecks(socialflowAuthsGuard);
  checks.push(...socialflowAuthsChecks);
  const mentoriaAuthsGuard = options.mentoriaAuthsGuardOverride ?? DEFAULT_MENTORIA_AUTHS_BINDING_GUARD;
  const mentoriaAuthsChecks = await buildMentoriaAuthsBindingGuardChecks(mentoriaAuthsGuard);
  checks.push(...mentoriaAuthsChecks);
  const socialflowDomainGuard = resolveSocialflowDomainGuard(config, options.socialflowDomainGuardOverride);
  const socialflowDomainChecks = await buildSocialflowDomainGuardChecks(socialflowDomainGuard, snapshots);
  checks.push(...socialflowDomainChecks);
  const mentoriaBindingGuard = options.mentoriaBindingGuardOverride ?? DEFAULT_MENTORIA_BINDING_GUARD;
  const mentoriaBindingChecks = await buildMentoriaBindingGuardChecks(mentoriaBindingGuard);
  checks.push(...mentoriaBindingChecks);
  const mentoriaFallbackDebtChecks = await buildMentoriaFallbackDebtChecks(mentoriaBindingGuard);
  checks.push(...mentoriaFallbackDebtChecks);
  const mentoriaBoundaryLeakageChecks = await buildMentoriaBoundaryLeakageChecks(mentoriaBindingGuard);
  checks.push(...mentoriaBoundaryLeakageChecks);
  const socialflowBoundaryGuard = options.socialflowBoundaryGuardOverride ?? DEFAULT_SOCIALFLOW_BOUNDARY_GUARD;
  const socialflowBoundaryChecks = await buildSourceBoundaryChecks(
    socialflowBoundaryGuard,
    "socialflowCrossSaasLeakage",
    "SocialFlow sources stay isolated from Mentoría, Campamento Base and operator surfaces.",
    "SocialFlow source still crosses into another product or control-plane surface.",
  );
  checks.push(...socialflowBoundaryChecks);
  const operatorBoundaryGuard = options.operatorBoundaryGuardOverride ?? DEFAULT_OPERATOR_BOUNDARY_GUARD;
  const operatorBoundaryChecks = await buildSourceBoundaryChecks(
    operatorBoundaryGuard,
    "operatorFinalUserApiLeakage",
    "Operator and Campamento Base sources do not call final-user product APIs directly.",
    "Operator or Campamento Base source still calls a final-user product API or imports product UI directly.",
  );
  checks.push(...operatorBoundaryChecks);
  const legacyCompatRouteGuard = options.legacyCompatRouteGuardOverride ?? DEFAULT_LEGACY_COMPAT_ROUTE_GUARD;
  const legacyCompatRouteChecks = await buildLegacyCompatRouteChecks(legacyCompatRouteGuard);
  checks.push(...legacyCompatRouteChecks);
  const legacyCompatInventoryGuard =
    options.legacyCompatInventoryGuardOverride ?? DEFAULT_LEGACY_COMPAT_INVENTORY_GUARD;
  const legacyCompatInventoryChecks = await buildLegacyCompatInventoryChecks(legacyCompatInventoryGuard);
  checks.push(...legacyCompatInventoryChecks);
  const legacyCompatTelemetryGuard =
    options.legacyCompatTelemetryGuardOverride ?? DEFAULT_LEGACY_COMPAT_TELEMETRY_GUARD;
  const legacyCompatTelemetryChecks = await buildFileTokenGuardChecks(
    legacyCompatTelemetryGuard,
    "legacyCompatTelemetryGuardMissing",
    "Legacy compat telemetry markers and sunset headers remain wired in middleware.",
    "Legacy compat telemetry or sunset headers drifted out of middleware.",
  );
  checks.push(...legacyCompatTelemetryChecks);
  const artifactMatrixSkeletonGuard =
    options.artifactMatrixSkeletonGuardOverride ?? DEFAULT_ARTIFACT_MATRIX_SKELETON_GUARD;
  const artifactMatrixSkeletonChecks = await buildArtifactMatrixSkeletonChecks(artifactMatrixSkeletonGuard);
  checks.push(...artifactMatrixSkeletonChecks);
  const artifactMatrixPrematureActivationGuard =
    options.artifactMatrixPrematureActivationGuardOverride ?? DEFAULT_ARTIFACT_MATRIX_PREMATURE_ACTIVATION_GUARD;
  const artifactMatrixPrematureActivationChecks = await buildArtifactMatrixPrematureActivationChecks(
    artifactMatrixPrematureActivationGuard,
  );
  checks.push(...artifactMatrixPrematureActivationChecks);
  const drakosPreparedArtifactGuard =
    options.drakosPreparedArtifactGuardOverride ?? DEFAULT_DRAKOS_PREPARED_ARTIFACT_GUARD;
  const drakosPreparedArtifactChecks = await buildFileTokenGuardChecks(
    drakosPreparedArtifactGuard,
    "drakosPreparedArtifactGuardDrift",
    "Drako has a generated prepared wrapper artifact while its worker deploy remains pinned to the global OpenNext artifact.",
    "Drako prepared artifact wiring drifted toward activation, a fake wrapper, or a standalone deploy artifact.",
  );
  checks.push(...drakosPreparedArtifactChecks);
  const basesPreparedArtifactGuard =
    options.basesPreparedArtifactGuardOverride ?? DEFAULT_BASES_PREPARED_ARTIFACT_GUARD;
  const basesPreparedArtifactChecks = await buildFileTokenGuardChecks(
    basesPreparedArtifactGuard,
    "basesPreparedArtifactGuardDrift",
    "Bases has a generated prepared wrapper artifact while its worker deploy remains pinned to the global OpenNext artifact.",
    "Bases prepared artifact wiring drifted toward activation, a fake wrapper, or a standalone deploy artifact.",
  );
  checks.push(...basesPreparedArtifactChecks);
  const socialflowRuntimeGuard = options.socialflowRuntimeGuardOverride ?? DEFAULT_SOCIALFLOW_RUNTIME_GUARD;
  const socialflowRuntimeChecks = await buildFileTokenGuardChecks(
    socialflowRuntimeGuard,
    "socialflowRuntimeGuardDrift",
    "SocialFlow stays wired to the real OpenNext runtime and its legacy fallback remains fail-closed.",
    "SocialFlow runtime wiring drifted toward a fake handler, placeholder runtime or shared handler routing.",
  );
  checks.push(...socialflowRuntimeChecks);
  const mentoriaRuntimeGuard = options.mentoriaRuntimeGuardOverride ?? DEFAULT_MENTORIA_RUNTIME_GUARD;
  const mentoriaRuntimeChecks = await buildFileTokenGuardChecks(
    mentoriaRuntimeGuard,
    "mentoriaRuntimeGuardDrift",
    "Mentoría runs through its dedicated transparent OpenNext wrapper artifact without fake worker fallbacks.",
    "Mentoría runtime wiring drifted toward the global wrangler entrypoint, a fake handler or an unverified dedicated artifact.",
  );
  checks.push(...mentoriaRuntimeChecks);
  const socialflowSmokeGuard = options.socialflowSmokeGuardOverride ?? DEFAULT_SOCIALFLOW_SMOKE_GUARD;
  const socialflowSmokeChecks = await buildSocialflowSmokeGuardChecks(socialflowSmokeGuard);
  checks.push(...socialflowSmokeChecks);
  const mentoriaSmokeGuard = options.mentoriaSmokeGuardOverride ?? DEFAULT_MENTORIA_SMOKE_GUARD;
  const mentoriaSmokeChecks = await buildFileTokenGuardChecks(
    mentoriaSmokeGuard,
    "mentoriaStrictSmokeGuardDrift",
    "Mentoría local QA keeps exercising landing, auth, onboarding, workspace and product API routes without accepting 405 or dummy responses.",
    "Mentoría local QA became permissive, lost canonical route coverage, or stopped rejecting dummy responses.",
  );
  checks.push(...mentoriaSmokeChecks);
  const mentoriaAuthsOperationalGuard =
    options.mentoriaAuthsOperationalGuardOverride ?? DEFAULT_MENTORIA_AUTHS_OPERATIONAL_GUARD;
  const mentoriaAuthsOperationalChecks = await buildFileTokenGuardChecks(
    mentoriaAuthsOperationalGuard,
    "mentoriaAuthsOperationalDrift",
    "Mentoría auth provisioning, CI migration steps and local tooling stay aligned to dedicated auth/product bindings.",
    "Mentoría auth provisioning, CI migration steps or local tooling drifted back toward shared or ambiguous DB assumptions.",
  );
  checks.push(...mentoriaAuthsOperationalChecks);
  const report = buildReport({
    mode,
    sourceOfTruthPath,
    fixturesDir: mode === "fixtures" ? fixturesDir : null,
    snapshots,
    checks,
  });

  if (writeReportsEnabled) {
    await writeReports(report, reportJsonPath, reportMarkdownPath);
  }

  printViolations(report);
  if (!report.productionReady) {
    return { exitCode: 1, report };
  }

  console.log("Production readiness state consistent");
  return { exitCode: 0, report };
}

async function executeCli(): Promise<void> {
  try {
    const result = await runProductionReadinessAudits();
    process.exit(result.exitCode);
  } catch (error) {
    const report: ProductionReadinessReport = {
      timestamp: new Date().toISOString(),
      mode: process.env.FIXTURES_DIR ? "fixtures" : "real",
      sourceOfTruthPath: DEFAULT_SOURCE_OF_TRUTH_PATH,
      fixturesDir: process.env.FIXTURES_DIR ?? null,
      productionReady: false,
      summary: {
        checksTotal: 1,
        checksPass: 0,
        checksFail: 1,
        checksNa: 0,
        violationsTotal: 1,
        blockersTotal: 1,
        warningsTotal: 0,
      },
      checks: [
        {
          checkCode: "criticalWorkerMissing",
          severity: "BLOCKER",
          status: "FAIL",
          targetType: "worker",
          targetName: "global",
          expected: "successful production readiness execution",
          actual: error instanceof Error ? error.message : String(error),
          details: "Fatal error in production readiness checker execution.",
        },
      ],
      violations: [
        {
          checkCode: "criticalWorkerMissing",
          severity: "BLOCKER",
          targetType: "worker",
          targetName: "global",
          expected: "successful production readiness execution",
          actual: error instanceof Error ? error.message : String(error),
          details: "Fatal error in production readiness checker execution.",
        },
      ],
      snapshots: {
        workers: [],
        domains: [],
        routes: [],
        d1DatabaseNames: [],
        r2BucketNames: [],
        kvNamespaceNames: [],
        queueNames: [],
        durableObjectClassNames: [],
        d1TablesByDatabases: [],
      },
    };
    await writeReports(report, DEFAULT_REPORT_JSON_PATH, DEFAULT_REPORT_MARKDOWN_PATH);
    console.error("Production readiness check failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  executeCli();
}
