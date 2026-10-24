export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export interface MentorSessionAllRow {
  id: string;
  studentId: string;
  studentName: string;
  subjectName: string | null;
  topic: string | null;
  durationMinutes: number;
  emotionalState: string | null;
  tutorSummary: string | null;
  createdAt: string;
}

export interface MentorSessionsAllResponse {
  sessions: MentorSessionAllRow[];
  total: number;
  page: number;
  limit: number;
}

type SessionRow = {
  id: string;
  student_id: string;
  student_name: string;
  subject_name: string | null;
  topic: string | null;
  duration_minutes: number;
  emotional_state: string | null;
  tutor_summary: string | null;
  created_at: string;
};

// GET /api/mentoria/mentor-sessions-all?page=0&limit=30&studentId=optional
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

  const { searchParams } = new URL(req.url);
  const studentIdFilter = searchParams.get("studentId")?.trim() || null;
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10)));
  const offset = page * limit;

  const studentFilter = studentIdFilter ? "AND ms.student_profile_id = ?" : "";

  const countBindings: (string | number)[] = [actor.tenantId];
  if (studentIdFilter) countBindings.push(studentIdFilter);

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) as total
       FROM mentoria_sessions ms
       WHERE ms.tenant_id = ? AND ms.status = 'completed' ${studentFilter}`,
    )
    .bind(...countBindings)
    .first() as { total: number } | null;

  const total = countRow?.total ?? 0;

  const bindings: (string | number)[] = [actor.tenantId];
  if (studentIdFilter) bindings.push(studentIdFilter);
  bindings.push(limit, offset);

  const rows = await db
    .prepare(
      `SELECT
         ms.id,
         ms.student_profile_id as student_id,
         sp.full_name as student_name,
         sub.name as subject_name,
         ms.topic,
         ms.duration_minutes,
         ms.emotional_state,
         ms.tutor_summary,
         ms.created_at
       FROM mentoria_sessions ms
       INNER JOIN student_profiles sp ON sp.id = ms.student_profile_id AND sp.tenant_id = ms.tenant_id
       LEFT JOIN mentoria_subjects sub ON sub.id = ms.subject_id AND sub.tenant_id = ms.tenant_id
       WHERE ms.tenant_id = ? AND ms.status = 'completed' ${studentFilter}
       ORDER BY ms.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...bindings)
    .all();

  const sessions: MentorSessionAllRow[] = ((rows.results ?? []) as SessionRow[]).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    subjectName: r.subject_name,
    topic: r.topic,
    durationMinutes: r.duration_minutes,
    emotionalState: r.emotional_state,
    tutorSummary: r.tutor_summary,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ sessions, total, page, limit } satisfies MentorSessionsAllResponse);
}
