import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { resolveSocialContext, SocialContextError } from "@/lib/social/repository";
import { getSocialPostSuggestionsForCampaign } from "@/lib/social/content-engine";
// export const runtime = "edge"; // OpenNext Migration


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const campaignId = url.searchParams.get("campaignId");
    if (!saasId || !campaignId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and campaignId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const suggestions = await getSocialPostSuggestionsForCampaign(ctx, campaignId);
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_POST_SUGGESTIONS_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudieron generar posts" }, { status: 500 });
  }
}
