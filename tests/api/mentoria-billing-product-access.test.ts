import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentMentoriaSession: vi.fn(),
  queryOne: vi.fn(),
  getCanonicalSubscriptionState: vi.fn(),
  getMentoriaStripePriceId: vi.fn(),
  createStripeCustomer: vi.fn(),
  createStripeCheckoutSession: vi.fn(),
  retrieveStripeCheckoutSession: vi.fn(),
  retrieveStripeSubscription: vi.fn(),
  createStripeBillingPortalSession: vi.fn(),
  getRequestBaseUrl: vi.fn(),
  upsertCanonicalSubscriptionState: vi.fn(),
}));

vi.mock("@/lib/mentoria/auth/request", () => ({
  requireCurrentMentoriaSession: mocks.requireCurrentMentoriaSession,
}));

vi.mock("@/lib/db", () => ({
  queryOne: mocks.queryOne,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalSubscriptionState: mocks.getCanonicalSubscriptionState,
  upsertCanonicalSubscriptionState: mocks.upsertCanonicalSubscriptionState,
}));

vi.mock("@/lib/mentoria/plans", () => ({
  getMentoriaStripePriceId: mocks.getMentoriaStripePriceId,
}));

vi.mock("@/lib/stripe/rest", () => ({
  createStripeCustomer: mocks.createStripeCustomer,
  createStripeCheckoutSession: mocks.createStripeCheckoutSession,
  retrieveStripeCheckoutSession: mocks.retrieveStripeCheckoutSession,
  retrieveStripeSubscription: mocks.retrieveStripeSubscription,
  createStripeBillingPortalSession: mocks.createStripeBillingPortalSession,
}));

vi.mock("@/lib/http/base-url", () => ({
  getRequestBaseUrl: mocks.getRequestBaseUrl,
}));

import { POST as checkoutPost } from "@/app/api/mentoria/billing/checkout/route";
import { POST as confirmPost } from "@/app/api/mentoria/billing/confirm/route";
import { POST as portalPost } from "@/app/api/mentoria/billing/portal/route";

describe("mentoria billing product access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_mentoria",
      email: "family@example.com",
      tenantId: "tenant_mentoria",
      role: "user",
    });
    mocks.getMentoriaStripePriceId.mockReturnValue("price_mentoria_pro");
    mocks.getRequestBaseUrl.mockReturnValue("https://mentoria.drako.systems");
    mocks.queryOne.mockResolvedValue({ id: "saas-mentoria-core" });
    mocks.getCanonicalSubscriptionState.mockResolvedValue({
      tenantId: "tenant_mentoria",
      saasSlug: "mentoria",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_mentoria",
      stripePriceId: "price_mentoria_pro",
      planCode: "pro",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date().toISOString(),
    });
    mocks.upsertCanonicalSubscriptionState.mockResolvedValue(undefined);
    mocks.createStripeCustomer.mockResolvedValue({ id: "cus_created" });
    mocks.createStripeCheckoutSession.mockResolvedValue({ id: "cs_test", url: "https://stripe.test/checkout" });
    mocks.retrieveStripeCheckoutSession.mockResolvedValue({
      id: "cs_test",
      metadata: { tenantId: "tenant_mentoria", saasSlug: "mentoria", planCode: "pro" },
      subscription: "sub_live",
    });
    mocks.retrieveStripeSubscription.mockResolvedValue({
      id: "sub_live",
      customer: "cus_existing",
      metadata: { tenantId: "tenant_mentoria", saasSlug: "mentoria", planCode: "pro" },
      items: { data: [{ price: { id: "price_mentoria_pro" } }] },
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1_800_000_000,
    });
    mocks.createStripeBillingPortalSession.mockResolvedValue({ url: "https://stripe.test/portal" });
  });

  it("allows a valid mentorias product user to open checkout", async () => {
    const response = await checkoutPost(
      new Request("https://mentoria.drako.systems/api/mentoria/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { ok: boolean; url: string };
    expect(payload.ok).toBe(true);
    expect(payload.url).toBe("https://stripe.test/checkout");
    expect(mocks.createStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        priceId: "price_mentoria_pro",
        metadata: expect.objectContaining({
          saasId: "saas-mentoria-core",
          saasSlug: "mentoria",
        }),
        successUrl: "https://mentoria.drako.systems/mentoria/app?billing=success&session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://mentoria.drako.systems/mentoria/app?billing=cancelled",
      }),
    );
    expect(mocks.getCanonicalSubscriptionState).toHaveBeenCalledWith({
      tenantId: "tenant_mentoria",
      saasSlug: "mentoria",
    });
    expect(
      mocks.queryOne.mock.calls.some(([sql]) => String(sql).includes("FROM saas_subscriptions")),
    ).toBe(false);
  });

  it("allows a valid mentorias product user to confirm checkout", async () => {
    const response = await confirmPost(
      new Request("https://mentoria.drako.systems/api/mentoria/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "cs_test" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { ok: boolean };
    expect(payload.ok).toBe(true);
    expect(mocks.upsertCanonicalSubscriptionState).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant_mentoria", saasSlug: "mentoria", status: "active" }),
    );
  });

  it("allows a valid mentorias product user to open the billing portal", async () => {
    const response = await portalPost(
      new Request("https://mentoria.drako.systems/api/mentoria/billing/portal", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { ok: boolean; url: string };
    expect(payload.ok).toBe(true);
    expect(payload.url).toBe("https://stripe.test/portal");
  });

  it("fails closed with 401 when checkout is called without session", async () => {
    mocks.requireCurrentMentoriaSession.mockRejectedValueOnce(new Error("SESSION_REQUIRED"));

    const response = await checkoutPost(
      new Request("https://mentoria.drako.systems/api/mentoria/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("fails closed with 401 when portal is called without session", async () => {
    mocks.requireCurrentMentoriaSession.mockRejectedValueOnce(new Error("SESSION_REQUIRED"));

    const response = await portalPost(
      new Request("https://mentoria.drako.systems/api/mentoria/billing/portal", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("creates a Stripe customer when no canonical subscription exists yet", async () => {
    mocks.getCanonicalSubscriptionState.mockResolvedValueOnce(null);

    const response = await checkoutPost(
      new Request("https://mentoria.drako.systems/api/mentoria/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "family" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createStripeCustomer).toHaveBeenCalledWith({
      email: "family@example.com",
      metadata: {
        tenantId: "tenant_mentoria",
        saasSlug: "mentoria",
        scope: "mentoria_product",
      },
    });
    expect(mocks.createStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_created",
        metadata: expect.objectContaining({
          plan: "family",
          planCode: "family",
        }),
      }),
    );
  });
});
