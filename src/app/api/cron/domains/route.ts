export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase, queryAll } from "@/lib/db";
import { verifyAndActivate } from "@/lib/domains/domain-service";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";


export async function GET(req: Request) {
    try {
        ensureDatabase();
        verifyCronAuth(req);

        // 1. Find pending domains
        const rows = await queryAll<{ id: string; tenant_id: string; domain_status: string }>(
            "SELECT id, tenant_id, domain_status FROM saas_instances WHERE domain_status IN ('pending', 'verifying', 'pending_manual') LIMIT 25"
        );

        const results = [];
        for (const row of rows) {
            try {
                const res = await verifyAndActivate(row.tenant_id, row.id);
                results.push({ id: row.id, status: res.newStatus, msg: res.message });
            } catch (e: any) {
                results.push({ id: row.id, error: e.message });
            }
        }

        return NextResponse.json({ ok: true, processed: results.length, detail: results });

    } catch (error: any) {
        if (error instanceof CronAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
