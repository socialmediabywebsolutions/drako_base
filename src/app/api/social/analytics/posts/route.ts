import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getSocialPostPerformance, resolveSocialContext, SocialContextError } from "@/lib/social/repository";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const items = await getSocialPostPerformance(ctx);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ANALYTICS_POSTS_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudieron cargar los posts" }, { status: 500 });
  }
}
