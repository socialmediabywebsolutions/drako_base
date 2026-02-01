import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getCloudflareEnv } from "@/lib/cloudflare/context";

// export const runtime = "edge"; // OpenNext: disabled for bundling

export async function GET(request: Request) {
    try {
        const { tenantId } = await requireTenantAccess(request);
        const db = getCloudflareEnv().DB;

        // Fetch open incidents
        const { results } = await db.prepare("SELECT * FROM tech_incidents WHERE status != 'RESOLVED' ORDER BY severity = 'CRITICAL' DESC, created_at DESC").all();

        return NextResponse.json({ incidents: results });

    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        console.error("OWNER_TECH_INCIDENTS_GET_ERROR", error);
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}
