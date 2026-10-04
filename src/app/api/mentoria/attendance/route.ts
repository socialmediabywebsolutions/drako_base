export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";

const VALID_STATUSES = ["present", "absent_justified", "absent", "late", "left_early"] as const;
type AttendanceStatus = typeof VALID_STATUSES[number];

function resolveStatus(message: string): number {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
  if (message === "STUDENT_ACCESS_DENIED") return 403;
  if (message === "INVALID_INPUT") return 400;
  return 500;
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const body = (await request.json()) as {
      studentId?: string;
      recordDate?: string;
      subjectSlug?: string | null;
      status?: string;
      notes?: string | null;
    };

    const studentId = body.studentId ?? actor.studentProfileId;
    if (!studentId) throw new Error("INVALID_INPUT");

    const recordDate = body.recordDate?.trim();
    if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) throw new Error("INVALID_INPUT");

    const status = body.status as AttendanceStatus | undefined;
    if (!status || !VALID_STATUSES.includes(status)) throw new Error("INVALID_INPUT");

    const bindings = env?.();
    if (!bindings?.MENTORIA_DB) return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 });

    const db = getMentoriaDb(bindings);
    const id = crypto.randomUUID();
    const subjectSlug = body.subjectSlug?.trim() || null;

    await db
      .prepare(`
        INSERT INTO mentoria_attendance_records
          (id, tenant_id, student_profile_id, record_date, subject_slug, status, notes, created_by_actor_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (tenant_id, student_profile_id, record_date, COALESCE(subject_slug, ''))
        DO UPDATE SET status = excluded.status, notes = excluded.notes, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      `)
      .bind(id, actor.tenantId, studentId, recordDate, subjectSlug, status, body.notes ?? null, actor.actorType ?? "guardian")
      .run();

    return NextResponse.json({ ok: true, id, recordDate, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATTENDANCE_SAVE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: resolveStatus(message) });
  }
}
