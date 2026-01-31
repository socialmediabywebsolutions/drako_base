import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { getCloudflareEnv } from "@/lib/cloudflare/context";

/**
 * GET /api/owner/support/tickets
 * Fetch all non-closed support tickets for owner review
 */
export async function GET(request: Request): Promise<Response> {
    try {
        const { tenantId } = await requireTenantAccess(request);
        const db = getCloudflareEnv().DB;

        const { results } = await db
            .prepare(
                `SELECT id, saas_id, title, description, status, priority, created_at, updated_at
         FROM tickets
         WHERE status != 'CLOSED'
         ORDER BY priority DESC, created_at DESC
         LIMIT 50`
            )
            .all();

        return NextResponse.json({ tickets: results });
    } catch (error) {
        console.error("Tickets fetch error:", error);
        return NextResponse.json(
            { error: "Failed to fetch tickets" },
            { status: 500 }
        );
    }
}
