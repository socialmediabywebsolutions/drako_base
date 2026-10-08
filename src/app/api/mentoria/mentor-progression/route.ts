export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { calculateLevel } from "@/lib/mentoria/progression-system";
import type { StudentProgression, StudentAchievement } from "@/lib/mentoria/progression-system";

// GET /api/mentoria/mentor-progression?studentId=xxx
// GET /api/mentoria/mentor-progression?studentId=xxx&include=achievements
// Vista de progresión y logros de un alumno para el mentor (owner|admin)

export async function GET(req: NextRequest) {
  const actor = await requireCurrentMentoriaSession(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const includeAchievements = searchParams.get("include") === "achievements";

  if (!studentId) {
    return NextResponse.json({ error: "studentId_required" }, { status: 400 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Verify student belongs to this tenant
  const profileRow = await db
    .prepare(
      "SELECT id FROM mentoria_student_profiles WHERE id = ? AND tenant_id = ?",
    )
    .bind(studentId, actor.tenantId)
    .first() as Record<string, unknown> | null;

  if (!profileRow) {
    return NextResponse.json({ error: "student_not_found" }, { status: 404 });
  }

  // Get or return null progression
  const progRow = await db
    .prepare(
      "SELECT * FROM mentoria_student_progression WHERE student_id = ? AND tenant_id = ?",
    )
    .bind(studentId, actor.tenantId)
    .first() as Record<string, unknown> | null;

  let progression: StudentProgression | null = null;

  if (progRow) {
    const xpTotal = Number(progRow.xp_total ?? 0);
    const { level, name: levelName, progressPercent, xpToNextLevel } = calculateLevel(xpTotal);
    progression = {
      id: String(progRow.id),
      tenantId: String(progRow.tenant_id),
      studentId: String(progRow.student_id),
      xpTotal,
      xpThisWeek: Number(progRow.xp_this_week ?? 0),
      level,
      levelName,
      levelProgress: progressPercent,
      xpToNextLevel,
      streakDays: Number(progRow.streak_days ?? 0),
      streakBest: Number(progRow.streak_best ?? 0),
      sessionsCompleted: Number(progRow.sessions_completed ?? 0),
      sessionsThisWeek: Number(progRow.sessions_this_week ?? 0),
      examsCompleted: Number(progRow.exams_completed ?? 0),
      lastActivityDate: progRow.last_activity_date
        ? String(progRow.last_activity_date)
        : null,
    };
  }

  if (!includeAchievements) {
    return NextResponse.json({ progression });
  }

  // Get achievements
  const achRows = await db
    .prepare(
      "SELECT * FROM mentoria_student_achievements WHERE student_id = ? ORDER BY unlocked_at DESC",
    )
    .bind(studentId)
    .all() as { results?: Record<string, unknown>[] };

  const achievements: StudentAchievement[] = (achRows.results ?? []).map((r) => ({
    id: String(r.id),
    achievementId: String(r.achievement_id),
    achievementLabel: String(r.achievement_label),
    achievementDescription: String(r.achievement_description),
    achievementIcon: String(r.achievement_icon),
    xpAwarded: Number(r.xp_awarded ?? 0),
    unlockedAt: String(r.unlocked_at),
  }));

  return NextResponse.json({ progression, achievements });
}
