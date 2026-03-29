export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const body = (await request.json()) as { invitedEmail?: string };
    const service = new MentoriaService();
    const result = await service.createReferralInvite(actor, { invitedEmail: body.invitedEmail });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_REFERRAL_INVITE_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ONBOARDING_REQUIRED" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
