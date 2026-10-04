"use client";

/**
 * Mentoría — Componente de Progresión Visual
 * Muestra XP, nivel, racha y logros recientes del alumno.
 */

import React, { useEffect, useState, useCallback } from "react";
import type { StudentProgression, StudentAchievement } from "@/lib/mentoria/progression-system";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ProgressionData = {
  progression: StudentProgression;
  achievements?: StudentAchievement[];
};

type ProgressionBadgeProps = {
  /** Si true, se muestra en modo compacto (barra de nav / header) */
  compact?: boolean;
  /** Si true, carga también los logros desbloqueados */
  showAchievements?: boolean;
  /** Callback para refrescar externamente */
  onRefresh?: () => void;
  /** Clase CSS adicional */
  className?: string;
};

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<number, { bg: string; ring: string; text: string }> = {
  1:  { bg: "bg-slate-100",  ring: "ring-slate-300",  text: "text-slate-600" },
  2:  { bg: "bg-sky-100",    ring: "ring-sky-300",    text: "text-sky-700" },
  3:  { bg: "bg-blue-100",   ring: "ring-blue-400",   text: "text-blue-700" },
  4:  { bg: "bg-indigo-100", ring: "ring-indigo-400", text: "text-indigo-700" },
  5:  { bg: "bg-violet-100", ring: "ring-violet-400", text: "text-violet-700" },
  6:  { bg: "bg-purple-100", ring: "ring-purple-400", text: "text-purple-700" },
  7:  { bg: "bg-fuchsia-100",ring: "ring-fuchsia-400",text: "text-fuchsia-700" },
  8:  { bg: "bg-pink-100",   ring: "ring-pink-400",   text: "text-pink-700" },
  9:  { bg: "bg-rose-100",   ring: "ring-rose-500",   text: "text-rose-700" },
  10: { bg: "bg-amber-100",  ring: "ring-amber-400",  text: "text-amber-700" },
};

function getLevelColors(level: number) {
  return LEVEL_COLORS[Math.min(10, Math.max(1, level))] ?? LEVEL_COLORS[1];
}

function XpBar({ progress, className = "" }: { progress: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full rounded-full bg-gray-100 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

function StreakFlame({ days }: { days: number }) {
  if (days === 0) return null;
  const size = days >= 7 ? "text-lg" : "text-base";
  return (
    <span className={`${size} leading-none`} title={`${days} días seguidos`}>
      🔥
    </span>
  );
}

// ─── Variante compacta (para nav / header) ───────────────────────────────────

function CompactBadge({ data }: { data: ProgressionData }) {
  const { progression } = data;
  const colors = getLevelColors(progression.level);

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Nivel */}
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${colors.bg} ${colors.ring} ${colors.text}`}>
        <span>Nv.{progression.level}</span>
        <span className="hidden sm:inline opacity-75">{progression.levelName}</span>
      </div>

      {/* XP this week */}
      <div className="hidden md:flex items-center gap-1 text-xs text-gray-500">
        <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span>{progression.xpThisWeek} XP esta semana</span>
      </div>

      {/* Racha */}
      {progression.streakDays > 0 && (
        <div className="flex items-center gap-0.5 text-xs text-orange-500 font-medium">
          <StreakFlame days={progression.streakDays} />
          <span className="hidden sm:inline">{progression.streakDays}</span>
        </div>
      )}
    </div>
  );
}

// ─── Variante completa (panel de perfil / dashboard alumno) ──────────────────

function FullBadge({ data, onRefresh }: { data: ProgressionData; onRefresh?: () => void }) {
  const { progression, achievements } = data;
  const colors = getLevelColors(progression.level);

  const recentAchievements = (achievements ?? []).slice(0, 3);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header nivel */}
      <div className={`px-5 pt-5 pb-4 ${colors.bg}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${colors.text} opacity-70`}>
              Nivel {progression.level}
            </div>
            <div className={`text-xl font-bold ${colors.text}`}>
              {progression.levelName}
            </div>
          </div>

          {/* Racha */}
          {progression.streakDays > 0 && (
            <div className="flex flex-col items-center bg-white/70 rounded-xl px-3 py-2 ring-1 ring-white/50">
              <StreakFlame days={progression.streakDays} />
              <span className="text-sm font-bold text-orange-600 mt-0.5">
                {progression.streakDays}
              </span>
              <span className="text-xs text-gray-500">días</span>
            </div>
          )}
        </div>

        {/* Barra XP */}
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className={`font-medium ${colors.text}`}>{progression.xpTotal} XP</span>
            {progression.xpToNextLevel > 0 && (
              <span className="text-gray-500">
                Faltan {progression.xpToNextLevel} XP para nivel {progression.level + 1}
              </span>
            )}
          </div>
          <XpBar progress={progression.levelProgress} />
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-gray-50">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{progression.sessionsCompleted}</div>
          <div className="text-xs text-gray-400">sesiones</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{progression.xpThisWeek}</div>
          <div className="text-xs text-gray-400">XP esta semana</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{progression.streakBest}</div>
          <div className="text-xs text-gray-400">racha récord</div>
        </div>
      </div>

      {/* Logros recientes */}
      {recentAchievements.length > 0 && (
        <div className="px-5 py-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Logros recientes
          </div>
          <div className="space-y-2">
            {recentAchievements.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="text-xl leading-none">{a.achievementIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-700 truncate">
                    {a.achievementLabel}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {a.achievementDescription}
                  </div>
                </div>
                <div className="text-xs font-medium text-blue-500 shrink-0">
                  +{a.xpAwarded} XP
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {onRefresh && (
        <div className="px-5 pb-4">
          <button
            onClick={onRefresh}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Actualizar progresión
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ProgressionBadge({
  compact = false,
  showAchievements = false,
  onRefresh,
  className = "",
}: ProgressionBadgeProps) {
  const [data, setData] = useState<ProgressionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgression = useCallback(async () => {
    try {
      const params = showAchievements ? "?include=achievements" : "";
      const res = await fetch(`/api/mentoria/progression${params}`);
      if (!res.ok) return;
      const json = (await res.json()) as ProgressionData;
      setData(json);
    } catch {
      // silencioso — no bloquear la UI
    } finally {
      setLoading(false);
    }
  }, [showAchievements]);

  useEffect(() => {
    fetchProgression();
  }, [fetchProgression]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetchProgression();
    onRefresh?.();
  }, [fetchProgression, onRefresh]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        {compact ? (
          <div className="h-6 w-32 bg-gray-100 rounded-full" />
        ) : (
          <div className="h-40 w-full bg-gray-50 rounded-2xl" />
        )}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={className}>
      {compact ? (
        <CompactBadge data={data} />
      ) : (
        <FullBadge data={data} onRefresh={handleRefresh} />
      )}
    </div>
  );
}

// ─── Hook auxiliar para premiar XP desde cualquier componente ────────────────

export function useProgressionXp() {
  const awardXp = useCallback(
    async (
      reason: "session_complete" | "exam_prep_session" | "exam_simulation" | "weekly_goal",
      sessionId?: string,
    ) => {
      try {
        const res = await fetch("/api/mentoria/progression", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, sessionId }),
        });
        if (!res.ok) return null;
        return (await res.json()) as {
          progression: StudentProgression;
          newAchievements: StudentAchievement[];
        };
      } catch {
        return null;
      }
    },
    [],
  );

  return { awardXp };
}

export default ProgressionBadge;
