import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEconomyApiError } from "@/lib/economy/api-helpers";
import { getSaasProfitabilitySnapshot, resolveEconomyContext } from "@/lib/economy/repository";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId });
    const snapshot = await getSaasProfitabilitySnapshot(context);
    return NextResponse.json({ snapshot });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_PROFITABILITY_GET", error);
  }
}
