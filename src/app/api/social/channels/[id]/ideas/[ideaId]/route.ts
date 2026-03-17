export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { resolveSocialContext, SocialContextError, updateSaasSocialChannelIdea } from "@/lib/social/repository";

type IdeaPatchBody = {
  title?: string;
  angle?: string | null;
  summary?: string | null;
  status?: "idea" | "approved" | "converted" | "discarded";
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; ideaId: string }> }) {
  try {
    const body = (await request.json().catch(() => null)) as IdeaPatchBody | null;
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
    const ideaId = resolvedParams.ideaId?.trim();
    if (!channelId || !ideaId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "channelId and ideaId are required" }, { status: 400 });
    }
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const idea = await updateSaasSocialChannelIdea(ctx, {
      id: ideaId,
      channelId,
      title: body.title,
      angle: body.angle,
      summary: body.summary,
      status: body.status,
      updatedAt: "",
    });
    return NextResponse.json({ idea });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNEL_IDEA_UPDATE_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to update channel idea" }, { status: 500 });
  }
}
