export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";

type MetricRow = {
  date: string;
  event_write_failures: number;
  last_failure_at: string;
};

type FallbackRow = {
  id: string;
  created_at: string;
  correlation_id: string;
  tenant_id: string;
  job_id: string;
  step: string;
  severity: string;
  message: string;
  error_message: string;
};

const DEFAULT_LATEST_LIMIT = 20;
const MAX_LATEST_LIMIT = 100;
const RECENT_WINDOW_DAYS = 7;
const RECENT_FAILURE_THRESHOLD = 5;

function resolveLatestLimit(url: string): number {
  const parsed = new URL(url);
  const raw = Number(parsed.searchParams.get("limit") ?? String(DEFAULT_LATEST_LIMIT));
  if (!Number.isFinite(raw)) return DEFAULT_LATEST_LIMIT;
  return Math.max(1, Math.min(MAX_LATEST_LIMIT, Math.trunc(raw)));
}

function sumFailures(rows: MetricRow[]): number {
  return rows.reduce((total, row) => total + (Number(row.event_write_failures) || 0), 0);
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const latestLimit = resolveLatestLimit(request.url);

    const metrics = await queryAll<MetricRow>(
      `SELECT date, event_write_failures, last_failure_at
       FROM campamento_observability_metrics
       ORDER BY date DESC
       LIMIT 30`,
    );

    const latestFallbacks = await queryAll<FallbackRow>(
      `SELECT id,
              created_at,
              correlation_id,
              tenant_id,
              job_id,
              step,
              severity,
              message,
              error_message
       FROM campamento_event_fallbacks
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      tenantId,
      latestLimit,
    );

    const fallbackFailuresLast30Days = sumFailures(metrics);
    const recentWindowRows = metrics.slice(0, RECENT_WINDOW_DAYS);
    const recentFailures = sumFailures(recentWindowRows);
    const degraded = recentFailures > RECENT_FAILURE_THRESHOLD;

    return NextResponse.json({
      ok: true,
      tenantId,
      fallbackFailuresLast30Days,
      degraded,
      slo: {
        recentWindowDays: RECENT_WINDOW_DAYS,
        recentFailureThreshold: RECENT_FAILURE_THRESHOLD,
        recentFailures,
      },
      latestFallbacks: latestFallbacks.map((item) => ({
        id: item.id,
        createdAt: item.created_at,
        correlationId: item.correlation_id,
        tenantId: item.tenant_id,
        jobId: item.job_id,
        step: item.step,
        severity: item.severity,
        message: item.message,
        errorMessage: item.error_message,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, code: error.message, message: error.message },
        { status: error.status },
      );
    }

    console.error("OWNER_OBSERVABILITY_HEALTH_ERROR", error);
    return NextResponse.json(
      { ok: false, code: "OWNER_OBSERVABILITY_HEALTH_ERROR", message: "Failed to load observability health" },
      { status: 500 },
    );
  }
}
