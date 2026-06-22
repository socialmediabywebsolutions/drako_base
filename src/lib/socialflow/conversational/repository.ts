import { resolveSocialContext, type SocialContext } from "@/lib/socialflow/repository";
import type {
  ConversationSettings,
  ConversationThread,
  ConversationThreadStatus,
  ConversationThreadType,
} from "@/lib/socialflow/conversational/types";

export type { SocialContext };

const convSchemaCache = new WeakMap<D1Database, Promise<void>>();

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

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type ThreadRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  thread_type: string;
  platform_thread_id: string | null;
  sender_name: string | null;
  sender_handle: string | null;
  incoming_message: string;
  context_post_id: string | null;
  suggested_reply: string | null;
  final_reply: string | null;
  status: string;
  ai_metadata: string | null;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  auto_send_enabled: number;
  auto_send_providers: string;
  updated_at: string;
};

function mapThreadRow(row: ThreadRow): ConversationThread {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    provider: row.provider,
    threadType: row.thread_type as ConversationThreadType,
    platformThreadId: row.platform_thread_id,
    senderName: row.sender_name,
    senderHandle: row.sender_handle,
    incomingMessage: row.incoming_message,
    contextPostId: row.context_post_id,
    suggestedReply: row.suggested_reply,
    finalReply: row.final_reply,
    status: row.status as ConversationThreadStatus,
    aiMetadata: parseJson<Record<string, unknown>>(row.ai_metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettingsRow(row: SettingsRow, tenantId: string, saasId: string): ConversationSettings {
  return {
    tenantId,
    saasId,
    autoSendEnabled: row.auto_send_enabled === 1,
    autoSendProviders: parseJson<string[]>(row.auto_send_providers) ?? [],
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

async function ensureConversationSchemaInner(db: D1Database): Promise<void> {
  await runStatement(
    db,
    `CREATE TABLE IF NOT EXISTS socialflow_conversation_threads (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      saas_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      thread_type TEXT NOT NULL,
      platform_thread_id TEXT,
      sender_name TEXT,
      sender_handle TEXT,
      incoming_message TEXT NOT NULL,
      context_post_id TEXT,
      suggested_reply TEXT,
      final_reply TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      ai_metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  await runStatement(
    db,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sf_conv_threads_platform
     ON socialflow_conversation_threads (tenant_id, saas_id, platform_thread_id)
     WHERE platform_thread_id IS NOT NULL`,
  );
  await runStatement(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sf_conv_threads_tenant
     ON socialflow_conversation_threads (tenant_id, saas_id)`,
  );
  await runStatement(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sf_conv_threads_status
     ON socialflow_conversation_threads (tenant_id, saas_id, status)`,
  );
  await runStatement(
    db,
    `CREATE TABLE IF NOT EXISTS socialflow_conversation_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      saas_id TEXT NOT NULL,
      auto_send_enabled INTEGER NOT NULL DEFAULT 0,
      auto_send_providers TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      UNIQUE (tenant_id, saas_id)
    )`,
  );
}

export async function ensureConversationSchema(db: D1Database): Promise<void> {
  const existing = convSchemaCache.get(db);
  if (existing) return existing;
  const promise = ensureConversationSchemaInner(db);
  convSchemaCache.set(db, promise);
  try {
    await promise;
  } catch (error) {
    convSchemaCache.delete(db);
    throw error;
  }
}

export async function listConversationThreads(
  ctx: SocialContext,
  filters?: { status?: ConversationThreadStatus | null; provider?: string | null; limit?: number },
): Promise<ConversationThread[]> {
  await ensureConversationSchema(ctx.socialDb);
  const clauses = ["tenant_id = ?", "saas_id = ?"];
  const params: unknown[] = [ctx.tenantId, ctx.saasId ?? "socialflow"];
  if (filters?.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.provider) {
    clauses.push("provider = ?");
    params.push(filters.provider);
  }
  const limit = filters?.limit ?? 50;
  const rows = await queryRows<ThreadRow>(
    ctx.socialDb,
    `SELECT id, tenant_id, saas_id, provider, thread_type, platform_thread_id, sender_name, sender_handle, incoming_message, context_post_id, suggested_reply, final_reply, status, ai_metadata, created_at, updated_at
     FROM socialflow_conversation_threads
     WHERE ${clauses.join(" AND ")}
     ORDER BY datetime(updated_at) DESC
     LIMIT ?`,
    ...params,
    limit,
  );
  return rows.map(mapThreadRow);
}

export type IngestThreadInput = {
  provider: string;
  threadType: ConversationThreadType;
  platformThreadId?: string | null;
  senderName?: string | null;
  senderHandle?: string | null;
  incomingMessage: string;
  contextPostId?: string | null;
  suggestedReply?: string | null;
  status: ConversationThreadStatus;
  aiMetadata?: Record<string, unknown> | null;
};

export async function ingestConversationThread(
  ctx: SocialContext,
  input: IngestThreadInput,
): Promise<ConversationThread> {
  await ensureConversationSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const id = generateId();
  const now = nowIso();

  await runStatement(
    ctx.socialDb,
    `INSERT INTO socialflow_conversation_threads
     (id, tenant_id, saas_id, provider, thread_type, platform_thread_id, sender_name, sender_handle, incoming_message, context_post_id, suggested_reply, final_reply, status, ai_metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, saas_id, platform_thread_id) DO NOTHING`,
    id,
    ctx.tenantId,
    saasId,
    input.provider,
    input.threadType,
    input.platformThreadId ?? null,
    input.senderName ?? null,
    input.senderHandle ?? null,
    input.incomingMessage,
    input.contextPostId ?? null,
    input.suggestedReply ?? null,
    null,
    input.status,
    input.aiMetadata ? JSON.stringify(input.aiMetadata) : null,
    now,
    now,
  );

  // If dedup hit (ON CONFLICT DO NOTHING), fetch the existing row
  if (input.platformThreadId) {
    const existing = await queryFirst<ThreadRow>(
      ctx.socialDb,
      `SELECT id, tenant_id, saas_id, provider, thread_type, platform_thread_id, sender_name, sender_handle, incoming_message, context_post_id, suggested_reply, final_reply, status, ai_metadata, created_at, updated_at
       FROM socialflow_conversation_threads
       WHERE tenant_id = ? AND saas_id = ? AND platform_thread_id = ? LIMIT 1`,
      ctx.tenantId,
      saasId,
      input.platformThreadId,
    );
    if (existing) return mapThreadRow(existing);
  }

  const row = await queryFirst<ThreadRow>(
    ctx.socialDb,
    `SELECT id, tenant_id, saas_id, provider, thread_type, platform_thread_id, sender_name, sender_handle, incoming_message, context_post_id, suggested_reply, final_reply, status, ai_metadata, created_at, updated_at
     FROM socialflow_conversation_threads
     WHERE tenant_id = ? AND saas_id = ? AND id = ? LIMIT 1`,
    ctx.tenantId,
    saasId,
    id,
  );
  if (!row) throw new Error("CONVERSATION_THREAD_PERSIST_FAILED");
  return mapThreadRow(row);
}

export async function getConversationThread(
  ctx: SocialContext,
  id: string,
): Promise<ConversationThread | null> {
  await ensureConversationSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const row = await queryFirst<ThreadRow>(
    ctx.socialDb,
    `SELECT id, tenant_id, saas_id, provider, thread_type, platform_thread_id, sender_name, sender_handle, incoming_message, context_post_id, suggested_reply, final_reply, status, ai_metadata, created_at, updated_at
     FROM socialflow_conversation_threads
     WHERE tenant_id = ? AND saas_id = ? AND id = ? LIMIT 1`,
    ctx.tenantId,
    saasId,
    id,
  );
  return row ? mapThreadRow(row) : null;
}

export async function updateConversationThread(
  ctx: SocialContext,
  id: string,
  patch: { status?: ConversationThreadStatus; finalReply?: string | null },
): Promise<ConversationThread | null> {
  await ensureConversationSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const existing = await getConversationThread(ctx, id);
  if (!existing) return null;
  const now = nowIso();
  await runStatement(
    ctx.socialDb,
    `UPDATE socialflow_conversation_threads
     SET status = ?, final_reply = ?, updated_at = ?
     WHERE tenant_id = ? AND saas_id = ? AND id = ?`,
    patch.status ?? existing.status,
    "finalReply" in patch ? (patch.finalReply ?? null) : existing.finalReply,
    now,
    ctx.tenantId,
    saasId,
    id,
  );
  return getConversationThread(ctx, id);
}

export async function getConversationSettings(ctx: SocialContext): Promise<ConversationSettings> {
  await ensureConversationSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const row = await queryFirst<SettingsRow>(
    ctx.socialDb,
    `SELECT id, tenant_id, saas_id, auto_send_enabled, auto_send_providers, updated_at
     FROM socialflow_conversation_settings
     WHERE tenant_id = ? AND saas_id = ? LIMIT 1`,
    ctx.tenantId,
    saasId,
  );
  if (!row) return { tenantId: ctx.tenantId, saasId, autoSendEnabled: false, autoSendProviders: [] };
  return mapSettingsRow(row, ctx.tenantId, saasId);
}

export async function upsertConversationSettings(
  ctx: SocialContext,
  patch: { autoSendEnabled: boolean; autoSendProviders?: string[] },
): Promise<ConversationSettings> {
  await ensureConversationSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const existing = await getConversationSettings(ctx);
  const id = generateId();
  const now = nowIso();
  const providers = patch.autoSendProviders ?? existing.autoSendProviders;
  await runStatement(
    ctx.socialDb,
    `INSERT INTO socialflow_conversation_settings (id, tenant_id, saas_id, auto_send_enabled, auto_send_providers, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
       auto_send_enabled = excluded.auto_send_enabled,
       auto_send_providers = excluded.auto_send_providers,
       updated_at = excluded.updated_at`,
    id,
    ctx.tenantId,
    saasId,
    patch.autoSendEnabled ? 1 : 0,
    JSON.stringify(providers),
    now,
  );
  return getConversationSettings(ctx);
}

export async function threadExistsByPlatformId(
  ctx: SocialContext,
  platformThreadId: string,
): Promise<boolean> {
  await ensureConversationSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const row = await queryFirst<{ id: string }>(
    ctx.socialDb,
    `SELECT id FROM socialflow_conversation_threads WHERE tenant_id = ? AND saas_id = ? AND platform_thread_id = ? LIMIT 1`,
    ctx.tenantId,
    saasId,
    platformThreadId,
  );
  return row !== null;
}

export { resolveSocialContext };
