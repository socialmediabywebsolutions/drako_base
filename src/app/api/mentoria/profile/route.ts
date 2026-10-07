export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMentoriaActor } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// GET  /api/mentoria/profile  — perfil del alumno actual
// PATCH /api/mentoria/profile — actualizar campos editables

export type StudentProfilePublic = {
  id: string;
  fullName: string;
  schoolYear: string;
  preferredStudyMinutes: number;
  learningPreference: string | null;
  supportNotes: string | null;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  school_year: string;
  preferred_study_minutes: number;
  learning_preference: string | null;
  support_notes: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const result = await db
    .prepare(
      `SELECT id, full_name, school_year, preferred_study_minutes, learning_preference, support_notes, created_at
       FROM mentoria_student_profiles
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
    )
    .bind(actor.studentId, actor.tenantId)
    .all();

  const row = (result.results?.[0] ?? null) as ProfileRow | null;
  if (!row) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });

  const profile: StudentProfilePublic = {
    id: row.id,
    fullName: row.full_name,
    schoolYear: row.school_year,
    preferredStudyMinutes: row.preferred_study_minutes,
    learningPreference: row.learning_preference,
    supportNotes: row.support_notes,
    createdAt: row.created_at,
  };

  return NextResponse.json({ profile });
}

export async function PATCH(req: NextRequest) {
  const actor = await getMentoriaActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  type Body = {
    preferredStudyMinutes?: number;
    learningPreference?: string;
    supportNotes?: string;
  };

  const payload = await req.json().catch(() => null) as Body | null;
  if (!payload) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const sets: string[] = [];
  const vals: unknown[] = [];

  if (typeof payload.preferredStudyMinutes === "number" && payload.preferredStudyMinutes > 0) {
    sets.push("preferred_study_minutes = ?");
    vals.push(Math.min(120, Math.max(10, payload.preferredStudyMinutes)));
  }
  if (typeof payload.learningPreference === "string") {
    sets.push("learning_preference = ?");
    vals.push(payload.learningPreference.trim() || null);
  }
  if (typeof payload.supportNotes === "string") {
    sets.push("support_notes = ?");
    vals.push(payload.supportNotes.trim() || null);
  }

  if (sets.length === 0) return NextResponse.json({ ok: true, changed: false });

  sets.push("updated_at = datetime('now')");
  vals.push(actor.studentId, actor.tenantId);

  await db
    .prepare(`UPDATE mentoria_student_profiles SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`)
    .bind(...vals)
    .run();

  return NextResponse.json({ ok: true, changed: true });
}
