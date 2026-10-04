import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMentoriaActor } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { buildExamPlan, buildExamSimulation, analyzeWeakTopics, daysUntil } from "@/lib/agents/mentoria/exam-agent";
import { awardXp, recordExamCompleted } from "@/lib/mentoria/progression-system";

// GET /api/mentoria/exam-mode?action=plan|simulation|analyze — obtener plan o simulacro
// POST /api/mentoria/exam-mode — declarar nuevo examen
// PATCH /api/mentoria/exam-mode — completar sesión o simulacro

export async function GET(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "list";
  const examId = searchParams.get("exam_id");

  if (action === "list") {
    const exams = await db
      .prepare(
        `SELECT * FROM mentoria_declared_exams
         WHERE student_id = ? AND status = 'active'
         ORDER BY exam_date ASC`,
      )
      .bind(actor.studentId)
      .all<Record<string, unknown>>();

    return NextResponse.json({
      exams: (exams.results ?? []).map((e) => ({
        id: String(e.id),
        subjectId: String(e.subject_id),
        subjectName: String(e.subject_name),
        examDate: String(e.exam_date),
        examLabel: e.exam_label ? String(e.exam_label) : null,
        difficulty: String(e.difficulty),
        daysUntil: daysUntil(String(e.exam_date)),
        sessionsDone: Number(e.sessions_done ?? 0),
        sessionsPlanned: Number(e.sessions_planned ?? 0),
      })),
    });
  }

  if (action === "plan" && examId) {
    const exam = await db
      .prepare("SELECT * FROM mentoria_declared_exams WHERE id = ? AND student_id = ?")
      .bind(examId, actor.studentId)
      .first<Record<string, unknown>>();

    if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });

    const student = await db
      .prepare("SELECT * FROM mentoria_students WHERE id = ?")
      .bind(actor.studentId)
      .first<Record<string, unknown>>();

    if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

    const days = daysUntil(String(exam.exam_date));

    const plan = await buildExamPlan(
      {
        id: actor.studentId,
        age: Number(student.age ?? 15),
        schoolYear: String(student.school_year ?? "ESO"),
      } as Parameters<typeof buildExamPlan>[0],
      {
        subjectName: String(exam.subject_name),
        examDate: String(exam.exam_date),
        examLabel: exam.exam_label ? String(exam.exam_label) : undefined,
        daysUntilExam: days,
        difficulty: String(exam.difficulty) as "easy" | "medium" | "hard",
      },
    );

    return NextResponse.json({ plan, exam: { id: examId, daysUntil: days } });
  }

  if (action === "simulation" && examId) {
    const exam = await db
      .prepare("SELECT * FROM mentoria_declared_exams WHERE id = ? AND student_id = ?")
      .bind(examId, actor.studentId)
      .first<Record<string, unknown>>();

    if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });

    const student = await db
      .prepare("SELECT * FROM mentoria_students WHERE id = ?")
      .bind(actor.studentId)
      .first<Record<string, unknown>>();

    if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

    const simulation = await buildExamSimulation(
      {
        id: actor.studentId,
        age: Number(student.age ?? 15),
        schoolYear: String(student.school_year ?? "ESO"),
      } as Parameters<typeof buildExamSimulation>[0],
      {
        subjectName: String(exam.subject_name),
        examDate: String(exam.exam_date),
        daysUntilExam: daysUntil(String(exam.exam_date)),
        difficulty: String(exam.difficulty) as "easy" | "medium" | "hard",
      },
      5,
      15,
    );

    return NextResponse.json({ simulation });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { subjectId, subjectName, examDate, examLabel, difficulty } = body as {
    subjectId: string;
    subjectName: string;
    examDate: string;
    examLabel?: string;
    difficulty?: string;
  };

  if (!subjectId || !subjectName || !examDate) {
    return NextResponse.json({ error: "missing_fields" }, { status: 422 });
  }

  const id = crypto.randomUUID();
  const days = daysUntil(examDate);

  // Calcular sesiones recomendadas según días disponibles
  const sessionsPlanned = Math.min(days, 7);

  await db
    .prepare(
      `INSERT INTO mentoria_declared_exams
       (id, tenant_id, student_id, subject_id, subject_name, exam_date, exam_label, difficulty, sessions_planned, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    )
    .bind(
      id,
      actor.tenantId,
      actor.studentId,
      subjectId,
      subjectName,
      examDate,
      examLabel ?? null,
      difficulty ?? "medium",
      sessionsPlanned,
    )
    .run();

  return NextResponse.json({ id, daysUntil: days, sessionsPlanned }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { examId, action, simulationData, scoreAfter } = body as {
    examId: string;
    action: "complete_session" | "complete_simulation" | "mark_done" | "record_score";
    simulationData?: {
      durationSeconds: number;
      questionsCount: number;
      correctCount?: number;
      topicsCovered?: string[];
      weakTopics?: string[];
    };
    scoreAfter?: string;
  };

  const exam = await db
    .prepare("SELECT * FROM mentoria_declared_exams WHERE id = ? AND student_id = ?")
    .bind(examId, actor.studentId)
    .first<Record<string, unknown>>();

  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });

  if (action === "complete_session") {
    await db
      .prepare("UPDATE mentoria_declared_exams SET sessions_done = sessions_done + 1, updated_at = datetime('now') WHERE id = ?")
      .bind(examId)
      .run();

    const { progression, newAchievements } = await awardXp(db, actor.tenantId, actor.studentId, "exam_prep_session");
    return NextResponse.json({ progression, newAchievements });
  }

  if (action === "complete_simulation" && simulationData) {
    const simId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO mentoria_exam_simulations
         (id, tenant_id, student_id, declared_exam_id, subject_id, duration_seconds,
          questions_count, correct_count, topics_covered, weak_topics)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        simId,
        actor.tenantId,
        actor.studentId,
        examId,
        String(exam.subject_id),
        simulationData.durationSeconds,
        simulationData.questionsCount,
        simulationData.correctCount ?? null,
        simulationData.topicsCovered ? JSON.stringify(simulationData.topicsCovered) : null,
        simulationData.weakTopics ? JSON.stringify(simulationData.weakTopics) : null,
      )
      .run();

    const { progression, newAchievements } = await awardXp(db, actor.tenantId, actor.studentId, "exam_simulation");
    return NextResponse.json({ simulationId: simId, progression, newAchievements });
  }

  if (action === "mark_done") {
    await db
      .prepare("UPDATE mentoria_declared_exams SET status = 'completed', updated_at = datetime('now') WHERE id = ?")
      .bind(examId)
      .run();
    await recordExamCompleted(db, actor.tenantId, actor.studentId);
    return NextResponse.json({ done: true });
  }

  if (action === "record_score" && scoreAfter) {
    await db
      .prepare("UPDATE mentoria_declared_exams SET score_after = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?")
      .bind(scoreAfter, examId)
      .run();
    await recordExamCompleted(db, actor.tenantId, actor.studentId);
    return NextResponse.json({ done: true });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
