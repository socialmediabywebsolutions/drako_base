import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  createDemoEmailMessage,
  listDemoEmailMessages,
} from "@/lib/admin/demo-data";
import { classifyEmail, detectInvoiceSubtype, extractAmountAndCurrency, extractSupplierName } from "@/lib/email-intake/classifier";
import type { EmailClassification, EmailExpenseLinkResult, EmailIntakeSnapshot, EmailStatus, SaasEmailMessage } from "@/lib/email-intake/types";
import { resolveEconomyContext, upsertSaasExpense } from "@/lib/economy/repository";
import type { SaasExpense } from "@/lib/economy/types";
import {
  createNotificationsForEmailConversation,
  ensureConversationForEmail,
  resolveConversationsContext,
} from "@/lib/conversations/repository";
import type { ConversationType, NotificationSeverity, NotificationType, SaasConversation } from "@/lib/conversations/types";

export type EmailIntakeContextMode = "d1" | "demo";

export type EmailIntakeContext = {
  tenantId: string;
  saasId: string | null;
  mode: EmailIntakeContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class EmailIntakeContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailIntakeContextError";
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

function shouldFallbackToDemo(error: unknown, ctx: EmailIntakeContext): boolean {
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
      // ignore
    }
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function requireSaasId(ctx: EmailIntakeContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new EmailIntakeContextError("saasId is required for email intake operations.");
  }
  return saasId;
}

async function queryAllWithCtx<T>(ctx: EmailIntakeContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: EmailIntakeContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

export async function resolveEmailIntakeContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<EmailIntakeContext> {
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
    };
  }

  if (!demoEnabled) {
    throw new EmailIntakeContextError("Email intake module is not enabled for this tenant");
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

type SaasEmailMessageRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  from_address: string;
  from_name: string | null;
  to_address: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  received_at: string;
  classification: string;
  sub_type: string | null;
  status: string;
  parsed_amount: number | null;
  parsed_currency: string | null;
  parsed_due_date: string | null;
  parsed_supplier_name: string | null;
  linked_expense_id: string | null;
  linked_customer_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

function mapEmailMessageRow(row: SaasEmailMessageRow): SaasEmailMessage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    fromAddress: row.from_address,
    fromName: row.from_name,
    toAddress: row.to_address,
    subject: row.subject,
    snippet: row.snippet,
    body: row.body,
    receivedAt: row.received_at,
    classification: row.classification as EmailClassification,
    subType: row.sub_type,
    status: row.status as EmailStatus,
    parsedAmount: row.parsed_amount,
    parsedCurrency: row.parsed_currency,
    parsedDueDate: row.parsed_due_date,
    parsedSupplierName: row.parsed_supplier_name,
    linkedExpenseId: row.linked_expense_id,
    linkedCustomerId: row.linked_customer_id,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function demoTenantId(ctx: EmailIntakeContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

export async function createEmailMessage(
  ctx: EmailIntakeContext,
  input: {
    saasId: string;
    fromAddress: string;
    fromName?: string | null;
    toAddress?: string | null;
    subject?: string | null;
    snippet?: string | null;
    body?: string | null;
    receivedAt: string;
    classification?: EmailClassification;
    subType?: string | null;
    status?: EmailStatus;
    parsedAmount?: number | null;
    parsedCurrency?: string | null;
    parsedDueDate?: string | null;
    parsedSupplierName?: string | null;
    linkedExpenseId?: string | null;
    linkedCustomerId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<SaasEmailMessage> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = generateUuid();
  const classification =
    input.classification ?? classifyEmail({ subject: input.subject ?? null, body: input.body ?? null, fromAddress: input.fromAddress });
  const subType = input.subType ?? detectInvoiceSubtype({ subject: input.subject ?? null, body: input.body ?? null });
  const { amount, currency } = extractAmountAndCurrency({ subject: input.subject ?? null, body: input.body ?? null });
  const supplierName = extractSupplierName({ fromName: input.fromName ?? null, fromAddress: input.fromAddress });
  if (ctx.mode === "demo") {
    const record = createDemoEmailMessage(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      from_address: input.fromAddress,
      from_name: input.fromName ?? null,
      to_address: input.toAddress ?? null,
      subject: input.subject ?? null,
      snippet: input.snippet ?? null,
      body: input.body ?? null,
      received_at: input.receivedAt,
      classification,
      sub_type: subType,
      status: input.status ?? "NEW",
      parsed_amount: input.parsedAmount ?? amount,
      parsed_currency: input.parsedCurrency ?? currency,
      parsed_due_date: input.parsedDueDate ?? null,
      parsed_supplier_name: input.parsedSupplierName ?? supplierName,
      linked_expense_id: input.linkedExpenseId ?? null,
      linked_customer_id: input.linkedCustomerId ?? null,
      metadata: serializeMetadata(input.metadata),
    });
    return mapEmailMessageRow(record);
  }
  await runWithCtx(
    ctx,
    `INSERT INTO saas_email_messages (
      id, tenant_id, saas_id, from_address, from_name, to_address, subject, snippet, body, received_at,
      classification, sub_type, status, parsed_amount, parsed_currency, parsed_due_date, parsed_supplier_name,
      linked_expense_id, linked_customer_id, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    input.fromAddress,
    input.fromName ?? null,
    input.toAddress ?? null,
    input.subject ?? null,
    input.snippet ?? null,
    input.body ?? null,
    input.receivedAt,
    classification,
    subType,
    input.status ?? "NEW",
    input.parsedAmount ?? amount,
    input.parsedCurrency ?? currency,
    input.parsedDueDate ?? null,
    input.parsedSupplierName ?? supplierName,
    input.linkedExpenseId ?? null,
    input.linkedCustomerId ?? null,
    serializeMetadata(input.metadata),
    now,
    now,
  );
  const rows = await queryAllWithCtx<SaasEmailMessageRow>(
    ctx,
    `SELECT *
     FROM saas_email_messages
     WHERE id = ?
     LIMIT 1`,
    id,
  );
  return mapEmailMessageRow(rows[0]);
}

export async function listEmailMessages(
  ctx: EmailIntakeContext,
  filters?: { classification?: EmailClassification | null; status?: EmailStatus | null; search?: string | null },
): Promise<SaasEmailMessage[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    let items = listDemoEmailMessages(demoTenantId(ctx), saasId).map(mapEmailMessageRow);
    if (filters?.classification) items = items.filter((item) => item.classification === filters.classification);
    if (filters?.status) items = items.filter((item) => item.status === filters.status);
    if (filters?.search?.trim()) {
      const search = filters.search.trim().toLowerCase();
      items = items.filter((item) => `${item.subject ?? ""} ${item.body ?? ""}`.toLowerCase().includes(search));
    }
    return items;
  }
  const conditions = ["tenant_id = ?", "saas_id = ?"];
  const params: unknown[] = [ctx.tenantId, saasId];
  if (filters?.classification) {
    conditions.push("classification = ?");
    params.push(filters.classification);
  }
  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.search?.trim()) {
    conditions.push("(lower(subject) LIKE ? OR lower(body) LIKE ?)");
    const search = `%${filters.search.trim().toLowerCase()}%`;
    params.push(search, search);
  }
  try {
    const rows = await queryAllWithCtx<SaasEmailMessageRow>(
      ctx,
      `SELECT *
       FROM saas_email_messages
       WHERE ${conditions.join(" AND ")}
       ORDER BY datetime(received_at) DESC`,
      ...params,
    );
    return rows.map(mapEmailMessageRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      let items = listDemoEmailMessages(demoTenantId(ctx), saasId).map(mapEmailMessageRow);
      if (filters?.classification) items = items.filter((item) => item.classification === filters.classification);
      if (filters?.status) items = items.filter((item) => item.status === filters.status);
      return items;
    }
    throw error;
  }
}

export async function getEmailMessage(ctx: EmailIntakeContext, id: string): Promise<SaasEmailMessage | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = listDemoEmailMessages(demoTenantId(ctx), saasId).find((item) => item.id === id);
    return record ? mapEmailMessageRow(record) : null;
  }
  const rows = await queryAllWithCtx<SaasEmailMessageRow>(
    ctx,
    `SELECT *
     FROM saas_email_messages
     WHERE id = ? AND tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    id,
    ctx.tenantId,
    saasId,
  );
  return rows[0] ? mapEmailMessageRow(rows[0]) : null;
}

export async function updateEmailMessageStatus(
  ctx: EmailIntakeContext,
  id: string,
  status?: EmailStatus | null,
  extra?: { classification?: EmailClassification | null; linkedExpenseId?: string | null; linkedCustomerId?: string | null },
): Promise<SaasEmailMessage | null> {
  const saasId = requireSaasId(ctx);
  const now = new Date().toISOString();
  if (ctx.mode === "demo") {
    const items = listDemoEmailMessages(demoTenantId(ctx), saasId);
    const record = items.find((item) => item.id === id);
    if (!record) return null;
    if (status) record.status = status;
    if (extra?.classification) record.classification = extra.classification;
    if (typeof extra?.linkedExpenseId !== "undefined") record.linked_expense_id = extra.linkedExpenseId;
    if (typeof extra?.linkedCustomerId !== "undefined") record.linked_customer_id = extra.linkedCustomerId;
    record.updated_at = now;
    return mapEmailMessageRow(record);
  }
  await runWithCtx(
    ctx,
    `UPDATE saas_email_messages
     SET status = COALESCE(?, status), classification = COALESCE(?, classification), linked_expense_id = COALESCE(?, linked_expense_id),
         linked_customer_id = COALESCE(?, linked_customer_id), updated_at = ?
     WHERE id = ? AND tenant_id = ? AND saas_id = ?`,
    status ?? null,
    extra?.classification ?? null,
    typeof extra?.linkedExpenseId === "undefined" ? null : extra.linkedExpenseId,
    typeof extra?.linkedCustomerId === "undefined" ? null : extra.linkedCustomerId,
    now,
    id,
    ctx.tenantId,
    saasId,
  );
  return getEmailMessage(ctx, id);
}

export async function updateEmailMessageMetadata(
  ctx: EmailIntakeContext,
  id: string,
  metadata: Record<string, unknown>,
): Promise<SaasEmailMessage | null> {
  const saasId = requireSaasId(ctx);
  const now = new Date().toISOString();
  const current = await getEmailMessage(ctx, id);
  if (!current) return null;
  const merged = { ...(current.metadata ?? {}), ...metadata };
  if (ctx.mode === "demo") {
    const items = listDemoEmailMessages(demoTenantId(ctx), saasId);
    const record = items.find((item) => item.id === id);
    if (!record) return null;
    record.metadata = serializeMetadata(merged);
    record.updated_at = now;
    return mapEmailMessageRow(record);
  }
  await runWithCtx(
    ctx,
    `UPDATE saas_email_messages
     SET metadata = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ? AND saas_id = ?`,
    serializeMetadata(merged),
    now,
    id,
    ctx.tenantId,
    saasId,
  );
  return getEmailMessage(ctx, id);
}

export async function ensureEmailConversation(
  emailCtx: EmailIntakeContext,
  email: SaasEmailMessage,
  params: {
    conversationType: ConversationType;
    notification: { type: NotificationType; severity: NotificationSeverity; title: string; body: string };
  },
): Promise<SaasConversation | null> {
  const existingConversationId = email.metadata?.conversationId as string | undefined;
  if (existingConversationId) return null;
  const conversationsCtx = await resolveConversationsContext({
    tenantId: emailCtx.tenantId,
    saasId: email.saasId,
    env: emailCtx.env ?? undefined,
  });
  const conversation = await ensureConversationForEmail(conversationsCtx, {
    saasId: email.saasId,
    emailMessageId: email.id,
    subject: email.subject,
    snippet: email.snippet,
    customerId: email.linkedCustomerId ?? null,
    type: params.conversationType,
  });
  await updateEmailMessageMetadata(emailCtx, email.id, { conversationId: conversation.id });
  await createNotificationsForEmailConversation(conversationsCtx, {
    conversationId: conversation.id,
    saasId: email.saasId,
    type: params.notification.type,
    severity: params.notification.severity,
    title: params.notification.title,
    body: params.notification.body,
  });
  return conversation;
}

export async function linkEmailToExpense(
  ctx: EmailIntakeContext,
  emailId: string,
  expenseInput: Omit<SaasExpense, "id" | "tenantId" | "saasId" | "createdAt" | "updatedAt"> & { saasId: string; id?: string },
): Promise<EmailExpenseLinkResult> {
  const saasId = expenseInput.saasId?.trim() ?? requireSaasId(ctx);
  const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId, env: ctx.env });
  const expense = await upsertSaasExpense(economyCtx, {
    id: expenseInput.id,
    saasId,
    type: expenseInput.type,
    label: expenseInput.label,
    amount: expenseInput.amount,
    currency: expenseInput.currency,
    period: expenseInput.period,
    fromDate: expenseInput.fromDate,
    toDate: expenseInput.toDate ?? null,
    source: expenseInput.source ?? null,
    metadata: expenseInput.metadata ?? null,
  });
  await updateEmailMessageStatus(ctx, emailId, "CONVERTED_TO_EXPENSE", { linkedExpenseId: expense.id });
  return {
    message: "Gasto vinculado a email",
    createdExpense: { id: expense.id },
  };
}

export async function getEmailIntakeSnapshot(ctx: EmailIntakeContext): Promise<EmailIntakeSnapshot> {
  const saasId = requireSaasId(ctx);
  const baseCounts = {
    INVOICE: 0,
    QUOTE: 0,
    SUPPLIER: 0,
    LEAD: 0,
    OTHER: 0,
  } as Record<EmailClassification, number>;
  const statusCounts = {
    NEW: 0,
    REVIEWED: 0,
    ARCHIVED: 0,
    CONVERTED_TO_EXPENSE: 0,
    CONVERTED_TO_LEAD: 0,
  } as Record<EmailStatus, number>;
  if (ctx.mode === "demo") {
    const items = listDemoEmailMessages(demoTenantId(ctx), saasId).map(mapEmailMessageRow);
    items.forEach((item) => {
      baseCounts[item.classification] += 1;
      statusCounts[item.status] += 1;
    });
    return {
      countsByClassification: baseCounts,
      countsByStatus: statusCounts,
      latestMessages: items.slice(0, 5),
      lastProcessedAt: items[0]?.updatedAt ?? null,
    };
  }
  const rows = await queryAllWithCtx<SaasEmailMessageRow>(
    ctx,
    `SELECT *
     FROM saas_email_messages
     WHERE tenant_id = ? AND saas_id = ?
     ORDER BY datetime(received_at) DESC`,
    ctx.tenantId,
    saasId,
  );
  const items = rows.map(mapEmailMessageRow);
  items.forEach((item) => {
    baseCounts[item.classification] += 1;
    statusCounts[item.status] += 1;
  });
  return {
    countsByClassification: baseCounts,
    countsByStatus: statusCounts,
    latestMessages: items.slice(0, 5),
    lastProcessedAt: items[0]?.updatedAt ?? null,
  };
}
