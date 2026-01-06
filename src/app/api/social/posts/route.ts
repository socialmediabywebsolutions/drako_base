import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listSaasSocialPosts, resolveSocialContext, SocialContextError, upsertSaasSocialPost } from "@/lib/social/repository";
export const runtime = "edge";


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
    const items = await listSaasSocialPosts(ctx, {
      campaignId: campaignId ?? null,
      status: status && status !== "ALL" ? status : null,
      provider:
        provider && provider !== "ALL" ? (provider as "INSTAGRAM" | "FACEBOOK_PAGE" | "TIKTOK" | "WHATSAPP" | "OTHER") : null,
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
    if (!saasId || !body.provider || !body.contentType || !body.title || !body.body || !body.status) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, provider, contentType, title, body and status are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const provider = body.provider as "INSTAGRAM" | "FACEBOOK_PAGE" | "TIKTOK" | "WHATSAPP" | "OTHER";
    const contentType = body.contentType as "FEED" | "STORY" | "REEL" | "SHORT" | "CAROUSEL";
    const status = body.status as "DRAFT" | "SCHEDULED" | "POSTED" | "FAILED";
    const post = await upsertSaasSocialPost(ctx, {
      id: body.id,
      saasId,
      campaignId: body.campaignId ?? null,
      provider,
      contentType,
      title: body.title,
      body: body.body,
      imageHint: body.imageHint ?? null,
      status,
      scheduledAt: body.scheduledAt ?? null,
      postedAt: body.postedAt ?? null,
      externalPostId: body.externalPostId ?? null,
      metadata: body.metadata ?? null,
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
