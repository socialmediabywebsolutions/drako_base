export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { syncSaasFeaturesFromPlan } from "@/lib/billing/entitlements";
import { env as resolveEnv } from "@/lib/cf";
import { isProductionEnvironment } from "@/lib/security/production-gate";


export async function POST(request: Request) {
  try {
    if (isProductionEnvironment(resolveEnv())) {
      return NextResponse.json(
        {
          ok: false,
          code: "LEGACY_FEATURE_SYNC_BLOCKED",
          message: "Legacy manual entitlements sync is blocked in production. Entitlements are materialized via canonical Stripe webhook.",
        },
        { status: 410 },
      );
    }
    const body = (await request.json().catch(() => null)) as { saasId?: string | null } | null;
    if (!body?.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const { features, planId } = await syncSaasFeaturesFromPlan(null, tenantId, body.saasId);
    return NextResponse.json({ features, planId });
  } catch (error) {
    console.error("PLAN_FEATURE_SYNC_ERROR", error);
    return NextResponse.json({ code: "PLAN_FEATURE_SYNC_ERROR", message: "No se pudo sincronizar el plan." }, { status: 500 });
  }
}
