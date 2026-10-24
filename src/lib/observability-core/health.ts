import { queryAll, queryOne, run } from "@/lib/db";
import { generateId, nowIso } from "@/lib/observability-core/shared";
import {
  ObservabilityCoreError,
  type CaptureHealthSnapshotInput,
  type ObservabilityHealthSnapshot,
} from "@/lib/observability-core/types";

type HealthSnapshotRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  scope_type: string;
  scope_key: string;
  health_status: string;
  freshness_status: string;
  last_activity_at: string | null;
  open_incidents_count: number;
  summary: string;
  captured_at: string;
};

function mapHealthSnapshot(row: HealthSnapshotRow): ObservabilityHealthSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    scopeType: row.scope_type as ObservabilityHealthSnapshot["scopeType"],
    scopeKey: row.scope_key,
    healthStatus: row.health_status as ObservabilityHealthSnapshot["healthStatus"],
    freshnessStatus: row.freshness_status as ObservabilityHealthSnapshot["freshnessStatus"],
    lastActivityAt: row.last_activity_at ?? null,
    openIncidentsCount: row.open_incidents_count,
    summary: row.summary,
    capturedAt: row.captured_at,
  };
}

function validateSnapshotInput(input: CaptureHealthSnapshotInput) {
  if (!input.tenantId?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_TENANT_REQUIRED");
  if (!input.saasId?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SAAS_REQUIRED");
  if (!input.scopeKey?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SCOPE_KEY_REQUIRED");
  if (!input.summary?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SUMMARY_REQUIRED");
}

export async function captureHealthSnapshot(
  input: CaptureHealthSnapshotInput,
): Promise<ObservabilityHealthSnapshot> {
  validateSnapshotInput(input);
  const capturedAt = nowIso();
  const id = generateId("health");
  await run(
    `INSERT INTO drako_observability_health_snapshots (
      id, tenant_id, saas_id, scope_type, scope_key, health_status, freshness_status, last_activity_at, open_incidents_count, summary, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.tenantId.trim(),
    input.saasId.trim(),
    input.scopeType,
    input.scopeKey.trim(),
    input.healthStatus,
    input.freshnessStatus,
    input.lastActivityAt ?? null,
    input.openIncidentsCount,
    input.summary.trim(),
    capturedAt,
  );

  return {
    id,
    tenantId: input.tenantId.trim(),
    saasId: input.saasId.trim(),
    scopeType: input.scopeType,
    scopeKey: input.scopeKey.trim(),
    healthStatus: input.healthStatus,
    freshnessStatus: input.freshnessStatus,
    lastActivityAt: input.lastActivityAt ?? null,
    openIncidentsCount: input.openIncidentsCount,
    summary: input.summary.trim(),
    capturedAt,
  };
}

export async function getLatestHealthSnapshot(filters: {
  tenantId: string;
  saasId: string;
  scopeType?: string | null;
  scopeKey?: string | null;
}): Promise<ObservabilityHealthSnapshot | null> {
  const clauses = ["tenant_id = ?", "saas_id = ?"];
  const params: unknown[] = [filters.tenantId, filters.saasId];

  if (filters.scopeType) {
    clauses.push("scope_type = ?");
    params.push(filters.scopeType);
  }
  if (filters.scopeKey) {
    clauses.push("scope_key = ?");
    params.push(filters.scopeKey);
  }

  const row = await queryOne<HealthSnapshotRow>(
    `SELECT id, tenant_id, saas_id, scope_type, scope_key, health_status, freshness_status, last_activity_at, open_incidents_count, summary, captured_at
     FROM drako_observability_health_snapshots
     WHERE ${clauses.join(" AND ")}
     ORDER BY datetime(captured_at) DESC
     LIMIT 1`,
    ...params,
  );

  return row ? mapHealthSnapshot(row) : null;
}

export async function listHealthSnapshots(filters: {
  tenantId?: string | null;
  saasId?: string | null;
  limit?: number;
} = {}): Promise<ObservabilityHealthSnapshot[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.tenantId) {
    clauses.push("tenant_id = ?");
    params.push(filters.tenantId);
  }
  if (filters.saasId) {
    clauses.push("saas_id = ?");
    params.push(filters.saasId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const rows = await queryAll<HealthSnapshotRow>(
    `SELECT id, tenant_id, saas_id, scope_type, scope_key, health_status, freshness_status, last_activity_at, open_incidents_count, summary, captured_at
     FROM drako_observability_health_snapshots
     ${where}
     ORDER BY datetime(captured_at) DESC
     LIMIT ?`,
    ...params,
    limit,
  );

  return rows.map(mapHealthSnapshot);
}
