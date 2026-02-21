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

export async function provisionSaaS(params: {
  env?: DracoEnv | null;
  ownerTenantId: string;
  blueprint: SaasBlueprintDraft;
  preAcquiredToken?: { lockVersion: number; ownerId: string };
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

  const generatedSaasId = globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`;
  const idempotencyKey = `prov_saas_${normalized.proposedSlug}`;
  const correlationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // 2. Ensure Job (Idempotent)
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

  const realSaasId = jobResult.entityId;
  let payload = jobResult.payload || normalized;

  if (jobResult.state === 'ACTIVE') {
    return { saasId: realSaasId, status: 'ALREADY_ACTIVE' };
  }

  // 3. Locking
  let token = params.preAcquiredToken;
  const ownerId = token?.ownerId || `orchestrator-${crypto.randomUUID()}`;

  if (!token) {
    try {
      const { lockVersion } = await JobRunner.acquireLock(jobResult.jobId, ownerId);
      token = { lockVersion, ownerId };
    } catch (e: any) {
      if (e.name === 'JobLockedError' || e.message.includes('terminal state')) {
        return { saasId: realSaasId, status: 'RUNNING_OR_TERMINAL' };
      }
      throw e;
    }
  }

  const jobIdInUse = jobResult.jobId;

  // 4. Execution Flow
  // We use 'as ProvisioningJobState' to allow full range of transitions in TS eyes
  let currentState: ProvisioningJobState = (jobResult.state === 'CREATED' ? 'RUNNING' : jobResult.state) as ProvisioningJobState;
  if (jobResult.state === 'CREATED') currentState = 'RUNNING';

  try {
    // --- STEP 1: REGISTER SAAS (Internal DB) ---
    if (currentState === 'RUNNING') {
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
    }

    // --- STEP 2: STRIPE PRODUCT ---
    if (currentState === 'SAAS_REGISTERED') {
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

      // FAULT INJECTION (VERIFICATION ONLY)
      if (params.env?.PROVISIONING_FAULT_AT === 'STRIPE_AFTER_CREATE') {
        throw new Error("Simulated Fault: STRIPE_AFTER_CREATE");
      }
    }

    // --- STEP 3: CLOUDFLARE DOMAINS ---
    if (currentState === 'STRIPE_PRODUCT_CREATED') {
      const cfRes = await provisionSaasInCloudflare({
        env: params.env,
        blueprint: normalized,
        saasId: realSaasId
      });

      if (cfRes.status === 'ERROR') {
        throw new Error(cfRes.message ?? 'Cloudflare provisioning failed');
      }

      // PERSIST EXTERNAL IDs (Hostname ID) - Cloudflare returns it
      if (cfRes.createdCustomHostname) {
        payload = { ...payload, cloudflareHostnameId: cfRes.createdCustomHostname };
        await JobRunner.updatePayload(jobIdInUse, payload, token!);

        // Register in DB
        const ctx = await resolveSaasContext({ tenantId: params.ownerTenantId, saasId: realSaasId, env: params.env });
        const domains = computeDomainsForSaas(normalized);
        await upsertSaasDomain(ctx, { saasId: realSaasId, domain: domains.primaryHostname, isPrimary: true, status: 'active' });

        await JobRunner.transitionState(jobIdInUse, 'STRIPE_PRODUCT_CREATED', 'DOMAINS_REGISTERED', token!, 'Domains configured.');
        currentState = 'DOMAINS_REGISTERED';

        // FAULT INJECTION (VERIFICATION ONLY)
        if (params.env?.PROVISIONING_FAULT_AT === 'CLOUDFLARE_AFTER_CREATE') {
          throw new Error("Simulated Fault: CLOUDFLARE_AFTER_CREATE");
        }
      }

      // --- COMPLETION ---
      if (currentState === 'DOMAINS_REGISTERED') {
        await JobRunner.completeJob(jobIdInUse, 'DOMAINS_REGISTERED', token!);
        return { saasId: realSaasId, status: 'SUCCESS' };
      }

    }
  } catch (error: any) {
    console.error(`[Provision] Job ${jobIdInUse} failed at ${currentState}:`, error);

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
