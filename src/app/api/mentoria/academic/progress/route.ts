export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaAcademicService } from "@/lib/mentoria/academic-service";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaAcademicService();
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim() || undefined;
    const progress = await service.getProgress(actor, studentId);
    return NextResponse.json({ ok: true, progress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_ACADEMIC_PROGRESS_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : message === "STUDENT_ACCESS_DENIED" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
