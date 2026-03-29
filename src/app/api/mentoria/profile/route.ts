export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const dashboard = await service.getDashboard(actor);
    return NextResponse.json({
      ok: true,
      student: dashboard.student,
      parents: dashboard.parents,
      studentSubjects: dashboard.studentSubjects,
      evolution: dashboard.evolution,
      interventions: dashboard.interventions,
      motivation: dashboard.motivation,
      dailyPlan: dashboard.dailyPlan,
      billing: dashboard.billing,
      growth: dashboard.growth,
      insights: dashboard.insights,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROFILE_LOAD_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as
      {
          parents: Array<{
            slot: "Parent A" | "Parent B";
            fullName: string;
            email: string;
            dailyStudyMinutes: number;
            supervisionLevel: "light" | "balanced" | "close";
            canViewFullProgress: boolean;
            canManageSchedule: boolean;
          }>;
        };
    const parents = await service.saveParents(actor, body.parents);
    return NextResponse.json({ ok: true, parents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROFILE_SAVE_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
