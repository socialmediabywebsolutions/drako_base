import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const REVENUE_ACTIVE_STATUSES = new Set(["active", "trial", "trialing"]);
const REVENUE_AT_RISK_STATUSES = new Set(["past_due"]);

export async function GET(req: Request) {
    try {
        // 1. Authorize (Owner Only / fail-closed)
        await requireOwnerAccess(req);

        // 2. Aggregate revenue from verified canonical product subscriptions only.
        const stats = await queryAll(`
            WITH canonical_revenue_rows AS (
                SELECT
                    s.tenant_id,
                    s.saas_slug,
                    lower(trim(s.status)) AS status,
                    s.plan_code
                FROM saas_subscriptions s
                WHERE s.stripe_customer_id IS NOT NULL
                  AND s.stripe_subscription_id IS NOT NULL
            )
            SELECT
                c.saas_slug,
                c.status,
                COUNT(*) AS count,
                SUM(
                    CASE
                        WHEN c.status IN ('active', 'trial', 'trialing', 'past_due')
                            THEN COALESCE(p.monthly_price_cents, 0)
                        ELSE 0
                    END
                ) AS mrr_cents
            FROM canonical_revenue_rows c
            LEFT JOIN saas_pricing_plans p
              ON c.saas_slug = p.saas_slug
             AND c.plan_code = p.plan_code
             AND p.is_active = 1
            GROUP BY c.saas_slug, c.status
        `);

        // 3. Transform to clean JSON
        const dashboard = {
            global_mrr_cents: 0,
            global_active_tenants: 0,
            global_churn_rate: 0,
            breakdown: {} as Record<string, any>
        };

        // Aggregation Logic
        const totals = { active: 0, canceled: 0, past_due: 0 };

        stats.forEach((row: any) => {
            if (!dashboard.breakdown[row.saas_slug]) {
                dashboard.breakdown[row.saas_slug] = {
                    total_tenants: 0,
                    active_tenants: 0,
                    mrr_cents: 0,
                    past_due_count: 0,
                    churn_rate: 0,
                    status_breakdown: {}
                };
            }
            const saas = dashboard.breakdown[row.saas_slug];
            const count = row.count as number;

            // Status Counters
            saas.status_breakdown[row.status] = count;
            saas.total_tenants += count;

            if (REVENUE_ACTIVE_STATUSES.has(row.status)) {
                saas.active_tenants += count;
                saas.mrr_cents += (row.mrr_cents || 0);

                dashboard.global_active_tenants += count;
                dashboard.global_mrr_cents += (row.mrr_cents || 0);
                totals.active += count;
            } else if (REVENUE_AT_RISK_STATUSES.has(row.status)) {
                saas.past_due_count += count;
                saas.mrr_cents += (row.mrr_cents || 0); // Count Potential MRR? Usually recognized but risky.

                dashboard.global_active_tenants += count; // Still technically active service? Or restricted?
                dashboard.global_mrr_cents += (row.mrr_cents || 0);
                totals.past_due += count;
            } else if (row.status === 'canceled') {
                totals.canceled += count;
            }
        });

        // 4. Calculate Churn (Naive: Canceled / (Active + Canceled))
        // Per SaaS
        for (const slug in dashboard.breakdown) {
            const saas = dashboard.breakdown[slug];
            const active = saas.active_tenants + saas.past_due_count;
            const canceled = saas.status_breakdown['canceled'] || 0;
            const total = active + canceled;
            saas.churn_rate = total > 0 ? (canceled / total) : 0;
        }

        // Global Churn
        const totalConsidered = totals.active + totals.past_due + totals.canceled;
        dashboard.global_churn_rate = totalConsidered > 0 ? (totals.canceled / totalConsidered) : 0;

        return NextResponse.json({
            ok: true,
            data: dashboard,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
