"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";
import DevArchitectSessionsPanel from "@/app/dev-architects/dev-architect-sessions-panel";
import {
  getOrchestratorContext,
  setOrchestratorContext,
  subscribeOrchestratorContext,
  type DevArchitectContext,
  type DevArchitectMode,
} from "@/lib/orchestrator-context";
import {
  DEV_ARCHITECT_CHECKLIST_RULES,
  DEV_ARCHITECT_MODES,
} from "@/lib/dev-architects/data";
import { parseAuditSummary } from "@/lib/dev-architects/audit";
import type {
  DevArchitectChecklist,
  DevArchitectChecklistStatus,
  DevArchitectProject,
  DevArchitectProjectMetrics,
  DevArchitectSession,
  DevArchitectTask,
  DevArchitectTaskStatus,
} from "@/lib/dev-architects/types";
import { DEV_ARCHITECT_AGENT } from "@/lib/dev-architects/agent";
import { AlertTriangle, Code2, GitBranch, ListTodo, Plus, ServerCog, ShieldCheck, Sparkles } from "lucide-react";

type DevArchitectState = {
  projects: DevArchitectProject[];
  sessions: DevArchitectSession[];
  checklists: DevArchitectChecklist[];
  metrics: DevArchitectProjectMetrics[];
  tasks: DevArchitectTask[];
  activeProjectId: string;
  mode: DevArchitectMode;
  taskCounts: {
    todo: number;
    in_progress: number;
    done: number;
    blocked: number;
  };
};

const defaultState: DevArchitectState = {
  projects: [],
  sessions: [],
  checklists: [],
  metrics: [],
  tasks: [],
  activeProjectId: "",
  mode: DEV_ARCHITECT_MODES[0],
  taskCounts: { todo: 0, in_progress: 0, done: 0, blocked: 0 },
};

function normalizeState(payload?: DevArchitectContext["devArchitect"]): DevArchitectState {
  const projects = payload?.projects ?? [];
  const sessions = payload?.sessions ?? [];
  const checklists = payload?.checklists ?? [];
  const metrics = payload?.metrics ?? [];
  const tasks = payload?.tasks ?? [];
  const hasActive = payload?.activeProjectId && projects.some((project) => project.id === payload.activeProjectId);
  const activeProjectId = hasActive ? (payload?.activeProjectId as string) : projects[0]?.id ?? "";
  const mode = payload?.mode && DEV_ARCHITECT_MODES.includes(payload.mode as DevArchitectMode)
    ? (payload.mode as DevArchitectMode)
    : DEV_ARCHITECT_MODES[0];
  const taskCounts = payload?.taskCounts ?? summarizeTasks(tasks);
  return { projects, sessions, checklists, metrics, tasks, activeProjectId, mode, taskCounts };
}

function formatDate(value?: string | null) {
  if (!value) return "Sin registros";
  try {
    return new Date(value).toLocaleString("es-ES", { hour12: false });
  } catch {
    return value;
  }
}

function resolveAlertVariant(severity?: string | null): "ok" | "warn" | "err" | "info" {
  if (!severity) return "ok";
  if (severity === "critical" || severity === "high") return "err";
  if (severity === "medium") return "warn";
  if (severity === "low") return "info";
  return "warn";
}

function summarizeTasks(tasks: DevArchitectTask[]) {
  return tasks.reduce(
    (acc, task) => {
      if (task.status === "todo") acc.todo += 1;
      else if (task.status === "in_progress") acc.in_progress += 1;
      else if (task.status === "done") acc.done += 1;
      else if (task.status === "blocked") acc.blocked += 1;
      return acc;
    },
    { todo: 0, in_progress: 0, done: 0, blocked: 0 },
  );
}

const taskStatusOrder: DevArchitectTaskStatus[] = ["todo", "in_progress", "done", "blocked"];
const taskStatusLabels: Record<DevArchitectTaskStatus, string> = {
  todo: "TODO",
  in_progress: "EN PROCESO",
  done: "DONE",
  blocked: "BLOQUEADA",
};
const taskStatusVariants: Record<DevArchitectTaskStatus, "info" | "warn" | "ok" | "err"> = {
  todo: "info",
  in_progress: "warn",
  done: "ok",
  blocked: "err",
};
const taskPriorityVariants: Record<string, "info" | "warn" | "err"> = {
  low: "info",
  medium: "info",
  high: "warn",
  urgent: "err",
};
const taskPriorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
const taskSourceLabels: Record<string, string> = {
  manual: "Manual",
  audit: "Auditoría",
  alert: "Alerta",
};

export default function DevArchitectsPage() {
  const [state, setState] = useState<DevArchitectState>(() => {
    const existing = getOrchestratorContext();
    return existing?.scope === "devarchitect" && existing.devArchitect
      ? normalizeState(existing.devArchitect)
      : defaultState;
  });
  const initialStateRef = useRef(state);
  const [loadingProjects, setLoadingProjects] = useState(state.projects.length === 0);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingChecklistKey, setSavingChecklistKey] = useState<string | null>(null);
  const [isLogbookOpen, setIsLogbookOpen] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasksFilter, setTasksFilter] = useState<DevArchitectTaskStatus | "all">("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const publishContext = useCallback((next: DevArchitectState) => {
    const tasks = next.tasks ?? [];
    const taskCounts = next.taskCounts ?? summarizeTasks(tasks);
    setOrchestratorContext({
      scope: "devarchitect",
      agentId: "devarchitect",
      devArchitect: {
        ...next,
        tasks,
        taskCounts,
      },
    });
  }, []);

  const updateState = useCallback((updater: (prev: DevArchitectState) => DevArchitectState, syncContext = false) => {
    setState((prev) => {
      const next = updater(prev);
      const hydrated: DevArchitectState = {
        ...next,
        taskCounts: summarizeTasks(next.tasks ?? []),
      };
      if (syncContext) {
        publishContext(hydrated);
      }
      return hydrated;
    });
  }, [publishContext]);

  useEffect(() => {
    const current = getOrchestratorContext();
    if (current?.scope === "devarchitect" && current.devArchitect) {
      if (current.agentId !== "devarchitect") {
        setOrchestratorContext({ ...current, agentId: "devarchitect" });
      }
    } else {
      setOrchestratorContext({ scope: "devarchitect", agentId: "devarchitect", devArchitect: initialStateRef.current });
    }

    const unsubscribe = subscribeOrchestratorContext((payload) => {
      if (payload?.scope === "devarchitect" && payload.devArchitect) {
        setState(normalizeState(payload.devArchitect));
      }
    });

    return () => {
      unsubscribe();
      setOrchestratorContext(null);
    };
  }, []);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/dev-architects/projects", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudieron cargar los proyectos");
    const data = (await res.json()) as { items?: DevArchitectProject[] };
    const items = data.items ?? [];
    let resolvedActive = "";
    updateState((prev) => {
      const active = prev.activeProjectId && items.some((project) => project.id === prev.activeProjectId)
        ? prev.activeProjectId
        : items[0]?.id ?? "";
      resolvedActive = active;
      return { ...prev, projects: items, activeProjectId: active };
    }, true);
    return { projects: items, activeProjectId: resolvedActive };
  }, [updateState]);

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/dev-architects/sessions", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudieron cargar las sesiones");
    const data = (await res.json()) as { items?: DevArchitectSession[] };
    updateState((prev) => ({ ...prev, sessions: data.items ?? [] }), true);
  }, [updateState]);

  const fetchChecklistsForProjects = useCallback(async (projects: DevArchitectProject[]) => {
    if (projects.length === 0) {
      updateState((prev) => ({ ...prev, checklists: [] }), true);
      return;
    }
    setLoadingChecklists(true);
    const results = await Promise.allSettled(
      projects.map(async (project) => {
        const res = await fetch(`/api/dev-architects/checklists?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Checklist falló para ${project.name}`);
        const data = (await res.json()) as { items?: DevArchitectChecklist[] };
        return data.items ?? [];
      }),
    );
    const aggregated: DevArchitectChecklist[] = [];
    const errors: string[] = [];
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        aggregated.push(...result.value);
      } else {
        errors.push(result.reason instanceof Error ? result.reason.message : "Error sincronizando checklists");
      }
    });
    updateState((prev) => ({ ...prev, checklists: aggregated }), true);
    if (errors.length > 0) {
      setError(errors.join(". "));
    }
    setLoadingChecklists(false);
  }, [updateState]);

  const fetchMetrics = useCallback(async () => {
    const res = await fetch("/api/dev-architects/metrics", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudieron cargar las métricas");
    const data = (await res.json()) as { items?: DevArchitectProjectMetrics[] };
    updateState((prev) => ({ ...prev, metrics: data.items ?? [] }), true);
  }, [updateState]);

  const fetchTasks = useCallback(async (projectId?: string) => {
    if (!projectId) {
      updateState((prev) => ({ ...prev, tasks: [] }), true);
      return;
    }
    setTasksLoading(true);
    setTasksError(null);
    try {
      const params = new URLSearchParams({ projectId });
      const res = await fetch(`/api/dev-architects/tasks?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar las tareas");
      const data = (await res.json()) as { items?: DevArchitectTask[] };
      updateState((prev) => ({ ...prev, tasks: data.items ?? [] }), true);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Error sincronizando tareas");
      updateState((prev) => ({ ...prev, tasks: [] }), true);
    } finally {
      setTasksLoading(false);
    }
  }, [updateState]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setLoadingProjects(true);
      setError(null);
      try {
        const { projects, activeProjectId } = await fetchProjects();
        if (cancelled) return;
        const targetProjectId = activeProjectId ?? projects[0]?.id;
        await Promise.all([
          fetchSessions(),
          fetchChecklistsForProjects(projects),
          fetchMetrics(),
          fetchTasks(targetProjectId),
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error sincronizando DevArchitect");
        }
      } finally {
        if (!cancelled) {
          setLoadingProjects(false);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [fetchProjects, fetchSessions, fetchChecklistsForProjects, fetchMetrics, fetchTasks]);

  useEffect(() => {
    if (!state.activeProjectId) return;
    void fetchTasks(state.activeProjectId);
  }, [state.activeProjectId, fetchTasks]);

  const activeProject = useMemo(
    () => state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0] ?? null,
    [state.activeProjectId, state.projects],
  );

  const projectSessions = useMemo(
    () => state.sessions
      .filter((session) => session.project_id === state.activeProjectId)
      .sort((a, b) => new Date(b.last_interaction_at).getTime() - new Date(a.last_interaction_at).getTime()),
    [state.sessions, state.activeProjectId],
  );

  const metricsByProject = useMemo(() => {
    return state.metrics.reduce<Record<string, DevArchitectProjectMetrics>>((acc, metric) => {
      acc[metric.project_id] = metric;
      return acc;
    }, {});
  }, [state.metrics]);

  const taskCounts = state.taskCounts;
  const filteredTasks = useMemo(() => {
    if (tasksFilter === "all") return state.tasks;
    return state.tasks.filter((task) => task.status === tasksFilter);
  }, [state.tasks, tasksFilter]);

  const buildSnapshot = useMemo(() => {
    const status = (activeProject?.last_build_status ?? activeProject?.status ?? "pending").toUpperCase();
    const variant = status.includes("ERR") || status.includes("ERROR") ? "err" : status.includes("OK") ? "ok" : "warn";
    return {
      status,
      variant,
      lastRun: activeProject?.updated_at ? formatDate(activeProject.updated_at) : "Sin registros",
    };
  }, [activeProject]);

  const lastAction = useMemo(() => {
    const latest = projectSessions[0];
    return {
      action: latest?.title ?? "Sin actividad registrada",
      timestamp: latest ? formatDate(latest.last_interaction_at) : "Sin registros",
      mode: latest?.mode ?? state.mode,
    };
  }, [projectSessions, state.mode]);

  const lastAudit = useMemo(() => {
    for (const session of projectSessions) {
      const parsed = parseAuditSummary(session.summary);
      if (parsed) {
        return { session, summary: parsed };
      }
    }
    return null;
  }, [projectSessions]);

  const activeMetrics = activeProject ? metricsByProject[activeProject.id] : undefined;
  const projectAlertsOpen = activeMetrics?.alerts_open ?? 0;
  const projectAlertsVariant = projectAlertsOpen === 0 ? "ok" : resolveAlertVariant(activeMetrics?.max_severity ?? null);
  const projectAlertsLabel = projectAlertsOpen === 0
    ? "Sin alertas abiertas"
    : `${projectAlertsOpen} alerta${projectAlertsOpen === 1 ? "" : "s"} abiertas`;
  const alertsLink = activeProject ? `/alerts?devProjectId=${encodeURIComponent(activeProject.id)}` : null;

  const checklistRules = useMemo(() => {
    return DEV_ARCHITECT_CHECKLIST_RULES.map((rule) => ({
      ...rule,
      projectStatuses: state.projects.map((project) => {
        const record = state.checklists.find((item) => item.project_id === project.id && item.key === rule.key);
        const status = (record?.status ?? "pending") as DevArchitectChecklistStatus;
        return { projectId: project.id, name: project.name, status };
      }),
    }));
  }, [state.checklists, state.projects]);

  const handleProjectSelect = useCallback((projectId: string) => {
    updateState((prev) => {
      if (prev.activeProjectId === projectId) return prev;
      return { ...prev, activeProjectId: projectId };
    }, true);
  }, [updateState]);

  const handleChecklistToggle = useCallback(async (
    projectId: string,
    key: string,
    currentStatus: DevArchitectChecklistStatus,
  ) => {
    const nextStatus: DevArchitectChecklistStatus = currentStatus === "ok" ? "pending" : "ok";
    setSavingChecklistKey(`${projectId}:${key}`);
    setError(null);
    try {
      const res = await fetch("/api/dev-architects/checklists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, key, status: nextStatus }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar la checklist");
      const data = (await res.json()) as { items?: DevArchitectChecklist[] };
      const updated = data.items ?? [];
      updateState((prev) => {
        const filtered = prev.checklists.filter((item) => item.project_id !== projectId);
        return { ...prev, checklists: [...filtered, ...updated] };
      }, true);
      void fetchMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando checklist");
    } finally {
      setSavingChecklistKey(null);
    }
  }, [updateState, fetchMetrics]);

  const handleAddTask = useCallback(async () => {
    if (!state.activeProjectId) {
      setTasksError("Selecciona un proyecto antes de crear tareas");
      return;
    }
    if (!newTaskTitle.trim()) return;
    setTasksError(null);
    try {
      const res = await fetch("/api/dev-architects/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: state.activeProjectId,
          title: newTaskTitle.trim(),
          source: "manual",
          status: "todo",
        }),
      });
      if (!res.ok) throw new Error("No se pudo crear la tarea");
      setNewTaskTitle("");
      await fetchTasks(state.activeProjectId);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Error creando la tarea");
    }
  }, [fetchTasks, newTaskTitle, state.activeProjectId]);

  const cycleTaskStatus = useCallback((value: DevArchitectTaskStatus) => {
    const index = taskStatusOrder.indexOf(value);
    const nextIndex = (index + 1) % taskStatusOrder.length;
    return taskStatusOrder[nextIndex];
  }, []);

  const handleTaskStatusToggle = useCallback(async (task: DevArchitectTask) => {
    if (!state.activeProjectId) return;
    const nextStatus = cycleTaskStatus(task.status);
    setUpdatingTaskId(task.id);
    try {
      const res = await fetch("/api/dev-architects/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: task.id, projectId: task.project_id, status: nextStatus }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar el estado de la tarea");
      await fetchTasks(state.activeProjectId);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Error actualizando la tarea");
    } finally {
      setUpdatingTaskId(null);
    }
  }, [cycleTaskStatus, fetchTasks, state.activeProjectId]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Staff técnico IA</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">DevArchitect – Staff técnico IA</h1>
          <Badge variant="info">{DEV_ARCHITECT_AGENT.name}</Badge>
        </div>
        <p className="text-sm text-[var(--muted)]">Panel interno para proyectos, builds y checklists OLIMPO.</p>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {loadingProjects && <p className="text-xs text-[var(--muted)]">Sincronizando datos de DevArchitect...</p>}
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          tone="glass"
          title="Proyecto activo"
          subtitle="Memoria y estado del clon DevArchitect."
          icon={<Code2 className="h-5 w-5" />}
        >
          <div className="space-y-2">
            <p className="text-lg font-semibold">{activeProject?.name ?? "Sin proyecto seleccionado"}</p>
            <div className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1"><GitBranch className="h-4 w-4" /> Rama {activeProject?.branch_name ?? "-"}</span>
              <span className="inline-flex items-center gap-1"><ServerCog className="h-4 w-4" /> Origen {activeProject?.origin ?? activeProject?.origin_url ?? "N/D"}</span>
            </div>
            <Badge variant={activeProject?.status === "broken" ? "err" : activeProject?.status === "pending" ? "warn" : "ok"}>
              {activeProject?.status ?? "sin estado"}
            </Badge>
          </div>
        </Card>
        <Card tone="glass" title="Estado de build" subtitle="Guardian del pipeline" icon={<ServerCog className="h-5 w-5" />}>
          <div className="space-y-3">
            <Badge variant={buildSnapshot.variant as "ok" | "err" | "warn"}>{buildSnapshot.status}</Badge>
            <div className="text-sm text-[var(--muted)]">
              <p>Última ejecución</p>
              <p className="text-base text-[var(--foreground)] font-semibold">{buildSnapshot.lastRun}</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-[var(--border)]/50 bg-[var(--panel)]/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Alertas</p>
                  <p className="text-base font-semibold text-[var(--foreground)]">{projectAlertsOpen}</p>
                </div>
                {alertsLink && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => window.open(alertsLink, "_blank", "noreferrer")}
                    type="button"
                  >
                    Ver alertas
                  </Button>
                )}
              </div>
              <Badge variant={projectAlertsVariant}>{projectAlertsLabel}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsLogbookOpen(true)}>Ver bitácora</Button>
          </div>
        </Card>
        <Card tone="glass" title="Última acción del clon" subtitle="Memoria inmediata" icon={<Sparkles className="h-5 w-5" />}>
          <div className="space-y-2">
            <p className="text-lg font-semibold">{lastAction.action}</p>
            <p className="text-sm text-[var(--muted)]">{lastAction.timestamp}</p>
            <p className="text-xs text-[var(--muted)]">Modo activo: {lastAction.mode}</p>
          </div>
        </Card>
      </div>

      <Card
        tone="glass"
        title="Auditoría OLIMPO"
        subtitle="Historial del auditor estático"
        icon={<ShieldCheck className="h-5 w-5" />}
      >
        {lastAudit ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={lastAudit.summary.statusGlobal === "OK" ? "ok" : "warn"}>
                {lastAudit.summary.statusGlobal}
              </Badge>
              <p className="text-sm text-[var(--muted)]">
                Última ejecución: {formatDate(lastAudit.summary.executedAt ?? lastAudit.session.last_interaction_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lastAudit.summary.rules.length > 0 ? (
                lastAudit.summary.rules.map((rule) => (
                  <Badge key={rule.key} variant={rule.status === "ok" ? "ok" : "warn"}>
                    {rule.label}: {rule.status === "ok" ? "OK" : "Pending"}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-[var(--muted)]">Sin resultados detallados en esta auditoría.</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Aún no se ha ejecutado ninguna auditoría para este proyecto. Ejecuta <code className="font-mono text-xs">npm run devarchitect:audit</code> para generar la primera bitácora.
          </p>
        )}
      </Card>

      <Card
        tone="glass"
        title="Proyectos registrados"
        subtitle="Inventario técnico del staff interno."
      >
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH className="px-4 py-3 text-left">Project</TH>
                <TH className="px-4 py-3 text-left">Type</TH>
                <TH className="px-4 py-3 text-left">Source</TH>
                <TH className="px-4 py-3 text-left">Status</TH>
                <TH className="px-4 py-3 text-left">Alerts</TH>
              </tr>
            </THead>
            <TBody>
              {state.projects.map((project) => {
                const isActive = project.id === state.activeProjectId;
                const projectMetric = metricsByProject[project.id];
                const projectAlertCount = projectMetric?.alerts_open ?? 0;
                const projectAlertVariant = projectAlertCount === 0
                  ? "ok"
                  : resolveAlertVariant(projectMetric?.max_severity ?? null);
                const projectAlertsLink = `/alerts?devProjectId=${encodeURIComponent(project.id)}`;
                return (
                  <tr
                    key={project.id}
                    className={`border-t border-[var(--border)]/40 hover:bg-[var(--panel)]/40 transition cursor-pointer ${isActive ? "bg-[var(--panel)]/60" : ""}`}
                    onClick={() => handleProjectSelect(project.id)}
                  >
                    <TD className="px-4 py-3 text-sm">
                      <div className="font-semibold">{project.name}</div>
                      <p className="text-xs text-[var(--muted)]">{project.branch_name ?? "sin rama"}</p>
                    </TD>
                    <TD className="px-4 py-3 text-sm text-[var(--muted)]">{project.type}</TD>
                    <TD className="px-4 py-3 text-sm text-[var(--muted)]">{project.origin ?? project.origin_url ?? "N/D"}</TD>
                    <TD className="px-4 py-3">
                      <Badge
                        variant={
                          project.status === "active"
                            ? "ok"
                            : project.status === "broken"
                              ? "err"
                              : "warn"
                        }
                      >
                        {project.status}
                      </Badge>
                    </TD>
                    <TD className="px-4 py-3 text-sm">
                      <a
                        href={projectAlertsLink}
                        className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] transition"
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <AlertTriangle
                          className={`h-4 w-4 ${projectAlertCount === 0 ? "text-emerald-400" : "text-amber-400"}`}
                          aria-hidden="true"
                        />
                        <Badge variant={projectAlertVariant}>{projectAlertCount}</Badge>
                      </a>
                    </TD>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <Card
        tone="glass"
        title="Checklists OLIMPO"
        subtitle="Reglas técnicas que DevArchitect valida en cada build."
      >
        {loadingChecklists && (
          <p className="text-xs text-[var(--muted)] mb-3">Sincronizando checklists...</p>
        )}
        <div className="space-y-5">
          {checklistRules.map((rule) => (
            <div key={rule.key} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/50 p-4 space-y-3">
              <div>
                <p className="text-base font-semibold">{rule.label}</p>
                <p className="text-sm text-[var(--muted)]">{rule.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {rule.projectStatuses.map((project) => {
                  const badgeVariant = project.status === "ok" ? "ok" : "warn";
                  const cacheKey = `${project.projectId}:${rule.key}`;
                  const loading = savingChecklistKey === cacheKey;
                  return (
                    <button
                      key={cacheKey}
                      type="button"
                      onClick={() => handleChecklistToggle(project.projectId, rule.key, project.status)}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded-full"
                      disabled={loading}
                    >
                      <Badge variant={badgeVariant}>{project.name}: {project.status === "ok" ? "OK" : "Pending"}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card
        tone="glass"
        title="Backlog técnico OLIMPO"
        subtitle="Tareas clave del clon DevArchitect"
        icon={<ListTodo className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", ...taskStatusOrder] as Array<DevArchitectTaskStatus | "all">).map((statusKey) => {
              const isActive = tasksFilter === statusKey;
              const countValue = statusKey === "all"
                ? state.tasks.length
                : taskCounts[statusKey as DevArchitectTaskStatus] ?? 0;
              return (
                <button
                  key={statusKey}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${isActive ? "border-[var(--brand)] text-[var(--brand)]" : "border-[var(--border)]/60 text-[var(--muted)] hover:border-[var(--brand)]/40"}`}
                  onClick={() => setTasksFilter(statusKey)}
                >
                  {statusKey === "all" ? "Todas" : taskStatusLabels[statusKey as DevArchitectTaskStatus]} ({countValue})
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <TextInput
              aria-label="Nueva tarea manual"
              placeholder="Nueva tarea manual"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              className="flex-1 min-w-[220px]"
            />
            <Button variant="brand" size="sm" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
              <Plus className="h-4 w-4" /> Añadir tarea
            </Button>
          </div>
          {tasksError && <p className="text-sm text-rose-400">{tasksError}</p>}
          {tasksLoading ? (
            <p className="text-sm text-[var(--muted)]">Sincronizando backlog...</p>
          ) : filteredTasks.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No hay tareas registradas para este proyecto. Ejecuta <code className="font-mono text-xs">npm run devarchitect:audit</code> o añade una manualmente.
            </p>
          ) : (
            <ul className="space-y-3">
              {filteredTasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-2xl border border-[var(--border)]/50 bg-[var(--panel)]/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-[var(--muted)]">{task.description}</p>
                      )}
                      <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                        Actualizado: {formatDate(task.updated_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded-full"
                        onClick={() => handleTaskStatusToggle(task)}
                        disabled={updatingTaskId === task.id}
                      >
                        <Badge variant={taskStatusVariants[task.status]}>
                          {taskStatusLabels[task.status]}
                        </Badge>
                      </button>
                      <Badge variant={taskPriorityVariants[task.priority] ?? "info"}>
                        {taskPriorityLabels[task.priority] ?? task.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                    <span>Fuente: {taskSourceLabels[task.source] ?? task.source}</span>
                    {task.due_date && <span>Due: {formatDate(task.due_date)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      <DevArchitectSessionsPanel
        open={isLogbookOpen}
        onClose={() => setIsLogbookOpen(false)}
        projectId={state.activeProjectId}
        projectName={activeProject?.name}
      />
    </div>
  );
}
