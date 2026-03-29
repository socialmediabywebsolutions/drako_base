export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaFamilyService } from "@/lib/mentoria/family-service";

function statusFor(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "FAMILY_ACCESS_DENIED") return 403;
  if (message === "FAMILY_REQUIRED") return 409;
  if (message === "INVALID_STUDENT_NAME") return 400;
  return 500;
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const body = (await request.json().catch(() => null)) as {
      name?: string;
      age?: number | null;
      level?: string | null;
    } | null;
    const service = new MentoriaFamilyService();
    const result = await service.createStudent(actor, {
      name: body?.name,
      age: body?.age ?? null,
      level: body?.level ?? null,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CREATE_STUDENT_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
