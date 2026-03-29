export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const workspace = await service.getWorkspaceExperience(actor);
    return NextResponse.json({
      ok: true,
      student: workspace.student,
      hooks: workspace.guardianHooks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_HOOKS_LOAD_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
