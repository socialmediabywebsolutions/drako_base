import { resolveSocialContext, type SocialContext } from "@/lib/socialflow/repository";
import type { LeadStatus, LeadTemperature, SocialFlowLead } from "./types";

export type { SocialContext };

const leadsSchemaCache = new WeakMap<D1Database, Promise<void>>();

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

type LeadRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  thread_id: string;
  provider: string;
  sender_name: string | null;
  sender_handle: string | null;
  incoming_message: string;
  intent_score: number;
  temperature: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapLeadRow(row: LeadRow): SocialFlowLead {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    threadId: row.thread_id,
    provider: row.provider,
    senderName: row.sender_name,
    senderHandle: row.sender_handle,
    incomingMessage: row.incoming_message,
    intentScore: row.intent_score,
    temperature: row.temperature as LeadTemperature,
    status: row.status as LeadStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

async function ensureLeadsSchemaInner(db: D1Database): Promise<void> {
  await runStatement(
    db,
    `CREATE TABLE IF NOT EXISTS socialflow_leads (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      saas_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      sender_name TEXT,
      sender_handle TEXT,
      incoming_message TEXT NOT NULL,
      intent_score INTEGER NOT NULL DEFAULT 0,
      temperature TEXT NOT NULL DEFAULT 'COLD',
      status TEXT NOT NULL DEFAULT 'NEW',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  await runStatement(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sf_leads_tenant
     ON socialflow_leads (tenant_id, saas_id)`,
  );
  await runStatement(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sf_leads_temperature
     ON socialflow_leads (tenant_id, saas_id, temperature)`,
  );
  await runStatement(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sf_leads_status
     ON socialflow_leads (tenant_id, saas_id, status)`,
  );
  await runStatement(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sf_leads_thread
     ON socialflow_leads (tenant_id, saas_id, thread_id)`,
  );
}

export async function ensureLeadsSchema(db: D1Database): Promise<void> {
  const existing = leadsSchemaCache.get(db);
  if (existing) return existing;
  const promise = ensureLeadsSchemaInner(db);
  leadsSchemaCache.set(db, promise);
  try {
    await promise;
  } catch (error) {
    leadsSchemaCache.delete(db);
    throw error;
  }
}

const LEAD_COLS =
  "id, tenant_id, saas_id, thread_id, provider, sender_name, sender_handle, incoming_message, intent_score, temperature, status, created_at, updated_at";

export type CreateLeadInput = {
  threadId: string;
  provider: string;
  senderName?: string | null;
  senderHandle?: string | null;
  incomingMessage: string;
  intentScore: number;
  temperature: LeadTemperature;
};

export async function createLead(ctx: SocialContext, input: CreateLeadInput): Promise<SocialFlowLead> {
  await ensureLeadsSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const id = generateId();
  const now = nowIso();
  await runStatement(
    ctx.socialDb,
    `INSERT INTO socialflow_leads
     (id, tenant_id, saas_id, thread_id, provider, sender_name, sender_handle, incoming_message, intent_score, temperature, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    input.threadId,
    input.provider,
    input.senderName ?? null,
    input.senderHandle ?? null,
    input.incomingMessage,
    input.intentScore,
    input.temperature,
    "NEW",
    now,
    now,
  );
  const row = await queryFirst<LeadRow>(
    ctx.socialDb,
    `SELECT ${LEAD_COLS} FROM socialflow_leads WHERE tenant_id = ? AND saas_id = ? AND id = ? LIMIT 1`,
    ctx.tenantId,
    saasId,
    id,
  );
  if (!row) throw new Error("LEAD_PERSIST_FAILED");
  return mapLeadRow(row);
}

export async function listLeads(
  ctx: SocialContext,
  filters?: { temperature?: LeadTemperature | null; status?: LeadStatus | null; limit?: number },
): Promise<SocialFlowLead[]> {
  await ensureLeadsSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const clauses = ["tenant_id = ?", "saas_id = ?"];
  const params: unknown[] = [ctx.tenantId, saasId];
  if (filters?.temperature) {
    clauses.push("temperature = ?");
    params.push(filters.temperature);
  }
  if (filters?.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  const limit = filters?.limit ?? 100;
  const rows = await queryRows<LeadRow>(
    ctx.socialDb,
    `SELECT ${LEAD_COLS} FROM socialflow_leads
     WHERE ${clauses.join(" AND ")}
     ORDER BY
       CASE temperature WHEN 'HOT' THEN 1 WHEN 'WARM' THEN 2 ELSE 3 END,
       datetime(created_at) DESC
     LIMIT ?`,
    ...params,
    limit,
  );
  return rows.map(mapLeadRow);
}

export async function getLeadById(ctx: SocialContext, id: string): Promise<SocialFlowLead | null> {
  await ensureLeadsSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const row = await queryFirst<LeadRow>(
    ctx.socialDb,
    `SELECT ${LEAD_COLS} FROM socialflow_leads WHERE tenant_id = ? AND saas_id = ? AND id = ? LIMIT 1`,
    ctx.tenantId,
    saasId,
    id,
  );
  return row ? mapLeadRow(row) : null;
}

export async function updateLeadStatus(
  ctx: SocialContext,
  id: string,
  status: LeadStatus,
): Promise<SocialFlowLead | null> {
  await ensureLeadsSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  await runStatement(
    ctx.socialDb,
    `UPDATE socialflow_leads SET status = ?, updated_at = ? WHERE tenant_id = ? AND saas_id = ? AND id = ?`,
    status,
    nowIso(),
    ctx.tenantId,
    saasId,
    id,
  );
  return getLeadById(ctx, id);
}

// thread_id aquí es el id interno de socialflow_conversation_threads (el mismo que
// createLead recibe como threadId, ver inbound/route.ts y cron/social/comments), no el
// id de la plataforma (platformThreadId) — ese es el join correcto contra
// ConversationThread.id en la UI de Comunidad.
export async function listLeadTemperatureByThreadId(ctx: SocialContext): Promise<Map<string, LeadTemperature>> {
  await ensureLeadsSchema(ctx.socialDb);
  const saasId = ctx.saasId ?? "socialflow";
  const rows = await queryRows<{ thread_id: string; temperature: string }>(
    ctx.socialDb,
    `SELECT thread_id, temperature FROM socialflow_leads
     WHERE tenant_id = ? AND saas_id = ?
     ORDER BY datetime(created_at) DESC`,
    ctx.tenantId,
    saasId,
  );
  const map = new Map<string, LeadTemperature>();
  for (const row of rows) {
    // ORDER BY created_at DESC + set-once-per-key = se queda con el lead más reciente
    // si un mismo hilo llegara a tener más de uno.
    if (!map.has(row.thread_id)) map.set(row.thread_id, row.temperature as LeadTemperature);
  }
  return map;
}

export { resolveSocialContext };
