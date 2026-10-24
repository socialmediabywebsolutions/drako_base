export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getSocialProductSummary, resolveSocialContext, SocialContextError } from "@/lib/social/repository";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const summary = await getSocialProductSummary(ctx);
    return NextResponse.json({
      summary,
      accounts_connected: summary.overview.connectedAccounts,
      campaigns_active: summary.overview.activeCampaigns,
      posts_scheduled: summary.overview.scheduledPostsThisWeek,
      posts_published_30d: summary.overview.publishedPostsLast30Days,
      engagement_30d: summary.overview.engagementLast30Days,
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_SUMMARY_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo cargar el resumen de SocialFlow" }, { status: 500 });
  }
}
