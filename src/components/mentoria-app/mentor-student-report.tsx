"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import type { MentorStudentDetail } from "@/app/api/mentoria/mentor-student/route";
import type { AttendanceRecord } from "@/app/api/mentoria/attendance/route";
import type { BehaviorRecord } from "@/app/api/mentoria/behavior/route";
import type { MentoriaAcademicRecord } from "@/lib/mentoria/academic-types";

const MOOD_EMOJI: Record<string, string> = {
  animado: "😊", neutro: "😐", desanimado: "😔", bloqueado: "😤",
};

const ATTENDANCE_LABELS: Record<string, { label: string; emoji: string }> = {
  present:          { label: "Asistió",             emoji: "✅" },
  absent_justified: { label: "Falta justificada",   emoji: "📋" },
  absent:           { label: "Falta sin justificar", emoji: "❌" },
  late:             { label: "Llegó tarde",           emoji: "⏰" },
  left_early:       { label: "Salió antes",           emoji: "🚪" },
};

const BEHAVIOR_LABELS: Record<string, { label: string; emoji: string }> = {
  positive:   { label: "Positivo",           emoji: "⭐" },
  neutral:    { label: "Normal",             emoji: "😐" },
  attention:  { label: "Necesita atención",  emoji: "⚠️" },
  disruptive: { label: "Conducta difícil",   emoji: "🔴" },
  disengaged: { label: "Desconectado",       emoji: "💭" },
};

const RECORD_TYPE_LABELS: Record<string, string> = {
  exam: "Examen", homework: "Tarea", project: "Trabajo",
  notebook: "Cuaderno", behavior: "Actitud", presentation: "Presentación", custom: "Otro",
};

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString("es-ES", opts ?? { day: "numeric", month: "short", year: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 print:mt-4">
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500 w-40 shrink-0">{label}</span>
      <span className="text-slate-900 font-medium">{String(value)}</span>
    </div>
  );
}

export function MentorStudentReport() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [student, setStudent] = useState<MentorStudentDetail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [behavior, setBehavior] = useState<BehaviorRecord[]>([]);
  const [academic, setAcademic] = useState<MentoriaAcademicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) { setError("studentId requerido."); setLoading(false); return; }
    void (async () => {
      setLoading(true);
      const [stuRes, attRes, behRes, acaRes] = await Promise.all([
        fetch(`/api/mentoria/mentor-student?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
        fetch(`/api/mentoria/attendance?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
        fetch(`/api/mentoria/behavior?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
        fetch(`/api/mentoria/academic/records?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
      ]);

      if (stuRes.status === 401) { window.location.href = "/mentorias/auths/logins"; return; }
      if (stuRes.status === 403) { setError("Acceso restringido."); setLoading(false); return; }

      const stuData = await stuRes.json().catch(() => null) as { student?: MentorStudentDetail } | null;
      const attData = await attRes.json().catch(() => null) as { records?: AttendanceRecord[] } | null;
      const behData = await behRes.json().catch(() => null) as { records?: BehaviorRecord[] } | null;
      const acaData = await acaRes.json().catch(() => null) as { records?: MentoriaAcademicRecord[] } | null;

      if (!stuData?.student) { setError("No se encontró el alumno."); setLoading(false); return; }
      setStudent(stuData.student);
      setAttendance(attData?.records ?? []);
      setBehavior(behData?.records ?? []);
      setAcademic(acaData?.records ?? []);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6 flex items-center justify-center">
        <div className="text-sm text-slate-500">Generando informe…</div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error ?? "Error al cargar el informe."}
        </div>
      </div>
    );
  }

  const reportDate = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const totalHours = Math.floor(student.totalMinutes / 60);
  const remMin = student.totalMinutes % 60;
  const hoursLabel = totalHours > 0 ? `${totalHours}h ${remMin}min` : `${remMin}min`;

  // Last 10 attendance records
  const recentAttendance = attendance.slice(0, 10);
  const presentCount = attendance.filter((r) => r.status === "present").length;
  const absentCount = attendance.filter((r) => r.status === "absent").length;

  // Last 10 behavior records
  const recentBehavior = behavior.slice(0, 10);

  // Last 10 academic records
  const recentAcademic = academic.slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 print:bg-white print:p-0">
      {/* Toolbar — hidden on print */}
      <div className="mx-auto max-w-3xl mb-4 flex items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => router.push(`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
        >
          ← Alumno
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition"
        >
          🖨️ Imprimir / PDF
        </button>
        <span className="ml-auto text-xs text-slate-400">Informe generado el {reportDate}</span>
      </div>

      {/* Report */}
      <div className="mx-auto max-w-3xl bg-white rounded-[28px] shadow-sm px-8 py-8 print:shadow-none print:rounded-none print:max-w-none">

        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">{student.fullName}</h1>
              <p className="mt-1 text-sm text-slate-500">{student.schoolYear}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>Informe de seguimiento</div>
              <div className="font-medium text-slate-600">{reportDate}</div>
            </div>
          </div>
        </div>

        {/* Datos del alumno */}
        <Section title="Datos del alumno">
          <div className="space-y-1.5">
            <InfoRow label="Nombre completo" value={student.fullName} />
            <InfoRow label="Curso" value={student.schoolYear} />
            <InfoRow label="Email tutor/familia" value={student.guardianEmail} />
            <InfoRow label="Teléfono familia" value={student.guardianPhone} />
            <InfoRow label="Estilo de aprendizaje" value={student.learningPreference} />
            <InfoRow label="Tiempo estudio diario" value={student.preferredStudyMinutes ? `${student.preferredStudyMinutes} minutos` : null} />
            {student.supportNotes && (
              <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">Notas de apoyo: </span>{student.supportNotes}
              </div>
            )}
          </div>
        </Section>

        {/* Resumen de actividad */}
        <Section title="Resumen de actividad">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sesiones totales", value: student.totalSessions },
              { label: "Tiempo total", value: hoursLabel },
              { label: "Racha actual", value: `${student.streakDays} días 🔥` },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-center">
                <div className="text-xl font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {student.subjectBreakdown.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="text-xs font-semibold text-slate-500 mb-2">Distribución por materias</div>
              {student.subjectBreakdown.map((s) => (
                <div key={s.subjectName} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 text-slate-700 truncate">{s.subjectName}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${student.subjectBreakdown[0] ? Math.round((s.sessionCount / student.subjectBreakdown[0].sessionCount) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-16 text-right">{s.sessionCount} ses. · {Math.floor(s.totalMinutes / 60)}h{s.totalMinutes % 60 > 0 ? `${s.totalMinutes % 60}m` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Estado emocional */}
        {student.moodBreakdown.length > 0 && (
          <Section title="Estado emocional en sesiones">
            <div className="flex flex-wrap gap-2">
              {student.moodBreakdown.map((m) => (
                <div key={m.mood} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-center min-w-[80px]">
                  <div className="text-lg">{MOOD_EMOJI[m.mood] ?? "🙂"}</div>
                  <div className="text-sm font-semibold text-slate-900">{m.count}</div>
                  <div className="text-xs text-slate-500">{m.mood}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Últimas sesiones */}
        {student.recentSessions.length > 0 && (
          <Section title="Últimas sesiones">
            <div className="space-y-2">
              {student.recentSessions.map((s) => (
                <div key={s.id} className="flex items-start gap-3 text-sm">
                  <span className="w-28 shrink-0 text-xs text-slate-400">{formatDate(s.createdAt)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-900">{s.subjectName ?? "Sin materia"}</span>
                    {s.topic && <span className="text-slate-500"> — {s.topic}</span>}
                    <span className="text-xs text-slate-400 ml-2">{s.durationMinutes} min{s.emotionalState ? ` · ${MOOD_EMOJI[s.emotionalState] ?? ""} ${s.emotionalState}` : ""}</span>
                    {s.tutorSummary && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.tutorSummary}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Próximos exámenes */}
        {student.upcomingExams.length > 0 && (
          <Section title="Exámenes próximos">
            <div className="space-y-1.5">
              {student.upcomingExams.map((e) => (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-xs text-slate-400">{formatDate(e.examDate)}</span>
                  <span className="font-medium text-slate-900 flex-1">{e.subjectName ?? "Examen"}</span>
                  <span className="text-xs text-slate-500">{e.sessionsDone}/{e.sessionsPlanned} ses.</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Asistencia reciente */}
        {recentAttendance.length > 0 && (
          <Section title={`Asistencia reciente (${attendance.length} registros total · ${presentCount} asistencias · ${absentCount} faltas)`}>
            <div className="space-y-1.5">
              {recentAttendance.map((r) => {
                const meta = ATTENDANCE_LABELS[r.status] ?? { label: r.status, emoji: "•" };
                return (
                  <div key={r.id} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-xs text-slate-400">{formatDate(r.recordDate)}</span>
                    <span className="flex-1 text-slate-700">{meta.emoji} {meta.label}</span>
                    {r.notes && <span className="text-xs text-slate-400 truncate max-w-[200px]">{r.notes}</span>}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Comportamiento reciente */}
        {recentBehavior.length > 0 && (
          <Section title="Observaciones de comportamiento">
            <div className="space-y-1.5">
              {recentBehavior.map((r) => {
                const meta = BEHAVIOR_LABELS[r.behaviorType] ?? { label: r.behaviorType, emoji: "•" };
                return (
                  <div key={r.id} className="flex items-start gap-3 text-sm">
                    <span className="w-28 shrink-0 text-xs text-slate-400">{formatDate(r.recordDate)}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-700">{meta.emoji} {meta.label}</span>
                      <span className="text-xs text-slate-400 ml-2">{"★".repeat(r.intensity)}</span>
                      {r.note && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Registros académicos recientes */}
        {recentAcademic.length > 0 && (
          <Section title="Registros académicos recientes">
            <div className="space-y-1.5">
              {recentAcademic.map((r) => {
                const scoreStr = r.scoreValue !== null
                  ? (r.scoreScale ? `${r.scoreValue}/${r.scoreScale}` : String(r.scoreValue))
                  : r.scoreLabel ?? null;
                return (
                  <div key={r.id} className="flex items-start gap-3 text-sm">
                    <span className="w-28 shrink-0 text-xs text-slate-400">{formatDate(r.recordedAt)}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-900">{r.title}</span>
                      <span className="text-xs text-slate-500 ml-2">{RECORD_TYPE_LABELS[r.recordType] ?? r.recordType}</span>
                      {r.subjectSlug && <span className="text-xs text-slate-400 ml-2">{r.subjectSlug}</span>}
                      {scoreStr && <span className="text-xs font-semibold text-emerald-700 ml-2">{scoreStr}</span>}
                      {r.teacherComment && <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{r.teacherComment}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="mt-10 pt-5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>Informe generado por Mentoría · {reportDate}</span>
          <span>{student.fullName} · {student.schoolYear}</span>
        </div>
      </div>
    </div>
  );
}
