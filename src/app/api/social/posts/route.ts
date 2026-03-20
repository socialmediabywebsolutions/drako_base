export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  listSaasSocialPosts,
  resolveSocialContext,
  runSocialSchedulerSimulation,
  SocialContextError,
  upsertSaasSocialPost,
} from "@/lib/social/repository";

const ALLOWED_PROVIDERS = ["LINKEDIN"] as const;
const ALLOWED_CREATION_STATUSES = ["DRAFT", "SCHEDULED"] as const;

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

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });

    console.log("[SocialFlow][posts][GET] resolved-context", {
      tenantId,
      saasId,
      ctxTenantId: ctx.tenantId,
      ctxSaasId: ctx.saasId,
      mode: ctx.mode,
      campaignId: campaignId ?? null,
      status: status && status !== "ALL" ? status : null,
      provider: provider && provider !== "ALL" ? provider : null,
    });

    await runSocialSchedulerSimulation(ctx);

    const items = await listSaasSocialPosts(ctx, {
      campaignId: campaignId ?? null,
      status: status && status !== "ALL" ? status : null,
      provider: provider && provider !== "ALL" ? (provider as (typeof ALLOWED_PROVIDERS)[number]) : null,
    });

    console.log("[SocialFlow][posts][GET] result", {
      tenantId: ctx.tenantId,
      saasId: ctx.saasId,
      count: items.length,
      ids: items.map((item) => item.id),
    });

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_POSTS_LIST_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudieron cargar los posts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
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

    if (!saasId || !body.provider || !body.contentType || !body.title?.trim() || !body.body?.trim() || !body.status) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, provider, contentType, title, body and status are required" },
        { status: 400 },
      );
    }

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });

    console.log("[SocialFlow][posts][POST] resolved-context", {
      tenantId,
      saasId,
      ctxTenantId: ctx.tenantId,
      ctxSaasId: ctx.saasId,
      mode: ctx.mode,
      provider: body.provider,
      status: body.status,
      title: body.title?.trim(),
    });

    if (!ALLOWED_PROVIDERS.includes(body.provider as (typeof ALLOWED_PROVIDERS)[number])) {
      return NextResponse.json({ code: "INVALID_PROVIDER", message: "provider is invalid" }, { status: 400 });
    }

    if (!ALLOWED_CREATION_STATUSES.includes(body.status as (typeof ALLOWED_CREATION_STATUSES)[number])) {
      return NextResponse.json({ code: "INVALID_STATUS", message: "status must be draft or scheduled" }, { status: 400 });
    }

    const provider = body.provider as (typeof ALLOWED_PROVIDERS)[number];
    const contentType = "FEED";
    const status = body.status as (typeof ALLOWED_CREATION_STATUSES)[number];

    const post = await upsertSaasSocialPost(ctx, {
      id: body.id,
      saasId,
      campaignId: body.campaignId ?? null,
      channelId: body.channelId ?? null,
      provider,
      contentType,
      title: body.title.trim(),
      body: body.body.trim(),
      imageHint: body.imageHint ?? null,
      status,
      scheduledAt: body.scheduledAt ?? null,
      postedAt: body.postedAt ?? null,
      externalPostId: body.externalPostId ?? null,
      metadata: body.metadata ?? null,
    });

    console.log("[SocialFlow][posts][POST] saved", {
      tenantId: ctx.tenantId,
      saasId: ctx.saasId,
      postId: post.id,
      status: post.status,
    });

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_POSTS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo guardar el post" }, { status: 500 });
  }
}