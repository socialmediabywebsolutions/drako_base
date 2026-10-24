import type { D1Database } from "@cloudflare/workers-types";
import type {
  InsertAuditLogsInputs,
  InsertGovernanceEventsInputs,
  UpsertAgentsInputs,
  UpsertLoopRunsInputs,
  UpsertSaasesInputs,
} from "./types";

function nowIsoStrings(): string {
  return new Date().toISOString();
}

function readLegacySeverityNames(severityName: InsertGovernanceEventsInputs["severity"]): string {
  if (severityName === "warn") {
    return "warning";
  }
  return severityName;
}

export async function upsertSaasesRegistry(
  database: D1Database,
  inputs: UpsertSaasesInputs,
): Promise<Record<string, unknown>> {
  const currentTimestamp = nowIsoStrings();
  await database
    .prepare(
      `INSERT INTO saases_registry (
        saas_id,
        saas_slug,
        display_name,
        status_name,
        owner_tenant_id,
        domain_name,
        worker_name,
        database_name,
        namespace_key,
        metadata_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(saas_slug) DO UPDATE SET
        saas_id = excluded.saas_id,
        display_name = excluded.display_name,
        status_name = excluded.status_name,
        owner_tenant_id = excluded.owner_tenant_id,
        domain_name = excluded.domain_name,
        worker_name = excluded.worker_name,
        database_name = excluded.database_name,
        namespace_key = excluded.namespace_key,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      inputs.saasId,
      inputs.saasSlug,
      inputs.displayName,
      inputs.statusName,
      inputs.ownerTenantId,
      inputs.domainName,
      inputs.workerName,
      inputs.databaseName,
      inputs.namespaceKey,
      inputs.metadataJson,
      currentTimestamp,
      currentTimestamp,
    )
    .run();

  const record = await database
    .prepare(`SELECT * FROM saases_registry WHERE saas_slug = ? LIMIT 1`)
    .bind(inputs.saasSlug)
    .first<Record<string, unknown>>();

  if (!record) throw new Error("Failed to upsert saas registry.");
  return record;
}

export async function upsertAgentsRegistry(
  database: D1Database,
  inputs: UpsertAgentsInputs,
): Promise<Record<string, unknown>> {
  const currentTimestamp = nowIsoStrings();
  await database
    .prepare(
      `INSERT INTO agents_registry (
        agent_id,
        saas_slug,
        role_name,
        model_name,
        supervisor_agent_id,
        status_name,
        estimated_cost_per_run_major,
        metadata_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        saas_slug = excluded.saas_slug,
        role_name = excluded.role_name,
        model_name = excluded.model_name,
        supervisor_agent_id = excluded.supervisor_agent_id,
        status_name = excluded.status_name,
        estimated_cost_per_run_major = excluded.estimated_cost_per_run_major,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      inputs.agentId,
      inputs.saasSlug,
      inputs.roleName,
      inputs.modelName,
      inputs.supervisorAgentId,
      inputs.statusName,
      inputs.estimatedCostPerRunMajor,
      inputs.metadataJson,
      currentTimestamp,
      currentTimestamp,
    )
    .run();

  const record = await database
    .prepare(`SELECT * FROM agents_registry WHERE agent_id = ? LIMIT 1`)
    .bind(inputs.agentId)
    .first<Record<string, unknown>>();

  if (!record) throw new Error("Failed to upsert agent registry.");
  return record;
}

export async function insertGovernanceEvents(
  database: D1Database,
  inputs: InsertGovernanceEventsInputs,
): Promise<Record<string, unknown>> {
  const eventJson = JSON.stringify(inputs);
  const metadataJson = JSON.stringify(inputs.metadata);

  await database
    .prepare(
      `INSERT INTO governance_events (
        event_id,
        event_type,
        severity_name,
        source_name,
        saas_slug,
        tenant_id,
        actor_id,
        correlation_id,
        payload_json,
        created_at,
        schema_version,
        trace_id,
        actor_type,
        occurred_at,
        metadata,
        source,
        severity,
        event_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      inputs.event_id,
      inputs.event_type,
      readLegacySeverityNames(inputs.severity),
      inputs.source,
      inputs.saas_slug,
      inputs.tenant_id,
      inputs.actor_id,
      inputs.correlation_id,
      eventJson,
      inputs.occurred_at,
      inputs.schema_version,
      inputs.trace_id,
      inputs.actor_type,
      inputs.occurred_at,
      metadataJson,
      inputs.source,
      inputs.severity,
      eventJson,
    )
    .run();

  const record = await database
    .prepare(`SELECT * FROM governance_events WHERE event_id = ? LIMIT 1`)
    .bind(inputs.event_id)
    .first<Record<string, unknown>>();

  if (!record) throw new Error("Failed to insert governance event.");
  return record;
}

export async function insertAuditLogs(
  database: D1Database,
  inputs: InsertAuditLogsInputs,
): Promise<Record<string, unknown>> {
  const currentTimestamp = nowIsoStrings();
  await database
    .prepare(
      `INSERT INTO audit_logs (
        log_id,
        actor_type,
        actor_id,
        action,
        target_type,
        target_id,
        saas_slug,
        tenant_id,
        status_name,
        request_id,
        ip_address,
        user_agent,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      inputs.logId,
      inputs.actorType,
      inputs.actorId,
      inputs.action,
      inputs.targetType,
      inputs.targetId,
      inputs.saasSlug,
      inputs.tenantId,
      inputs.statusName,
      inputs.requestId,
      inputs.ipAddress,
      inputs.userAgent,
      inputs.metadata,
      currentTimestamp,
    )
    .run();

  const record = await database
    .prepare(`SELECT * FROM audit_logs WHERE log_id = ? LIMIT 1`)
    .bind(inputs.logId)
    .first<Record<string, unknown>>();

  if (!record) throw new Error("Failed to insert audit log.");
  return record;
}

export async function upsertLoopRuns(
  database: D1Database,
  inputs: UpsertLoopRunsInputs,
): Promise<Record<string, unknown>> {
  const currentTimestamp = nowIsoStrings();
  const computedDurationMs =
    inputs.durationMs != null
      ? inputs.durationMs
      : inputs.finishedAt
        ? Math.max(0, new Date(inputs.finishedAt).getTime() - new Date(inputs.startedAt).getTime())
        : null;

  await database
    .prepare(
      `INSERT INTO analyze_optimize_scale_runs (
        run_id,
        loop_name,
        phase_name,
        status_name,
        saas_slug,
        tenant_id,
        started_at,
        finished_at,
        duration_ms,
        metrics_json,
        notes_text,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        loop_name = excluded.loop_name,
        phase_name = excluded.phase_name,
        status_name = excluded.status_name,
        saas_slug = excluded.saas_slug,
        tenant_id = excluded.tenant_id,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        duration_ms = excluded.duration_ms,
        metrics_json = excluded.metrics_json,
        notes_text = excluded.notes_text,
        updated_at = excluded.updated_at`,
    )
    .bind(
      inputs.runId,
      inputs.loopName,
      inputs.phaseName,
      inputs.statusName,
      inputs.saasSlug,
      inputs.tenantId,
      inputs.startedAt,
      inputs.finishedAt,
      computedDurationMs,
      inputs.metricsJson,
      inputs.notesText,
      currentTimestamp,
      currentTimestamp,
    )
    .run();

  const record = await database
    .prepare(`SELECT * FROM analyze_optimize_scale_runs WHERE run_id = ? LIMIT 1`)
    .bind(inputs.runId)
    .first<Record<string, unknown>>();

  if (!record) throw new Error("Failed to upsert loop run.");
  return record;
}
