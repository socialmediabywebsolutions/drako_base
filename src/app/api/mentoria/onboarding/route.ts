import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";
import type { MentoriaOnboardingPayload } from "@/lib/mentoria/types";

export const dynamic = "force-dynamic";

type LegacyMentoriaOnboardingPayload = {
  fullName?: string;
  schoolYear?: string;
  stage?: MentoriaOnboardingPayload["student"]["stage"];
  subjects?: MentoriaOnboardingPayload["subjects"];
  familyStructure?: MentoriaOnboardingPayload["familyStructure"];
  hasRepeatedCourse?: boolean;
  parents?: Array<{
    fullName?: string;
    relation?: MentoriaOnboardingPayload["primaryGuardian"]["relation"];
    email?: string;
    slot?: string;
  }>;
  objective?: MentoriaOnboardingPayload["goal"];
  confidenceLevel?: MentoriaOnboardingPayload["confidenceLevel"];
  initialPriority?: MentoriaOnboardingPayload["initialPriority"];
  primaryConcern?: string;
};

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

function normalizePayload(body: unknown): MentoriaOnboardingPayload {
  if (!body || typeof body !== "object") {
    throw new Error("INVALID_ONBOARDING_PAYLOAD");
  }

  const payload = body as Partial<MentoriaOnboardingPayload> & LegacyMentoriaOnboardingPayload;

  if (payload.primaryGuardian && payload.student) {
    return payload as MentoriaOnboardingPayload;
  }

  const firstParent = Array.isArray(payload.parents) ? payload.parents.find((parent) => parent?.fullName?.trim()) : undefined;
  const secondParent = Array.isArray(payload.parents)
    ? payload.parents.filter((parent) => parent?.fullName?.trim())[1]
    : undefined;

  return {
    primaryGuardian: {
      fullName: firstParent?.fullName?.trim() ?? "",
      relation: firstParent?.relation ?? "tutor",
    },
    secondaryGuardian: secondParent
      ? {
          fullName: secondParent.fullName?.trim() ?? "",
          relation: secondParent.relation ?? "tutor",
          ...(secondParent.email?.trim() ? { email: secondParent.email.trim() } : {}),
        }
      : null,
    familyStructure: payload.familyStructure ?? (secondParent ? "two_guardians" : "single_guardian"),
    student: {
      fullName: payload.fullName?.trim() ?? "",
      stage: payload.stage,
      schoolYear: payload.schoolYear?.trim() ?? "",
      hasRepeatedCourse: payload.hasRepeatedCourse,
    },
    subjects: Array.isArray(payload.subjects) ? payload.subjects : [],
    goal: payload.objective ?? "improve_understanding",
    confidenceLevel: payload.confidenceLevel ?? "medium",
    initialPriority: payload.initialPriority,
    primaryConcern: payload.primaryConcern,
  };
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

    const body = normalizePayload(await request.json());

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
