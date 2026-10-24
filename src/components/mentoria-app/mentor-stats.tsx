"use client";

import { useEffect, useState } from "react";
import type { MentorStats, SubjectStat } from "@/app/api/mentoria/mentor-stats/route";

function StatCard({ value, label, color = "slate" }: { value: string | number; label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    slate: "text-slate-950",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
  };
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
      <div className={`text-2xl font-bold ${colorMap[color] ?? colorMap.slate}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1 leading-tight">{label}</div>
    </div>
  );
}

function SubjectBar({ subject, max }: { subject: SubjectStat; max: number }) {
  const pct = max > 0 ? Math.round((subject.sessionCount / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-sm text-slate-700 truncate">{subject.subjectName}</div>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 shrink-0 text-xs text-slate-500 text-right">{subject.sessionCount}</div>
    </div>
  );
}

export function MentorStatsPanel() {
  const [stats, setStats] = useState<MentorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/mentoria/mentor-stats", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel/stats"; return; }
      if (res.status === 403) { setError("Acceso restringido."); setLoading(false); return; }
      const body = await res.json().catch(() => null) as { stats?: MentorStats } | null;
      if (!body?.stats) { setError("Error al cargar las estadísticas."); setLoading(false); return; }
      setStats(body.stats);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Estadísticas del tenant</h1>
          <p className="mt-1 text-sm text-slate-500">Visión global de actividad y rendimiento de todos los alumnos.</p>
        </div>

        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Calculando estadísticas…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {stats && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard value={stats.totalStudents} label="Alumnos totales" />
              <StatCard value={stats.totalSessions} label="Sesiones completadas" color="emerald" />
              <StatCard value={stats.avgSessionsPerStudent} label="Sesiones / alumno" color="blue" />
              <StatCard value={stats.studentsActiveThisWeek} label="Activos esta semana" color="emerald" />
              <StatCard value={stats.studentsInactiveOver7d} label="Inactivos +7 días" color="rose" />
              <StatCard value={stats.studentsWithStreak} label="Con racha activa" color="amber" />
            </div>

            {/* Streak distribution */}
            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-950 mb-4">Distribución de racha 🔥</h2>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { label: "Sin racha", value: stats.streakDistribution.none, color: "bg-slate-100 text-slate-600" },
                  { label: "1–3 días", value: stats.streakDistribution.low, color: "bg-amber-100 text-amber-700" },
                  { label: "4–7 días", value: stats.streakDistribution.medium, color: "bg-emerald-100 text-emerald-700" },
                  { label: "8+ días", value: stats.streakDistribution.high, color: "bg-emerald-200 text-emerald-800" },
                ].map((b) => (
                  <div key={b.label} className={`rounded-2xl px-3 py-4 ${b.color}`}>
                    <div className="text-2xl font-bold">{b.value}</div>
                    <div className="text-xs mt-1">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top subjects */}
            {stats.topSubjects.length > 0 && (
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-slate-950 mb-4">Materias más estudiadas 📚</h2>
                <div className="space-y-3">
                  {stats.topSubjects.map((s) => (
                    <SubjectBar
                      key={s.subjectName}
                      subject={s}
                      max={stats.topSubjects[0]?.sessionCount ?? 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
