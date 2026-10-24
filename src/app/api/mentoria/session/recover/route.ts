export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";
import { SessionPersistenceManager } from "@/lib/mentoria/session-persistence";

function statusFor(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
  if (message === "STUDENT_ACCESS_DENIED") return 403;
  if (message === "INVALID_SESSION_ID") return 400;
  return 500;
}

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const persistence = new SessionPersistenceManager();
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim() || undefined;

    const student = await service.getProfile(actor, studentId);
    if (!student || !student.onboardingCompleted) {
      return NextResponse.json({ ok: true, activeSession: null });
    }

    const activeSession = await persistence.getActiveSession(actor.tenantId, student.id);

    if (!activeSession) {
      return NextResponse.json({ ok: true, activeSession: null });
    }

    return NextResponse.json({ ok: true, activeSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SESSION_RECOVERY_FAILED";
    const status = statusFor(message);
    console.error("[SessionRecoveryAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as { sessionId: string; studentId?: string };
    const sessionId = body.sessionId?.trim();
    if (!sessionId) {
      throw new Error("INVALID_SESSION_ID");
    }

    const student = await service.getProfile(actor, body.studentId?.trim() || undefined);
    if (!student || !student.onboardingCompleted) {
      throw new Error("ONBOARDING_REQUIRED");
    }

    const persistence = new SessionPersistenceManager();
    const session = await persistence.getSessionSnapshot(actor.tenantId, sessionId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (session.studentProfileId !== student.id) {
      return NextResponse.json({ ok: false, error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    await persistence.resumeSession(actor.tenantId, sessionId);

    return NextResponse.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SESSION_RESUME_FAILED";
    const status = statusFor(message);
    console.error("[SessionRecoveryAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
