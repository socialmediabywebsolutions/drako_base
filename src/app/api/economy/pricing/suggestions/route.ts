import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEconomyApiError } from "@/lib/economy/api-helpers";
import { resolveEconomyContext } from "@/lib/economy/repository";
import { getPricingSuggestions } from "@/lib/economy/pricing";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId });
    const suggestions = await getPricingSuggestions(context);
    return NextResponse.json({ items: suggestions, count: suggestions.length });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_PRICING_SUGGESTIONS_GET", error);
  }
}
