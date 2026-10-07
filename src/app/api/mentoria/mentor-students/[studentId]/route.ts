export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

const VALID_SCHOOL_YEARS = [
  "1 Primaria", "2 Primaria", "3 Primaria", "4 Primaria", "5 Primaria", "6 Primaria",
  "1 ESO", "2 ESO", "3 ESO", "4 ESO",
  "1 Bachillerato", "2 Bachillerato",
  "FP Básica", "FP Medio", "FP Superior",
  "Universidad",
  "Otro",
];

// PUT /api/mentoria/mentor-students/[studentId]
// Actualizar datos de un alumno (solo owner|admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
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

  const { studentId } = await params;
  if (!studentId?.trim()) {
    return NextResponse.json({ error: "student_id_required" }, { status: 400 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  let body: {
    fullName?: string;
    schoolYear?: string;
    guardianEmail?: string | null;
    guardianPhone?: string | null;
    learningPreference?: string | null;
    supportNotes?: string | null;
    preferredStudyMinutes?: number;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const fullName = body.fullName?.trim();
  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "full_name_required" }, { status: 400 });
  }

  const schoolYear = body.schoolYear?.trim() ?? "1 ESO";
  if (!VALID_SCHOOL_YEARS.includes(schoolYear)) {
    return NextResponse.json({ error: "invalid_school_year" }, { status: 400 });
  }

  const preferredStudyMinutes = Math.max(10, Math.min(240, body.preferredStudyMinutes ?? 45));
  const guardianEmail = body.guardianEmail?.trim() || null;
  const guardianPhone = body.guardianPhone?.trim() || null;
  const learningPreference = body.learningPreference?.trim() || null;
  const supportNotes = body.supportNotes?.trim() || null;

  // Verify the student belongs to this tenant
  const existing = await db
    .prepare(
      `SELECT id FROM student_profiles WHERE id = ? AND tenant_id = ? LIMIT 1`,
    )
    .bind(studentId, actor.tenantId)
    .first() as { id: string } | null;

  if (!existing) {
    return NextResponse.json({ error: "student_not_found" }, { status: 404 });
  }

  await db
    .prepare(
      `UPDATE student_profiles
       SET full_name = ?,
           school_year = ?,
           guardian_email = ?,
           guardian_phone = ?,
           learning_preference = ?,
           support_notes = ?,
           preferred_study_minutes = ?,
           updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
    )
    .bind(
      fullName,
      schoolYear,
      guardianEmail,
      guardianPhone,
      learningPreference,
      supportNotes,
      preferredStudyMinutes,
      studentId,
      actor.tenantId,
    )
    .run();

  return NextResponse.json({ ok: true });
}
