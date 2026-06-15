export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanonicalSubscriptionState } from "@/lib/billing/subscriptions";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { createStripeBillingPortalSession } from "@/lib/stripe/rest";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const subscription = await getCanonicalSubscriptionState({ tenantId: session.tenantId, saasSlug: "socialflow" });
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ ok: false, code: "SOCIALFLOW_BILLING_NOT_READY" }, { status: 403 });
    }

    const returnUrl = `${getRequestBaseUrl(request)}/socialflow/settings/billing`;
    const portal = await createStripeBillingPortalSession({ customer: subscription.stripeCustomerId, returnUrl });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, code: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_BILLING_PORTAL_ERROR", error);
    return NextResponse.json({ ok: false, code: "SOCIALFLOW_BILLING_PORTAL_FAILED" }, { status: 500 });
  }
}
