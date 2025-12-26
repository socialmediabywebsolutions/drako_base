import { listTasks, resolveTasksContext, createTask } from "@/lib/tasks/repository";
import type { SaasTask, SaasTaskCategory, SaasTaskStatus, SaasTaskSeverity } from "@/lib/tasks/types";
import { listSaasForOwner } from "@/lib/owner/portfolio";
import { buildOwnerGrowthAutopilotSnapshot } from "@/lib/owner/growth-autopilot";
import type { OwnerGrowthAutopilotAction } from "@/lib/owner/types";

export type OwnerTaskListItem = {
  taskId: string;
  saasId: string;
  saasName: string;
  title: string;
  status: SaasTaskStatus;
  category: SaasTaskCategory;
  priority: number;
  createdAt: string;
  updatedAt: string;
  origin: "AUTOPILOT" | "MANUAL" | "WHATSAPP" | "OTHER";
  severity: SaasTaskSeverity;
  metadata?: SaasTask["metadata"] | null;
};

export type OwnerTasksSummary = {
  totalOpen: number;
  totalInProgress: number;
  totalBlocked: number;
  totalDone: number;
  bySaas: Record<string, { saasId: string; saasName: string; open: number; inProgress: number; blocked: number; done: number }>;
  byCategory: Record<string, number>;
};

export type OwnerTasksFilters = {
  status?: SaasTaskStatus | null;
  category?: SaasTaskCategory | null;
  saasId?: string | null;
};

const SEVERITY_PRIORITY: Record<SaasTaskSeverity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  SUGGESTION: 1,
  INFO: 0,
};

function mapOrigin(task: SaasTask): OwnerTaskListItem["origin"] {
  if (task.source === "AUTOPILOT") return "AUTOPILOT";
  if (task.source === "MANUAL_OWNER" || task.source === "MANUAL_STAFF") return "MANUAL";
  if (task.metadata?.source === "WHATSAPP") return "WHATSAPP";
  return "OTHER";
}

function normalizeCategoryGroup(category: SaasTaskCategory): string {
  if (category === "HR") return "HR";
  if (category === "SOCIAL") return "SOCIAL";
  if (category === "EMAIL") return "OPERATIONS";
  if (category === "TAX") return "TAX";
  if (category === "BLUEPRINT") return "OPERATIONS";
  if (category === "ECONOMY") return "OPERATIONS";
  return "OTHER";
}

function mapGrowthCategory(action: OwnerGrowthAutopilotAction): SaasTaskCategory {
  if (action.category === "PRICING" || action.category === "SAAS_HEALTH" || action.category === "OPPORTUNITY") return "ECONOMY";
  if (action.category === "VERTICAL_MIX" || action.category === "CATALOG") return "BLUEPRINT";
  if (action.category === "RISK") {
    const description = `${action.title} ${action.description}`.toLowerCase();
    if (description.includes("iva") || description.includes("impuesto") || description.includes("fiscal")) return "TAX";
  }
  return "OTHER";
}

export async function listOwnerTasks(params: {
  tenantId: string;
  ownerId: string;
  env?: Parameters<typeof resolveTasksContext>[0]["env"];
  filters?: OwnerTasksFilters | null;
}): Promise<OwnerTaskListItem[]> {
  const saasList = await listSaasForOwner(params.tenantId, params.ownerId);
  const items: OwnerTaskListItem[] = [];

  for (const saas of saasList) {
    if (params.filters?.saasId && params.filters.saasId !== saas.id) continue;
    const tasksCtx = await resolveTasksContext({ tenantId: params.tenantId, saasId: saas.id, env: params.env });
    const tasks = await listTasks(tasksCtx, {
      status: params.filters?.status ?? null,
      category: params.filters?.category ?? null,
    });
    tasks.forEach((task) => {
      items.push({
        taskId: task.id,
        saasId: saas.id,
        saasName: saas.name,
        title: task.title,
        status: task.status,
        category: task.category,
        priority: SEVERITY_PRIORITY[task.severity],
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        origin: mapOrigin(task),
        severity: task.severity,
        metadata: task.metadata ?? null,
      });
    });
  }

  items.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    return a.title.localeCompare(b.title);
  });

  return items;
}

export async function getOwnerTasksSummary(params: {
  tenantId: string;
  ownerId: string;
  env?: Parameters<typeof resolveTasksContext>[0]["env"];
}): Promise<OwnerTasksSummary> {
  const tasks = await listOwnerTasks({ tenantId: params.tenantId, ownerId: params.ownerId, env: params.env });
  const summary: OwnerTasksSummary = {
    totalOpen: 0,
    totalInProgress: 0,
    totalBlocked: 0,
    totalDone: 0,
    bySaas: {},
    byCategory: {},
  };

  tasks.forEach((task) => {
    if (!summary.bySaas[task.saasId]) {
      summary.bySaas[task.saasId] = { saasId: task.saasId, saasName: task.saasName, open: 0, inProgress: 0, blocked: 0, done: 0 };
    }
    const saasCounter = summary.bySaas[task.saasId];
    if (task.status === "OPEN") {
      summary.totalOpen += 1;
      saasCounter.open += 1;
    } else if (task.status === "IN_PROGRESS") {
      summary.totalInProgress += 1;
      saasCounter.inProgress += 1;
    } else if (task.status === "DISCARDED") {
      summary.totalBlocked += 1;
      saasCounter.blocked += 1;
    } else if (task.status === "DONE") {
      summary.totalDone += 1;
      saasCounter.done += 1;
    }

    const bucket = normalizeCategoryGroup(task.category);
    summary.byCategory[bucket] = (summary.byCategory[bucket] ?? 0) + 1;
  });

  return summary;
}

export async function materializeOwnerGrowthAutopilotTasks(params: {
  tenantId: string;
  ownerId: string;
  env?: Parameters<typeof resolveTasksContext>[0]["env"];
}): Promise<OwnerTaskListItem[]> {
  const actions = await buildOwnerGrowthAutopilotSnapshot({ tenantId: params.tenantId, ownerId: params.ownerId });
  const saasList = await listSaasForOwner(params.tenantId, params.ownerId);
  const bySaas = new Map(saasList.map((item) => [item.id, item]));
  const created: OwnerTaskListItem[] = [];

  for (const action of actions) {
    if (action.target.type !== "SAAS" || !action.target.saasId) continue;
    const saasId = action.target.saasId;
    const saas = bySaas.get(saasId);
    if (!saas) continue;
    const tasksCtx = await resolveTasksContext({ tenantId: params.tenantId, saasId, env: params.env });
    const existing = await listTasks(tasksCtx, {});
    const key = action.id;
    const already = existing.find((task) => task.metadata?.ownerGrowthKey === key);
    if (already) continue;

    const task = await createTask(tasksCtx, {
      saasId,
      title: action.title,
      description: action.description,
      category: mapGrowthCategory(action),
      source: "AUTOPILOT",
      status: "OPEN",
      severity: action.severity,
      assigneeEmployeeId: null,
      metadata: {
        ownerGrowthKey: key,
        ownerGrowthCategory: action.category,
        target: action.target,
        origin: "OWNER_GROWTH_AUTOPILOT",
      },
    });

    created.push({
      taskId: task.id,
      saasId,
      saasName: saas.name,
      title: task.title,
      status: task.status,
      category: task.category,
      priority: SEVERITY_PRIORITY[task.severity],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      origin: mapOrigin(task),
      severity: task.severity,
      metadata: task.metadata ?? null,
    });
  }

  return created;
}
