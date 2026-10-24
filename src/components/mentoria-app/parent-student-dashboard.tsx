"use client";

import { useEffect, useState } from "react";
import type { ParentDashboardData, SubjectPerformanceSummary } from "@/app/api/mentoria/parent-dashboard/route";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-500";
  if (score >= 70) return "bg-emerald-100 text-emerald-800";
  if (score >= 50) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function trendIcon(dir: SubjectPerformanceSummary["trendDirection"]): string {
  if (dir === "up") return "↑";
  if (dir === "down") return "↓";
  if (dir === "steady") return "→";
  return "·";
}

function trendColor(dir: SubjectPerformanceSummary["trendDirection"]): string {
  if (dir === "up") return "text-emerald-600";
  if (dir === "down") return "text-red-500";
  return "text-slate-400";
}

function moodLabel(mood: string | null): string {
  const map: Record<string, string> = {
    animado: "Animado",
    neutro: "Neutro",
    desanimado: "Desanimado",
    bloqueado: "Bloqueado",
    steady: "Estable",
    excited: "Motivado",
    anxious: "Nervioso",
    frustrated: "Frustrado",
  };
  return map[mood ?? ""] ?? mood ?? "—";
}

function moodChip(mood: string | null): string {
  const happy = ["animado", "excited", "steady"];
  const bad = ["desanimado", "bloqueado", "frustrated", "anxious"];
  if (happy.includes(mood ?? "")) return "bg-emerald-100 text-emerald-800";
  if (bad.includes(mood ?? "")) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function behaviorBadge(type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    positive: { label: "Positivo", color: "bg-emerald-100 text-emerald-800" },
    neutral: { label: "Sin incidencias", color: "bg-slate-100 text-slate-600" },
    attention: { label: "Necesita atención", color: "bg-amber-100 text-amber-800" },
    disruptive: { label: "Conducta disruptiva", color: "bg-red-100 text-red-800" },
    disengaged: { label: "Desconectado", color: "bg-orange-100 text-orange-800" },
  };
  return map[type] ?? { label: type, color: "bg-slate-100 text-slate-600" };
}

function attendanceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    present: "Presente",
    absent_justified: "Falta justificada",
    absent: "Falta",
    late: "Llegó tarde",
    left_early: "Salió antes",
  };
  return map[status] ?? status;
}

function recordTypeLabel(type: string): string {
  const map: Record<string, string> = {
    exam: "Examen",
    homework: "Tarea",
    project: "Proyecto",
    notebook: "Cuaderno",
    behavior: "Comportamiento",
    presentation: "Presentación",
    custom: "Otro",
  };
  return map[type] ?? type;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function ScoreBar({ value, max = 100, color = "bg-emerald-500" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────

function SubjectGrid({ subjects }: { subjects: SubjectPerformanceSummary[] }) {
  if (subjects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
        Aún no hay datos de rendimiento por materia. Se actualizarán tras las primeras sesiones.
      </div>
    );
  }

  const sorted = [...subjects].sort((a, b) => {
    const sa = a.mentoriaMasteryScore ?? a.schoolAverageScore ?? 0;
    const sb = b.mentoriaMasteryScore ?? b.schoolAverageScore ?? 0;
    return sb - sa;
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((subject) => {
        const masteryPct = subject.mentoriaMasteryScore;
        const schoolScore = subject.schoolAverageScore;
        const schoolPct = schoolScore !== null ? Math.round((schoolScore / 10) * 100) : null;

        return (
          <div key={subject.subjectSlug} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{subject.subjectName}</div>
              <span className={`text-lg font-bold ${trendColor(subject.trendDirection)}`}>
                {trendIcon(subject.trendDirection)}
              </span>
            </div>

            {masteryPct !== null ? (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Nivel Mentoría</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${scoreColor(masteryPct)}`}>{masteryPct}%</span>
                </div>
                <ScoreBar value={masteryPct} color={masteryPct >= 70 ? "bg-emerald-500" : masteryPct >= 50 ? "bg-amber-400" : "bg-red-400"} />
              </div>
            ) : null}

            {schoolPct !== null && schoolScore !== null ? (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Nota del cole</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${scoreColor(schoolPct)}`}>{schoolScore}/10</span>
                </div>
                <ScoreBar value={schoolPct} color={schoolPct >= 70 ? "bg-sky-400" : schoolPct >= 50 ? "bg-amber-400" : "bg-red-400"} />
              </div>
            ) : null}

            {subject.lastMood ? (
              <div className="mt-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${moodChip(subject.lastMood)}`}>
                  IA detectó: {moodLabel(subject.lastMood)}
                </span>
              </div>
            ) : null}

            {subject.strongPoints.length > 0 ? (
              <div className="mt-2 text-[11px] text-emerald-700">
                ✓ {subject.strongPoints.slice(0, 2).join(" · ")}
              </div>
            ) : null}
            {subject.weakPoints.length > 0 ? (
              <div className="mt-1 text-[11px] text-amber-700">
                ⚠ {subject.weakPoints.slice(0, 2).join(" · ")}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Attendance & Behavior inline form
// ──────────────────────────────────────────────────────────────

function QuickLogForm({ studentId, onSaved }: { studentId: string; onSaved: () => void }) {
  const [mode, setMode] = useState<"attendance" | "behavior" | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceStatus, setAttendanceStatus] = useState("present");
  const [behaviorType, setBehaviorType] = useState("positive");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (mode === "attendance") {
        await fetch("/api/mentoria/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, recordDate: date, status: attendanceStatus, notes: note || null }),
        });
      } else if (mode === "behavior") {
        await fetch("/api/mentoria/behavior", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, recordDate: date, behaviorType, note: note || null }),
        });
      }
      setMode(null);
      setNote("");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Registrar desde el colegio</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setMode(mode === "attendance" ? null : "attendance")}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${mode === "attendance" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
        >
          Asistencia
        </button>
        <button
          onClick={() => setMode(mode === "behavior" ? null : "behavior")}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${mode === "behavior" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
        >
          Comportamiento en clase
        </button>
      </div>

      {mode ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>

          {mode === "attendance" ? (
            <div>
              <label className="text-xs font-semibold text-slate-600">Estado</label>
              <select value={attendanceStatus} onChange={(e) => setAttendanceStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="present">Asistió</option>
                <option value="absent_justified">Falta justificada</option>
                <option value="absent">Falta sin justificar</option>
                <option value="late">Llegó tarde</option>
                <option value="left_early">Salió antes</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-600">Comportamiento</label>
              <select value={behaviorType} onChange={(e) => setBehaviorType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="positive">Positivo — participó, se esforzó</option>
                <option value="neutral">Sin incidencias</option>
                <option value="attention">Necesita más atención</option>
                <option value="disengaged">Desconectado, ausente</option>
                <option value="disruptive">Conducta disruptiva</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600">Nota (opcional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Lo que te comentó el profe, lo que observaste..."
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export function ParentStudentDashboard({ studentId }: { studentId: string }) {
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/mentoria/parent-dashboard?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" });
      if (!response.ok) {
        setError("No se pudo cargar el panel.");
        return;
      }
      const body = (await response.json()) as { ok: boolean; dashboard?: ParentDashboardData };
      if (body.ok && body.dashboard) {
        setData(body.dashboard);
        setError(null);
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [studentId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error ?? "Sin datos disponibles."}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Estado emocional y preferencias IA */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Lo que detectó el tutor IA</div>
        <h3 className="mt-2 text-lg font-bold text-slate-900">Estado de {data.studentName}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estado ánimo</div>
            <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${moodChip(data.studentMood.overallMood)}`}>
              {moodLabel(data.studentMood.overallMood)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confianza</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{data.studentMood.confidenceScore}%</div>
            <ScoreBar value={data.studentMood.confidenceScore} color="bg-emerald-500" />
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Le gusta más</div>
            <div className="mt-2 text-sm font-semibold text-emerald-900">{data.studentMood.mostLikedSubject ?? "—"}</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Más difícil para él/ella</div>
            <div className="mt-2 text-sm font-semibold text-amber-900">{data.studentMood.leastLikedSubject ?? "—"}</div>
          </div>
        </div>
        {data.studentMood.sessionStreak > 0 ? (
          <div className="mt-3 text-xs text-slate-500">
            {data.studentMood.sessionStreak} {data.studentMood.sessionStreak === 1 ? "día" : "días"} seguidos de estudio · buen ritmo.
          </div>
        ) : null}
      </section>

      {/* Rendimiento por materia */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rendimiento por materia</div>
            <p className="mt-1 text-xs text-slate-400">Combina el nivel de Mentoría IA con la nota del cole.</p>
          </div>
        </div>
        <SubjectGrid subjects={data.subjectPerformance} />
      </section>

      {/* Notas del cole */}
      {data.recentGrades.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notas del colegio</div>
          <div className="mt-4 divide-y divide-slate-100">
            {data.recentGrades.slice(0, 15).map((grade) => (
              <div key={grade.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{grade.title}</span>
                    {grade.subjectName ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{grade.subjectName}</span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{recordTypeLabel(grade.recordType)}</span>
                  </div>
                  {grade.teacherComment ? (
                    <div className="mt-1 text-xs text-slate-500 italic">&ldquo;{grade.teacherComment}&rdquo;</div>
                  ) : null}
                  <div className="mt-1 text-[11px] text-slate-400">{formatDate(grade.recordedAt)}</div>
                </div>
                {grade.scoreValue !== null ? (
                  <div className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${scoreColor(grade.scoreScale ? (grade.scoreValue / grade.scoreScale) * 100 : grade.scoreValue)}`}>
                    {grade.scoreValue}{grade.scoreScale ? `/${grade.scoreScale}` : ""}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notas del colegio</div>
          <p className="mt-3 text-sm text-slate-400">Aún no hay notas registradas. El alumno puede añadirlas desde su panel o el padre puede introducirlas aquí.</p>
        </section>
      )}

      {/* Asistencia */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Asistencia — últimos 30 días</div>
        {data.attendance.totalDays > 0 ? (
          <>
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <div className="text-2xl font-black text-emerald-700">{data.attendance.attendanceRate}%</div>
                <div className="mt-1 text-[11px] font-semibold text-emerald-600">Asistencia</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <div className="text-2xl font-black text-slate-700">{data.attendance.presentDays}</div>
                <div className="mt-1 text-[11px] text-slate-500">Días presente</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <div className="text-2xl font-black text-amber-700">{data.attendance.absentJustifiedDays}</div>
                <div className="mt-1 text-[11px] text-amber-600">Justificadas</div>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <div className="text-2xl font-black text-red-600">{data.attendance.absentDays - data.attendance.absentJustifiedDays}</div>
                <div className="mt-1 text-[11px] text-red-500">Sin justificar</div>
              </div>
            </div>
            {data.attendance.recentAbsences.length > 0 ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-500">Ausencias recientes</div>
                <div className="mt-2 space-y-1">
                  {data.attendance.recentAbsences.slice(0, 5).map((abs) => (
                    <div key={abs.date} className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="font-medium">{formatDate(abs.date)}</span>
                      <span className="text-slate-400">·</span>
                      <span>{attendanceStatusLabel(abs.status)}</span>
                      {abs.notes ? <span className="text-slate-400 italic">{abs.notes}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Registra la asistencia usando el formulario de abajo. Así llevas el control desde el panel sin depender de un cuaderno.</p>
        )}
      </section>

      {/* Comportamiento */}
      {data.behavior.recentRecords.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Comportamiento en clase</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.behavior.positiveCount > 0 ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{data.behavior.positiveCount} positivos</span>
            ) : null}
            {data.behavior.attentionCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{data.behavior.attentionCount} necesitan atención</span>
            ) : null}
            {data.behavior.disruptiveCount > 0 ? (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">{data.behavior.disruptiveCount} disruptivos</span>
            ) : null}
          </div>
          <div className="mt-4 space-y-2">
            {data.behavior.recentRecords.slice(0, 8).map((rec, i) => {
              const badge = behaviorBadge(rec.behaviorType);
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.color}`}>{badge.label}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {rec.subjectName ? <span className="font-medium text-slate-700">{rec.subjectName}</span> : null}
                      <span>{formatDate(rec.date)}</span>
                    </div>
                    {rec.note ? <div className="mt-0.5 text-xs text-slate-600">{rec.note}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Formulario de registro rápido */}
      <QuickLogForm studentId={studentId} onSaved={load} />
    </div>
  );
}
