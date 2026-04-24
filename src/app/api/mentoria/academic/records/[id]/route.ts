export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaAcademicService } from "@/lib/mentoria/academic-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const { id } = await params;
    const service = new MentoriaAcademicService();
    const result = await service.getRecordDetail(actor, id);
    if (!result.detail) {
      return NextResponse.json({ ok: false, error: "MENTORIA_ACADEMIC_RECORD_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, studentId: result.studentId, detail: result.detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_ACADEMIC_DETAIL_LOAD_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : message === "STUDENT_ACCESS_DENIED" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
