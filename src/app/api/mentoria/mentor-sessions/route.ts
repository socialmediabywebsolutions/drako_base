export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export interface MentorSessionItem {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  topic: string | null;
  durationMinutes: number;
  emotionalState: string | null;
  tutorSummary: string | null;
  recommendedNextStep: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface MentorSessionsResponse {
  sessions: MentorSessionItem[];
  total: number;
  page: number;
  limit: number;
}

// GET /api/mentoria/mentor-sessions?studentId=xxx&page=0&limit=20
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

  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = page * limit;

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

  // Total count
  const countRow = await db
    .prepare(
      `SELECT COUNT(*) as total
       FROM mentoria_sessions
       WHERE tenant_id = ? AND student_profile_id = ? AND status = 'completed'`,
    )
    .bind(actor.tenantId, studentId)
    .first() as { total: number } | null;

  const total = countRow?.total ?? 0;

  const rows = await db
    .prepare(
      `SELECT
         s.id, s.subject_id, sub.name as subject_name, s.topic,
         s.duration_minutes, s.emotional_state, s.tutor_summary,
         s.recommended_next_step, s.status, s.created_at, s.completed_at
       FROM mentoria_sessions s
       LEFT JOIN mentoria_subjects sub ON sub.id = s.subject_id AND sub.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? AND s.student_profile_id = ? AND s.status = 'completed'
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(actor.tenantId, studentId, limit, offset)
    .all();

  type SessionRow = {
    id: string;
    subject_id: string | null;
    subject_name: string | null;
    topic: string | null;
    duration_minutes: number;
    emotional_state: string | null;
    tutor_summary: string | null;
    recommended_next_step: string | null;
    status: string;
    created_at: string;
    completed_at: string | null;
  };

  const sessions: MentorSessionItem[] = ((rows.results ?? []) as SessionRow[]).map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    topic: r.topic,
    durationMinutes: r.duration_minutes,
    emotionalState: r.emotional_state,
    tutorSummary: r.tutor_summary,
    recommendedNextStep: r.recommended_next_step,
    status: r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }));

  return NextResponse.json({ sessions, total, page, limit } satisfies MentorSessionsResponse);
}
