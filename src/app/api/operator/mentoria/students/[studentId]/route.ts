export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDb } from "@/lib/mentoria/db";

export async function GET(
  request: Request,
  { params }: { params: { studentId: string } },
) {
  try {
    await requireOwnerAccess(request);

    const { studentId } = params;
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    // ── Profile ──────────────────────────────────────────────────────────────
    const profile = await db
      .prepare(
        `SELECT s.id, s.tenant_id, s.name, s.age, s.school_year, s.family_id,
                s.created_at, s.updated_at,
                sub.plan_code AS plan, sub.status AS sub_status,
                sub.current_period_end AS trial_ends_at
         FROM mentoria_students s
         LEFT JOIN saas_subscriptions sub
           ON sub.tenant_id = s.tenant_id AND sub.saas_slug = 'mentoria'
         WHERE s.id = ?`,
      )
      .bind(studentId)
      .first<{
        id: string; tenant_id: string; name: string; age: number | null;
        school_year: string | null; family_id: string | null;
        created_at: string; updated_at: string;
        plan: string | null; sub_status: string | null; trial_ends_at: string | null;
      }>();

    if (!profile) {
      return NextResponse.json({ ok: false, error: "STUDENT_NOT_FOUND" }, { status: 404 });
    }

    // ── Session stats ─────────────────────────────────────────────────────────
    const sessionStats = await db
      .prepare(
        `SELECT
           COUNT(*)                                              AS total,
           SUM(CASE WHEN date(started_at) = ? THEN 1 ELSE 0 END) AS today,
           SUM(CASE WHEN started_at >= date('now','-7 days')   THEN 1 ELSE 0 END) AS this_week,
           MAX(started_at)                                       AS last_at,
           AVG(CASE WHEN duration_seconds IS NOT NULL
               THEN duration_seconds ELSE NULL END)              AS avg_duration_s
         FROM mentoria_sessions
         WHERE student_id = ? AND tenant_id = ?`,
      )
      .bind(today, studentId, profile.tenant_id)
      .first<{
        total: number; today: number; this_week: number;
        last_at: string | null; avg_duration_s: number | null;
      }>();

    // ── Progression ───────────────────────────────────────────────────────────
    const progression = await db
      .prepare(
        `SELECT xp_total, xp_this_week, level, level_name, streak_days, streak_best,
                sessions_completed, exams_completed
         FROM mentoria_student_progression WHERE student_id = ?`,
      )
      .bind(studentId)
      .first<{
        xp_total: number; xp_this_week: number; level: number; level_name: string;
        streak_days: number; streak_best: number;
        sessions_completed: number; exams_completed: number;
      }>();

    // ── Recent sessions (last 10) ─────────────────────────────────────────────
    const recentSessions = await db
      .prepare(
        `SELECT id, subject_slug, started_at, ended_at, duration_seconds,
                status, xp_earned
         FROM mentoria_sessions
         WHERE student_id = ? AND tenant_id = ?
         ORDER BY started_at DESC LIMIT 10`,
      )
      .bind(studentId, profile.tenant_id)
      .all<{
        id: string; subject_slug: string | null;
        started_at: string; ended_at: string | null;
        duration_seconds: number | null; status: string; xp_earned: number | null;
      }>();

    // ── Declared exams (active) ───────────────────────────────────────────────
    const exams = await db
      .prepare(
        `SELECT id, subject_name, exam_date, difficulty, status,
                sessions_planned, sessions_done
         FROM mentoria_declared_exams
         WHERE student_id = ? AND tenant_id = ? AND status = 'active'
         ORDER BY exam_date ASC LIMIT 5`,
      )
      .bind(studentId, profile.tenant_id)
      .all<{
        id: string; subject_name: string; exam_date: string;
        difficulty: string; status: string;
        sessions_planned: number; sessions_done: number;
      }>();

    // ── Achievements (last 5) ─────────────────────────────────────────────────
    const achievements = await db
      .prepare(
        `SELECT achievement_label, achievement_icon, xp_awarded, unlocked_at
         FROM mentoria_student_achievements
         WHERE student_id = ? AND tenant_id = ?
         ORDER BY unlocked_at DESC LIMIT 5`,
      )
      .bind(studentId, profile.tenant_id)
      .all<{
        achievement_label: string; achievement_icon: string;
        xp_awarded: number; unlocked_at: string;
      }>();

    return NextResponse.json({
      ok: true,
      student: {
        id:          profile.id,
        tenantId:    profile.tenant_id,
        name:        profile.name,
        age:         profile.age,
        schoolYear:  profile.school_year,
        familyId:    profile.family_id,
        createdAt:   profile.created_at,
        plan:        profile.plan,
        subStatus:   profile.sub_status,
        trialEndsAt: profile.sub_status === "trial" ? profile.trial_ends_at : null,
      },
      sessionStats: {
        total:          sessionStats?.total ?? 0,
        today:          sessionStats?.today ?? 0,
        thisWeek:       sessionStats?.this_week ?? 0,
        lastAt:         sessionStats?.last_at ?? null,
        avgDurationMin: sessionStats?.avg_duration_s
          ? Math.round((sessionStats.avg_duration_s) / 60)
          : null,
      },
      progression: progression ?? null,
      recentSessions: recentSessions.results ?? [],
      activeExams:    exams.results ?? [],
      achievements:   achievements.results ?? [],
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "STUDENT_DETAIL_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
