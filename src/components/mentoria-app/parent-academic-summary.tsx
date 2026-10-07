"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";
import type { ParentDashboardData } from "@/app/api/mentoria/parent-dashboard/route";

const MOOD_EMOJI: Record<string, string> = {
  animado: "😊",
  neutro: "😐",
  desanimado: "😔",
  bloqueado: "😤",
};

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-500",
  absent: "bg-rose-500",
  absent_justified: "bg-amber-400",
  late: "bg-blue-400",
};

function AttendanceBar({ attendance }: { attendance: ParentDashboardData["attendance"] }) {
  if (attendance.totalDays === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
        Sin registros de asistencia aún.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex h-8 w-full overflow-hidden rounded-full">
        {attendance.presentDays > 0 && (
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${(attendance.presentDays / attendance.totalDays) * 100}%` }}
            title={`Presentes: ${attendance.presentDays}`}
          />
        )}
        {attendance.lateDays > 0 && (
          <div
            className="bg-blue-400 transition-all"
            style={{ width: `${(attendance.lateDays / attendance.totalDays) * 100}%` }}
            title={`Tardanzas: ${attendance.lateDays}`}
          />
        )}
        {(attendance.absentDays - attendance.absentJustifiedDays) > 0 && (
          <div
            className="bg-rose-500 transition-all"
            style={{ width: `${((attendance.absentDays - attendance.absentJustifiedDays) / attendance.totalDays) * 100}%` }}
            title={`Ausencias: ${attendance.absentDays - attendance.absentJustifiedDays}`}
          />
        )}
        {attendance.absentJustifiedDays > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${(attendance.absentJustifiedDays / attendance.totalDays) * 100}%` }}
            title={`Ausencias justificadas: ${attendance.absentJustifiedDays}`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Presente {attendance.presentDays}</span>
        {attendance.lateDays > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400" />Tarde {attendance.lateDays}</span>}
        {attendance.absentJustifiedDays > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Justificada {attendance.absentJustifiedDays}</span>}
        {(attendance.absentDays - attendance.absentJustifiedDays) > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />Ausente {attendance.absentDays - attendance.absentJustifiedDays}</span>}
      </div>
      {attendance.recentAbsences.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-semibold text-slate-500">Ausencias recientes</div>
          {attendance.recentAbsences.slice(0, 5).map((a, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-slate-600">
              <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[a.status] ?? "bg-slate-300"}`} />
              <span>{a.date}</span>
              <span className="text-slate-400">{a.status}</span>
              {a.notes && <span className="text-slate-400 truncate">{a.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ParentAcademicSummary() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const url = studentId
        ? `/api/mentoria/parent-dashboard?studentId=${encodeURIComponent(studentId)}`
        : "/api/mentoria/parent-dashboard";
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/resumen-academico"; return; }
      if (res.status === 409) { window.location.href = "/mentoria/onboarding"; return; }
      const body = await res.json().catch(() => null) as { ok: boolean; dashboard?: ParentDashboardData; error?: string } | null;
      if (!body?.ok || !body.dashboard) {
        setError(body?.error ?? "PARENT_DASHBOARD_LOAD_FAILED");
        setLoading(false);
        return;
      }
      setData(body.dashboard);
      setLoading(false);
    })();
  }, [studentId]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <MentoriaAppSectionNav active="parents" />
        <div className="space-y-6">
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-950">Resumen académico</h1>
            <p className="mt-1 text-sm text-slate-500">
              {data ? `${data.studentName} · ${data.schoolYear ?? ""}` : "Seguimiento de tu hijo/a en Mentoría y colegio."}
            </p>
          </div>

          {loading && (
            <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Cargando datos…</div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          {data && (
            <>
              {/* Estado de ánimo */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                  <div className="text-3xl">{MOOD_EMOJI[data.studentMood.overallMood] ?? "🙂"}</div>
                  <div className="mt-1 text-xs text-slate-500">Estado</div>
                  <div className="text-sm font-semibold text-slate-950 capitalize">{data.studentMood.overallMood}</div>
                </div>
                <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                  <div className="text-3xl font-bold text-slate-950">{data.studentMood.sessionStreak}</div>
                  <div className="mt-1 text-xs text-slate-500">🔥 Racha</div>
                </div>
                <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                  <div className="text-3xl font-bold text-emerald-600">{data.attendance.attendanceRate}%</div>
                  <div className="mt-1 text-xs text-slate-500">Asistencia</div>
                </div>
                <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                  <div className="text-3xl font-bold text-slate-950">{data.recentGrades.length}</div>
                  <div className="mt-1 text-xs text-slate-500">Notas</div>
                </div>
              </div>

              {/* Asistencia */}
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950 mb-4">Asistencia (últimos 30 días)</h2>
                <AttendanceBar attendance={data.attendance} />
              </div>

              {/* Materias */}
              {data.subjectPerformance.length > 0 && (
                <div className="rounded-[28px] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-950 mb-4">Evolución por materia</h2>
                  <div className="space-y-3">
                    {data.subjectPerformance.map((s) => (
                      <div key={s.subjectSlug} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-950">{s.subjectName}</div>
                          <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.trendDirection === "up" ? "bg-emerald-100 text-emerald-700" : s.trendDirection === "down" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>
                            {s.trendDirection === "up" ? "↑ mejora" : s.trendDirection === "down" ? "↓ baja" : "→ estable"}
                          </div>
                        </div>
                        <div className="mt-2 flex gap-4 text-xs text-slate-500">
                          <span>Colegio: <b className="text-slate-800">{s.schoolAverageScore ?? "-"}</b></span>
                          <span>Mentoría: <b className="text-slate-800">{s.mentoriaMasteryScore ?? "-"}</b></span>
                        </div>
                        {s.weakPoints.length > 0 && (
                          <div className="mt-2 text-xs text-rose-600">⚠ {s.weakPoints.slice(0, 2).join(" · ")}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas recientes */}
              {data.recentGrades.length > 0 && (
                <div className="rounded-[28px] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-950 mb-4">Notas recientes</h2>
                  <div className="space-y-2">
                    {data.recentGrades.slice(0, 8).map((g) => (
                      <div key={g.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium text-slate-950">{g.title}</div>
                          <div className="text-xs text-slate-500">{g.subjectName ?? g.subjectSlug} · {g.recordedAt.slice(0, 10)}</div>
                        </div>
                        <div className={`text-base font-bold ${g.scoreValue !== null && g.scoreScale ? (g.scoreValue / g.scoreScale >= 0.7 ? "text-emerald-600" : g.scoreValue / g.scoreScale >= 0.5 ? "text-amber-600" : "text-rose-600") : "text-slate-500"}`}>
                          {g.scoreValue !== null ? `${g.scoreValue}/${g.scoreScale ?? 10}` : g.scoreLabel ?? "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
