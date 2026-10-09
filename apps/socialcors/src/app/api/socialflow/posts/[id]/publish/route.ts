export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { resolveSocialContext, SocialContextError } from "@/lib/socialflow/repository";
import { publishSocialPostLive } from "@/lib/socialflow/live-publishing";

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
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required in the request body" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });

    const result = await publishSocialPostLive(ctx, postId, { skipClaim: true });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message, post: result.post },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      externalPostId: result.externalPostId,
      code: result.code,
      message: result.message,
      post: result.post,
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PUBLISH_NOW_ERROR", error);
    return NextResponse.json(
      { code: "PUBLISH_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
