import Stripe from "stripe";
import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll } from "@/lib/db";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import type { SaasPricingRecommendation } from "@/lib/owner/pricing-engine";
import { recordCampamentoEvent } from "@/lib/empire/events";
import {
  findStripeMapping,
  upsertStripeMapping,
  type StripeMapping,
  type StripePriceMeta,
} from "@/lib/billing/stripe-mapping-repository";

export type StripeProvisioningResult = {
  status: "PENDING" | "SUCCESS" | "ERROR";
  message?: string;
  productId?: string;
  priceIds?: Record<string, string>;
  payloads?: Record<string, unknown> | null;
};

export type StripeMappingStore = {
  findMapping: (params: { tenantId: string; saasId: string; saasSlug: string }) => Promise<StripeMapping | null>;
  upsertMapping: (params: {
    tenantId: string;
    saasId: string;
    saasSlug: string;
    stripeProductId: string;
    stripePriceIds: Record<string, string>;
    stripePriceMeta: Record<string, StripePriceMeta>;
  }) => Promise<StripeMapping | null>;
};

const defaultStripeMappingStore: StripeMappingStore = {
  findMapping: findStripeMapping,
  upsertMapping: upsertStripeMapping,
};

function resolveSecretKey(envOverride?: DracoEnv | null): string | null {
  if (typeof process !== "undefined" && process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }
  const cfEnv = envOverride ?? resolveEnv();
  return cfEnv?.STRIPE_SECRET_KEY ?? null;
}

function resolveBillingInterval(blueprint: SaasBlueprintDraft): "month" | "year" {
  return blueprint.provisioning?.stripe.billingInterval === "YEARLY" ? "year" : "month";
}

function resolveProvisioningEnabled(envOverride?: DracoEnv | null): boolean {
  const raw =
    (envOverride as unknown as Record<string, string | undefined> | null)?.DRACO_PROVISIONING_ENABLED ??
    process.env.DRACO_PROVISIONING_ENABLED;
  if (!raw) return false;
  return raw.toLowerCase() === "true" || raw === "1" || raw.toLowerCase() === "on";
}

function resolveProvisioningMode(envOverride?: DracoEnv | null): "dry_run" | "live" {
  const raw =
    (envOverride as unknown as Record<string, string | undefined> | null)?.DRACO_PROVISIONING_MODE ??
    process.env.DRACO_PROVISIONING_MODE ??
    "dry_run";
  return raw === "live" ? "live" : "dry_run";
}

function resolveStripeGateRequired(envOverride?: DracoEnv | null): boolean {
  const raw =
    (envOverride as unknown as Record<string, string | undefined> | null)?.DRACO_STRIPE_LIVE_REQUIRE_CANONICAL_ACTIVE ??
    process.env.DRACO_STRIPE_LIVE_REQUIRE_CANONICAL_ACTIVE ??
    "true";
  return raw.toLowerCase() !== "false" && raw !== "0";
}

function resolveStripeOverride(envOverride?: DracoEnv | null): boolean {
  const raw =
    (envOverride as unknown as Record<string, string | undefined> | null)?.DRACO_STRIPE_LIVE_OVERRIDE ??
    process.env.DRACO_STRIPE_LIVE_OVERRIDE ??
    "false";
  return raw.toLowerCase() === "true" || raw === "1" || raw.toLowerCase() === "on";
}

function resolvePriceInCents(blueprint: SaasBlueprintDraft, recommendation?: SaasPricingRecommendation | null): number {
  const candidate =
    blueprint.initialPricing.recommendedTargetPriceMonthly ??
    recommendation?.recommendedTargetPriceMonthly ??
    blueprint.initialPricing.currentMonthlyPrice ??
    0;
  return Math.max(0, Math.round(candidate * 100));
}

function buildPriceMeta(params: { currency: string; interval: "month" | "year"; amountCents: number }): StripePriceMeta {
  return {
    currency: params.currency.toLowerCase(),
    interval: params.interval,
    amountCents: params.amountCents,
  };
}

async function fetchCanonicalDomainStatus(params: { tenantId: string; saasId: string }): Promise<string | null> {
  const rows = await queryAll<{ status: string }>(
    "SELECT status FROM saas_domains WHERE tenant_id = ? AND saas_id = ? AND is_primary = 1 LIMIT 1",
    params.tenantId,
    params.saasId,
  );
  return rows[0]?.status ?? null;
}

function isCanonicalActive(status?: string | null): boolean {
  return (status ?? "").toLowerCase() === "active";
}

function buildStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {});
}

async function recordBillingEvent(params: {
  tenantId: string;
  saasId: string;
  saasSlug: string;
  correlationId: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: params.saasId,
    type: params.type,
    severity: params.severity,
    source: "BILLING",
    message: params.message,
    metadata: { saasSlug: params.saasSlug, ...params.metadata },
    correlationId: params.correlationId,
  });
}

export async function ensureStripeProductForSaas(params: {
  env?: DracoEnv | null;
  blueprint: SaasBlueprintDraft;
  pricingRecommendation?: SaasPricingRecommendation | null;
  saasId: string;
  tenantId: string;
  correlationId?: string;
  stripeClient?: Stripe;
  mappingStore?: StripeMappingStore;
}): Promise<StripeProvisioningResult> {
  const correlationId = params.correlationId ?? `stripe_${Date.now()}`;
  const provisioningEnabled = resolveProvisioningEnabled(params.env ?? null);
  const provisioningMode = resolveProvisioningMode(params.env ?? null);
  const stripeGateRequired = resolveStripeGateRequired(params.env ?? null);
  const stripeOverride = resolveStripeOverride(params.env ?? null);

  const priceInCents = resolvePriceInCents(params.blueprint, params.pricingRecommendation);
  if (priceInCents <= 0) {
    await recordBillingEvent({
      tenantId: params.tenantId,
      saasId: params.saasId,
      saasSlug: params.blueprint.proposedSlug,
      correlationId,
      type: "billing.stripe.synced",
      severity: "WARNING",
      message: "Stripe provisioning bloqueado: precio invalido.",
      metadata: { reason: "PRICE_NOT_READY" },
    });
    return { status: "ERROR", message: "Stripe pricing not available for this SaaS yet." };
  }

  const billingInterval = resolveBillingInterval(params.blueprint);
  const currency = params.blueprint.provisioning?.stripe.currency ?? "EUR";
  const planKey = "core";
  const priceMeta = buildPriceMeta({ currency, interval: billingInterval, amountCents: priceInCents });

  const productPayload: Stripe.ProductCreateParams = {
    name: params.blueprint.saasName,
    description: params.blueprint.summary,
    metadata: {
      saasId: params.saasId,
      verticalId: params.blueprint.verticalId,
      slug: params.blueprint.proposedSlug,
      tenantId: params.tenantId,
    },
  };

  const pricePayload: Stripe.PriceCreateParams = {
    currency,
    unit_amount: priceInCents,
    recurring: { interval: billingInterval },
    product_data: { name: params.blueprint.saasName },
  };

  if (!provisioningEnabled || provisioningMode !== "live") {
    return {
      status: "PENDING",
      message: "Stripe provisioning disabled or dry-run mode.",
      payloads: { productPayload, pricePayload },
    };
  }

  const canonicalStatus = await fetchCanonicalDomainStatus({ tenantId: params.tenantId, saasId: params.saasId });
  if (stripeGateRequired && !stripeOverride && !isCanonicalActive(canonicalStatus)) {
    await recordBillingEvent({
      tenantId: params.tenantId,
      saasId: params.saasId,
      saasSlug: params.blueprint.proposedSlug,
      correlationId,
      type: "billing.stripe.synced",
      severity: "WARNING",
      message: "Stripe provisioning omitido: canonical domain no activo.",
      metadata: { reason: "CANONICAL_NOT_ACTIVE", canonicalStatus },
    });
    return {
      status: "PENDING",
      message: "Stripe gated: canonical domain not active.",
      payloads: { productPayload, pricePayload },
    };
  }

  const stripeClient = params.stripeClient ?? (() => {
    const secretKey = resolveSecretKey(params.env ?? null);
    if (!secretKey) return null;
    return buildStripeClient(secretKey);
  })();

  if (!stripeClient) {
    await recordBillingEvent({
      tenantId: params.tenantId,
      saasId: params.saasId,
      saasSlug: params.blueprint.proposedSlug,
      correlationId,
      type: "billing.stripe.synced",
      severity: "WARNING",
      message: "Stripe provisioning deshabilitado: falta STRIPE_SECRET_KEY.",
      metadata: { reason: "STRIPE_SECRET_MISSING" },
    });
    return { status: "PENDING", message: "Stripe provisioning disabled in this env." };
  }

  const mappingStore = params.mappingStore ?? defaultStripeMappingStore;
  let mapping = await mappingStore.findMapping({
    tenantId: params.tenantId,
    saasId: params.saasId,
    saasSlug: params.blueprint.proposedSlug,
  });

  let productId = mapping?.stripeProductId ?? null;
  if (productId) {
    try {
      await stripeClient.products.update(productId, { metadata: productPayload.metadata ?? {} });
      await recordBillingEvent({
        tenantId: params.tenantId,
        saasId: params.saasId,
        saasSlug: params.blueprint.proposedSlug,
        correlationId,
        type: "billing.stripe.product.reconciled",
        severity: "INFO",
        message: "Stripe product reconciled.",
        metadata: { productId, action: "update" },
      });
    } catch {
      productId = null;
    }
  }

  if (!productId) {
    let existingProductId: string | null = null;
    if (typeof stripeClient.products.search === "function") {
      try {
        const search = await stripeClient.products.search({
          query: `metadata['slug']:'${params.blueprint.proposedSlug}' AND metadata['tenantId']:'${params.tenantId}'`,
          limit: 1,
        });
        existingProductId = search.data[0]?.id ?? null;
      } catch {
        existingProductId = null;
      }
    }
    if (existingProductId) {
      productId = existingProductId;
      await stripeClient.products.update(productId, { metadata: productPayload.metadata ?? {} });
      await recordBillingEvent({
        tenantId: params.tenantId,
        saasId: params.saasId,
        saasSlug: params.blueprint.proposedSlug,
        correlationId,
        type: "billing.stripe.product.reconciled",
        severity: "INFO",
        message: "Stripe product matched by metadata.",
        metadata: { productId, action: "matched" },
      });
    } else {
      const product = await stripeClient.products.create(productPayload);
      productId = product.id;
      await recordBillingEvent({
        tenantId: params.tenantId,
        saasId: params.saasId,
        saasSlug: params.blueprint.proposedSlug,
        correlationId,
        type: "billing.stripe.product.reconciled",
        severity: "INFO",
        message: "Stripe product created.",
        metadata: { productId, action: "created" },
      });
    }
  }

  if (!productId) {
    await recordBillingEvent({
      tenantId: params.tenantId,
      saasId: params.saasId,
      saasSlug: params.blueprint.proposedSlug,
      correlationId,
      type: "billing.stripe.synced",
      severity: "ERROR",
      message: "Stripe provisioning fallido: productId nulo.",
      metadata: { reason: "PRODUCT_MISSING" },
    });
    return { status: "ERROR", message: "Stripe product missing after reconciliation." };
  }

  const priceIds = { ...(mapping?.stripePriceIds ?? {}) };
  const priceMetaMap = { ...(mapping?.stripePriceMeta ?? {}) };
  const existingPriceId = priceIds[planKey];
  const existingMeta = priceMetaMap[planKey];
  let priceId: string | null = existingPriceId ?? null;

  if (priceId && existingMeta) {
    const matches =
      existingMeta.amountCents === priceMeta.amountCents &&
      existingMeta.currency.toLowerCase() === priceMeta.currency.toLowerCase() &&
      existingMeta.interval === priceMeta.interval;
    if (!matches) {
      priceId = null;
    }
  }

  if (!priceId) {
    const price = await stripeClient.prices.create({
      ...pricePayload,
      product: productId,
      metadata: {
        saasId: params.saasId,
        planKey,
        saasSlug: params.blueprint.proposedSlug,
        tenantId: params.tenantId,
      },
    });
    priceId = price.id;
    priceIds[planKey] = priceId;
    priceMetaMap[planKey] = priceMeta;
    await recordBillingEvent({
      tenantId: params.tenantId,
      saasId: params.saasId,
      saasSlug: params.blueprint.proposedSlug,
      correlationId,
      type: "billing.stripe.price.reconciled",
      severity: "INFO",
      message: "Stripe price created.",
      metadata: { priceId, planKey, action: "created" },
    });
  } else {
    await recordBillingEvent({
      tenantId: params.tenantId,
      saasId: params.saasId,
      saasSlug: params.blueprint.proposedSlug,
      correlationId,
      type: "billing.stripe.price.reconciled",
      severity: "INFO",
      message: "Stripe price reused.",
      metadata: { priceId, planKey, action: "reused" },
    });
  }

  mapping = await mappingStore.upsertMapping({
    tenantId: params.tenantId,
    saasId: params.saasId,
    saasSlug: params.blueprint.proposedSlug,
    stripeProductId: productId,
    stripePriceIds: priceIds,
    stripePriceMeta: priceMetaMap,
  });

  await recordBillingEvent({
    tenantId: params.tenantId,
    saasId: params.saasId,
    saasSlug: params.blueprint.proposedSlug,
    correlationId,
    type: "billing.stripe.synced",
    severity: "INFO",
    message: "Stripe billing sincronizado.",
    metadata: { productId, priceIds, planKey, mappingId: mapping?.id ?? null },
  });

  return {
    status: "SUCCESS",
    message: "Stripe product/prices ensured.",
    productId,
    priceIds,
  };
}
