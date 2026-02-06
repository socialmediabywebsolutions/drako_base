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

    try {
        const body = await req.json();
        const workerUrl = process.env.AUTOPILOT_WORKER_URL || "http://localhost:8787";

        // Steel Security: Forward with internal secrets
        const response = await fetch(`${workerUrl}/internal/ai/run`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.VERCEL_TO_WORKER_SECRET}`,
                "X-Drako-Origin-Secret": process.env.VERCEL_TO_WORKER_SECRET || "", // Aligning with prompt requirements
                [CORRELATION_HEADER]: correlationId,
                [TENANT_HEADER]: tenantId,
                [SAAS_HEADER]: saasId || "",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}) as any) as any;
            return NextResponse.json({
                ok: false,
                error: (errorData as { error?: string }).error || "AI_WORKER_ERROR",
                correlationId
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("[VERCEL_AI_PROXY_ERROR]", error);
        return NextResponse.json({
            ok: false,
            error: "AI_GATEWAY_UNAVAILABLE",
            correlationId
        }, { status: 503 });
    }
}
