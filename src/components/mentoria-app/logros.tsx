"use client";

import { useEffect, useState } from "react";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";
import type { StudentProgression, StudentAchievement } from "@/lib/mentoria/progression-system";

type ProgressionResponse = {
  progression?: StudentProgression;
  achievements?: StudentAchievement[];
  error?: string;
};

function XpBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function MentoriaLogros() {
  const [loading, setLoading] = useState(true);
  const [progression, setProgression] = useState<StudentProgression | null>(null);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/mentoria/progression?include=achievements", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/logros";
        return;
      }
      if (res.status === 409) {
        window.location.href = "/mentoria/onboarding";
        return;
      }
      const body = (await res.json().catch(() => null)) as ProgressionResponse | null;
      if (!res.ok || !body?.progression) {
        setError(body?.error ?? "PROGRESSION_LOAD_FAILED");
        setLoading(false);
        return;
      }
      setProgression(body.progression);
      setAchievements(body.achievements ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <MentoriaAppSectionNav active="logros" />

        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-950">Mis logros</h1>
            <p className="mt-1 text-sm text-slate-500">Tu progresión, nivel y récords de constancia.</p>
          </div>

          {loading && (
            <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Cargando progresión…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {progression && (
            <>
              {/* Level + XP */}
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Nivel {progression.level}
                    </div>
                    <div className="mt-1 text-3xl font-bold text-slate-950">{progression.levelName}</div>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
                    🎓
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{progression.xpTotal.toLocaleString()} XP acumulados</span>
                    <span>{progression.xpToNextLevel} XP al siguiente nivel</span>
                  </div>
                  <XpBar
                    current={progression.xpTotal - (progression.xpTotal - (progression.levelProgress / 100) * progression.xpToNextLevel)}
                    total={progression.xpToNextLevel + (progression.xpTotal - (progression.levelProgress / 100) * progression.xpToNextLevel)}
                  />
                  <div className="mt-1 text-right text-xs text-emerald-600 font-medium">
                    {progression.levelProgress}% completado
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                  <div className="text-3xl font-bold text-slate-950">{progression.streakDays}</div>
                  <div className="mt-1 text-xs text-slate-500">🔥 Racha actual</div>
                  <div className="mt-0.5 text-xs text-slate-400">{progression.streakDays === 1 ? "día" : "días"}</div>
                </div>
                <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                  <div className="text-3xl font-bold text-slate-950">{progression.streakBest}</div>
                  <div className="mt-1 text-xs text-slate-500">🏅 Récord de racha</div>
                  <div className="mt-0.5 text-xs text-slate-400">{progression.streakBest === 1 ? "día" : "días"}</div>
                </div>
                <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                  <div className="text-3xl font-bold text-slate-950">{progression.sessionsCompleted}</div>
                  <div className="mt-1 text-xs text-slate-500">📚 Sesiones totales</div>
                </div>
                <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                  <div className="text-3xl font-bold text-slate-950">{progression.xpThisWeek}</div>
                  <div className="mt-1 text-xs text-slate-500">⚡ XP esta semana</div>
                </div>
              </div>

              {/* Achievements */}
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">Logros desbloqueados</h2>
                {achievements.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    Aún no hay logros desbloqueados. ¡Completa tu primera sesión!
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {achievements.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-4 rounded-2xl bg-slate-50 p-4"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                          {a.achievementIcon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-950 text-sm">{a.achievementLabel}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{a.achievementDescription}</div>
                          <div className="mt-1 text-xs font-medium text-emerald-600">+{a.xpAwarded} XP</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
