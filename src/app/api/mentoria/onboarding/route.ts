export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";

function statusFor(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
  if (message === "MENTORIA_AI_NOT_AVAILABLE") return 503;
  if (
    message.startsWith("INVALID_") ||
    message === "SUBJECTS_REQUIRED" ||
    message === "PARENT_CONFIGURATION_REQUIRED" ||
    message.startsWith("SUBJECT_NOT_FOUND:")
  ) {
    return 400;
  }
  return 500;
}

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const state = await service.getOnboardingState(actor);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ONBOARDING_LOAD_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as {
      fullName: string;
      age: number;
      schoolYear: string;
      subjects: Array<{ subjectSlug: string; initialLevel: "me_cuesta_mucho" | "voy_normal" | "se_me_da_bien" }>;
      emotionalBaseline?: { frustration: "low" | "medium" | "high"; motivation: "low" | "medium" | "high"; concentration: "low" | "medium" | "high" };
      learningPreference?: "practical_examples" | "step_by_step" | "quick_summaries";
      parents?: Array<{
        slot: "Parent A" | "Parent B";
        fullName: string;
        email: string;
        dailyStudyMinutes: number;
        supervisionLevel: "light" | "balanced" | "close";
      }>;
      objective?: "improve_understanding" | "pass_subject" | "build_habit" | "gain_confidence";
      confidenceLevel?: "low" | "medium" | "high";
      referralCode?: string;
      inviteToken?: string;
    };
    const result = await service.submitOnboarding(actor, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ONBOARDING_SUBMIT_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
