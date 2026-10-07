export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMentoriaActor } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// GET  /api/mentoria/exams?status=active  — listar exámenes del alumno
// POST /api/mentoria/exams               — declarar nuevo examen

export async function GET(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "active";

  const rows = await db
    .prepare(
      `SELECT id, subject_id, subject_name, exam_date, exam_label,
              difficulty, status, sessions_planned, sessions_done,
              score_after, created_at
       FROM mentoria_declared_exams
       WHERE tenant_id = ? AND student_id = ? AND status = ?
       ORDER BY exam_date ASC
       LIMIT 20`,
    )
    .bind(actor.tenantId, actor.studentId, status)
    .all();

  return NextResponse.json({ exams: (rows.results ?? []) as unknown[] });
}

export async function POST(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    subjectId: string;
    subjectName: string;
    examDate: string;
    examLabel?: string;
    difficulty?: "easy" | "medium" | "hard";
    sessionsPlanned?: number;
  } | null;

  if (!body?.subjectId || !body.subjectName || !body.examDate) {
    return NextResponse.json({ error: "missing_fields" }, { status: 422 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO mentoria_declared_exams
       (id, tenant_id, student_id, subject_id, subject_name, exam_date, exam_label,
        difficulty, sessions_planned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      actor.tenantId,
      actor.studentId,
      body.subjectId,
      body.subjectName,
      body.examDate,
      body.examLabel ?? null,
      body.difficulty ?? "medium",
      body.sessionsPlanned ?? 0,
      now,
      now,
    )
    .run();

  return NextResponse.json({ ok: true, examId: id }, { status: 201 });
}
