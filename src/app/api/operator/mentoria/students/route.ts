export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDb } from "@/lib/mentoria/db";
import { run } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);

    const db = getDb();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // All students across all tenants
    const rows = await db
      .prepare(
        `SELECT
           s.id            AS student_id,
           s.tenant_id,
           s.name,
           s.school_year   AS school_year,
           sub.plan_code   AS plan,
           sub.status      AS sub_status,
           sub.current_period_end AS trial_ends_at,
           (SELECT COUNT(*) FROM mentoria_sessions ms
            WHERE (ms.student_id = s.id OR ms.student_profile_id = s.id)
              AND ms.tenant_id  = s.tenant_id
              AND date(COALESCE(ms.started_at, ms.created_at)) = ?)  AS sessions_today,
           (SELECT MAX(COALESCE(ms2.started_at, ms2.created_at)) FROM mentoria_sessions ms2
            WHERE (ms2.student_id = s.id OR ms2.student_profile_id = s.id)
              AND ms2.tenant_id  = s.tenant_id) AS last_session_at
         FROM mentoria_students s
         LEFT JOIN saas_subscriptions sub
           ON sub.tenant_id = s.tenant_id
          AND sub.saas_slug = 'mentoria'
         ORDER BY last_session_at DESC NULLS LAST
         LIMIT 500`,
      )
      .bind(today)
      .all<{
        student_id: string;
        tenant_id: string;
        name: string;
        school_year: string | null;
        plan: string | null;
        sub_status: string | null;
        trial_ends_at: string | null;
        sessions_today: number;
        last_session_at: string | null;
      }>();

    const students = (rows.results ?? []).map((r) => {
      const trialExpired = r.trial_ends_at && new Date(r.trial_ends_at) < new Date();
      const isPaid       = r.sub_status === "active";
      const isTrial      = r.sub_status === "trial" && !trialExpired;

      let status: "active" | "trial" | "expired" | "inactive" = "inactive";
      if (r.sessions_today > 0) status = "active";
      else if (isTrial)         status = "trial";
      else if (trialExpired && !isPaid) status = "expired";

      return {
        tenantId:      r.tenant_id,
        studentId:     r.student_id,
        name:          r.name,
        plan:          r.plan,
        schoolYear:    r.school_year,
        sessionsToday: r.sessions_today,
        lastSessionAt: r.last_session_at,
        trialEndsAt:   r.sub_status === "trial" ? r.trial_ends_at : null,
        status,
      };
    });

    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), students });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "MENTORIA_STUDENTS_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
