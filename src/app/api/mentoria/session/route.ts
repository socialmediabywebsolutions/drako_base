export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaBillingError } from "@/lib/mentoria/plans";
import { MentoriaService } from "@/lib/mentoria/service";
import type { MentoriaSessionInputKind, MentoriaSessionMode, MentoriaStudentSessionSignal } from "@/lib/mentoria/types";

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as {
      subjectSlug?: string;
      topic?: string;
      message: string;
      entryMode?: "resume_session" | "gentle_restart" | "momentum_push" | "plan_task" | "entry";
      sessionMode?: MentoriaSessionMode;
      sessionInputKind?: MentoriaSessionInputKind;
      sessionSignal?: MentoriaStudentSessionSignal;
    };
    const result = await service.startGuidedSession(actor, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof MentoriaBillingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code, billing: error.billing }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "SESSION_CREATE_FAILED";
    const status =
      message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : 500;
    console.error("[SessionAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
