export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDb } from "@/lib/mentoria/db";

export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);

    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [todayRow, weekRow, completedRow] = await Promise.all([
      db.prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_now,
           AVG(CASE WHEN duration_minutes IS NOT NULL THEN duration_minutes END) AS avg_duration
         FROM mentoria_sessions
         WHERE date(started_at) = ?`,
      ).bind(today).first<{ total: number; active_now: number; avg_duration: number | null }>(),

      db.prepare(
        `SELECT COUNT(*) AS total FROM mentoria_sessions WHERE started_at >= ?`,
      ).bind(weekAgo).first<{ total: number }>(),

      db.prepare(
        `SELECT
           COUNT(*) AS completed,
           (SELECT COUNT(*) FROM mentoria_sessions WHERE date(started_at) = ?) AS all_today
         FROM mentoria_sessions
         WHERE date(started_at) = ?
           AND status = 'completed'`,
      ).bind(today, today).first<{ completed: number; all_today: number }>(),
    ]);

    const allToday  = todayRow?.total ?? 0;
    const completed = completedRow?.completed ?? 0;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        sessionsToday:      allToday,
        sessionsThisWeek:   weekRow?.total ?? 0,
        activeNow:          todayRow?.active_now ?? 0,
        avgDurationMinutes: Math.round(todayRow?.avg_duration ?? 0),
        completionRate:     allToday > 0 ? completed / allToday : 0,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "MENTORIA_SESSION_METRICS_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
