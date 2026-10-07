export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export type MentorAlertLevel = "info" | "warning" | "critical";

export type MentorAlert = {
  id: string;
  type:
    | "inactivity_48h"
    | "inactivity_7d"
    | "no_sessions_ever"
    | "exam_approaching_no_prep"
    | "exam_today";
  level: MentorAlertLevel;
  title: string;
  message: string;
  studentName: string;
  studentId: string;
};

// GET /api/mentoria/mentor-alerts — alertas globales de todos los alumnos del tenant
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

  const alerts: MentorAlert[] = [];
  const now = new Date();

  // 1. Get all students with their last session date
  type StudentRow = {
    id: string;
    full_name: string;
    last_session: string | null;
    total_sessions: number;
  };

  const students = await db
    .prepare(
      `SELECT
         sp.id,
         sp.full_name,
         MAX(s.created_at) as last_session,
         COUNT(s.id) as total_sessions
       FROM student_profiles sp
       LEFT JOIN mentoria_sessions s
         ON s.student_profile_id = sp.id AND s.tenant_id = sp.tenant_id AND s.status = 'completed'
       WHERE sp.tenant_id = ?
       GROUP BY sp.id, sp.full_name
       ORDER BY sp.full_name ASC`,
    )
    .bind(actor.tenantId)
    .all();

  for (const row of ((students.results ?? []) as StudentRow[])) {
    const studentId = row.id;
    const studentName = row.full_name;
    const totalSessions = row.total_sessions ?? 0;
    const lastSession = row.last_session ? new Date(row.last_session) : null;
    const hoursSinceLast = lastSession
      ? (now.getTime() - lastSession.getTime()) / (1000 * 60 * 60)
      : Infinity;

    // Never had a session
    if (totalSessions === 0) {
      alerts.push({
        id: `no-sessions-${studentId}`,
        type: "no_sessions_ever",
        level: "info",
        title: "Sin sesiones",
        message: `${studentName} todavía no ha completado ninguna sesión de estudio.`,
        studentName,
        studentId,
      });
      continue;
    }

    // Inactive >7d
    if (hoursSinceLast > 168) {
      const days = Math.floor(hoursSinceLast / 24);
      alerts.push({
        id: `inactive-7d-${studentId}`,
        type: "inactivity_7d",
        level: "critical",
        title: "Inactivo más de 7 días",
        message: `${studentName} lleva ${days} días sin estudiar.`,
        studentName,
        studentId,
      });
    } else if (hoursSinceLast > 48) {
      const hours = Math.floor(hoursSinceLast);
      alerts.push({
        id: `inactive-48h-${studentId}`,
        type: "inactivity_48h",
        level: "warning",
        title: "Inactivo +48h",
        message: `${studentName} no estudia desde hace ${hours} horas.`,
        studentName,
        studentId,
      });
    }
  }

  // 2. Upcoming exams with insufficient prep (≤5 days, sessionsDone < sessionsPlanned)
  type ExamRow = {
    id: string;
    student_id: string;
    full_name: string;
    subject_name: string;
    exam_date: string;
    sessions_done: number;
    sessions_planned: number;
  };

  const exams = await db
    .prepare(
      `SELECT
         e.id,
         e.student_id,
         sp.full_name,
         e.subject_name,
         e.exam_date,
         e.sessions_done,
         e.sessions_planned
       FROM mentoria_declared_exams e
       JOIN student_profiles sp ON sp.id = e.student_id AND sp.tenant_id = e.tenant_id
       WHERE e.tenant_id = ? AND e.status = 'active'
         AND e.exam_date >= date('now')
         AND e.exam_date <= date('now', '+7 days')
       ORDER BY e.exam_date ASC`,
    )
    .bind(actor.tenantId)
    .all();

  for (const row of ((exams.results ?? []) as ExamRow[])) {
    const examDate = new Date(row.exam_date + "T00:00:00");
    const daysDiff = Math.round((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const notPrepared = row.sessions_planned > 0 && row.sessions_done < row.sessions_planned;

    if (daysDiff === 0) {
      alerts.push({
        id: `exam-today-${row.id}`,
        type: "exam_today",
        level: "critical",
        title: "Examen hoy",
        message: `${row.full_name} tiene examen de ${row.subject_name} hoy.`,
        studentName: row.full_name,
        studentId: row.student_id,
      });
    } else if (daysDiff <= 3 && notPrepared) {
      const pending = row.sessions_planned - row.sessions_done;
      alerts.push({
        id: `exam-no-prep-${row.id}`,
        type: "exam_approaching_no_prep",
        level: "warning",
        title: "Examen próximo sin preparar",
        message: `${row.full_name}: examen de ${row.subject_name} en ${daysDiff} día${daysDiff !== 1 ? "s" : ""}, ${pending} sesiones pendientes.`,
        studentName: row.full_name,
        studentId: row.student_id,
      });
    }
  }

  // Sort: critical first, then warning, then info
  const order: Record<MentorAlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (order[a.level] ?? 2) - (order[b.level] ?? 2));

  return NextResponse.json({ alerts, total: alerts.length });
}
