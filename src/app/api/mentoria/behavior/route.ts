export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";

const VALID_TYPES = ["positive", "neutral", "attention", "disruptive", "disengaged"] as const;
type BehaviorType = typeof VALID_TYPES[number];

export type BehaviorRecord = {
  id: string;
  recordDate: string;
  subjectSlug: string | null;
  behaviorType: BehaviorType;
  intensity: number;
  note: string | null;
  createdAt: string;
};

type BehaviorRow = {
  id: string;
  record_date: string;
  subject_slug: string | null;
  behavior_type: string;
  intensity: number;
  note: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId")?.trim() ?? actor.studentProfileId;
    if (!studentId) return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

    const bindings = env?.();
    if (!bindings?.MENTORIA_DB) return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 });
    const db = getMentoriaDb(bindings);

    const result = await db
      .prepare(
        `SELECT id, record_date, subject_slug, behavior_type, intensity, note, created_at
         FROM mentoria_behavior_records
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY record_date DESC, created_at DESC
         LIMIT 60`,
      )
      .bind(actor.tenantId, studentId)
      .all();

    const records: BehaviorRecord[] = ((result.results ?? []) as BehaviorRow[]).map((r) => ({
      id: r.id,
      recordDate: r.record_date,
      subjectSlug: r.subject_slug,
      behaviorType: r.behavior_type as BehaviorType,
      intensity: r.intensity,
      note: r.note,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ ok: true, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BEHAVIOR_LOAD_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: resolveStatus(message) });
  }
}

function resolveStatus(message: string): number {
  if (message === "SESSION_REQUIRED") return 401;
  if (message === "ONBOARDING_REQUIRED") return 409;
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
      behaviorType?: string;
      intensity?: number;
      note?: string | null;
    };

    const studentId = body.studentId ?? actor.studentProfileId;
    if (!studentId) throw new Error("INVALID_INPUT");

    const recordDate = body.recordDate?.trim();
    if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) throw new Error("INVALID_INPUT");

    const behaviorType = body.behaviorType as BehaviorType | undefined;
    if (!behaviorType || !VALID_TYPES.includes(behaviorType)) throw new Error("INVALID_INPUT");

    const intensity = body.intensity ?? 2;
    if (intensity < 1 || intensity > 5) throw new Error("INVALID_INPUT");

    const bindings = env?.();
    if (!bindings?.MENTORIA_DB) return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 });

    const db = getMentoriaDb(bindings);
    const id = crypto.randomUUID();

    await db
      .prepare(`
        INSERT INTO mentoria_behavior_records
          (id, tenant_id, student_profile_id, record_date, subject_slug, behavior_type, intensity, note, source, created_by_actor_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'parent_report', ?)
      `)
      .bind(id, actor.tenantId, studentId, recordDate, body.subjectSlug?.trim() || null, behaviorType, intensity, body.note ?? null, actor.actorType ?? "guardian")
      .run();

    return NextResponse.json({ ok: true, id, recordDate, behaviorType });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BEHAVIOR_SAVE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: resolveStatus(message) });
  }
}
