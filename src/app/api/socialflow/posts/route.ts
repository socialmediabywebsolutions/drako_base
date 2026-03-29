export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  approvePost,
  getSaasSocialPostById,
  listSaasSocialPosts,
  markAsPosted,
  rejectPost,
  resolveSocialContext,
  runSocialSchedulerSimulation,
  schedulePost,
  SocialContextError,
  upsertSaasSocialPost,
} from "@/lib/social/repository";
import { publishSocialPostLive } from "@/lib/social/live-publishing";

const ALLOWED_PROVIDERS = ["LINKEDIN"] as const;
const ALLOWED_CREATION_STATUSES = ["DRAFT", "SCHEDULED"] as const;

function unauthorizedResponse() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const campaignId = url.searchParams.get("campaignId");
    const status = url.searchParams.get("status");
    const provider = url.searchParams.get("provider");

    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    await runSocialSchedulerSimulation(ctx);

    const items = await listSaasSocialPosts(ctx, {
      campaignId: campaignId ?? null,
      status: status && status !== "ALL" ? status : null,
      provider: provider && provider !== "ALL" ? (provider as (typeof ALLOWED_PROVIDERS)[number]) : null,
    });

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse();
    }
    console.error("SOCIALFLOW_POSTS_LIST_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to load posts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      content?: string | null;
      campaignId?: string | null;
      channelId?: string | null;
      provider?: string;
      contentType?: string;
      title?: string;
      body?: string;
      imageHint?: string | null;
      status?: string;
      scheduledAt?: string | null;
      postedAt?: string | null;
      externalPostId?: string | null;
      metadata?: Record<string, unknown> | null;
    } | null;

    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }

    const saasId = body.saasId ?? null;
    const simplifiedContent = body.content?.trim() ?? "";
    const usingSimplifiedContract = Boolean(simplifiedContent);
    const provider = (body.provider ?? (usingSimplifiedContract ? "LINKEDIN" : null)) as string | null;
    const contentType = (body.contentType ?? (usingSimplifiedContract ? "FEED" : null)) as string | null;
    const title = body.title?.trim() || (usingSimplifiedContract ? simplifiedContent.slice(0, 72) : "");
    const postBody = body.body?.trim() || simplifiedContent;
    const scheduledAt = typeof body.scheduledAt === "undefined" ? null : body.scheduledAt;
    const creationStatus = body.status ?? (usingSimplifiedContract ? (scheduledAt ? "SCHEDULED" : "DRAFT") : null);

    if (!saasId || !provider || !contentType || !title || !postBody || !creationStatus) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId, provider, contentType, title, body and status are required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    if (!ALLOWED_PROVIDERS.includes(provider as (typeof ALLOWED_PROVIDERS)[number])) {
      return NextResponse.json({ code: "INVALID_PROVIDER", message: "provider is invalid" }, { status: 400 });
    }
    if (!ALLOWED_CREATION_STATUSES.includes(creationStatus as (typeof ALLOWED_CREATION_STATUSES)[number])) {
      return NextResponse.json({ code: "INVALID_STATUS", message: "status must be draft or scheduled" }, { status: 400 });
    }

    const post = await upsertSaasSocialPost(ctx, {
      id: body.id,
      saasId,
      campaignId: body.campaignId ?? null,
      channelId: body.channelId ?? null,
      provider: provider as (typeof ALLOWED_PROVIDERS)[number],
      contentType: "FEED",
      title,
      body: postBody,
      imageHint: body.imageHint ?? null,
      status: creationStatus as (typeof ALLOWED_CREATION_STATUSES)[number],
      scheduledAt,
      postedAt: body.postedAt ?? null,
      externalPostId: body.externalPostId ?? null,
      metadata: body.metadata ?? null,
    });

    if (usingSimplifiedContract && !scheduledAt) {
      const liveResult = await publishSocialPostLive(ctx, post.id);
      if (!liveResult.ok) {
        return NextResponse.json({
          post: liveResult.post ?? (await getSaasSocialPostById(ctx, post.id)) ?? post,
          livePublish: {
            ok: false,
            code: liveResult.code ?? "LIVE_PUBLISH_FAILED",
            message: liveResult.message ?? "Live publish failed.",
          },
        }, { status: 409 });
      }

      return NextResponse.json({
        post: liveResult.post ?? post,
        livePublish: {
          ok: true,
          code: liveResult.code ?? "PUBLISHED_LIVE_LINKEDIN",
          message: liveResult.message ?? "Post published live.",
          externalPostId: liveResult.externalPostId ?? null,
        },
      });
    }

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse();
    }
    console.error("SOCIALFLOW_POSTS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to save post" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      title?: string | null;
      body?: string | null;
      status?: string | null;
      scheduledAt?: string | null;
      postedAt?: string | null;
      externalPostId?: string | null;
      metadata?: Record<string, unknown> | null;
      action?: "approve" | "reject" | "schedule" | "mark_posted";
    } | null;

    if (!body?.id || !body.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "id and saasId are required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: body.saasId });

    if (body.action === "approve") {
      const post = await approvePost(ctx, body.id);
      return NextResponse.json({ post });
    }
    if (body.action === "reject") {
      const post = await rejectPost(ctx, body.id);
      return NextResponse.json({ post });
    }
    if (body.action === "schedule") {
      const post = await schedulePost(ctx, { id: body.id, scheduledAt: body.scheduledAt ?? null });
      return NextResponse.json({ post });
    }
    if (body.action === "mark_posted") {
      const post = await markAsPosted(ctx, {
        id: body.id,
        externalPostId: body.externalPostId ?? null,
        postedAt: body.postedAt ?? null,
      });
      return NextResponse.json({ post });
    }

    const existingPosts = await listSaasSocialPosts(ctx, { campaignId: null, status: null, provider: null });
    const current = existingPosts.find((post) => post.id === body.id);
    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
    }

    const post = await upsertSaasSocialPost(ctx, {
      id: current.id,
      saasId: current.saasId,
      campaignId: current.campaignId,
      channelId: current.channelId ?? null,
      provider: current.provider,
      contentType: current.contentType,
      title: typeof body.title === "string" ? body.title : current.title,
      body: typeof body.body === "string" ? body.body : current.body,
      imageHint: current.imageHint,
      status: (body.status as typeof ALLOWED_CREATION_STATUSES[number]) ?? current.status,
      scheduledAt: typeof body.scheduledAt === "undefined" ? current.scheduledAt : body.scheduledAt,
      postedAt: typeof body.postedAt === "undefined" ? current.postedAt : body.postedAt,
      externalPostId: typeof body.externalPostId === "undefined" ? current.externalPostId : body.externalPostId,
      metadata: typeof body.metadata === "undefined" ? current.metadata : body.metadata,
    });

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse();
    }
    console.error("SOCIALFLOW_POSTS_PATCH_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to update post" }, { status: 500 });
  }
}
