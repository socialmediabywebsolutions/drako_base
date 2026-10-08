export const dynamic = "force-dynamic";
// Mensajes del mentor hacia la familia de un alumno (unidireccional: mentor → familia)

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export type FamilyMessageItem = {
  id: string;
  studentId: string;
  senderName: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  messageType: string;
  status: string;
  createdAt: string;
  readAt: string | null;
};

// GET /api/mentoria/mentor-family-messages?studentId=xxx
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
        fm.id,
        fm.student_id,
        fm.recipient_email,
        fm.subject,
        fm.body,
        fm.message_type,
        fm.status,
        fm.created_at,
        fm.read_at,
        mu.full_name AS sender_name
      FROM mentoria_family_messages fm
      LEFT JOIN mentoria_users mu ON mu.id = fm.sender_id AND mu.tenant_id = fm.tenant_id
      WHERE fm.student_id = ? AND fm.tenant_id = ?
      ORDER BY fm.created_at DESC
      LIMIT 50
    `)
    .bind(studentId, actor.tenantId)
    .all() as { results?: Record<string, unknown>[] };

  const messages: FamilyMessageItem[] = (rows.results ?? []).map((r) => ({
    id: String(r.id),
    studentId: String(r.student_id),
    senderName: r.sender_name ? String(r.sender_name) : null,
    recipientEmail: String(r.recipient_email),
    subject: String(r.subject),
    body: String(r.body),
    messageType: String(r.message_type ?? "general"),
    status: String(r.status ?? "sent"),
    createdAt: String(r.created_at),
    readAt: r.read_at ? String(r.read_at) : null,
  }));

  return NextResponse.json({ messages });
}

// POST /api/mentoria/mentor-family-messages — enviar mensaje a un familiar
export async function POST(req: NextRequest) {
  const actor = await requireCurrentMentoriaSession(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    studentId?: string;
    recipientEmail?: string;
    subject?: string;
    body?: string;
    messageType?: string;
  } | null;

  const studentId = body?.studentId;
  const recipientEmail = body?.recipientEmail?.trim().toLowerCase();
  const subject = body?.subject?.trim();
  const messageBody = body?.body?.trim();
  const messageType = (body?.messageType ?? "general") as string;

  if (!studentId || !recipientEmail || !subject || !messageBody) {
    return NextResponse.json({ error: "all_fields_required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (subject.length > 200) {
    return NextResponse.json({ error: "subject_too_long" }, { status: 400 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  // Verify student belongs to tenant
  const profileRow = await db
    .prepare("SELECT id FROM mentoria_student_profiles WHERE id = ? AND tenant_id = ?")
    .bind(studentId, actor.tenantId)
    .first() as Record<string, unknown> | null;
  if (!profileRow) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  const msgId = crypto.randomUUID().replace(/-/g, "").slice(0, 21);
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO mentoria_family_messages
        (id, tenant_id, student_id, sender_id, recipient_email, subject, body, message_type, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?)
    `)
    .bind(msgId, actor.tenantId, studentId, actor.userId, recipientEmail, subject, messageBody, messageType, now)
    .run();

  return NextResponse.json({ ok: true, messageId: msgId }, { status: 201 });
}
