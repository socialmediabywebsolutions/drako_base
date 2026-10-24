export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDb } from "@/lib/mentoria/db";

export async function POST(request: Request) {
  try {
    const actor = await requireOwnerAccess(request);

    const body = (await request.json()) as {
      alertId?: string;
      notes?: string | null;
    };

    const alertId = body.alertId?.trim();
    if (!alertId) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    const db = getDb();
    const reviewedAt = new Date().toISOString();
    const reviewedBy = (actor as { email?: string }).email ?? "operator";

    let result;
    try {
      result = await db
        .prepare(
          `UPDATE mentoria_safety_alerts
           SET reviewed_at = ?, reviewed_by = ?, review_notes = ?
           WHERE id = ?`
        )
        .bind(reviewedAt, reviewedBy, body.notes?.trim() || null, alertId)
        .run();
    } catch {
      // Column may not exist yet if migration is pending
      return NextResponse.json({ ok: false, error: "MIGRATION_PENDING" }, { status: 503 });
    }

    const meta = result.meta as { changes?: number } | undefined;
    if (!result.success || (meta?.changes ?? 0) === 0) {
      return NextResponse.json({ ok: false, error: "ALERT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, alertId, reviewedAt, reviewedBy });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "REVIEW_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
