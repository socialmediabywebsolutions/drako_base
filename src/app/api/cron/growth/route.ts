import { NextRequest, NextResponse } from "next/server";
import { runWeeklyGrowthAnalysis } from "@/lib/saas/growth/analyzer";
import { getDb } from "@/lib/db";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";

// This endpoint should be secured via CRON_SECRET or Internal Token
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        verifyCronAuth(req);
    } catch (error) {
        if (error instanceof CronAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Resolve Tenants
    const d1 = getDb();
    if (!d1) {
        return NextResponse.json(
            { ok: false, error: "Database unavailable", timestamp: new Date().toISOString() },
            { status: 503 }
        );
    }

    const { results: tenants } = await d1.prepare("SELECT id FROM tenants").all<{ id: string }>();

    const results = [];

    // 3. Run Analysis per Tenant
    for (const tenant of tenants) {
        try {
            console.log(`[GROWTH_CRON] Analyzing tenant ${tenant.id}`);
            const analysis = await runWeeklyGrowthAnalysis(tenant.id);

            if (analysis) {
                // Log opportunities if any (Opportunity Scout)
                if (analysis.opportunities.length > 0) {
                    console.log(`[GROWTH_SCOUT] Tenant ${tenant.id} has ${analysis.opportunities.length} opportunities.`);
                    // In a real implementation, we would dispatch these to the Notification System / Campamento Base Inbox
                }
                results.push({ tenantId: tenant.id, status: "analyzed", opportunities: analysis.opportunities.length });
            }
        } catch (e) {
            console.error(`[GROWTH_CRON] Failed tenant ${tenant.id}`, e);
            results.push({ tenantId: tenant.id, status: "error", error: String(e) });
        }
    }

    return NextResponse.json({ success: true, results });
}
