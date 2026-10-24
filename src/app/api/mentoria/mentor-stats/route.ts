export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// GET /api/mentoria/mentor-stats — estadísticas globales del tenant para mentor (owner|admin)

export type SubjectStat = {
  subjectName: string;
  sessionCount: number;
};

export type MentorStats = {
  totalStudents: number;
  totalSessions: number;
  avgSessionsPerStudent: number;
  studentsWithStreak: number;      // streak > 0
  studentsActiveThisWeek: number;
  studentsInactiveOver7d: number;
  topSubjects: SubjectStat[];
  streakDistribution: {
    none: number;      // 0
    low: number;       // 1-3
    medium: number;    // 4-7
    high: number;      // 8+
  };
};

type StudentAggRow = {
  total_students: number;
  total_sessions: number;
  students_with_streak: number;
  students_active_week: number;
  students_inactive_7d: number;
  streak_none: number;
  streak_low: number;
  streak_medium: number;
  streak_high: number;
};

type SubjectRow = {
  subject_name: string;
  session_count: number;
};

export async function GET(req: NextRequest) {
  let actor;
  try {
    actor = await requireCurrentMentoriaSession(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const now = new Date().toISOString();
  const week7dAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Main aggregate query
  const aggResult = await db
    .prepare(
      `SELECT
         COUNT(DISTINCT sp.id) as total_students,
         COUNT(s.id) as total_sessions,
         COUNT(DISTINCT CASE WHEN prog.session_streak > 0 THEN sp.id END) as students_with_streak,
         COUNT(DISTINCT CASE WHEN s2.created_at >= ? THEN sp.id END) as students_active_week,
         COUNT(DISTINCT CASE WHEN sp.id NOT IN (
           SELECT student_profile_id FROM mentoria_sessions
           WHERE tenant_id = sp.tenant_id AND status = 'completed' AND created_at >= ?
         ) THEN sp.id END) as students_inactive_7d,
         COUNT(DISTINCT CASE WHEN COALESCE(prog.session_streak,0) = 0 THEN sp.id END) as streak_none,
         COUNT(DISTINCT CASE WHEN COALESCE(prog.session_streak,0) BETWEEN 1 AND 3 THEN sp.id END) as streak_low,
         COUNT(DISTINCT CASE WHEN COALESCE(prog.session_streak,0) BETWEEN 4 AND 7 THEN sp.id END) as streak_medium,
         COUNT(DISTINCT CASE WHEN COALESCE(prog.session_streak,0) >= 8 THEN sp.id END) as streak_high
       FROM mentoria_student_profiles sp
       LEFT JOIN mentoria_sessions s
         ON s.student_profile_id = sp.id AND s.tenant_id = sp.tenant_id AND s.status = 'completed'
       LEFT JOIN mentoria_sessions s2
         ON s2.student_profile_id = sp.id AND s2.tenant_id = sp.tenant_id AND s2.status = 'completed' AND s2.created_at >= ?
       LEFT JOIN mentoria_student_progression prog
         ON prog.student_profile_id = sp.id AND prog.tenant_id = sp.tenant_id
       WHERE sp.tenant_id = ?`,
    )
    .bind(week7dAgo, week7dAgo, week7dAgo, actor.tenantId)
    .all();

  const agg = (aggResult.results?.[0] ?? {
    total_students: 0,
    total_sessions: 0,
    students_with_streak: 0,
    students_active_week: 0,
    students_inactive_7d: 0,
    streak_none: 0,
    streak_low: 0,
    streak_medium: 0,
    streak_high: 0,
  }) as StudentAggRow;

  // Top subjects
  const subjectResult = await db
    .prepare(
      `SELECT COALESCE(sub.name, s.topic, 'Sin materia') as subject_name, COUNT(*) as session_count
       FROM mentoria_sessions s
       LEFT JOIN mentoria_subjects sub ON sub.id = s.subject_id AND sub.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? AND s.status = 'completed'
       GROUP BY subject_name
       ORDER BY session_count DESC
       LIMIT 8`,
    )
    .bind(actor.tenantId)
    .all();

  const topSubjects: SubjectStat[] = ((subjectResult.results ?? []) as SubjectRow[]).map((r) => ({
    subjectName: r.subject_name,
    sessionCount: r.session_count,
  }));

  const stats: MentorStats = {
    totalStudents: agg.total_students,
    totalSessions: agg.total_sessions,
    avgSessionsPerStudent: agg.total_students > 0
      ? Math.round((agg.total_sessions / agg.total_students) * 10) / 10
      : 0,
    studentsWithStreak: agg.students_with_streak,
    studentsActiveThisWeek: agg.students_active_week,
    studentsInactiveOver7d: agg.students_inactive_7d,
    topSubjects,
    streakDistribution: {
      none: agg.streak_none,
      low: agg.streak_low,
      medium: agg.streak_medium,
      high: agg.streak_high,
    },
  };

  return NextResponse.json({ stats, generatedAt: now });
}
