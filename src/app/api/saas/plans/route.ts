import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { getSaasPlansForSaas, getSaasPlansForTenant } from "@/lib/billing/saas-plans";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { searchParams } = new URL(request.url);
    const saasId = searchParams.get("saasId") ?? searchParams.get("saas_id");
    const items = saasId
      ? await getSaasPlansForSaas(tenantId, saasId)
      : await getSaasPlansForTenant(tenantId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("SAAS_PLANS_GET_ERROR", error);
    return NextResponse.json({ error: "Unable to load SaaS plans" }, { status: 500 });
  }
}
