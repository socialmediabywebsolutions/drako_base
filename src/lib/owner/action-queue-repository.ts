import { queryAll, run } from "@/lib/db";
import type { OwnerGrowthAutopilotAction } from "@/lib/owner/types";
import type { OwnerActionQueuePriority } from "@/lib/owner/action-queue";
import { recordCampamentoEvent } from "@/lib/empire/events";

export type CampamentoActionStatus = "OPEN" | "DISMISSED" | "EXECUTED" | "SNOOZED";

export type CampamentoActionRow = {
  id: string;
  tenant_id: string;
  saas_id: string | null;
  saas_slug: string | null;
  category: string;
  priority: OwnerActionQueuePriority;
  source: string;
  title: string;
  summary: string;
  description: string;
  action_key: string;
  status: CampamentoActionStatus;
  correlation_id: string | null;
  last_seen_at: string | null;
  seen_count: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  snoozed_until: string | null;
};

function createActionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `act_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeCategory(category: string): string {
  const normalized = category.trim().toUpperCase();
  const allowed = new Set([
    "PRICING",
    "MARKETING",
    "DEPARTMENT_COVERAGE",
    "SAAS_HEALTH",
    "ECONOMY",
    "RISK",
    "OPPORTUNITY",
    "BILLING",
    "SECURITY",
    "ROUTING",
    "OTHER",
  ]);
  return allowed.has(normalized) ? normalized : "OTHER";
}

function buildActionKey(params: { category: string; title: string; saasId?: string | null }): string {
  const base = `${normalizeCategory(params.category)}:${params.saasId ?? "global"}:${params.title}`;
  return base.trim().toLowerCase();
}

async function findOpenActionByKey(params: {
  tenantId: string;
  actionKey: string;
}): Promise<CampamentoActionRow | null> {
  const rows = await queryAll<CampamentoActionRow>(
    `SELECT * FROM campamento_actions
     WHERE tenant_id = ? AND action_key = ? AND status = 'OPEN'
     ORDER BY created_at DESC
     LIMIT 1`,
    params.tenantId,
    params.actionKey,
  );
  return rows[0] ?? null;
}

async function recordActionEvent(params: {
  tenantId: string;
  saasId?: string | null;
  saasSlug?: string | null;
  type: string;
  message: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}) {
  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    type: params.type,
    severity: "INFO",
    source: "ACTION_QUEUE",
    message: params.message,
    metadata: { saasSlug: params.saasSlug ?? null, ...params.metadata },
    correlationId: params.correlationId,
  });
}

export async function createOrMergeActionFromAutopilot(params: {
  tenantId: string;
  action: OwnerGrowthAutopilotAction;
  priority: OwnerActionQueuePriority;
  source: string;
  now?: Date;
}): Promise<CampamentoActionRow | null> {
  const now = params.now ?? new Date();
  const timestamp = now.toISOString();
  const saasId = params.action.target.type === "SAAS" ? params.action.target.saasId ?? null : null;
  const category = normalizeCategory(params.action.category);
  const actionKey = buildActionKey({ category, title: params.action.title, saasId });
  const correlationId = params.action.id ?? `action_${Date.now()}`;
  const existing = await findOpenActionByKey({
    tenantId: params.tenantId,
    actionKey,
  });

  const metadata = params.action.metadata ? JSON.stringify(params.action.metadata) : null;

  if (existing) {
    const priorityRank: Record<OwnerActionQueuePriority, number> = {
      CRITICAL: 3,
      HIGH: 2,
      NORMAL: 1,
      LOW: 0,
    };
    const nextPriority =
      priorityRank[params.priority] > priorityRank[existing.priority] ? params.priority : existing.priority;
    const seenCount = (existing.seen_count ?? 0) + 1;
    await run(
      `UPDATE campamento_actions
       SET priority = ?, source = ?, summary = ?, description = ?, metadata = ?, updated_at = ?, last_seen_at = ?, seen_count = ?
       WHERE id = ? AND tenant_id = ?`,
      nextPriority,
      params.source,
      params.action.description,
      params.action.description,
      metadata,
      timestamp,
      timestamp,
      seenCount,
      existing.id,
      params.tenantId,
    );
    await recordActionEvent({
      tenantId: params.tenantId,
      saasId,
      saasSlug: existing.saas_slug ?? null,
      type: "autopilot.action.proposed",
      message: params.action.title,
      correlationId,
      metadata: { actionKey, seenCount, priority: nextPriority },
    });
    return {
      ...existing,
      priority: nextPriority,
      source: params.source,
      summary: params.action.description,
      description: params.action.description,
      metadata,
      updated_at: timestamp,
      last_seen_at: timestamp,
      seen_count: seenCount,
    };
  }

  const id = createActionId();
  const summary = params.action.description;
  await run(
    `INSERT INTO campamento_actions (
      id,
      tenant_id,
      saas_id,
      saas_slug,
      category,
      priority,
      source,
      title,
      summary,
      description,
      action_key,
      status,
      correlation_id,
      last_seen_at,
      seen_count,
      metadata,
      created_at,
      updated_at,
      resolved_at,
      snoozed_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.tenantId,
    saasId,
    null,
    category,
    params.priority,
    params.source,
    params.action.title,
    summary,
    params.action.description,
    actionKey,
    "OPEN",
    correlationId,
    timestamp,
    1,
    metadata,
    timestamp,
    timestamp,
    null,
    null,
  );

  await recordActionEvent({
    tenantId: params.tenantId,
    saasId,
    type: "autopilot.action.proposed",
    message: params.action.title,
    correlationId,
    metadata: { actionKey, priority: params.priority },
  });

  return {
    id,
    tenant_id: params.tenantId,
    saas_id: saasId,
    saas_slug: null,
    category,
    priority: params.priority,
    source: params.source,
    title: params.action.title,
    summary,
    description: params.action.description,
    action_key: actionKey,
    status: "OPEN",
    correlation_id: correlationId,
    last_seen_at: timestamp,
    seen_count: 1,
    metadata,
    created_at: timestamp,
    updated_at: timestamp,
    resolved_at: null,
    snoozed_until: null,
  };
}

export async function updateActionStatus(params: {
  tenantId: string;
  id: string;
  status: CampamentoActionStatus;
  snoozedUntil?: string | null;
  now?: Date;
}): Promise<boolean> {
  const now = params.now ?? new Date();
  const timestamp = now.toISOString();
  const resolvedAt = params.status === "EXECUTED" ? timestamp : null;
  const snoozedUntil = params.status === "SNOOZED" ? params.snoozedUntil ?? null : null;
  return run(
    `UPDATE campamento_actions
     SET status = ?, updated_at = ?, resolved_at = ?, snoozed_until = ?
     WHERE id = ? AND tenant_id = ?`,
    params.status,
    timestamp,
    resolvedAt,
    snoozedUntil,
    params.id,
    params.tenantId,
  );
}

export async function transitionActionStatus(params: {
  tenantId: string;
  id: string;
  status: CampamentoActionStatus;
  actor?: string | null;
  correlationId?: string;
  snoozedUntil?: string | null;
  now?: Date;
}): Promise<boolean> {
  const updated = await updateActionStatus({
    tenantId: params.tenantId,
    id: params.id,
    status: params.status,
    snoozedUntil: params.snoozedUntil ?? null,
    now: params.now,
  });
  if (!updated) return false;
  await recordActionEvent({
    tenantId: params.tenantId,
    type:
      params.status === "EXECUTED"
        ? "autopilot.action.executed"
        : params.status === "DISMISSED"
          ? "autopilot.action.dismissed"
          : params.status === "SNOOZED"
            ? "autopilot.action.snoozed"
            : "autopilot.action.proposed",
    message: `Action status -> ${params.status}`,
    correlationId: params.correlationId ?? `action_${params.id}`,
    metadata: {
      actionId: params.id,
      actor: params.actor ?? null,
      snoozedUntil: params.snoozedUntil ?? null,
    },
  });
  return true;
}

export async function findActionById(params: { tenantId: string; id: string }): Promise<CampamentoActionRow | null> {
  const rows = await queryAll<CampamentoActionRow>(
    `SELECT * FROM campamento_actions WHERE tenant_id = ? AND id = ? LIMIT 1`,
    params.tenantId,
    params.id,
  );
  return rows[0] ?? null;
}

export async function listActionsForOwnerSnapshot(params: { tenantId: string }): Promise<CampamentoActionRow[]> {
  return queryAll<CampamentoActionRow>(
    `SELECT * FROM campamento_actions
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    params.tenantId,
  );
}

export async function createOrMergeActionFromWebhook(params: {
  tenantId: string;
  saasId?: string | null;
  category: string;
  priority: OwnerActionQueuePriority;
  title: string;
  description: string;
  source: string;
  metadata?: Record<string, unknown> | null;
  saasSlug?: string | null;
  actionKey?: string;
  correlationId?: string;
  now?: Date;
}): Promise<CampamentoActionRow | null> {
  const now = params.now ?? new Date();
  const timestamp = now.toISOString();
  const category = normalizeCategory(params.category);
  const actionKey = params.actionKey ?? buildActionKey({ category, title: params.title, saasId: params.saasId ?? null });
  const correlationId = params.correlationId ?? `action_${Date.now()}`;
  const existing = await findOpenActionByKey({
    tenantId: params.tenantId,
    actionKey,
  });
  const metadata = params.metadata ? JSON.stringify(params.metadata) : null;

  if (existing) {
    const seenCount = (existing.seen_count ?? 0) + 1;
    await run(
      `UPDATE campamento_actions
       SET priority = ?, source = ?, summary = ?, description = ?, metadata = ?, updated_at = ?, last_seen_at = ?, seen_count = ?
       WHERE id = ? AND tenant_id = ?`,
      params.priority,
      params.source,
      params.description,
      params.description,
      metadata,
      timestamp,
      timestamp,
      seenCount,
      existing.id,
      params.tenantId,
    );
    await recordActionEvent({
      tenantId: params.tenantId,
      saasId: params.saasId ?? null,
      saasSlug: params.saasSlug ?? null,
      type: "autopilot.action.proposed",
      message: params.title,
      correlationId,
      metadata: { actionKey, seenCount, priority: params.priority },
    });
    return { ...existing, seen_count: seenCount, last_seen_at: timestamp, updated_at: timestamp };
  }

  const id = createActionId();
  const summary = params.description;
  await run(
    `INSERT INTO campamento_actions (
      id,
      tenant_id,
      saas_id,
      saas_slug,
      category,
      priority,
      source,
      title,
      summary,
      description,
      action_key,
      status,
      correlation_id,
      last_seen_at,
      seen_count,
      metadata,
      created_at,
      updated_at,
      resolved_at,
      snoozed_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.tenantId,
    params.saasId ?? null,
    params.saasSlug ?? null,
    category,
    params.priority,
    params.source,
    params.title,
    summary,
    params.description,
    actionKey,
    "OPEN",
    correlationId,
    timestamp,
    1,
    metadata,
    timestamp,
    timestamp,
    null,
    null,
  );

  await recordActionEvent({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    saasSlug: params.saasSlug ?? null,
    type: "autopilot.action.proposed",
    message: params.title,
    correlationId,
    metadata: { actionKey, priority: params.priority },
  });

  return {
    id,
    tenant_id: params.tenantId,
    saas_id: params.saasId ?? null,
    saas_slug: params.saasSlug ?? null,
    category,
    priority: params.priority,
    source: params.source,
    title: params.title,
    summary,
    description: params.description,
    action_key: actionKey,
    status: "OPEN",
    correlation_id: correlationId,
    last_seen_at: timestamp,
    seen_count: 1,
    metadata,
    created_at: timestamp,
    updated_at: timestamp,
    resolved_at: null,
    snoozed_until: null,
  };
}
