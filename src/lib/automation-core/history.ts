import { queryAll } from "@/lib/db";
import { parseJsonObject } from "@/lib/automation-core/shared";
import type {
  AutomationExecution,
  AutomationExecutionSummary,
  ListAutomationExecutionsFilters,
} from "@/lib/automation-core/types";

type ExecutionRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  automation_key: string;
  trigger_type: "manual" | "scheduled" | "retry" | "system";
  triggered_by: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  summary: string | null;
  metrics_json: string | null;
  output_json: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapExecution(row: ExecutionRow): AutomationExecution {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    automationKey: row.automation_key,
    triggerType: row.trigger_type,
    triggeredBy: row.triggered_by ?? null,
    status: row.status,
    summary: row.summary ?? null,
    metrics: parseJsonObject(row.metrics_json, {}),
    output: parseJsonObject(row.output_json, null),
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAutomationExecutions(
  filters?: ListAutomationExecutionsFilters,
): Promise<AutomationExecution[]> {
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
  if (filters?.automationKey) {
    clauses.push("automation_key = ?");
    params.push(filters.automationKey);
  }
  if (filters?.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 100);
  const rows = await queryAll<ExecutionRow>(
    `SELECT id, tenant_id, saas_id, automation_key, trigger_type, triggered_by, status, summary,
            metrics_json, output_json, error_code, error_message, started_at, finished_at, created_at, updated_at
     FROM drako_automation_executions
     ${where}
     ORDER BY datetime(created_at) DESC
     LIMIT ?`,
    ...params,
    limit,
  );

  return rows.map(mapExecution);
}

export async function getAutomationExecutionSummary(
  filters?: ListAutomationExecutionsFilters,
): Promise<AutomationExecutionSummary> {
  const runs = await listAutomationExecutions({ ...filters, limit: filters?.limit ?? 100 });
  let successRuns = 0;
  let failedRuns = 0;
  let latestRunAt: string | null = null;
  let latestFailedRunAt: string | null = null;

  for (const run of runs) {
    if (!latestRunAt || run.createdAt > latestRunAt) {
      latestRunAt = run.createdAt;
    }
    if (run.status === "SUCCESS") {
      successRuns += 1;
    }
    if (run.status === "FAILED") {
      failedRuns += 1;
      if (!latestFailedRunAt || run.createdAt > latestFailedRunAt) {
        latestFailedRunAt = run.createdAt;
      }
    }
  }

  const totalRuns = runs.length;
  return {
    totalRuns,
    successRuns,
    failedRuns,
    successRate: totalRuns ? successRuns / totalRuns : 0,
    failedRate: totalRuns ? failedRuns / totalRuns : 0,
    latestRunAt,
    latestFailedRunAt,
  };
}
