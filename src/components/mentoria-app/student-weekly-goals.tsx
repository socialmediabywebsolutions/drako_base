"use client";

import { useEffect, useState, useCallback } from "react";
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
  done: "¡Completado!",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<WeeklyGoalStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-600",
};

const STATUS_ICON: Record<WeeklyGoalStatus, string> = {
  pending: "⏳",
  in_progress: "🔥",
  done: "✅",
  cancelled: "❌",
};

const TYPE_LABELS: Record<WeeklyGoalType, string> = {
  task: "Tarea",
  sessions: "Sesiones",
  score: "Nota",
};

const TYPE_ICON: Record<WeeklyGoalType, string> = {
  task: "📋",
  sessions: "📅",
  score: "🎓",
};

const SUBJECT_LABELS: Record<string, string> = {
  matematicas: "Matemáticas", fisica: "Física", quimica: "Química",
  biologia: "Biología", lengua: "Lengua", historia: "Historia",
  ingles: "Inglés", frances: "Francés", filosofia: "Filosofía",
  programacion: "Programación", economia: "Economía", geografia: "Geografía",
  arte: "Arte", musica: "Música", educacion_fisica: "Ed. Física",
  tecnologia: "Tecnología",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function StudentWeeklyGoals() {
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()));
  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);

  // Load the student's own profile to get studentProfileId
  useEffect(() => {
    fetch("/api/mentoria/profile")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: unknown) => {
        const d = data as { profile?: { id?: string } };
        if (d?.profile?.id) setStudentId(d.profile.id);
      })
      .catch(() => setError("No se pudo cargar tu perfil."));
  }, []);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/mentoria/weekly-goals?studentId=${encodeURIComponent(studentId)}&weekStart=${weekStart}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json() as { goals: WeeklyGoal[] };
      setGoals(data.goals ?? []);
    } catch {
      setError("No se pudieron cargar los objetivos.");
    } finally {
      setLoading(false);
    }
  }, [studentId, weekStart]);

  useEffect(() => { void load(); }, [load]);

  async function toggleStatus(goal: WeeklyGoal) {
    const next: WeeklyGoalStatus =
      goal.status === "done"
        ? "in_progress"
        : goal.status === "in_progress"
        ? "done"
        : "in_progress";
    try {
      await fetch("/api/mentoria/weekly-goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal.id, status: next }),
      });
      await load();
    } catch {
      alert("Error al actualizar el objetivo.");
    }
  }

  const isCurrentWeek = weekStart === mondayOfWeek(new Date());
  const done = goals.filter(g => g.status === "done").length;
  const total = goals.filter(g => g.status !== "cancelled").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-lg space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/mentoria/app"
            className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
          >
            ← Inicio
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">🎯 Mis objetivos</h1>
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
              <span className="text-xs text-emerald-600 font-medium">Esta semana</span>
            )}
          </div>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
          >
            Siguiente →
          </button>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Progreso semanal</p>
              <p className="text-sm font-bold text-emerald-600">{done}/{total} completados</p>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-400">{pct}%</p>
          </div>
        )}

        {/* Goals */}
        <div className="rounded-[28px] bg-white p-5 shadow-sm space-y-3">
          {!studentId || loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Cargando objetivos…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-rose-500">{error}</p>
          ) : goals.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm text-slate-500">No hay objetivos para esta semana.</p>
              <p className="text-xs text-slate-400 mt-1">Tu mentor los irá añadiendo pronto.</p>
            </div>
          ) : (
            goals.map(goal => {
              const isCancelled = goal.status === "cancelled";
              return (
                <div
                  key={goal.id}
                  className={`rounded-2xl border p-4 transition ${
                    goal.status === "done"
                      ? "border-emerald-100 bg-emerald-50"
                      : isCancelled
                      ? "border-slate-100 bg-slate-50 opacity-60"
                      : "border-slate-100 bg-slate-50 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Check button */}
                    {!isCancelled && (
                      <button
                        onClick={() => toggleStatus(goal)}
                        className={`mt-0.5 h-6 w-6 flex-shrink-0 rounded-full border-2 transition flex items-center justify-center ${
                          goal.status === "done"
                            ? "border-emerald-500 bg-emerald-500"
                            : goal.status === "in_progress"
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-300 bg-white hover:border-emerald-400"
                        }`}
                        title="Cambiar estado"
                      >
                        {goal.status === "done" && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {goal.status === "in_progress" && (
                          <span className="text-amber-500 text-xs">●</span>
                        )}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${goal.status === "done" ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {TYPE_ICON[goal.goalType]} {goal.title}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[goal.status]}`}>
                          {STATUS_ICON[goal.status]} {STATUS_LABELS[goal.status]}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {TYPE_LABELS[goal.goalType]}
                        </span>
                        {goal.subjectSlug && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                            {SUBJECT_LABELS[goal.subjectSlug] ?? goal.subjectSlug}
                          </span>
                        )}
                        {goal.targetValue !== null && goal.targetValue > 0 && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                            {goal.currentValue}/{goal.targetValue}
                          </span>
                        )}
                      </div>

                      {goal.notes && (
                        <p className="mt-1.5 text-xs text-slate-400 italic">💬 {goal.notes}</p>
                      )}

                      {/* In-progress action prompt */}
                      {goal.status === "pending" && !isCancelled && (
                        <button
                          onClick={() => toggleStatus(goal)}
                          className="mt-2 rounded-lg bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                        >
                          🔥 Empezar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Motivational footer */}
        {total > 0 && pct === 100 && (
          <div className="rounded-[28px] bg-emerald-500 p-5 text-center text-white shadow-sm">
            <p className="text-2xl mb-1">🏆</p>
            <p className="font-bold">¡Semana completada al 100%!</p>
            <p className="text-sm text-emerald-100 mt-1">Excelente trabajo esta semana.</p>
          </div>
        )}
        {total > 0 && pct > 0 && pct < 100 && isCurrentWeek && (
          <div className="rounded-[28px] bg-amber-50 border border-amber-100 p-4 text-center">
            <p className="text-sm font-medium text-amber-700">
              🎯 {total - done} objetivo{total - done !== 1 ? "s" : ""} restante{total - done !== 1 ? "s" : ""} esta semana
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
