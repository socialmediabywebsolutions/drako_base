"use client";

/**
 * Mentoría — Resumen Semanal para Padres
 *
 * Principio de diseño: el padre acompaña, no supervisa.
 * Máximo UNA alerta por semana, con UNA recomendación concreta de qué hacer.
 * Semáforo por materia — verde/amarillo/rojo — sin notas numéricas.
 */

import React, { useEffect, useState } from "react";
import type { MentoriaProgress, StudentProfile } from "@/lib/mentoria/types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type WeeklyAlert = {
  type: "attention" | "celebrate" | "streak_at_risk";
  subject?: string;
  message: string;
  action: string; // qué puede hacer el padre
};

type WeeklySummaryData = {
  student: StudentProfile | null;
  progress: MentoriaProgress[];
  weekSessions: number;
  weekMinutes: number;
  streakDays: number;
  alert: WeeklyAlert | null;
};

// ─── Semáforo ─────────────────────────────────────────────────────────────────

type TrafficLight = "green" | "yellow" | "red";

function getTrafficLight(p: MentoriaProgress): TrafficLight {
  if (p.masteryScore >= 0.65) return "green";
  if (p.masteryScore >= 0.35) return "yellow";
  return "red";
}

const TRAFFIC_STYLES: Record<TrafficLight, { dot: string; bg: string; label: string; desc: string }> = {
  green:  { dot: "bg-emerald-500", bg: "bg-emerald-50 ring-emerald-200",  label: "Bien",       desc: "Va bien en esta materia" },
  yellow: { dot: "bg-amber-400",   bg: "bg-amber-50 ring-amber-200",      label: "Atención",   desc: "Necesita refuerzo" },
  red:    { dot: "bg-red-500",     bg: "bg-red-50 ring-red-200",          label: "Prioridad",  desc: "Requiere atención esta semana" },
};

function TrafficDot({ light }: { light: TrafficLight }) {
  const s = TRAFFIC_STYLES[light];
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot} shrink-0`} />
  );
}

// ─── Tarjeta de alerta ────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: WeeklyAlert }) {
  const isPositive = alert.type === "celebrate";
  return (
    <div className={`rounded-2xl p-4 ring-1 ${isPositive ? "bg-emerald-50 ring-emerald-200" : "bg-amber-50 ring-amber-200"}`}>
      <div className="flex gap-3">
        <span className="text-xl shrink-0">{isPositive ? "🎉" : alert.type === "streak_at_risk" ? "⚡" : "💡"}</span>
        <div>
          <p className={`text-sm font-semibold mb-0.5 ${isPositive ? "text-emerald-800" : "text-amber-800"}`}>
            {alert.message}
          </p>
          <p className={`text-xs ${isPositive ? "text-emerald-600" : "text-amber-700"}`}>
            Qué puedes hacer: <span className="font-medium">{alert.action}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de materia con semáforo ─────────────────────────────────────────────

function SubjectRow({ p }: { p: MentoriaProgress }) {
  const light = getTrafficLight(p);
  const s = TRAFFIC_STYLES[light];
  const name = p.subject?.name ?? p.subjectId;
  const sessions = p.sessionsCompleted ?? 0;
  const strongCount = p.strongTopics?.length ?? 0;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ring-1 ${s.bg}`}>
      <TrafficDot light={light} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 truncate">{name}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${s.bg}`}>
            {s.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {strongCount > 0
            ? `${strongCount} ${strongCount === 1 ? "concepto dominado" : "conceptos dominados"}`
            : "Empezando"}{" "}
          · {sessions} {sessions === 1 ? "sesión" : "sesiones"}
        </p>
      </div>
      {/* Tema más débil como contexto, no como alarma */}
      {p.weakTopics?.[0] && (
        <span className="text-xs text-gray-400 shrink-0 hidden sm:block max-w-[100px] truncate">
          Trabaja: {p.weakTopics[0]}
        </span>
      )}
    </div>
  );
}

// ─── Stats de la semana ───────────────────────────────────────────────────────

function WeekStats({ sessions, minutes, streak }: { sessions: number; minutes: number; streak: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="text-center bg-white rounded-xl ring-1 ring-gray-100 py-3">
        <div className="text-xl font-bold text-gray-800">{sessions}</div>
        <div className="text-xs text-gray-400 mt-0.5">{sessions === 1 ? "sesión" : "sesiones"}</div>
      </div>
      <div className="text-center bg-white rounded-xl ring-1 ring-gray-100 py-3">
        <div className="text-xl font-bold text-gray-800">{minutes}</div>
        <div className="text-xs text-gray-400 mt-0.5">minutos</div>
      </div>
      <div className="text-center bg-white rounded-xl ring-1 ring-gray-100 py-3">
        <div className="text-xl font-bold text-gray-800">{streak}</div>
        <div className="text-xs text-gray-400 mt-0.5">{streak === 1 ? "día seguido" : "días seguidos"}</div>
      </div>
    </div>
  );
}

// ─── Helpers para generar la alerta de la semana ─────────────────────────────

function buildWeeklyAlert(progress: MentoriaProgress[], streak: number): WeeklyAlert | null {
  // Una sola alerta por semana — prioridad: celebrar primero, luego atención
  const dominatedSubject = progress.find((p) => p.masteryScore >= 0.8 && (p.strongTopics?.length ?? 0) >= 3);
  if (dominatedSubject) {
    return {
      type: "celebrate",
      subject: dominatedSubject.subject?.name ?? dominatedSubject.subjectId,
      message: `Tu hijo está dominando ${dominatedSubject.subject?.name ?? "una materia"}`,
      action: "Reconócele el esfuerzo esta semana. Eso mantiene la motivación.",
    };
  }

  if (streak === 0) {
    return {
      type: "streak_at_risk",
      message: "Esta semana no hubo ninguna sesión de estudio",
      action: "Dedica 15 minutos esta noche a estudiar juntos aunque sea brevemente.",
    };
  }

  const redSubject = progress.find((p) => p.masteryScore < 0.35 && (p.weakTopics?.length ?? 0) > 0);
  if (redSubject) {
    return {
      type: "attention",
      subject: redSubject.subject?.name ?? redSubject.subjectId,
      message: `${redSubject.subject?.name ?? "Una materia"} necesita más atención esta semana`,
      action: `Pregúntale cómo lleva "${redSubject.weakTopics?.[0] ?? "los temas pendientes"}". Escúchale sin juzgar.`,
    };
  }

  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────

type ParentWeeklySummaryProps = {
  studentId?: string;
  className?: string;
};

export function ParentWeeklySummary({ studentId, className = "" }: ParentWeeklySummaryProps) {
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const params = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
        const [progressRes, progressionRes] = await Promise.all([
          fetch(`/api/mentoria/progress${params}`, { cache: "no-store" }),
          fetch("/api/mentoria/progression?include=achievements", { cache: "no-store" }),
        ]);

        const progressJson = progressRes.ok
          ? ((await progressRes.json()) as { progress?: MentoriaProgress[]; student?: StudentProfile | null })
          : { progress: [], student: null };

        const progressionJson = progressionRes.ok
          ? ((await progressionRes.json()) as { progression?: { streakDays: number; sessionsThisWeek: number; xpThisWeek: number } })
          : { progression: null };

        const progress = progressJson.progress ?? [];
        const streakDays = progressionJson.progression?.streakDays ?? 0;
        const weekSessions = progressionJson.progression?.sessionsThisWeek ?? 0;

        setData({
          student: progressJson.student ?? null,
          progress,
          weekSessions,
          weekMinutes: weekSessions * 25, // estimado: ~25 min por sesión
          streakDays,
          alert: buildWeeklyAlert(progress, streakDays),
        });
      } catch {
        setData({ student: null, progress: [], weekSessions: 0, weekMinutes: 0, streakDays: 0, alert: null });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentId]);

  if (loading) {
    return (
      <div className={`space-y-3 animate-pulse ${className}`}>
        <div className="h-16 bg-gray-100 rounded-2xl" />
        <div className="h-12 bg-gray-100 rounded-2xl" />
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="h-12 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const { progress, weekSessions, weekMinutes, streakDays, alert } = data;

  // Ordenar: rojo primero, luego amarillo, luego verde
  const sortedProgress = [...progress].sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 };
    return order[getTrafficLight(a)] - order[getTrafficLight(b)];
  });

  const hasAnyActivity = weekSessions > 0 || progress.length > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Alerta de la semana — máximo una */}
      {alert && <AlertCard alert={alert} />}

      {/* Stats de la semana */}
      {hasAnyActivity && (
        <>
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
              Esta semana
            </h2>
            <WeekStats sessions={weekSessions} minutes={weekMinutes} streak={streakDays} />
          </div>

          {/* Semáforo por materia */}
          {sortedProgress.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                Estado por materia
              </h2>
              <div className="space-y-2">
                {sortedProgress.map((p) => (
                  <SubjectRow key={p.subjectId} p={p} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!hasAnyActivity && (
        <div className="text-center py-10 px-4">
          <div className="text-3xl mb-2">📅</div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Sin actividad todavía</p>
          <p className="text-xs text-gray-400">
            Cuando tu hijo empiece a estudiar, aquí verás su progreso semana a semana.
          </p>
        </div>
      )}

      {/* Nota aclaratoria */}
      <p className="text-xs text-gray-300 text-center pt-1">
        Los indicadores muestran el progreso de aprendizaje, no calificaciones escolares.
      </p>
    </div>
  );
}

export default ParentWeeklySummary;
