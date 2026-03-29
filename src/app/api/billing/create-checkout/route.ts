export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { findMembershipByTenantAndUser, getTenantBilling, getWorkspaceUserById, hasRequiredWorkspaceRole } from "@/lib/auth/campamento-core";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getWorkspaceStripePriceId, type WorkspaceBillingMetadata } from "@/lib/billing/tenant-workspace";

type RequestBody = {
  plan?: "STARTER" | "PRO" | "ENTERPRISE";
};

export async function POST(request: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (!session.userId && session.authMode !== "isolated" && session.authMode !== "local_demo") {
      return NextResponse.json({ ok: false, code: "WORKSPACE_SESSION_REQUIRED" }, { status: 403 });
    }
    const isProductAdminSession =
      (session.authMode === "isolated" || session.authMode === "local_demo")
      && String(session.role ?? "").toLowerCase() === "admin";
    const membership = session.userId ? await findMembershipByTenantAndUser(tenantId, session.userId) : null;
    if (!isProductAdminSession && (!membership || !hasRequiredWorkspaceRole(membership.role, "ADMIN"))) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const plan = body.plan ?? "STARTER";
    const priceId = getWorkspaceStripePriceId(plan);
    if (!priceId) {
      return NextResponse.json({ ok: false, code: "STRIPE_PRICE_NOT_CONFIGURED" }, { status: 503 });
    }
    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json({ ok: false, code: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
    }

    const user = session.userId ? await getWorkspaceUserById(session.userId) : null;
    const billing = await getTenantBilling(tenantId);
    let customerId = billing?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email ?? session.email,
        name: user?.name ?? undefined,
        metadata: { tenantId, scope: "tenant_workspace" },
      });
      customerId = customer.id;
    }

    const metadata: WorkspaceBillingMetadata = {
      tenantId,
      plan,
      scope: "tenant_workspace",
    };
    const baseUrl = getRequestBaseUrl(request);
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      success_url: `${baseUrl}/socialflow/settings/billing?billing=success`,
      cancel_url: `${baseUrl}/socialflow/settings/billing?billing=cancelled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ ok: true, url: checkout.url, sessionId: checkout.id });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("WORKSPACE_BILLING_CHECKOUT_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
