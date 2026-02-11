"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";
import { TextArea } from "@/components/ui/input";
import type { SaasTask, SaasTaskCategory, SaasTaskStatus, SaasTaskEvent } from "@/lib/tasks/types";
import type { SaasKnowledgeDocument } from "@/lib/knowledge/types";

type Props = {
  saasId: string | null;
};

const STATUS_OPTIONS: Array<{ value: SaasTaskStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "OPEN", label: "Abiertas" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "DONE", label: "Hechas" },
  { value: "DISCARDED", label: "Descartadas" },
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

export default function SaasTasksSection({ saasId }: Props) {
  const [tasks, setTasks] = useState<SaasTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<SaasTask | null>(null);
  const [taskEvents, setTaskEvents] = useState<SaasTaskEvent[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<SaasKnowledgeDocument[]>([]);
  const [statusFilter, setStatusFilter] = useState<SaasTaskStatus | "ALL">("OPEN");
  const [categoryFilter, setCategoryFilter] = useState<SaasTaskCategory | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState("");

  const loadTasks = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ saasId });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      const res = await fetch(`/api/tasks?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { items?: SaasTask[] } | null;
      setTasks(data?.items ?? []);
      if (selectedTask && data?.items) {
        const refreshed = data.items.find((item) => item.id === selectedTask.id) ?? null;
        setSelectedTask(refreshed);
      }
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, saasId, selectedTask, statusFilter]);

  const loadTaskDetail = useCallback(
    async (taskId: string) => {
      if (!saasId) return;
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { task?: SaasTask; events?: SaasTaskEvent[] } | null;
      setSelectedTask(data?.task ?? null);
      setTaskEvents(data?.events ?? []);
      setKnowledgeDocs([]);
    } catch {
      setTaskEvents([]);
      setKnowledgeDocs([]);
    } finally {
      setDetailLoading(false);
    }
  },
  [saasId],
  );

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    function handleRefresh() {
      void loadTasks();
    }
    window.addEventListener("tasks:refresh", handleRefresh);
    return () => window.removeEventListener("tasks:refresh", handleRefresh);
  }, [loadTasks]);

  const handleStatusUpdate = async (taskId: string, status: SaasTaskStatus) => {
    if (!saasId) return;
    await fetch(`/api/tasks/${encodeURIComponent(taskId)}?saasId=${encodeURIComponent(saasId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void loadTasks();
    if (selectedTask?.id === taskId) {
      void loadTaskDetail(taskId);
    }
  };

  const handleComment = async () => {
    if (!saasId || !selectedTask || !comment.trim()) return;
    const taskId = selectedTask.id;
    await fetch(`/api/tasks/${encodeURIComponent(taskId)}?saasId=${encodeURIComponent(saasId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comment: comment.trim() }),
    });
    setComment("");
    void loadTaskDetail(taskId);
  };

  const filteredTaskEvents = useMemo(() => taskEvents ?? [], [taskEvents]);

  useEffect(() => {
    const saasIdValue = saasId;
    const task = selectedTask;
    if (!saasIdValue || !task) return;
    const safeSaasId: string = saasIdValue;
    const selected = task;
    const metadata = (selected.metadata ?? {}) as {
      autopilotKey?: string;
      knowledgeHints?: { spaceSlug?: string; tags?: string[]; targetType?: string; targetId?: string } | null;
    };
    let cancelled = false;
    async function loadRecommendedDocs() {
      const requests: Promise<SaasKnowledgeDocument[]>[] = [];

      const enqueue = (params: URLSearchParams) => {
        const promise = (async () => {
          const res = await fetch(`/api/knowledge/documents?${params.toString()}`, { cache: "no-store" });
          const data = (await res.json().catch(() => null)) as { items?: SaasKnowledgeDocument[] } | null;
          return data?.items ?? [];
        })();
        requests.push(promise);
      };

      if (metadata.autopilotKey) {
        const params = new URLSearchParams({ saasId: safeSaasId, targetType: "AUTOPILOT_KEY", targetId: metadata.autopilotKey });
        enqueue(params);
      }

      if (selected.assigneeEmployeeId) {
        const params = new URLSearchParams({
          saasId: safeSaasId,
          targetType: "EMPLOYEE",
          targetId: selected.assigneeEmployeeId,
        });
        enqueue(params);
      }

      if (metadata.knowledgeHints?.targetType && metadata.knowledgeHints?.targetId) {
        const params = new URLSearchParams({ saasId: safeSaasId, targetType: metadata.knowledgeHints.targetType, targetId: metadata.knowledgeHints.targetId });
        enqueue(params);
      }

      if (metadata.knowledgeHints?.tags?.length) {
        metadata.knowledgeHints.tags.slice(0, 2).forEach((tag) => {
          const params = new URLSearchParams({ saasId: safeSaasId, tag });
          enqueue(params);
        });
      }

      if (metadata.knowledgeHints?.spaceSlug) {
        const params = new URLSearchParams({ saasId: safeSaasId, q: metadata.knowledgeHints.spaceSlug });
        enqueue(params);
      }

      if (requests.length === 0) {
        if (!cancelled) setKnowledgeDocs([]);
        return;
      }

      const results = await Promise.all(requests);
      const merged = results.flat();
      const unique = new Map(merged.map((doc) => [doc.id, doc]));
      if (!cancelled) {
        setKnowledgeDocs(Array.from(unique.values()));
      }
    }
    void loadRecommendedDocs();
    return () => {
      cancelled = true;
    };
  }, [saasId, selectedTask]);

  return (
    <section className="space-y-4" aria-label="Tasks & Playbook">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Tasks & Playbook</p>
        <h2 className="text-xl font-semibold">Tareas operativas</h2>
        <p className="text-sm text-[var(--muted)]">Convierte recomendaciones en tareas asignables.</p>
      </div>

      <Card tone="glass" title="Filtros">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[var(--muted)]">
            Estado
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SaasTaskStatus | "ALL")}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            Categoría
            <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as SaasTaskCategory | "ALL")}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {loading ? (
        <Card title="Cargando" subtitle="Leyendo tareas">
          <p className="text-sm text-[var(--muted)]">Un momento…</p>
        </Card>
      ) : tasks.length === 0 ? (
        <EmptyState title="Sin tareas" subtitle="Convierte recomendaciones en tareas para este SaaS." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
          <Card tone="glass" title="Tareas">
            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Tareas del SaaS">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Categoría</th>
                    <th>Severidad</th>
                    <th>Asignado</th>
                    <th>Estado</th>
                    <th>Due</th>
                    <th>Source</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <button
                          className="text-left font-semibold underline decoration-dotted underline-offset-4"
                          onClick={() => void loadTaskDetail(task.id)}
                        >
                          {task.title}
                        </button>
                      </td>
                      <td>{task.category}</td>
                      <td>
                        <Badge variant={severityVariant[task.severity]}>{task.severity}</Badge>
                      </td>
                      <td>{task.assigneeEmployeeId ?? "Owner"}</td>
                      <td>{task.status}</td>
                      <td>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}</td>
                      <td>{task.source}</td>
                      <td>
                        <Select
                          value={task.status}
                          onChange={(event) => handleStatusUpdate(task.id, event.target.value as SaasTaskStatus)}
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="DONE">DONE</option>
                          <option value="DISCARDED">DISCARDED</option>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card tone="glass" title="Detalle de tarea" subtitle={selectedTask?.title ?? "Selecciona una tarea"}>
            {detailLoading ? (
              <p className="text-sm text-[var(--muted)]">Cargando detalle…</p>
            ) : !selectedTask ? (
              <p className="text-sm text-[var(--muted)]">Selecciona una tarea para ver el detalle.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Descripción</p>
                  <p className="text-sm text-[var(--muted)]">{selectedTask.description ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Playbooks recomendados</p>
                  {knowledgeDocs.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">Sin playbooks asociados.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-[var(--muted)]">
                      {knowledgeDocs.slice(0, 5).map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between gap-2">
                          <span>{doc.title}</span>
                          <span className="text-[var(--muted)]">{doc.type}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Metadata</p>
                  <pre className="rounded-xl border border-[var(--border)] bg-[var(--panel-alt)] p-2 text-xs text-[var(--muted)]">
                    {JSON.stringify(selectedTask.metadata ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Eventos</p>
                  {filteredTaskEvents.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">Sin eventos.</p>
                  ) : (
                    <ul className="space-y-2 text-xs text-[var(--muted)]">
                      {filteredTaskEvents.map((event) => (
                        <li key={event.id} className="rounded-lg border border-[var(--border)] p-2">
                          <p className="font-semibold">{event.type}</p>
                          <p>{event.payload ? JSON.stringify(event.payload) : "—"}</p>
                          <p className="text-[var(--muted)]">{new Date(event.createdAt).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Comentario</p>
                  <TextArea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
                  <Button size="sm" variant="outline" onClick={handleComment} disabled={!comment.trim()}>
                    Añadir comentario
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
