"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { StudyPlan, StudyPlanBlock } from "@/lib/mentoria/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MentorStudentPlan() {
  const params = useSearchParams();
  const studentId = params.get("studentId") ?? "";

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/mentoria/planner?studentId=${encodeURIComponent(studentId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { plan?: StudyPlan | null };
      setPlan(data.plan ?? null);
    } catch {
      setError("No se pudo cargar el plan de estudio.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/mentoria/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Error");
      }
      const data = await res.json() as { plan?: StudyPlan };
      setPlan(data.plan ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al generar el plan.";
      setError(msg === "BILLING_LIMIT_REACHED" ? "Límite de generaciones alcanzado para hoy." : msg);
    } finally {
      setGenerating(false);
    }
  }

  // Group blocks by day
  const byDay: Record<string, StudyPlanBlock[]> = {};
  if (plan) {
    for (const block of plan.blocks) {
      const key = block.day.toLowerCase();
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(block);
    }
  }

  const orderedDays = DAY_ORDER.filter(d => byDay[d]?.length);
  const totalMinutes = plan?.blocks.reduce((sum, b) => sum + b.durationMinutes, 0) ?? 0;

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
          <h1 className="text-xl font-semibold text-slate-800">📚 Plan de estudio</h1>
        </div>

        {loading ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-slate-400">Cargando plan…</p>
          </div>
        ) : error ? (
          <div className="rounded-[28px] bg-rose-50 p-6 text-center shadow-sm">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : !plan ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-sm space-y-4">
            <p className="text-3xl">📋</p>
            <p className="text-sm font-medium text-slate-700">No hay plan de estudio generado todavía.</p>
            <p className="text-xs text-slate-400">Genera uno con IA basado en el progreso del alumno.</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
            >
              {generating ? "⏳ Generando plan…" : "✨ Generar plan con IA"}
            </button>
          </div>
        ) : (
          <>
            {/* Plan header */}
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Semana del plan</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDate(plan.weekStart)} — {formatDate(plan.weekEnd)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 italic">{plan.goalsSummary}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-emerald-600">{formatDuration(totalMinutes)}</p>
                  <p className="text-xs text-slate-400">total semanal</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {plan.blocks.length} bloques · Generado por {plan.generatedBy === "ai" ? "IA" : plan.generatedBy}
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition"
                >
                  {generating ? "Generando…" : "↻ Regenerar"}
                </button>
              </div>
            </div>

            {/* Days */}
            {orderedDays.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">El plan no tiene bloques asignados.</p>
            ) : (
              <div className="space-y-3">
                {orderedDays.map(day => (
                  <div key={day} className="rounded-2xl bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">{DAY_LABELS[day] ?? day}</p>
                      <p className="text-xs text-slate-400">
                        {formatDuration(byDay[day].reduce((s, b) => s + b.durationMinutes, 0))}
                      </p>
                    </div>
                    <ul className="divide-y divide-slate-50">
                      {byDay[day].map(block => (
                        <li key={block.id} className="px-5 py-3">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${block.focusMode ? "bg-violet-400" : "bg-emerald-400"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{block.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{block.goal}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-xs font-semibold text-slate-600">{formatDuration(block.durationMinutes)}</p>
                              {block.focusMode && (
                                <p className="text-xs text-violet-500">🎯 Foco</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
