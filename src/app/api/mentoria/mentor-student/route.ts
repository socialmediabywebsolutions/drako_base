export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// GET /api/mentoria/mentor-student?studentId=xxx
// Vista detallada de un alumno para el mentor (owner|admin)

export type MentorStudentDetail = {
  studentId: string;
  fullName: string;
  schoolYear: string;
  guardianEmail: string | null;
  guardianPhone: string | null;
  learningPreference: string | null;
  supportNotes: string | null;
  preferredStudyMinutes: number;
  createdAt: string;

  // Actividad
  totalSessions: number;
  totalMinutes: number;
  streakDays: number;
  lastSessionAt: string | null;
  lastEmotionalState: string | null;
  lastSubjectName: string | null;

  // Historial reciente (últimas 5 sesiones)
  recentSessions: RecentSession[];

  // Próximos exámenes
  upcomingExams: UpcomingExam[];

  // Materias con sesiones
  subjectBreakdown: SubjectEntry[];

  // Distribución del estado emocional
  moodBreakdown: MoodEntry[];
};

export type RecentSession = {
  id: string;
  subjectName: string | null;
  topic: string | null;
  durationMinutes: number;
  emotionalState: string | null;
  tutorSummary: string | null;
  createdAt: string;
};

export type UpcomingExam = {
  id: string;
  subjectName: string | null;
  examDate: string;
  sessionsPlanned: number;
  sessionsDone: number;
};

export type SubjectEntry = {
  subjectName: string;
  sessionCount: number;
  totalMinutes: number;
};

export type MoodEntry = {
  mood: string;
  count: number;
};

type ProfileRow = {
  id: string;
  full_name: string;
  school_year: string;
  preferred_study_minutes: number;
  learning_preference: string | null;
  support_notes: string | null;
  created_at: string;
  guardian_email: string | null;
  guardian_phone: string | null;
};

type AggRow = {
  total_sessions: number;
  total_minutes: number;
  last_session_at: string | null;
  last_emotional_state: string | null;
};

type StreakRow = {
  session_streak: number;
};

type LastSubjectRow = {
  subject_name: string | null;
};

type SessionRow = {
  id: string;
  subject_name: string | null;
  topic: string | null;
  duration_minutes: number;
  emotional_state: string | null;
  tutor_summary: string | null;
  created_at: string;
};

type ExamRow = {
  id: string;
  subject_name: string | null;
  exam_date: string;
  sessions_planned: number;
  sessions_done: number;
};

type SubjectRow = {
  subject_name: string;
  session_count: number;
  total_minutes: number;
};

type MoodRow = {
  mood: string;
  cnt: number;
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

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId")?.trim();
  if (!studentId) return NextResponse.json({ error: "studentId_required" }, { status: 400 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Profile + guardian info
  const profileResult = await db
    .prepare(
      `SELECT sp.id, sp.full_name, sp.school_year, sp.preferred_study_minutes, sp.learning_preference, sp.support_notes, sp.created_at,
              gu.email as guardian_email, gu.phone as guardian_phone
       FROM mentoria_student_profiles sp
       LEFT JOIN mentoria_guardian_student_links gsl ON gsl.student_profile_id = sp.id AND gsl.tenant_id = sp.tenant_id
       LEFT JOIN mentoria_users gu ON gu.id = gsl.guardian_user_id AND gu.tenant_id = sp.tenant_id
       WHERE sp.id = ? AND sp.tenant_id = ?
       LIMIT 1`,
    )
    .bind(studentId, actor.tenantId)
    .all();

  const profile = (profileResult.results?.[0] ?? null) as ProfileRow | null;
  if (!profile) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  // Session aggregate
  const aggResult = await db
    .prepare(
      `SELECT COUNT(*) as total_sessions,
              COALESCE(SUM(duration_minutes), 0) as total_minutes,
              MAX(created_at) as last_session_at,
              (SELECT emotional_state FROM mentoria_sessions WHERE student_profile_id = ? AND tenant_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1) as last_emotional_state
       FROM mentoria_sessions
       WHERE student_profile_id = ? AND tenant_id = ? AND status = 'completed'`,
    )
    .bind(studentId, actor.tenantId, studentId, actor.tenantId)
    .all();

  const agg = (aggResult.results?.[0] ?? { total_sessions: 0, total_minutes: 0, last_session_at: null, last_emotional_state: null }) as AggRow;

  // Streak
  const streakResult = await db
    .prepare(`SELECT session_streak FROM mentoria_student_progression WHERE student_profile_id = ? AND tenant_id = ? LIMIT 1`)
    .bind(studentId, actor.tenantId)
    .all();

  const streakRow = (streakResult.results?.[0] ?? null) as StreakRow | null;

  // Last subject
  const lastSubjectResult = await db
    .prepare(
      `SELECT COALESCE(sub.name, s.topic, 'Sin materia') as subject_name
       FROM mentoria_sessions s
       LEFT JOIN mentoria_subjects sub ON sub.id = s.subject_id AND sub.tenant_id = s.tenant_id
       WHERE s.student_profile_id = ? AND s.tenant_id = ? AND s.status = 'completed'
       ORDER BY s.created_at DESC LIMIT 1`,
    )
    .bind(studentId, actor.tenantId)
    .all();

  const lastSubject = (lastSubjectResult.results?.[0] ?? null) as LastSubjectRow | null;

  // Recent sessions (5)
  const recentResult = await db
    .prepare(
      `SELECT s.id, COALESCE(sub.name, s.topic, 'Sin materia') as subject_name, s.topic, s.duration_minutes, s.emotional_state, s.tutor_summary, s.created_at
       FROM mentoria_sessions s
       LEFT JOIN mentoria_subjects sub ON sub.id = s.subject_id AND sub.tenant_id = s.tenant_id
       WHERE s.student_profile_id = ? AND s.tenant_id = ? AND s.status = 'completed'
       ORDER BY s.created_at DESC LIMIT 5`,
    )
    .bind(studentId, actor.tenantId)
    .all();

  const recentSessions: RecentSession[] = ((recentResult.results ?? []) as SessionRow[]).map((r) => ({
    id: r.id,
    subjectName: r.subject_name,
    topic: r.topic,
    durationMinutes: r.duration_minutes,
    emotionalState: r.emotional_state,
    tutorSummary: r.tutor_summary,
    createdAt: r.created_at,
  }));

  // Upcoming exams
  const examResult = await db
    .prepare(
      `SELECT me.id, COALESCE(sub.name, me.subject_name, 'Sin materia') as subject_name,
              me.exam_date,
              COALESCE(me.sessions_planned, 0) as sessions_planned,
              COALESCE(me.sessions_done, 0) as sessions_done
       FROM mentoria_exams me
       LEFT JOIN mentoria_subjects sub ON sub.id = me.subject_id AND sub.tenant_id = me.tenant_id
       WHERE me.student_profile_id = ? AND me.tenant_id = ? AND me.exam_date >= date('now')
       ORDER BY me.exam_date ASC LIMIT 5`,
    )
    .bind(studentId, actor.tenantId)
    .all();

  const upcomingExams: UpcomingExam[] = ((examResult.results ?? []) as ExamRow[]).map((r) => ({
    id: r.id,
    subjectName: r.subject_name,
    examDate: r.exam_date,
    sessionsPlanned: r.sessions_planned,
    sessionsDone: r.sessions_done,
  }));

  // Subject breakdown
  const subjectResult = await db
    .prepare(
      `SELECT COALESCE(sub.name, s.topic, 'Sin materia') as subject_name,
              COUNT(*) as session_count,
              COALESCE(SUM(s.duration_minutes), 0) as total_minutes
       FROM mentoria_sessions s
       LEFT JOIN mentoria_subjects sub ON sub.id = s.subject_id AND sub.tenant_id = s.tenant_id
       WHERE s.student_profile_id = ? AND s.tenant_id = ? AND s.status = 'completed'
       GROUP BY subject_name ORDER BY session_count DESC LIMIT 6`,
    )
    .bind(studentId, actor.tenantId)
    .all();

  const subjectBreakdown: SubjectEntry[] = ((subjectResult.results ?? []) as SubjectRow[]).map((r) => ({
    subjectName: r.subject_name,
    sessionCount: r.session_count,
    totalMinutes: r.total_minutes,
  }));

  // Mood breakdown
  const moodResult = await db
    .prepare(
      `SELECT emotional_state as mood, COUNT(*) as cnt
       FROM mentoria_sessions
       WHERE student_profile_id = ? AND tenant_id = ? AND status = 'completed' AND emotional_state IS NOT NULL
       GROUP BY emotional_state ORDER BY cnt DESC`,
    )
    .bind(studentId, actor.tenantId)
    .all();

  const moodBreakdown: MoodEntry[] = ((moodResult.results ?? []) as MoodRow[]).map((r) => ({
    mood: r.mood,
    count: r.cnt,
  }));

  const detail: MentorStudentDetail = {
    studentId: profile.id,
    fullName: profile.full_name,
    schoolYear: profile.school_year,
    guardianEmail: profile.guardian_email,
    guardianPhone: profile.guardian_phone,
    learningPreference: profile.learning_preference,
    supportNotes: profile.support_notes,
    preferredStudyMinutes: profile.preferred_study_minutes,
    createdAt: profile.created_at,
    totalSessions: agg.total_sessions,
    totalMinutes: agg.total_minutes,
    streakDays: streakRow?.session_streak ?? 0,
    lastSessionAt: agg.last_session_at,
    lastEmotionalState: agg.last_emotional_state,
    lastSubjectName: lastSubject?.subject_name ?? null,
    recentSessions,
    upcomingExams,
    subjectBreakdown,
    moodBreakdown,
  };

  return NextResponse.json({ detail });
}
