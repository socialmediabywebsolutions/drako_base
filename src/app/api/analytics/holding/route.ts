import { NextResponse } from "next/server";
import {
    calculateHoldingMetrics,
    saveHoldingSnapshot,
    getLatestHoldingMetrics,
    getHoldingMetricsHistory,
} from "@/lib/campamento-base/analytics/holding-metrics";


/**
 * GET /api/analytics/holding
 * Obtiene métricas consolidadas del holding (último snapshot o calcula nuevo)
 */
export async function GET(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    const url = new URL(request.url);
    const forceRecalculate = url.searchParams.get("recalculate") === "true";
    const includeHistory = url.searchParams.get("history") === "true";
    const historyDays = parseInt(url.searchParams.get("days") || "30", 10);

    try {
        let metrics;

        if (forceRecalculate) {
            // Calcular nuevo
            metrics = await calculateHoldingMetrics(tenantId);
            await saveHoldingSnapshot({ tenantId, metrics });
        } else {
            // Intentar obtener snapshot reciente
            const cached = await getLatestHoldingMetrics(tenantId);

            if (cached) {
                metrics = cached;
            } else {
                // No hay snapshot, calcular
                metrics = await calculateHoldingMetrics(tenantId);
                await saveHoldingSnapshot({ tenantId, metrics });
            }
        }

        const response: Record<string, unknown> = {
            metrics,
            timestamp: new Date().toISOString(),
        };

        // Incluir histórico si se solicita
        if (includeHistory) {
            const history = await getHoldingMetricsHistory({
                tenantId,
                days: historyDays,
            });
            response.history = history;
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error("HOLDING_METRICS_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to calculate holding metrics",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/**
 * POST /api/analytics/holding/snapshot
 * Fuerza creación de snapshot
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        const body = (await request.json().catch(() => ({}))) as { type?: "daily" | "weekly" | "monthly" };
        const snapshotType = body.type || "daily";

        const metrics = await calculateHoldingMetrics(tenantId);
        await saveHoldingSnapshot({ tenantId, metrics, snapshotType });

        return NextResponse.json({
            success: true,
            metrics,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("HOLDING_SNAPSHOT_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to create snapshot",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
