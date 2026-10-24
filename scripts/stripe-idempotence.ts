import type Stripe from "stripe";
import { ensureStripeProductForSaas, type StripeMappingStore } from "@/lib/campamento-base/provisioning/stripe-factory";
import type { StripePriceMeta } from "@/lib/billing/stripe-mapping-repository";
import type { SaasBlueprintDraft } from "@/lib/factory/contracts/blueprints";

type MockStripeProduct = { id: string; metadata: Record<string, string> };
type MockStripePrice = { id: string; product: string; unit_amount: number; currency: string; interval: "month" | "year" };

function createMockStripe() {
  const products: MockStripeProduct[] = [];
  const prices: MockStripePrice[] = [];
  let productSeq = 1;
  let priceSeq = 1;

  return {
    products: {
      async create(payload: Stripe.ProductCreateParams) {
        const product = { id: `prod_${productSeq++}`, metadata: (payload.metadata ?? {}) as Record<string, string> };
        products.push(product);
        return product as unknown as Stripe.Product;
      },
      async update(id: string, payload: Stripe.ProductUpdateParams) {
        const product = products.find((item) => item.id === id);
        if (!product) {
          throw new Error("Product not found");
        }
        product.metadata = { ...product.metadata, ...(payload.metadata ?? {}) } as Record<string, string>;
        return product as unknown as Stripe.Product;
      },
      async search(params: Stripe.ProductSearchParams) {
        const match = products.find((product) => {
          const slug = product.metadata.slug;
          const tenantId = product.metadata.tenantId;
          return params.query.includes(`'${slug}'`) && params.query.includes(`'${tenantId}'`);
        });
        return { data: match ? [match] : [] } as unknown as Stripe.ApiSearchResult<Stripe.Product>;
      },
    },
    prices: {
      async create(payload: Stripe.PriceCreateParams) {
        const interval: "month" | "year" = payload.recurring?.interval === "year" ? "year" : "month";
        const price = {
          id: `price_${priceSeq++}`,
          product: String(payload.product ?? ""),
          unit_amount: payload.unit_amount ?? 0,
          currency: payload.currency ?? "eur",
          interval,
        };
        prices.push(price);
        return price as unknown as Stripe.Price;
      },
    },
    _debug: { products, prices },
  };
}

async function run() {
  const mockStripe = createMockStripe();
  const store: StripeMappingStore = (() => {
    const map = new Map<
      string,
      { stripeProductId: string; stripePriceIds: Record<string, string>; stripePriceMeta: Record<string, StripePriceMeta> }
    >();
    return {
      async findMapping({ tenantId, saasId, saasSlug }) {
        const key = `${tenantId}:${saasId}:${saasSlug}`;
        const entry = map.get(key);
        if (!entry) return null;
        return {
          id: key,
          tenantId,
          saasId,
          saasSlug,
          stripeProductId: entry.stripeProductId,
          stripePriceIds: entry.stripePriceIds,
          stripePriceMeta: entry.stripePriceMeta,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
      async upsertMapping({ tenantId, saasId, saasSlug, stripeProductId, stripePriceIds, stripePriceMeta }) {
        const key = `${tenantId}:${saasId}:${saasSlug}`;
        map.set(key, { stripeProductId, stripePriceIds, stripePriceMeta });
        return {
          id: key,
          tenantId,
          saasId,
          saasSlug,
          stripeProductId,
          stripePriceIds,
          stripePriceMeta,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
    };
  })();

  const blueprint: SaasBlueprintDraft = {
    ownerTenantId: "tenant_demo",
    saasName: "Atlas Growth",
    proposedSlug: "atlas-growth",
    proposedSubdomain: "atlas-growth",
    verticalId: "SALON",
    summary: "Demo SaaS for Stripe idempotence.",
    targetAudience: "Local salons",
    mainProblem: "Low bookings",
    mainGoal: "Increase appointments",
    packsByDepartment: {},
    initialPricing: {
      currentMonthlyPrice: 99,
      recommendedTargetPriceMonthly: 120,
    },
    aiProfile: {
      tier: "BALANCED",
    },
    provisioning: {
      domains: {
        primarySubdomain: "atlas-growth",
        primaryDomainType: "CUSTOM_DOMAIN_ALLOWED",
      },
      stripe: {
        billingInterval: "MONTHLY",
        taxProfile: "ES_AUTONOMO",
        currency: "EUR",
      },
      ai: {
        tier: "BALANCED",
        preferredProviders: [],
      },
    },
  };

  process.env.DRACO_PROVISIONING_ENABLED = "true";
  process.env.DRACO_PROVISIONING_MODE = "live";
  process.env.DRACO_STRIPE_LIVE_OVERRIDE = "true";

  await ensureStripeProductForSaas({
    blueprint,
    pricingRecommendation: null,
    saasId: "saas_demo",
    tenantId: "tenant_demo",
    stripeClient: mockStripe as unknown as Stripe,
    mappingStore: store,
  });

  await ensureStripeProductForSaas({
    blueprint,
    pricingRecommendation: null,
    saasId: "saas_demo",
    tenantId: "tenant_demo",
    stripeClient: mockStripe as unknown as Stripe,
    mappingStore: store,
  });

  const createdProducts = mockStripe._debug.products.length;
  const createdPrices = mockStripe._debug.prices.length;
  if (createdProducts !== 1 || createdPrices !== 1) {
    throw new Error(`Idempotence failed: products=${createdProducts} prices=${createdPrices}`);
  }

  console.log("Stripe idempotence OK", { products: createdProducts, prices: createdPrices });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
