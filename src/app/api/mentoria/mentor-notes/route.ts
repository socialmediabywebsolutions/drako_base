export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaActor } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// GET  /api/mentoria/mentor-notes?studentId=xxx  — lista notas (mentor ve todas, padre/alumno ven visibles)
// POST /api/mentoria/mentor-notes                — crear nota (solo owner|admin)

export type MentorNoteVisibility = "internal" | "parent" | "student";

export type MentorNote = {
  id: string;
  studentId: string;
  authorName: string;
  body: string;
  visibility: MentorNoteVisibility;
  createdAt: string;
};

type NoteRow = {
  id: string;
  student_id: string;
  author_name: string;
  body: string;
  visibility: string;
  created_at: string;
};

function nanoid8(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedStudentId = searchParams.get("studentId")?.trim() ?? null;

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Try mentor session first (owner|admin)
  let isMentor = false;
  let tenantId: string;
  let studentId: string;

  try {
    const session = await requireCurrentMentoriaSession(req);
    if (session.role === "owner" || session.role === "admin") {
      isMentor = true;
      tenantId = session.tenantId;
      if (!requestedStudentId) {
        return NextResponse.json({ error: "studentId_required" }, { status: 400 });
      }
      studentId = requestedStudentId;
    } else {
      // Regular user — fall through to actor logic
      const actor = await getMentoriaActor(req);
      if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      tenantId = actor.tenantId;
      studentId = requestedStudentId ?? actor.studentId;
    }
  } catch {
    const actor = await getMentoriaActor(req);
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    tenantId = actor.tenantId;
    studentId = requestedStudentId ?? actor.studentId;
  }

  // Build query — mentor sees all, others only see parent+student visibility
  const visibilityFilter = isMentor ? "" : "AND visibility IN ('parent','student')";

  const rows = await db
    .prepare(
      `SELECT id, student_id, author_name, body, visibility, created_at
       FROM mentoria_mentor_notes
       WHERE tenant_id = ? AND student_id = ? ${visibilityFilter}
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .bind(tenantId, studentId)
    .all();

  const notes: MentorNote[] = ((rows.results ?? []) as NoteRow[]).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    authorName: r.author_name,
    body: r.body,
    visibility: r.visibility as MentorNoteVisibility,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ notes });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireCurrentMentoriaSession(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  type Body = { studentId?: string; body?: string; visibility?: string; authorName?: string };
  const payload = await req.json().catch(() => null) as Body | null;
  if (!payload?.studentId || !payload?.body?.trim()) {
    return NextResponse.json({ error: "studentId_and_body_required" }, { status: 400 });
  }

  const visibility = (["internal", "parent", "student"].includes(payload.visibility ?? "")
    ? payload.visibility
    : "internal") as MentorNoteVisibility;

  const id = nanoid8();
  const authorName = payload.authorName?.trim() || "Mentor";

  await db
    .prepare(
      `INSERT INTO mentoria_mentor_notes (id, tenant_id, student_id, author_id, author_name, body, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, session.tenantId, payload.studentId, session.userId ?? "unknown", authorName, payload.body.trim(), visibility)
    .run();

  return NextResponse.json({ ok: true, id });
}
