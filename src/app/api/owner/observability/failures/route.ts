export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";

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

type MetricRow = {
  date: string;
  event_write_failures: number;
  last_failure_at: string;
};

function resolveLimit(url: string): number {
  const parsed = new URL(url);
  const raw = Number(parsed.searchParams.get("limit") ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(200, Math.trunc(raw)));
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const limit = resolveLimit(request.url);

    const failures = await queryAll<FallbackRow>(
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
      limit,
    );

    const metrics = await queryAll<MetricRow>(
      `SELECT date, event_write_failures, last_failure_at
       FROM campamento_observability_metrics
       ORDER BY date DESC
       LIMIT 30`,
    );

    return NextResponse.json({
      ok: true,
      tenantId,
      limit,
      failures: failures.map((item) => ({
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
      metrics: metrics.map((item) => ({
        date: item.date,
        eventWriteFailures: item.event_write_failures,
        lastFailureAt: item.last_failure_at,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, code: error.message, message: error.message },
        { status: error.status },
      );
    }

    console.error("OWNER_OBSERVABILITY_FAILURES_ERROR", error);
    return NextResponse.json(
      { ok: false, code: "OWNER_OBSERVABILITY_FAILURES_ERROR", message: "Failed to load observability failures" },
      { status: 500 },
    );
  }
}
