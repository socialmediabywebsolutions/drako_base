import { queryOne, run } from "@/lib/db";
import { getAutomationHandler } from "@/lib/automation-core/handlers";
import { getAutomation } from "@/lib/automation-core/registry";
import { generateId, normalizeExecutionResult, nowIso, stringifyJson } from "@/lib/automation-core/shared";
import { openObservabilityIncident, recordObservabilityActivity, resolveObservabilityIncidentsByScope } from "@/lib/observability-core";
import {
  AutomationCoreError,
  type AutomationExecution,
  type AutomationExecutionResult,
  type TriggerAutomationInput,
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
    metrics: row.metrics_json ? JSON.parse(row.metrics_json) as Record<string, number> : {},
    output: row.output_json ? JSON.parse(row.output_json) as Record<string, unknown> : null,
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function recordAutomationObservability(params: {
  tenantId: string;
  saasId: string;
  automationKey: string;
  status: "SUCCESS" | "FAILED";
  summary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}) {
  try {
    await recordObservabilityActivity({
      tenantId: params.tenantId,
      saasId: params.saasId,
      sourceType: "automation",
      sourceKey: params.automationKey,
      activityType: "automation_execution",
      status: params.status === "SUCCESS" ? "success" : "error",
      summary:
        params.summary
        ?? (params.status === "SUCCESS"
          ? `Automation ${params.automationKey} executed successfully.`
          : `Automation ${params.automationKey} failed.`),
      metadata: {
        automationKey: params.automationKey,
        executionStatus: params.status,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
      },
    });

    if (params.status === "FAILED") {
      await openObservabilityIncident({
        tenantId: params.tenantId,
        saasId: params.saasId,
        sourceType: "automation",
        sourceKey: params.automationKey,
        incidentType: "automation_execution_failed",
        severity: "medium",
        summary: params.errorMessage ?? `Automation ${params.automationKey} failed.`,
        details: {
          automationKey: params.automationKey,
          errorCode: params.errorCode,
          errorMessage: params.errorMessage,
        },
      });
    } else {
      await resolveObservabilityIncidentsByScope({
        tenantId: params.tenantId,
        saasId: params.saasId,
        sourceType: "automation",
        sourceKey: params.automationKey,
        incidentType: "automation_execution_failed",
      });
    }
  } catch (error) {
    console.error("AUTOMATION_OBSERVABILITY_RECORD_ERROR", error);
  }
}

async function getRunningExecution(input: {
  tenantId: string;
  saasId: string;
  automationKey: string;
}): Promise<AutomationExecution | null> {
  const row = await queryOne<ExecutionRow>(
    `SELECT id, tenant_id, saas_id, automation_key, trigger_type, triggered_by, status, summary,
            metrics_json, output_json, error_code, error_message, started_at, finished_at, created_at, updated_at
     FROM drako_automation_executions
     WHERE tenant_id = ? AND saas_id = ? AND automation_key = ? AND status = 'RUNNING'
     ORDER BY datetime(created_at) DESC
     LIMIT 1`,
    input.tenantId,
    input.saasId,
    input.automationKey,
  );

  return row ? mapExecution(row) : null;
}

export async function recordExecutionStart(input: {
  tenantId: string;
  saasId: string;
  automationKey: string;
  triggerType: "manual" | "scheduled" | "retry" | "system";
  triggeredBy?: string | null;
}): Promise<AutomationExecution> {
  const now = nowIso();
  const id = generateId("execution");
  await run(
    `INSERT INTO drako_automation_executions (
      id, tenant_id, saas_id, automation_key, trigger_type, triggered_by, status,
      summary, metrics_json, output_json, error_code, error_message,
      started_at, finished_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', NULL, NULL, NULL, NULL, NULL, ?, NULL, ?, ?)`,
    id,
    input.tenantId,
    input.saasId,
    input.automationKey,
    input.triggerType,
    input.triggeredBy ?? null,
    now,
    now,
    now,
  );

  return {
    id,
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: input.automationKey,
    triggerType: input.triggerType,
    triggeredBy: input.triggeredBy ?? null,
    status: "RUNNING",
    summary: null,
    metrics: {},
    output: null,
    errorCode: null,
    errorMessage: null,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function recordExecutionResult(input: {
  executionId: string;
  result: AutomationExecutionResult;
}): Promise<AutomationExecution> {
  const normalized = normalizeExecutionResult(input.result);
  const finishedAt = nowIso();
  const status = normalized.ok ? "SUCCESS" : "FAILED";
  await run(
    `UPDATE drako_automation_executions
     SET status = ?, summary = ?, metrics_json = ?, output_json = ?, error_code = ?, error_message = ?,
         finished_at = ?, updated_at = ?
     WHERE id = ?`,
    status,
    normalized.summary,
    stringifyJson(normalized.metrics),
    stringifyJson(normalized.output),
    normalized.error?.code ?? null,
    normalized.error?.message ?? null,
    finishedAt,
    finishedAt,
    input.executionId,
  );

  const row = await queryOne<ExecutionRow>(
    `SELECT id, tenant_id, saas_id, automation_key, trigger_type, triggered_by, status, summary,
            metrics_json, output_json, error_code, error_message, started_at, finished_at, created_at, updated_at
     FROM drako_automation_executions
     WHERE id = ?
     LIMIT 1`,
    input.executionId,
  );

  if (!row) {
    throw new AutomationCoreError("AUTOMATION_EXECUTION_NOT_FOUND");
  }

  return mapExecution(row);
}

export async function triggerAutomation(input: TriggerAutomationInput): Promise<{
  execution: AutomationExecution;
  result: Required<Pick<AutomationExecutionResult, "ok">> & {
    summary: string | null;
    metrics: Record<string, number>;
    output: Record<string, unknown> | null;
    error: { code: string; message: string } | null;
  };
}> {
  if (!input.tenantId?.trim()) {
    throw new AutomationCoreError("AUTOMATION_TENANT_REQUIRED");
  }
  if (!input.saasId?.trim()) {
    throw new AutomationCoreError("AUTOMATION_SAAS_REQUIRED");
  }
  if (!input.automationKey?.trim()) {
    throw new AutomationCoreError("AUTOMATION_KEY_REQUIRED");
  }

  const registration = await getAutomation(input.tenantId, input.saasId, input.automationKey);
  if (!registration) {
    throw new AutomationCoreError("AUTOMATION_NOT_REGISTERED");
  }
  if (!registration.enabled) {
    throw new AutomationCoreError("AUTOMATION_DISABLED");
  }

  const handler = getAutomationHandler(input.automationKey);
  if (!handler) {
    throw new AutomationCoreError("AUTOMATION_HANDLER_MISSING");
  }

  const runningExecution = await getRunningExecution({
    tenantId: registration.tenantId,
    saasId: registration.saasId,
    automationKey: registration.automationKey,
  });
  if (runningExecution) {
    throw Object.assign(
      new AutomationCoreError("AUTOMATION_EXECUTION_IN_PROGRESS", "Automation execution already running"),
      { execution: runningExecution },
    );
  }

  const execution = await recordExecutionStart({
    tenantId: registration.tenantId,
    saasId: registration.saasId,
    automationKey: registration.automationKey,
    triggerType: input.triggerType ?? "manual",
    triggeredBy: input.triggeredBy ?? null,
  });

  try {
    const rawResult = await handler({
      executionId: execution.id,
      tenantId: registration.tenantId,
      saasId: registration.saasId,
      automationKey: registration.automationKey,
      config: registration.config,
      triggerType: execution.triggerType,
    });
    const normalized = normalizeExecutionResult(rawResult);
    const completed = await recordExecutionResult({ executionId: execution.id, result: rawResult });
    await recordAutomationObservability({
      tenantId: completed.tenantId,
      saasId: completed.saasId,
      automationKey: completed.automationKey,
      status: completed.status === "SUCCESS" ? "SUCCESS" : "FAILED",
      summary: completed.summary,
      errorCode: completed.errorCode,
      errorMessage: completed.errorMessage,
    });
    return { execution: completed, result: normalized };
  } catch (error) {
    const errorResult: AutomationExecutionResult = {
      ok: false,
      error: {
        code: "AUTOMATION_HANDLER_ERROR",
        message: error instanceof Error ? error.message : "Unhandled automation handler error",
      },
    };
    const completed = await recordExecutionResult({ executionId: execution.id, result: errorResult });
    await recordAutomationObservability({
      tenantId: completed.tenantId,
      saasId: completed.saasId,
      automationKey: completed.automationKey,
      status: completed.status === "SUCCESS" ? "SUCCESS" : "FAILED",
      summary: completed.summary,
      errorCode: completed.errorCode,
      errorMessage: completed.errorMessage,
    });
    throw Object.assign(
      new AutomationCoreError("AUTOMATION_HANDLER_ERROR", error instanceof Error ? error.message : undefined),
      { execution: completed },
    );
  }
}
