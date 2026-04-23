export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim() || undefined;
    const result = await service.getProgress(actor, studentId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROGRESS_LOAD_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : message === "STUDENT_ACCESS_DENIED" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
