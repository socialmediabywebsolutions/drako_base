import { run, queryAll } from "@/lib/db";
import type { DracoEnv } from "@/lib/cf";
import { ensureCampamentoBase } from "@/lib/campamento-base";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { computeDefaultProvisioningForBlueprint, prepareStripePricingFromBlueprint } from "@/lib/campamento-base/saas-provisioning-plan";
import { createAgentsForSaasFromPacks } from "@/lib/campamento-base/agent-factory";
import { provisionSaasInCloudflare } from "@/lib/campamento-base/provisioning/cloudflare-factory";
import { computeDomainsForSaas } from "@/lib/campamento-base/provisioning/cloudflare-factory";
import { ensureStripeProductForSaas } from "@/lib/campamento-base/provisioning/stripe-factory";
import { materializeAiConfigForSaas } from "@/lib/campamento-base/provisioning/ai-factory";
import { normalizeCampamentoBaseProfileForBlueprint } from "@/lib/campamento-base/saas-factory-helpers";
import { resolveSaasMarketingContext, upsertSaasMarketingPlan } from "@/lib/saas/marketing-repository";
import { getMarketingPacksForVertical } from "@/lib/saas/marketing-packs";
import { resolveTaxContext, upsertSaasTaxProfile } from "@/lib/tax/repository";
import { resolveVendorExpensesContext, upsertVendorExpense } from "@/lib/owner/vendor-expenses";
import { resolveSaasContext, upsertSaasDomain } from "@/lib/saas/repository";
import { normalizeHostnameInput } from "@/lib/empire/domain-utils";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { upsertProvisioningState } from "@/lib/empire/provisioning-state";
import { resolveHostToSaas } from "@/lib/empire/host-resolver";

type ProvisioningRecord = {
  id: string;
  step: string;
  status: string;
  details: string | null;
};

function generateId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now()}`;
}

function resolveProvisioningEnabled(env?: DracoEnv | null): boolean {
  const raw =
    (env as unknown as Record<string, string | undefined> | null)?.DRACO_PROVISIONING_ENABLED ??
    process.env.DRACO_PROVISIONING_ENABLED;
  if (!raw) return false;
  return raw.toLowerCase() === "true" || raw === "1" || raw.toLowerCase() === "on";
}

function resolveProvisioningMode(env?: DracoEnv | null): "dry_run" | "live" {
  const raw =
    (env as unknown as Record<string, string | undefined> | null)?.DRACO_PROVISIONING_MODE ??
    process.env.DRACO_PROVISIONING_MODE ??
    "dry_run";
  return raw === "live" ? "live" : "dry_run";
}

async function recordFactoryEvent(params: {
  tenantId: string;
  saasId?: string | null;
  saasSlug?: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}) {
  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    type: params.type,
    severity: params.severity,
    source: "FACTORY",
    message: params.message,
    metadata: { saasSlug: params.saasSlug, ...params.metadata },
    correlationId: params.correlationId,
  });
}

async function recordProvisioningEvent(params: {
  tenantId: string;
  saasId?: string | null;
  saasSlug?: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}) {
  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    type: params.type,
    severity: params.severity,
    source: "PROVISIONING",
    message: params.message,
    metadata: { saasSlug: params.saasSlug, ...params.metadata },
    correlationId: params.correlationId,
  });
}

async function safeExecute(label: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error("SAAS_FACTORY_STEP_ERROR", label, error);
  }
}

async function recordProvisioningStep(params: {
  tenantId: string;
  saasId: string;
  step: string;
  status: "PENDING" | "SUCCESS" | "ERROR";
  details?: string | null;
}): Promise<ProvisioningRecord> {
  const id = generateId("prov");
  const status = params.status;
  const details = params.details ?? null;
  await run(
    "INSERT INTO provisioning (id, tenant_id, saas_id, step, status, details) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    params.tenantId,
    params.saasId,
    params.step,
    status,
    details,
  );
  return { id, step: params.step, status, details };
}

async function registerMarketingPlan(params: {
  env?: DracoEnv | null;
  tenantId: string;
  saasId: string;
  blueprint: SaasBlueprintDraft;
}): Promise<void> {
  const tier = params.blueprint.campamentoBaseProfile?.packsByDepartment.MARKETING ?? params.blueprint.packsByDepartment.marketing;
  const enabled = params.blueprint.campamentoBaseProfile?.departmentsEnabled?.includes("MARKETING") ?? Boolean(tier);
  if (!enabled) return;
  if (!tier) return;
  const packs = getMarketingPacksForVertical(params.blueprint.verticalId);
  const pack = packs.find((item) => item.tier === tier) ?? packs[0];
  if (!pack) return;
  const ctx = await resolveSaasMarketingContext({ tenantId: params.tenantId, env: params.env });
  await upsertSaasMarketingPlan(ctx, {
    saasId: params.saasId,
    includedPostsPerMonth: pack.includedPostsPerMonth,
    includedCampaignsPerMonth: pack.includedCampaignsPerMonth,
    extraPostPrice: 0,
    extraCampaignPrice: pack.recommendedMonthlyPrice,
    notes: `Plan inicial (${pack.tier}) por Campamento Base`,
  });
}

async function registerTaxProfile(params: {
  env?: DracoEnv | null;
  tenantId: string;
  saasId: string;
  blueprint: SaasBlueprintDraft;
}): Promise<void> {
  const enabled = params.blueprint.campamentoBaseProfile?.departmentsEnabled?.includes("TAX") ?? true;
  if (!enabled) return;
  const ctx = await resolveTaxContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const taxProfile = params.blueprint.provisioning?.stripe.taxProfile ?? "ES_AUTONOMO";
  const profile =
    taxProfile === "ES_SL"
      ? { country: "ES", regime: "ES_SL", defaultVatRate: 0.21, usesWithholding: false, incomeTaxMode: "CORPORATE" }
      : taxProfile === "ES_AUTONOMO"
        ? { country: "ES", regime: "ES_AUTONOMO", defaultVatRate: 0.21, usesWithholding: true, withholdingRate: 0.15, incomeTaxMode: "PERSONAL" }
        : { country: "ES", regime: "OTHER", defaultVatRate: 0.21, usesWithholding: false, incomeTaxMode: "OTHER" };

  await upsertSaasTaxProfile(ctx, {
    saasId: params.saasId,
    country: profile.country,
    region: null,
    regime: profile.regime,
    defaultVatRate: profile.defaultVatRate,
    reducedVatRate: null,
    superReducedVatRate: null,
    usesWithholding: profile.usesWithholding,
    withholdingRate: profile.withholdingRate ?? 0,
    incomeTaxMode: profile.incomeTaxMode,
    metadata: { source: "campamento_base" },
  });
}

async function registerVendorExpectation(params: {
  env?: DracoEnv | null;
  tenantId: string;
  saasId: string;
  blueprint: SaasBlueprintDraft;
}): Promise<void> {
  const estimated = params.blueprint.initialPricing.estimatedVendorCostMonthly ?? null;
  if (!estimated || estimated <= 0) return;
  const ctx = await resolveVendorExpensesContext({ tenantId: params.tenantId, env: params.env });
  await upsertVendorExpense(ctx, {
    label: `Base vendor ${params.blueprint.saasName}`,
    type: "INFRA",
    amount: estimated,
    currency: "EUR",
    period: "MONTHLY",
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: null,
    verticalId: params.blueprint.verticalId,
    metadata: { saasId: params.saasId, source: "campamento_base" },
  });
}

export async function createSaasFromBlueprint(params: {
  env?: DracoEnv | null;
  ownerTenantId: string;
  blueprint: SaasBlueprintDraft;
}): Promise<{
  saasId: string;
  cloudflare: Awaited<ReturnType<typeof provisionSaasInCloudflare>>;
  stripe: Awaited<ReturnType<typeof ensureStripeProductForSaas>>;
  ai: Awaited<ReturnType<typeof materializeAiConfigForSaas>>;
}> {
  await ensureCampamentoBase();

  const correlationId = generateId("corr");
  const provisioningEnabled = resolveProvisioningEnabled(params.env);
  const provisioningMode = resolveProvisioningMode(params.env);

  const normalized = normalizeCampamentoBaseProfileForBlueprint(
    prepareStripePricingFromBlueprint(
      computeDefaultProvisioningForBlueprint(params.blueprint),
      null,
    ),
    { applyDefaults: true },
  );

  const saasId = generateId("saas");
  const domain = normalized.provisioning?.domains.customDomainRequested ?? null;
  const subdomain = normalized.provisioning?.domains.primarySubdomain ?? normalized.proposedSubdomain;
  const now = new Date().toISOString();

  await recordFactoryEvent({
    tenantId: params.ownerTenantId,
    saasSlug: normalized.proposedSlug,
    type: "factory.blueprint_created",
    severity: "INFO",
    message: `Blueprint creado para ${normalized.saasName}.`,
    correlationId,
    metadata: { provisioningMode },
  });

  await run(
    "INSERT INTO saas (id, name, slug, domain, subdomain, status, tenant_id, public_domain, public_subdomain, domain_status) VALUES (?, ?, ?, ?, ?, 'inactive', ?, NULL, ?, 'unconfigured')",
    saasId,
    normalized.saasName,
    normalized.proposedSlug,
    domain,
    subdomain,
    params.ownerTenantId,
    subdomain,
  );

  await recordFactoryEvent({
    tenantId: params.ownerTenantId,
    saasId,
    saasSlug: normalized.proposedSlug,
    type: "factory.saas_created",
    severity: "INFO",
    message: `SaaS creado: ${normalized.saasName}.`,
    correlationId,
  });

  await safeExecute("register_saas_project", async () => {
    await run(
      `INSERT INTO saas_projects (id, tenant_id, slug, display_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         display_name = excluded.display_name,
         status = excluded.status,
         updated_at = excluded.updated_at`,
      saasId,
      params.ownerTenantId,
      normalized.proposedSlug,
      normalized.saasName,
      now,
      now,
    );
  });

  await recordFactoryEvent({
    tenantId: params.ownerTenantId,
    saasId,
    saasSlug: normalized.proposedSlug,
    type: "saas.registered",
    severity: "INFO",
    message: `SaaS registrado en el registry.`,
    correlationId,
  });

  await safeExecute("register_saas_domains", async () => {
    const ctx = await resolveSaasContext({ tenantId: params.ownerTenantId, saasId, env: params.env });
    const domains = computeDomainsForSaas(normalized);
    const canonicalNormalized = normalizeHostnameInput(domains.primaryHostname);
    const canonicalHost = canonicalNormalized.hostname ?? domains.primaryHostname;
    const customNormalized = domains.customHostname ? normalizeHostnameInput(domains.customHostname) : null;
    const customHost = customNormalized?.hostname ?? null;
    let canonicalStatus: "active" | "pending" = "active";
    if (provisioningEnabled && provisioningMode === "live") {
      const resolution = await resolveHostToSaas(canonicalHost);
      canonicalStatus = resolution.status === "ACTIVE" ? "active" : "pending";
    }
    await upsertSaasDomain(ctx, {
      saasId,
      domain: canonicalHost,
      isPrimary: true,
      status: canonicalStatus,
      lastCheckedAt: now,
    });
    if (domains.customHostname && !customHost) {
      await recordProvisioningEvent({
        tenantId: params.ownerTenantId,
        saasId,
        saasSlug: normalized.proposedSlug,
        type: "provision.cloudflare.failed",
        severity: "ERROR",
        message: "Custom domain invalido para provisioning.",
        correlationId,
        metadata: { reason: customNormalized?.reason ?? "INVALID_HOST" },
      });
      return;
    }
    if (customHost) {
      await upsertSaasDomain(ctx, {
        saasId,
        domain: customHost,
        isPrimary: false,
        status: "pending",
      });
    }
  });

  await safeExecute("register_provisioning_state", async () => {
    await upsertProvisioningState({
      tenantId: params.ownerTenantId,
      saasId,
      mode: provisioningMode,
      status: provisioningEnabled && provisioningMode === "live" ? "RUNNING" : "PENDING",
      plan: {
        saasSlug: normalized.proposedSlug,
        primaryHostname: `${normalized.proposedSlug}.apps.drako.systems`,
        customHostname: normalized.provisioning?.domains.customDomainRequested ?? null,
      },
      correlationId,
    });
  });

  const alertId = generateId("alert");
  await run(
    "INSERT INTO alerts (id, tenant_id, severity, source, message, saas_id) VALUES (?, ?, 'info', 'SaaS Factory', ?, ?)",
    alertId,
    params.ownerTenantId,
    `Campamento Base inició el provisioning para '${normalized.saasName}'.`,
    saasId,
  );

  await safeExecute("record_provisioning_campamento", async () => {
    await recordProvisioningStep({
      tenantId: params.ownerTenantId,
      saasId,
      step: "campamento_base",
      status: "SUCCESS",
      details: "Registro en Campamento Base completado.",
    });
  });

  await safeExecute("register_marketing_plan", async () => {
    await registerMarketingPlan({
      tenantId: params.ownerTenantId,
      saasId,
      blueprint: normalized,
      env: params.env,
    });
  });

  await safeExecute("register_tax_profile", async () => {
    await registerTaxProfile({
      tenantId: params.ownerTenantId,
      saasId,
      blueprint: normalized,
      env: params.env,
    });
  });

  await safeExecute("register_vendor_expectation", async () => {
    await registerVendorExpectation({
      tenantId: params.ownerTenantId,
      saasId,
      blueprint: normalized,
      env: params.env,
    });
  });

  await recordProvisioningEvent({
    tenantId: params.ownerTenantId,
    saasId,
    saasSlug: normalized.proposedSlug,
    type: "provision.cloudflare.started",
    severity: "INFO",
    message: "Provisioning de dominios iniciado.",
    correlationId,
    metadata: { mode: provisioningMode },
  });

  const ai = await materializeAiConfigForSaas({ env: params.env, saasId, blueprint: normalized });
  const cloudflare = await provisionSaasInCloudflare({ env: params.env, blueprint: normalized, saasId });
  const stripe = await ensureStripeProductForSaas({
    env: params.env,
    blueprint: normalized,
    pricingRecommendation: null,
    saasId,
    tenantId: params.ownerTenantId,
    correlationId,
  });

  await safeExecute("record_provisioning_cloudflare", async () => {
    await recordProvisioningStep({
      tenantId: params.ownerTenantId,
      saasId,
      step: "cloudflare",
      status: cloudflare.status,
      details: cloudflare.message ?? null,
    });
  });

  await recordProvisioningEvent({
    tenantId: params.ownerTenantId,
    saasId,
    saasSlug: normalized.proposedSlug,
    type: cloudflare.status === "ERROR" ? "provision.cloudflare.failed" : "provision.cloudflare.done",
    severity: cloudflare.status === "ERROR" ? "ERROR" : "INFO",
    message: cloudflare.message ?? "Provisioning dominios completado.",
    correlationId,
  });

  await safeExecute("record_provisioning_stripe", async () => {
    await recordProvisioningStep({
      tenantId: params.ownerTenantId,
      saasId,
      step: "stripe",
      status: stripe.status,
      details: stripe.message ?? null,
    });
  });

  await safeExecute("record_provisioning_ai", async () => {
    await recordProvisioningStep({
      tenantId: params.ownerTenantId,
      saasId,
      step: "ai",
      status: "SUCCESS",
      details: `AI tier: ${ai.profile.tier}`,
    });
  });

  await safeExecute("update_provisioning_state", async () => {
    if (!provisioningEnabled || provisioningMode !== "live") return;
    const status = cloudflare.status === "ERROR" || stripe.status === "ERROR" ? "FAILED" : "DONE";
    await upsertProvisioningState({
      tenantId: params.ownerTenantId,
      saasId,
      mode: provisioningMode,
      status,
      plan: {
        saasSlug: normalized.proposedSlug,
        primaryHostname: `${normalized.proposedSlug}.apps.drako.systems`,
        customHostname: normalized.provisioning?.domains.customDomainRequested ?? null,
      },
      correlationId,
      lastError: cloudflare.status === "ERROR" ? cloudflare.message ?? "Cloudflare error" : null,
    });
  });

  await safeExecute("materialize_agents", async () => {
    await createAgentsForSaasFromPacks({
      env: params.env,
      tenantId: params.ownerTenantId,
      saasId,
      blueprint: normalized,
    });
  });

  return { saasId, cloudflare, stripe, ai };
}

export async function listRecentSaasFactoryProvisioning(params: {
  tenantId: string;
  limit?: number;
}): Promise<Array<{
  saasId: string;
  saasName: string;
  createdAt: string;
  provisioning: Array<{ step: string; status: string; details: string | null }>;
}>> {
  const limit = params.limit ?? 8;
  const saasRows = await queryAll<{ id: string; name: string; created_at: string }>(
    "SELECT id, name, created_at FROM saas WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?",
    params.tenantId,
    limit,
  );
  if (!saasRows.length) return [];

  const saasIds = saasRows.map((row) => row.id);
  const placeholders = saasIds.map(() => "?").join(",");
  const provisioningRows = await queryAll<{ saas_id: string; step: string; status: string; details: string | null }>(
    `SELECT saas_id, step, status, details FROM provisioning WHERE tenant_id = ? AND saas_id IN (${placeholders}) ORDER BY created_at DESC`,
    params.tenantId,
    ...saasIds,
  );

  return saasRows.map((row) => ({
    saasId: row.id,
    saasName: row.name,
    createdAt: row.created_at,
    provisioning: provisioningRows.filter((prov) => prov.saas_id === row.id).map((prov) => ({
      step: prov.step,
      status: prov.status,
      details: prov.details ?? null,
    })),
  }));
}
