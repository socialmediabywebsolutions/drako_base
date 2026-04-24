export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaBillingError } from "@/lib/mentoria/plans";
import { MentoriaService } from "@/lib/mentoria/service";

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as {
      message?: string;
      studentId?: string;
      subjectSlug?: string;
      topic?: string;
    };

    const message = body.message?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";
    const subjectSlug = body.subjectSlug?.trim() ?? "";

    if (!message) {
      return NextResponse.json({ ok: false, error: "MESSAGE_REQUIRED" }, { status: 400 });
    }
    if (!studentId) {
      return NextResponse.json({ ok: false, error: "STUDENT_REQUIRED" }, { status: 400 });
    }
    if (!subjectSlug) {
      return NextResponse.json({ ok: false, error: "SUBJECT_REQUIRED" }, { status: 400 });
    }

    const result = await service.startGuidedSession(actor, {
      studentProfileId: studentId,
      subjectSlug,
      topic: body.topic?.trim() || undefined,
      message,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof MentoriaBillingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code, billing: error.billing }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "MENTORIA_CHAT_FAILED";
    const status =
      message === "SESSION_REQUIRED"
        ? 401
        : message === "ONBOARDING_REQUIRED"
          ? 409
          : message === "STUDENT_ACCESS_DENIED" || message === "SUBJECT_ACCESS_DENIED"
            ? 403
            : message === "SUBJECT_REQUIRED" || message === "STUDENT_REQUIRED" || message === "MESSAGE_REQUIRED"
              ? 400
              : message === "SUBJECT_NOT_FOUND"
                ? 404
                : 500;
    console.error("[MentoriaChatAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
