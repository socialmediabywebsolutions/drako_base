import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import {
  appendDemoSaasTaskEvent,
  createDemoSaasTask,
  getDemoSaasTaskById,
  listDemoSaasTaskEvents,
  listDemoSaasTasks,
  updateDemoSaasTask,
} from "@/lib/admin/demo-data";
import type { DemoSaasTask, DemoSaasTaskEvent } from "@/lib/admin/demo-data";
import type {
  CreateTaskInput,
  SaasTask,
  SaasTaskCategory,
  SaasTaskEvent,
  SaasTaskEventType,
  SaasTaskSeverity,
  SaasTaskSource,
  SaasTaskStatus,
  UpdateTaskInput,
} from "@/lib/tasks/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type TasksContextMode = "d1" | "demo";

export type TasksContext = {
  tenantId: string;
  saasId: string | null;
  mode: TasksContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class TasksContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TasksContextError";
  }
}

type TaskRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  title: string;
  description: string | null;
  category: string;
  source: string;
  status: string;
  severity: string;
  assignee_employee_id: string | null;
  due_date: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type TaskEventRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  task_id: string;
  type: string;
  payload: string | null;
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

function shouldFallbackToDemo(error: unknown, ctx: TasksContext): boolean {
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

function demoTenantId(ctx: TasksContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function requireSaasId(ctx: TasksContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new TasksContextError("saasId is required for tasks.");
  }
  return saasId;
}

function mapTaskRow(row: TaskRow): SaasTask {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    title: row.title,
    description: row.description,
    category: row.category as SaasTaskCategory,
    source: row.source as SaasTaskSource,
    status: row.status as SaasTaskStatus,
    severity: row.severity as SaasTaskSeverity,
    assigneeEmployeeId: row.assignee_employee_id,
    dueDate: row.due_date,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaskEventRow(row: TaskEventRow): SaasTaskEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    taskId: row.task_id,
    type: row.type as SaasTaskEventType,
    payload: row.payload ? JSON.parse(row.payload) : null,
    createdAt: row.created_at,
  };
}

function demoTaskToRow(record: DemoSaasTask): TaskRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    title: record.title,
    description: record.description,
    category: record.category,
    source: record.source,
    status: record.status,
    severity: record.severity,
    assignee_employee_id: record.assignee_employee_id,
    due_date: record.due_date,
    metadata: record.metadata,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function demoTaskEventToRow(record: DemoSaasTaskEvent): TaskEventRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    task_id: record.task_id,
    type: record.type,
    payload: record.payload,
    created_at: record.created_at,
  };
}

export async function resolveTasksContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<TasksContext> {
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
    throw new TasksContextError("Tasks module is not enabled for this tenant.");
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

export async function listTasks(
  ctx: TasksContext,
  filters?: { status?: SaasTaskStatus | null; category?: SaasTaskCategory | null; assigneeEmployeeId?: string | null },
): Promise<SaasTask[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const items = listDemoSaasTasks(demoTenantId(ctx), saasId).map((row) => mapTaskRow(demoTaskToRow(row)));
    return items.filter((item) => {
      if (filters?.status && item.status !== filters.status) return false;
      if (filters?.category && item.category !== filters.category) return false;
      if (filters?.assigneeEmployeeId && item.assigneeEmployeeId !== filters.assigneeEmployeeId) return false;
      return true;
    });
  }
  try {
    const clauses: string[] = ["tenant_id = ?", "saas_id = ?"];
    const params: unknown[] = [ctx.tenantId, saasId];
    if (filters?.status) {
      clauses.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.category) {
      clauses.push("category = ?");
      params.push(filters.category);
    }
    if (filters?.assigneeEmployeeId) {
      clauses.push("assignee_employee_id = ?");
      params.push(filters.assigneeEmployeeId);
    }
    const rows = await queryAll<TaskRow>(
      `SELECT id, tenant_id, saas_id, title, description, category, source, status, severity,
              assignee_employee_id, due_date, metadata, created_at, updated_at
       FROM saas_tasks
       WHERE ${clauses.join(" AND ")}
       ORDER BY datetime(updated_at) DESC`,
      ...params,
    );
    return rows.map(mapTaskRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const items = listDemoSaasTasks(demoTenantId(ctx), saasId).map((row) => mapTaskRow(demoTaskToRow(row)));
      return items.filter((item) => {
        if (filters?.status && item.status !== filters.status) return false;
        if (filters?.category && item.category !== filters.category) return false;
        if (filters?.assigneeEmployeeId && item.assigneeEmployeeId !== filters.assigneeEmployeeId) return false;
        return true;
      });
    }
    throw error;
  }
}

export async function getTaskById(ctx: TasksContext, taskId: string): Promise<SaasTask | null> {
  if (ctx.mode === "demo") {
    const record = getDemoSaasTaskById(demoTenantId(ctx), taskId);
    return record ? mapTaskRow(demoTaskToRow(record)) : null;
  }
  try {
    const rows = await queryAll<TaskRow>(
      `SELECT id, tenant_id, saas_id, title, description, category, source, status, severity,
              assignee_employee_id, due_date, metadata, created_at, updated_at
       FROM saas_tasks
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`,
      ctx.tenantId,
      taskId,
    );
    return rows[0] ? mapTaskRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoSaasTaskById(demoTenantId(ctx), taskId);
      return record ? mapTaskRow(demoTaskToRow(record)) : null;
    }
    throw error;
  }
}

export async function createTask(ctx: TasksContext, input: CreateTaskInput): Promise<SaasTask> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = generateUuid();
  const status: SaasTaskStatus = input.status ?? "OPEN";

  if (ctx.mode === "demo") {
    const record = createDemoSaasTask(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      source: input.source,
      status,
      severity: input.severity,
      assignee_employee_id: input.assigneeEmployeeId ?? null,
      due_date: input.dueDate ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
    appendDemoSaasTaskEvent(demoTenantId(ctx), {
      saas_id: saasId,
      task_id: record.id,
      type: "CREATED",
      payload: input.metadata ? JSON.stringify(input.metadata) : null,
    });
    return mapTaskRow(demoTaskToRow(record));
  }

  await run(
    `INSERT INTO saas_tasks
     (id, tenant_id, saas_id, title, description, category, source, status, severity, assignee_employee_id, due_date, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    input.title,
    input.description ?? null,
    input.category,
    input.source,
    status,
    input.severity,
    input.assigneeEmployeeId ?? null,
    input.dueDate ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    now,
    now,
  );

  await run(
    `INSERT INTO saas_task_events (id, tenant_id, saas_id, task_id, type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    generateUuid(),
    ctx.tenantId,
    saasId,
    id,
    "CREATED",
    input.metadata ? JSON.stringify(input.metadata) : null,
    now,
  );

  return {
    id,
    tenantId: ctx.tenantId,
    saasId,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    source: input.source,
    status,
    severity: input.severity,
    assigneeEmployeeId: input.assigneeEmployeeId ?? null,
    dueDate: input.dueDate ?? null,
    metadata: input.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateTask(ctx: TasksContext, taskId: string, input: UpdateTaskInput): Promise<SaasTask | null> {
  if (ctx.mode === "demo") {
    const record = updateDemoSaasTask(demoTenantId(ctx), taskId, {
      title: input.title,
      description: typeof input.description === "undefined" ? undefined : input.description,
      category: input.category,
      status: input.status,
      severity: input.severity,
      assignee_employee_id: input.assigneeEmployeeId,
      due_date: input.dueDate ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : input.metadata === null ? null : undefined,
    });
    return record ? mapTaskRow(demoTaskToRow(record)) : null;
  }

  const current = await getTaskById(ctx, taskId);
  if (!current) return null;
  const now = new Date().toISOString();
  const next: SaasTask = {
    ...current,
    title: input.title ?? current.title,
    description: typeof input.description === "undefined" ? current.description ?? null : input.description,
    category: input.category ?? current.category,
    status: input.status ?? current.status,
    severity: input.severity ?? current.severity,
    assigneeEmployeeId: typeof input.assigneeEmployeeId === "undefined" ? current.assigneeEmployeeId ?? null : input.assigneeEmployeeId,
    dueDate: typeof input.dueDate === "undefined" ? current.dueDate ?? null : input.dueDate,
    metadata: typeof input.metadata === "undefined" ? current.metadata ?? null : input.metadata,
    updatedAt: now,
  };

  await run(
    `UPDATE saas_tasks
     SET title = ?, description = ?, category = ?, status = ?, severity = ?, assignee_employee_id = ?, due_date = ?, metadata = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`,
    next.title,
    next.description ?? null,
    next.category,
    next.status,
    next.severity,
    next.assigneeEmployeeId ?? null,
    next.dueDate ?? null,
    next.metadata ? JSON.stringify(next.metadata) : null,
    now,
    ctx.tenantId,
    taskId,
  );
  return next;
}

export async function listTaskEvents(ctx: TasksContext, taskId: string): Promise<SaasTaskEvent[]> {
  if (ctx.mode === "demo") {
    return listDemoSaasTaskEvents(demoTenantId(ctx), requireSaasId(ctx), taskId).map((row) => mapTaskEventRow(demoTaskEventToRow(row)));
  }
  try {
    const rows = await queryAll<TaskEventRow>(
      `SELECT id, tenant_id, saas_id, task_id, type, payload, created_at
       FROM saas_task_events
       WHERE tenant_id = ? AND task_id = ?
       ORDER BY datetime(created_at) DESC`,
      ctx.tenantId,
      taskId,
    );
    return rows.map(mapTaskEventRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasTaskEvents(demoTenantId(ctx), requireSaasId(ctx), taskId).map((row) => mapTaskEventRow(demoTaskEventToRow(row)));
    }
    throw error;
  }
}

export async function appendTaskEvent(
  ctx: TasksContext,
  taskId: string,
  type: SaasTaskEventType,
  payload?: Record<string, unknown> | null,
): Promise<SaasTaskEvent> {
  const saasId = requireSaasId(ctx);
  const now = new Date().toISOString();
  if (ctx.mode === "demo") {
    const record = appendDemoSaasTaskEvent(demoTenantId(ctx), {
      saas_id: saasId,
      task_id: taskId,
      type,
      payload: payload ? JSON.stringify(payload) : null,
    });
    return mapTaskEventRow(demoTaskEventToRow(record));
  }

  const id = generateUuid();
  await run(
    `INSERT INTO saas_task_events (id, tenant_id, saas_id, task_id, type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    taskId,
    type,
    payload ? JSON.stringify(payload) : null,
    now,
  );
  return {
    id,
    tenantId: ctx.tenantId,
    saasId,
    taskId,
    type,
    payload: payload ?? null,
    createdAt: now,
  };
}
