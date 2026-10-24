"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { StudentProgression, StudentAchievement } from "@/lib/mentoria/progression-system";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function levelColor(level: number): string {
  if (level >= 8) return "text-amber-600";
  if (level >= 5) return "text-violet-600";
  if (level >= 3) return "text-emerald-600";
  return "text-slate-600";
}

function levelBg(level: number): string {
  if (level >= 8) return "bg-amber-50 border-amber-100";
  if (level >= 5) return "bg-violet-50 border-violet-100";
  if (level >= 3) return "bg-emerald-50 border-emerald-100";
  return "bg-slate-50 border-slate-200";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MentorStudentAchievements() {
  const params = useSearchParams();
  const studentId = params.get("studentId") ?? "";

  const [progression, setProgression] = useState<StudentProgression | null>(null);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/mentoria/mentor-progression?studentId=${encodeURIComponent(studentId)}&include=achievements`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json() as {
        progression?: StudentProgression | null;
        achievements?: StudentAchievement[];
      };
      setProgression(data.progression ?? null);
      setAchievements(data.achievements ?? []);
    } catch {
      setError("No se pudo cargar la progresión del alumno.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

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
          <h1 className="text-xl font-semibold text-slate-800">🏆 Logros y progresión</h1>
        </div>

        {loading ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-slate-400">Cargando progresión…</p>
          </div>
        ) : error ? (
          <div className="rounded-[28px] bg-rose-50 p-6 text-center shadow-sm">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : !progression ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-sm space-y-2">
            <p className="text-3xl">📊</p>
            <p className="text-sm font-medium text-slate-700">El alumno no tiene actividad registrada todavía.</p>
            <p className="text-xs text-slate-400">La progresión se generará cuando complete la primera sesión.</p>
          </div>
        ) : (
          <>
            {/* Nivel y XP */}
            <div className={`rounded-[28px] border p-5 shadow-sm ${levelBg(progression.level)}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Nivel actual</p>
                  <p className={`text-2xl font-bold ${levelColor(progression.level)}`}>
                    Nv. {progression.level} · {progression.levelName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-800">{progression.xpTotal.toLocaleString("es-ES")}</p>
                  <p className="text-xs text-slate-400">XP total</p>
                </div>
              </div>

              {/* Barra de progreso */}
              {progression.xpToNextLevel > 0 && (
                <div className="space-y-1.5">
                  <div className="h-2.5 w-full rounded-full bg-white/60">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        progression.level >= 8
                          ? "bg-amber-400"
                          : progression.level >= 5
                          ? "bg-violet-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${progression.levelProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-right">
                    Faltan {progression.xpToNextLevel} XP para el siguiente nivel
                  </p>
                </div>
              )}
              {progression.xpToNextLevel === 0 && (
                <p className="text-xs text-amber-600 font-semibold">⭐ Nivel máximo alcanzado</p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-orange-500">🔥 {progression.streakDays}</p>
                <p className="text-xs text-slate-500 mt-0.5">Racha actual</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-slate-700">{progression.streakBest}</p>
                <p className="text-xs text-slate-500 mt-0.5">Mejor racha</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-emerald-600">{progression.sessionsCompleted}</p>
                <p className="text-xs text-slate-500 mt-0.5">Sesiones</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-indigo-600">{progression.examsCompleted}</p>
                <p className="text-xs text-slate-500 mt-0.5">Exámenes</p>
              </div>
            </div>

            {/* Esta semana */}
            <div className="rounded-2xl bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Esta semana</p>
                <p className="text-lg font-bold text-slate-800">
                  +{progression.xpThisWeek} XP · {progression.sessionsThisWeek} sesiones
                </p>
              </div>
              {progression.lastActivityDate && (
                <div className="text-right">
                  <p className="text-xs text-slate-400">Última actividad</p>
                  <p className="text-sm font-medium text-slate-700">{formatDate(progression.lastActivityDate)}</p>
                </div>
              )}
            </div>

            {/* Logros */}
            <div className="rounded-[28px] bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-700">Logros desbloqueados</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {achievements.length} logros
                </span>
              </div>

              {achievements.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-3xl mb-2">🎯</p>
                  <p className="text-sm text-slate-400">El alumno aún no ha desbloqueado ningún logro.</p>
                  <p className="text-xs text-slate-300 mt-1">Los logros se obtienen al completar sesiones y mantener rachas.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {achievements.map((ach) => (
                    <li key={ach.id} className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                      <span className="text-2xl leading-none flex-shrink-0">{ach.achievementIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800">{ach.achievementLabel}</p>
                        <p className="text-xs text-amber-700/70">{ach.achievementDescription}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs font-bold text-amber-600">+{ach.xpAwarded} XP</p>
                        <p className="text-xs text-amber-500">{formatDate(ach.unlockedAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
