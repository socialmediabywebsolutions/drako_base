import type { D1Database, KVNamespace, Queue } from "@cloudflare/workers-types";

export type GovernanceSeverities = "info" | "warn" | "error" | "critical";
export type GovernanceSchemaVersions = "v1";

export type GovernanceEventSpecsV1 = {
  event_id: string;
  event_type: string;
  source: string;
  saas_slug: string | null;
  tenant_id: string | null;
  actor_type: string;
  actor_id: string;
  severity: GovernanceSeverities;
  occurred_at: string;
  metadata: Record<string, unknown>;
  trace_id: string;
  correlation_id: string;
  schema_version: GovernanceSchemaVersions;
};

export type DrkoCoreEnv = {
  DRKO_HOLDING_DB: D1Database;
  DRKO_GLOBAL_CONFIG: KVNamespace;
  DRKO_GLOBAL_EVENTS: Queue<GovernanceEventSpecsV1>;
  DRKO_CORE_CONTEXT?: string;
  DRKO_LOOP_NAME?: string;
  WORKERS_ONLY_MODE?: string;
  CF_PAGES?: string;
  CF_PAGES_ENVIRONMENT?: string;
  CF_PAGES_URL?: string;
  GIT_SHA?: string;
  BUILD_VERSION?: string;
};

export type SaasesStatuses = "draft" | "provisioning" | "active" | "paused" | "archived";
export type AgentsStatuses = "active" | "disabled" | "archived" | "testing";
export type AuditStatuses = "success" | "failure" | "warning" | "info";
export type LoopPhases = "ANALYZE" | "OPTIMIZE" | "SCALE";
export type LoopStatuses = "started" | "completed" | "failed" | "canceled";

export type UpsertSaasesInputs = {
  saasId: string;
  saasSlug: string;
  displayName: string;
  statusName: SaasesStatuses;
  ownerTenantId: string | null;
  domainName: string | null;
  workerName: string | null;
  databaseName: string | null;
  namespaceKey: string | null;
  metadataJson: string;
};

export type UpsertAgentsInputs = {
  agentId: string;
  saasSlug: string | null;
  roleName: string;
  modelName: string;
  supervisorAgentId: string | null;
  statusName: AgentsStatuses;
  estimatedCostPerRunMajor: number;
  metadataJson: string;
};

export type InsertGovernanceEventsInputs = GovernanceEventSpecsV1;

export type InsertAuditLogsInputs = {
  logId: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  saasSlug: string | null;
  tenantId: string | null;
  statusName: AuditStatuses;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: string;
};

export type UpsertLoopRunsInputs = {
  runId: string;
  loopName: string;
  phaseName: LoopPhases;
  statusName: LoopStatuses;
  saasSlug: string | null;
  tenantId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  metricsJson: string;
  notesText: string | null;
};
