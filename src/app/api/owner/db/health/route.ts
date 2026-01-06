import { NextResponse } from "next/server";
import { UnauthorizedError, requireTenantAccess } from "@/lib/auth/session";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { getDbHealthSnapshot } from "@/lib/db/health";
import { createOrMergeActionFromWebhook } from "@/lib/owner/action-queue-repository";
export const runtime = "edge";


function resolveCorrelationId(request: Request): string {
  return (
    request.headers.get("x-drako-correlation-id") ||
    request.headers.get("x-request-id") ||
    globalThis.crypto?.randomUUID?.() ||
    `corr_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  );
}

export async function GET(request: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (session.role !== "admin") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Admin role required" }, { status: 403 });
    }

    const correlationId = resolveCorrelationId(request);
    const snapshot = await getDbHealthSnapshot();

    if (snapshot.missingMigrations.length > 0) {
      await recordCampamentoEvent({
        tenantId,
        type: "db.migrations.missing_detected",
        severity: "CRITICAL",
        source: "DB_HEALTH",
        message: "Missing migrations detected.",
        metadata: { missingCount: snapshot.missingMigrations.length, missing: snapshot.missingMigrations.slice(0, 10) },
        correlationId,
      });
      await createOrMergeActionFromWebhook({
        tenantId,
        category: "RISK",
        priority: "CRITICAL",
        title: "DB migrations missing",
        description: "D1 is missing required migrations. Apply pending migrations before running production workloads.",
        source: "db-health",
        actionKey: "db:migrations:missing",
        metadata: { missing: snapshot.missingMigrations },
        correlationId,
      });
    }

    if (snapshot.driftFindings.length > 0) {
      await recordCampamentoEvent({
        tenantId,
        type: "db.schema.drift_detected",
        severity: snapshot.driftFindings.some((finding) => finding.severity === "CRITICAL") ? "CRITICAL" : "WARNING",
        source: "DB_HEALTH",
        message: "Schema drift detected.",
        metadata: { driftCount: snapshot.driftFindings.length },
        correlationId,
      });
      for (const finding of snapshot.driftFindings.slice(0, 10)) {
        await createOrMergeActionFromWebhook({
          tenantId,
          category: "RISK",
          priority: finding.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
          title: `DB drift: ${finding.table}`,
          description: finding.message,
          source: "db-health",
          actionKey: `db:drift:${finding.table}`,
          metadata: { table: finding.table, column: finding.column ?? null },
          correlationId,
        });
      }
    }

    if (snapshot.missingMigrations.length === 0 && snapshot.driftFindings.length === 0) {
      await recordCampamentoEvent({
        tenantId,
        type: "db.health.ok",
        severity: "INFO",
        source: "DB_HEALTH",
        message: "DB health OK.",
        metadata: { appliedCount: snapshot.appliedMigrations.count },
        correlationId,
      });
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("DB_HEALTH_ERROR", error);
    return NextResponse.json({ code: "DB_HEALTH_ERROR", message: "No se pudo revisar DB health" }, { status: 500 });
  }
}
