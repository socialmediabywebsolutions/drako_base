"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { WeeklyGoal, WeeklyGoalStatus, WeeklyGoalType } from "@/app/api/mentoria/weekly-goals/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addWeeks(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(d)} – ${fmt(end)}`;
}

const STATUS_LABELS: Record<WeeklyGoalStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Completado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<WeeklyGoalStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-600",
};

const TYPE_LABELS: Record<WeeklyGoalType, string> = {
  task: "Tarea",
  sessions: "Sesiones",
  score: "Nota",
};

const TYPE_COLORS: Record<WeeklyGoalType, string> = {
  task: "bg-sky-50 text-sky-700",
  sessions: "bg-violet-50 text-violet-700",
  score: "bg-orange-50 text-orange-700",
};

const SUBJECT_OPTIONS = [
  { value: "matematicas", label: "Matemáticas" },
  { value: "fisica", label: "Física" },
  { value: "quimica", label: "Química" },
  { value: "biologia", label: "Biología" },
  { value: "lengua", label: "Lengua" },
  { value: "historia", label: "Historia" },
  { value: "ingles", label: "Inglés" },
  { value: "frances", label: "Francés" },
  { value: "filosofia", label: "Filosofía" },
  { value: "programacion", label: "Programación" },
  { value: "economia", label: "Economía" },
  { value: "geografia", label: "Geografía" },
  { value: "arte", label: "Arte" },
  { value: "musica", label: "Música" },
  { value: "educacion_fisica", label: "Ed. Física" },
  { value: "tecnologia", label: "Tecnología" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function MentorWeeklyGoals() {
  const params = useSearchParams();
  const studentId = params.get("studentId") ?? "";

  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()));
  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formType, setFormType] = useState<WeeklyGoalType>("task");
  const [formTarget, setFormTarget] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/mentoria/weekly-goals?studentId=${encodeURIComponent(studentId)}&weekStart=${weekStart}`
      );
      if (!res.ok) throw new Error("Error al cargar objetivos");
      const data = await res.json() as { goals: WeeklyGoal[] };
      setGoals(data.goals ?? []);
    } catch {
      setError("No se pudieron cargar los objetivos.");
    } finally {
      setLoading(false);
    }
  }, [studentId, weekStart]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        studentId,
        weekStart,
        title: formTitle.trim(),
        goalType: formType,
      };
      if (formSubject) body.subjectSlug = formSubject;
      if (formTarget) body.targetValue = Number(formTarget);
      if (formNotes.trim()) body.notes = formNotes.trim();

      const res = await fetch("/api/mentoria/weekly-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setFormTitle("");
      setFormSubject("");
      setFormType("task");
      setFormTarget("");
      setFormNotes("");
      setShowForm(false);
      await load();
    } catch {
      alert("Error al crear el objetivo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(goal: WeeklyGoal, status: WeeklyGoalStatus) {
    try {
      await fetch("/api/mentoria/weekly-goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal.id, status }),
      });
      await load();
    } catch {
      alert("Error al actualizar el objetivo.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este objetivo?")) return;
    try {
      await fetch(`/api/mentoria/weekly-goals?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await load();
    } catch {
      alert("Error al eliminar el objetivo.");
    }
  }

  const isCurrentWeek = weekStart === mondayOfWeek(new Date());

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`}
            className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
          >
            ← Volver
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">🎯 Objetivos semanales</h1>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between rounded-[28px] bg-white p-4 shadow-sm">
          <button
            onClick={() => setWeekStart(w => addWeeks(w, -1))}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
          >
            ← Anterior
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">{formatWeekLabel(weekStart)}</p>
            {isCurrentWeek && (
              <span className="text-xs text-emerald-600 font-medium">Semana actual</span>
            )}
          </div>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
          >
            Siguiente →
          </button>
        </div>

        {/* Goals list */}
        <div className="rounded-[28px] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">
              Objetivos{" "}
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {goals.length}
              </span>
            </h2>
            <button
              onClick={() => setShowForm(v => !v)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
            >
              {showForm ? "Cancelar" : "+ Nuevo objetivo"}
            </button>
          </div>

          {/* New goal form */}
          {showForm && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-3">
              <input
                type="text"
                placeholder="Título del objetivo *"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as WeeklyGoalType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="task">Tarea</option>
                    <option value="sessions">Sesiones</option>
                    <option value="score">Nota</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    {formType === "task" ? "Valor objetivo (opcional)" : formType === "sessions" ? "Nº sesiones" : "Nota objetivo"}
                  </label>
                  <input
                    type="number"
                    placeholder={formType === "score" ? "ej: 7" : "ej: 5"}
                    value={formTarget}
                    onChange={e => setFormTarget(e.target.value)}
                    min={0}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Materia (opcional)</label>
                <select
                  value={formSubject}
                  onChange={e => setFormSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">— Sin materia —</option>
                  {SUBJECT_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                placeholder="Notas adicionales (opcional)"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              />
              <button
                onClick={handleCreate}
                disabled={saving || !formTitle.trim()}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
              >
                {saving ? "Guardando…" : "Crear objetivo"}
              </button>
            </div>
          )}

          {/* Goal cards */}
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Cargando…</p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-rose-500">{error}</p>
          ) : goals.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay objetivos para esta semana.<br />
              <span className="text-xs">Pulsa "+ Nuevo objetivo" para añadir uno.</span>
            </p>
          ) : (
            <ul className="space-y-3">
              {goals.map(goal => (
                <li key={goal.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    {/* Status toggle */}
                    <button
                      onClick={() => handleStatusChange(
                        goal,
                        goal.status === "done" ? "pending" : "done"
                      )}
                      className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 transition ${
                        goal.status === "done"
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-slate-300 bg-white hover:border-emerald-400"
                      }`}
                      title={goal.status === "done" ? "Marcar como pendiente" : "Marcar como completado"}
                    >
                      {goal.status === "done" && (
                        <svg className="mx-auto h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${goal.status === "done" ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {goal.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {/* Type badge */}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[goal.goalType]}`}>
                          {TYPE_LABELS[goal.goalType]}
                        </span>
                        {/* Status badge */}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[goal.status]}`}>
                          {STATUS_LABELS[goal.status]}
                        </span>
                        {/* Subject */}
                        {goal.subjectSlug && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            {SUBJECT_OPTIONS.find(s => s.value === goal.subjectSlug)?.label ?? goal.subjectSlug}
                          </span>
                        )}
                        {/* Progress */}
                        {goal.targetValue !== null && goal.targetValue > 0 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {goal.currentValue}/{goal.targetValue}
                          </span>
                        )}
                      </div>
                      {goal.notes && (
                        <p className="mt-1 text-xs text-slate-400 italic">{goal.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 gap-1">
                      {goal.status === "pending" && (
                        <button
                          onClick={() => handleStatusChange(goal, "in_progress")}
                          className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                          title="Marcar en curso"
                        >
                          En curso
                        </button>
                      )}
                      {goal.status === "in_progress" && (
                        <button
                          onClick={() => handleStatusChange(goal, "done")}
                          className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                          title="Marcar completado"
                        >
                          ✓ Hecho
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100 transition"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Summary */}
        {goals.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {(["pending", "in_progress", "done", "cancelled"] as WeeklyGoalStatus[]).map(s => {
              const count = goals.filter(g => g.status === s).length;
              return (
                <div key={s} className={`rounded-2xl p-3 text-center ${STATUS_COLORS[s]} bg-opacity-50`}>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs">{STATUS_LABELS[s]}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
