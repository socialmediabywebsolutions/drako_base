export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  getSocialAnalyticsSnapshot,
  refreshSocialWorkspaceLiveAnalytics,
  resolveSocialContext,
  SocialContextError,
} from "@/lib/social/repository";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const analytics = await getSocialAnalyticsSnapshot(ctx);
    return NextResponse.json({ analytics });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ANALYTICS_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo cargar la analitica social" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      action?: "refresh_live_analytics";
    } | null;
    if (!body?.saasId || body.action !== "refresh_live_analytics") {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId and refresh_live_analytics action are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId: body.saasId });
    const result = await refreshSocialWorkspaceLiveAnalytics(ctx);
    const analytics = await getSocialAnalyticsSnapshot(ctx);
    return NextResponse.json({
      refresh: {
        ok: result.ok,
        refreshedCount: result.refreshedCount,
        failedCount: result.failedCount,
        finishedAt: result.finishedAt,
        message: result.message,
      },
      analytics,
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ANALYTICS_REFRESH_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo refrescar la analitica social" }, { status: 500 });
  }
}
