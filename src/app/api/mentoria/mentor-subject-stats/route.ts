export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export interface MentorSubjectStat {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  sessionCount: number;
  totalMinutes: number;
  lastSessionAt: string | null;
  avgDurationMinutes: number;
}

export interface MentorSubjectStatsResponse {
  subjects: MentorSubjectStat[];
  totalSessions: number;
  totalMinutes: number;
}

// GET /api/mentoria/mentor-subject-stats?studentId=xxx
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

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId")?.trim();
  if (!studentId) {
    return NextResponse.json({ error: "student_id_required" }, { status: 400 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Verify student belongs to this tenant
  const student = await db
    .prepare(`SELECT id FROM student_profiles WHERE id = ? AND tenant_id = ? LIMIT 1`)
    .bind(studentId, actor.tenantId)
    .first() as { id: string } | null;

  if (!student) {
    return NextResponse.json({ error: "student_not_found" }, { status: 404 });
  }

  type SubjectStatsRow = {
    subject_id: string;
    subject_name: string;
    subject_slug: string;
    session_count: number;
    total_minutes: number;
    last_session_at: string | null;
    avg_duration: number;
  };

  const rows = await db
    .prepare(
      `SELECT
         sub.id as subject_id,
         sub.name as subject_name,
         sub.slug as subject_slug,
         COUNT(s.id) as session_count,
         COALESCE(SUM(s.duration_minutes), 0) as total_minutes,
         MAX(s.created_at) as last_session_at,
         COALESCE(AVG(s.duration_minutes), 0) as avg_duration
       FROM mentoria_sessions s
       JOIN mentoria_subjects sub ON sub.id = s.subject_id AND sub.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? AND s.student_profile_id = ? AND s.status = 'completed'
       GROUP BY sub.id, sub.name, sub.slug
       ORDER BY session_count DESC`,
    )
    .bind(actor.tenantId, studentId)
    .all();

  const subjects: MentorSubjectStat[] = ((rows.results ?? []) as SubjectStatsRow[]).map((r) => ({
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    subjectSlug: r.subject_slug,
    sessionCount: r.session_count,
    totalMinutes: r.total_minutes,
    lastSessionAt: r.last_session_at,
    avgDurationMinutes: Math.round(r.avg_duration),
  }));

  const totalSessions = subjects.reduce((a, s) => a + s.sessionCount, 0);
  const totalMinutes = subjects.reduce((a, s) => a + s.totalMinutes, 0);

  return NextResponse.json({ subjects, totalSessions, totalMinutes } satisfies MentorSubjectStatsResponse);
}
