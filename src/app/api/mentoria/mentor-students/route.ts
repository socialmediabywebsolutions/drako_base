export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// POST /api/mentoria/mentor-students
// Crear un nuevo alumno directamente desde el panel del mentor (owner|admin)

const VALID_SCHOOL_YEARS = [
  "1 Primaria", "2 Primaria", "3 Primaria", "4 Primaria", "5 Primaria", "6 Primaria",
  "1 ESO", "2 ESO", "3 ESO", "4 ESO",
  "1 Bachillerato", "2 Bachillerato",
  "FP Básica", "FP Medio", "FP Superior",
  "Universidad",
  "Otro",
];

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

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  let body: {
    fullName?: string;
    schoolYear?: string;
    guardianEmail?: string | null;
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
  const preferredStudyMinutes = Math.max(10, Math.min(240, body.preferredStudyMinutes ?? 45));
  const guardianEmail = body.guardianEmail?.trim() || null;
  const learningPreference = body.learningPreference?.trim() || null;
  const supportNotes = body.supportNotes?.trim() || null;

  // Create student profile
  const studentId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO mentoria_student_profiles
         (id, tenant_id, full_name, school_year, preferred_study_minutes, learning_preference, support_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      studentId,
      actor.tenantId,
      fullName,
      schoolYear,
      preferredStudyMinutes,
      learningPreference,
      supportNotes,
      now,
      now,
    )
    .run();

  // Initialize progression row
  await db
    .prepare(
      `INSERT OR IGNORE INTO mentoria_student_progression
         (id, tenant_id, student_profile_id, xp_total, level, session_streak, streak_best, sessions_completed, created_at, updated_at)
       VALUES (?, ?, ?, 0, 1, 0, 0, 0, ?, ?)`,
    )
    .bind(crypto.randomUUID(), actor.tenantId, studentId, now, now)
    .run();

  // If guardian email provided, create/link guardian user
  if (guardianEmail) {
    // Check if user exists
    const existingUserResult = await db
      .prepare(`SELECT id FROM mentoria_users WHERE email = ? AND tenant_id = ? LIMIT 1`)
      .bind(guardianEmail, actor.tenantId)
      .all();

    let guardianUserId: string;
    const existingUser = (existingUserResult.results?.[0] ?? null) as { id: string } | null;

    if (existingUser) {
      guardianUserId = existingUser.id;
    } else {
      // Create placeholder guardian user (no auth yet — they'll register via email)
      guardianUserId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT OR IGNORE INTO mentoria_users
             (id, tenant_id, email, role, created_at)
           VALUES (?, ?, ?, 'user', ?)`,
        )
        .bind(guardianUserId, actor.tenantId, guardianEmail, now)
        .run();
    }

    // Link guardian to student
    await db
      .prepare(
        `INSERT OR IGNORE INTO mentoria_guardian_student_links
           (id, tenant_id, guardian_user_id, student_profile_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), actor.tenantId, guardianUserId, studentId, now)
      .run();
  }

  return NextResponse.json({
    ok: true,
    studentId,
    fullName,
    schoolYear,
  }, { status: 201 });
}
