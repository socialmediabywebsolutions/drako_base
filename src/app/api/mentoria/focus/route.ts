export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const body = (await request.json()) as
      | { action?: "start"; subjectId?: string; studyPlanId?: string; durationMinutes: number; notes?: string }
      | { action: "complete"; focusSessionId: string; distractionsCount: number; notes?: string };

    if (body.action === "complete") {
      const focusSession = await service.completeFocus(actor, body);
      return NextResponse.json({ ok: true, focusSession });
    }

    const focusSession = await service.startFocus(actor, body);
    return NextResponse.json({ ok: true, focusSession }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FOCUS_ACTION_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
