export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";
import type { MentoriaGuardian, MentoriaGuardianStudentAccess } from "@/lib/mentoria/types";

type LegacyParentsPayload = {
  parents?: Array<{
    slot: "Parent A" | "Parent B";
    fullName: string;
    email: string;
    dailyStudyMinutes: number;
    supervisionLevel: "light" | "balanced" | "close";
    canViewFullProgress: boolean;
    canManageSchedule: boolean;
  }>;
};

type CanonicalGuardianPayload = {
  id?: string | null;
  fullName: string;
  email: string;
  familyRelation?: MentoriaGuardian["familyRelation"];
  systemRole: MentoriaGuardian["systemRole"];
  access: {
    dailyStudyMinutes: number;
    supervisionLevel: MentoriaGuardianStudentAccess["supervisionLevel"];
    canViewFullProgress: boolean;
    canManageSchedule: boolean;
    notificationPreferences?: string[];
    isPrimaryContact?: boolean;
  };
};

type CanonicalFamilyProfilePayload = {
  family?: { id?: string | null } | null;
  primaryGuardian?: CanonicalGuardianPayload | null;
  secondaryGuardians?: CanonicalGuardianPayload[];
  guardianStudentAccess?: MentoriaGuardianStudentAccess[];
};

function normalizeProfilePayload(body: CanonicalFamilyProfilePayload & LegacyParentsPayload) {
  if (body.primaryGuardian || body.secondaryGuardians) {
    return {
      primaryGuardian: body.primaryGuardian ?? null,
      secondaryGuardians: body.secondaryGuardians ?? [],
    };
  }

  const parents = body.parents ?? [];
  const primaryParent = parents.find((parent) => parent.slot === "Parent A") ?? null;
  const secondaryParents = parents.filter((parent) => parent.slot !== "Parent A");

  return {
    primaryGuardian: primaryParent
      ? {
          fullName: primaryParent.fullName,
          email: primaryParent.email,
          systemRole: "primary_guardian" as const,
          access: {
            dailyStudyMinutes: primaryParent.dailyStudyMinutes,
            supervisionLevel: primaryParent.supervisionLevel,
            canViewFullProgress: primaryParent.canViewFullProgress,
            canManageSchedule: primaryParent.canManageSchedule,
            notificationPreferences: ["progress", "planner"],
            isPrimaryContact: true,
          },
        }
      : null,
    secondaryGuardians: secondaryParents.map((parent) => ({
      fullName: parent.fullName,
      email: parent.email,
      systemRole: "secondary_guardian" as const,
      access: {
        dailyStudyMinutes: parent.dailyStudyMinutes,
        supervisionLevel: parent.supervisionLevel,
        canViewFullProgress: parent.canViewFullProgress,
        canManageSchedule: parent.canManageSchedule,
        notificationPreferences: ["progress", "planner"],
        isPrimaryContact: false,
      },
    })),
  };
}

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim() || undefined;
    const dashboard = await service.getDashboard(actor, studentId);
    const familyBundle = await service.getOnboardingState(actor);
    return NextResponse.json({
      ok: true,
      student: dashboard.student,
      family: dashboard.family,
      primaryGuardian: dashboard.primaryGuardian,
      secondaryGuardians: dashboard.secondaryGuardians,
      guardianStudentAccess: dashboard.guardianStudentAccess,
      sessionContext: dashboard.sessionContext,
      studentSubjects: dashboard.studentSubjects,
      evolution: dashboard.evolution,
      interventions: dashboard.interventions,
      motivation: dashboard.motivation,
      dailyPlan: dashboard.dailyPlan,
      billing: dashboard.billing,
      growth: dashboard.growth,
      insights: dashboard.insights,
      familyStudents: familyBundle.familyStudents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROFILE_LOAD_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : message === "STUDENT_ACCESS_DENIED" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as CanonicalFamilyProfilePayload & LegacyParentsPayload;
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim() || undefined;
    await service.saveFamilyGuardiansProfile(actor, normalizeProfilePayload(body), studentId);
    const dashboard = await service.getDashboard(actor, studentId);
    return NextResponse.json({
      ok: true,
      family: dashboard.family,
      primaryGuardian: dashboard.primaryGuardian,
      secondaryGuardians: dashboard.secondaryGuardians,
      guardianStudentAccess: dashboard.guardianStudentAccess,
      sessionContext: dashboard.sessionContext,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROFILE_SAVE_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : message === "STUDENT_ACCESS_DENIED" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
