import { queryAll, run } from "@/lib/db";
import { recordCampamentoEvent } from "@/lib/empire/events";

type RollupRow = {
  day: string;
  tenant_id: string;
  saas_slug: string | null;
  type: string;
  severity: string;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
};

type CountRow = { count: number };

function resolveRetentionDays(envOverride?: Record<string, string | undefined>): number {
  const raw = envOverride?.DRACO_EVENTS_RETENTION_DAYS ?? process.env.DRACO_EVENTS_RETENTION_DAYS ?? "30";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function resolveCriticalRetentionDays(envOverride?: Record<string, string | undefined>): number {
  const raw =
    envOverride?.DRACO_EVENTS_CRITICAL_RETENTION_DAYS ??
    process.env.DRACO_EVENTS_CRITICAL_RETENTION_DAYS ??
    "90";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDaysAgo(date: Date, days: number): string {
  const target = new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  return target.toISOString();
}

function generateCorrelationId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now()}`;
}

async function recordObservabilityEvent(params: {
  tenantId: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await recordCampamentoEvent({
    tenantId: params.tenantId,
    type: params.type,
    severity: "INFO",
    source: "OBSERVABILITY",
    message: params.message,
    metadata: params.metadata,
    correlationId: generateCorrelationId("obs"),
  });
}

export async function runEventsRollupAndRetention(params: {
  tenantId: string;
  now?: Date;
  envOverride?: Record<string, string | undefined>;
}): Promise<{
  rollupCount: number;
  purgedCount: number;
  purgedCriticalCount: number;
  retentionDays: number;
  criticalRetentionDays: number;
}> {
  const now = params.now ?? new Date();
  const retentionDays = resolveRetentionDays(params.envOverride);
  const criticalRetentionDays = resolveCriticalRetentionDays(params.envOverride);
  const rollupBefore = startOfUtcDay(now).toISOString();

  const rollups = await queryAll<RollupRow>(
    `SELECT substr(e.created_at, 1, 10) AS day,
            e.tenant_id AS tenant_id,
            s.slug AS saas_slug,
            e.type AS type,
            e.severity AS severity,
            COUNT(*) AS count,
            MIN(e.created_at) AS first_seen_at,
            MAX(e.created_at) AS last_seen_at
     FROM campamento_events e
     LEFT JOIN saas s ON s.id = e.saas_id AND s.tenant_id = e.tenant_id
     WHERE e.tenant_id = ? AND e.created_at < ?
     GROUP BY day, e.tenant_id, s.slug, e.type, e.severity`,
    params.tenantId,
    rollupBefore,
  );

  for (const row of rollups) {
    await run(
      `INSERT INTO campamento_event_rollups_daily (day, tenant_id, saas_slug, type, severity, count, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, tenant_id, saas_slug, type, severity) DO UPDATE SET
         count = excluded.count,
         first_seen_at = CASE
           WHEN excluded.first_seen_at < campamento_event_rollups_daily.first_seen_at THEN excluded.first_seen_at
           ELSE campamento_event_rollups_daily.first_seen_at
         END,
         last_seen_at = CASE
           WHEN excluded.last_seen_at > campamento_event_rollups_daily.last_seen_at THEN excluded.last_seen_at
           ELSE campamento_event_rollups_daily.last_seen_at
         END`,
      row.day,
      row.tenant_id,
      row.saas_slug,
      row.type,
      row.severity,
      row.count,
      row.first_seen_at,
      row.last_seen_at,
    );
  }

  const retentionCutoff = isoDaysAgo(now, retentionDays);
  const criticalCutoff = isoDaysAgo(now, criticalRetentionDays);

  const generalCountRows = await queryAll<CountRow>(
    `SELECT COUNT(*) AS count
     FROM campamento_events
     WHERE tenant_id = ?
       AND created_at < ?
       AND (severity != 'CRITICAL' AND type NOT LIKE 'security.%')`,
    params.tenantId,
    retentionCutoff,
  );
  const generalCount = generalCountRows[0]?.count ?? 0;

  if (generalCount > 0) {
    await run(
      `DELETE FROM campamento_events
       WHERE tenant_id = ?
         AND created_at < ?
         AND (severity != 'CRITICAL' AND type NOT LIKE 'security.%')`,
      params.tenantId,
      retentionCutoff,
    );
  }

  const criticalCountRows = await queryAll<CountRow>(
    `SELECT COUNT(*) AS count
     FROM campamento_events
     WHERE tenant_id = ?
       AND created_at < ?
       AND (severity = 'CRITICAL' OR type LIKE 'security.%')`,
    params.tenantId,
    criticalCutoff,
  );
  const criticalCount = criticalCountRows[0]?.count ?? 0;

  if (criticalCount > 0) {
    await run(
      `DELETE FROM campamento_events
       WHERE tenant_id = ?
         AND created_at < ?
         AND (severity = 'CRITICAL' OR type LIKE 'security.%')`,
      params.tenantId,
      criticalCutoff,
    );
  }

  await recordObservabilityEvent({
    tenantId: params.tenantId,
    type: "observability.rollup.completed",
    message: "Rollup diario de eventos completado.",
    metadata: { rollupCount: rollups.length, rollupBefore },
  });

  if (generalCount > 0 || criticalCount > 0) {
    await recordObservabilityEvent({
      tenantId: params.tenantId,
      type: "observability.retention.purged",
      message: "Retencion de eventos aplicada.",
      metadata: {
        purgedCount: generalCount,
        purgedCriticalCount: criticalCount,
        retentionDays,
        criticalRetentionDays,
      },
    });
  }

  return {
    rollupCount: rollups.length,
    purgedCount: generalCount,
    purgedCriticalCount: criticalCount,
    retentionDays,
    criticalRetentionDays,
  };
}
