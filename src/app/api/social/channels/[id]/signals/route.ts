export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getSaasSocialChannelSignals, resolveSocialContext, SocialContextError, upsertSaasSocialChannelSignals } from "@/lib/social/repository";

type SignalsBody = {
  topics?: string[];
  activeKeywords?: string[];
  trendNotes?: string | null;
  watchedCompetitors?: string[];
  watchedSources?: string[];
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
    const signals = await getSaasSocialChannelSignals(ctx, channelId);
    return NextResponse.json({ signals });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNEL_SIGNALS_GET_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to fetch channel signals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json().catch(() => null)) as SignalsBody | null;
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
    const signals = await upsertSaasSocialChannelSignals(ctx, {
      channelId,
      topics: body.topics ?? [],
      activeKeywords: body.activeKeywords ?? [],
      trendNotes: body.trendNotes ?? null,
      watchedCompetitors: body.watchedCompetitors ?? [],
      watchedSources: body.watchedSources ?? [],
    });
    return NextResponse.json({ signals });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNEL_SIGNALS_SAVE_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to save channel signals" }, { status: 500 });
  }
}
