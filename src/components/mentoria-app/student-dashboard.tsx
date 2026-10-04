"use client";

/**
 * Mentoría — Dashboard del Alumno
 *
 * Filosofía: muestra CONCEPTOS DOMINADOS, no notas.
 * El foco está en lo que el alumno YA sabe y en el próximo paso concreto,
 * no en calificaciones o comparativas con otros.
 */

import React, { useEffect, useState } from "react";
import type { MentoriaProgress, StudentProfile } from "@/lib/mentoria/types";
import type { StudentProgression } from "@/lib/mentoria/progression-system";
import { ProgressionBadge } from "@/components/mentoria-app/progression-badge";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TodaySession = {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  topic: string;
  durationMinutes: number;
};

type DashboardData = {
  student: StudentProfile | null;
  progress: MentoriaProgress[];
  todaySessions: TodaySession[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function masteryLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 0.8) return { label: "Dominado",     color: "text-emerald-700", bg: "bg-emerald-50 ring-emerald-200" };
  if (score >= 0.55) return { label: "En progreso", color: "text-blue-700",    bg: "bg-blue-50 ring-blue-200" };
  if (score >= 0.3)  return { label: "Aprendiendo", color: "text-amber-700",   bg: "bg-amber-50 ring-amber-200" };
  return               { label: "Por trabajar",   color: "text-gray-500",    bg: "bg-gray-50 ring-gray-200" };
}

function MasteryRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = score >= 0.8 ? "#10b981" : score >= 0.55 ? "#3b82f6" : score >= 0.3 ? "#f59e0b" : "#d1d5db";

  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

// ─── Tarjeta por asignatura ───────────────────────────────────────────────────

function SubjectCard({ p, onStart }: { p: MentoriaProgress; onStart: (subjectId: string, slug: string) => void }) {
  const subject = p.subject;
  const name = subject?.name ?? p.subjectId;
  const slug = subject?.slug ?? p.subjectId;
  const { label, color, bg } = masteryLabel(p.masteryScore);
  const strongCount = p.strongTopics?.length ?? 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 items-start hover:shadow-sm transition-shadow">
      <MasteryRing score={p.masteryScore} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-800 text-sm truncate">{name}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ring-1 shrink-0 ${bg} ${color}`}>
            {label}
          </span>
        </div>

        {/* Conceptos dominados */}
        {strongCount > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-400 mb-1.5">
              {strongCount} {strongCount === 1 ? "concepto dominado" : "conceptos dominados"}
            </p>
            <div className="flex flex-wrap gap-1">
              {p.strongTopics.slice(0, 4).map((t) => (
                <span key={t} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full ring-1 ring-emerald-100">
                  ✓ {t}
                </span>
              ))}
              {p.strongTopics.length > 4 && (
                <span className="text-xs text-gray-400 px-1">+{p.strongTopics.length - 4} más</span>
              )}
            </div>
          </div>
        )}

        {/* Siguiente paso */}
        {p.weakTopics?.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Siguiente:</span>
            <span className="text-xs font-medium text-blue-600 truncate">{p.weakTopics[0]}</span>
          </div>
        )}
      </div>

      <button
        onClick={() => onStart(p.subjectId, slug)}
        className="shrink-0 self-center text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 px-3 py-1.5 rounded-xl transition-colors"
      >
        Estudiar
      </button>
    </div>
  );
}

// ─── Sesión de hoy ────────────────────────────────────────────────────────────

function TodayCard({ session, onStart }: { session: TodaySession; onStart: (slug: string) => void }) {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-4 text-white">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">Sesión de hoy</p>
      <h3 className="font-bold text-base mb-0.5">{session.subjectName}</h3>
      <p className="text-sm opacity-90 mb-3">{session.topic}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-75">{session.durationMinutes} min recomendados</span>
        <button
          onClick={() => onStart(session.subjectSlug)}
          className="text-xs font-bold bg-white text-blue-600 px-4 py-1.5 rounded-xl hover:bg-blue-50 transition-colors"
        >
          Empezar →
        </button>
      </div>
    </div>
  );
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3">📚</div>
      <h3 className="font-semibold text-gray-700 mb-1">Todavía no hay materias</h3>
      <p className="text-sm text-gray-400 mb-4">
        Cuando tu tutor trabaje contigo en una materia, aparecerá aquí tu progreso.
      </p>
      <button
        onClick={onStart}
        className="text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 px-5 py-2 rounded-xl transition-colors"
      >
        Empezar primera sesión
      </button>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type StudentDashboardProps = {
  studentId?: string;
  onStartSession?: (subjectSlug: string) => void;
};

export function StudentDashboard({ studentId, onStartSession }: StudentDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const params = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
        const [progressRes] = await Promise.all([
          fetch(`/api/mentoria/progress${params}`, { cache: "no-store" }),
        ]);

        if (!progressRes.ok) throw new Error("fetch_failed");

        const progressJson = (await progressRes.json()) as {
          progress?: MentoriaProgress[];
          student?: StudentProfile | null;
        };

        setData({
          student: progressJson.student ?? null,
          progress: progressJson.progress ?? [],
          todaySessions: [],
        });
      } catch {
        setData({ student: null, progress: [], todaySessions: [] });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentId]);

  const handleStartSession = (subjectSlug: string) => {
    onStartSession?.(subjectSlug);
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 bg-gray-100 rounded-2xl" />
        <div className="h-20 bg-gray-100 rounded-2xl" />
        <div className="h-20 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const { progress, todaySessions } = data;
  const sortedProgress = [...progress].sort((a, b) => b.masteryScore - a.masteryScore);
  const todaySession = todaySessions[0] ?? null;

  // Calcular totales de conceptos
  const totalMastered = progress.reduce((acc, p) => acc + (p.strongTopics?.length ?? 0), 0);
  const subjectsInProgress = progress.filter((p) => p.masteryScore > 0).length;

  return (
    <div className="space-y-4">
      {/* Progresión XP */}
      <ProgressionBadge compact className="mb-2" />

      {/* Resumen de conceptos dominados */}
      {totalMastered > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 rounded-2xl p-4 text-center ring-1 ring-emerald-100">
            <div className="text-2xl font-bold text-emerald-700">{totalMastered}</div>
            <div className="text-xs text-emerald-600 mt-0.5">
              {totalMastered === 1 ? "concepto dominado" : "conceptos dominados"}
            </div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 text-center ring-1 ring-blue-100">
            <div className="text-2xl font-bold text-blue-700">{subjectsInProgress}</div>
            <div className="text-xs text-blue-600 mt-0.5">
              {subjectsInProgress === 1 ? "materia activa" : "materias activas"}
            </div>
          </div>
        </div>
      )}

      {/* Sesión de hoy (si hay plan) */}
      {todaySession && (
        <TodayCard
          session={todaySession}
          onStart={handleStartSession}
        />
      )}

      {/* Materias */}
      {sortedProgress.length === 0 ? (
        <EmptyState onStart={() => handleStartSession("")} />
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
            Tus materias
          </h2>
          {sortedProgress.map((p) => (
            <SubjectCard
              key={p.subjectId}
              p={p}
              onStart={(_, slug) => handleStartSession(slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;
