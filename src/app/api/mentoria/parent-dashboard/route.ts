export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";

export type SubjectPerformanceSummary = {
  subjectSlug: string;
  subjectName: string;
  schoolAverageScore: number | null;
  mentoriaMasteryScore: number | null;
  mentoriaConfidenceScore: number | null;
  trendDirection: "up" | "down" | "steady" | "unknown";
  weakPoints: string[];
  strongPoints: string[];
  preferenceScore: number | null;      // 0=odia 1=le encanta
  lastMood: string | null;             // animado|neutro|desanimado|bloqueado
  lastActivityDate: string | null;
};

export type AttendanceSummary = {
  totalDays: number;
  presentDays: number;
  absentDays: number;          // justified + unjustified
  absentJustifiedDays: number;
  lateDays: number;
  attendanceRate: number;      // 0-100
  recentAbsences: Array<{
    date: string;
    status: string;
    notes: string | null;
  }>;
};

export type BehaviorSummary = {
  recentRecords: Array<{
    date: string;
    subjectName: string | null;
    behaviorType: string;
    intensity: number;
    note: string | null;
    source: string;
  }>;
  positiveCount: number;
  attentionCount: number;
  disruptiveCount: number;
};

export type RecentGrade = {
  id: string;
  title: string;
  subjectSlug: string | null;
  subjectName: string | null;
  recordType: string;
  scoreValue: number | null;
  scoreScale: number | null;
  scoreLabel: string | null;
  recordedAt: string;
  status: string;
  teacherComment: string | null;
};

export type ParentDashboardData = {
  studentId: string;
  studentName: string;
  schoolYear: string | null;
  subjectPerformance: SubjectPerformanceSummary[];
  attendance: AttendanceSummary;
  behavior: BehaviorSummary;
  recentGrades: RecentGrade[];
  studentMood: {
    overallMood: string;              // animado|neutro|desanimado|bloqueado
    confidenceScore: number;
    emotionalBaseline: string;
    mostLikedSubject: string | null;
    leastLikedSubject: string | null;
    sessionStreak: number;
  };
};

type StudentRow = { id: string; display_name: string; grade_level: string | null; confidence_score: number; emotional_baseline: string; streak_days: number };
type SnapshotRow = { subject_slug: string; school_average_score: number | null; mentoria_mastery_score: number | null; mentoria_confidence_score: number | null; trend_direction: string; weak_points_json: string; strong_points_json: string; created_at: string };
type PreferenceRow = { subject_slug: string; preference_score: number; engagement_score: number; frustration_score: number; last_detected_mood: string | null };
type ProgressRow = { subject_id: string; subject_slug: string | null; subject_name: string | null; mastery_score: number; effort_score: number; last_activity_at: string | null };
type AttendanceRow = { record_date: string; status: string; notes: string | null };
type BehaviorRow = { record_date: string; subject_slug: string | null; behavior_type: string; intensity: number; note: string | null; source: string };
type GradeRow = { id: string; title: string; subject_slug: string | null; record_type: string; score_value: number | null; score_scale: number | null; score_label: string | null; recorded_at: string; status: string; teacher_comment: string | null };

const SUBJECT_NAMES: Record<string, string> = {
  matematicas: "Matemáticas",
  lengua: "Lengua",
  ingles: "Inglés",
  ciencias: "Ciencias",
  historia: "Historia",
  geografia: "Geografía",
  arte: "Arte",
  educacion_fisica: "Educación Física",
  musica: "Música",
  tecnologia: "Tecnología",
  filosofia: "Filosofía",
  biologia: "Biología",
  fisica: "Física",
  quimica: "Química",
  frances: "Francés",
  aleman: "Alemán",
};

function resolveSubjectName(slug: string | null): string | null {
  if (!slug) return null;
  return SUBJECT_NAMES[slug] ?? slug;
}

function resolveStatus(message: string): number {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
  if (message === "STUDENT_ACCESS_DENIED") return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId")?.trim() || undefined;

    const bindings = env?.();
    if (!bindings?.MENTORIA_DB) {
      return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 });
    }

    const db = getMentoriaDb(bindings);

    // Resolver el studentId según el rol
    const resolvedStudentId = studentId ?? actor.studentProfileId ?? null;
    if (!resolvedStudentId) {
      return NextResponse.json({ ok: false, error: "STUDENT_REQUIRED" }, { status: 400 });
    }

    const tenantId = actor.tenantId;

    // Perfil del alumno
    const studentRow = (await db
      .prepare("SELECT id, display_name, grade_level, confidence_score, emotional_baseline, streak_days FROM student_profiles WHERE id = ? AND tenant_id = ?")
      .bind(resolvedStudentId, tenantId)
      .first()) as StudentRow | null;

    if (!studentRow) {
      return NextResponse.json({ ok: false, error: "STUDENT_NOT_FOUND" }, { status: 404 });
    }

    // Rendimiento por materia (snapshots)
    const snapshotsResult = await db
      .prepare(`
        SELECT subject_slug, school_average_score, mentoria_mastery_score, mentoria_confidence_score,
               trend_direction, weak_points_json, strong_points_json, created_at
        FROM mentoria_subject_performance_snapshots
        WHERE tenant_id = ? AND student_profile_id = ?
        ORDER BY created_at DESC
      `)
      .bind(tenantId, resolvedStudentId)
      .all();

    const snapshotRows = (snapshotsResult.results ?? []) as SnapshotRow[];

    // Preferencias de materias (detectadas por IA)
    const preferencesResult = await db
      .prepare(`
        SELECT subject_slug, preference_score, engagement_score, frustration_score, last_detected_mood
        FROM mentoria_subject_preferences
        WHERE tenant_id = ? AND student_profile_id = ?
      `)
      .bind(tenantId, resolvedStudentId)
      .all();

    const preferenceRows = (preferencesResult.results ?? []) as PreferenceRow[];
    const prefsMap = new Map(preferenceRows.map((row) => [row.subject_slug, row]));

    // Progreso de materias (mastery desde sesiones IA)
    const progressResult = await db
      .prepare(`
        SELECT mp.subject_id, ms.slug as subject_slug, ms.name as subject_name,
               mp.mastery_score, mp.effort_score, mp.last_activity_at
        FROM mentoria_progress mp
        LEFT JOIN mentoria_subjects ms ON ms.id = mp.subject_id
        WHERE mp.tenant_id = ? AND mp.student_profile_id = ?
        ORDER BY mp.mastery_score ASC
      `)
      .bind(tenantId, resolvedStudentId)
      .all();

    const progressRows = (progressResult.results ?? []) as ProgressRow[];

    // Combinar datos de rendimiento
    const subjectSlugsInSnapshots = new Set(snapshotRows.map((row) => row.subject_slug));
    const subjectSlugsInProgress = new Set(progressRows.map((row) => row.subject_slug).filter((s): s is string => Boolean(s)));
    const allSlugs = new Set([...subjectSlugsInSnapshots, ...subjectSlugsInProgress]);

    const subjectPerformance: SubjectPerformanceSummary[] = Array.from(allSlugs).map((slug) => {
      const snapshot = snapshotRows.find((row) => row.subject_slug === slug);
      const progress = progressRows.find((row) => row.subject_slug === slug);
      const prefs = prefsMap.get(slug);
      return {
        subjectSlug: slug,
        subjectName: resolveSubjectName(slug) ?? progress?.subject_name ?? slug,
        schoolAverageScore: snapshot?.school_average_score ?? null,
        mentoriaMasteryScore: snapshot?.mentoria_mastery_score ?? (progress ? Math.round(progress.mastery_score * 100) : null),
        mentoriaConfidenceScore: snapshot?.mentoria_confidence_score ?? null,
        trendDirection: (snapshot?.trend_direction ?? "unknown") as SubjectPerformanceSummary["trendDirection"],
        weakPoints: snapshot ? (JSON.parse(snapshot.weak_points_json) as string[]) : [],
        strongPoints: snapshot ? (JSON.parse(snapshot.strong_points_json) as string[]) : [],
        preferenceScore: prefs?.preference_score ?? null,
        lastMood: prefs?.last_detected_mood ?? null,
        lastActivityDate: progress?.last_activity_at ?? null,
      };
    });

    // Asistencia — últimos 30 días
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const attendanceResult = await db
      .prepare(`
        SELECT record_date, status, notes
        FROM mentoria_attendance_records
        WHERE tenant_id = ? AND student_profile_id = ? AND record_date >= ?
        ORDER BY record_date DESC
      `)
      .bind(tenantId, resolvedStudentId, thirtyDaysAgo)
      .all();

    const attendanceList = (attendanceResult.results ?? []) as AttendanceRow[];
    const presentDays = attendanceList.filter((row) => row.status === "present").length;
    const absentJustified = attendanceList.filter((row) => row.status === "absent_justified").length;
    const absentTotal = attendanceList.filter((row) => row.status === "absent" || row.status === "absent_justified").length;
    const lateDays = attendanceList.filter((row) => row.status === "late").length;
    const totalTrackedDays = attendanceList.length;

    const attendance: AttendanceSummary = {
      totalDays: totalTrackedDays,
      presentDays,
      absentDays: absentTotal,
      absentJustifiedDays: absentJustified,
      lateDays,
      attendanceRate: totalTrackedDays > 0 ? Math.round((presentDays / totalTrackedDays) * 100) : 100,
      recentAbsences: attendanceList
        .filter((row) => row.status !== "present")
        .slice(0, 10)
        .map((row) => ({ date: row.record_date, status: row.status, notes: row.notes })),
    };

    // Comportamiento — últimas 20 entradas
    const behaviorResult = await db
      .prepare(`
        SELECT br.record_date, br.subject_slug, br.behavior_type, br.intensity, br.note, br.source
        FROM mentoria_behavior_records br
        WHERE br.tenant_id = ? AND br.student_profile_id = ?
        ORDER BY br.record_date DESC
        LIMIT 20
      `)
      .bind(tenantId, resolvedStudentId)
      .all();

    const behaviorList = (behaviorResult.results ?? []) as BehaviorRow[];
    const behavior: BehaviorSummary = {
      recentRecords: behaviorList.map((row) => ({
        date: row.record_date,
        subjectName: resolveSubjectName(row.subject_slug),
        behaviorType: row.behavior_type,
        intensity: row.intensity,
        note: row.note,
        source: row.source,
      })),
      positiveCount: behaviorList.filter((row) => row.behavior_type === "positive").length,
      attentionCount: behaviorList.filter((row) => row.behavior_type === "attention").length,
      disruptiveCount: behaviorList.filter((row) => row.behavior_type === "disruptive").length,
    };

    // Notas recientes del cole
    const gradesResult = await db
      .prepare(`
        SELECT id, title, subject_slug, record_type, score_value, score_scale, score_label,
               recorded_at, status, teacher_comment
        FROM mentoria_academic_records
        WHERE tenant_id = ? AND student_profile_id = ?
        ORDER BY recorded_at DESC
        LIMIT 30
      `)
      .bind(tenantId, resolvedStudentId)
      .all();

    const gradeRows = (gradesResult.results ?? []) as GradeRow[];
    const recentGrades: RecentGrade[] = gradeRows.map((row) => ({
      id: row.id,
      title: row.title,
      subjectSlug: row.subject_slug,
      subjectName: resolveSubjectName(row.subject_slug),
      recordType: row.record_type,
      scoreValue: row.score_value,
      scoreScale: row.score_scale,
      scoreLabel: row.score_label,
      recordedAt: row.recorded_at,
      status: row.status,
      teacherComment: row.teacher_comment,
    }));

    // Estado emocional del alumno — cruzado con preferencias de IA
    const sortedByPreference = [...preferenceRows].sort((a, b) => b.preference_score - a.preference_score);
    const mostLiked = sortedByPreference[0]?.subject_slug ?? null;
    const leastLiked = sortedByPreference[sortedByPreference.length - 1]?.subject_slug ?? null;

    const studentMood = {
      overallMood: studentRow.emotional_baseline ?? "neutro",
      confidenceScore: Math.round((studentRow.confidence_score ?? 0.5) * 100),
      emotionalBaseline: studentRow.emotional_baseline ?? "steady",
      mostLikedSubject: resolveSubjectName(mostLiked),
      leastLikedSubject: mostLiked !== leastLiked ? resolveSubjectName(leastLiked) : null,
      sessionStreak: studentRow.streak_days ?? 0,
    };

    const data: ParentDashboardData = {
      studentId: studentRow.id,
      studentName: studentRow.display_name,
      schoolYear: studentRow.grade_level,
      subjectPerformance,
      attendance,
      behavior,
      recentGrades,
      studentMood,
    };

    return NextResponse.json({ ok: true, dashboard: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PARENT_DASHBOARD_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: resolveStatus(message) });
  }
}
