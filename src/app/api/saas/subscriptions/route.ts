import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import {
  getClientSaasSubscriptions,
  getSaasSubscriptions,
  getTenantClientSaasSubscriptions,
} from "@/lib/billing/client-saas-subscriptions";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { searchParams } = new URL(request.url);
    const saasId = searchParams.get("saasId") ?? searchParams.get("saas_id");
    const clientId = searchParams.get("clientId") ?? searchParams.get("client_id");
    let items;
    if (clientId) {
      items = await getClientSaasSubscriptions(tenantId, clientId);
    } else if (saasId) {
      items = await getSaasSubscriptions(tenantId, saasId);
    } else {
      items = await getTenantClientSaasSubscriptions(tenantId);
    }
    return NextResponse.json({ items });
  } catch (error) {
    console.error("SAAS_SUBSCRIPTIONS_GET_ERROR", error);
    return NextResponse.json({ error: "Unable to load SaaS subscriptions" }, { status: 500 });
  }
}
