export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDb } from "@/lib/mentoria/db";
import { run } from "@/lib/db";

type FamilyRow = {
  tenant_id: string;
  family_id: string;
  parent_name: string;
  parent_email: string;
  student_count: number;
  plan: string | null;
  created_at: string;
  trial_ends_at: string | null;
};

export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);

    // Families from saas_subscriptions (shared DB) with mentoria plan
    const subRows = await run(
      `SELECT tenant_id, plan_code, status, current_period_end AS trial_ends_at, created_at
       FROM saas_subscriptions
       WHERE saas_slug = 'mentoria'
       ORDER BY created_at DESC
       LIMIT 200`,
    ) as unknown as { tenant_id: string; plan_code: string | null; status: string; trial_ends_at: string | null; created_at: string }[];

    const db = getDb();

    // Pull family profiles from mentoria DB for each tenant
    const families: FamilyRow[] = [];
    for (const sub of subRows) {
      try {
        const profile = await db
          .prepare(
            `SELECT g.id AS family_id, g.name AS parent_name, g.email AS parent_email,
                    (SELECT COUNT(*) FROM mentoria_students s WHERE s.family_id = g.id) AS student_count
             FROM mentoria_guardians g
             WHERE g.tenant_id = ?
             ORDER BY g.created_at ASC
             LIMIT 1`,
          )
          .bind(sub.tenant_id)
          .first<{ family_id: string; parent_name: string; parent_email: string; student_count: number }>();

        families.push({
          tenant_id:      sub.tenant_id,
          family_id:      profile?.family_id ?? sub.tenant_id,
          parent_name:    profile?.parent_name ?? "—",
          parent_email:   profile?.parent_email ?? "—",
          student_count:  profile?.student_count ?? 0,
          plan:           sub.plan_code,
          created_at:     sub.created_at,
          trial_ends_at:  sub.status === "trial" ? sub.trial_ends_at : null,
        });
      } catch {
        // Tenant exists in billing but DB not seeded yet — include with minimal data
        families.push({
          tenant_id:     sub.tenant_id,
          family_id:     sub.tenant_id,
          parent_name:   "—",
          parent_email:  "—",
          student_count: 0,
          plan:          sub.plan_code,
          created_at:    sub.created_at,
          trial_ends_at: sub.status === "trial" ? sub.trial_ends_at : null,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      families: families.map((f) => ({
        tenantId:     f.tenant_id,
        familyId:     f.family_id,
        parentName:   f.parent_name,
        parentEmail:  f.parent_email,
        studentCount: f.student_count,
        plan:         f.plan,
        createdAt:    f.created_at,
        trialEndsAt:  f.trial_ends_at,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "MENTORIA_FAMILIES_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
