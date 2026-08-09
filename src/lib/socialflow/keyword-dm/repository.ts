import { resolveSocialContext, type SocialContext } from "@/lib/socialflow/repository";
import type { KeywordDmLogEntry, KeywordDmLogStatus, KeywordDmTrigger, KeywordMatchType } from "./types";

export type { SocialContext };

const keywordDmSchemaCache = new WeakMap<D1Database, Promise<void>>();

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

type TriggerRow = {
  id: string;
  tenant_id: string;
  keyword: string;
  match_type: string;
  dm_message: string;
  target_post_id: string | null;
  active: number;
  created_at: string;
  updated_at: string;
};

type LogRow = {
  id: string;
  tenant_id: string;
  trigger_id: string;
  platform_comment_id: string;
  commenter_username: string | null;
  sent_at: string;
  status: string;
  error_message: string | null;
};

function mapTriggerRow(row: TriggerRow): KeywordDmTrigger {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    keyword: row.keyword,
    matchType: row.match_type as KeywordMatchType,
    dmMessage: row.dm_message,
    targetPostId: row.target_post_id,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLogRow(row: LogRow): KeywordDmLogEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    triggerId: row.trigger_id,
    platformCommentId: row.platform_comment_id,
    commenterUsername: row.commenter_username,
    sentAt: row.sent_at,
    status: row.status as KeywordDmLogStatus,
    errorMessage: row.error_message,
  };
}

async function runStatement(db: D1Database, sql: string, ...params: unknown[]) {
  const stmt = db.prepare(sql);
  return (params.length ? stmt.bind(...params) : stmt).run();
}

async function queryRows<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const stmt = db.prepare(sql);
  const result = await (params.length ? stmt.bind(...params) : stmt).all<T>();
  return result.results ?? [];
}

async function queryFirst<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  const rows = await queryRows<T>(db, sql, ...params);
  return rows[0] ?? null;
}

async function ensureKeywordDmSchemaInner(db: D1Database): Promise<void> {
  await runStatement(
    db,
    `CREATE TABLE IF NOT EXISTS socialflow_keyword_dm_triggers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'contains')),
      dm_message TEXT NOT NULL,
      target_post_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  await runStatement(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sf_keyword_dm_triggers_tenant_active
     ON socialflow_keyword_dm_triggers (tenant_id, active)`,
  );
  await runStatement(
    db,
    `CREATE TABLE IF NOT EXISTS socialflow_keyword_dm_log (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      trigger_id TEXT NOT NULL,
      platform_comment_id TEXT NOT NULL,
      commenter_username TEXT,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('SENT', 'FAILED')),
      error_message TEXT
    )`,
  );
  // Enforces "un comment_id solo puede disparar un DM una vez, sin importar cuántos
  // triggers matcheen" — the uniqueness lives on (tenant_id, platform_comment_id), not
  // on trigger_id, so a second trigger matching the same already-logged comment can never
  // insert a second row.
  await runStatement(
    db,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sf_keyword_dm_log_tenant_comment
     ON socialflow_keyword_dm_log (tenant_id, platform_comment_id)`,
  );
}

export async function ensureKeywordDmSchema(db: D1Database): Promise<void> {
  const existing = keywordDmSchemaCache.get(db);
  if (existing) return existing;
  const promise = ensureKeywordDmSchemaInner(db);
  keywordDmSchemaCache.set(db, promise);
  try {
    await promise;
  } catch (error) {
    keywordDmSchemaCache.delete(db);
    throw error;
  }
}

export type CreateKeywordDmTriggerInput = {
  keyword: string;
  matchType: KeywordMatchType;
  dmMessage: string;
  targetPostId?: string | null;
};

export async function createKeywordDmTrigger(
  ctx: SocialContext,
  input: CreateKeywordDmTriggerInput,
): Promise<KeywordDmTrigger> {
  await ensureKeywordDmSchema(ctx.socialDb);
  const id = generateId();
  const now = nowIso();

  await runStatement(
    ctx.socialDb,
    `INSERT INTO socialflow_keyword_dm_triggers
     (id, tenant_id, keyword, match_type, dm_message, target_post_id, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    ctx.tenantId,
    input.keyword,
    input.matchType,
    input.dmMessage,
    input.targetPostId ?? null,
    now,
    now,
  );

  const row = await queryFirst<TriggerRow>(
    ctx.socialDb,
    `SELECT id, tenant_id, keyword, match_type, dm_message, target_post_id, active, created_at, updated_at
     FROM socialflow_keyword_dm_triggers WHERE tenant_id = ? AND id = ? LIMIT 1`,
    ctx.tenantId,
    id,
  );
  if (!row) throw new Error("KEYWORD_DM_TRIGGER_PERSIST_FAILED");
  return mapTriggerRow(row);
}

export async function listKeywordDmTriggers(
  ctx: SocialContext,
  filters?: { activeOnly?: boolean },
): Promise<KeywordDmTrigger[]> {
  await ensureKeywordDmSchema(ctx.socialDb);
  const clauses = ["tenant_id = ?"];
  const params: unknown[] = [ctx.tenantId];
  if (filters?.activeOnly) {
    clauses.push("active = 1");
  }
  const rows = await queryRows<TriggerRow>(
    ctx.socialDb,
    `SELECT id, tenant_id, keyword, match_type, dm_message, target_post_id, active, created_at, updated_at
     FROM socialflow_keyword_dm_triggers
     WHERE ${clauses.join(" AND ")}
     ORDER BY datetime(created_at) DESC`,
    ...params,
  );
  return rows.map(mapTriggerRow);
}

export async function setKeywordDmTriggerActive(
  ctx: SocialContext,
  id: string,
  active: boolean,
): Promise<KeywordDmTrigger | null> {
  await ensureKeywordDmSchema(ctx.socialDb);
  await runStatement(
    ctx.socialDb,
    `UPDATE socialflow_keyword_dm_triggers SET active = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`,
    active ? 1 : 0,
    nowIso(),
    ctx.tenantId,
    id,
  );
  const row = await queryFirst<TriggerRow>(
    ctx.socialDb,
    `SELECT id, tenant_id, keyword, match_type, dm_message, target_post_id, active, created_at, updated_at
     FROM socialflow_keyword_dm_triggers WHERE tenant_id = ? AND id = ? LIMIT 1`,
    ctx.tenantId,
    id,
  );
  return row ? mapTriggerRow(row) : null;
}

export async function deleteKeywordDmTrigger(ctx: SocialContext, id: string): Promise<boolean> {
  await ensureKeywordDmSchema(ctx.socialDb);
  const result = await runStatement(
    ctx.socialDb,
    `DELETE FROM socialflow_keyword_dm_triggers WHERE tenant_id = ? AND id = ?`,
    ctx.tenantId,
    id,
  );
  return ((result?.meta as { changes?: number })?.changes ?? 0) > 0;
}

export async function hasKeywordDmLogEntry(ctx: SocialContext, platformCommentId: string): Promise<boolean> {
  await ensureKeywordDmSchema(ctx.socialDb);
  const row = await queryFirst<{ id: string }>(
    ctx.socialDb,
    `SELECT id FROM socialflow_keyword_dm_log WHERE tenant_id = ? AND platform_comment_id = ? LIMIT 1`,
    ctx.tenantId,
    platformCommentId,
  );
  return row !== null;
}

export type RecordKeywordDmLogInput = {
  triggerId: string;
  platformCommentId: string;
  commenterUsername?: string | null;
  status: KeywordDmLogStatus;
  errorMessage?: string | null;
};

// INSERT ... ON CONFLICT DO NOTHING on (tenant_id, platform_comment_id) — the same
// comment can never be logged twice, matching hasKeywordDmLogEntry's pre-check as
// defense-in-depth rather than the only guard.
export async function recordKeywordDmLog(
  ctx: SocialContext,
  input: RecordKeywordDmLogInput,
): Promise<KeywordDmLogEntry | null> {
  await ensureKeywordDmSchema(ctx.socialDb);
  const id = generateId();
  const now = nowIso();

  await runStatement(
    ctx.socialDb,
    `INSERT INTO socialflow_keyword_dm_log
     (id, tenant_id, trigger_id, platform_comment_id, commenter_username, sent_at, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, platform_comment_id) DO NOTHING`,
    id,
    ctx.tenantId,
    input.triggerId,
    input.platformCommentId,
    input.commenterUsername ?? null,
    now,
    input.status,
    input.errorMessage ?? null,
  );

  const row = await queryFirst<LogRow>(
    ctx.socialDb,
    `SELECT id, tenant_id, trigger_id, platform_comment_id, commenter_username, sent_at, status, error_message
     FROM socialflow_keyword_dm_log WHERE tenant_id = ? AND platform_comment_id = ? LIMIT 1`,
    ctx.tenantId,
    input.platformCommentId,
  );
  return row ? mapLogRow(row) : null;
}

export { resolveSocialContext };
