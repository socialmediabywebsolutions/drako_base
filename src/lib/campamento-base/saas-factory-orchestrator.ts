import { queryAll, queryOne, run } from "@/lib/db";
import type { DracoEnv } from "@/lib/cf";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import type { SaasFeatureCategory, SaasFeatureKey } from "@/lib/features/types";
import { ensureCampamentoBase } from "@/lib/campamento-base";
import { JobRunner, type ProvisioningJobState } from "@/lib/provisioning/job-runner";
import {
  computeDefaultProvisioningForBlueprint,
  prepareStripePricingFromBlueprint
} from "@/lib/campamento-base/saas-provisioning-plan";
import { normalizeCampamentoBaseProfileForBlueprint } from "@/lib/campamento-base/saas-factory-helpers";
import { ensureStripeProductForSaas, archiveStripeProductAndPrices } from "@/lib/campamento-base/provisioning/stripe-factory";
import { computeDomainsForSaas } from "@/lib/campamento-base/provisioning/cloudflare-factory";
import { createDomainBinding, deleteDomainBinding, verifyDomainBinding } from "@/lib/domains/domain-provider";
import { resolveSaasContext, upsertSaasDomain } from "@/lib/saas/repository";
import { recordCampamentoEventSafe } from "@/lib/empire/events-safe";

type ExistingProvisioningJobContext = {
  jobId: string;
  entityId: string;
  state: ProvisioningJobState;
  correlationId: string;
  idempotencyKey: string;
  payload: OrchestratorPayload;
};

type OrchestratorPayload = SaasBlueprintDraft & {
  stripeProductId?: string;
  stripePriceIds?: Record<string, string>;
  cloudflareHostnameId?: string;
  runtimeDeployment?: {
    mode: "shared_runtime";
    runtimeName: string;
    trialDomain: string;
    customDomain: string | null;
    status: "provisioning" | "active" | "degraded";
    activationReady: boolean;
    lastKnownDomainStatus: string;
  };
  bootstrapDeployment?: {
    status: "pending" | "ready" | "degraded";
    readinessMarker: "bootstrap_pending" | "bootstrap_ready" | "bootstrap_partial";
    defaultConfigId: string | null;
    featureKeys: SaasFeatureKey[];
    expectedFeatureKeys: SaasFeatureKey[];
    planTier: string;
    defaultConfigReady: boolean;
    featureBaselineReady: boolean;
    degradedReason: string | null;
  };
};

type RuntimeContractStatus = "provisioning" | "active" | "degraded";

type RuntimeDeploymentResult = {
  mode: "shared_runtime";
  runtimeName: string;
  trialDomain: string;
  customDomain: string | null;
  status: RuntimeContractStatus;
  activationReady: boolean;
  lastKnownDomainStatus: string;
};

type RuntimeActivationSnapshot = {
  saasStatus: string | null;
  saasDomainStatus: string | null;
  saasDomain: string | null;
  saasPublicDomain: string | null;
  instanceStatus: string | null;
  instanceTrialDomain: string | null;
  instanceCustomDomain: string | null;
  instanceDomainStatus: string | null;
  runtimeContractStatus: string | null;
};

type BootstrapContractStatus = "pending" | "ready" | "degraded";

type BootstrapDeploymentResult = {
  status: BootstrapContractStatus;
  readinessMarker: "bootstrap_pending" | "bootstrap_ready" | "bootstrap_partial";
  defaultConfigId: string | null;
  featureKeys: SaasFeatureKey[];
  expectedFeatureKeys: SaasFeatureKey[];
  planTier: string;
  defaultConfigReady: boolean;
  featureBaselineReady: boolean;
  degradedReason: string | null;
};

type ProvisioningContractPlan = {
  runtimeName?: string;
  routeType?: "trial_domain";
  trialDomain?: string;
  customDomain?: string | null;
  runtime?: RuntimeDeploymentResult;
  bootstrap?: BootstrapDeploymentResult;
};

type BootstrapSnapshot = {
  saasStatus: string | null;
  saasDomainStatus: string | null;
  instanceStatus: string | null;
  instanceDomainStatus: string | null;
  instancePlanTier: string | null;
  brandingSettingsId: string | null;
  enabledFeatureKeys: SaasFeatureKey[];
  runtimeContractStatus: string | null;
  runtimeActivationReady: boolean;
  bootstrapContractStatus: string | null;
  bootstrapReadinessMarker: string | null;
  bootstrapDefaultConfigId: string | null;
  bootstrapFeatureKeys: SaasFeatureKey[];
  bootstrapExpectedFeatureKeys: SaasFeatureKey[];
  bootstrapPlanTier: string | null;
  bootstrapDegradedReason: string | null;
};

type DomainVerifyRetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
  maxTotalWaitMs: number;
};

type VerifyDomainWithRetryInput = {
  hostname: string;
  bindingId?: string;
  correlationId: string;
  env?: DracoEnv | null;
  tenantId: string;
  saasId: string;
  jobId: string;
  failOnNonActive?: boolean;
};

type VerifyDomainWithRetryResult = {
  result: Awaited<ReturnType<typeof verifyDomainBinding>>;
  attempts: number;
  waitedMs: number;
  isActive: boolean;
};

const CANONICAL_RUNTIME_NAME = "shared_open_next_runtime";
const DEFAULT_BOOTSTRAP_CONFIG_ID_PREFIX = "bootstrap_branding";
const DEFAULT_BOOTSTRAP_THEME = {
  primaryColor: "#1f2937",
  secondaryColor: "#475569",
  accentColor: "#f59e0b",
  backgroundColor: "#ffffff",
  surfaceColor: "#f8fafc",
  textColor: "#111827",
  dangerColor: "#dc2626",
  successColor: "#16a34a",
  layoutDensity: "NORMAL",
  enableDarkMode: false,
} as const;
const TRIAL_BOOTSTRAP_BASELINE: SaasFeatureKey[] = [
  "BLUEPRINT",
  "APPEARANCE_BRANDING",
  "OWNER_CONTROL",
];
const BOOTSTRAP_FEATURE_METADATA: Record<SaasFeatureKey, {
  label: string;
  category: SaasFeatureCategory;
  phaseOrder: number;
}> = {
  ECONOMY: { label: "Economy Engine", category: "CORE", phaseOrder: 1 },
  HR: { label: "HR & Compliance", category: "OPERATIONS", phaseOrder: 1 },
  EMPLOYEES: { label: "Equipo & Roles", category: "OPERATIONS", phaseOrder: 1 },
  STAFF_PORTAL: { label: "Staff Portal", category: "OPERATIONS", phaseOrder: 1 },
  CLIENT_PORTAL: { label: "Client Portal", category: "MARKETING", phaseOrder: 1 },
  EMAIL_INTAKE: { label: "Email Intake", category: "MARKETING", phaseOrder: 2 },
  SOCIAL: { label: "Social Engine", category: "MARKETING", phaseOrder: 2 },
  OWNER_CONTROL: { label: "Owner Control", category: "ANALYTICS", phaseOrder: 2 },
  TASKS: { label: "Tasks & Execution", category: "OPERATIONS", phaseOrder: 3 },
  KNOWLEDGE: { label: "Knowledge Base", category: "OPERATIONS", phaseOrder: 3 },
  BLUEPRINT: { label: "Blueprint & Factory", category: "CORE", phaseOrder: 0 },
  APPEARANCE_BRANDING: { label: "Branding & Themes", category: "CORE", phaseOrder: 0 },
  TAX_ENGINE: { label: "Tax & Accounting", category: "ANALYTICS", phaseOrder: 2 },
};
const KNOWN_FEATURE_KEYS = new Set<SaasFeatureKey>(Object.keys(BOOTSTRAP_FEATURE_METADATA) as SaasFeatureKey[]);

function normalizeRuntimeDomainStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "pending";
  return normalized;
}

function parseProvisioningContractPlan(raw: string | null | undefined): ProvisioningContractPlan {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ProvisioningContractPlan;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeFeatureKeyList(values: readonly string[] | null | undefined): SaasFeatureKey[] {
  if (!values) return [];
  return [...new Set(
    values
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is SaasFeatureKey => KNOWN_FEATURE_KEYS.has(value as SaasFeatureKey)),
  )].sort();
}

function buildPendingBootstrapContract(): BootstrapDeploymentResult {
  return {
    status: "pending",
    readinessMarker: "bootstrap_pending",
    defaultConfigId: null,
    featureKeys: [],
    expectedFeatureKeys: [],
    planTier: "trial",
    defaultConfigReady: false,
    featureBaselineReady: false,
    degradedReason: null,
  };
}

function deriveBootstrapFeatureKeys(blueprint: SaasBlueprintDraft): SaasFeatureKey[] {
  const keys = new Set<SaasFeatureKey>(TRIAL_BOOTSTRAP_BASELINE);
  normalizeFeatureKeyList(blueprint.initialFeatures ?? []).forEach((featureKey) => keys.add(featureKey));

  if (blueprint.packsByDepartment.marketing) {
    keys.add("CLIENT_PORTAL");
  }
  if (blueprint.packsByDepartment.support || blueprint.packsByDepartment.ops) {
    keys.add("TASKS");
  }
  if (blueprint.packsByDepartment.emailIntake) {
    keys.add("EMAIL_INTAKE");
  }
  if (blueprint.packsByDepartment.accounting || blueprint.packsByDepartment.tax) {
    keys.add("TAX_ENGINE");
  }

  return [...keys].sort((left, right) => {
    const leftMeta = BOOTSTRAP_FEATURE_METADATA[left];
    const rightMeta = BOOTSTRAP_FEATURE_METADATA[right];
    if (leftMeta.phaseOrder !== rightMeta.phaseOrder) {
      return leftMeta.phaseOrder - rightMeta.phaseOrder;
    }
    return left.localeCompare(right);
  });
}

function sameFeatureKeys(left: readonly SaasFeatureKey[], right: readonly SaasFeatureKey[]): boolean {
  const normalizedLeft = normalizeFeatureKeyList(left);
  const normalizedRight = normalizeFeatureKeyList(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((featureKey, index) => featureKey === normalizedRight[index]);
}

function normalizeBootstrapSubset(expectedFeatureKeys: readonly SaasFeatureKey[]): SaasFeatureKey[] {
  if (expectedFeatureKeys.length <= 1) return [...expectedFeatureKeys];
  return expectedFeatureKeys.slice(0, expectedFeatureKeys.length - 1);
}

async function loadProvisioningContractRecord(params: {
  tenantId: string;
  saasId: string;
}): Promise<{ status: string | null; plan: ProvisioningContractPlan; lastError: string | null }> {
  const row = await queryOne<{
    status: string | null;
    plan: string | null;
    last_error: string | null;
  }>(
    `SELECT status, plan, last_error
     FROM campamento_provisioning
     WHERE tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    params.tenantId,
    params.saasId,
  );

  return {
    status: row?.status ?? null,
    plan: parseProvisioningContractPlan(row?.plan ?? null),
    lastError: row?.last_error ?? null,
  };
}

async function upsertProvisioningContract(params: {
  tenantId: string;
  saasId: string;
  correlationId: string;
  runtime: RuntimeDeploymentResult;
  bootstrap?: BootstrapDeploymentResult | null;
  lastError?: string | null;
}) {
  const now = new Date().toISOString();
  const current = await loadProvisioningContractRecord({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });
  const bootstrap = params.bootstrap ?? current.plan.bootstrap ?? buildPendingBootstrapContract();
  const plan = JSON.stringify({
    ...current.plan,
    runtimeName: CANONICAL_RUNTIME_NAME,
    routeType: "trial_domain",
    trialDomain: params.runtime.trialDomain,
    customDomain: params.runtime.customDomain,
    runtime: params.runtime,
    bootstrap,
  } satisfies ProvisioningContractPlan);

  await run(
    `INSERT INTO campamento_provisioning (
      id, tenant_id, saas_id, mode, status, plan, last_error, correlation_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
      mode = excluded.mode,
      status = excluded.status,
      plan = excluded.plan,
      last_error = excluded.last_error,
      correlation_id = excluded.correlation_id,
      updated_at = excluded.updated_at`,
    `runtime_${params.saasId}`,
    params.tenantId,
    params.saasId,
    "shared_runtime",
    params.runtime.status,
    plan,
    params.lastError ?? null,
    params.correlationId,
    now,
    now,
  );
}

async function loadRuntimeActivationSnapshot(params: {
  tenantId: string;
  saasId: string;
}): Promise<RuntimeActivationSnapshot> {
  const [saasRow, instanceRow, provisioningRecord] = await Promise.all([
    queryOne<{
      status: string | null;
      domain_status: string | null;
      domain: string | null;
      public_domain: string | null;
    }>(
      `SELECT status, domain_status, domain, public_domain
       FROM saas
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      params.saasId,
      params.tenantId,
    ),
    queryOne<{
      status: string | null;
      trial_domain: string | null;
      custom_domain: string | null;
      domain_status: string | null;
    }>(
      `SELECT status, trial_domain, custom_domain, domain_status
       FROM saas_instances
      WHERE id = ? AND tenant_id = ?
      LIMIT 1`,
      params.saasId,
      params.tenantId,
    ),
    loadProvisioningContractRecord({
      tenantId: params.tenantId,
      saasId: params.saasId,
    }),
  ]);
  const runtimeContractStatus = provisioningRecord.plan.runtime?.status ?? provisioningRecord.status ?? null;

  return {
    saasStatus: saasRow?.status ?? null,
    saasDomainStatus: saasRow?.domain_status ?? null,
    saasDomain: saasRow?.domain ?? null,
    saasPublicDomain: saasRow?.public_domain ?? null,
    instanceStatus: instanceRow?.status ?? null,
    instanceTrialDomain: instanceRow?.trial_domain ?? null,
    instanceCustomDomain: instanceRow?.custom_domain ?? null,
    instanceDomainStatus: instanceRow?.domain_status ?? null,
    runtimeContractStatus,
  };
}

function isRuntimeProvisioningConsistent(
  snapshot: RuntimeActivationSnapshot,
  contract: { trialDomain: string; customDomain: string | null },
): boolean {
  return snapshot.saasStatus === "provisioning"
    && snapshot.saasDomainStatus === "pending"
    && snapshot.saasDomain === contract.trialDomain
    && snapshot.saasPublicDomain === contract.trialDomain
    && snapshot.instanceStatus === "provisioning"
    && snapshot.instanceTrialDomain === contract.trialDomain
    && snapshot.instanceCustomDomain === contract.customDomain
    && snapshot.instanceDomainStatus === "pending"
    && snapshot.runtimeContractStatus === "provisioning";
}

function isRuntimeActivationReady(
  snapshot: RuntimeActivationSnapshot,
  contract: { trialDomain: string; customDomain: string | null },
): boolean {
  return snapshot.saasStatus === "active"
    && snapshot.saasDomainStatus === "active"
    && snapshot.saasDomain === contract.trialDomain
    && snapshot.saasPublicDomain === contract.trialDomain
    && snapshot.instanceStatus === "active"
    && snapshot.instanceTrialDomain === contract.trialDomain
    && snapshot.instanceCustomDomain === contract.customDomain
    && snapshot.instanceDomainStatus === "active"
    && snapshot.runtimeContractStatus === "active";
}

function isRuntimeDegradedConsistent(
  snapshot: RuntimeActivationSnapshot,
  contract: { trialDomain: string; customDomain: string | null; domainStatus: string },
): boolean {
  return snapshot.saasStatus === "provisioning"
    && snapshot.saasDomainStatus === contract.domainStatus
    && snapshot.saasDomain === contract.trialDomain
    && snapshot.saasPublicDomain === contract.trialDomain
    && snapshot.instanceStatus === "provisioning"
    && snapshot.instanceTrialDomain === contract.trialDomain
    && snapshot.instanceCustomDomain === contract.customDomain
    && snapshot.instanceDomainStatus === contract.domainStatus
    && snapshot.runtimeContractStatus === "degraded";
}

async function deployCanonicalRuntime(params: {
  tenantId: string;
  saasId: string;
  blueprint: SaasBlueprintDraft;
  correlationId: string;
}): Promise<RuntimeDeploymentResult> {
  const domains = computeDomainsForSaas(params.blueprint);
  const trialDomain = domains.primaryHostname;
  const customDomain = domains.customHostname ?? null;
  const subdomain = params.blueprint.proposedSubdomain || params.blueprint.proposedSlug;
  const now = new Date().toISOString();

  await run(
    `UPDATE saas
     SET status = 'provisioning',
         domain = ?,
         subdomain = ?,
         public_domain = ?,
         public_subdomain = ?,
         domain_status = 'pending'
     WHERE id = ? AND tenant_id = ?`,
    trialDomain,
    subdomain,
    trialDomain,
    subdomain,
    params.saasId,
    params.tenantId,
  );

  await run(
    `UPDATE saas_instances
     SET status = 'provisioning',
         trial_domain = ?,
         custom_domain = ?,
         domain_status = 'pending',
         updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    trialDomain,
    customDomain,
    now,
    params.saasId,
    params.tenantId,
  );

  await upsertProvisioningContract({
    tenantId: params.tenantId,
    saasId: params.saasId,
    correlationId: params.correlationId,
    runtime: {
      mode: "shared_runtime",
      runtimeName: CANONICAL_RUNTIME_NAME,
      trialDomain,
      customDomain,
      status: "provisioning",
      activationReady: false,
      lastKnownDomainStatus: "pending",
    },
  });

  const snapshot = await loadRuntimeActivationSnapshot({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  if (!isRuntimeProvisioningConsistent(snapshot, { trialDomain, customDomain })) {
    throw new Error("CANONICAL_RUNTIME_DEPLOYMENT_INCONSISTENT");
  }

  return {
    mode: "shared_runtime",
    runtimeName: CANONICAL_RUNTIME_NAME,
    trialDomain,
    customDomain,
    status: "provisioning",
    activationReady: false,
    lastKnownDomainStatus: "pending",
  };
}

async function finalizeCanonicalActivation(params: {
  tenantId: string;
  saasId: string;
  correlationId: string;
  runtimeDeployment: RuntimeDeploymentResult;
  domainStatus: string;
  activationResult: "active" | "degraded";
}): Promise<RuntimeDeploymentResult> {
  const normalizedDomainStatus = normalizeRuntimeDomainStatus(params.domainStatus);
  const nextSaasStatus = params.activationResult === "active" ? "active" : "provisioning";
  const nextContractStatus: RuntimeContractStatus = params.activationResult === "active" ? "active" : "degraded";
  const now = new Date().toISOString();

  await run(
    `UPDATE saas
     SET status = ?,
         domain = ?,
         public_domain = ?,
         domain_status = ?
     WHERE id = ? AND tenant_id = ?`,
    nextSaasStatus,
    params.runtimeDeployment.trialDomain,
    params.runtimeDeployment.trialDomain,
    normalizedDomainStatus,
    params.saasId,
    params.tenantId,
  );

  await run(
    `UPDATE saas_instances
     SET status = ?,
         trial_domain = ?,
         custom_domain = ?,
         domain_status = ?,
         updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    nextSaasStatus,
    params.runtimeDeployment.trialDomain,
    params.runtimeDeployment.customDomain,
    normalizedDomainStatus,
    now,
    params.saasId,
    params.tenantId,
  );

  const nextRuntime: RuntimeDeploymentResult = {
    ...params.runtimeDeployment,
    status: nextContractStatus,
    activationReady: params.activationResult === "active",
    lastKnownDomainStatus: params.activationResult === "active" ? "active" : normalizedDomainStatus,
  };

  await upsertProvisioningContract({
    tenantId: params.tenantId,
    saasId: params.saasId,
    correlationId: params.correlationId,
    runtime: nextRuntime,
    lastError: params.activationResult === "degraded"
      ? `Canonical runtime waiting on domain status ${normalizedDomainStatus}.`
      : null,
  });

  const snapshot = await loadRuntimeActivationSnapshot({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  if (params.activationResult === "active") {
    if (!isRuntimeActivationReady(snapshot, nextRuntime)) {
      throw new Error("CANONICAL_RUNTIME_ACTIVATION_NOT_READY");
    }
    return nextRuntime;
  }

  if (!isRuntimeDegradedConsistent(snapshot, {
    trialDomain: params.runtimeDeployment.trialDomain,
    customDomain: params.runtimeDeployment.customDomain,
    domainStatus: normalizedDomainStatus,
  })) {
    throw new Error("CANONICAL_RUNTIME_DEGRADED_INCONSISTENT");
  }

  return nextRuntime;
}

async function loadBootstrapSnapshot(params: {
  tenantId: string;
  saasId: string;
}): Promise<BootstrapSnapshot> {
  const [saasRow, instanceRow, brandingRow, featureRows, provisioningRecord] = await Promise.all([
    queryOne<{
      status: string | null;
      domain_status: string | null;
    }>(
      `SELECT status, domain_status
       FROM saas
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      params.saasId,
      params.tenantId,
    ),
    queryOne<{
      status: string | null;
      domain_status: string | null;
      plan_tier: string | null;
    }>(
      `SELECT status, domain_status, plan_tier
       FROM saas_instances
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      params.saasId,
      params.tenantId,
    ),
    queryOne<{ id: string | null }>(
      `SELECT id
       FROM saas_branding_settings
       WHERE tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      params.tenantId,
      params.saasId,
    ),
    queryAll<{ feature_key: string; status: string }>(
      `SELECT feature_key, status
       FROM saas_features
       WHERE tenant_id = ? AND saas_id = ? AND status = 'ENABLED'
       ORDER BY feature_key ASC`,
      params.tenantId,
      params.saasId,
    ),
    loadProvisioningContractRecord({
      tenantId: params.tenantId,
      saasId: params.saasId,
    }),
  ]);

  const runtime = provisioningRecord.plan.runtime;
  const bootstrap = provisioningRecord.plan.bootstrap;

  return {
    saasStatus: saasRow?.status ?? null,
    saasDomainStatus: saasRow?.domain_status ?? null,
    instanceStatus: instanceRow?.status ?? null,
    instanceDomainStatus: instanceRow?.domain_status ?? null,
    instancePlanTier: instanceRow?.plan_tier ?? null,
    brandingSettingsId: brandingRow?.id ?? null,
    enabledFeatureKeys: normalizeFeatureKeyList(featureRows.map((row) => row.feature_key)),
    runtimeContractStatus: runtime?.status ?? provisioningRecord.status,
    runtimeActivationReady: Boolean(runtime?.activationReady),
    bootstrapContractStatus: bootstrap?.status ?? null,
    bootstrapReadinessMarker: bootstrap?.readinessMarker ?? null,
    bootstrapDefaultConfigId: bootstrap?.defaultConfigId ?? null,
    bootstrapFeatureKeys: normalizeFeatureKeyList(bootstrap?.featureKeys),
    bootstrapExpectedFeatureKeys: normalizeFeatureKeyList(bootstrap?.expectedFeatureKeys),
    bootstrapPlanTier: bootstrap?.planTier ?? null,
    bootstrapDegradedReason: bootstrap?.degradedReason ?? provisioningRecord.lastError,
  };
}

function isBootstrapReady(snapshot: BootstrapSnapshot, expected: BootstrapDeploymentResult): boolean {
  return snapshot.saasStatus === "active"
    && snapshot.saasDomainStatus === "active"
    && snapshot.instanceStatus === "active"
    && snapshot.instanceDomainStatus === "active"
    && (snapshot.instancePlanTier === expected.planTier || snapshot.instancePlanTier === null)
    && snapshot.brandingSettingsId === expected.defaultConfigId
    && snapshot.runtimeContractStatus === "active"
    && snapshot.runtimeActivationReady
    && snapshot.bootstrapContractStatus === "ready"
    && snapshot.bootstrapReadinessMarker === "bootstrap_ready"
    && snapshot.bootstrapDefaultConfigId === expected.defaultConfigId
    && sameFeatureKeys(snapshot.enabledFeatureKeys, expected.featureKeys)
    && sameFeatureKeys(snapshot.bootstrapFeatureKeys, expected.featureKeys)
    && sameFeatureKeys(snapshot.bootstrapExpectedFeatureKeys, expected.expectedFeatureKeys)
    && snapshot.bootstrapPlanTier === expected.planTier
    && snapshot.bootstrapDegradedReason === null;
}

function isBootstrapDegradedConsistent(snapshot: BootstrapSnapshot, expected: BootstrapDeploymentResult): boolean {
  return snapshot.saasStatus === "active"
    && snapshot.saasDomainStatus === "active"
    && snapshot.instanceStatus === "active"
    && snapshot.instanceDomainStatus === "active"
    && (snapshot.instancePlanTier === expected.planTier || snapshot.instancePlanTier === null)
    && snapshot.brandingSettingsId === expected.defaultConfigId
    && snapshot.runtimeContractStatus === "active"
    && snapshot.runtimeActivationReady
    && snapshot.bootstrapContractStatus === "degraded"
    && snapshot.bootstrapReadinessMarker === "bootstrap_partial"
    && snapshot.bootstrapDefaultConfigId === expected.defaultConfigId
    && sameFeatureKeys(snapshot.enabledFeatureKeys, expected.featureKeys)
    && sameFeatureKeys(snapshot.bootstrapFeatureKeys, expected.featureKeys)
    && sameFeatureKeys(snapshot.bootstrapExpectedFeatureKeys, expected.expectedFeatureKeys)
    && snapshot.bootstrapPlanTier === expected.planTier
    && snapshot.bootstrapDegradedReason === expected.degradedReason
    && expected.defaultConfigReady
    && !expected.featureBaselineReady
    && expected.featureKeys.length > 0
    && expected.featureKeys.length < expected.expectedFeatureKeys.length;
}

async function bootstrapCanonicalSaas(params: {
  env?: DracoEnv | null;
  tenantId: string;
  saasId: string;
  blueprint: SaasBlueprintDraft;
  correlationId: string;
  runtimeDeployment: RuntimeDeploymentResult;
}): Promise<BootstrapDeploymentResult> {
  const now = new Date().toISOString();
  const planTier = "trial";
  const defaultConfigId = `${DEFAULT_BOOTSTRAP_CONFIG_ID_PREFIX}_${params.saasId}`;
  const expectedFeatureKeys = deriveBootstrapFeatureKeys(params.blueprint);
  const faultAt = params.env?.PROVISIONING_FAULT_AT;
  const featureKeys = faultAt === "BOOTSTRAP_PARTIAL_READY"
    ? normalizeBootstrapSubset(expectedFeatureKeys)
    : expectedFeatureKeys;
  const degradedReason = faultAt === "BOOTSTRAP_PARTIAL_READY"
    ? `BOOTSTRAP_FEATURE_BASELINE_PARTIAL:${expectedFeatureKeys.filter((featureKey) => !featureKeys.includes(featureKey)).join(",")}`
    : null;

  await run(
    `INSERT INTO saas_branding_settings (
      id, tenant_id, saas_id, primary_color, secondary_color, accent_color, background_color, surface_color,
      text_color, danger_color, success_color, logo_url, favicon_url, hero_image_url, layout_density, enable_dark_mode,
      metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      accent_color = excluded.accent_color,
      background_color = excluded.background_color,
      surface_color = excluded.surface_color,
      text_color = excluded.text_color,
      danger_color = excluded.danger_color,
      success_color = excluded.success_color,
      logo_url = excluded.logo_url,
      favicon_url = excluded.favicon_url,
      hero_image_url = excluded.hero_image_url,
      layout_density = excluded.layout_density,
      enable_dark_mode = excluded.enable_dark_mode,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at`,
    defaultConfigId,
    params.tenantId,
    params.saasId,
    DEFAULT_BOOTSTRAP_THEME.primaryColor,
    DEFAULT_BOOTSTRAP_THEME.secondaryColor,
    DEFAULT_BOOTSTRAP_THEME.accentColor,
    DEFAULT_BOOTSTRAP_THEME.backgroundColor,
    DEFAULT_BOOTSTRAP_THEME.surfaceColor,
    DEFAULT_BOOTSTRAP_THEME.textColor,
    DEFAULT_BOOTSTRAP_THEME.dangerColor,
    DEFAULT_BOOTSTRAP_THEME.successColor,
    null,
    null,
    null,
    DEFAULT_BOOTSTRAP_THEME.layoutDensity,
    DEFAULT_BOOTSTRAP_THEME.enableDarkMode ? 1 : 0,
    JSON.stringify({
      source: "canonical_factory_bootstrap",
      planTier,
      correlationId: params.correlationId,
    }),
    now,
    now,
  );

  for (const featureKey of featureKeys) {
    const metadata = BOOTSTRAP_FEATURE_METADATA[featureKey];
    await run(
      `INSERT INTO saas_features (
        id, tenant_id, saas_id, feature_key, label, category, status, source, phase_order, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, saas_id, feature_key)
      DO UPDATE SET label = excluded.label,
                    category = excluded.category,
                    status = excluded.status,
                    source = excluded.source,
                    phase_order = excluded.phase_order,
                    metadata = excluded.metadata,
                    updated_at = excluded.updated_at`,
      `bootstrap_feature_${params.saasId}_${featureKey.toLowerCase()}`,
      params.tenantId,
      params.saasId,
      featureKey,
      metadata.label,
      metadata.category,
      "ENABLED",
      "PLAN",
      metadata.phaseOrder,
      JSON.stringify({
        source: "canonical_factory_bootstrap",
        planTier,
        correlationId: params.correlationId,
      }),
      now,
      now,
    );
  }

  const bootstrapDeployment: BootstrapDeploymentResult = {
    status: degradedReason ? "degraded" : "ready",
    readinessMarker: degradedReason ? "bootstrap_partial" : "bootstrap_ready",
    defaultConfigId,
    featureKeys,
    expectedFeatureKeys,
    planTier,
    defaultConfigReady: true,
    featureBaselineReady: !degradedReason,
    degradedReason,
  };

  await upsertProvisioningContract({
    tenantId: params.tenantId,
    saasId: params.saasId,
    correlationId: params.correlationId,
    runtime: params.runtimeDeployment,
    bootstrap: bootstrapDeployment,
    lastError: degradedReason ? `Canonical bootstrap partial: ${degradedReason}.` : null,
  });

  if (faultAt === "BOOTSTRAP_CONSISTENCY_BREAK") {
    await run(
      `DELETE FROM saas_branding_settings WHERE tenant_id = ? AND saas_id = ?`,
      params.tenantId,
      params.saasId,
    );
  }

  const snapshot = await loadBootstrapSnapshot({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  if (!degradedReason) {
    if (!isBootstrapReady(snapshot, bootstrapDeployment)) {
      throw new Error("CANONICAL_BOOTSTRAP_NOT_READY");
    }
    return bootstrapDeployment;
  }

  if (!isBootstrapDegradedConsistent(snapshot, bootstrapDeployment)) {
    throw new Error("CANONICAL_BOOTSTRAP_DEGRADED_INCONSISTENT");
  }

  return bootstrapDeployment;
}

async function recordProvisioningStepEvent(params: {
  tenantId: string;
  saasId: string;
  correlationId: string;
  jobId: string;
  step: string;
  phase: "started" | "succeeded" | "failed";
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const result = await recordCampamentoEventSafe({
    tenantId: params.tenantId,
    saasId: params.saasId,
    correlationId: params.correlationId,
    type: `provision.saas_factory.${params.step}.${params.phase}`,
    severity: params.severity,
    source: "PROVISIONING_CONSUMER",
    message: params.message,
    metadata: {
      jobId: params.jobId,
      step: params.step,
      phase: params.phase,
      durationMs: params.durationMs ?? null,
      ...(params.metadata ?? {}),
    },
    jobId: params.jobId,
    step: params.step,
  });
  if (!result.ok) {
    console.error(`[Provision] Observability write degraded for job ${params.jobId} at step ${params.step}`);
  }
}

async function recordDomainProviderEvent(params: {
  tenantId: string;
  saasId: string;
  correlationId: string;
  jobId: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await recordCampamentoEventSafe({
    tenantId: params.tenantId,
    saasId: params.saasId,
    correlationId: params.correlationId,
    type: params.type,
    severity: params.severity,
    source: "PROVISIONING_CONSUMER",
    message: params.message,
    metadata: {
      jobId: params.jobId,
      ...(params.metadata ?? {}),
    },
    jobId: params.jobId,
    step: "domain_provider",
  });
}

function readNumericEnvValue(envLike: DracoEnv | null | undefined, key: string, fallback: number): number {
  const fromBindingRaw = envLike && typeof envLike === "object" ? Reflect.get(envLike, key) : undefined;
  const fromBinding = typeof fromBindingRaw === "number"
    ? fromBindingRaw
    : typeof fromBindingRaw === "string"
      ? Number(fromBindingRaw)
      : NaN;
  const fromProcessRaw = typeof process !== "undefined" ? process.env[key] : undefined;
  const fromProcess = typeof fromProcessRaw === "string" ? Number(fromProcessRaw) : NaN;
  const parsed = Number.isFinite(fromBinding) ? fromBinding : fromProcess;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function getDomainVerifyRetryConfig(envLike: DracoEnv | null | undefined): DomainVerifyRetryConfig {
  const retries = readNumericEnvValue(envLike, "PROVISION_DOMAIN_VERIFY_RETRIES", 4);
  const baseDelayMs = readNumericEnvValue(envLike, "PROVISION_DOMAIN_VERIFY_BACKOFF_MS", 500);
  const maxDelayMs = readNumericEnvValue(envLike, "PROVISION_DOMAIN_VERIFY_MAX_BACKOFF_MS", 5_000);
  const jitterMs = readNumericEnvValue(envLike, "PROVISION_DOMAIN_VERIFY_JITTER_MS", 250);
  const maxTotalWaitMs = readNumericEnvValue(envLike, "PROVISION_DOMAIN_VERIFY_TIMEOUT_MS", 20_000);
  return {
    maxAttempts: Math.max(1, retries + 1),
    baseDelayMs,
    maxDelayMs: Math.max(baseDelayMs, maxDelayMs),
    jitterMs,
    maxTotalWaitMs: Math.max(maxTotalWaitMs, baseDelayMs),
  };
}

function computeBackoffDelayMs(config: DomainVerifyRetryConfig, attemptNumber: number): number {
  const exponentialDelay = config.baseDelayMs * (2 ** Math.max(0, attemptNumber - 1));
  const cappedDelay = Math.min(config.maxDelayMs, exponentialDelay);
  const jitter = config.jitterMs > 0 ? Math.floor(Math.random() * (config.jitterMs + 1)) : 0;
  return cappedDelay + jitter;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function verifyDomainWithRetry(input: VerifyDomainWithRetryInput): Promise<VerifyDomainWithRetryResult> {
  const retryConfig = getDomainVerifyRetryConfig(input.env);
  const startedAt = Date.now();
  let waitedMs = 0;
  let lastError: unknown = null;
  let lastResult: Awaited<ReturnType<typeof verifyDomainBinding>> | null = null;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt += 1) {
    await recordDomainProviderEvent({
      tenantId: input.tenantId,
      saasId: input.saasId,
      correlationId: input.correlationId,
      jobId: input.jobId,
      type: "provision.domain.verify.attempt",
      severity: "INFO",
      message: "Domain verification attempt started.",
      metadata: {
        hostname: input.hostname,
        bindingId: input.bindingId ?? null,
        attempt,
        maxAttempts: retryConfig.maxAttempts,
      },
    });

    try {
      const verifyRes = await verifyDomainBinding({
        hostname: input.hostname,
        bindingId: input.bindingId,
        correlationId: input.correlationId,
        envOverride: input.env,
      });
      lastResult = verifyRes;
      if (verifyRes.providerStatus === "active") {
        await recordDomainProviderEvent({
          tenantId: input.tenantId,
          saasId: input.saasId,
          correlationId: input.correlationId,
          jobId: input.jobId,
          type: "provision.domain.verify.succeeded",
          severity: "INFO",
          message: "Domain verification succeeded.",
          metadata: {
            hostname: verifyRes.hostname,
            bindingId: verifyRes.bindingId,
            providerStatus: verifyRes.providerStatus,
            attempt,
            waitedMs,
          },
        });
        return { result: verifyRes, attempts: attempt, waitedMs, isActive: true };
      }
    } catch (error) {
      lastError = error;
    }

    const lastAttempt = attempt >= retryConfig.maxAttempts;
    const elapsedMs = Date.now() - startedAt;
    const delayMs = computeBackoffDelayMs(retryConfig, attempt);
    const timeoutReached = elapsedMs + delayMs > retryConfig.maxTotalWaitMs;

    if (lastAttempt || timeoutReached) {
      const providerStatus = lastResult?.providerStatus ?? null;
      const errorMessage = lastError instanceof Error ? lastError.message : null;
      await recordDomainProviderEvent({
        tenantId: input.tenantId,
        saasId: input.saasId,
        correlationId: input.correlationId,
        jobId: input.jobId,
        type: "provision.domain.verify.failed",
        severity: "ERROR",
        message: "Domain verification failed after retries.",
        metadata: {
          hostname: input.hostname,
          bindingId: input.bindingId ?? null,
          providerStatus,
          attempts: attempt,
          waitedMs,
          timeoutReached,
          error: errorMessage,
        },
      });
      if (lastResult && !lastError && input.failOnNonActive === false) {
        return {
          result: lastResult,
          attempts: attempt,
          waitedMs,
          isActive: false,
        };
      }
      if (lastError instanceof Error) throw lastError;
      throw new Error(`DOMAIN_VERIFY_FAILED:${providerStatus ?? "unknown"}`);
    }

    await recordDomainProviderEvent({
      tenantId: input.tenantId,
      saasId: input.saasId,
      correlationId: input.correlationId,
      jobId: input.jobId,
      type: "provision.domain.verify.retrying",
      severity: "WARNING",
      message: "Domain verification pending; retrying.",
      metadata: {
        hostname: input.hostname,
        bindingId: input.bindingId ?? null,
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        providerStatus: lastResult?.providerStatus ?? null,
        error: lastError instanceof Error ? lastError.message : null,
      },
    });

    await sleep(delayMs);
    waitedMs += delayMs;
  }

  throw new Error("DOMAIN_VERIFY_FAILED:unexpected_exit");
}

export async function provisionSaaS(params: {
  env?: DracoEnv | null;
  ownerTenantId: string;
  blueprint: SaasBlueprintDraft;
  preAcquiredToken?: { lockVersion: number; ownerId: string };
  existingJob?: ExistingProvisioningJobContext;
}): Promise<{ saasId: string; status: string; error?: string }> {

  await ensureCampamentoBase();

  // 1. Prepare Data
  const normalized = normalizeCampamentoBaseProfileForBlueprint(
    prepareStripePricingFromBlueprint(
      computeDefaultProvisioningForBlueprint(params.blueprint),
      null
    ),
    { applyDefaults: true }
  );

  const fallbackCorrelationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const generatedSaasId = globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`;

  // 2. Resolve Job Context (Idempotent)
  let jobIdInUse = params.existingJob?.jobId ?? "";
  let currentState: ProvisioningJobState = params.existingJob?.state ?? 'CREATED';
  const realSaasId = params.existingJob?.entityId ?? generatedSaasId;
  const correlationId = params.existingJob?.correlationId ?? fallbackCorrelationId;
  const idempotencyKey = params.existingJob?.idempotencyKey ?? `prov_saas_${normalized.proposedSlug}`;
  let payload: OrchestratorPayload = params.existingJob?.payload || normalized;

  if (!params.existingJob) {
    const jobResult = await JobRunner.ensureJob({
      jobId: `job_${idempotencyKey}`,
      type: 'SAAS_PROVISIONING',
      entityId: generatedSaasId,
      correlationId,
      idempotencyKey,
      initialState: 'CREATED',
      payload: normalized,
      tenantId: params.ownerTenantId,
      queue: params.env?.PROVISIONING_QUEUE
    });

    jobIdInUse = jobResult.jobId;
    currentState = jobResult.state;
    payload = jobResult.payload || normalized;

    if (jobResult.state === 'ACTIVE' || jobResult.state === 'SUCCESS') {
      return { saasId: jobResult.entityId, status: 'ALREADY_ACTIVE' };
    }
  }

  // 3. Locking
  let token = params.preAcquiredToken;
  const ownerId = token?.ownerId || `orchestrator-${crypto.randomUUID()}`;

  if (!token) {
    try {
      const { lockVersion } = await JobRunner.acquireLock(jobIdInUse, ownerId);
      token = { lockVersion, ownerId };
    } catch (e: any) {
      if (e.name === 'JobLockedError' || e.message.includes('terminal state')) {
        return { saasId: realSaasId, status: 'RUNNING_OR_TERMINAL' };
      }
      throw e;
    }
  }

  // 4. Execution Flow
  // We use 'as ProvisioningJobState' to allow full range of transitions in TS eyes
  if (currentState === 'CREATED') currentState = 'RUNNING';

  const executionStartedAt = Date.now();
  try {
    // --- STEP 1: REGISTER SAAS (Internal DB) ---
    if (currentState === 'RUNNING') {
      const startedAt = Date.now();
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "db_register",
        phase: "started",
        severity: "INFO",
        message: "SaaS DB provisioning started.",
      });

      await run(
        `INSERT INTO saas (id, name, slug, status, tenant_id, created_at)
                 VALUES (?, ?, ?, 'inactive', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                 ON CONFLICT(slug) DO UPDATE SET name = excluded.name`,
        realSaasId,
        normalized.saasName,
        normalized.proposedSlug,
        params.ownerTenantId
      );

      await run(
        `INSERT INTO saas_instances (id, tenant_id, slug, name, status, plan_tier, created_at)
                 VALUES (?, ?, ?, ?, 'inactive', 'trial', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                 ON CONFLICT(slug) DO NOTHING`,
        realSaasId, params.ownerTenantId, normalized.proposedSlug, normalized.saasName
      );

      await JobRunner.transitionState(jobIdInUse, 'RUNNING', 'SAAS_REGISTERED', token!, `SaaS registered.`);
      currentState = 'SAAS_REGISTERED';
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "db_register",
        phase: "succeeded",
        severity: "INFO",
        message: "SaaS DB provisioning completed.",
        durationMs: Date.now() - startedAt,
      });
    }

    // --- STEP 2: STRIPE PRODUCT ---
    if (currentState === 'SAAS_REGISTERED') {
      const startedAt = Date.now();
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "stripe",
        phase: "started",
        severity: "INFO",
        message: "Stripe provisioning started.",
      });

      const stripeRes = await ensureStripeProductForSaas({
        env: params.env,
        blueprint: normalized,
        pricingRecommendation: null,
        saasId: realSaasId,
        tenantId: params.ownerTenantId,
        correlationId
      });

      if (stripeRes.status === 'ERROR') {
        throw new Error(stripeRes.message ?? 'Stripe provisioning failed');
      }

      // PERSIST EXTERNAL IDs
      if (stripeRes.productId) {
        payload = { ...payload, stripeProductId: stripeRes.productId, stripePriceIds: stripeRes.priceIds };
        await JobRunner.updatePayload(jobIdInUse, payload, token!);
      }

      await JobRunner.transitionState(jobIdInUse, 'SAAS_REGISTERED', 'STRIPE_PRODUCT_CREATED', token!, 'Stripe resources created.');
      currentState = 'STRIPE_PRODUCT_CREATED';
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "stripe",
        phase: "succeeded",
        severity: "INFO",
        message: "Stripe provisioning completed.",
        durationMs: Date.now() - startedAt,
        metadata: { stripeProductId: payload.stripeProductId ?? null },
      });

      // FAULT INJECTION (VERIFICATION ONLY)
      if (params.env?.PROVISIONING_FAULT_AT === 'STRIPE_AFTER_CREATE') {
        throw new Error("Simulated Fault: STRIPE_AFTER_CREATE");
      }
    }

    // --- STEP 3: CANONICAL RUNTIME CONTRACT ---
    if (currentState === 'STRIPE_PRODUCT_CREATED') {
      const startedAt = Date.now();
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "runtime",
        phase: "started",
        severity: "INFO",
        message: "Canonical runtime deployment started.",
      });

      const runtimeDeployment = await deployCanonicalRuntime({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        blueprint: normalized,
        correlationId,
      });

      payload = { ...payload, runtimeDeployment };
      await JobRunner.updatePayload(jobIdInUse, payload, token!);
      await JobRunner.transitionState(jobIdInUse, 'STRIPE_PRODUCT_CREATED', 'RUNTIME_DEPLOYED', token!, 'Canonical runtime deployment recorded.');
      currentState = 'RUNTIME_DEPLOYED';

      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "runtime",
        phase: "succeeded",
        severity: "INFO",
        message: "Canonical runtime deployment completed.",
        durationMs: Date.now() - startedAt,
        metadata: {
          runtimeName: runtimeDeployment.runtimeName,
          trialDomain: runtimeDeployment.trialDomain,
          customDomain: runtimeDeployment.customDomain,
        },
      });
    }

    // --- STEP 4: DOMAIN PROVIDER (Workers Custom Domains) ---
    if (currentState === 'RUNTIME_DEPLOYED') {
      await JobRunner.transitionState(jobIdInUse, 'RUNTIME_DEPLOYED', 'PROVISION_WORKER', token!, 'Domain provisioning worker step started.');
      currentState = 'PROVISION_WORKER';
    }

    if (currentState === 'PROVISION_WORKER') {
      const domains = computeDomainsForSaas(normalized);
      const startedAt = Date.now();
      await recordDomainProviderEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        type: "provision.domain.create.started",
        severity: "INFO",
        message: "Domain binding creation started.",
        metadata: { hostname: domains.primaryHostname },
      });

      const createRes = await createDomainBinding({
        hostname: domains.primaryHostname,
        correlationId,
        envOverride: params.env,
      });

      payload = { ...payload, cloudflareHostnameId: createRes.bindingId ?? undefined };
      await JobRunner.updatePayload(jobIdInUse, payload, token!);
      await JobRunner.transitionState(jobIdInUse, 'PROVISION_WORKER', 'CREATE_DOMAIN_BINDING', token!, 'Domain binding created.');
      currentState = 'CREATE_DOMAIN_BINDING';

      await recordDomainProviderEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        type: "provision.domain.create.succeeded",
        severity: "INFO",
        message: "Domain binding creation succeeded.",
        metadata: {
          hostname: createRes.hostname,
          bindingId: createRes.bindingId,
          providerStatus: createRes.providerStatus,
          alreadyExists: Boolean(createRes.alreadyExists),
          durationMs: Date.now() - startedAt,
        },
      });
    }

    if (currentState === 'CREATE_DOMAIN_BINDING') {
      const domains = computeDomainsForSaas(normalized);
      const verifyResult = await verifyDomainWithRetry({
        hostname: domains.primaryHostname,
        bindingId: payload.cloudflareHostnameId,
        correlationId,
        env: params.env,
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        jobId: jobIdInUse,
        failOnNonActive: false,
      });
      const verifyRes = verifyResult.result;

      const ctx = await resolveSaasContext({ tenantId: params.ownerTenantId, saasId: realSaasId, env: params.env });
      await upsertSaasDomain(ctx, {
        id: `factory_domain_${realSaasId}`,
        saasId: realSaasId,
        domain: verifyRes.hostname,
        isPrimary: true,
        status: verifyRes.providerStatus === 'active' ? 'active' : 'pending',
      });

      await JobRunner.transitionState(jobIdInUse, 'CREATE_DOMAIN_BINDING', 'VERIFY_DOMAIN', token!, 'Domain binding verified.');
      currentState = 'VERIFY_DOMAIN';

      if (!verifyResult.isActive) {
        const degradedRuntime = await finalizeCanonicalActivation({
          tenantId: params.ownerTenantId,
          saasId: realSaasId,
          correlationId,
          runtimeDeployment: payload.runtimeDeployment ?? {
            mode: "shared_runtime",
            runtimeName: CANONICAL_RUNTIME_NAME,
            trialDomain: domains.primaryHostname,
            customDomain: domains.customHostname ?? null,
            status: "provisioning",
            activationReady: false,
            lastKnownDomainStatus: "pending",
          },
          domainStatus: verifyRes.providerStatus,
          activationResult: "degraded",
        });
        payload = { ...payload, runtimeDeployment: degradedRuntime };
        await JobRunner.updatePayload(jobIdInUse, payload, token!);
        await recordDomainProviderEvent({
          tenantId: params.ownerTenantId,
          saasId: realSaasId,
          correlationId,
          jobId: jobIdInUse,
          type: "provision.domain.degraded",
          severity: "WARNING",
          message: "Domain remains pending after retries; provisioning marked degraded.",
          metadata: {
            hostname: verifyRes.hostname,
            bindingId: verifyRes.bindingId,
            providerStatus: verifyRes.providerStatus,
            retries: verifyResult.attempts,
            waitedMs: verifyResult.waitedMs,
          },
        });
        await JobRunner.markDegraded(
          jobIdInUse,
          'VERIFY_DOMAIN',
          token!,
          `Domain verification did not reach active status (${verifyRes.providerStatus}).`,
        );
        await recordProvisioningStepEvent({
          tenantId: params.ownerTenantId,
          saasId: realSaasId,
          correlationId,
          jobId: jobIdInUse,
          step: "job",
          phase: "succeeded",
          severity: "WARNING",
          message: "Provisioning completed in degraded mode.",
          durationMs: Date.now() - executionStartedAt,
          metadata: { finalState: "DEGRADED", domainStatus: verifyRes.providerStatus },
        });
        return { saasId: realSaasId, status: 'DEGRADED' };
      }

      const activatedRuntime = await finalizeCanonicalActivation({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        runtimeDeployment: payload.runtimeDeployment ?? {
          mode: "shared_runtime",
          runtimeName: CANONICAL_RUNTIME_NAME,
          trialDomain: domains.primaryHostname,
          customDomain: domains.customHostname ?? null,
          status: "provisioning",
          activationReady: false,
          lastKnownDomainStatus: "pending",
        },
        domainStatus: verifyRes.providerStatus,
        activationResult: "active",
      });
      payload = { ...payload, runtimeDeployment: activatedRuntime };
      await JobRunner.updatePayload(jobIdInUse, payload, token!);

      if (params.env?.PROVISIONING_FAULT_AT === 'CLOUDFLARE_AFTER_CREATE') {
        throw new Error("Simulated Fault: CLOUDFLARE_AFTER_CREATE");
      }
    }

    if (currentState === 'VERIFY_DOMAIN') {
      if (!payload.runtimeDeployment) {
        throw new Error("CANONICAL_RUNTIME_DEPLOYMENT_MISSING");
      }

      if (payload.runtimeDeployment.status === "degraded" && !payload.runtimeDeployment.activationReady) {
        await JobRunner.markDegraded(
          jobIdInUse,
          'VERIFY_DOMAIN',
          token!,
          `Domain verification did not reach active status (${payload.runtimeDeployment.lastKnownDomainStatus}).`,
        );
        await recordProvisioningStepEvent({
          tenantId: params.ownerTenantId,
          saasId: realSaasId,
          correlationId,
          jobId: jobIdInUse,
          step: "job",
          phase: "succeeded",
          severity: "WARNING",
          message: "Provisioning completed in degraded mode.",
          durationMs: Date.now() - executionStartedAt,
          metadata: {
            finalState: "DEGRADED",
            domainStatus: payload.runtimeDeployment.lastKnownDomainStatus,
          },
        });
        return { saasId: realSaasId, status: 'DEGRADED' };
      }

      if (!payload.runtimeDeployment.activationReady || payload.runtimeDeployment.status !== "active") {
        throw new Error("CANONICAL_RUNTIME_ACTIVATION_NOT_READY");
      }

      const startedAt = Date.now();
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "bootstrap",
        phase: "started",
        severity: "INFO",
        message: "Canonical bootstrap started.",
      });

      if (!payload.bootstrapDeployment) {
        payload = {
          ...payload,
          bootstrapDeployment: await bootstrapCanonicalSaas({
            env: params.env,
            tenantId: params.ownerTenantId,
            saasId: realSaasId,
            blueprint: normalized,
            correlationId,
            runtimeDeployment: payload.runtimeDeployment,
          }),
        };
        await JobRunner.updatePayload(jobIdInUse, payload, token!);
      } else {
        const bootstrapSnapshot = await loadBootstrapSnapshot({
          tenantId: params.ownerTenantId,
          saasId: realSaasId,
        });
        const bootstrapReady = payload.bootstrapDeployment.status === "ready"
          ? isBootstrapReady(bootstrapSnapshot, payload.bootstrapDeployment)
          : isBootstrapDegradedConsistent(bootstrapSnapshot, payload.bootstrapDeployment);
        if (!bootstrapReady) {
          throw new Error("CANONICAL_BOOTSTRAP_NOT_READY");
        }
      }
      const bootstrapDeployment = payload.bootstrapDeployment;
      if (!bootstrapDeployment) {
        throw new Error("CANONICAL_BOOTSTRAP_MISSING");
      }

      await JobRunner.transitionState(
        jobIdInUse,
        'VERIFY_DOMAIN',
        'BOOTSTRAP_READY',
        token!,
        bootstrapDeployment.status === "degraded"
          ? 'Canonical bootstrap completed in degraded mode.'
          : 'Canonical bootstrap completed.',
      );
      currentState = 'BOOTSTRAP_READY';

      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "bootstrap",
        phase: "succeeded",
        severity: bootstrapDeployment.status === "degraded" ? "WARNING" : "INFO",
        message: bootstrapDeployment.status === "degraded"
          ? "Canonical bootstrap completed in degraded mode."
          : "Canonical bootstrap completed.",
        durationMs: Date.now() - startedAt,
        metadata: {
          bootstrapStatus: bootstrapDeployment.status,
          readinessMarker: bootstrapDeployment.readinessMarker,
          degradedReason: bootstrapDeployment.degradedReason,
          featureKeys: bootstrapDeployment.featureKeys,
        },
      });
    }

    if (currentState === 'BOOTSTRAP_READY') {
      if (!payload.bootstrapDeployment) {
        throw new Error("CANONICAL_BOOTSTRAP_MISSING");
      }

      if (payload.bootstrapDeployment.status === "degraded") {
        await JobRunner.markDegraded(
          jobIdInUse,
          'BOOTSTRAP_READY',
          token!,
          payload.bootstrapDeployment.degradedReason ?? 'Canonical bootstrap completed in degraded mode.',
        );
        await recordProvisioningStepEvent({
          tenantId: params.ownerTenantId,
          saasId: realSaasId,
          correlationId,
          jobId: jobIdInUse,
          step: "job",
          phase: "succeeded",
          severity: "WARNING",
          message: "Provisioning completed in degraded mode after bootstrap.",
          durationMs: Date.now() - executionStartedAt,
          metadata: {
            finalState: "DEGRADED",
            bootstrapStatus: payload.bootstrapDeployment.status,
            degradedReason: payload.bootstrapDeployment.degradedReason,
          },
        });
        return { saasId: realSaasId, status: 'DEGRADED' };
      }

      if (payload.bootstrapDeployment.status !== "ready") {
        throw new Error("CANONICAL_BOOTSTRAP_NOT_READY");
      }

      await JobRunner.completeJob(jobIdInUse, 'BOOTSTRAP_READY', token!);
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "job",
        phase: "succeeded",
        severity: "INFO",
        message: "Provisioning job completed.",
        durationMs: Date.now() - executionStartedAt,
        metadata: {
          finalState: "SUCCESS",
          bootstrapStatus: payload.bootstrapDeployment.status,
          readinessMarker: payload.bootstrapDeployment.readinessMarker,
        },
      });
      return { saasId: realSaasId, status: 'SUCCESS' };
    }
  } catch (error: any) {
    console.error(`[Provision] Job ${jobIdInUse} failed at ${currentState}:`, error);
    await recordProvisioningStepEvent({
      tenantId: params.ownerTenantId,
      saasId: realSaasId,
      correlationId,
      jobId: jobIdInUse,
      step: "job",
      phase: "failed",
      severity: "ERROR",
      message: `Provisioning failed at state ${currentState}.`,
      durationMs: Date.now() - executionStartedAt,
      metadata: {
        state: currentState,
        error: error?.message ?? String(error),
      },
    });

    // --- ROLLBACK LOGIC ---
    try {
      if (token) { // Only attempt rollback if we hold the token
        // TS might think currentState is narrow, cast to avoid "no overlap" error
        await JobRunner.transitionState(jobIdInUse, currentState as ProvisioningJobState, 'ROLLING_BACK', token, error.message);
      }
    } catch (e) { }

    try {
      // Read latest payload to get external IDs
      // (In memory 'payload' variable is updated, but let's assume worst case crash recovery logic would read DB)
      const domains = computeDomainsForSaas(normalized);

      if (currentState === 'BOOTSTRAP_READY' || currentState === 'VERIFY_DOMAIN' || currentState === 'CREATE_DOMAIN_BINDING' || currentState === 'PROVISION_WORKER' || currentState === 'RUNNING') {
        const domains = computeDomainsForSaas(normalized);
        await deleteDomainBinding({
          hostname: domains.primaryHostname,
          bindingId: payload.cloudflareHostnameId,
          correlationId,
          envOverride: params.env,
        });
        await run(`DELETE FROM saas_domains WHERE tenant_id = ? AND saas_id = ?`, params.ownerTenantId, realSaasId);
        await JobRunner.logRollback(jobIdInUse, 'DOMAINS_ROLLED_BACK', `Deleted hostname binding ${domains.primaryHostname}`);
      }

      if (currentState === 'BOOTSTRAP_READY' || currentState === 'VERIFY_DOMAIN') {
        await run(`DELETE FROM saas_features WHERE tenant_id = ? AND saas_id = ?`, params.ownerTenantId, realSaasId);
        await run(`DELETE FROM saas_branding_settings WHERE tenant_id = ? AND saas_id = ?`, params.ownerTenantId, realSaasId);
        await JobRunner.logRollback(jobIdInUse, 'BOOTSTRAP', 'Deleted bootstrap defaults and feature baseline.');
      }

      if (currentState === 'BOOTSTRAP_READY' || currentState === 'VERIFY_DOMAIN' || currentState === 'CREATE_DOMAIN_BINDING' || currentState === 'PROVISION_WORKER' || currentState === 'RUNTIME_DEPLOYED' || currentState === 'STRIPE_PRODUCT_CREATED') {
        if (payload.stripeProductId) {
          await archiveStripeProductAndPrices({
            env: params.env,
            productId: payload.stripeProductId
          });
          await JobRunner.logRollback(jobIdInUse, 'STRIPE_ARCHIVED', `Archived Product ${payload.stripeProductId}`);
        }
      }

      if (currentState === 'BOOTSTRAP_READY' || currentState === 'VERIFY_DOMAIN' || currentState === 'CREATE_DOMAIN_BINDING' || currentState === 'PROVISION_WORKER' || currentState === 'RUNTIME_DEPLOYED' || currentState === 'STRIPE_PRODUCT_CREATED') {
        await run(`DELETE FROM campamento_provisioning WHERE tenant_id = ? AND saas_id = ?`, params.ownerTenantId, realSaasId);
        await JobRunner.logRollback(jobIdInUse, 'RUNTIME_CONTRACT', 'Deleted runtime contract state.');
      }

      if (currentState === 'BOOTSTRAP_READY' || currentState === 'VERIFY_DOMAIN' || currentState === 'CREATE_DOMAIN_BINDING' || currentState === 'PROVISION_WORKER' || currentState === 'RUNTIME_DEPLOYED' || currentState === 'STRIPE_PRODUCT_CREATED' || currentState === 'SAAS_REGISTERED') {
        await run(`DELETE FROM saas_instances WHERE id = ?`, realSaasId);
        await run(`DELETE FROM saas WHERE id = ?`, realSaasId);
        await JobRunner.logRollback(jobIdInUse, 'DB', 'Deleted SaaS records.');
      }
    } catch (rbError) {
      console.error(`[Provision] Rollback partial failure for ${jobIdInUse}:`, rbError);
      await JobRunner.logRollback(jobIdInUse, 'ROLLBACK_ERROR', 'Some cleanup steps failed.');
    }

    if (token) await JobRunner.failJob(jobIdInUse, error.message, token);
    else await JobRunner.failJob(jobIdInUse, error.message);

    return { saasId: realSaasId, status: 'FAILED', error: error.message };
  }

  return { saasId: realSaasId, status: 'UNKNOWN_STATE' };
}

export const createSaasFromBlueprint = provisionSaaS;
