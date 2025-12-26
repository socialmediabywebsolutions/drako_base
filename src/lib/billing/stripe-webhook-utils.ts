import type Stripe from "stripe";

export type StripeAttribution = {
  tenantId?: string | null;
  saasId?: string | null;
  saasSlug?: string | null;
};

export type StripeIdHints = {
  productIds: string[];
  priceIds: string[];
};

function pushUnique(list: string[], value?: string | null) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

export function extractAttributionFromMetadata(metadata: Stripe.Metadata | null | undefined): StripeAttribution {
  if (!metadata) return {};
  const tenantId = metadata.tenantId || metadata.tenant_id || null;
  const saasId = metadata.saasId || metadata.saas_id || null;
  const saasSlug = metadata.saasSlug || metadata.saas_slug || metadata.slug || null;
  return { tenantId, saasId, saasSlug };
}

export function collectStripeIdsFromEvent(event: Stripe.Event): StripeIdHints {
  const productIds: string[] = [];
  const priceIds: string[] = [];
  const dataObject = event.data.object as Stripe.Invoice | Stripe.Subscription | Stripe.Checkout.Session | Stripe.Price | Stripe.Product;

  if ((dataObject as Stripe.Price).object === "price") {
    const price = dataObject as Stripe.Price;
    pushUnique(priceIds, price.id);
    if (typeof price.product === "string") pushUnique(productIds, price.product);
  }

  if ((dataObject as Stripe.Product).object === "product") {
    const product = dataObject as Stripe.Product;
    pushUnique(productIds, product.id);
  }

  if ("items" in dataObject && dataObject.items && Array.isArray(dataObject.items.data)) {
    dataObject.items.data.forEach((item) => {
      pushUnique(priceIds, item.price?.id ?? null);
      const product = item.price?.product;
      if (typeof product === "string") pushUnique(productIds, product);
    });
  }

  if ("lines" in dataObject && dataObject.lines && Array.isArray(dataObject.lines.data)) {
    dataObject.lines.data.forEach((line) => {
      const lineItem = line as unknown as { price?: { id?: string; product?: string | Stripe.Product } };
      pushUnique(priceIds, lineItem.price?.id ?? null);
      const product = lineItem.price?.product;
      if (typeof product === "string") pushUnique(productIds, product);
    });
  }

  const session = dataObject as Stripe.Checkout.Session & {
    display_items?: Array<{ price?: { id?: string; product?: string | Stripe.Product } }>;
  };
  if (Array.isArray(session.display_items)) {
    session.display_items.forEach((item) => {
      pushUnique(priceIds, item.price?.id ?? null);
      const product = item.price?.product;
      if (typeof product === "string") pushUnique(productIds, product);
    });
  }

  return { productIds, priceIds };
}
