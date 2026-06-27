export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  getSaasSocialPostById,
  listSaasSocialAccounts,
  refreshSocialPostLiveAnalytics,
  resolveSocialContext,
  SocialContextError,
  upsertSaasSocialMetrics,
} from "@/lib/socialflow/repository";
import { decryptToken } from "@/lib/socialflow/token-encryption";
import { fetchInstagramMediaInsights, fetchInstagramRecentMedia } from "@/lib/socialflow/meta/core";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: postId } = await params;
    if (!postId?.trim()) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "Post ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const saasId = typeof body.saasId === "string" ? body.saasId.trim() : null;
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });

    const post = await getSaasSocialPostById(ctx, postId);
    if (!post) {
      return NextResponse.json({ code: "POST_NOT_FOUND", message: "Post not found" }, { status: 404 });
    }
    if (post.provider !== "INSTAGRAM") {
      return NextResponse.json({ code: "PROVIDER_NOT_SUPPORTED", message: "Metrics refresh is only available for Instagram posts" }, { status: 422 });
    }
    if (!post.externalPostId) {
      return NextResponse.json({ code: "NO_EXTERNAL_POST_ID", message: "Post has not been published yet or has no external post ID" }, { status: 422 });
    }

    const accounts = await listSaasSocialAccounts(ctx);
    const account = accounts.find((a) => a.provider === "INSTAGRAM" && a.status === "CONNECTED_REAL");
    if (!account) {
      return NextResponse.json({ code: "NO_INSTAGRAM_ACCOUNT", message: "No connected Instagram account found" }, { status: 422 });
    }

    const authMeta = account.authMeta as Record<string, unknown> | null;
    const encryptedToken = typeof authMeta?.accessToken === "string" ? authMeta.accessToken : null;
    const igUserId = typeof authMeta?.igUserId === "string" ? authMeta.igUserId : null;
    if (!encryptedToken || !igUserId) {
      return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "Instagram account credentials are incomplete" }, { status: 422 });
    }

    const accessToken = await decryptToken(encryptedToken);
    if (!accessToken) {
      return NextResponse.json({ code: "TOKEN_DECRYPT_FAILED", message: "Could not decrypt Instagram access token" }, { status: 500 });
    }

    const [recentMedia, mediaInsights] = await Promise.all([
      fetchInstagramRecentMedia(accessToken, igUserId).catch(() => []),
      fetchInstagramMediaInsights(accessToken, post.externalPostId),
    ]);

    const mediaItem = recentMedia.find((m) => m.id === post.externalPostId);
    const capturedAt = new Date().toISOString();

    await upsertSaasSocialMetrics(ctx, {
      postId: post.id,
      provider: "INSTAGRAM",
      impressions: mediaInsights.impressions,
      likes: mediaItem?.likeCount ?? 0,
      comments: mediaItem?.commentsCount ?? 0,
      shares: mediaInsights.shares,
      clicks: 0,
      leadsGenerated: 0,
      capturedAt,
      metadata: {
        type: "media_manual_refresh",
        mediaId: post.externalPostId,
        reach: mediaInsights.reach,
        saved: mediaInsights.saved,
        timestamp: mediaItem?.timestamp ?? null,
      },
    });

    const refresh = await refreshSocialPostLiveAnalytics(ctx, postId);

    return NextResponse.json({
      ok: true,
      code: "METRICS_REFRESHED",
      post: refresh.post,
      metrics: {
        impressions: mediaInsights.impressions,
        likes: mediaItem?.likeCount ?? 0,
        comments: mediaItem?.commentsCount ?? 0,
        shares: mediaInsights.shares,
        reach: mediaInsights.reach,
        saved: mediaInsights.saved,
        capturedAt,
      },
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_METRICS_REFRESH_ERROR", error);
    return NextResponse.json({ code: "METRICS_REFRESH_ERROR", message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
