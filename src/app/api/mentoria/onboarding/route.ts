import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";
import type { MentoriaOnboardingPayload } from "@/lib/mentoria/types";

export const dynamic = "force-dynamic";

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
    const message =
      error instanceof Error ? error.message : "ONBOARDING_LOAD_FAILED";

    return NextResponse.json(
      { ok: false, error: message },
      { status: statusFor(message) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();

    const body = (await request.json()) as MentoriaOnboardingPayload;

    const result = await service.submitOnboarding(actor, body);

    const safeResult = JSON.parse(
      JSON.stringify(result, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value,
      ),
    ) as typeof result;

    return NextResponse.json({ ok: true, ...safeResult });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ONBOARDING_SUBMIT_FAILED";

    return NextResponse.json(
      { ok: false, error: message },
      { status: statusFor(message) },
    );
  }
}
