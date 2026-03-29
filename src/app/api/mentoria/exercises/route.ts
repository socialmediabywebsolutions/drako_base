export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaBillingError } from "@/lib/mentoria/plans";
import { MentoriaService } from "@/lib/mentoria/service";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const exercises = await service.listExercises(actor);
    return NextResponse.json({ ok: true, exercises });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXERCISE_LOAD_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as
      | { action?: "generate"; subjectSlug: string; topic: string; difficultyLevel?: string }
      | { action: "correct"; exerciseId: string; studentAnswer: string };

    if (body.action === "correct") {
      const exercise = await service.correctExercise(actor, {
        exerciseId: body.exerciseId,
        studentAnswer: body.studentAnswer,
      });
      return NextResponse.json({ ok: true, exercise });
    }

    const exercise = await service.createExercise(actor, {
      subjectSlug: body.subjectSlug,
      topic: body.topic,
      difficultyLevel: body.difficultyLevel,
    });
    return NextResponse.json({ ok: true, exercise }, { status: 201 });
  } catch (error) {
    if (error instanceof MentoriaBillingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code, billing: error.billing }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "EXERCISE_ACTION_FAILED";
    const status =
      message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : 500;
    console.error("[ExerciseAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
