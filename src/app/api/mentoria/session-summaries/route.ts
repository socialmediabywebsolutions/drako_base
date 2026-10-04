import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMentoriaActor } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { runMentoriaLlm } from "@/lib/agents/mentoria/llm-client";
import {
  buildSessionSummaryFromSignal,
  buildSummaryGenerationPrompt,
  serializeSummary,
  deserializeSummary,
} from "@/lib/mentoria/session-summary";
import type { SessionOutcomeSignal } from "@/lib/agents/mentoria/base-agent";
import type { SessionSummaryRow } from "@/lib/mentoria/session-summary";

// GET /api/mentoria/session-summaries?subject_slug=xxx&limit=10
// POST /api/mentoria/session-summaries — genera y persiste resumen de sesión

export async function GET(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const subjectSlug = searchParams.get("subject_slug");
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);

  const query = subjectSlug
    ? `SELECT * FROM mentoria_session_summaries
       WHERE tenant_id = ? AND student_id = ? AND subject_slug = ?
       ORDER BY session_date DESC LIMIT ?`
    : `SELECT * FROM mentoria_session_summaries
       WHERE tenant_id = ? AND student_id = ?
       ORDER BY session_date DESC LIMIT ?`;

  const params = subjectSlug
    ? [actor.tenantId, actor.studentId, subjectSlug, limit]
    : [actor.tenantId, actor.studentId, limit];

  const rows = await db
    .prepare(query)
    .bind(...params)
    .all() as { results: SessionSummaryRow[] };

  return NextResponse.json({
    summaries: (rows.results ?? []).map(deserializeSummary),
  });
}

export async function POST(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    signal: SessionOutcomeSignal;
    subjectSlug: string;
    subjectName: string;
    studentAge?: number;
  } | null;

  if (!body?.signal || !body.subjectSlug || !body.subjectName) {
    return NextResponse.json({ error: "missing_fields" }, { status: 422 });
  }

  const { signal, subjectSlug, subjectName, studentAge } = body;

  // Construir la base del resumen sin LLM
  const base = buildSessionSummaryFromSignal(signal, actor.studentId, subjectSlug, subjectName);

  // Generar headline y closingMessage con LLM
  const prompt = buildSummaryGenerationPrompt({
    subjectName,
    topicsCovered: signal.topicsCovered,
    masteryLevel: signal.masteryLevel,
    emotionalState: signal.emotionalStateAtEnd,
    age: studentAge ?? 15,
    durationMinutes: base.durationMinutes,
    weakTopics: signal.weakTopicsDetected,
  });

  let headline = `Sesión de ${subjectName} completada`;
  let closingMessage = "¡Buen trabajo hoy! Cada sesión cuenta.";

  try {
    const result = await runMentoriaLlm([{ role: "user", content: prompt }]);
    const parsed = JSON.parse(result.text) as { headline?: string; closingMessage?: string };
    if (parsed.headline) headline = parsed.headline;
    if (parsed.closingMessage) closingMessage = parsed.closingMessage;
  } catch {
    // fallback genérico ya asignado arriba
  }

  const summary = {
    ...base,
    id: crypto.randomUUID(),
    headline,
    closingMessage,
  };

  const row = serializeSummary(summary, actor.tenantId);

  await db
    .prepare(
      `INSERT INTO mentoria_session_summaries
       (id, tenant_id, student_id, subject_slug, subject_name, session_date,
        duration_minutes, headline, points_json, closing_tone, closing_message, parent_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.tenant_id,
      row.student_id,
      row.subject_slug,
      row.subject_name,
      row.session_date,
      row.duration_minutes,
      row.headline,
      row.points_json,
      row.closing_tone,
      row.closing_message,
      row.parent_note ?? null,
    )
    .run();

  return NextResponse.json({ summary }, { status: 201 });
}
