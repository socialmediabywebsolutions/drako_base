export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";

type JobRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  image_url: string;
  prompt: string | null;
  status: string;
  video_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ ok: false, error: "INVALID_JOB_ID" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);

    const socialDb = env()?.SOCIAL_DB;
    if (!socialDb) {
      return NextResponse.json({ ok: false, error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }

    // WHERE tenant_id = ? además de id = ? — un jobId de otro tenant nunca debe ser
    // legible desde aquí, aunque alguien lo adivine o lo intercepte.
    const row = await socialDb
      .prepare(
        `SELECT id, tenant_id, saas_id, image_url, prompt, status, video_url, error, created_at, updated_at
         FROM socialflow_ai_video_jobs
         WHERE id = ? AND tenant_id = ?
         LIMIT 1`,
      )
      .bind(jobId, session.tenantId)
      .first<JobRow>();

    if (!row) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      job: {
        id: row.id,
        saasId: row.saas_id,
        imageUrl: row.image_url,
        prompt: row.prompt,
        status: row.status,
        videoUrl: row.video_url,
        error: row.error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_AI_VIDEO_STATUS_ERROR", error);
    return NextResponse.json({ ok: false, error: "SOCIALFLOW_ERROR", message: "Unable to fetch job status" }, { status: 500 });
  }
}
