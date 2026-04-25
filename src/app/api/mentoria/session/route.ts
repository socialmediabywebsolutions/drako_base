export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaBillingError } from "@/lib/mentoria/plans";
import { MentoriaService } from "@/lib/mentoria/service";
import type {
  MentoriaClassroomIntent,
  MentoriaSessionInputKind,
  MentoriaSessionMode,
  MentoriaStudentSessionSignal,
} from "@/lib/mentoria/types";

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as {
      studentId?: string;
      subjectSlug?: string;
      topic?: string;
      message: string;
      entryMode?: "resume_session" | "gentle_restart" | "momentum_push" | "plan_task" | "entry";
      intent?: MentoriaClassroomIntent;
      sessionMode?: MentoriaSessionMode;
      sessionInputKind?: MentoriaSessionInputKind;
      sessionSignal?: MentoriaStudentSessionSignal;
    };
    const subjectSlug = body.subjectSlug?.trim() ?? "";
    if (!subjectSlug) {
      return NextResponse.json({ ok: false, error: "SUBJECT_REQUIRED" }, { status: 400 });
    }
    const result = await service.startGuidedSession(actor, {
      ...body,
      subjectSlug,
      studentProfileId: body.studentId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof MentoriaBillingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code, billing: error.billing }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "SESSION_CREATE_FAILED";
    const status =
      message === "SESSION_REQUIRED"
        ? 401
        : message === "ONBOARDING_REQUIRED"
          ? 409
          : message === "SUBJECT_REQUIRED"
            ? 400
          : message === "STUDENT_ACCESS_DENIED" || message === "SUBJECT_ACCESS_DENIED"
            ? 403
            : message === "SUBJECT_CONTEXT_MISMATCH"
          ? 409
            : message === "MENTORIA_AI_NOT_AVAILABLE" || message === "MENTORIA_AI_TIMEOUT" || message === "MENTORIA_AI_EMPTY_RESPONSE"
              ? 503
            : message === "MENTORIA_AI_PROVIDER_ERROR"
              ? 502
            : 500;
    console.error("[SessionAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
