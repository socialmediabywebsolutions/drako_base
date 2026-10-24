import { queryAll, queryOne, run } from "@/lib/db";
import { generateId, nowIso, parseJsonObject, stringifyJson } from "@/lib/observability-core/shared";
import {
  ObservabilityCoreError,
  type ObservabilityIncident,
  type OpenObservabilityIncidentInput,
} from "@/lib/observability-core/types";

type IncidentRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  source_type: string;
  source_key: string;
  incident_type: string;
  severity: string;
  status: string;
  summary: string;
  details_json: string | null;
  opened_at: string;
  resolved_at: string | null;
  updated_at: string;
};

function mapIncident(row: IncidentRow): ObservabilityIncident {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    sourceType: row.source_type as ObservabilityIncident["sourceType"],
    sourceKey: row.source_key,
    incidentType: row.incident_type,
    severity: row.severity as ObservabilityIncident["severity"],
    status: row.status as ObservabilityIncident["status"],
    summary: row.summary,
    details: parseJsonObject(row.details_json, null),
    openedAt: row.opened_at,
    resolvedAt: row.resolved_at ?? null,
    updatedAt: row.updated_at,
  };
}

async function getIncidentById(id: string): Promise<ObservabilityIncident | null> {
  const row = await queryOne<IncidentRow>(
    `SELECT id, tenant_id, saas_id, source_type, source_key, incident_type, severity, status, summary, details_json, opened_at, resolved_at, updated_at
     FROM drako_observability_incidents
     WHERE id = ?
     LIMIT 1`,
    id,
  );
  return row ? mapIncident(row) : null;
}

async function findReusableIncident(input: OpenObservabilityIncidentInput): Promise<ObservabilityIncident | null> {
  const row = await queryOne<IncidentRow>(
    `SELECT id, tenant_id, saas_id, source_type, source_key, incident_type, severity, status, summary, details_json, opened_at, resolved_at, updated_at
     FROM drako_observability_incidents
     WHERE tenant_id = ? AND saas_id = ? AND source_type = ? AND source_key = ? AND incident_type = ?
       AND status IN ('OPEN', 'ACKNOWLEDGED')
     ORDER BY datetime(updated_at) DESC
     LIMIT 1`,
    input.tenantId.trim(),
    input.saasId.trim(),
    input.sourceType,
    input.sourceKey.trim(),
    input.incidentType.trim(),
  );

  return row ? mapIncident(row) : null;
}

function validateOpenInput(input: OpenObservabilityIncidentInput) {
  if (!input.tenantId?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_TENANT_REQUIRED");
  if (!input.saasId?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SAAS_REQUIRED");
  if (!input.sourceKey?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SOURCE_KEY_REQUIRED");
  if (!input.incidentType?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_INCIDENT_TYPE_REQUIRED");
  if (!input.summary?.trim()) throw new ObservabilityCoreError("OBSERVABILITY_SUMMARY_REQUIRED");
}

export async function openObservabilityIncident(
  input: OpenObservabilityIncidentInput,
): Promise<ObservabilityIncident> {
  validateOpenInput(input);
  const existing = await findReusableIncident(input);
  const now = nowIso();

  if (existing) {
    await run(
      `UPDATE drako_observability_incidents
       SET severity = ?, status = 'OPEN', summary = ?, details_json = ?, resolved_at = NULL, updated_at = ?
       WHERE id = ?`,
      input.severity,
      input.summary.trim(),
      stringifyJson(input.details ?? null),
      now,
      existing.id,
    );

    const updated = await getIncidentById(existing.id);
    if (!updated) {
      throw new ObservabilityCoreError("OBSERVABILITY_INCIDENT_NOT_FOUND");
    }
    return updated;
  }

  const id = generateId("incident");
  await run(
    `INSERT INTO drako_observability_incidents (
      id, tenant_id, saas_id, source_type, source_key, incident_type, severity, status, summary, details_json, opened_at, resolved_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, NULL, ?)`,
    id,
    input.tenantId.trim(),
    input.saasId.trim(),
    input.sourceType,
    input.sourceKey.trim(),
    input.incidentType.trim(),
    input.severity,
    input.summary.trim(),
    stringifyJson(input.details ?? null),
    now,
    now,
  );

  return {
    id,
    tenantId: input.tenantId.trim(),
    saasId: input.saasId.trim(),
    sourceType: input.sourceType,
    sourceKey: input.sourceKey.trim(),
    incidentType: input.incidentType.trim(),
    severity: input.severity,
    status: "OPEN",
    summary: input.summary.trim(),
    details: input.details ?? null,
    openedAt: now,
    resolvedAt: null,
    updatedAt: now,
  };
}

async function transitionIncident(
  id: string,
  status: "ACKNOWLEDGED" | "RESOLVED",
): Promise<ObservabilityIncident> {
  const existing = await getIncidentById(id);
  if (!existing) {
    throw new ObservabilityCoreError("OBSERVABILITY_INCIDENT_NOT_FOUND");
  }

  const now = nowIso();
  await run(
    `UPDATE drako_observability_incidents
     SET status = ?, resolved_at = ?, updated_at = ?
     WHERE id = ?`,
    status,
    status === "RESOLVED" ? now : existing.resolvedAt,
    now,
    id,
  );

  const updated = await getIncidentById(id);
  if (!updated) throw new ObservabilityCoreError("OBSERVABILITY_INCIDENT_NOT_FOUND");
  return updated;
}

export async function acknowledgeObservabilityIncident(id: string): Promise<ObservabilityIncident> {
  return transitionIncident(id, "ACKNOWLEDGED");
}

export async function resolveObservabilityIncident(id: string): Promise<ObservabilityIncident> {
  return transitionIncident(id, "RESOLVED");
}

export async function resolveObservabilityIncidentsByScope(filters: {
  tenantId: string;
  saasId: string;
  sourceType: string;
  sourceKey: string;
  incidentType?: string | null;
}): Promise<ObservabilityIncident[]> {
  const incidents = await listObservabilityIncidents({
    tenantId: filters.tenantId,
    saasId: filters.saasId,
    sourceType: filters.sourceType,
    sourceKey: filters.sourceKey,
    status: "OPEN",
    limit: 50,
  });

  const matching = filters.incidentType
    ? incidents.filter((incident) => incident.incidentType === filters.incidentType)
    : incidents;

  const resolved: ObservabilityIncident[] = [];
  for (const incident of matching) {
    resolved.push(await resolveObservabilityIncident(incident.id));
  }

  return resolved;
}

export async function listObservabilityIncidents(filters?: {
  tenantId?: string | null;
  saasId?: string | null;
  sourceType?: string | null;
  sourceKey?: string | null;
  status?: string | null;
  limit?: number;
}): Promise<ObservabilityIncident[]> {
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
  if (filters?.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 100);
  const rows = await queryAll<IncidentRow>(
    `SELECT id, tenant_id, saas_id, source_type, source_key, incident_type, severity, status, summary, details_json, opened_at, resolved_at, updated_at
     FROM drako_observability_incidents
     ${where}
     ORDER BY datetime(updated_at) DESC
     LIMIT ?`,
    ...params,
    limit,
  );

  return rows.map(mapIncident);
}
