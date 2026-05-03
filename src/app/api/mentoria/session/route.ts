export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaBillingError } from "@/lib/mentoria/plans";
import { MentoriaService } from "@/lib/mentoria/service";
import { UpgradeFlowError } from "@/lib/mentoria/upgrade-flow";
import type {
  MentoriaClassroomIntent,
  MentoriaSessionInputKind,
  MentoriaSessionMode,
  MentoriaStudentSessionSignal,
} from "@/lib/mentoria/types";

function buildMentoriaAccessResponse(error: UpgradeFlowError) {
  const upgradeUrl = "/mentoria/upgrade";
  if (error.code === "trial_expired") {
    return NextResponse.json(
      {
        ok: false,
        error: "MENTORIA_ACCESS_EXPIRED",
        reason: "TRIAL_EXPIRED",
        upgradeUrl,
        upgradePrompt: error.upgradePrompt ?? null,
      },
      { status: 402 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "MENTORIA_ACCESS_LIMIT_REACHED",
      reason: error.code === "usage_limit_reached" ? "USAGE_LIMIT_REACHED" : "UPGRADE_REQUIRED",
      upgradeUrl,
      upgradePrompt: error.upgradePrompt ?? null,
    },
    { status: 402 },
  );
}

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
      learningState?: unknown;
      boardContext?: unknown;
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
    if (!result.tutorMessage?.trim() || !result.boardUpdate) {
      throw new Error("MENTORIA_AI_EMPTY_RESPONSE");
    }
    return NextResponse.json({
      ok: true,
      ...result,
      learningState: result.learningStateUpdated ?? result.boardUpdate.learningState ?? null,
    });
  } catch (error) {
    if (error instanceof MentoriaBillingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code, billing: error.billing }, { status: error.status });
    }
    if (error instanceof UpgradeFlowError) {
      return buildMentoriaAccessResponse(error);
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
            : message === "AI_BINDING_MISSING" || message === "MENTORIA_AI_NOT_AVAILABLE" || message === "MENTORIA_AI_TIMEOUT" || message === "MENTORIA_AI_EMPTY_RESPONSE"
              ? 503
            : message === "AI_PROVIDER_UNAVAILABLE"
              ? 503
            : message === "MENTORIA_AI_PROVIDER_ERROR"
              ? 502
            : 500;
    console.error("[SessionAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
