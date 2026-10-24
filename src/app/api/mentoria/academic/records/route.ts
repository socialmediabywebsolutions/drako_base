export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import type { CreateMentoriaAcademicManualRecordRequestInput } from "@/lib/mentoria/academic-types";
import { MentoriaAcademicService } from "@/lib/mentoria/academic-service";

function resolveRouteStatus(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
  if (message === "STUDENT_ACCESS_DENIED") return 403;
  if (message === "MENTORIA_ACADEMIC_RECORD_INVALID") return 400;
  return 500;
}

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaAcademicService();
    const url = new URL(request.url);
    const result = await service.listRecords(actor, {
      studentId: url.searchParams.get("studentId")?.trim() || undefined,
      subjectSlug: url.searchParams.get("subjectSlug")?.trim() || undefined,
      recordType: url.searchParams.get("recordType")?.trim() || undefined,
      status: url.searchParams.get("status")?.trim() || undefined,
    });
    return NextResponse.json({ ok: true, student: result.student, records: result.records, documents: result.documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_ACADEMIC_LOAD_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: resolveRouteStatus(message) });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaAcademicService();
    const body = (await request.json()) as CreateMentoriaAcademicManualRecordRequestInput;
    if (!body?.title?.trim() || !body?.recordType) {
      return NextResponse.json({ ok: false, error: "MENTORIA_ACADEMIC_RECORD_INVALID" }, { status: 400 });
    }
    const result = await service.createManualRecord(actor, body);
    return NextResponse.json({ ok: true, student: result.student, record: result.record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_ACADEMIC_RECORD_CREATE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: resolveRouteStatus(message) });
  }
}
