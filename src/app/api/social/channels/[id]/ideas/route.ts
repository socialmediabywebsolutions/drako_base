export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { createSaasSocialChannelIdea, listSaasSocialChannelIdeas, resolveSocialContext, SocialContextError } from "@/lib/social/repository";

type IdeaBody = {
  title: string;
  angle?: string | null;
  summary?: string | null;
  status?: "idea" | "approved" | "converted" | "discarded";
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
    const ideas = await listSaasSocialChannelIdeas(ctx, channelId);
    return NextResponse.json({ ideas });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNEL_IDEAS_GET_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to fetch channel ideas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json().catch(() => null)) as IdeaBody | null;
    if (!body || !body.title) {
      return NextResponse.json({ code: "INVALID_BODY", message: "title is required" }, { status: 400 });
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
    const idea = await createSaasSocialChannelIdea(ctx, {
      channelId,
      title: body.title,
      angle: body.angle ?? null,
      summary: body.summary ?? null,
      status: body.status ?? "idea",
    });
    return NextResponse.json({ idea });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNEL_IDEAS_CREATE_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to create channel idea" }, { status: 500 });
  }
}
