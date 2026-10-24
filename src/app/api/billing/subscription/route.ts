export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDrakoBaseSubscriptionAccess } from "@/lib/billing/subscription-guard";


export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const summary = await getDrakoBaseSubscriptionAccess(tenantId);
    return NextResponse.json({ subscription: summary.subscription, summary });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("BILLING_SUBSCRIPTION_GET_ERROR", error);
    return NextResponse.json({ error: "Unable to load subscription" }, { status: 500 });
  }
}
