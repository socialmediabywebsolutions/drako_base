import { queryOne, run } from "@/lib/db";
import type { DracoEnv } from "@/lib/cf";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
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

function normalizeRuntimeDomainStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "pending";
  return normalized;
}

async function upsertRuntimeContract(params: {
  tenantId: string;
  saasId: string;
  correlationId: string;
  trialDomain: string;
  customDomain: string | null;
  status: RuntimeContractStatus;
  lastError?: string | null;
}) {
  const now = new Date().toISOString();
  const plan = JSON.stringify({
    runtimeName: CANONICAL_RUNTIME_NAME,
    routeType: "trial_domain",
    trialDomain: params.trialDomain,
    customDomain: params.customDomain,
  });

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
    params.status,
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
  const [saasRow, instanceRow, runtimeRow] = await Promise.all([
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
    queryOne<{ status: string | null }>(
      `SELECT status
       FROM campamento_provisioning
       WHERE tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      params.tenantId,
      params.saasId,
    ),
  ]);

  return {
    saasStatus: saasRow?.status ?? null,
    saasDomainStatus: saasRow?.domain_status ?? null,
    saasDomain: saasRow?.domain ?? null,
    saasPublicDomain: saasRow?.public_domain ?? null,
    instanceStatus: instanceRow?.status ?? null,
    instanceTrialDomain: instanceRow?.trial_domain ?? null,
    instanceCustomDomain: instanceRow?.custom_domain ?? null,
    instanceDomainStatus: instanceRow?.domain_status ?? null,
    runtimeContractStatus: runtimeRow?.status ?? null,
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

  await upsertRuntimeContract({
    tenantId: params.tenantId,
    saasId: params.saasId,
    correlationId: params.correlationId,
    trialDomain,
    customDomain,
    status: "provisioning",
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

  await upsertRuntimeContract({
    tenantId: params.tenantId,
    saasId: params.saasId,
    correlationId: params.correlationId,
    trialDomain: params.runtimeDeployment.trialDomain,
    customDomain: params.runtimeDeployment.customDomain,
    status: nextContractStatus,
    lastError: params.activationResult === "degraded"
      ? `Canonical runtime waiting on domain status ${normalizedDomainStatus}.`
      : null,
  });

  const snapshot = await loadRuntimeActivationSnapshot({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  if (params.activationResult === "active") {
    if (!isRuntimeActivationReady(snapshot, params.runtimeDeployment)) {
      throw new Error("CANONICAL_RUNTIME_ACTIVATION_NOT_READY");
    }
    return {
      ...params.runtimeDeployment,
      status: "active",
      activationReady: true,
      lastKnownDomainStatus: "active",
    };
  }

  if (!isRuntimeDegradedConsistent(snapshot, {
    trialDomain: params.runtimeDeployment.trialDomain,
    customDomain: params.runtimeDeployment.customDomain,
    domainStatus: normalizedDomainStatus,
  })) {
    throw new Error("CANONICAL_RUNTIME_DEGRADED_INCONSISTENT");
  }

  return {
    ...params.runtimeDeployment,
    status: "degraded",
    activationReady: false,
    lastKnownDomainStatus: normalizedDomainStatus,
  };
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

      await JobRunner.completeJob(jobIdInUse, 'VERIFY_DOMAIN', token!);
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
        metadata: { finalState: "SUCCESS" },
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

      if (currentState === 'VERIFY_DOMAIN' || currentState === 'CREATE_DOMAIN_BINDING' || currentState === 'PROVISION_WORKER' || currentState === 'RUNNING') {
        const domains = computeDomainsForSaas(normalized);
        await deleteDomainBinding({
          hostname: domains.primaryHostname,
          bindingId: payload.cloudflareHostnameId,
          correlationId,
          envOverride: params.env,
        });
        await JobRunner.logRollback(jobIdInUse, 'DOMAINS_ROLLED_BACK', `Deleted hostname binding ${domains.primaryHostname}`);
      }

      if (currentState === 'VERIFY_DOMAIN' || currentState === 'CREATE_DOMAIN_BINDING' || currentState === 'PROVISION_WORKER' || currentState === 'RUNTIME_DEPLOYED' || currentState === 'STRIPE_PRODUCT_CREATED') {
        if (payload.stripeProductId) {
          await archiveStripeProductAndPrices({
            env: params.env,
            productId: payload.stripeProductId
          });
          await JobRunner.logRollback(jobIdInUse, 'STRIPE_ARCHIVED', `Archived Product ${payload.stripeProductId}`);
        }
      }

      if (currentState === 'VERIFY_DOMAIN' || currentState === 'CREATE_DOMAIN_BINDING' || currentState === 'PROVISION_WORKER' || currentState === 'RUNTIME_DEPLOYED' || currentState === 'STRIPE_PRODUCT_CREATED') {
        await run(`DELETE FROM campamento_provisioning WHERE tenant_id = ? AND saas_id = ?`, params.ownerTenantId, realSaasId);
        await JobRunner.logRollback(jobIdInUse, 'RUNTIME_CONTRACT', 'Deleted runtime contract state.');
      }

      if (currentState === 'VERIFY_DOMAIN' || currentState === 'CREATE_DOMAIN_BINDING' || currentState === 'PROVISION_WORKER' || currentState === 'RUNTIME_DEPLOYED' || currentState === 'STRIPE_PRODUCT_CREATED' || currentState === 'SAAS_REGISTERED') {
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
