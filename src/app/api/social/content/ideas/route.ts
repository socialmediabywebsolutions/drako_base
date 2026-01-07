import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { resolveSocialContext, SocialContextError } from "@/lib/social/repository";
import { getSocialCampaignIdeasForSaas } from "@/lib/social/content-engine";
export const runtime = "edge";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const ideas = await getSocialCampaignIdeasForSaas(ctx);
    return NextResponse.json({ ideas });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_IDEAS_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudieron generar ideas" }, { status: 500 });
  }
}
