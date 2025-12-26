import { queryAll, run } from "@/lib/db";
import type { DracoEnv } from "@/lib/cf";
import {
  DEV_ARCHITECT_CHECKLIST_RULES,
  DEV_ARCHITECT_CHECKLIST_TEMPLATES,
  DEV_ARCHITECT_PROJECT_TEMPLATES,
  DEV_ARCHITECT_SESSION_TEMPLATES,
} from "@/lib/dev-architects/data";
import { parseAuditSummary } from "@/lib/dev-architects/audit";
import type {
  DevArchitectAlert,
  DevArchitectAlertSeverity,
  DevArchitectChecklist,
  DevArchitectChecklistStatus,
  DevArchitectMode,
  DevArchitectProject,
  DevArchitectProjectMetrics,
  DevArchitectSession,
  DevArchitectTask,
  DevArchitectTaskPriority,
  DevArchitectTaskSource,
  DevArchitectTaskStatus,
} from "@/lib/dev-architects/types";

const fallbackProjects = new Map<string, DevArchitectProject[]>();
const fallbackSessions = new Map<string, DevArchitectSession[]>();
const fallbackChecklists = new Map<string, DevArchitectChecklist[]>();
const fallbackAlerts = new Map<string, DevArchitectAlert[]>();
const fallbackTasks = new Map<string, DevArchitectTask[]>();

const nowIso = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;

function sortSessions(list: DevArchitectSession[]): DevArchitectSession[] {
  return [...list].sort(
    (a, b) => new Date(b.last_interaction_at).getTime() - new Date(a.last_interaction_at).getTime(),
  );
}

function seedFallbackTenant(tenantId: string) {
  if (fallbackProjects.has(tenantId)) return;

  const seededProjects = DEV_ARCHITECT_PROJECT_TEMPLATES.map((project) => ({
    ...project,
    tenant_id: tenantId,
    created_at: nowIso(),
    updated_at: nowIso(),
  }));
  fallbackProjects.set(tenantId, seededProjects);

  const seededSessions = DEV_ARCHITECT_SESSION_TEMPLATES.map((session) => ({
    ...session,
    tenant_id: tenantId,
    created_at: nowIso(),
    updated_at: nowIso(),
    summary: session.summary ?? null,
  }));
  fallbackSessions.set(tenantId, seededSessions);

  const seededChecklists = DEV_ARCHITECT_CHECKLIST_TEMPLATES.map((item) => ({
    ...item,
    tenant_id: tenantId,
    created_at: nowIso(),
    updated_at: nowIso(),
  }));
  fallbackChecklists.set(tenantId, seededChecklists);
  fallbackAlerts.set(tenantId, []);
  fallbackTasks.set(tenantId, []);
}

function getFallbackProjects(tenantId: string): DevArchitectProject[] {
  seedFallbackTenant(tenantId);
  return fallbackProjects.get(tenantId) ?? [];
}

function getFallbackSessions(tenantId: string): DevArchitectSession[] {
  seedFallbackTenant(tenantId);
  return fallbackSessions.get(tenantId) ?? [];
}

function getFallbackChecklists(tenantId: string): DevArchitectChecklist[] {
  seedFallbackTenant(tenantId);
  return fallbackChecklists.get(tenantId) ?? [];
}

function getFallbackAlerts(tenantId: string): DevArchitectAlert[] {
  seedFallbackTenant(tenantId);
  return fallbackAlerts.get(tenantId) ?? [];
}

function getFallbackTasks(tenantId: string): DevArchitectTask[] {
  seedFallbackTenant(tenantId);
  return fallbackTasks.get(tenantId) ?? [];
}

const severityRank: Record<DevArchitectAlertSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const TASK_STATUSES: DevArchitectTaskStatus[] = ["todo", "in_progress", "done", "blocked"];
const TASK_PRIORITIES: DevArchitectTaskPriority[] = ["low", "medium", "high", "urgent"];
const TASK_SOURCES: DevArchitectTaskSource[] = ["manual", "audit", "alert"];

function ensureTaskStatus(value?: string | null): DevArchitectTaskStatus {
  if (!value) return "todo";
  return TASK_STATUSES.includes(value as DevArchitectTaskStatus) ? (value as DevArchitectTaskStatus) : "todo";
}

function ensureTaskPriority(value?: string | null): DevArchitectTaskPriority {
  if (!value) return "medium";
  return TASK_PRIORITIES.includes(value as DevArchitectTaskPriority) ? (value as DevArchitectTaskPriority) : "medium";
}

function ensureTaskSource(value?: string | null): DevArchitectTaskSource {
  if (!value) return "manual";
  return TASK_SOURCES.includes(value as DevArchitectTaskSource) ? (value as DevArchitectTaskSource) : "manual";
}

export async function listDevArchitectProjects(tenantId: string, bindings: DracoEnv | null) {
  if (!bindings || !bindings.DRACO_DB) {
    return getFallbackProjects(tenantId);
  }
  return queryAll<DevArchitectProject>(
    "SELECT id, tenant_id, name, type, origin, origin_url, branch_name, status, last_build_status, last_action_summary, created_at, updated_at FROM devarchitect_projects WHERE tenant_id = ? ORDER BY updated_at DESC",
    tenantId,
  );
}

export async function upsertDevArchitectProject(tenantId: string, bindings: DracoEnv | null, payload: Partial<DevArchitectProject>) {
  const now = nowIso();
  if (!bindings || !bindings.DRACO_DB) {
    const projects = getFallbackProjects(tenantId);
    if (payload.id) {
      const existingIndex = projects.findIndex((project) => project.id === payload.id);
      if (existingIndex >= 0) {
        const updated = {
          ...projects[existingIndex],
          ...payload,
          tenant_id: tenantId,
          updated_at: now,
        } as DevArchitectProject;
        projects.splice(existingIndex, 1, updated);
        fallbackProjects.set(tenantId, [...projects]);
        return updated;
      }
    }
    const created: DevArchitectProject = {
      id: payload.id ?? uid("devproj"),
      tenant_id: tenantId,
      name: payload.name ?? "Nuevo proyecto",
      type: (payload.type as DevArchitectProject["type"]) ?? "core",
      origin: payload.origin ?? "GitHub",
      origin_url: payload.origin_url ?? null,
      branch_name: payload.branch_name ?? "main",
      status: (payload.status as DevArchitectProject["status"]) ?? "active",
      last_build_status: payload.last_build_status ?? null,
      last_action_summary: payload.last_action_summary ?? null,
      created_at: now,
      updated_at: now,
    };
    fallbackProjects.set(tenantId, [created, ...projects]);
    seedFallbackChecklistsForProject(tenantId, created.id);
    return created;
  }

  if (payload.id) {
    const ok = await run(
      `UPDATE devarchitect_projects
        SET name = ?, type = ?, origin = ?, origin_url = ?, branch_name = ?, status = ?, last_build_status = ?, last_action_summary = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?`,
      payload.name ?? "",
      payload.type ?? "core",
      payload.origin ?? null,
      payload.origin_url ?? null,
      payload.branch_name ?? null,
      payload.status ?? "active",
      payload.last_build_status ?? null,
      payload.last_action_summary ?? null,
      now,
      tenantId,
      payload.id,
    );
    if (!ok) {
      throw new Error("No se pudo actualizar el proyecto devarchitect");
    }
  } else {
    const id = uid("devproj");
    const ok = await run(
      "INSERT INTO devarchitect_projects (id, tenant_id, name, type, origin, origin_url, branch_name, status, last_build_status, last_action_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      tenantId,
      payload.name ?? "Nuevo proyecto",
      payload.type ?? "core",
      payload.origin ?? null,
      payload.origin_url ?? null,
      payload.branch_name ?? null,
      payload.status ?? "active",
      payload.last_build_status ?? null,
      payload.last_action_summary ?? null,
      now,
      now,
    );
    if (!ok) throw new Error("No se pudo crear el proyecto devarchitect");
    await seedChecklistsForProject(tenantId, id, bindings);
    payload.id = id;
  }

  const rows = await queryAll<DevArchitectProject>(
    "SELECT id, tenant_id, name, type, origin, origin_url, branch_name, status, last_build_status, last_action_summary, created_at, updated_at FROM devarchitect_projects WHERE tenant_id = ? AND id = ?",
    tenantId,
    payload.id,
  );
  return rows[0];
}

export async function listDevArchitectSessions(tenantId: string, bindings: DracoEnv | null, projectId?: string) {
  if (!bindings || !bindings.DRACO_DB) {
    const sessions = sortSessions(getFallbackSessions(tenantId));
    return projectId ? sessions.filter((session) => session.project_id === projectId) : sessions;
  }
  if (projectId) {
    return queryAll<DevArchitectSession>(
      "SELECT id, tenant_id, project_id, mode, title, last_interaction_at, summary, created_at, updated_at FROM devarchitect_sessions WHERE tenant_id = ? AND project_id = ? ORDER BY datetime(last_interaction_at) DESC",
      tenantId,
      projectId,
    );
  }
  return queryAll<DevArchitectSession>(
    "SELECT id, tenant_id, project_id, mode, title, last_interaction_at, summary, created_at, updated_at FROM devarchitect_sessions WHERE tenant_id = ? ORDER BY datetime(last_interaction_at) DESC",
    tenantId,
  );
}

export async function createDevArchitectSession(
  tenantId: string,
  bindings: DracoEnv | null,
  payload: { project_id: string; mode: DevArchitectMode; title: string; summary?: string | null; last_interaction_at?: string },
) {
  const now = nowIso();
  if (!bindings || !bindings.DRACO_DB) {
    const sessions = getFallbackSessions(tenantId);
    const session: DevArchitectSession = {
      id: uid("devsess"),
      tenant_id: tenantId,
      project_id: payload.project_id,
      mode: payload.mode,
      title: payload.title,
      created_at: now,
      updated_at: now,
      last_interaction_at: payload.last_interaction_at ?? now,
      summary: payload.summary ?? null,
    };
    fallbackSessions.set(tenantId, [session, ...sessions]);
    return session;
  }
  const id = uid("devsess");
  const ok = await run(
    "INSERT INTO devarchitect_sessions (id, tenant_id, project_id, mode, title, last_interaction_at, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    tenantId,
    payload.project_id,
    payload.mode,
    payload.title,
    payload.last_interaction_at ?? now,
    payload.summary ?? null,
    now,
    now,
  );
  if (!ok) throw new Error("No se pudo crear la sesión DevArchitect");
  const rows = await queryAll<DevArchitectSession>(
    "SELECT id, tenant_id, project_id, mode, title, last_interaction_at, summary, created_at, updated_at FROM devarchitect_sessions WHERE id = ?",
    id,
  );
  return rows[0];
}

export async function listDevArchitectChecklists(tenantId: string, bindings: DracoEnv | null, projectId: string) {
  if (!bindings || !bindings.DRACO_DB) {
    const rows = getFallbackChecklists(tenantId).filter((item) => item.project_id === projectId);
    if (rows.length === 0) {
      const defaults = DEV_ARCHITECT_CHECKLIST_RULES.map<DevArchitectChecklist>((rule) => ({
        id: uid("devchk"),
        tenant_id: tenantId,
        project_id: projectId,
        key: rule.key,
        label: rule.label,
        status: "pending",
        created_at: nowIso(),
        updated_at: nowIso(),
      }));
      const current = getFallbackChecklists(tenantId);
      fallbackChecklists.set(tenantId, [...current, ...defaults]);
      return defaults;
    }
    return rows;
  }
  await seedChecklistsForProject(tenantId, projectId, bindings);
  return queryAll<DevArchitectChecklist>(
    "SELECT id, tenant_id, project_id, key, label, status, created_at, updated_at FROM devarchitect_checklists WHERE tenant_id = ? AND project_id = ? ORDER BY key",
    tenantId,
    projectId,
  );
}

export async function updateDevArchitectChecklistStatus(
  tenantId: string,
  bindings: DracoEnv | null,
  payload: { project_id: string; key: string; status: DevArchitectChecklistStatus },
) {
  const now = nowIso();
  if (!bindings || !bindings.DRACO_DB) {
    const items = getFallbackChecklists(tenantId);
    const next = items.map((item) => {
      if (item.project_id === payload.project_id && item.key === payload.key) {
        return { ...item, status: payload.status, updated_at: now };
      }
      return item;
    });
    fallbackChecklists.set(tenantId, next);
    return next.filter((item) => item.project_id === payload.project_id);
  }
  const ok = await run(
    "UPDATE devarchitect_checklists SET status = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND key = ?",
    payload.status,
    now,
    tenantId,
    payload.project_id,
    payload.key,
  );
  if (!ok) throw new Error("No se pudo actualizar la checklist");
  return queryAll<DevArchitectChecklist>(
    "SELECT id, tenant_id, project_id, key, label, status, created_at, updated_at FROM devarchitect_checklists WHERE tenant_id = ? AND project_id = ? ORDER BY key",
    tenantId,
    payload.project_id,
  );
}

async function seedChecklistsForProject(tenantId: string, projectId: string, bindings: DracoEnv | null) {
  if (!bindings || !bindings.DRACO_DB) {
    seedFallbackChecklistsForProject(tenantId, projectId);
    return;
  }
  const existing = await queryAll<{ count: number }>(
    "SELECT COUNT(1) as count FROM devarchitect_checklists WHERE tenant_id = ? AND project_id = ?",
    tenantId,
    projectId,
  );
  if ((existing[0]?.count ?? 0) > 0) return;
  const promises = DEV_ARCHITECT_CHECKLIST_RULES.map((rule) =>
    run(
      "INSERT OR IGNORE INTO devarchitect_checklists (id, tenant_id, project_id, key, label, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
      uid("devchk"),
      tenantId,
      projectId,
      rule.key,
      rule.label,
      nowIso(),
      nowIso(),
    ),
  );
  await Promise.all(promises);
}

function seedFallbackChecklistsForProject(tenantId: string, projectId: string) {
  const current = getFallbackChecklists(tenantId);
  const hasEntries = current.some((item) => item.project_id === projectId);
  if (hasEntries) return;
  const defaults = DEV_ARCHITECT_CHECKLIST_RULES.map<DevArchitectChecklist>((rule) => ({
    id: uid("devchk"),
    tenant_id: tenantId,
    project_id: projectId,
    key: rule.key,
    label: rule.label,
    status: "pending",
    created_at: nowIso(),
    updated_at: nowIso(),
  }));
  fallbackChecklists.set(tenantId, [...current, ...defaults]);
}

function serializeAlertMetadata(pendingRules?: string[]) {
  if (!pendingRules || pendingRules.length === 0) return null;
  return JSON.stringify({ pending_rules: pendingRules });
}

function filterFallbackAlerts({
  tenantId,
  projectId,
  status,
}: {
  tenantId: string;
  projectId?: string;
  status?: "open" | "resolved";
}) {
  return getFallbackAlerts(tenantId).filter((alert) => {
    if (projectId && alert.devarchitect_project_id !== projectId) return false;
    if (status && alert.status !== status) return false;
    return true;
  });
}

export async function listDevArchitectAlerts(
  tenantId: string,
  bindings: DracoEnv | null,
  projectId?: string,
  status?: "open" | "resolved",
) {
  if (!bindings || !bindings.DRACO_DB) {
    return filterFallbackAlerts({ tenantId, projectId, status });
  }
  const clauses = ["tenant_id = ?"];
  const params: (string)[] = [tenantId];
  if (projectId) {
    clauses.push("devarchitect_project_id = ?");
    params.push(projectId);
  }
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  clauses.push("devarchitect_project_id IS NOT NULL");
  const sql = `SELECT id, tenant_id, devarchitect_project_id, severity, source, message, metadata, status, created_at, resolved_at
    FROM alerts WHERE ${clauses.join(" AND ")} ORDER BY datetime(created_at) DESC`;
  return queryAll<DevArchitectAlert>(sql, ...params);
}

export async function listDevArchitectTasks(
  tenantId: string,
  bindings: DracoEnv | null,
  options?: { projectId?: string; status?: DevArchitectTaskStatus; source?: DevArchitectTaskSource },
) {
  const projectId = options?.projectId;
  const status = options?.status;
  const source = options?.source;

  if (!bindings || !bindings.DRACO_DB) {
    let tasks = getFallbackTasks(tenantId);
    if (projectId) tasks = tasks.filter((task) => task.project_id === projectId);
    if (status) tasks = tasks.filter((task) => task.status === status);
    if (source) tasks = tasks.filter((task) => task.source === source);
    return tasks
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  const clauses = ["tenant_id = ?"];
  const params: (string)[] = [tenantId];
  if (projectId) {
    clauses.push("project_id = ?");
    params.push(projectId);
  }
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  if (source) {
    clauses.push("source = ?");
    params.push(source);
  }
  const sql = `SELECT id, tenant_id, project_id, title, description, status, priority, source, due_date, created_at, updated_at
    FROM devarchitect_tasks
    WHERE ${clauses.join(" AND ")}
    ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC`;
  return queryAll<DevArchitectTask>(sql, ...params);
}

type UpsertTaskPayload = {
  id?: string;
  project_id?: string;
  title?: string;
  description?: string | null;
  status?: DevArchitectTaskStatus;
  priority?: DevArchitectTaskPriority;
  source?: DevArchitectTaskSource;
  due_date?: string | null;
};

export async function upsertDevArchitectTask(
  tenantId: string,
  bindings: DracoEnv | null,
  payload: UpsertTaskPayload,
) {
  const now = nowIso();
  const baseTitle = payload.title?.trim().length ? payload.title.trim() : undefined;
  if (!bindings || !bindings.DRACO_DB) {
    const tasks = getFallbackTasks(tenantId);
    const targetProjectId =
      payload.project_id ?? (payload.id ? tasks.find((task) => task.id === payload.id)?.project_id : undefined);
    if (!targetProjectId) {
      throw new Error("project_id es obligatorio para tareas DevArchitect");
    }
    if (payload.id) {
      const index = tasks.findIndex((task) => task.id === payload.id);
      if (index >= 0) {
        const updated: DevArchitectTask = {
          ...tasks[index],
          project_id: targetProjectId,
          title: baseTitle ?? tasks[index].title,
          description: payload.description ?? tasks[index].description ?? null,
          status: ensureTaskStatus(payload.status ?? tasks[index].status),
          priority: ensureTaskPriority(payload.priority ?? tasks[index].priority),
          source: ensureTaskSource(payload.source ?? tasks[index].source),
          due_date: payload.due_date ?? tasks[index].due_date ?? null,
          updated_at: now,
        };
        tasks.splice(index, 1, updated);
        fallbackTasks.set(tenantId, [...tasks]);
        return updated;
      }
    }
    const created: DevArchitectTask = {
      id: payload.id ?? uid("devtask"),
      tenant_id: tenantId,
      project_id: targetProjectId,
      title: baseTitle ?? "Nueva tarea DevArchitect",
      description: payload.description ?? null,
      status: ensureTaskStatus(payload.status),
      priority: ensureTaskPriority(payload.priority),
      source: ensureTaskSource(payload.source),
      due_date: payload.due_date ?? null,
      created_at: now,
      updated_at: now,
    };
    fallbackTasks.set(tenantId, [created, ...tasks]);
    return created;
  }

  const id = payload.id ?? uid("devtask");
  let existing: DevArchitectTask | null = null;
  if (payload.id) {
    const rows = await queryAll<DevArchitectTask>(
      "SELECT id, tenant_id, project_id, title, description, status, priority, source, due_date, created_at, updated_at FROM devarchitect_tasks WHERE tenant_id = ? AND id = ? LIMIT 1",
      tenantId,
      payload.id,
    );
    existing = rows[0] ?? null;
  }
  const targetProjectId = payload.project_id ?? existing?.project_id;
  if (!targetProjectId) {
    throw new Error("project_id es obligatorio para tareas DevArchitect");
  }
  const record: DevArchitectTask = {
    id,
    tenant_id: tenantId,
    project_id: targetProjectId,
    title: baseTitle ?? existing?.title ?? "Nueva tarea DevArchitect",
    description: payload.description ?? existing?.description ?? null,
    status: ensureTaskStatus(payload.status ?? existing?.status),
    priority: ensureTaskPriority(payload.priority ?? existing?.priority),
    source: ensureTaskSource(payload.source ?? existing?.source),
    due_date: payload.due_date ?? existing?.due_date ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (existing) {
    const ok = await run(
      `UPDATE devarchitect_tasks
        SET project_id = ?, title = ?, description = ?, status = ?, priority = ?, source = ?, due_date = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?`,
      record.project_id,
      record.title,
      record.description ?? null,
      record.status,
      record.priority,
      record.source,
      record.due_date ?? null,
      now,
      tenantId,
      record.id,
    );
    if (!ok) throw new Error("No se pudo actualizar la tarea DevArchitect");
    return record;
  }

  const ok = await run(
    "INSERT INTO devarchitect_tasks (id, tenant_id, project_id, title, description, status, priority, source, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    record.id,
    tenantId,
    record.project_id,
    record.title,
    record.description ?? null,
    record.status,
    record.priority,
    record.source,
    record.due_date ?? null,
    record.created_at,
    record.updated_at,
  );
  if (!ok) throw new Error("No se pudo crear la tarea DevArchitect");
  return record;
}

export async function completeDevArchitectAuditTasks(
  tenantId: string,
  bindings: DracoEnv | null,
  projectId: string,
) {
  const now = nowIso();
  if (!bindings || !bindings.DRACO_DB) {
    const tasks = getFallbackTasks(tenantId).map((task) => {
      if (task.project_id === projectId && task.source === "audit" && task.status !== "done") {
        return { ...task, status: ensureTaskStatus("done"), updated_at: now };
      }
      return task;
    });
    fallbackTasks.set(tenantId, tasks);
    return;
  }
  await run(
    "UPDATE devarchitect_tasks SET status = 'done', updated_at = ? WHERE tenant_id = ? AND project_id = ? AND source = 'audit'",
    now,
    tenantId,
    projectId,
  );
}

export async function syncDevArchitectAuditAlert(
  tenantId: string,
  bindings: DracoEnv | null,
  payload: {
    project_id: string;
    severity?: DevArchitectAlertSeverity;
    status: "open" | "resolved";
    message?: string;
    pending_rules?: string[];
  },
) {
  const now = nowIso();
  const metadata = serializeAlertMetadata(payload.pending_rules);
  const source = `devarchitect_audit:${payload.project_id}`;
  if (!bindings || !bindings.DRACO_DB) {
    const alerts = getFallbackAlerts(tenantId);
    const existingIndex = alerts.findIndex(
      (alert) => alert.devarchitect_project_id === payload.project_id && alert.source === source && alert.status === "open",
    );
    if (payload.status === "resolved") {
      if (existingIndex >= 0) {
        const existing = alerts[existingIndex];
        alerts[existingIndex] = { ...existing, status: "resolved", resolved_at: now };
        fallbackAlerts.set(tenantId, [...alerts]);
      }
      return;
    }
    const baseMessage = payload.message ?? "Auditoría OLIMPO detectó pendientes técnicos.";
    if (existingIndex >= 0) {
      const updated: DevArchitectAlert = {
        ...alerts[existingIndex],
        severity: payload.severity ?? alerts[existingIndex].severity,
        message: baseMessage,
        metadata,
        created_at: now,
        status: "open",
      };
      alerts.splice(existingIndex, 1, updated);
      fallbackAlerts.set(tenantId, [...alerts]);
      return;
    }
    const created: DevArchitectAlert = {
      id: uid("alert"),
      tenant_id: tenantId,
      devarchitect_project_id: payload.project_id,
      severity: payload.severity ?? "medium",
      source,
      message: baseMessage,
      metadata,
      status: "open",
      created_at: now,
      resolved_at: null,
    };
    fallbackAlerts.set(tenantId, [created, ...alerts]);
    return;
  }

  const existing = await queryAll<DevArchitectAlert>(
    `SELECT id FROM alerts WHERE tenant_id = ? AND devarchitect_project_id = ? AND source = ? AND status = 'open' ORDER BY datetime(created_at) DESC LIMIT 1`,
    tenantId,
    payload.project_id,
    source,
  );

  if (payload.status === "resolved") {
    if (existing[0]) {
      await run(
        "UPDATE alerts SET status = 'resolved', resolved_at = ?, metadata = ? WHERE id = ?",
        now,
        metadata,
        existing[0].id,
      );
    }
    return;
  }

  const message = payload.message ?? "Auditoría OLIMPO detectó pendientes técnicos.";
  if (existing[0]) {
    await run(
      "UPDATE alerts SET severity = ?, message = ?, metadata = ?, created_at = ?, status = 'open', resolved_at = NULL WHERE id = ?",
      payload.severity ?? "medium",
      message,
      metadata,
      now,
      existing[0].id,
    );
    return;
  }

  const id = uid("alert");
  await run(
    "INSERT INTO alerts (id, tenant_id, severity, source, message, created_at, status, devarchitect_project_id, metadata) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)",
    id,
    tenantId,
    payload.severity ?? "medium",
    source,
    message,
    now,
    payload.project_id,
    metadata,
  );
}

type AlertAggregate = {
  project_id: string;
  alerts_open: number;
  max_severity_rank: number;
};

async function aggregateDevArchitectAlerts(tenantId: string, bindings: DracoEnv | null, projectIds: string[]) {
  if (!bindings || !bindings.DRACO_DB) {
    const alerts = filterFallbackAlerts({ tenantId, status: "open" }).filter((alert) => {
      return alert.devarchitect_project_id && projectIds.includes(alert.devarchitect_project_id);
    });
    const map = new Map<string, AlertAggregate>();
    for (const alert of alerts) {
      const key = alert.devarchitect_project_id as string;
      const current = map.get(key) ?? { project_id: key, alerts_open: 0, max_severity_rank: 0 };
      const rank = severityRank[alert.severity] ?? 0;
      map.set(key, {
        project_id: key,
        alerts_open: current.alerts_open + 1,
        max_severity_rank: Math.max(current.max_severity_rank, rank),
      });
    }
    return map;
  }

  if (projectIds.length === 0) {
    return new Map<string, AlertAggregate>();
  }

  const placeholders = projectIds.map(() => "?").join(",");
  const rows = await queryAll<AlertAggregate>(
    `SELECT devarchitect_project_id as project_id,
      COUNT(1) as alerts_open,
      MAX(CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) as max_severity_rank
     FROM alerts
     WHERE tenant_id = ? AND status = 'open' AND devarchitect_project_id IN (${placeholders})
     GROUP BY devarchitect_project_id`,
    tenantId,
    ...projectIds,
  );
  return new Map(rows.map((row) => [row.project_id, row]));
}

export async function buildDevArchitectProjectMetrics({
  tenantId,
  bindings,
  projects: providedProjects,
  sessions: providedSessions,
  checklists: providedChecklists,
  targetProjectId,
}: {
  tenantId: string;
  bindings: DracoEnv | null;
  projects?: DevArchitectProject[];
  sessions?: DevArchitectSession[];
  checklists?: DevArchitectChecklist[];
  targetProjectId?: string;
}): Promise<DevArchitectProjectMetrics[]> {
  const allProjects =
    providedProjects ?? (await listDevArchitectProjects(tenantId, bindings));
  const filteredProjects = targetProjectId
    ? allProjects.filter((project) => project.id === targetProjectId)
    : allProjects;
  if (filteredProjects.length === 0) return [];

  const sessions = providedSessions ?? (await listDevArchitectSessions(tenantId, bindings));
  let checklists = providedChecklists;
  if (!checklists) {
    const results = await Promise.all(
      filteredProjects.map((project) => listDevArchitectChecklists(tenantId, bindings, project.id)),
    );
    checklists = results.flat();
  }

  const projectIds = filteredProjects.map((project) => project.id);
  const alertAggregates = await aggregateDevArchitectAlerts(tenantId, bindings, projectIds);
  const checklistMap = new Map<string, DevArchitectChecklist[]>();
  for (const item of checklists ?? []) {
    if (!projectIds.includes(item.project_id)) continue;
    const list = checklistMap.get(item.project_id) ?? [];
    list.push(item);
    checklistMap.set(item.project_id, list);
  }

  return filteredProjects.map<DevArchitectProjectMetrics>((project) => {
    const projectSessions = sessions.filter((session) => session.project_id === project.id);
    const lastAudit = projectSessions.find((session) => {
      if (session.mode !== "Audit") return false;
      return Boolean(parseAuditSummary(session.summary));
    });
    const parsedAudit = lastAudit ? parseAuditSummary(lastAudit.summary) : null;
    const checkItems = checklistMap.get(project.id) ?? [];
    const totals = checkItems.reduce(
      (acc, item) => {
        if (item.status === "ok") acc.ok += 1;
        else acc.pending += 1;
        return acc;
      },
      { ok: 0, pending: 0 },
    );
    const aggregate = alertAggregates.get(project.id);
    const severityEntry =
      aggregate?.max_severity_rank ?? 0;
    const severity = (Object.entries(severityRank).find(([, rank]) => rank === severityEntry)?.[0] ??
      null) as DevArchitectAlertSeverity | null;
    return {
      project_id: project.id,
      alerts_open: aggregate?.alerts_open ?? 0,
      max_severity: severity,
      last_audit_at: parsedAudit?.executedAt ?? lastAudit?.last_interaction_at ?? null,
      last_audit_status: parsedAudit?.statusGlobal ?? null,
      total_rules_ok: totals.ok,
      total_rules_pending: totals.pending,
    };
  });
}
