import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { getDrakoBaseSubscriptionAccess } from "@/lib/billing/subscription-guard";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const summary = await getDrakoBaseSubscriptionAccess(tenantId);
    return NextResponse.json({ subscription: summary.subscription, summary });
  } catch (error) {
    console.error("BILLING_SUBSCRIPTION_GET_ERROR", error);
    return NextResponse.json({ error: "Unable to load subscription" }, { status: 500 });
  }
}
