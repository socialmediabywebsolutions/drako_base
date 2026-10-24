export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMentoriaActor } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// GET /api/mentoria/alerts?studentId=xxx  — alertas de inactividad para el panel padre/alumno

export type AlertLevel = "info" | "warning" | "critical";

export type ParentAlert = {
  id: string;
  type: "inactivity_48h" | "inactivity_7d" | "no_sessions_ever" | "exam_approaching_no_prep";
  level: AlertLevel;
  title: string;
  message: string;
  studentName: string;
  studentId: string;
  createdAt: string;
};

type SessionAgg = {
  last_session: string | null;
  total_sessions: number;
  student_name: string | null;
};

type ExamRow = {
  id: string;
  subject_name: string;
  exam_date: string;
  sessions_done: number;
  sessions_planned: number;
  days_until: number;
};

export async function GET(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const requestedStudentId = searchParams.get("studentId")?.trim() || null;
  const studentId = requestedStudentId ?? actor.studentId;

  const alerts: ParentAlert[] = [];
  const now = new Date();

  // 1. Nombre del alumno + última sesión
  const sessionAgg = await db
    .prepare(
      `SELECT
         MAX(s.created_at) as last_session,
         COUNT(*) as total_sessions,
         sp.full_name as student_name
       FROM mentoria_sessions s
       LEFT JOIN mentoria_student_profiles sp
         ON sp.id = ? AND sp.tenant_id = ?
       WHERE s.tenant_id = ? AND s.student_profile_id = ? AND s.status = 'completed'`,
    )
    .bind(studentId, actor.tenantId, actor.tenantId, studentId)
    .first() as SessionAgg | null;

  const studentName = sessionAgg?.student_name ?? "Tu hijo/a";
  const totalSessions = sessionAgg?.total_sessions ?? 0;
  const lastSession = sessionAgg?.last_session ? new Date(sessionAgg.last_session) : null;
  const hoursSinceLast = lastSession
    ? (now.getTime() - lastSession.getTime()) / (1000 * 60 * 60)
    : Infinity;

  if (totalSessions === 0) {
    alerts.push({
      id: `no_sessions_${studentId}`,
      type: "no_sessions_ever",
      level: "warning",
      title: "Sin sesiones registradas",
      message: `${studentName} aún no ha completado ninguna sesión en Mentoría. Anímale a empezar para establecer un buen hábito de estudio.`,
      studentName,
      studentId,
      createdAt: now.toISOString(),
    });
  } else if (hoursSinceLast >= 168) {
    alerts.push({
      id: `inactivity_7d_${studentId}`,
      type: "inactivity_7d",
      level: "critical",
      title: "Inactivo hace más de 7 días",
      message: `${studentName} lleva más de 7 días sin conectarse a Mentoría. Es importante retomar el ritmo cuanto antes para no perder el progreso.`,
      studentName,
      studentId,
      createdAt: now.toISOString(),
    });
  } else if (hoursSinceLast >= 48) {
    alerts.push({
      id: `inactivity_48h_${studentId}`,
      type: "inactivity_48h",
      level: "warning",
      title: "Sin actividad en 48 horas",
      message: `${studentName} no ha tenido sesiones en las últimas 48 horas. Un pequeño repaso hoy puede marcar la diferencia.`,
      studentName,
      studentId,
      createdAt: now.toISOString(),
    });
  }

  // 2. Exámenes próximos (≤7d) con preparación insuficiente
  const examRows = await db
    .prepare(
      `SELECT id, subject_name, exam_date, sessions_done, sessions_planned,
              CAST((julianday(exam_date) - julianday('now')) AS INTEGER) as days_until
       FROM mentoria_declared_exams
       WHERE tenant_id = ? AND student_id = ? AND status = 'active'
         AND exam_date >= date('now')
         AND CAST((julianday(exam_date) - julianday('now')) AS INTEGER) <= 7
       ORDER BY exam_date ASC
       LIMIT 5`,
    )
    .bind(actor.tenantId, studentId)
    .all();

  for (const exam of ((examRows.results ?? []) as ExamRow[])) {
    const sessionsBehind =
      exam.sessions_planned > 0 &&
      exam.sessions_done < Math.ceil(exam.sessions_planned * 0.5);

    if (sessionsBehind) {
      const daysText = exam.days_until === 0 ? "hoy" : `en ${exam.days_until} ${exam.days_until === 1 ? "día" : "días"}`;
      alerts.push({
        id: `exam_prep_${exam.id}`,
        type: "exam_approaching_no_prep",
        level: exam.days_until <= 3 ? "critical" : "warning",
        title: `Examen próximo: ${exam.subject_name}`,
        message: `${studentName} tiene examen de ${exam.subject_name} ${daysText} y solo ha completado ${exam.sessions_done} de ${exam.sessions_planned} sesiones previstas.`,
        studentName,
        studentId,
        createdAt: now.toISOString(),
      });
    }
  }

  // Ordenar: critical primero
  const levelOrder: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  return NextResponse.json({ alerts });
}
