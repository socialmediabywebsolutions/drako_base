export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaFamilyService } from "@/lib/mentoria/family-service";
import type { MentoriaGuardianRole } from "@/lib/mentoria/types";

function statusFor(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "FAMILY_ACCESS_DENIED") return 403;
  if (message === "FAMILY_REQUIRED") return 409;
  if (message === "INVALID_GUARDIAN_EMAIL") return 400;
  return 500;
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const body = (await request.json().catch(() => null)) as {
      email?: string;
      name?: string | null;
      role?: MentoriaGuardianRole;
    } | null;
    const service = new MentoriaFamilyService();
    const result = await service.inviteGuardian(actor, {
      email: body?.email,
      name: body?.name ?? null,
      role: body?.role ?? "tutor",
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVITE_GUARDIAN_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
