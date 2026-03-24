import { getDb } from "@/lib/db";

export type CampoBaseSocialAutomationRunStatus = "SUCCESS" | "FAILED";

export type CampoBaseSocialAutomationRun = {
  id: string;
  tenantId: string;
  saasId: string;
  status: CampoBaseSocialAutomationRunStatus;
  campaignId: string | null;
  postsCount: number;
  scheduledCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
};

export type RecordCampoBaseSocialAutomationRunInput = {
  tenantId: string;
  saasId: string;
  status: CampoBaseSocialAutomationRunStatus;
  campaignId: string | null;
  postsCount: number;
  scheduledCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt?: string;
};

type RunRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  status: string;
  campaign_id: string | null;
  posts_count: number;
  scheduled_count: number;
  error: string | null;
  started_at: string;
  finished_at: string;
  created_at: string;
};

const TABLE_NAME = "campobase_social_automation_runs";
let schemaReady: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `run_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  );
}

function mapRow(row: RunRow): CampoBaseSocialAutomationRun {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    status: row.status === "FAILED" ? "FAILED" : "SUCCESS",
    campaignId: row.campaign_id ? row.campaign_id : null,
    postsCount: row.posts_count,
    scheduledCount: row.scheduled_count,
    error: row.error ? row.error : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
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
          status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
          campaign_id TEXT,
          posts_count INTEGER NOT NULL,
          scheduled_count INTEGER NOT NULL,
          error TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`,
      ).run();
      await db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_created ON ${TABLE_NAME} (created_at)`,
      ).run();
      await db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_tenant_saas_created ON ${TABLE_NAME} (tenant_id, saas_id, created_at)`,
      ).run();
    })();
  }

  await schemaReady;
}

async function queryRows<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const db = getDb();
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runStatement(sql: string, ...params: unknown[]): Promise<void> {
  const db = getDb();
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  await bound.run();
}

export async function recordCampoBaseSocialAutomationRun(
  input: RecordCampoBaseSocialAutomationRunInput,
): Promise<CampoBaseSocialAutomationRun> {
  await ensureSchema();
  if (input.status !== "SUCCESS" && input.status !== "FAILED") {
    throw new Error("INVALID_CAMPOBASE_SOCIAL_AUTOMATION_STATUS");
  }
  const id = generateId();
  const createdAt = input.createdAt ?? input.startedAt ?? nowIso();
  const campaignId = input.campaignId ?? null;
  const error = input.error ?? null;

  await runStatement(
    `INSERT INTO ${TABLE_NAME} (
      id,
      tenant_id,
      saas_id,
      status,
      campaign_id,
      posts_count,
      scheduled_count,
      error,
      started_at,
      finished_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.tenantId,
    input.saasId,
    input.status,
    campaignId,
    input.postsCount,
    input.scheduledCount,
    error,
    input.startedAt,
    input.finishedAt,
    createdAt,
  );

  return {
    id,
    tenantId: input.tenantId,
    saasId: input.saasId,
    status: input.status,
    campaignId: input.campaignId ?? null,
    postsCount: input.postsCount,
    scheduledCount: input.scheduledCount,
    error: input.error ?? null,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    createdAt,
  };
}

export async function listCampoBaseSocialAutomationRuns(limit = 50): Promise<CampoBaseSocialAutomationRun[]> {
  await ensureSchema();
  const rows = await queryRows<RunRow>(
    `SELECT id, tenant_id, saas_id, status, campaign_id, posts_count, scheduled_count, error, started_at, finished_at, created_at
     FROM ${TABLE_NAME}
     ORDER BY datetime(created_at) DESC
     LIMIT ?`,
    limit,
  );
  return rows.map(mapRow);
}

export async function listCampoBaseSocialAutomationRunsForSaas(
  tenantId: string,
  saasId: string,
  limit = 50,
): Promise<CampoBaseSocialAutomationRun[]> {
  await ensureSchema();
  const rows = await queryRows<RunRow>(
    `SELECT id, tenant_id, saas_id, status, campaign_id, posts_count, scheduled_count, error, started_at, finished_at, created_at
     FROM ${TABLE_NAME}
     WHERE tenant_id = ? AND saas_id = ?
     ORDER BY datetime(created_at) DESC
     LIMIT ?`,
    tenantId,
    saasId,
    limit,
  );
  return rows.map(mapRow);
}
