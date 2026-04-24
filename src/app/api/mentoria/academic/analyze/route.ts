export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import type { MentoriaAcademicAnalyzeRequestInput } from "@/lib/mentoria/academic-types";
import { MentoriaAcademicService } from "@/lib/mentoria/academic-service";

function resolveRouteStatus(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
  if (message === "STUDENT_ACCESS_DENIED") return 403;
  if (message === "MENTORIA_ACADEMIC_SOURCE_REQUIRED") return 400;
  return 500;
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaAcademicService();
    const body = (await request.json()) as MentoriaAcademicAnalyzeRequestInput;
    const result = await service.analyze(actor, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_ACADEMIC_ANALYZE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: resolveRouteStatus(message) });
  }
}
