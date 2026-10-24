import { queryAll, run } from "@/lib/db";
import { generateId, nowIso, parseJsonObject, stringifyJson } from "@/lib/observability-core/shared";
import {
  ObservabilityCoreError,
  type ObservabilityActivity,
  type RecordObservabilityActivityInput,
} from "@/lib/observability-core/types";

type ActivityRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  source_type: string;
  source_key: string;
  activity_type: string;
  status: string;
  summary: string;
  metadata_json: string | null;
  created_at: string;
};

function mapActivity(row: ActivityRow): ObservabilityActivity {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    sourceType: row.source_type as ObservabilityActivity["sourceType"],
    sourceKey: row.source_key,
    activityType: row.activity_type,
    status: row.status as ObservabilityActivity["status"],
    summary: row.summary,
    metadata: parseJsonObject(row.metadata_json, null),
    createdAt: row.created_at,
  };
}

function validateInput(input: RecordObservabilityActivityInput) {
  if (!input.tenantId?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_TENANT_REQUIRED");
  if (!input.saasId?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SAAS_REQUIRED");
  if (!input.sourceKey?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SOURCE_KEY_REQUIRED");
  if (!input.activityType?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_ACTIVITY_TYPE_REQUIRED");
  if (!input.summary?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SUMMARY_REQUIRED");
}

export async function recordObservabilityActivity(
  input: RecordObservabilityActivityInput,
): Promise<ObservabilityActivity> {
  validateInput(input);
  const now = nowIso();
  const id = generateId("activity");
  await run(
    `INSERT INTO drako_observability_activities (
      id, tenant_id, saas_id, source_type, source_key, activity_type, status, summary, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.tenantId.trim(),
    input.saasId.trim(),
    input.sourceType,
    input.sourceKey.trim(),
    input.activityType.trim(),
    input.status,
    input.summary.trim(),
    stringifyJson(input.metadata ?? null),
    now,
  );

  return {
    id,
    tenantId: input.tenantId.trim(),
    saasId: input.saasId.trim(),
    sourceType: input.sourceType,
    sourceKey: input.sourceKey.trim(),
    activityType: input.activityType.trim(),
    status: input.status,
    summary: input.summary.trim(),
    metadata: input.metadata ?? null,
    createdAt: now,
  };
}

export async function listObservabilityActivities(filters?: {
  tenantId?: string | null;
  saasId?: string | null;
  sourceType?: string | null;
  sourceKey?: string | null;
  limit?: number;
}): Promise<ObservabilityActivity[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.tenantId) {
    clauses.push("tenant_id = ?");
    params.push(filters.tenantId);
  }
  if (filters?.saasId) {
    clauses.push("saas_id = ?");
    params.push(filters.saasId);
  }
  if (filters?.sourceType) {
    clauses.push("source_type = ?");
    params.push(filters.sourceType);
  }
  if (filters?.sourceKey) {
    clauses.push("source_key = ?");
    params.push(filters.sourceKey);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 100);
  const rows = await queryAll<ActivityRow>(
    `SELECT id, tenant_id, saas_id, source_type, source_key, activity_type, status, summary, metadata_json, created_at
     FROM drako_observability_activities
     ${where}
     ORDER BY datetime(created_at) DESC
     LIMIT ?`,
    ...params,
    limit,
  );

  return rows.map(mapActivity);
}
