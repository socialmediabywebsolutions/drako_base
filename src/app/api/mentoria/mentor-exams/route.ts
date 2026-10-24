export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export interface MentorExamRow {
  id: string;
  subjectId: string;
  subjectName: string;
  examDate: string;
  examLabel: string | null;
  difficulty: "easy" | "medium" | "hard";
  status: string;
  sessionsPlanned: number;
  sessionsDone: number;
  scoreAfter: number | null;
  createdAt: string;
}

// GET /api/mentoria/mentor-exams?studentId=xxx&status=active
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

  const status = searchParams.get("status") ?? "active";

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

  const rows = await db
    .prepare(
      `SELECT id, subject_id, subject_name, exam_date, exam_label,
              difficulty, status, sessions_planned, sessions_done,
              score_after, created_at
       FROM mentoria_declared_exams
       WHERE tenant_id = ? AND student_id = ? AND status = ?
       ORDER BY exam_date ASC
       LIMIT 50`,
    )
    .bind(actor.tenantId, studentId, status)
    .all();

  const exams: MentorExamRow[] = ((rows.results ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    subjectId: r.subject_id as string,
    subjectName: r.subject_name as string,
    examDate: r.exam_date as string,
    examLabel: (r.exam_label as string | null) ?? null,
    difficulty: (r.difficulty as "easy" | "medium" | "hard") ?? "medium",
    status: r.status as string,
    sessionsPlanned: (r.sessions_planned as number) ?? 0,
    sessionsDone: (r.sessions_done as number) ?? 0,
    scoreAfter: (r.score_after as number | null) ?? null,
    createdAt: r.created_at as string,
  }));

  return NextResponse.json({ exams });
}

// POST /api/mentoria/mentor-exams?studentId=xxx
export async function POST(req: NextRequest) {
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

  let body: {
    subjectName: string;
    examDate: string;
    examLabel?: string;
    difficulty?: "easy" | "medium" | "hard";
    sessionsPlanned?: number;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const subjectName = body.subjectName?.trim();
  if (!subjectName || subjectName.length < 1) {
    return NextResponse.json({ error: "subject_name_required" }, { status: 422 });
  }

  const examDate = body.examDate?.trim();
  if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    return NextResponse.json({ error: "exam_date_required" }, { status: 422 });
  }

  const validDifficulties = ["easy", "medium", "hard"];
  const difficulty = validDifficulties.includes(body.difficulty ?? "") ? body.difficulty! : "medium";
  const sessionsPlanned = Math.max(0, Math.min(50, body.sessionsPlanned ?? 0));
  const examLabel = body.examLabel?.trim() || null;
  const subjectId = crypto.randomUUID(); // synthetic subject id
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO mentoria_declared_exams
       (id, tenant_id, student_id, subject_id, subject_name, exam_date, exam_label,
        difficulty, sessions_planned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, actor.tenantId, studentId, subjectId, subjectName, examDate, examLabel, difficulty, sessionsPlanned, now, now)
    .run();

  return NextResponse.json({ ok: true, id });
}
