export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { upsertCanonicalSubscriptionState } from "@/lib/billing/subscriptions";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { retrieveStripeCheckoutSession, retrieveStripeSubscription } from "@/lib/stripe/rest";

type RequestBody = {
  sessionId?: string;
};

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    if (!body.sessionId) {
      return NextResponse.json({ ok: false, code: "MENTORIA_BILLING_SESSION_ID_REQUIRED" }, { status: 400 });
    }

    const session = await retrieveStripeCheckoutSession(body.sessionId);
    const sessionSubscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
    if (!sessionSubscriptionId) {
      return NextResponse.json({ ok: false, code: "MENTORIA_BILLING_SUBSCRIPTION_MISSING" }, { status: 409 });
    }
    const subscription = await retrieveStripeSubscription(sessionSubscriptionId);

    const tenantId = subscription.metadata.tenantId ?? session.metadata?.tenantId;
    const saasSlug = subscription.metadata.saasSlug ?? session.metadata?.saasSlug ?? "mentoria";
    if (tenantId !== actor.tenantId || saasSlug !== "mentoria") {
      return NextResponse.json({ ok: false, code: "MENTORIA_BILLING_TENANT_MISMATCH" }, { status: 403 });
    }

    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (!customerId) {
      return NextResponse.json({ ok: false, code: "MENTORIA_BILLING_CUSTOMER_MISSING" }, { status: 409 });
    }

    await upsertCanonicalSubscriptionState({
      tenantId: actor.tenantId,
      saasSlug: "mentoria",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price?.id ?? null,
      planCode: subscription.metadata.planCode ?? session.metadata?.planCode ?? session.metadata?.plan ?? "pro",
      status: subscription.status,
      currentPeriodEnd: (subscription as { current_period_end?: number | null }).current_period_end ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, code: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("MENTORIA_BILLING_CONFIRM_ERROR", error);
    return NextResponse.json({ ok: false, code: "MENTORIA_BILLING_CONFIRM_FAILED" }, { status: 500 });
  }
}
