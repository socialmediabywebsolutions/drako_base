export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { getCanonicalSubscriptionState } from "@/lib/billing/subscriptions";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { findMembershipByTenantAndUser, getTenantBilling, hasRequiredWorkspaceRole } from "@/lib/auth/campamento-core";

async function resolveSaasSlug(params: { tenantId: string; request: Request }): Promise<string> {
  const { searchParams } = new URL(params.request.url);
  const providedSlug = searchParams.get("saasSlug")?.trim().toLowerCase();
  if (providedSlug) return providedSlug;

  const saasId = searchParams.get("saasId")?.trim();
  if (saasId) {
    const row = await queryOne<{ slug: string }>(
      "SELECT slug FROM saas WHERE tenant_id = ? AND id = ? LIMIT 1",
      params.tenantId,
      saasId,
    );
    if (row?.slug) return row.slug.trim().toLowerCase();
  }

  return "drako";
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const correlationId = request.headers.get("x-correlation-id") ?? (globalThis.crypto?.randomUUID?.() ?? `portal_${Date.now()}`);
    const saasSlug = await resolveSaasSlug({ tenantId, request });
    const state = await getCanonicalSubscriptionState({ tenantId, saasSlug });

    if (!state?.stripeCustomerId) {
      return NextResponse.json(
        {
          ok: false,
          code: "NEEDS_BILLING",
          message: "No verified subscription/customer found for billing portal.",
          tenantId,
          saasSlug,
          correlationId,
        },
        { status: 403 },
      );
    }

    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, code: "STRIPE_NOT_CONFIGURED", tenantId, saasSlug, correlationId },
        { status: 503 },
      );
    }

    const origin = getRequestBaseUrl(request);
    const sessionPortal = await stripe.billingPortal.sessions.create({
      customer: state.stripeCustomerId,
      return_url: `${origin}/billing`,
    });

    return NextResponse.json({
      ok: true,
      url: sessionPortal.url,
      tenantId,
      saasSlug,
      correlationId,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("BILLING_PORTAL_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (!session.userId) {
      return NextResponse.json({ ok: false, code: "WORKSPACE_SESSION_REQUIRED" }, { status: 403 });
    }
    const membership = await findMembershipByTenantAndUser(tenantId, session.userId);
    if (!membership || !hasRequiredWorkspaceRole(membership.role, "ADMIN")) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
    }
    const billing = await getTenantBilling(tenantId);
    if (!billing?.stripeCustomerId) {
      return NextResponse.json({ ok: false, code: "NEEDS_BILLING" }, { status: 403 });
    }
    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json({ ok: false, code: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
    }
    const origin = getRequestBaseUrl(request);
    const sessionPortal = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${origin}/client/settings/billing`,
    });
    return NextResponse.json({ ok: true, url: sessionPortal.url, tenantId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("WORKSPACE_BILLING_PORTAL_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
