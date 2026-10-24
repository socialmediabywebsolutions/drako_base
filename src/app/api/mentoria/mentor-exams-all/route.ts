export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export interface MentorExamAllRow {
  id: string;
  studentId: string;
  studentName: string;
  subjectName: string;
  examDate: string;
  examLabel: string | null;
  difficulty: "easy" | "medium" | "hard";
  status: string;
  sessionsPlanned: number;
  sessionsDone: number;
  scoreAfter: number | null;
  daysUntil: number;
}

export interface MentorExamsAllResponse {
  exams: MentorExamAllRow[];
  total: number;
}

type ExamRow = {
  id: string;
  student_id: string;
  student_name: string;
  subject_name: string;
  exam_date: string;
  exam_label: string | null;
  difficulty: string;
  status: string;
  sessions_planned: number;
  sessions_done: number;
  score_after: number | null;
};

// GET /api/mentoria/mentor-exams-all?status=active — todos los exámenes del tenant
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
  const status = searchParams.get("status") ?? "active";

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const rows = await db
    .prepare(
      `SELECT
         de.id, de.student_id, sp.full_name as student_name,
         de.subject_name, de.exam_date, de.exam_label,
         de.difficulty, de.status,
         de.sessions_planned, COALESCE(de.sessions_done, 0) as sessions_done,
         de.score_after
       FROM mentoria_declared_exams de
       INNER JOIN student_profiles sp ON sp.id = de.student_id AND sp.tenant_id = de.tenant_id
       WHERE de.tenant_id = ? AND de.status = ?
       ORDER BY de.exam_date ASC
       LIMIT 200`,
    )
    .bind(actor.tenantId, status)
    .all();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exams: MentorExamAllRow[] = ((rows.results ?? []) as ExamRow[]).map((r) => {
    const examDay = new Date(r.exam_date);
    examDay.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((examDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      subjectName: r.subject_name,
      examDate: r.exam_date,
      examLabel: r.exam_label,
      difficulty: r.difficulty as "easy" | "medium" | "hard",
      status: r.status,
      sessionsPlanned: r.sessions_planned,
      sessionsDone: r.sessions_done,
      scoreAfter: r.score_after,
      daysUntil,
    };
  });

  return NextResponse.json({ exams, total: exams.length } satisfies MentorExamsAllResponse);
}
