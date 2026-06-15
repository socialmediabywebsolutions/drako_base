export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanonicalSubscriptionState } from "@/lib/billing/subscriptions";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getSocialFlowStripePriceId, type SocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import { createStripeCheckoutSession, createStripeCustomer } from "@/lib/stripe/rest";

type RequestBody = {
  plan?: "creator" | "pro";
};

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const plan: SocialFlowPlanCode = body.plan === "creator" ? "creator" : "pro";

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
    const checkout = await createStripeCheckoutSession({
      customer: customerId,
      priceId,
      metadata: { tenantId: session.tenantId, clientId: session.userId, saasSlug: "socialflow", plan, planCode: plan },
      successUrl: `${baseUrl}/socialflow/settings/billing?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/socialflow/settings/billing?billing=cancelled`,
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
