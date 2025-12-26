"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";
import type { SaasTaskCategory, SaasTaskStatus } from "@/lib/tasks/types";
import type { SaasKnowledgeDocument } from "@/lib/knowledge/types";

type OwnerTaskListItem = {
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
  severity: "INFO" | "SUGGESTION" | "WARNING" | "CRITICAL";
  metadata?: Record<string, unknown> | null;
};

type OwnerTasksSummary = {
  totalOpen: number;
  totalInProgress: number;
  totalBlocked: number;
  totalDone: number;
  bySaas: Record<string, { saasId: string; saasName: string; open: number; inProgress: number; blocked: number; done: number }>;
  byCategory: Record<string, number>;
};

const STATUS_OPTIONS: Array<{ value: SaasTaskStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "OPEN", label: "Abiertas" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "DONE", label: "Hechas" },
  { value: "DISCARDED", label: "Bloqueadas" },
];

const CATEGORY_OPTIONS: Array<{ value: SaasTaskCategory | "ALL"; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "ECONOMY", label: "Economía" },
  { value: "HR", label: "HR" },
  { value: "SOCIAL", label: "Social" },
  { value: "EMAIL", label: "Email" },
  { value: "BLUEPRINT", label: "Blueprint" },
  { value: "TAX", label: "Impuestos" },
  { value: "OTHER", label: "Otros" },
];

const severityVariant = {
  INFO: "neutral",
  SUGGESTION: "info",
  WARNING: "warn",
  CRITICAL: "err",
} as const;

export default function OwnerTasksBoard() {
  const [tasks, setTasks] = useState<OwnerTaskListItem[]>([]);
  const [summary, setSummary] = useState<OwnerTasksSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SaasTaskStatus | "ALL">("OPEN");
  const [categoryFilter, setCategoryFilter] = useState<SaasTaskCategory | "ALL">("ALL");
  const [saasFilter, setSaasFilter] = useState<string>("ALL");
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [selectedTask, setSelectedTask] = useState<OwnerTaskListItem | null>(null);
  const [playbooks, setPlaybooks] = useState<SaasKnowledgeDocument[]>([]);
  const [playbooksLoading, setPlaybooksLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (saasFilter !== "ALL") params.set("saasId", saasFilter);
      const res = await fetch(`/api/owner/tasks?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { tasks?: OwnerTaskListItem[]; summary?: OwnerTasksSummary } | null;
      setTasks(data?.tasks ?? []);
      setSummary(data?.summary ?? null);
      if (selectedTask && data?.tasks) {
        const refreshed = data.tasks.find((item) => item.taskId === selectedTask.taskId) ?? null;
        setSelectedTask(refreshed);
      }
    } catch (err) {
      setTasks([]);
      setSummary(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar el board");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, saasFilter, selectedTask]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    if (!onlyCritical) return tasks;
    return tasks.filter((task) => task.severity === "CRITICAL");
  }, [onlyCritical, tasks]);

  const saasOptions = useMemo(() => {
    const unique = new Map<string, string>();
    tasks.forEach((task) => {
      if (!unique.has(task.saasId)) unique.set(task.saasId, task.saasName);
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const loadPlaybooks = useCallback(
    async (task: OwnerTaskListItem) => {
      setPlaybooksLoading(true);
      setPlaybooks([]);
      try {
        const hints = (task.metadata?.knowledgeHints as { tags?: string[]; targetType?: string; targetId?: string } | undefined) ?? null;
        const documents: SaasKnowledgeDocument[] = [];
        if (hints?.targetType && hints?.targetId) {
          const res = await fetch(
            `/api/knowledge/documents?saasId=${encodeURIComponent(task.saasId)}&targetType=${encodeURIComponent(
              hints.targetType,
            )}&targetId=${encodeURIComponent(hints.targetId)}`,
            { cache: "no-store" },
          );
          const data = (await res.json().catch(() => null)) as { items?: SaasKnowledgeDocument[] } | null;
          documents.push(...(data?.items ?? []));
        }
        if (hints?.tags?.length) {
          const tagFetches = hints.tags.map(async (tag) => {
            const res = await fetch(
              `/api/knowledge/documents?saasId=${encodeURIComponent(task.saasId)}&tag=${encodeURIComponent(tag)}`,
              { cache: "no-store" },
            );
            const data = (await res.json().catch(() => null)) as { items?: SaasKnowledgeDocument[] } | null;
            return data?.items ?? [];
          });
          const results = await Promise.all(tagFetches);
          results.flat().forEach((doc) => documents.push(doc));
        }
        const unique = new Map(documents.map((doc) => [doc.id, doc]));
        setPlaybooks(Array.from(unique.values()));
      } catch {
        setPlaybooks([]);
      } finally {
        setPlaybooksLoading(false);
      }
    },
    [],
  );

  const handleSelectTask = (task: OwnerTaskListItem) => {
    setSelectedTask(task);
    void loadPlaybooks(task);
  };

  return (
    <Card title="Owner Tasks & Autopilot Board" subtitle="Tareas cruzadas por SaaS con contexto y playbooks">
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando tareas...</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : filteredTasks.length === 0 ? (
        <EmptyState title="Sin tareas" subtitle="No hay tareas con los filtros actuales." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--muted)]">Abiertas</p>
              <p className="text-xl font-semibold">{summary?.totalOpen ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">En progreso</p>
              <p className="text-xl font-semibold">{summary?.totalInProgress ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Bloqueadas</p>
              <p className="text-xl font-semibold">{summary?.totalBlocked ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Hechas</p>
              <p className="text-xl font-semibold">{summary?.totalDone ?? 0}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>
              Tienes {summary?.totalOpen ?? 0} tareas abiertas en {Object.keys(summary?.bySaas ?? {}).length} SaaS.
            </span>
            {summary?.byCategory && Object.keys(summary.byCategory).length > 0 && (
              <span>
                Categorias top: {Object.entries(summary.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([key, value]) => `${key} (${value})`)
                  .join(", ")}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SaasTaskStatus | "ALL")}> 
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as SaasTaskCategory | "ALL")}> 
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select value={saasFilter} onChange={(event) => setSaasFilter(event.target.value)}>
              <option value="ALL">Todos los SaaS</option>
              {saasOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
            <Button size="sm" variant={onlyCritical ? "primary" : "outline"} onClick={() => setOnlyCritical((prev) => !prev)}>
              {onlyCritical ? "Mostrando criticas" : "Solo criticas"}
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Owner tasks">
                <thead>
                  <tr>
                    <th>SaaS</th>
                    <th>Titulo</th>
                    <th>Categoria</th>
                    <th>Estado</th>
                    <th>Origen</th>
                    <th>Actualizado</th>
                    <th>CTA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.taskId}>
                      <td>{task.saasName}</td>
                      <td>
                        <div className="space-y-1">
                          <button type="button" className="text-left font-semibold" onClick={() => handleSelectTask(task)}>
                            {task.title}
                          </button>
                          <Badge variant={severityVariant[task.severity]}>{task.severity}</Badge>
                        </div>
                      </td>
                      <td>{task.category}</td>
                      <td>{task.status}</td>
                      <td>{task.origin}</td>
                      <td>{new Date(task.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <a className="text-xs text-[var(--brand)]" href={`/saas/${task.saasId}#tasks`}>
                            Abrir SaaS
                          </a>
                          <button className="text-xs text-[var(--brand)]" onClick={() => handleSelectTask(task)}>
                            Ver playbooks
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/60 p-3">
              {!selectedTask ? (
                <p className="text-sm text-[var(--muted)]">Selecciona una tarea para ver playbooks.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[var(--muted)]">Tarea seleccionada</p>
                    <p className="text-sm font-semibold">{selectedTask.title}</p>
                    <p className="text-[11px] text-[var(--muted)]">{selectedTask.saasName}</p>
                  </div>
                  {playbooksLoading ? (
                    <p className="text-xs text-[var(--muted)]">Cargando playbooks...</p>
                  ) : playbooks.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No hay playbooks sugeridos.</p>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {playbooks.map((doc) => (
                        <li key={doc.id} className="rounded-lg border border-[var(--border)]/60 bg-[var(--panel)]/60 p-2">
                          <p className="font-semibold">{doc.title}</p>
                          <p className="text-[10px] text-[var(--muted)]">{doc.summary ?? doc.type}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
