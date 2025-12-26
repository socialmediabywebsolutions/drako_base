import { queryAll, run } from "@/lib/db";
import { recordCampamentoEvent } from "@/lib/empire/events";

type CountRow = { count: number };

function resolveHistoryRetentionDays(envOverride?: Record<string, string | undefined>): number {
  const raw = envOverride?.DRACO_ACTIONS_HISTORY_RETENTION_DAYS ?? process.env.DRACO_ACTIONS_HISTORY_RETENTION_DAYS ?? "60";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

function isoDaysAgo(date: Date, days: number): string {
  const target = new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  return target.toISOString();
}

function generateCorrelationId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now()}`;
}

export async function runActionQueueRetention(params: {
  tenantId: string;
  now?: Date;
  envOverride?: Record<string, string | undefined>;
}): Promise<{ purged: number; retentionDays: number }> {
  const now = params.now ?? new Date();
  const retentionDays = resolveHistoryRetentionDays(params.envOverride);
  const cutoff = isoDaysAgo(now, retentionDays);
  const countRows = await queryAll<CountRow>(
    `SELECT COUNT(*) AS count
     FROM campamento_actions
     WHERE tenant_id = ?
       AND status IN ('EXECUTED', 'DISMISSED', 'SNOOZED')
       AND updated_at < ?`,
    params.tenantId,
    cutoff,
  );
  const count = countRows[0]?.count ?? 0;
  if (count > 0) {
    await run(
      `DELETE FROM campamento_actions
       WHERE tenant_id = ?
         AND status IN ('EXECUTED', 'DISMISSED', 'SNOOZED')
         AND updated_at < ?`,
      params.tenantId,
      cutoff,
    );
  }

  await recordCampamentoEvent({
    tenantId: params.tenantId,
    type: "action_queue.retention.purged",
    severity: "INFO",
    source: "ACTION_QUEUE",
    message: "Retencion de historial Action Queue aplicada.",
    metadata: { purged: count, retentionDays },
    correlationId: generateCorrelationId("aq"),
  });

  return { purged: count, retentionDays };
}
