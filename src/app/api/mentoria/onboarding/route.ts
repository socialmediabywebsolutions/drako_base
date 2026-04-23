import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";
import type { MentoriaOnboardingPayload } from "@/lib/mentoria/types";

export const dynamic = "force-dynamic";

type LegacyMentoriaOnboardingPayload = {
  fullName?: string;
  schoolYear?: string;
  age?: number;
  approximateAge?: number;
  stage?: MentoriaOnboardingPayload["student"]["stage"];
  subjects?: MentoriaOnboardingPayload["student"]["subjects"];
  familyStructure?: MentoriaOnboardingPayload["familyStructure"];
  hasRepeatedCourse?: boolean;
  supportNeeds?: MentoriaOnboardingPayload["student"]["supportNeeds"];
  supportStyle?: MentoriaOnboardingPayload["student"]["supportStyle"];
  parents?: Array<{
    fullName?: string;
    relation?: MentoriaOnboardingPayload["primaryGuardian"]["relation"];
    email?: string;
    slot?: string;
  }>;
};

function statusFor(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
  if (message === "MENTORIA_AI_NOT_AVAILABLE") return 503;
  if (
    message.startsWith("INVALID_")
    || message === "SUBJECTS_REQUIRED"
    || message === "SUPPORT_NEEDS_REQUIRED"
    || message === "PARENT_CONFIGURATION_REQUIRED"
    || message.startsWith("SUBJECT_NOT_FOUND:")
  ) {
    return 400;
  }
  return 500;
}

function inferAgeFromSchoolYear(schoolYear: string) {
  const year = schoolYear.toLowerCase().trim();
  if (year === "1 primaria") return 6;
  if (year === "2 primaria") return 7;
  if (year === "3 primaria") return 8;
  if (year === "4 primaria") return 9;
  if (year === "5 primaria") return 10;
  if (year === "6 primaria") return 11;
  if (year === "1 eso") return 12;
  if (year === "2 eso") return 13;
  if (year === "3 eso") return 14;
  if (year === "4 eso") return 15;
  if (year === "1 bachillerato") return 16;
  if (year === "2 bachillerato") return 17;
  return 13;
}

function normalizePayload(body: unknown): MentoriaOnboardingPayload {
  if (!body || typeof body !== "object") {
    throw new Error("INVALID_ONBOARDING_PAYLOAD");
  }

  const payload = body as Partial<MentoriaOnboardingPayload> & LegacyMentoriaOnboardingPayload;

  if (payload.primaryGuardian && payload.student && Array.isArray(payload.student.subjects)) {
    return {
      primaryGuardian: payload.primaryGuardian,
      secondaryGuardian: payload.secondaryGuardian ?? null,
      familyStructure: payload.familyStructure,
      student: {
        fullName: payload.student.fullName?.trim() ?? "",
        stage: payload.student.stage,
        schoolYear: payload.student.schoolYear?.trim() ?? "",
        age: Number(payload.student.age ?? inferAgeFromSchoolYear(payload.student.schoolYear ?? "2 ESO")),
        repeatedCourseStatus: payload.student.repeatedCourseStatus ?? "never",
        repeatedCourseYears: payload.student.repeatedCourseYears ?? [],
        subjects: payload.student.subjects,
        supportNeeds: payload.student.supportNeeds ?? ["base_gap"],
        supportStyle: payload.student.supportStyle ?? "step_by_step",
      },
      additionalStudents: payload.additionalStudents ?? [],
      referralCode: payload.referralCode,
      inviteToken: payload.inviteToken,
    };
  }

  const firstParent = Array.isArray(payload.parents) ? payload.parents.find((parent) => parent?.fullName?.trim()) : undefined;
  const secondParent = Array.isArray(payload.parents)
    ? payload.parents.filter((parent) => parent?.fullName?.trim())[1]
    : undefined;
  const schoolYear = payload.schoolYear?.trim() ?? "";

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
      schoolYear,
      age: Number(payload.age ?? payload.approximateAge ?? inferAgeFromSchoolYear(schoolYear || "2 ESO")),
      repeatedCourseStatus: payload.hasRepeatedCourse ? "before" : "never",
      repeatedCourseYears: [],
      subjects: Array.isArray(payload.subjects) ? payload.subjects : [],
      supportNeeds: Array.isArray(payload.supportNeeds) && payload.supportNeeds.length > 0 ? payload.supportNeeds : ["base_gap"],
      supportStyle: payload.supportStyle ?? "step_by_step",
    },
    additionalStudents: [],
  };
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
    const body = normalizePayload(await request.json());
    const result = await service.submitOnboarding(actor, body);
    const safeResult = JSON.parse(
      JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? Number(value) : value)),
    ) as typeof result;
    return NextResponse.json({ ok: true, ...safeResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ONBOARDING_SUBMIT_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
