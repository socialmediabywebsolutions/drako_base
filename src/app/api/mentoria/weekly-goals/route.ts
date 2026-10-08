export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 21);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type WeeklyGoalStatus = "pending" | "in_progress" | "done" | "cancelled";
export type WeeklyGoalType = "task" | "sessions" | "score";

export type WeeklyGoal = {
  id: string;
  studentProfileId: string;
  weekStart: string;
  title: string;
  subjectSlug: string | null;
  goalType: WeeklyGoalType;
  targetValue: number | null;
  currentValue: number;
  status: WeeklyGoalStatus;
  notes: string | null;
  createdAt: string;
};

type GoalRow = {
  id: string;
  student_profile_id: string;
  week_start: string;
  title: string;
  subject_slug: string | null;
  goal_type: string;
  target_value: number | null;
  current_value: number;
  status: string;
  notes: string | null;
  created_at: string;
};

function rowToGoal(r: GoalRow): WeeklyGoal {
  return {
    id: r.id,
    studentProfileId: r.student_profile_id,
    weekStart: r.week_start,
    title: r.title,
    subjectSlug: r.subject_slug,
    goalType: r.goal_type as WeeklyGoalType,
    targetValue: r.target_value,
    currentValue: r.current_value,
    status: r.status as WeeklyGoalStatus,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function currentWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 Sun, 1 Mon...
  const diff = day === 0 ? -6 : 1 - day; // offset to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─── GET — list goals ─────────────────────────────────────────────────────────
// ?studentId=xxx&weekStart=YYYY-MM-DD (optional, defaults to current week)

export async function GET(req: NextRequest) {
  let actor;
  try {
    actor = await requireCurrentMentoriaSession(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId")?.trim() ?? "";
  const weekStart = searchParams.get("weekStart")?.trim() || currentWeekStart();

  if (!studentId) {
    return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
  }

  // Allow mentor (owner/admin) or the student themselves
  const isMentor = actor.role === "owner" || actor.role === "admin";
  const isStudent = actor.studentProfileId === studentId;
  if (!isMentor && !isStudent) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const result = await db
    .prepare(
      `SELECT id, student_profile_id, week_start, title, subject_slug, goal_type,
              target_value, current_value, status, notes, created_at
       FROM mentoria_weekly_goals
       WHERE tenant_id = ? AND student_profile_id = ? AND week_start = ?
       ORDER BY created_at ASC`,
    )
    .bind(actor.tenantId, studentId, weekStart)
    .all();

  const goals = ((result.results ?? []) as GoalRow[]).map(rowToGoal);
  return NextResponse.json({ goals, weekStart });
}

// ─── POST — create goal ───────────────────────────────────────────────────────

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
    weekStart?: string;
    title?: string;
    subjectSlug?: string;
    goalType?: string;
    targetValue?: number;
    notes?: string;
  } | null;

  if (!body?.studentId || !body.title?.trim()) {
    return NextResponse.json({ error: "studentId y title son obligatorios" }, { status: 400 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const id = nanoid();
  const weekStart = body.weekStart || currentWeekStart();
  const goalType = body.goalType ?? "task";
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO mentoria_weekly_goals
         (id, tenant_id, student_profile_id, week_start, title, subject_slug,
          goal_type, target_value, current_value, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?)`,
    )
    .bind(
      id,
      actor.tenantId,
      body.studentId,
      weekStart,
      body.title.trim(),
      body.subjectSlug ?? null,
      goalType,
      body.targetValue ?? null,
      body.notes ?? null,
      actor.userId,
      now,
      now,
    )
    .run();

  const created = await db
    .prepare(`SELECT * FROM mentoria_weekly_goals WHERE id = ?`)
    .bind(id)
    .all();

  const goal = rowToGoal((created.results?.[0] ?? {}) as GoalRow);
  return NextResponse.json({ goal }, { status: 201 });
}

// ─── PATCH — update status or currentValue ────────────────────────────────────

export async function PATCH(req: NextRequest) {
  let actor;
  try {
    actor = await requireCurrentMentoriaSession(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    id?: string;
    status?: WeeklyGoalStatus;
    currentValue?: number;
  } | null;

  if (!body?.id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Verify ownership: mentor can update any, student can only update progress
  const existing = await db
    .prepare(`SELECT * FROM mentoria_weekly_goals WHERE id = ? AND tenant_id = ?`)
    .bind(body.id, actor.tenantId)
    .all();

  const row = (existing.results?.[0] ?? null) as GoalRow | null;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isMentor = actor.role === "owner" || actor.role === "admin";
  const isOwner = actor.studentProfileId === row.student_profile_id;
  if (!isMentor && !isOwner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const newStatus = body.status ?? row.status;
  const newCurrentValue = body.currentValue ?? row.current_value;

  await db
    .prepare(
      `UPDATE mentoria_weekly_goals
       SET status = ?, current_value = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .bind(newStatus, newCurrentValue, now, body.id, actor.tenantId)
    .run();

  return NextResponse.json({ ok: true });
}

// ─── DELETE — remove goal (mentor only) ──────────────────────────────────────

export async function DELETE(req: NextRequest) {
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
  const id = searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  await db
    .prepare(`DELETE FROM mentoria_weekly_goals WHERE id = ? AND tenant_id = ?`)
    .bind(id, actor.tenantId)
    .run();

  return NextResponse.json({ ok: true });
}
