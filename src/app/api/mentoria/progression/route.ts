import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMentoriaActor } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import {
  getOrCreateProgression,
  awardXp,
  getAchievements,
  type XpEventReason,
} from "@/lib/mentoria/progression-system";

// GET /api/mentoria/progression — obtener progresión del alumno
// GET /api/mentoria/progression?include=achievements — incluir logros desbloqueados
// POST /api/mentoria/progression — registrar evento XP (session_complete)

export async function GET(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const includeAchievements = searchParams.get("include") === "achievements";

  const progression = await getOrCreateProgression(db, actor.tenantId, actor.studentId);

  if (includeAchievements) {
    const achievements = await getAchievements(db, actor.studentId);
    return NextResponse.json({ progression, achievements });
  }

  return NextResponse.json({ progression });
}

export async function POST(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { reason, sessionId } = body as {
    reason: XpEventReason;
    sessionId?: string;
  };

  const validReasons: XpEventReason[] = [
    "session_complete",
    "exam_prep_session",
    "exam_simulation",
    "weekly_goal",
  ];

  if (!reason || !validReasons.includes(reason)) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 422 });
  }

  const { progression, newAchievements } = await awardXp(
    db,
    actor.tenantId,
    actor.studentId,
    reason,
    sessionId,
  );

  return NextResponse.json({ progression, newAchievements });
}
