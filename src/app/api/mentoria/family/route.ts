export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaFamilyService } from "@/lib/mentoria/family-service";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

function statusFor(message: string) {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "FAMILY_ACCESS_DENIED") return 403;
  if (message === "FAMILY_NOT_FOUND") return 404;
  return 500;
}

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const db = getMentoriaDb();
    const repository = new MentoriaFamilyRepository(db);
    const service = new MentoriaFamilyService(repository);
    const familyBundle = await service.getFamilyForSession(actor);
    return NextResponse.json({ ok: true, ...familyBundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FAMILY_LOAD_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
