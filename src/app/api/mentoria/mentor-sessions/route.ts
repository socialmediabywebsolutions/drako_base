export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

const VALID_EMOTIONAL_STATES = ["animado", "neutro", "desanimado", "bloqueado"] as const;
type EmotionalState = typeof VALID_EMOTIONAL_STATES[number];

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

// POST /api/mentoria/mentor-sessions — registrar sesión manual (solo owner|admin)
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

  const body = await req.json().catch(() => null) as {
    studentId?: string;
    subjectName?: string;
    topic?: string;
    durationMinutes?: number;
    emotionalState?: string;
    tutorSummary?: string;
  } | null;

  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { studentId, subjectName, topic, durationMinutes, emotionalState, tutorSummary } = body;

  if (!studentId?.trim()) return NextResponse.json({ error: "student_id_required" }, { status: 400 });
  if (!subjectName?.trim()) return NextResponse.json({ error: "subject_name_required" }, { status: 400 });
  if (!durationMinutes || durationMinutes < 1 || durationMinutes > 480) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Verify student belongs to tenant
  const student = await db
    .prepare(`SELECT id FROM student_profiles WHERE id = ? AND tenant_id = ? LIMIT 1`)
    .bind(studentId.trim(), actor.tenantId)
    .first() as { id: string } | null;

  if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  // Look up or create subject by name
  const nameClean = subjectName.trim();
  const slugRaw = nameClean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slugBase = slugRaw || "materia";

  let subjectRow = await db
    .prepare(`SELECT id, name, slug FROM mentoria_subjects WHERE tenant_id = ? AND slug = ? LIMIT 1`)
    .bind(actor.tenantId, slugBase)
    .first() as { id: string; name: string; slug: string } | null;

  if (!subjectRow) {
    const subjectId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO mentoria_subjects (id, tenant_id, slug, name, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(subjectId, actor.tenantId, slugBase, nameClean, now, now)
      .run();
    subjectRow = { id: subjectId, name: nameClean, slug: slugBase };
  }

  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const resolvedEmotional = VALID_EMOTIONAL_STATES.includes(emotionalState as EmotionalState)
    ? emotionalState
    : null;

  await db
    .prepare(
      `INSERT INTO mentoria_sessions
         (id, tenant_id, mentor_id, client_id, student_profile_id, subject_id,
          topic, duration_minutes, emotional_state, tutor_summary,
          status, created_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
    )
    .bind(
      sessionId,
      actor.tenantId,
      actor.userId,
      studentId.trim(),
      studentId.trim(),
      subjectRow.id,
      topic?.trim() || null,
      durationMinutes,
      resolvedEmotional,
      tutorSummary?.trim() || null,
      now,
      now,
      now,
    )
    .run();

  const session: MentorSessionItem = {
    id: sessionId,
    subjectId: subjectRow.id,
    subjectName: subjectRow.name,
    topic: topic?.trim() || null,
    durationMinutes,
    emotionalState: resolvedEmotional ?? null,
    tutorSummary: tutorSummary?.trim() || null,
    recommendedNextStep: null,
    status: "completed",
    createdAt: now,
    completedAt: now,
  };

  return NextResponse.json({ session }, { status: 201 });
}
