
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { requireTenantAccess } from "@/lib/auth/session";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { getSaasPlanByCode, getSaasPlanById } from "@/lib/billing/saas-plans";
import { respondDatabaseError } from "@/lib/http/errors";
// export const runtime = "edge"; // OpenNext Migration

type CheckoutBody = {
  saasId?: string;
  saasPlanId?: string;
  planCode?: string;
  clientId?: string;
};

export async function POST(request: Request) {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, reason: "stripe_not_configured", hint: "Set STRIPE_SECRET_KEY and publishable keys." },
        { status: 503 }
      );
    }
    const body = (await request.json().catch(() => null)) as CheckoutBody | null;
    if (!body || typeof body.saasId !== "string" || body.saasId.trim().length === 0) {
      return NextResponse.json({ error: "saasId is required" }, { status: 400 });
    }
    if (typeof body.clientId !== "string" || body.clientId.trim().length === 0) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }
    const { tenantId, session } = await requireTenantAccess(request);
    const saasId = body.saasId.trim();
    let plan = body.saasPlanId ? await getSaasPlanById(tenantId, body.saasPlanId) : null;
    if (!plan && body.planCode) {
      plan = await getSaasPlanByCode(tenantId, saasId, body.planCode);
    }
    if (!plan || plan.saasId !== saasId) {
      return NextResponse.json({ error: "Invalid SaaS plan" }, { status: 400 });
    }
    if (plan.status !== "active") {
      return NextResponse.json({ error: "Plan is not active" }, { status: 400 });
    }
    if (!plan.stripePriceId) {
      return NextResponse.json({ error: "Plan is not fully configured" }, { status: 400 });
    }
    const baseUrl = getRequestBaseUrl(request);
    const metadata = {
      tenantId,
      clientId: body.clientId,
      saasId,
      saasPlanId: plan.id,
      planCode: plan.planCode,
      plan: plan.planCode,
      scope: "saas_child",
      email: session.email,
    } satisfies Record<string, string>;

    const sessionCheckout = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: body.clientId,
      customer_email: session.email,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata,
      },
      metadata,
      allow_promotion_codes: true,
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}&saasId=${encodeURIComponent(saasId)}&planCode=${encodeURIComponent(plan.planCode)}`,
      cancel_url: `${baseUrl}/billing/cancel?saasId=${encodeURIComponent(saasId)}&planCode=${encodeURIComponent(plan.planCode)}`,
    });

    return NextResponse.json({ url: sessionCheckout.url });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    console.error("STRIPE_SAAS_CHECKOUT_ERROR", error);
    return NextResponse.json({ error: (error as Error).message ?? "Unable to create SaaS checkout session" }, { status: 400 });
  }
}
