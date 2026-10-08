export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// PATCH /api/mentoria/mentor-exams/[id] — update exam status or score
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let actor;
  try {
    actor = await requireCurrentMentoriaSession(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const examId = params.id?.trim();
  if (!examId) return NextResponse.json({ error: "exam_id_required" }, { status: 400 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Verify exam belongs to this tenant
  const exam = await db
    .prepare(`SELECT id, status FROM mentoria_declared_exams WHERE id = ? AND tenant_id = ? LIMIT 1`)
    .bind(examId, actor.tenantId)
    .first() as { id: string; status: string } | null;

  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });

  type PatchBody = {
    status?: "active" | "completed" | "cancelled";
    scoreAfter?: number | null;
    sessionsDone?: number;
  };

  const body = await req.json().catch(() => null) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const now = new Date().toISOString();

  // Build SET clauses dynamically
  const setClauses: string[] = ["updated_at = ?"];
  const bindings: (string | number | null)[] = [now];

  const validStatuses = ["active", "completed", "cancelled"];
  if (body.status && validStatuses.includes(body.status)) {
    setClauses.push("status = ?");
    bindings.push(body.status);
  }

  if (body.scoreAfter !== undefined) {
    const score = body.scoreAfter === null ? null : Math.min(10, Math.max(0, Number(body.scoreAfter)));
    setClauses.push("score_after = ?");
    bindings.push(score);
  }

  if (body.sessionsDone !== undefined) {
    const done = Math.max(0, Math.min(200, Number(body.sessionsDone)));
    setClauses.push("sessions_done = ?");
    bindings.push(done);
  }

  bindings.push(examId, actor.tenantId);

  await db
    .prepare(
      `UPDATE mentoria_declared_exams SET ${setClauses.join(", ")} WHERE id = ? AND tenant_id = ?`,
    )
    .bind(...bindings)
    .run();

  return NextResponse.json({ ok: true });
}
