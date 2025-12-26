import type Stripe from "stripe";
import { findStripeMappingByStripeIds } from "@/lib/billing/stripe-mapping-repository";
import { collectStripeIdsFromEvent, extractAttributionFromMetadata } from "@/lib/billing/stripe-webhook-utils";

export type StripeWebhookAttribution = {
  tenantId?: string | null;
  saasId?: string | null;
  saasSlug?: string | null;
  source: "metadata" | "mapping" | "none";
  mismatch: boolean;
  drift: boolean;
};

export async function resolveWebhookAttribution(
  event: Stripe.Event,
  mappingLookup: (params: { tenantId?: string | null; stripeProductId?: string | null; stripePriceId?: string | null }) => Promise<{
    tenantId: string;
    saasId: string;
    saasSlug: string;
  } | null> = findStripeMappingByStripeIds,
): Promise<StripeWebhookAttribution> {
  const dataObject = event.data.object as { metadata?: Stripe.Metadata };
  const metadataAttribution = extractAttributionFromMetadata(dataObject?.metadata ?? null);
  const stripeIds = collectStripeIdsFromEvent(event);
  const productId = stripeIds.productIds[0] ?? null;
  const priceId = stripeIds.priceIds[0] ?? null;
  const mapping = await mappingLookup({
    tenantId: metadataAttribution.tenantId ?? null,
    stripeProductId: productId,
    stripePriceId: priceId,
  });

  let mismatch = false;
  let drift = false;
  let source: StripeWebhookAttribution["source"] = "none";
  const tenantId = metadataAttribution.tenantId ?? mapping?.tenantId ?? null;
  const saasSlug = metadataAttribution.saasSlug ?? mapping?.saasSlug ?? null;
  const saasId = metadataAttribution.saasId ?? mapping?.saasId ?? null;

  if (metadataAttribution.tenantId || metadataAttribution.saasSlug || metadataAttribution.saasId) {
    source = "metadata";
  } else if (mapping) {
    source = "mapping";
  }

  if (mapping && metadataAttribution.tenantId && mapping.tenantId !== metadataAttribution.tenantId) {
    mismatch = true;
  }
  if (mapping && metadataAttribution.saasSlug && mapping.saasSlug !== metadataAttribution.saasSlug) {
    mismatch = true;
  }
  if (!mapping && (productId || priceId)) {
    drift = true;
  }

  return { tenantId, saasId, saasSlug, source, mismatch, drift };
}
