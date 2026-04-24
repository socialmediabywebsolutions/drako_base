export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim() || undefined;
    const workspace = await service.getWorkspaceExperience(actor, studentId);
    return NextResponse.json({
      ok: true,
      student: workspace.student,
      family: workspace.family,
      primaryGuardian: workspace.primaryGuardian,
      secondaryGuardians: workspace.secondaryGuardians,
      guardianStudentAccess: workspace.guardianStudentAccess,
      studentSubjects: workspace.studentSubjects,
      progress: workspace.progress,
      analysis: workspace.analysis,
      exercises: workspace.exercises,
      motivation: workspace.motivation,
      dailyPlan: workspace.dailyPlan,
      billing: workspace.billing,
      recentSessions: workspace.recentSessions,
      focusSessions: workspace.focusSessions,
      entry: workspace.entry,
      memory: workspace.memory,
      learningMemory: workspace.learningMemory,
      subjectMemories: workspace.subjectMemories,
      evolution: workspace.evolution,
      growth: workspace.growth,
      dailyClosure: workspace.dailyClosure,
      guardianHooks: workspace.guardianHooks,
      behavioralRollout: workspace.behavioralRollout,
      behavioralShadow: workspace.behavioralShadow,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WORKSPACE_LOAD_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : message === "STUDENT_ACCESS_DENIED" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
