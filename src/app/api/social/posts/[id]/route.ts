export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  getSaasSocialPostById,
  markSocialPostAnalyticsReviewed,
  refreshSocialPostLiveAnalytics,
  resolveSocialContext,
  SocialContextError,
  updateSaasSocialPostStatus,
} from "@/lib/social/repository";
import { publishSocialPostLive } from "@/lib/social/live-publishing";

const NEXT_ALLOWED_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "POSTED", "FAILED"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id: postId } = await params;
    if (!postId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId });
    const post = await getSaasSocialPostById(ctx, postId);
    if (!post) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error: unknown) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_POST_GET_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo cargar el post" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id: postId } = await params;
    if (!postId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as {
      action?: "publish_live" | "refresh_live_analytics" | "mark_analytics_reviewed";
      status?: string;
      postedAt?: string | null;
      metadata?: Record<string, unknown> | null;
      externalPostId?: string | null;
      manualReviewNote?: string | null;
    } | null;
    if (!body?.action && (!body?.status || !NEXT_ALLOWED_STATUSES.includes(body.status as (typeof NEXT_ALLOWED_STATUSES)[number]))) {
      return NextResponse.json({ code: "INVALID_BODY", message: "status is invalid" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId });
    if (body?.action === "publish_live") {
      const post = await getSaasSocialPostById(ctx, postId);
      if (!post) {
        return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
      }
      const postCtx = await resolveSocialContext({ tenantId, saasId: post.saasId });
      const result = await publishSocialPostLive(postCtx, postId);
      return NextResponse.json({
        post: result.post,
        livePublish: {
          ok: result.ok,
          code: result.code ?? (result.ok ? "LIVE_PUBLISH_OK" : "LIVE_PUBLISH_FAILED"),
          message: result.message ?? (result.ok ? "Post published live." : "Live publish failed."),
        },
      });
    }
    if (body?.action === "refresh_live_analytics") {
      const post = await getSaasSocialPostById(ctx, postId);
      if (!post) {
        return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
      }
      const postCtx = await resolveSocialContext({ tenantId, saasId: post.saasId });
      const result = await refreshSocialPostLiveAnalytics(postCtx, postId, { force: true });
      return NextResponse.json({
        post: result.post,
        liveAnalytics: {
          ok: result.ok,
          code: result.code,
          message: result.message,
        },
      });
    }
    if (body?.action === "mark_analytics_reviewed") {
      const post = await getSaasSocialPostById(ctx, postId);
      if (!post) {
        return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
      }
      const postCtx = await resolveSocialContext({ tenantId, saasId: post.saasId });
      const reviewedPost = await markSocialPostAnalyticsReviewed(postCtx, postId, body.manualReviewNote ?? null);
      return NextResponse.json({
        post: reviewedPost,
        review: {
          ok: true,
          code: "LIVE_ANALYTICS_REVIEWED",
          message: "Analytics incident marked as reviewed.",
        },
      });
    }
    const post = await updateSaasSocialPostStatus(ctx, {
      id: postId,
      status: body.status as (typeof NEXT_ALLOWED_STATUSES)[number],
      postedAt: body.postedAt ?? null,
      externalPostId: body.externalPostId ?? undefined,
      metadata: body.metadata ?? undefined,
    });
    if (!post) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_POST_PATCH_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo actualizar el post" }, { status: 500 });
  }
}
