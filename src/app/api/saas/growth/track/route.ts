import { NextRequest, NextResponse } from "next/server";
import { trackGrowthEvent } from "@/lib/saas/growth/ingest";

// Force dynamic to ensure we can read headers/body
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        // 1. Auth / Tenant resolution
        // In a real factory, we would validate a Session Cookie or an Internal Service Token.
        // For V1, we assume the request comes from an authenticated context or internal service.
        // We expect 'x-tenant-id' header or body param for explicit multi-tenancy if internal.
        // If coming from client-side, we would read the session.

        // Simplification for V1: Read tenant_id from header (Internal/Gateway) or Body
        const body = (await req.json()) as any;
        const tenantId = req.headers.get("x-tenant-id") || body.tenantId;

        if (!tenantId) {
            return NextResponse.json({ error: "Missing tenant_id" }, { status: 400 });
        }

        // 2. Track Event
        const result = await trackGrowthEvent({
            tenantId,
            eventName: body.eventName,
            saasId: body.saasId, // Optional
            userId: body.userId, // Optional
            country: body.country,
            conversionSource: body.conversionSource,
            payload: body.payload
        });

        return NextResponse.json({ success: true, eventId: result.eventId });

    } catch (error: any) {
        console.error("[GROWTH_API] Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
