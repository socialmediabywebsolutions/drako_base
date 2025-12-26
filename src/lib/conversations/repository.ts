import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import type { SaasEmailMessage } from "@/lib/email-intake/types";
import {
  createDemoConversationMessage,
  createDemoNotification,
  listDemoConversationMessages,
  listDemoNotifications,
  listDemoSaasConversations,
  listDemoSaasCustomers,
  getDemoSaasConversation,
  markDemoNotificationRead,
  upsertDemoSaasConversation,
} from "@/lib/admin/demo-data";
import type {
  ConversationActorType,
  ConversationActorMessage,
  ConversationChannel,
  ConversationDirection,
  ConversationLinkedEntity,
  ConversationListActorItem,
  ConversationListItem,
  ConversationMetadata,
  ConversationParticipants,
  ConversationSenderType,
  ConversationStatus,
  ConversationType,
  NotificationSeverity,
  NotificationType,
  SaasConversation,
  SaasConversationMessage,
  SaasNotification,
} from "@/lib/conversations/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type ConversationsMode = "d1" | "demo";

export type ConversationsDemoStore = {
  listConversations?: typeof listDemoSaasConversations;
  upsertConversation?: typeof upsertDemoSaasConversation;
  listMessages?: typeof listDemoConversationMessages;
  createMessage?: typeof createDemoConversationMessage;
  listNotifications?: typeof listDemoNotifications;
  createNotification?: typeof createDemoNotification;
  markNotificationRead?: typeof markDemoNotificationRead;
};

export interface ConversationsContext {
  mode: ConversationsMode;
  tenantId: string;
  saasId: string | null;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
  store?: ConversationsDemoStore;
}

function applyActorFilters(
  items: ConversationListItem[],
  filters: ListActorConversationsFilters,
): ConversationListActorItem[] {
  const { actorType, actorId, unreadOnly, types, statuses } = filters;
  const normalizedTypes = types?.length ? new Set(types) : null;
  const normalizedStatuses = statuses?.length ? new Set(statuses) : null;
  return items
    .filter((item) => {
      if (normalizedTypes && (!item.type || !normalizedTypes.has(item.type))) {
        return false;
      }
      if (normalizedStatuses && (!item.conversation.status || !normalizedStatuses.has(item.conversation.status))) {
        return false;
      }
      const conversation = item.conversation;
      const metadata = normalizeConversationMetadata(conversation.metadata);
      if (!isActorParticipant(metadata, actorType, actorId)) {
        return false;
      }
      const { unreadCount } = computeUnreadCountForActor(conversation, metadata, actorType, actorId);
      if (unreadOnly && unreadCount === 0) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const conversation = item.conversation;
      const metadata = normalizeConversationMetadata(conversation.metadata);
      const { unreadCount, lastActorReadAt } = computeUnreadCountForActor(conversation, metadata, actorType, actorId);
      return {
        ...item,
        unreadForActor: unreadCount > 0,
        unreadCountForActor: unreadCount,
        lastActorReadAt,
      } satisfies ConversationListActorItem;
    })
    .sort((a, b) => {
      const aTime = a.conversation.lastMessageAt ?? a.conversation.updatedAt;
      const bTime = b.conversation.lastMessageAt ?? b.conversation.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
    .slice(0, filters.limit ?? items.length);
}

export async function listConversationsForActor(
  ctx: ConversationsContext,
  filters: ListActorConversationsFilters,
): Promise<ConversationListActorItem[]> {
  const base = await listConversations(ctx, { limit: filters.limit ?? undefined });
  return applyActorFilters(base, filters);
}

export async function getConversationForActor(
  ctx: ConversationsContext,
  params: { conversationId: string; actorType: ConversationActorType; actorId?: string | null },
): Promise<SaasConversation> {
  const conversation = await getConversation(ctx, params.conversationId);
  if (!conversation) {
    throw new ConversationNotFoundError("La conversación no existe o no está disponible.");
  }
  const metadata = normalizeConversationMetadata(conversation.metadata);
  if (!isActorParticipant(metadata, params.actorType, params.actorId)) {
    throw new ConversationAccessError("No tienes acceso a esta conversación.");
  }
  return conversation;
}

export async function listMessagesForConversation(
  ctx: ConversationsContext,
  conversationId: string,
): Promise<SaasConversationMessage[]> {
  return listConversationMessages(ctx, conversationId);
}

async function updateConversationMetadata(
  ctx: ConversationsContext,
  conversationId: string,
  metadata: ConversationMetadata,
): Promise<void> {
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const record = getDemoSaasConversation(tenant, conversationId);
    if (record) {
      upsertDemoSaasConversation(tenant, {
        ...record,
        metadata: serializeMetadata(metadata),
        updated_at: new Date().toISOString(),
      });
    }
    return;
  }
  await runWithCtx(
    ctx,
    `UPDATE saas_conversations SET metadata = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
    serializeMetadata(metadata),
    ctx.tenantId,
    conversationId,
  );
}

export interface AppendMessageForActorInput {
  conversationId: string;
  actorType: ConversationActorType;
  actorId?: string | null;
  body: string;
  direction?: ConversationDirection;
  metadata?: Partial<ConversationMetadata> | null;
}

export async function appendMessageForActor(
  ctx: ConversationsContext,
  input: AppendMessageForActorInput,
): Promise<ConversationActorMessage> {
  const conversation = await getConversationForActor(ctx, {
    conversationId: input.conversationId,
    actorType: input.actorType,
    actorId: input.actorId,
  });
  const now = new Date().toISOString();
  const metadata = ensureActorParticipantMetadata(conversation.metadata, input.actorType, input.actorId);
  if (input.metadata) {
    Object.assign(metadata, input.metadata);
  }
  const actorKey = makeActorKey(input.actorType, input.actorId);
  metadata.lastActorReadAt = { ...(metadata.lastActorReadAt ?? {}), [actorKey]: now };
  const message = await appendMessage(ctx, {
    conversationId: input.conversationId,
    customerId: null,
    employeeId: input.actorType === "EMPLOYEE" ? input.actorId ?? null : null,
    senderType: "STAFF",
    direction: input.direction ?? "OUTBOUND",
    body: input.body,
  });
  await updateConversationMetadata(ctx, input.conversationId, metadata);
  const updated = await getConversation(ctx, input.conversationId);
  const unread = computeUnreadCountForActor(
    updated ?? conversation,
    normalizeConversationMetadata(updated?.metadata ?? metadata),
    input.actorType,
    input.actorId,
  );
  return {
    message,
    conversation: updated ?? conversation,
    unreadCountForActor: unread.unreadCount,
  };
}

export async function markConversationAsReadForActor(
  ctx: ConversationsContext,
  params: { conversationId: string; actorType: ConversationActorType; actorId?: string | null },
): Promise<void> {
  const conversation = await getConversationForActor(ctx, params);
  const actorKey = makeActorKey(params.actorType, params.actorId);
  const metadata = ensureActorParticipantMetadata(conversation.metadata, params.actorType, params.actorId);
  metadata.lastActorReadAt = { ...(metadata.lastActorReadAt ?? {}), [actorKey]: new Date().toISOString() };
  await updateConversationMetadata(ctx, params.conversationId, metadata);
  // mark notifications for this actor as read
  await markNotificationsRead(ctx, {
    actorType: params.actorType,
    actorId: params.actorId,
    saasId: conversation.saasId,
    conversationId: params.conversationId,
    action: "MARK_READ",
  });
}

export interface ListNotificationsForActorParams {
  actorType: ConversationActorType;
  actorId?: string | null;
  saasId?: string | null;
  unreadOnly?: boolean;
  limit?: number | null;
}

export async function listNotificationsForActor(
  ctx: ConversationsContext,
  params: ListNotificationsForActorParams,
): Promise<SaasNotification[]> {
  const employeeIdFilter =
    params.actorType === "EMPLOYEE"
      ? params.actorId ?? undefined
      : params.actorType === "OWNER"
        ? null
        : undefined;
  const filters: ListNotificationsFilters = {
    saasId: params.saasId ?? undefined,
    employeeId: employeeIdFilter,
    unreadOnly: params.unreadOnly,
    limit: params.limit ?? undefined,
  };
  const notifications = await listNotifications(ctx, filters);
  if (params.actorType === "OWNER") {
    return notifications.filter((item) => !item.employeeId);
  }
  const normalized = params.actorId?.trim();
  return notifications.filter((item) => item.employeeId === (normalized ?? item.employeeId));
}

export interface MarkNotificationsReadParams {
  actorType: ConversationActorType;
  actorId?: string | null;
  saasId?: string | null;
  conversationId?: string | null;
  ids?: string[];
  action: "MARK_READ" | "MARK_ALL_READ";
}

export async function markNotificationsRead(
  ctx: ConversationsContext,
  params: MarkNotificationsReadParams,
): Promise<void> {
  const notifications = await listNotificationsForActor(ctx, {
    actorType: params.actorType,
    actorId: params.actorId,
    saasId: params.saasId,
    unreadOnly: true,
  });
  const filteredByConversation = params.conversationId
    ? notifications.filter(
        (item) => item.relatedEntityType === "CONVERSATION" && item.relatedEntityId === params.conversationId,
      )
    : notifications;
  let idsToMark: string[];
  if (params.action === "MARK_ALL_READ") {
    idsToMark = filteredByConversation.map((item) => item.id);
  } else {
    if (params.ids?.length) {
      const validIds = new Set(filteredByConversation.map((item) => item.id));
      idsToMark = params.ids.filter((id) => validIds.has(id));
    } else if (params.conversationId) {
      idsToMark = filteredByConversation.map((item) => item.id);
    } else {
      idsToMark = [];
    }
  }
  if (!idsToMark.length) return;
  await Promise.all(idsToMark.map((id) => markNotificationRead(ctx, id, true)));
}

export interface EnsureConversationForEmailParams {
  saasId: string;
  emailMessageId: string;
  channel?: ConversationChannel;
  subject?: string | null;
  snippet?: string | null;
  customerId?: string | null;
  type?: ConversationType;
  participants?: ConversationParticipants;
  metadata?: Partial<ConversationMetadata>;
}

export async function ensureConversationForEmail(
  ctx: ConversationsContext,
  params: EnsureConversationForEmailParams,
): Promise<SaasConversation> {
  const channel = params.channel ?? "EMAIL";
  const conversations = await listConversations(ctx, { channel, limit: 100 });
  const match = conversations.find((item) => {
    const ids = item.conversation.metadata?.emailMessageIds ?? [];
    return ids.includes(params.emailMessageId);
  });
  if (match) {
    return match.conversation;
  }
  const baseMetadata: ConversationMetadata = {
    type: params.type ?? "OTHER",
    source: "EMAIL",
    tags: ["email-intake", params.type?.toLowerCase() ?? "email"],
    participants: params.participants ?? { owners: true },
    linkedEntities: [{ type: "EMAIL", id: params.emailMessageId }],
    emailMessageIds: [params.emailMessageId],
  };
  const mergedMetadata = normalizeConversationMetadata({ ...baseMetadata, ...(params.metadata ?? {}) }) ?? baseMetadata;
  const emailIds = new Set(mergedMetadata.emailMessageIds ?? []);
  emailIds.add(params.emailMessageId);
  mergedMetadata.emailMessageIds = Array.from(emailIds);
  const linkedEntities = mergedMetadata.linkedEntities ?? [];
  if (!linkedEntities.some((entity) => entity.type === "EMAIL" && entity.id === params.emailMessageId)) {
    linkedEntities.push({ type: "EMAIL", id: params.emailMessageId });
  }
  mergedMetadata.linkedEntities = linkedEntities;
  const conversation = await createConversation(ctx, {
    saasId: params.saasId,
    customerId: params.customerId ?? null,
    channel,
    subject: params.subject ?? params.snippet ?? "Nuevo email",
    metadata: mergedMetadata,
  });
  return conversation;
}

export interface EnsureConversationForWhatsappParams {
  saasId: string;
  phoneNumber: string;
  channel?: ConversationChannel;
  subject?: string | null;
  customerId?: string | null;
  type?: ConversationType;
  participants?: ConversationParticipants;
  metadata?: Partial<ConversationMetadata>;
}

export async function ensureConversationForWhatsapp(
  ctx: ConversationsContext,
  params: EnsureConversationForWhatsappParams,
): Promise<SaasConversation> {
  const channel = params.channel ?? "WHATSAPP";
  const normalizedPhone = params.phoneNumber.trim();
  const conversations = await listConversations(ctx, { channel, limit: 100 });
  const match = conversations.find((item) => {
    const phones = item.conversation.metadata?.whatsappPhoneNumbers ?? [];
    return Array.isArray(phones) && phones.includes(normalizedPhone);
  });
  if (match) {
    return match.conversation;
  }
  const baseMetadata: ConversationMetadata = {
    type: params.type ?? "CLIENT",
    source: "WHATSAPP",
    tags: ["whatsapp", params.type?.toLowerCase() ?? "client"],
    participants: params.participants ?? { owners: true },
    linkedEntities: [{ type: "WHATSAPP", id: normalizedPhone }],
    whatsappPhoneNumbers: [normalizedPhone],
  };
  const mergedMetadata = normalizeConversationMetadata({ ...baseMetadata, ...(params.metadata ?? {}) }) ?? baseMetadata;
  const rawPhones = Array.isArray(mergedMetadata.whatsappPhoneNumbers) ? mergedMetadata.whatsappPhoneNumbers : [];
  const phoneSet = new Set(rawPhones);
  phoneSet.add(normalizedPhone);
  mergedMetadata.whatsappPhoneNumbers = Array.from(phoneSet);
  const linkedEntities = mergedMetadata.linkedEntities ?? [];
  if (!linkedEntities.some((entity) => entity.type === "WHATSAPP" && entity.id === normalizedPhone)) {
    linkedEntities.push({ type: "WHATSAPP", id: normalizedPhone });
  }
  mergedMetadata.linkedEntities = linkedEntities;
  const conversation = await createConversation(ctx, {
    saasId: params.saasId,
    customerId: params.customerId ?? null,
    channel,
    subject: params.subject ?? `WhatsApp ${normalizedPhone}`,
    metadata: mergedMetadata,
  });
  return conversation;
}

export interface CreateNotificationsForEmailConversationParams {
  conversationId: string;
  saasId: string;
  actorEmployeeIds?: string[];
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  body: string;
  relatedEntityId?: string | null;
  metadata?: Partial<ConversationMetadata>;
}

export async function createNotificationsForEmailConversation(
  ctx: ConversationsContext,
  params: CreateNotificationsForEmailConversationParams,
): Promise<void> {
  const targets: { employeeId: string | null }[] = [
    { employeeId: null },
    ...(params.actorEmployeeIds ?? []).map((id) => ({ employeeId: id })),
  ];
  await Promise.all(
    targets.map((target) =>
      createNotification(ctx, {
        saasId: params.saasId,
        employeeId: target.employeeId,
        type: params.type,
        severity: params.severity ?? "INFO",
        title: params.title,
        body: params.body,
        relatedEntityType: "CONVERSATION",
        relatedEntityId: params.conversationId,
        isRead: false,
      }),
    ),
  );
}

export interface CreateNotificationsForConversationMessageParams {
  conversation: SaasConversation;
  preview: string;
  senderActorType: ConversationActorType;
  senderActorId?: string | null;
}

export async function createNotificationsForConversationMessage(
  ctx: ConversationsContext,
  params: CreateNotificationsForConversationMessageParams,
): Promise<void> {
  const metadata = normalizeConversationMetadata(params.conversation.metadata);
  const preview = params.preview.length > 160 ? `${params.preview.slice(0, 157)}…` : params.preview;
  const employeeIds = metadata?.participants?.employeeIds ?? [];
  const normalizedSenderId = params.senderActorId?.trim() ?? null;
  let targets: { employeeId: string | null }[] = [];

  if (params.senderActorType === "OWNER") {
    targets = employeeIds.map((id) => ({ employeeId: id }));
  } else {
    targets = [{ employeeId: null }];
  }

  if (!targets.length) return;

  await Promise.all(
    targets
      .filter((target) => target.employeeId !== normalizedSenderId)
      .map((target) =>
        createNotification(ctx, {
          saasId: params.conversation.saasId,
          employeeId: target.employeeId,
          type: "CONVERSATION_NEW_MESSAGE",
          severity: "INFO",
          title: params.conversation.subject ?? "Nuevo mensaje en conversación",
          body: preview,
          relatedEntityType: "CONVERSATION",
          relatedEntityId: params.conversation.id,
          isRead: false,
        }),
      ),
  );
}

export class ConversationsContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationsContextError";
  }
}

export class ConversationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationAccessError";
  }
}

export class ConversationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationNotFoundError";
  }
}

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

function shouldFallbackToDemo(error: unknown, ctx: ConversationsContext): boolean {
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

function serializeMetadata(metadata: ConversationMetadata | Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function parseMetadata<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeConversationMetadata(
  raw: Record<string, unknown> | ConversationMetadata | null | undefined,
): ConversationMetadata | null {
  if (!raw) return null;
  const metadata = { ...(raw as ConversationMetadata) };
  if (metadata.tags && !Array.isArray(metadata.tags)) {
    metadata.tags = [String(metadata.tags)];
  }
  if (metadata.linkedEntities && !Array.isArray(metadata.linkedEntities)) {
    metadata.linkedEntities = [metadata.linkedEntities as ConversationLinkedEntity];
  }
  if (metadata.emailMessageIds && !Array.isArray(metadata.emailMessageIds)) {
    metadata.emailMessageIds = [String(metadata.emailMessageIds)];
  }
  if (metadata.participants && typeof metadata.participants === "object") {
    const participants = metadata.participants as ConversationParticipants;
    metadata.participants = {
      owners: participants.owners ?? true,
      employeeIds: Array.isArray(participants.employeeIds)
        ? participants.employeeIds.map((id) => String(id))
        : participants.employeeIds
          ? [String(participants.employeeIds)]
          : undefined,
    };
  }
  if (!metadata.participants) {
    metadata.participants = { owners: true };
  }
  metadata.lastActorReadAt = metadata.lastActorReadAt ?? {};
  return metadata;
}

function requireSaasId(ctx: ConversationsContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new ConversationsContextError("saasId is required for conversations operations.");
  }
  return saasId;
}

function demoTenantId(ctx: ConversationsContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function makeActorKey(actorType: ConversationActorType, actorId?: string | null): string {
  if (actorType === "OWNER") return "OWNER";
  const normalized = actorId?.trim();
  return normalized ? `EMPLOYEE:${normalized}` : "EMPLOYEE";
}

function isActorParticipant(
  metadata: ConversationMetadata | null,
  actorType: ConversationActorType,
  actorId?: string | null,
): boolean {
  if (!metadata?.participants) {
    return actorType === "OWNER";
  }
  const participants = metadata.participants;
  if (actorType === "OWNER") {
    return Boolean(participants.owners ?? true);
  }
  const employeeIds = participants.employeeIds ?? [];
  const normalized = actorId?.trim();
  if (!normalized) return false;
  return employeeIds.includes(normalized);
}

function getLastActorReadAt(metadata: ConversationMetadata | null, actorKey: string): string | null {
  const map = metadata?.lastActorReadAt ?? null;
  if (!map) return null;
  const value = map[actorKey];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function ensureActorParticipantMetadata(
  metadata: ConversationMetadata | null,
  actorType: ConversationActorType,
  actorId?: string | null,
): ConversationMetadata {
  const next = normalizeConversationMetadata(metadata) ?? { participants: { owners: true }, lastActorReadAt: {} };
  const participants: ConversationParticipants = next.participants ?? { owners: true };
  if (actorType === "OWNER") {
    participants.owners = true;
  } else if (actorType === "EMPLOYEE" && actorId) {
    const employees = new Set(participants.employeeIds ?? []);
    employees.add(actorId.trim());
    participants.employeeIds = Array.from(employees);
  }
  next.participants = participants;
  return next;
}

function latestRelevantTimestampForActor(conversation: SaasConversation): string | null {
  const candidates: (string | null | undefined)[] = [
    conversation.lastMessageAt,
    conversation.lastCustomerMessageAt,
    conversation.lastStaffMessageAt,
  ];
  return candidates
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort()
    .pop() ?? null;
}

function computeUnreadCountForActor(
  conversation: SaasConversation,
  metadata: ConversationMetadata | null,
  actorType: ConversationActorType,
  actorId?: string | null,
): { unreadCount: number; lastActorReadAt: string | null } {
  const actorKey = makeActorKey(actorType, actorId);
  const lastActorReadAt = getLastActorReadAt(metadata, actorKey);
  const latest = latestRelevantTimestampForActor(conversation);
  if (!latest) {
    return { unreadCount: 0, lastActorReadAt };
  }
  if (!lastActorReadAt || lastActorReadAt < latest) {
    return { unreadCount: 1, lastActorReadAt };
  }
  return { unreadCount: 0, lastActorReadAt };
}

type ConversationRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string | null;
  channel: string;
  subject: string | null;
  status: string;
  last_message_at: string | null;
  last_customer_message_at: string | null;
  last_staff_message_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  conversation_id: string;
  customer_id: string | null;
  employee_id: string | null;
  sender_type: string;
  direction: string;
  body: string;
  provider_message_id: string | null;
  created_at: string;
};

type NotificationRow = {
  id: string;
  tenant_id: string;
  saas_id: string | null;
  employee_id: string | null;
  type: string;
  severity: string;
  title: string;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: number;
  created_at: string;
};

type CustomerSummaryRow = {
  id: string;
  full_name: string;
  last_visit_at: string | null;
  preferred_employee_name: string | null;
};

function mapConversationRow(row: ConversationRow): SaasConversation {
  const rawMetadata = parseMetadata<ConversationMetadata>(row.metadata);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    customerId: row.customer_id,
    channel: row.channel as ConversationChannel,
    subject: row.subject,
    status: row.status as ConversationStatus,
    lastMessageAt: row.last_message_at,
    lastCustomerMessageAt: row.last_customer_message_at,
    lastStaffMessageAt: row.last_staff_message_at,
    metadata: normalizeConversationMetadata(rawMetadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row: MessageRow): SaasConversationMessage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    conversationId: row.conversation_id,
    customerId: row.customer_id,
    employeeId: row.employee_id,
    senderType: row.sender_type as ConversationSenderType,
    direction: row.direction as ConversationDirection,
    body: row.body,
    providerMessageId: row.provider_message_id,
    createdAt: row.created_at,
  };
}

function mapNotificationRow(row: NotificationRow): SaasNotification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    employeeId: row.employee_id,
    type: row.type as NotificationType,
    severity: row.severity as NotificationSeverity,
    title: row.title,
    body: row.body,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  };
}

async function queryAllWithCtx<T>(ctx: ConversationsContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: ConversationsContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

export async function resolveConversationsContext({
  tenantId,
  saasId,
  env,
  store,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
  store?: ConversationsDemoStore;
}): Promise<ConversationsContext> {
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
      env: runtimeEnv,
      store,
    };
  }

  if (!demoEnabled) {
    throw new Error("Conversations module is not enabled for this tenant.");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
    store,
  };
}

export interface ListConversationsFilters {
  status?: ConversationStatus | null;
  channel?: ConversationChannel | null;
  search?: string | null;
  limit?: number | null;
}

export interface ListActorConversationsFilters {
  actorType: ConversationActorType;
  actorId?: string | null;
  unreadOnly?: boolean;
  types?: ConversationType[] | null;
  statuses?: ConversationStatus[] | null;
  limit?: number | null;
}

async function fetchCustomerSummary(ctx: ConversationsContext, customerId: string | null): Promise<ConversationListItem["customerSummary"]> {
  if (!customerId) return undefined;
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const saasId = ctx.saasId ?? null;
    if (!saasId) return undefined;
    const customer = listDemoSaasCustomers(tenant, saasId).find((item) => item.id === customerId);
    if (!customer) return undefined;
    return {
      id: customer.id,
      name: customer.full_name,
      lastVisitAt: customer.updated_at ?? undefined,
      preferredEmployeeName: customer.preferred_employee_id ?? undefined,
    };
  }

  const rows = await queryAllWithCtx<CustomerSummaryRow>(
    ctx,
    `SELECT c.id, c.full_name, m.last_visit_at, e.full_name AS preferred_employee_name
       FROM saas_customers c
       LEFT JOIN saas_customer_metrics m ON m.customer_id = c.id AND m.tenant_id = c.tenant_id
       LEFT JOIN saas_employees e ON e.id = c.preferred_employee_id AND e.tenant_id = c.tenant_id
      WHERE c.tenant_id = ? AND c.id = ?
      LIMIT 1`,
    ctx.tenantId,
    customerId,
  );
  const row = rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.full_name,
    lastVisitAt: row.last_visit_at ?? undefined,
    preferredEmployeeName: row.preferred_employee_name ?? undefined,
  };
}

function computeUnreadCount(conversation: SaasConversation): number {
  if (!conversation.lastCustomerMessageAt) return 0;
  if (!conversation.lastStaffMessageAt) return 1;
  return conversation.lastCustomerMessageAt > conversation.lastStaffMessageAt ? 1 : 0;
}

async function fetchLastMessagePreview(ctx: ConversationsContext, conversationId: string): Promise<string> {
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const listMessagesFn = ctx.store?.listMessages ?? listDemoConversationMessages;
    const messages = listMessagesFn(tenant, conversationId);
    const last = messages[messages.length - 1];
    return last?.body ?? "";
  }
  const rows = await queryAllWithCtx<{ body: string }>(
    ctx,
    `SELECT body
       FROM saas_conversation_messages
      WHERE conversation_id = ? AND tenant_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 1`,
    conversationId,
    ctx.tenantId,
  );
  return rows[0]?.body ?? "";
}

export async function listConversations(ctx: ConversationsContext, filters?: ListConversationsFilters): Promise<ConversationListItem[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const listFn = ctx.store?.listConversations ?? listDemoSaasConversations;
    const conversations = listFn(tenant, saasId, {
      status: filters?.status ?? null,
      channel: filters?.channel ?? null,
      search: filters?.search ?? null,
    });
    const listCustomersFn = listDemoSaasCustomers;
    const customers = new Map(
      listCustomersFn(tenant, saasId).map((customer) => [
        customer.id,
        {
          id: customer.id,
          name: customer.full_name,
          lastVisitAt: customer.updated_at ?? undefined,
          preferredEmployeeName: customer.preferred_employee_id ?? undefined,
        },
      ]),
    );
    const listMessagesFn = ctx.store?.listMessages ?? listDemoConversationMessages;
    return conversations.slice(0, filters?.limit ?? conversations.length).map((record) => {
      const mapped = mapConversationRow({
        id: record.id,
        tenant_id: record.tenant_id,
        saas_id: record.saas_id,
        customer_id: record.customer_id,
        channel: record.channel,
        subject: record.subject,
        status: record.status,
        last_message_at: record.last_message_at,
        last_customer_message_at: record.last_customer_message_at,
        last_staff_message_at: record.last_staff_message_at,
        metadata: record.metadata,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
      const messages = listMessagesFn(tenant, record.id);
      const lastMessage = messages[messages.length - 1];
      const customerSummary = record.customer_id ? customers.get(record.customer_id) : undefined;
      return {
        conversation: mapped,
        customerSummary,
        lastMessagePreview: lastMessage?.body ?? "",
        unreadCount: computeUnreadCount(mapped),
        type: mapped.metadata?.type ?? null,
        source: mapped.metadata?.source ?? null,
        tags: mapped.metadata?.tags ?? undefined,
        linkedEntities: mapped.metadata?.linkedEntities ?? undefined,
      };
    });
  }

  try {
    const conditions = ["tenant_id = ?", "saas_id = ?"];
    const params: unknown[] = [ctx.tenantId, saasId];
    if (filters?.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.channel) {
      conditions.push("channel = ?");
      params.push(filters.channel);
    }
    if (filters?.search?.trim()) {
      conditions.push("(lower(subject) LIKE ?)");
      params.push(`%${filters.search.trim().toLowerCase()}%`);
    }
    const limitClause = filters?.limit && filters.limit > 0 ? `LIMIT ${filters.limit}` : "";
    const rows = await queryAllWithCtx<ConversationRow>(
      ctx,
      `SELECT *
         FROM saas_conversations
        WHERE ${conditions.join(" AND ")}
        ORDER BY datetime(updated_at) DESC
        ${limitClause}`,
      ...params,
    );
    const items: ConversationListItem[] = [];
    for (const row of rows) {
      const conversation = mapConversationRow(row);
      const [customerSummary, lastMessagePreview] = await Promise.all([
        fetchCustomerSummary(ctx, conversation.customerId),
        fetchLastMessagePreview(ctx, conversation.id),
      ]);
      items.push({
        conversation,
        customerSummary,
        lastMessagePreview,
        unreadCount: computeUnreadCount(conversation),
        type: conversation.metadata?.type ?? null,
        source: conversation.metadata?.source ?? null,
        tags: conversation.metadata?.tags ?? undefined,
        linkedEntities: conversation.metadata?.linkedEntities ?? undefined,
      });
    }
    return items;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listConversations(
        {
          ...ctx,
          mode: "demo",
          db: undefined,
        },
        filters,
      );
    }
    throw error;
  }
}

export async function getConversation(ctx: ConversationsContext, conversationId: string): Promise<SaasConversation | null> {
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const listFn = ctx.store?.listConversations ?? listDemoSaasConversations;
    const match = listFn(tenant, ctx.saasId ?? "", undefined).find((item) => item.id === conversationId);
    if (!match) return null;
    return mapConversationRow({
      id: match.id,
      tenant_id: match.tenant_id,
      saas_id: match.saas_id,
      customer_id: match.customer_id,
      channel: match.channel,
      subject: match.subject,
      status: match.status,
      last_message_at: match.last_message_at,
      last_customer_message_at: match.last_customer_message_at,
      last_staff_message_at: match.last_staff_message_at,
      metadata: match.metadata,
      created_at: match.created_at,
      updated_at: match.updated_at,
    });
  }

  try {
    const rows = await queryAllWithCtx<ConversationRow>(
      ctx,
      `SELECT *
         FROM saas_conversations
        WHERE tenant_id = ? AND id = ?
        LIMIT 1`,
      ctx.tenantId,
      conversationId,
    );
    const row = rows[0];
    return row ? mapConversationRow(row) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      ctx.mode = "demo";
      return getConversation(ctx, conversationId);
    }
    throw error;
  }
}

export async function listConversationMessages(ctx: ConversationsContext, conversationId: string): Promise<SaasConversationMessage[]> {
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const listFn = ctx.store?.listMessages ?? listDemoConversationMessages;
    return listFn(tenant, conversationId).map((row) =>
      mapMessageRow({
        id: row.id,
        tenant_id: row.tenant_id,
        saas_id: row.saas_id,
        conversation_id: row.conversation_id,
        customer_id: row.customer_id,
        employee_id: row.employee_id,
        sender_type: row.sender_type,
        direction: row.direction,
        body: row.body,
        provider_message_id: row.provider_message_id,
        created_at: row.created_at,
      }),
    );
  }
  try {
    const rows = await queryAllWithCtx<MessageRow>(
      ctx,
      `SELECT *
         FROM saas_conversation_messages
        WHERE tenant_id = ? AND conversation_id = ?
        ORDER BY datetime(created_at) ASC`,
      ctx.tenantId,
      conversationId,
    );
    return rows.map(mapMessageRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      ctx.mode = "demo";
      return listConversationMessages(ctx, conversationId);
    }
    throw error;
  }
}

export interface AppendMessageInput {
  conversationId: string;
  customerId?: string | null;
  employeeId?: string | null;
  senderType: ConversationSenderType;
  direction: ConversationDirection;
  body: string;
  providerMessageId?: string | null;
  createdAt?: string;
}

export async function appendMessage(ctx: ConversationsContext, input: AppendMessageInput): Promise<SaasConversationMessage> {
  const now = input.createdAt ?? new Date().toISOString();
  const messageId = generateUuid();

  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const createFn = ctx.store?.createMessage ?? createDemoConversationMessage;
    const record = createFn(tenant, {
      id: messageId,
      saas_id: ctx.saasId ?? input.conversationId,
      conversation_id: input.conversationId,
      customer_id: typeof input.customerId === "undefined" ? null : input.customerId,
      employee_id: typeof input.employeeId === "undefined" ? null : input.employeeId,
      sender_type: input.senderType,
      direction: input.direction,
      body: input.body,
      provider_message_id: input.providerMessageId ?? null,
      created_at: now,
    });
    return mapMessageRow({
      id: record.id,
      tenant_id: record.tenant_id,
      saas_id: record.saas_id,
      conversation_id: record.conversation_id,
      customer_id: record.customer_id,
      employee_id: record.employee_id,
      sender_type: record.sender_type,
      direction: record.direction,
      body: record.body,
      provider_message_id: record.provider_message_id,
      created_at: record.created_at,
    });
  }

  try {
    const conversation = await getConversation(ctx, input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${input.conversationId} not found`);
    }
    await runWithCtx(
      ctx,
      `INSERT INTO saas_conversation_messages (
        id, tenant_id, saas_id, conversation_id, customer_id, employee_id, sender_type, direction, body, provider_message_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      messageId,
      ctx.tenantId,
      conversation.saasId,
      input.conversationId,
      input.customerId ?? null,
      input.employeeId ?? null,
      input.senderType,
      input.direction,
      input.body,
      input.providerMessageId ?? null,
      now,
    );

    const lastCustomerMessageAt =
      input.senderType === "CUSTOMER" && input.direction === "INBOUND" ? now : conversation.lastCustomerMessageAt;
    const lastStaffMessageAt = input.senderType === "STAFF" ? now : conversation.lastStaffMessageAt;
    const nextStatus =
      input.senderType === "CUSTOMER" && input.direction === "INBOUND" && conversation.status === "RESOLVED"
        ? "OPEN"
        : conversation.status;
    await runWithCtx(
      ctx,
      `UPDATE saas_conversations
         SET last_message_at = ?,
             last_customer_message_at = ?,
             last_staff_message_at = ?,
             status = ?,
             updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      now,
      lastCustomerMessageAt,
      lastStaffMessageAt,
      nextStatus,
      now,
      input.conversationId,
      ctx.tenantId,
    );

    return {
      id: messageId,
      tenantId: ctx.tenantId,
      saasId: conversation.saasId,
      conversationId: input.conversationId,
      customerId: input.customerId ?? null,
      employeeId: input.employeeId ?? null,
      senderType: input.senderType,
      direction: input.direction,
      body: input.body,
      providerMessageId: input.providerMessageId ?? null,
      createdAt: now,
    };
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      ctx.mode = "demo";
      return appendMessage(ctx, input);
    }
    throw error;
  }
}

export interface CreateConversationInput {
  saasId: string;
  customerId?: string | null;
  channel: ConversationChannel;
  subject?: string | null;
  status?: ConversationStatus;
  metadata?: Record<string, unknown> | null;
}

export async function createConversation(ctx: ConversationsContext, input: CreateConversationInput): Promise<SaasConversation> {
  const now = new Date().toISOString();
  const conversationId = generateUuid();
  const status = input.status ?? "OPEN";
  const normalizedMetadata = normalizeConversationMetadata(input.metadata ?? null);

  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const upsertFn = ctx.store?.upsertConversation ?? upsertDemoSaasConversation;
    const record = upsertFn(tenant, {
      id: conversationId,
      saas_id: input.saasId,
      customer_id: typeof input.customerId === "undefined" ? null : input.customerId,
      channel: input.channel,
      subject: typeof input.subject === "undefined" ? null : input.subject,
      status,
      metadata: serializeMetadata(normalizedMetadata),
      last_message_at: null,
      last_customer_message_at: null,
      last_staff_message_at: null,
      created_at: now,
      updated_at: now,
    });
    return mapConversationRow({
      id: record.id,
      tenant_id: record.tenant_id,
      saas_id: record.saas_id,
      customer_id: record.customer_id,
      channel: record.channel,
      subject: record.subject,
      status: record.status,
      last_message_at: record.last_message_at,
      last_customer_message_at: record.last_customer_message_at,
      last_staff_message_at: record.last_staff_message_at,
      metadata: record.metadata,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
  }

  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_conversations (
        id, tenant_id, saas_id, customer_id, channel, subject, status, last_message_at, last_customer_message_at,
        last_staff_message_at, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
      conversationId,
      ctx.tenantId,
      input.saasId,
      input.customerId ?? null,
      input.channel,
      input.subject ?? null,
      status,
      serializeMetadata(normalizedMetadata),
      now,
      now,
    );
    return {
      id: conversationId,
      tenantId: ctx.tenantId,
      saasId: input.saasId,
      customerId: input.customerId ?? null,
      channel: input.channel,
      subject: input.subject ?? null,
      status,
      lastMessageAt: null,
      lastCustomerMessageAt: null,
      lastStaffMessageAt: null,
      metadata: normalizedMetadata,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      ctx.mode = "demo";
      return createConversation(ctx, input);
    }
    throw error;
  }
}

export interface ListNotificationsFilters {
  saasId?: string | null;
  employeeId?: string | null;
  unreadOnly?: boolean;
  limit?: number | null;
}

export async function listNotifications(ctx: ConversationsContext, filters?: ListNotificationsFilters): Promise<SaasNotification[]> {
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const listFn = ctx.store?.listNotifications ?? listDemoNotifications;
    return listFn(tenant, {
      saasId: filters?.saasId ?? ctx.saasId ?? null,
      employeeId: filters?.employeeId ?? null,
      unreadOnly: filters?.unreadOnly ?? false,
    }).map((row) =>
      mapNotificationRow({
        id: row.id,
        tenant_id: row.tenant_id,
        saas_id: row.saas_id,
        employee_id: row.employee_id,
        type: row.type,
        severity: row.severity,
        title: row.title,
        body: row.body,
        related_entity_type: row.related_entity_type,
        related_entity_id: row.related_entity_id,
        is_read: row.is_read,
        created_at: row.created_at,
      }),
    );
  }

  try {
    const conditions = ["tenant_id = ?"];
    const params: unknown[] = [ctx.tenantId];
    if (typeof filters?.saasId !== "undefined") {
      if (filters.saasId === null) {
        conditions.push("saas_id IS NULL");
      } else {
        conditions.push("saas_id = ?");
        params.push(filters.saasId);
      }
    }
    if (typeof filters?.employeeId !== "undefined") {
      if (!filters.employeeId) {
        conditions.push("employee_id IS NULL");
      } else {
        conditions.push("employee_id = ?");
        params.push(filters.employeeId);
      }
    }
    if (filters?.unreadOnly) {
      conditions.push("is_read = 0");
    }
    const limitClause = filters?.limit && filters.limit > 0 ? `LIMIT ${filters.limit}` : "";
    const rows = await queryAllWithCtx<NotificationRow>(
      ctx,
      `SELECT *
         FROM saas_notifications
        WHERE ${conditions.join(" AND ")}
        ORDER BY datetime(created_at) DESC
        ${limitClause}`,
      ...params,
    );
    return rows.map(mapNotificationRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      ctx.mode = "demo";
      return listNotifications(ctx, filters);
    }
    throw error;
  }
}

export interface CreateNotificationInput {
  saasId?: string | null;
  employeeId?: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  isRead?: boolean;
  createdAt?: string;
}

export async function createNotification(ctx: ConversationsContext, input: CreateNotificationInput): Promise<SaasNotification> {
  const now = input.createdAt ?? new Date().toISOString();
  const id = generateUuid();

  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const createFn = ctx.store?.createNotification ?? createDemoNotification;
    const record = createFn(tenant, {
      id,
      saas_id: typeof input.saasId === "undefined" ? ctx.saasId ?? null : input.saasId,
      employee_id: typeof input.employeeId === "undefined" ? null : input.employeeId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      body: input.body,
      related_entity_type: typeof input.relatedEntityType === "undefined" ? null : input.relatedEntityType,
      related_entity_id: typeof input.relatedEntityId === "undefined" ? null : input.relatedEntityId,
      is_read: input.isRead ? 1 : 0,
      created_at: now,
    });
    return mapNotificationRow({
      id: record.id,
      tenant_id: record.tenant_id,
      saas_id: record.saas_id,
      employee_id: record.employee_id,
      type: record.type,
      severity: record.severity,
      title: record.title,
      body: record.body,
      related_entity_type: record.related_entity_type,
      related_entity_id: record.related_entity_id,
      is_read: record.is_read,
      created_at: record.created_at,
    });
  }

  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_notifications (
        id, tenant_id, saas_id, employee_id, type, severity, title, body, related_entity_type, related_entity_id, is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      ctx.tenantId,
      typeof input.saasId === "undefined" ? ctx.saasId ?? null : input.saasId,
      typeof input.employeeId === "undefined" ? null : input.employeeId,
      input.type,
      input.severity,
      input.title,
      input.body,
      typeof input.relatedEntityType === "undefined" ? null : input.relatedEntityType,
      typeof input.relatedEntityId === "undefined" ? null : input.relatedEntityId,
      input.isRead ? 1 : 0,
      now,
    );
    return {
      id,
      tenantId: ctx.tenantId,
      saasId: typeof input.saasId === "undefined" ? ctx.saasId ?? null : input.saasId,
      employeeId: typeof input.employeeId === "undefined" ? null : input.employeeId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      body: input.body,
      relatedEntityType: typeof input.relatedEntityType === "undefined" ? null : input.relatedEntityType,
      relatedEntityId: typeof input.relatedEntityId === "undefined" ? null : input.relatedEntityId,
      isRead: Boolean(input.isRead),
      createdAt: now,
    };
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      ctx.mode = "demo";
      return createNotification(ctx, input);
    }
    throw error;
  }
}

export async function markNotificationRead(ctx: ConversationsContext, notificationId: string, isRead: boolean): Promise<SaasNotification | null> {
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const markFn = ctx.store?.markNotificationRead ?? markDemoNotificationRead;
    const record = markFn(tenant, notificationId, isRead);
    return record
      ? mapNotificationRow({
          id: record.id,
          tenant_id: record.tenant_id,
          saas_id: record.saas_id,
          employee_id: record.employee_id,
          type: record.type,
          severity: record.severity,
          title: record.title,
          body: record.body,
          related_entity_type: record.related_entity_type,
          related_entity_id: record.related_entity_id,
          is_read: record.is_read,
          created_at: record.created_at,
        })
      : null;
  }

  try {
    const updated = await runWithCtx(
      ctx,
      `UPDATE saas_notifications SET is_read = ? WHERE tenant_id = ? AND id = ?`,
      isRead ? 1 : 0,
      ctx.tenantId,
      notificationId,
    );
    if (!updated) return null;
    const rows = await queryAllWithCtx<NotificationRow>(
      ctx,
      `SELECT * FROM saas_notifications WHERE tenant_id = ? AND id = ? LIMIT 1`,
      ctx.tenantId,
      notificationId,
    );
    return rows[0] ? mapNotificationRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      ctx.mode = "demo";
      return markNotificationRead(ctx, notificationId, isRead);
    }
    throw error;
  }
}

export interface EnsureConversationResult {
  conversation: SaasConversation;
  message: SaasConversationMessage;
}

export async function ensureConversationForEmailLead(
  ctx: ConversationsContext,
  email: SaasEmailMessage,
  options?: { severity?: NotificationSeverity },
): Promise<EnsureConversationResult> {
  const saasId = email.saasId ?? ctx.saasId ?? "";
  if (!saasId) {
    throw new Error("saasId is required to ensure email conversation.");
  }

  const filters: ListConversationsFilters = { channel: "EMAIL", limit: 20 };
  const conversations = await listConversations(ctx, filters);
  let existing = conversations.find((item) => item.conversation.customerId && item.conversation.customerId === email.linkedCustomerId);
  if (!existing && email.subject) {
    const normalizedSubject = email.subject.trim().toLowerCase();
    existing = conversations.find((item) => (item.conversation.subject ?? "").trim().toLowerCase() === normalizedSubject);
  }

  let conversation = existing?.conversation;
  if (!conversation) {
    conversation = await createConversation(ctx, {
      saasId,
      customerId: email.linkedCustomerId ?? null,
      channel: "EMAIL",
      subject: email.subject ?? email.snippet ?? "Email lead",
      status: "OPEN",
      metadata: { emailThreadId: email.metadata?.threadId ?? email.id },
    });
  }

  const messageBody = email.body ?? email.snippet ?? "Nuevo mensaje de email";
  const message = await appendMessage(ctx, {
    conversationId: conversation.id,
    customerId: email.linkedCustomerId ?? null,
    senderType: "CUSTOMER",
    direction: "INBOUND",
    body: messageBody,
    providerMessageId: email.id,
    createdAt: email.receivedAt,
  });

  await createNotification(ctx, {
    saasId,
    employeeId: null,
    type: "EMAIL_LEAD",
    severity: options?.severity ?? "INFO",
    title: email.subject ?? "Nuevo lead desde email",
    body: email.snippet ?? messageBody.slice(0, 140),
    relatedEntityType: "CONVERSATION",
    relatedEntityId: conversation.id,
    isRead: false,
    createdAt: email.receivedAt,
  });

  return { conversation, message };
}
