export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { resolveSocialContext, SocialContextError } from "@/lib/socialflow/repository";

const DEFAULT_SAAS_ID = "socialflow";

type FailedPostRow = {
  id: string;
  title: string;
  body: string;
  scheduled_at: string | null;
  created_at: string;
  metadata: string | null;
};

type FailedPostItem = {
  id: string;
  title: string;
  body: string;
  scheduledAt: string | null;
  createdAt: string;
  errorMessage: string;
  imagePrompt: string | null;
};

// Posts de Instagram que se quedaron en DRAFT porque no se pudo generar su imagen
// (metadata.error_message = IMAGE_GENERATION_FAILED, ver SocialFlowOrchestrator.persistToDb).
// Alimenta FailedPostsPanel en el dashboard del workspace.
export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = new URL(request.url).searchParams.get("saasId") ?? DEFAULT_SAAS_ID;
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });

    const { results } = await ctx.socialDb
      .prepare(
        `SELECT id, title, body, scheduled_at, created_at, metadata FROM saas_social_posts
         WHERE tenant_id = ? AND saas_id = ? AND status = 'DRAFT'
           AND json_extract(metadata, '$.error_message') = 'IMAGE_GENERATION_FAILED'
         ORDER BY created_at DESC LIMIT 20`,
      )
      .bind(session.tenantId, saasId)
      .all<FailedPostRow>();

    const posts: FailedPostItem[] = (results ?? []).map((row) => {
      let metadata: Record<string, unknown> | null = null;
      try {
        metadata = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null;
      } catch {
        // metadata corrupta — el filtro SQL ya garantizó el error_message
      }
      return {
        id: row.id,
        title: row.title,
        body: row.body,
        scheduledAt: row.scheduled_at,
        createdAt: row.created_at,
        errorMessage: typeof metadata?.error_message === "string" ? metadata.error_message : "IMAGE_GENERATION_FAILED",
        imagePrompt: typeof metadata?.imagePrompt === "string" ? metadata.imagePrompt : null,
      };
    });

    return NextResponse.json({ ok: true, posts });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_FAILED_POSTS_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
