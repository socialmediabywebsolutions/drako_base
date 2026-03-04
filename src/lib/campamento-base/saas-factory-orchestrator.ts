import { run } from "@/lib/db";
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
import { provisionSaasInCloudflare, computeDomainsForSaas, deleteCloudflareHostname } from "@/lib/campamento-base/provisioning/cloudflare-factory";
import { resolveSaasContext, upsertSaasDomain } from "@/lib/saas/repository";
import { recordCampamentoEvent } from "@/lib/empire/events";

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
};

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
  try {
    await recordCampamentoEvent({
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
    });
  } catch (eventError) {
    console.error("[Provision] Failed to write campamento event", eventError);
  }
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
                 VALUES (?, ?, ?, ?, 'active', 'trial', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
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

    // --- STEP 3: CLOUDFLARE DOMAINS ---
    if (currentState === 'STRIPE_PRODUCT_CREATED') {
      const startedAt = Date.now();
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "domains",
        phase: "started",
        severity: "INFO",
        message: "Domains provisioning started.",
      });

      const cfRes = await provisionSaasInCloudflare({
        env: params.env,
        blueprint: normalized,
        saasId: realSaasId
      });

      if (cfRes.status === 'ERROR') {
        throw new Error(cfRes.message ?? 'Cloudflare provisioning failed');
      }

      // Persist provider identifiers when available.
      if (cfRes.createdCustomHostname) {
        payload = { ...payload, cloudflareHostnameId: cfRes.createdCustomHostname };
        await JobRunner.updatePayload(jobIdInUse, payload, token!);
      }

      // Register canonical domain state even when provider is pending.
      const ctx = await resolveSaasContext({ tenantId: params.ownerTenantId, saasId: realSaasId, env: params.env });
      const domains = computeDomainsForSaas(normalized);
      await upsertSaasDomain(ctx, {
        id: `factory_domain_${realSaasId}`,
        saasId: realSaasId,
        domain: domains.primaryHostname,
        isPrimary: true,
        status: cfRes.createdCustomHostname ? 'active' : 'pending',
      });

      await JobRunner.transitionState(
        jobIdInUse,
        'STRIPE_PRODUCT_CREATED',
        'DOMAINS_REGISTERED',
        token!,
        cfRes.createdCustomHostname ? 'Domains configured.' : 'Domain provisioning pending provider verification.',
      );
      currentState = 'DOMAINS_REGISTERED';
      await recordProvisioningStepEvent({
        tenantId: params.ownerTenantId,
        saasId: realSaasId,
        correlationId,
        jobId: jobIdInUse,
        step: "domains",
        phase: "succeeded",
        severity: "INFO",
        message: "Domains provisioning completed.",
        durationMs: Date.now() - startedAt,
        metadata: {
          customHostnameId: payload.cloudflareHostnameId ?? null,
          providerStatus: cfRes.status,
        },
      });

      // FAULT INJECTION (VERIFICATION ONLY)
      if (params.env?.PROVISIONING_FAULT_AT === 'CLOUDFLARE_AFTER_CREATE') {
        throw new Error("Simulated Fault: CLOUDFLARE_AFTER_CREATE");
      }

      // --- COMPLETION ---
      if (currentState === 'DOMAINS_REGISTERED') {
        await JobRunner.completeJob(jobIdInUse, 'DOMAINS_REGISTERED', token!);
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

      if (currentState === 'DOMAINS_REGISTERED' || currentState === 'RUNNING') {
        // Real Cloudflare ID?
        const domains = computeDomainsForSaas(normalized);
        // We try delete by Hostname if ID missing, or use ID if present
        await deleteCloudflareHostname({ env: params.env, hostname: domains.primaryHostname });
        await JobRunner.logRollback(jobIdInUse, 'DOMAINS_ROLLED_BACK', `Hard deleted hostname ${domains.primaryHostname}`);
      }

      if (currentState === 'DOMAINS_REGISTERED' || currentState === 'STRIPE_PRODUCT_CREATED') {
        if (payload.stripeProductId) {
          await archiveStripeProductAndPrices({
            env: params.env,
            productId: payload.stripeProductId
          });
          await JobRunner.logRollback(jobIdInUse, 'STRIPE_ARCHIVED', `Archived Product ${payload.stripeProductId}`);
        }
      }

      if (currentState === 'DOMAINS_REGISTERED' || currentState === 'STRIPE_PRODUCT_CREATED' || currentState === 'SAAS_REGISTERED') {
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
