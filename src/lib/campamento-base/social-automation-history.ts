import { getDb } from "@/lib/db";

export type SocialAutomationHistoryStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELED";

export type SocialAutomationRunResult = {
  campaignId?: string | null;
  postsCount?: number;
  scheduledCount?: number;
  metadata?: Record<string, unknown>;
};

export type SocialAutomationRunError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};

export type SocialAutomationTriggeredBy = {
  actorType: "SYSTEM" | "OPERATOR" | "SCHEDULE" | "API";
  actorId?: string | null;
};

export type SocialAutomationHistoryRun = {
  id: string;
  tenantId: string;
  saasId: string;
  automationKey: string;
  status: SocialAutomationHistoryStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  result: SocialAutomationRunResult | null;
  error: SocialAutomationRunError | null;
  triggeredBy: SocialAutomationTriggeredBy;
  requestId: string | null;
  createdAt: string;
};

export type ListSocialAutomationRunsInput = {
  limit?: number;
  status?: SocialAutomationHistoryStatus;
  automationKey?: string;
  requestId?: string;
};

export type ListSocialAutomationRunsForSaasInput = ListSocialAutomationRunsInput & {
  tenantId: string;
  saasId: string;
};

export type RecordSocialAutomationRunInput = {
  tenantId: string;
  saasId: string;
  automationKey: string;
  status: SocialAutomationHistoryStatus;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  result?: SocialAutomationRunResult | null;
  error?: SocialAutomationRunError | null;
  triggeredBy?: SocialAutomationTriggeredBy;
  requestId?: string | null;
  createdAt?: string;
};

export type RecordSocialAutomationFailureInput = {
  tenantId: string;
  saasId: string;
  automationKey: string;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  error: SocialAutomationRunError;
  result?: SocialAutomationRunResult | null;
  triggeredBy?: SocialAutomationTriggeredBy;
  requestId?: string | null;
  createdAt?: string;
};

export type GetSocialAutomationHistorySummaryInput = {
  tenantId?: string;
  saasId?: string;
  limit?: number;
  status?: SocialAutomationHistoryStatus;
  automationKey?: string;
  requestId?: string;
};

export type SocialAutomationHistorySummary = {
  totalRuns: number;
  queuedRuns: number;
  runningRuns: number;
  successRuns: number;
  failedRuns: number;
  canceledRuns: number;
  successRate: number;
  failedRate: number;
  totalPosts: number;
  totalScheduled: number;
  latestRunAt: string | null;
  latestFailedRunAt: string | null;
};

type RunRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  automation_key: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  result_json: string | null;
  error_code: string | null;
  error_message: string | null;
  error_details_json: string | null;
  error_retryable: number | null;
  triggered_by_actor_type: string;
  triggered_by_actor_id: string | null;
  request_id: string | null;
  created_at: string;
};

const TABLE_NAME = "campamento_base_social_automation_history_runs";
const STATUS_VALUES: SocialAutomationHistoryStatus[] = [
  "QUEUED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "CANCELED",
];
const STATUS_SET = new Set<string>(STATUS_VALUES);

let schemaReady: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return 50;
  }
  const parsed = Math.trunc(limit as number);
  if (parsed < 1) {
    return 1;
  }
  if (parsed > 500) {
    return 500;
  }
  return parsed;
}

function generateId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `social_run_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  );
}

function isAllowedStatus(status: string): status is SocialAutomationHistoryStatus {
  return STATUS_SET.has(status);
}

function resolveStatus(status: string): SocialAutomationHistoryStatus {
  if (isAllowedStatus(status)) {
    return status;
  }
  return "FAILED";
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeDurationMs(input: {
  startedAt: string;
  completedAt: string | null;
  durationMs?: number | null;
}): number | null {
  if (Number.isFinite(input.durationMs) && (input.durationMs as number) >= 0) {
    return Math.trunc(input.durationMs as number);
  }

  if (!input.completedAt) {
    return null;
  }

  const startedMs = Date.parse(input.startedAt);
  const completedMs = Date.parse(input.completedAt);
  if (Number.isNaN(startedMs) || Number.isNaN(completedMs)) {
    return null;
  }
  return Math.max(0, completedMs - startedMs);
}

function mapRow(row: RunRow): SocialAutomationHistoryRun {
  const parsedResult = safeParseJson<SocialAutomationRunResult>(row.result_json);
  const parsedErrorDetails = safeParseJson<Record<string, unknown>>(row.error_details_json);

  const error = row.error_code || row.error_message
    ? {
        code: row.error_code ?? "SOCIAL_AUTOMATION_UNKNOWN_ERROR",
        message: row.error_message ?? "Unknown social automation error",
        details: parsedErrorDetails ?? undefined,
        retryable: row.error_retryable === null ? undefined : row.error_retryable === 1,
      }
    : null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    automationKey: row.automation_key,
    status: resolveStatus(row.status),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: Number.isFinite(row.duration_ms) ? row.duration_ms : null,
    result: parsedResult,
    error,
    triggeredBy: {
      actorType: ["SYSTEM", "OPERATOR", "SCHEDULE", "API"].includes(row.triggered_by_actor_type)
        ? (row.triggered_by_actor_type as SocialAutomationTriggeredBy["actorType"])
        : "SYSTEM",
      actorId: row.triggered_by_actor_id,
    },
    requestId: row.request_id,
    createdAt: row.created_at,
  };
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          saas_id TEXT NOT NULL,
          automation_key TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELED')),
          started_at TEXT NOT NULL,
          completed_at TEXT,
          duration_ms INTEGER,
          result_json TEXT,
          error_code TEXT,
          error_message TEXT,
          error_details_json TEXT,
          error_retryable INTEGER,
          triggered_by_actor_type TEXT NOT NULL,
          triggered_by_actor_id TEXT,
          request_id TEXT,
          created_at TEXT NOT NULL
        )`,
      ).run();
      await db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_created_at ON ${TABLE_NAME} (created_at)`,
      ).run();
      await db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_tenant_saas_created_at ON ${TABLE_NAME} (tenant_id, saas_id, created_at)`,
      ).run();
      await db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_request_id ON ${TABLE_NAME} (request_id)`,
      ).run();
    })();
  }

  await schemaReady;
}

async function queryRows<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const db = getDb();
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results ?? [];
}

async function runStatement(sql: string, ...params: unknown[]): Promise<void> {
  const db = getDb();
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  await bound.run();
}

async function findRunByRequestId(input: {
  tenantId: string;
  saasId: string;
  automationKey: string;
  requestId: string;
}): Promise<SocialAutomationHistoryRun | null> {
  const rows = await queryRows<RunRow>(
    `SELECT
       id,
       tenant_id,
       saas_id,
       automation_key,
       status,
       started_at,
       completed_at,
       duration_ms,
       result_json,
       error_code,
       error_message,
       error_details_json,
       error_retryable,
       triggered_by_actor_type,
       triggered_by_actor_id,
       request_id,
       created_at
     FROM ${TABLE_NAME}
     WHERE tenant_id = ? AND saas_id = ? AND automation_key = ? AND request_id = ?
     ORDER BY datetime(created_at) DESC
     LIMIT 1`,
    input.tenantId,
    input.saasId,
    input.automationKey,
    input.requestId,
  );

  if (!rows.length) {
    return null;
  }
  return mapRow(rows[0]);
}

export async function recordSocialAutomationRun(
  input: RecordSocialAutomationRunInput,
): Promise<SocialAutomationHistoryRun> {
  await ensureSchema();

  if (!isAllowedStatus(input.status)) {
    throw new Error("INVALID_SOCIAL_AUTOMATION_HISTORY_STATUS");
  }

  const normalizedRequestId = input.requestId ?? null;
  if (normalizedRequestId) {
    const existing = await findRunByRequestId({
      tenantId: input.tenantId,
      saasId: input.saasId,
      automationKey: input.automationKey,
      requestId: normalizedRequestId,
    });
    if (existing) {
      return existing;
    }
  }

  const id = generateId();
  const createdAt = input.createdAt ?? input.startedAt ?? nowIso();
  const completedAt = input.completedAt ?? null;
  const durationMs = normalizeDurationMs({
    startedAt: input.startedAt,
    completedAt,
    durationMs: input.durationMs,
  });
  const triggeredBy: SocialAutomationTriggeredBy = {
    actorType: input.triggeredBy?.actorType ?? "SYSTEM",
    actorId: input.triggeredBy?.actorId ?? null,
  };

  const error = input.error ?? null;
  const result = input.result ?? null;

  await runStatement(
    `INSERT INTO ${TABLE_NAME} (
      id,
      tenant_id,
      saas_id,
      automation_key,
      status,
      started_at,
      completed_at,
      duration_ms,
      result_json,
      error_code,
      error_message,
      error_details_json,
      error_retryable,
      triggered_by_actor_type,
      triggered_by_actor_id,
      request_id,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.tenantId,
    input.saasId,
    input.automationKey,
    input.status,
    input.startedAt,
    completedAt,
    durationMs,
    result ? JSON.stringify(result) : null,
    error?.code ?? null,
    error?.message ?? null,
    error?.details ? JSON.stringify(error.details) : null,
    typeof error?.retryable === "boolean" ? (error.retryable ? 1 : 0) : null,
    triggeredBy.actorType,
    triggeredBy.actorId ?? null,
    normalizedRequestId,
    createdAt,
  );

  return {
    id,
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: input.automationKey,
    status: input.status,
    startedAt: input.startedAt,
    completedAt,
    durationMs,
    result,
    error,
    triggeredBy,
    requestId: normalizedRequestId,
    createdAt,
  };
}

export async function recordSocialAutomationFailure(
  input: RecordSocialAutomationFailureInput,
): Promise<SocialAutomationHistoryRun> {
  return recordSocialAutomationRun({
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: input.automationKey,
    status: "FAILED",
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? input.startedAt,
    durationMs: input.durationMs,
    result: input.result ?? null,
    error: {
      code: input.error.code || "SOCIAL_AUTOMATION_UNKNOWN_ERROR",
      message: input.error.message || "Unknown social automation error",
      details: input.error.details,
      retryable: input.error.retryable,
    },
    triggeredBy: input.triggeredBy,
    requestId: input.requestId,
    createdAt: input.createdAt,
  });
}

export async function listSocialAutomationRuns(
  input: ListSocialAutomationRunsInput = {},
): Promise<SocialAutomationHistoryRun[]> {
  await ensureSchema();

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (input.status) {
    whereClauses.push("status = ?");
    params.push(input.status);
  }
  if (input.automationKey) {
    whereClauses.push("automation_key = ?");
    params.push(input.automationKey);
  }
  if (input.requestId) {
    whereClauses.push("request_id = ?");
    params.push(input.requestId);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const limit = normalizeLimit(input.limit);

  const rows = await queryRows<RunRow>(
    `SELECT
       id,
       tenant_id,
       saas_id,
       automation_key,
       status,
       started_at,
       completed_at,
       duration_ms,
       result_json,
       error_code,
       error_message,
       error_details_json,
       error_retryable,
       triggered_by_actor_type,
       triggered_by_actor_id,
       request_id,
       created_at
     FROM ${TABLE_NAME}
     ${whereSql}
     ORDER BY datetime(created_at) DESC
     LIMIT ?`,
    ...params,
    limit,
  );

  return rows.map(mapRow);
}

export async function listSocialAutomationRunsForSaas(
  input: ListSocialAutomationRunsForSaasInput,
): Promise<SocialAutomationHistoryRun[]> {
  await ensureSchema();

  const whereClauses = ["tenant_id = ?", "saas_id = ?"];
  const params: unknown[] = [input.tenantId, input.saasId];

  if (input.status) {
    whereClauses.push("status = ?");
    params.push(input.status);
  }
  if (input.automationKey) {
    whereClauses.push("automation_key = ?");
    params.push(input.automationKey);
  }
  if (input.requestId) {
    whereClauses.push("request_id = ?");
    params.push(input.requestId);
  }

  const limit = normalizeLimit(input.limit);

  const rows = await queryRows<RunRow>(
    `SELECT
       id,
       tenant_id,
       saas_id,
       automation_key,
       status,
       started_at,
       completed_at,
       duration_ms,
       result_json,
       error_code,
       error_message,
       error_details_json,
       error_retryable,
       triggered_by_actor_type,
       triggered_by_actor_id,
       request_id,
       created_at
     FROM ${TABLE_NAME}
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY datetime(created_at) DESC
     LIMIT ?`,
    ...params,
    limit,
  );

  return rows.map(mapRow);
}

export async function getSocialAutomationHistorySummary(
  input: GetSocialAutomationHistorySummaryInput = {},
): Promise<SocialAutomationHistorySummary> {
  const runs = input.tenantId && input.saasId
    ? await listSocialAutomationRunsForSaas({
        tenantId: input.tenantId,
        saasId: input.saasId,
        limit: input.limit,
        status: input.status,
        automationKey: input.automationKey,
        requestId: input.requestId,
      })
    : await listSocialAutomationRuns({
        limit: input.limit,
        status: input.status,
        automationKey: input.automationKey,
        requestId: input.requestId,
      });

  let queuedRuns = 0;
  let runningRuns = 0;
  let successRuns = 0;
  let failedRuns = 0;
  let canceledRuns = 0;
  let totalPosts = 0;
  let totalScheduled = 0;
  let latestRunAt: string | null = null;
  let latestFailedRunAt: string | null = null;
  let latestRunMs = -Infinity;
  let latestFailedMs = -Infinity;

  for (const run of runs) {
    if (run.status === "QUEUED") {
      queuedRuns += 1;
    } else if (run.status === "RUNNING") {
      runningRuns += 1;
    } else if (run.status === "SUCCESS") {
      successRuns += 1;
    } else if (run.status === "FAILED") {
      failedRuns += 1;
    } else if (run.status === "CANCELED") {
      canceledRuns += 1;
    }

    totalPosts += Number.isFinite(run.result?.postsCount) ? (run.result?.postsCount as number) : 0;
    totalScheduled += Number.isFinite(run.result?.scheduledCount) ? (run.result?.scheduledCount as number) : 0;

    const runTime = Date.parse(run.createdAt);
    if (!Number.isNaN(runTime) && runTime > latestRunMs) {
      latestRunMs = runTime;
      latestRunAt = run.createdAt;
    }

    if (run.status === "FAILED") {
      const failedTime = Date.parse(run.createdAt);
      if (!Number.isNaN(failedTime) && failedTime > latestFailedMs) {
        latestFailedMs = failedTime;
        latestFailedRunAt = run.createdAt;
      }
    }
  }

  const totalRuns = runs.length;

  return {
    totalRuns,
    queuedRuns,
    runningRuns,
    successRuns,
    failedRuns,
    canceledRuns,
    successRate: totalRuns ? successRuns / totalRuns : 0,
    failedRate: totalRuns ? failedRuns / totalRuns : 0,
    totalPosts,
    totalScheduled,
    latestRunAt,
    latestFailedRunAt,
  };
}
