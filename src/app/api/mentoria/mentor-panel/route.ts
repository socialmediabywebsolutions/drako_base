export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// GET /api/mentoria/mentor-panel — panel del mentor: alumnos + estado reciente
// Requiere role=owner|admin

export type MentorStudentRow = {
  studentId: string;
  fullName: string;
  guardianEmail: string | null;
  totalSessions: number;
  lastSessionAt: string | null;
  lastSubjectName: string | null;
  lastEmotionalState: string | null;
  streakDays: number;
  activeExams: number;
};

export type MentorPanelResponse = {
  students: MentorStudentRow[];
  totalStudents: number;
};

type StudentRow = {
  student_id: string;
  full_name: string;
  guardian_email: string | null;
  total_sessions: number;
  last_session_at: string | null;
  last_subject_name: string | null;
  last_emotional_state: string | null;
  streak_days: number;
};

type ExamCountRow = {
  student_id: string;
  active_exams: number;
};

export async function GET(req: NextRequest) {
  let actor;
  try {
    actor = await requireCurrentMentoriaSession(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Solo owner o admin pueden ver el panel de mentor
  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Alumnos con datos de sesión
  const studentsRows = await db
    .prepare(
      `SELECT
         sp.id as student_id,
         sp.full_name,
         (SELECT email FROM mentoria_guardian_student_access gsa
          INNER JOIN mentoria_guardians g ON g.id = gsa.guardian_id AND g.tenant_id = sp.tenant_id
          WHERE gsa.student_profile_id = sp.id AND gsa.tenant_id = sp.tenant_id
          LIMIT 1) as guardian_email,
         COUNT(s.id) as total_sessions,
         MAX(s.created_at) as last_session_at,
         (SELECT sub2.name FROM mentoria_sessions s2
          LEFT JOIN mentoria_subjects sub2 ON sub2.id = s2.subject_id AND sub2.tenant_id = s2.tenant_id
          WHERE s2.student_profile_id = sp.id AND s2.tenant_id = sp.tenant_id AND s2.status = 'completed'
          ORDER BY s2.created_at DESC LIMIT 1) as last_subject_name,
         (SELECT s3.emotional_state FROM mentoria_sessions s3
          WHERE s3.student_profile_id = sp.id AND s3.tenant_id = sp.tenant_id AND s3.status = 'completed'
          ORDER BY s3.created_at DESC LIMIT 1) as last_emotional_state,
         COALESCE((SELECT session_streak FROM mentoria_student_progression
                   WHERE student_profile_id = sp.id AND tenant_id = sp.tenant_id LIMIT 1), 0) as streak_days
       FROM mentoria_student_profiles sp
       LEFT JOIN mentoria_sessions s
         ON s.student_profile_id = sp.id AND s.tenant_id = sp.tenant_id AND s.status = 'completed'
       WHERE sp.tenant_id = ?
       GROUP BY sp.id
       ORDER BY last_session_at DESC NULLS LAST
       LIMIT 100`,
    )
    .bind(actor.tenantId)
    .all();

  const studentIds = ((studentsRows.results ?? []) as StudentRow[]).map((r) => r.student_id);

  // Active exams per student
  const examMap: Record<string, number> = {};
  if (studentIds.length > 0) {
    const placeholders = studentIds.map(() => "?").join(",");
    const examRows = await db
      .prepare(
        `SELECT student_id, COUNT(*) as active_exams
         FROM mentoria_declared_exams
         WHERE tenant_id = ? AND student_id IN (${placeholders}) AND status = 'active'
         GROUP BY student_id`,
      )
      .bind(actor.tenantId, ...studentIds)
      .all();
    for (const row of ((examRows.results ?? []) as ExamCountRow[])) {
      examMap[row.student_id] = row.active_exams;
    }
  }

  const students: MentorStudentRow[] = ((studentsRows.results ?? []) as StudentRow[]).map((r) => ({
    studentId: r.student_id,
    fullName: r.full_name,
    guardianEmail: r.guardian_email,
    totalSessions: r.total_sessions,
    lastSessionAt: r.last_session_at,
    lastSubjectName: r.last_subject_name,
    lastEmotionalState: r.last_emotional_state,
    streakDays: r.streak_days,
    activeExams: examMap[r.student_id] ?? 0,
  }));

  return NextResponse.json({ students, totalStudents: students.length } satisfies MentorPanelResponse);
}
