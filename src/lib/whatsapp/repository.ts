import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import {
  addDemoWhatsappMessage,
  getDemoWhatsappIdentityByPhone,
  listDemoWhatsappIdentities,
  listDemoWhatsappMessagesForPhone,
  upsertDemoWhatsappIdentity,
  updateDemoWhatsappMessage,
} from "@/lib/admin/demo-data";
import type { DemoWhatsappIdentity, DemoWhatsappMessage } from "@/lib/admin/demo-data";
import type { WhatsappActorIdentity, WhatsappIdentity, WhatsappMessage, WhatsappActorType, WhatsappIntent } from "@/lib/whatsapp/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type WhatsappContextMode = "d1" | "demo";

export type WhatsappContext = {
  tenantId: string;
  saasId: string | null;
  mode: WhatsappContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class WhatsappContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsappContextError";
  }
}

type WhatsappIdentityRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  actor_type: string;
  actor_id: string;
  phone_number: string;
  preferred_language: string | null;
  allowed_channels: string | null;
  consent_flags: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type WhatsappMessageRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  phone_number: string;
  direction: string;
  actor_type: string | null;
  actor_id: string | null;
  conversation_id: string | null;
  body: string;
  intent: string | null;
  status: string;
  provider_message_id: string | null;
  metadata: string | null;
  created_at: string;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function hasDatabase(envOverride?: DracoEnv | null): boolean {
  return Boolean(resolveEnvOverride(envOverride)?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string, envOverride?: DracoEnv | null): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const runtimeEnv = resolveEnvOverride(envOverride);
  const flag = runtimeEnv?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

function shouldFallbackToDemo(error: unknown, ctx: WhatsappContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function generateUuid(): string {
  const globalCrypto = typeof globalThis !== "undefined" ? (globalThis.crypto as { randomUUID?: () => string } | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoTenantId(ctx: WhatsappContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function requireSaasId(ctx: WhatsappContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) throw new WhatsappContextError("saasId is required for WhatsApp.");
  return saasId;
}

function mapIdentityRow(row: WhatsappIdentityRow): WhatsappIdentity {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    actorType: row.actor_type as WhatsappActorType,
    actorId: row.actor_id,
    phoneNumber: row.phone_number,
    preferredLanguage: row.preferred_language,
    allowedChannels: row.allowed_channels ? JSON.parse(row.allowed_channels) : null,
    consentFlags: row.consent_flags ? JSON.parse(row.consent_flags) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row: WhatsappMessageRow): WhatsappMessage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    phoneNumber: row.phone_number,
    direction: row.direction as WhatsappMessage["direction"],
    actorType: row.actor_type as WhatsappActorType | null,
    actorId: row.actor_id,
    conversationId: row.conversation_id,
    body: row.body,
    intent: row.intent as WhatsappIntent | null,
    status: row.status as WhatsappMessage["status"],
    providerMessageId: row.provider_message_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
  };
}

function demoIdentityToRow(record: DemoWhatsappIdentity): WhatsappIdentityRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    actor_type: record.actor_type,
    actor_id: record.actor_id,
    phone_number: record.phone_number,
    preferred_language: record.preferred_language ?? null,
    allowed_channels: record.allowed_channels ?? null,
    consent_flags: record.consent_flags ?? null,
    metadata: record.metadata ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function demoMessageToRow(record: DemoWhatsappMessage): WhatsappMessageRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    phone_number: record.phone_number,
    direction: record.direction,
    actor_type: record.actor_type ?? null,
    actor_id: record.actor_id ?? null,
    conversation_id: record.conversation_id ?? null,
    body: record.body,
    intent: record.intent ?? null,
    status: record.status,
    provider_message_id: record.provider_message_id ?? null,
    metadata: record.metadata ?? null,
    created_at: record.created_at,
  };
}

export async function resolveWhatsappContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<WhatsappContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env,
    };
  }

  if (!demoEnabled) {
    throw new WhatsappContextError("WhatsApp module is not enabled for this tenant.");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
  };
}

export async function listWhatsappIdentities(ctx: WhatsappContext): Promise<WhatsappIdentity[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoWhatsappIdentities(demoTenantId(ctx), saasId).map((row) => mapIdentityRow(demoIdentityToRow(row)));
  }
  try {
    const rows = await queryAll<WhatsappIdentityRow>(
      `SELECT id, tenant_id, saas_id, actor_type, actor_id, phone_number, preferred_language, allowed_channels, consent_flags, metadata, created_at, updated_at
       FROM saas_whatsapp_identities
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapIdentityRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoWhatsappIdentities(demoTenantId(ctx), saasId).map((row) => mapIdentityRow(demoIdentityToRow(row)));
    }
    throw error;
  }
}

export async function getWhatsappIdentityByPhone(
  ctx: WhatsappContext,
  phoneNumber: string,
): Promise<WhatsappIdentity | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = getDemoWhatsappIdentityByPhone(demoTenantId(ctx), saasId, phoneNumber);
    return record ? mapIdentityRow(demoIdentityToRow(record)) : null;
  }
  try {
    const rows = await queryAll<WhatsappIdentityRow>(
      `SELECT id, tenant_id, saas_id, actor_type, actor_id, phone_number, preferred_language, allowed_channels, consent_flags, metadata, created_at, updated_at
       FROM saas_whatsapp_identities
       WHERE tenant_id = ? AND saas_id = ? AND phone_number = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      phoneNumber,
    );
    return rows[0] ? mapIdentityRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoWhatsappIdentityByPhone(demoTenantId(ctx), saasId, phoneNumber);
      return record ? mapIdentityRow(demoIdentityToRow(record)) : null;
    }
    throw error;
  }
}

export async function upsertWhatsappIdentity(
  ctx: WhatsappContext,
  input: WhatsappActorIdentity & { saasId?: string | null },
): Promise<WhatsappIdentity> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = generateUuid();
  const payload = {
    id,
    tenant_id: ctx.tenantId,
    saas_id: saasId,
    actor_type: input.actorType,
    actor_id: input.actorId,
    phone_number: input.phoneNumber,
    preferred_language: input.preferredLanguage ?? null,
    allowed_channels: input.allowedChannels ? JSON.stringify(input.allowedChannels) : null,
    consent_flags: input.consentFlags ? JSON.stringify(input.consentFlags) : null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: now,
    updated_at: now,
  };

  if (ctx.mode === "demo") {
    const record = upsertDemoWhatsappIdentity(demoTenantId(ctx), payload);
    return mapIdentityRow(demoIdentityToRow(record));
  }

  try {
    await run(
      `INSERT INTO saas_whatsapp_identities (
         id, tenant_id, saas_id, actor_type, actor_id, phone_number, preferred_language,
         allowed_channels, consent_flags, metadata, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, saas_id, phone_number) DO UPDATE SET
         actor_type = excluded.actor_type,
         actor_id = excluded.actor_id,
         preferred_language = excluded.preferred_language,
         allowed_channels = excluded.allowed_channels,
         consent_flags = excluded.consent_flags,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      payload.id,
      payload.tenant_id,
      payload.saas_id,
      payload.actor_type,
      payload.actor_id,
      payload.phone_number,
      payload.preferred_language,
      payload.allowed_channels,
      payload.consent_flags,
      payload.metadata,
      payload.created_at,
      payload.updated_at,
    );
    const record = await getWhatsappIdentityByPhone(ctx, input.phoneNumber);
    if (!record) throw new Error("Identity write failed");
    return record;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoWhatsappIdentity(demoTenantId(ctx), payload);
      return mapIdentityRow(demoIdentityToRow(record));
    }
    throw error;
  }
}

export async function ensureWhatsappIdentityForActor(
  ctx: WhatsappContext,
  input: WhatsappActorIdentity & { saasId?: string | null },
): Promise<WhatsappIdentity> {
  const existing = await getWhatsappIdentityByPhone(ctx, input.phoneNumber);
  if (existing) return existing;
  return upsertWhatsappIdentity(ctx, input);
}

export async function recordWhatsappMessage(
  ctx: WhatsappContext,
  input: Omit<WhatsappMessage, "id" | "tenantId" | "createdAt">,
): Promise<WhatsappMessage> {
  const saasId = requireSaasId(ctx);
  const now = new Date().toISOString();
  const recordId = generateUuid();
  const payload = {
    id: recordId,
    tenant_id: ctx.tenantId,
    saas_id: saasId,
    phone_number: input.phoneNumber,
    direction: input.direction,
    actor_type: input.actorType,
    actor_id: input.actorId,
    conversation_id: input.conversationId ?? null,
    body: input.body,
    intent: input.intent ?? null,
    status: input.status,
    provider_message_id: input.providerMessageId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: now,
  };

  if (ctx.mode === "demo") {
    const record = addDemoWhatsappMessage(demoTenantId(ctx), payload);
    return mapMessageRow(demoMessageToRow(record));
  }

  try {
    await run(
      `INSERT INTO saas_whatsapp_messages (
         id, tenant_id, saas_id, phone_number, direction, actor_type, actor_id, conversation_id,
         body, intent, status, provider_message_id, metadata, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      payload.id,
      payload.tenant_id,
      payload.saas_id,
      payload.phone_number,
      payload.direction,
      payload.actor_type,
      payload.actor_id,
      payload.conversation_id,
      payload.body,
      payload.intent,
      payload.status,
      payload.provider_message_id,
      payload.metadata,
      payload.created_at,
    );
    return mapMessageRow(payload);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = addDemoWhatsappMessage(demoTenantId(ctx), payload);
      return mapMessageRow(demoMessageToRow(record));
    }
    throw error;
  }
}

export async function linkWhatsappMessageToConversation(
  ctx: WhatsappContext,
  messageId: string,
  conversationId: string,
): Promise<void> {
  if (ctx.mode === "demo") {
    updateDemoWhatsappMessage(demoTenantId(ctx), messageId, { conversation_id: conversationId });
    return;
  }
  try {
    await run(
      `UPDATE saas_whatsapp_messages
       SET conversation_id = ?
       WHERE tenant_id = ? AND id = ?`,
      conversationId,
      ctx.tenantId,
      messageId,
    );
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      addDemoWhatsappMessage(demoTenantId(ctx), { id: messageId, conversation_id: conversationId } as DemoWhatsappMessage);
      return;
    }
    throw error;
  }
}

export async function listWhatsappMessagesForPhone(
  ctx: WhatsappContext,
  phoneNumber: string,
  opts?: { limit?: number },
): Promise<WhatsappMessage[]> {
  const saasId = requireSaasId(ctx);
  const limit = opts?.limit ?? 20;
  if (ctx.mode === "demo") {
    return listDemoWhatsappMessagesForPhone(demoTenantId(ctx), saasId, phoneNumber, limit).map((row) => mapMessageRow(demoMessageToRow(row)));
  }
  try {
    const rows = await queryAll<WhatsappMessageRow>(
      `SELECT id, tenant_id, saas_id, phone_number, direction, actor_type, actor_id, conversation_id, body, intent, status,
              provider_message_id, metadata, created_at
       FROM saas_whatsapp_messages
       WHERE tenant_id = ? AND saas_id = ? AND phone_number = ?
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
      ctx.tenantId,
      saasId,
      phoneNumber,
      limit,
    );
    return rows.map(mapMessageRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoWhatsappMessagesForPhone(demoTenantId(ctx), saasId, phoneNumber, limit).map((row) => mapMessageRow(demoMessageToRow(row)));
    }
    throw error;
  }
}
