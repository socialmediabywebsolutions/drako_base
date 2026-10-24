export const dynamic = "force-dynamic";
// Mentor guardian management: list, invite, remove guardians for a student

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export type MentorGuardianItem = {
  linkId: string;
  guardianUserId: string | null;
  guardianEmail: string;
  guardianName: string | null;
  guardianPhone: string | null;
  role: string;
  systemRole: string;
  status: string;
  createdAt: string;
  lastSeenAt: string | null;
};

// GET /api/mentoria/mentor-guardians?studentId=xxx
export async function GET(req: NextRequest) {
  const actor = await requireCurrentMentoriaSession(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId_required" }, { status: 400 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Verify student belongs to tenant
  const profileRow = await db
    .prepare("SELECT id FROM mentoria_student_profiles WHERE id = ? AND tenant_id = ?")
    .bind(studentId, actor.tenantId)
    .first() as Record<string, unknown> | null;
  if (!profileRow) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  const rows = await db
    .prepare(`
      SELECT
        gsl.id AS link_id,
        gsl.guardian_user_id,
        gsl.guardian_email,
        gsl.role,
        gsl.system_role,
        gsl.status,
        gsl.created_at,
        mu.full_name AS guardian_name,
        mu.phone AS guardian_phone,
        mu.last_seen_at
      FROM mentoria_guardian_student_links gsl
      LEFT JOIN mentoria_users mu ON mu.id = gsl.guardian_user_id AND mu.tenant_id = gsl.tenant_id
      WHERE gsl.student_profile_id = ? AND gsl.tenant_id = ?
      ORDER BY gsl.created_at ASC
    `)
    .bind(studentId, actor.tenantId)
    .all() as { results?: Record<string, unknown>[] };

  const guardians: MentorGuardianItem[] = (rows.results ?? []).map((r) => ({
    linkId: String(r.link_id),
    guardianUserId: r.guardian_user_id ? String(r.guardian_user_id) : null,
    guardianEmail: String(r.guardian_email),
    guardianName: r.guardian_name ? String(r.guardian_name) : null,
    guardianPhone: r.guardian_phone ? String(r.guardian_phone) : null,
    role: String(r.role ?? "tutor"),
    systemRole: String(r.system_role ?? "secondary_guardian"),
    status: String(r.status ?? "pending"),
    createdAt: String(r.created_at),
    lastSeenAt: r.last_seen_at ? String(r.last_seen_at) : null,
  }));

  return NextResponse.json({ guardians });
}

// POST /api/mentoria/mentor-guardians — invitar tutor a un alumno
export async function POST(req: NextRequest) {
  const actor = await requireCurrentMentoriaSession(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    studentId?: string;
    email?: string;
    name?: string | null;
    role?: string;
  } | null;

  const studentId = body?.studentId;
  const email = body?.email?.trim().toLowerCase();
  const name = body?.name?.trim() ?? null;
  const role = (body?.role ?? "tutor") as string;

  if (!studentId || !email) {
    return NextResponse.json({ error: "studentId_and_email_required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Verify student belongs to tenant
  const profileRow = await db
    .prepare("SELECT id FROM mentoria_student_profiles WHERE id = ? AND tenant_id = ?")
    .bind(studentId, actor.tenantId)
    .first() as Record<string, unknown> | null;
  if (!profileRow) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  // Check if this email is already linked
  const existing = await db
    .prepare("SELECT id FROM mentoria_guardian_student_links WHERE student_profile_id = ? AND guardian_email = ? AND tenant_id = ?")
    .bind(studentId, email, actor.tenantId)
    .first() as Record<string, unknown> | null;
  if (existing) {
    return NextResponse.json({ error: "guardian_already_linked" }, { status: 409 });
  }

  // Determine system role: first tutor is primary
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM mentoria_guardian_student_links WHERE student_profile_id = ? AND tenant_id = ? AND status != 'removed'")
    .bind(studentId, actor.tenantId)
    .first() as { n: number } | null;
  const systemRole = (countRow?.n ?? 0) === 0 ? "primary_guardian" : "secondary_guardian";

  const linkId = crypto.randomUUID().replace(/-/g, "").slice(0, 21);
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO mentoria_guardian_student_links
        (id, tenant_id, student_profile_id, guardian_email, role, system_role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `)
    .bind(linkId, actor.tenantId, studentId, email, role, systemRole, now, now)
    .run();

  // If a user with this email already exists in the tenant, link guardian_user_id
  const userRow = await db
    .prepare("SELECT id FROM mentoria_users WHERE email = ? AND tenant_id = ?")
    .bind(email, actor.tenantId)
    .first() as { id: string } | null;

  if (userRow) {
    await db
      .prepare("UPDATE mentoria_guardian_student_links SET guardian_user_id = ?, status = 'active', updated_at = ? WHERE id = ? AND tenant_id = ?")
      .bind(userRow.id, now, linkId, actor.tenantId)
      .run();
  }

  return NextResponse.json({ ok: true, linkId, systemRole }, { status: 201 });
}

// DELETE /api/mentoria/mentor-guardians?linkId=xxx
export async function DELETE(req: NextRequest) {
  const actor = await requireCurrentMentoriaSession(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get("linkId");
  if (!linkId) return NextResponse.json({ error: "linkId_required" }, { status: 400 });

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  await db
    .prepare("UPDATE mentoria_guardian_student_links SET status = 'removed', updated_at = ? WHERE id = ? AND tenant_id = ?")
    .bind(new Date().toISOString(), linkId, actor.tenantId)
    .run();

  return NextResponse.json({ ok: true });
}
