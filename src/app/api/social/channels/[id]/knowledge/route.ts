export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getSaasSocialChannelKnowledge, resolveSocialContext, SocialContextError, upsertSaasSocialChannelKnowledge } from "@/lib/social/repository";

type KnowledgeBody = {
  objective?: string | null;
  audience?: string | null;
  tone?: string | null;
  keywords?: string[] | null;
  competitors?: string[] | null;
  sources?: string[] | null;
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const saasId = new URL(request.url).searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const resolvedParams = await context.params;
    const channelId = resolvedParams.id?.trim();
    if (!channelId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "channelId is required" }, { status: 400 });
    }
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const knowledge = await getSaasSocialChannelKnowledge(ctx, channelId);
    return NextResponse.json({ knowledge });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNEL_KNOWLEDGE_GET_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to fetch channel knowledge" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json().catch(() => null)) as KnowledgeBody | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const saasId = new URL(request.url).searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const resolvedParams = await context.params;
    const channelId = resolvedParams.id?.trim();
    if (!channelId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "channelId is required" }, { status: 400 });
    }
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const maybeLegacy = (body as Record<string, unknown>)?.["niche"];
    const knowledge = await upsertSaasSocialChannelKnowledge(ctx, {
      channelId,
      objective: body.objective ?? (typeof maybeLegacy === "string" ? maybeLegacy : null),
      audience: body.audience ?? null,
      tone: body.tone ?? null,
      keywords: body.keywords ?? [],
      competitors: body.competitors ?? [],
      sources: body.sources ?? [],
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ knowledge });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNEL_KNOWLEDGE_SAVE_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to save channel knowledge" }, { status: 500 });
  }
}
