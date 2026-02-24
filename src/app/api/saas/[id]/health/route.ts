export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
    calculateHealthScore,
    saveHealthScore,
    getLatestHealthScore,
} from "@/lib/campamento-base/health-score/calculator";



/**
 * GET /api/saas/[id]/health
 * Obtiene el health score de un SaaS (último calculado o calcula nuevo)
 */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const saasId = params.id;
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        // Intentar obtener último score
        const cached = await getLatestHealthScore({ saasId, tenantId });

        if (cached) {
            const cacheAge = Date.now() - new Date(cached.metrics.mrr).getTime();
            const maxAge = 24 * 60 * 60 * 1000; // 24 horas

            if (cacheAge < maxAge) {
                return NextResponse.json({
                    ...cached,
                    cached: true,
                    calculatedAt: new Date(Date.now() - cacheAge).toISOString(),
                });
            }
        }

        // Calcular nuevo score
        const result = await calculateHealthScore({ saasId, tenantId });

        // Guardar en DB
        await saveHealthScore({ saasId, tenantId, result });

        return NextResponse.json({
            ...result,
            cached: false,
            calculatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("HEALTH_SCORE_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to calculate health score",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/**
 * POST /api/saas/[id]/health
 * Fuerza recálculo del health score
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const saasId = params.id;
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        const result = await calculateHealthScore({ saasId, tenantId });
        await saveHealthScore({ saasId, tenantId, result });

        return NextResponse.json({
            ...result,
            cached: false,
            calculatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("HEALTH_SCORE_RECALC_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to recalculate health score",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
