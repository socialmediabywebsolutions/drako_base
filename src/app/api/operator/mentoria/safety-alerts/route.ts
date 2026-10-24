export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDb } from "@/lib/mentoria/db";

type SafetyAlertRow = {
  id: string;
  tenant_id: string | null;
  session_id: string;
  student_id: string;
  parent_phone: string;
  level: string;
  category: string;
  message_id: string | null;
  send_status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
};

export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
    const since = url.searchParams.get("since"); // ISO date string — filter from this date
    const pendingReview = url.searchParams.get("pendingReview") === "true";

    const db = getDb();

    let rows: SafetyAlertRow[];
    try {
      const cols = `id, tenant_id, session_id, student_id, parent_phone, level, category, message_id, send_status, created_at,
                    reviewed_at, reviewed_by, review_notes`;
      let where = pendingReview ? "WHERE (reviewed_at IS NULL)" : "";
      if (since) {
        where = where
          ? `${where} AND created_at >= ?`
          : "WHERE created_at >= ?";
      }
      const binds: (string | number)[] = [];
      if (pendingReview && since) { binds.push(since); binds.push(limit); }
      else if (since) { binds.push(since); binds.push(limit); }
      else { binds.push(limit); }

      const query = `SELECT ${cols} FROM mentoria_safety_alerts ${where} ORDER BY created_at DESC LIMIT ?`;
      const stmt = db.prepare(query);
      rows = (await stmt.bind(...binds).all<SafetyAlertRow>()).results;
    } catch {
      // Tabla aún no creada (migración pendiente)
      rows = [];
    }

    const total = rows.length;
    const high = rows.filter((r) => r.level === "high").length;
    const medium = rows.filter((r) => r.level === "medium").length;
    const sent = rows.filter((r) => r.send_status === "success").length;
    const failed = rows.filter((r) => r.send_status === "failed").length;
    const pendingReviewCount = rows.filter((r) => !r.reviewed_at).length;

    return NextResponse.json({
      ok: true,
      summary: { total, high, medium, sent, failed, pendingReview: pendingReviewCount },
      alerts: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        sessionId: r.session_id,
        studentId: r.student_id,
        // parentPhone masked for privacy: last 4 digits only
        parentPhoneMasked: r.parent_phone.length >= 4
          ? `****${r.parent_phone.slice(-4)}`
          : "****",
        level: r.level,
        category: r.category,
        sendStatus: r.send_status,
        messageId: r.message_id,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at ?? null,
        reviewedBy: r.reviewed_by ?? null,
        reviewNotes: r.review_notes ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "SAFETY_ALERTS_FETCH_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
