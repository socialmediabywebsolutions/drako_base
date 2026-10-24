export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
    CORRELATION_HEADER,
    TENANT_HEADER,
    SAAS_HEADER
} from "@/lib/correlation";

/**
 * Drako AI Router v1.1 - Vercel Server Proxy
 * 
 * This endpoint is server-only. It retrieves context from session/headers
 * and forwards the request to the Cloudflare Worker AI Router.
 */

export async function POST(req: Request) {
    const correlationId = (await headers()).get(CORRELATION_HEADER) || `vc_${crypto.randomUUID()}`;
    const tenantId = (await headers()).get(TENANT_HEADER) || "system";
    const saasId = (await headers()).get(SAAS_HEADER) || null;
    void req;
    void tenantId;
    void saasId;

    return NextResponse.json({
        ok: false,
        error: "AI_PROXY_DEPRECATED",
        correlationId,
    }, { status: 410 });
}
