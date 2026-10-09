export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanonicalSubscriptionState } from "@/lib/billing/subscriptions";
import { getRequestBaseUrl } from "@/lib/socialflow/platform/http/base-url";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getSocialFlowStripePriceId, type SocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import { createStripeCheckoutSession, createStripeCustomer } from "@/lib/socialflow/platform/stripe-rest";

type RequestBody = {
  plan?: string;
  context?: "onboarding" | "settings";
};

const VALID_CHECKOUT_PLANS = new Set<Exclude<SocialFlowPlanCode, "free">>([
  "influencer_starter",
  "influencer_basico",
  "influencer_pro",
  "empresa_starter",
  "empresa_basico",
  "empresa_pro",
]);

function resolveCheckoutPlan(rawPlan: string | undefined): Exclude<SocialFlowPlanCode, "free"> | null {
  // "creator"/"pro" are legacy aliases kept for links/clients built before the influencer/empresa split.
  if (rawPlan === "creator") return "influencer_basico";
  if (rawPlan === "pro") return "influencer_pro";
  // "empresa_basica" is a legacy alias kept from before the empresa_basica → empresa_basico rename.
  if (rawPlan === "empresa_basica") return "empresa_basico";
  if (rawPlan && VALID_CHECKOUT_PLANS.has(rawPlan as Exclude<SocialFlowPlanCode, "free">)) {
    return rawPlan as Exclude<SocialFlowPlanCode, "free">;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const plan = resolveCheckoutPlan(body.plan);
    const ctx = body.context === "onboarding" ? "onboarding" : "settings";

    if (!plan) {
      return NextResponse.json({ ok: false, code: "SOCIALFLOW_INVALID_PLAN" }, { status: 400 });
    }

    const priceId = getSocialFlowStripePriceId(plan);
    if (!priceId) {
      return NextResponse.json({ ok: false, code: "SOCIALFLOW_STRIPE_PRICE_NOT_CONFIGURED" }, { status: 503 });
    }

    const subscription = await getCanonicalSubscriptionState({ tenantId: session.tenantId, saasSlug: "socialflow" });
    let customerId = subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await createStripeCustomer({
        email: session.email,
        metadata: { tenantId: session.tenantId, saasSlug: "socialflow", scope: "socialflow_product" },
      });
      customerId = customer.id;
    }

    const baseUrl = getRequestBaseUrl(request);
    const successUrl =
      ctx === "onboarding"
        ? `${baseUrl}/socialflow/onboarding?billing=success&session_id={CHECKOUT_SESSION_ID}`
        : `${baseUrl}/socialflow/settings/billing?billing=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      ctx === "onboarding"
        ? `${baseUrl}/socialflow/onboarding/plans?billing=cancelled`
        : `${baseUrl}/socialflow/settings/billing?billing=cancelled`;

    const checkout = await createStripeCheckoutSession({
      customer: customerId,
      priceId,
      metadata: { tenantId: session.tenantId, clientId: session.userId, saasSlug: "socialflow", plan, planCode: plan },
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ ok: true, url: checkout.url, sessionId: checkout.id });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, code: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_BILLING_CHECKOUT_ERROR", error);
    return NextResponse.json({ ok: false, code: "SOCIALFLOW_BILLING_CHECKOUT_FAILED" }, { status: 500 });
  }
}
