export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaStripePriceId } from "@/lib/mentoria/plans";
import { createStripeCheckoutSession, createStripeCustomer } from "@/lib/stripe/rest";

type RequestBody = {
  plan?: "pro" | "family";
};

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);

    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const plan = body.plan === "family" ? "family" : "pro";
    const priceId = getMentoriaStripePriceId(plan);
    if (!priceId) {
      return NextResponse.json({ ok: false, code: "MENTORIA_STRIPE_PRICE_NOT_CONFIGURED" }, { status: 503 });
    }

    const existing = await queryOne<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id
       FROM saas_subscriptions
       WHERE tenant_id = ? AND saas_slug = 'mentoria'
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`,
      actor.tenantId,
    );

    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      if (!actor.email) {
        return NextResponse.json({ ok: false, code: "MENTORIA_BILLING_EMAIL_REQUIRED" }, { status: 409 });
      }
      const customer = await createStripeCustomer({
        email: actor.email,
        metadata: {
          tenantId: actor.tenantId,
          saasSlug: "mentoria",
          scope: "mentoria_product",
        },
      });
      customerId = customer.id;
    }

    const saasInstance = await queryOne<{ id: string }>(
      `SELECT id
       FROM saas_instances
       WHERE tenant_id = ? AND slug = 'mentoria' AND status = 'active'
       LIMIT 1`,
      actor.tenantId,
    );
    if (!saasInstance?.id) {
      return NextResponse.json({ ok: false, code: "MENTORIA_BILLING_INSTANCE_MISSING" }, { status: 503 });
    }

    const baseUrl = getRequestBaseUrl(request);
    const checkout = await createStripeCheckoutSession({
      customer: customerId,
      metadata: {
        tenantId: actor.tenantId,
        clientId: actor.userId,
        saasId: saasInstance.id,
        saasSlug: "mentoria",
        plan,
        planCode: plan,
      },
      priceId,
      successUrl: `${baseUrl}/mentoria/app?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/mentoria/app?billing=cancelled`,
    });

    return NextResponse.json({ ok: true, url: checkout.url, sessionId: checkout.id });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, code: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("MENTORIA_BILLING_CHECKOUT_ERROR", error);
    return NextResponse.json({ ok: false, code: "MENTORIA_BILLING_CHECKOUT_FAILED" }, { status: 500 });
  }
}
