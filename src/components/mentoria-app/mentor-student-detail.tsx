"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  MentorStudentDetail,
  RecentSession,
  UpcomingExam,
  SubjectEntry,
  MoodEntry,
} from "@/app/api/mentoria/mentor-student/route";
import type { AttendanceRecord } from "@/app/api/mentoria/attendance/route";
import type { BehaviorRecord } from "@/app/api/mentoria/behavior/route";

const MOOD_EMOJI: Record<string, string> = {
  animado: "😊", neutro: "😐", desanimado: "😔", bloqueado: "😤",
  happy: "😊", neutral: "😐", sad: "😔", frustrated: "😤",
};

const ATTENDANCE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  present:           { label: "Asistió",             color: "bg-emerald-100 text-emerald-700", emoji: "✅" },
  absent_justified:  { label: "Falta justificada",   color: "bg-amber-100 text-amber-700",    emoji: "📋" },
  absent:            { label: "Falta",                color: "bg-rose-100 text-rose-700",      emoji: "❌" },
  late:              { label: "Tarde",                color: "bg-orange-100 text-orange-700",  emoji: "⏰" },
  left_early:        { label: "Salió antes",          color: "bg-orange-100 text-orange-700",  emoji: "🚪" },
};

const BEHAVIOR_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  positive:   { label: "Positivo",           color: "bg-emerald-100 text-emerald-700", emoji: "⭐" },
  neutral:    { label: "Normal",             color: "bg-slate-100 text-slate-600",     emoji: "😐" },
  attention:  { label: "Necesita atención",  color: "bg-amber-100 text-amber-700",     emoji: "⚠️" },
  disruptive: { label: "Conducta difícil",   color: "bg-rose-100 text-rose-700",       emoji: "🔴" },
  disengaged: { label: "Desconectado",        color: "bg-slate-100 text-slate-600",     emoji: "💭" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (diffH < 1) return "Hace menos de 1h";
  if (diffH < 24) return `Hace ${Math.round(diffH)}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Ayer";
  if (diffD <= 7) return `Hace ${diffD} días`;
  return formatDate(iso);
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function StatPill({ label, value, color = "slate" }: { label: string; value: string | number; color?: string }) {
  const colorMap: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <div className={`rounded-2xl px-4 py-3 text-center ${colorMap[color] ?? colorMap.slate}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function SessionCard({ session }: { session: RecentSession }) {
  const mood = session.emotionalState?.toLowerCase() ?? "";
  const emoji = MOOD_EMOJI[mood] ?? "🙂";
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{emoji}</span>
          <div>
            <div className="text-sm font-medium text-slate-800 truncate">{session.subjectName ?? "Sin materia"}</div>
            {session.topic && session.topic !== session.subjectName && (
              <div className="text-xs text-slate-500 truncate">{session.topic}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
          <span>{session.durationMinutes} min</span>
          <span className="text-slate-300">·</span>
          <span>{formatRelativeDate(session.createdAt)}</span>
        </div>
      </div>
      {session.tutorSummary && (
        <p className="mt-2 text-xs text-slate-600 line-clamp-2">{session.tutorSummary}</p>
      )}
    </div>
  );
}

function ExamCard({ exam }: { exam: UpcomingExam }) {
  const days = daysUntil(exam.examDate);
  const urgentColor = days <= 3 ? "text-rose-600" : days <= 7 ? "text-amber-600" : "text-slate-600";
  const progress = exam.sessionsPlanned > 0
    ? Math.min(100, Math.round((exam.sessionsDone / exam.sessionsPlanned) * 100))
    : 0;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">{exam.subjectName ?? "Sin materia"}</div>
          <div className={`text-xs font-medium ${urgentColor}`}>{formatDate(exam.examDate)} · {days}d</div>
        </div>
        <div className="text-xs text-slate-500 text-right shrink-0">
          {exam.sessionsDone}/{exam.sessionsPlanned} sesiones
        </div>
      </div>
      {exam.sessionsPlanned > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progress >= 80 ? "bg-emerald-500" : progress >= 40 ? "bg-amber-500" : "bg-rose-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SubjectBar({ entry, max }: { entry: SubjectEntry; max: number }) {
  const pct = max > 0 ? Math.round((entry.sessionCount / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-xs text-slate-700 truncate">{entry.subjectName}</div>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-500 shrink-0 text-right w-16">
        {entry.sessionCount}s · {entry.totalMinutes}m
      </div>
    </div>
  );
}

function MoodBar({ entries }: { entries: MoodEntry[] }) {
  const total = entries.reduce((s, e) => s + e.count, 0);
  if (total === 0) return <p className="text-xs text-slate-400">Sin datos</p>;
  return (
    <div className="flex gap-2 flex-wrap">
      {entries.map((e) => {
        const emoji = MOOD_EMOJI[e.mood.toLowerCase()] ?? "🙂";
        const pct = Math.round((e.count / total) * 100);
        return (
          <div key={e.mood} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            <span>{emoji}</span>
            <span className="capitalize">{e.mood}</span>
            <span className="font-semibold text-slate-900">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function MentorStudentDetailPanel() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [detail, setDetail] = useState<MentorStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [behavior, setBehavior] = useState<BehaviorRecord[]>([]);

  // Quick attendance form
  const [attFormOpen, setAttFormOpen] = useState(false);
  // Quick behavior form
  const [behFormOpen, setBehFormOpen] = useState(false);
  const [behDate, setBehDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [behType, setBehType] = useState("neutral");
  const [behIntensity, setBehIntensity] = useState(2);
  const [behSubject, setBehSubject] = useState("");
  const [behNote, setBehNote] = useState("");
  const [behSaving, setBehSaving] = useState(false);
  const [behError, setBehError] = useState<string | null>(null);
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attStatus, setAttStatus] = useState("present");
  const [attSubject, setAttSubject] = useState("");
  const [attNotes, setAttNotes] = useState("");
  const [attSaving, setAttSaving] = useState(false);
  const [attError, setAttError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) { setError("Falta el ID del alumno."); setLoading(false); return; }
    void (async () => {
      setLoading(true);
      const [res, attRes, behRes] = await Promise.all([
        fetch(`/api/mentoria/mentor-student?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
        fetch(`/api/mentoria/attendance?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
        fetch(`/api/mentoria/behavior?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
      ]);
      if (res.status === 401) { window.location.href = `/mentorias/auths/logins?callbackUrl=/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`; return; }
      if (res.status === 403) { setError("Acceso restringido."); setLoading(false); return; }
      if (res.status === 404) { setError("Alumno no encontrado."); setLoading(false); return; }
      const body = await res.json().catch(() => null) as { detail?: MentorStudentDetail } | null;
      if (!body?.detail) { setError("Error al cargar los datos del alumno."); setLoading(false); return; }
      setDetail(body.detail);
      const attBody = await attRes.json().catch(() => null) as { records?: AttendanceRecord[] } | null;
      if (attBody?.records) setAttendance(attBody.records);
      const behBody = await behRes.json().catch(() => null) as { records?: BehaviorRecord[] } | null;
      if (behBody?.records) setBehavior(behBody.records);
      setLoading(false);
    })();
  }, [studentId]);

  async function handleSaveAttendance() {
    if (!attDate || !attStatus) return;
    setAttSaving(true);
    setAttError(null);
    const res = await fetch("/api/mentoria/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        recordDate: attDate,
        status: attStatus,
        subjectSlug: attSubject.trim() || null,
        notes: attNotes.trim() || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      setAttError(body?.error ?? "Error al guardar.");
      setAttSaving(false);
      return;
    }
    // Add optimistically to local state
    const body = await res.json().catch(() => ({})) as { id?: string };
    const newRecord: AttendanceRecord = {
      id: body.id ?? crypto.randomUUID(),
      recordDate: attDate,
      subjectSlug: attSubject.trim() || null,
      status: attStatus as AttendanceRecord["status"],
      notes: attNotes.trim() || null,
      createdAt: new Date().toISOString(),
    };
    setAttendance((prev) => [newRecord, ...prev]);
    setAttFormOpen(false);
    setAttDate(new Date().toISOString().slice(0, 10));
    setAttStatus("present");
    setAttSubject("");
    setAttNotes("");
    setAttSaving(false);
  }

  async function handleSaveBehavior() {
    if (!behDate || !behType) return;
    setBehSaving(true);
    setBehError(null);
    const res = await fetch("/api/mentoria/behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        recordDate: behDate,
        behaviorType: behType,
        intensity: behIntensity,
        subjectSlug: behSubject.trim() || null,
        note: behNote.trim() || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      setBehError(body?.error ?? "Error al guardar.");
      setBehSaving(false);
      return;
    }
    const body = await res.json().catch(() => ({})) as { id?: string };
    const newRecord: BehaviorRecord = {
      id: body.id ?? crypto.randomUUID(),
      recordDate: behDate,
      subjectSlug: behSubject.trim() || null,
      behaviorType: behType as BehaviorRecord["behaviorType"],
      intensity: behIntensity,
      note: behNote.trim() || null,
      createdAt: new Date().toISOString(),
    };
    setBehavior((prev) => [newRecord, ...prev]);
    setBehFormOpen(false);
    setBehDate(new Date().toISOString().slice(0, 10));
    setBehType("neutral");
    setBehIntensity(2);
    setBehSubject("");
    setBehNote("");
    setBehSaving(false);
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">

        {/* Back */}
        <Link href="/mentoria/panel" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
          ← Volver al panel
        </Link>

        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando datos del alumno…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {detail && (
          <>
            {/* Header */}
            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700">
                    {detail.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-slate-950 truncate">{detail.fullName}</h1>
                    <p className="text-sm text-slate-500">{detail.schoolYear}</p>
                    {detail.guardianEmail && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{detail.guardianEmail}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link
                    href={`/mentoria/panel/alumno/editar?studentId=${encodeURIComponent(studentId)}`}
                    className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    ✏️ Editar
                  </Link>
                  <Link
                    href={`/mentoria/panel/notas?studentId=${encodeURIComponent(studentId)}`}
                    className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                  >
                    📝 Notas
                  </Link>
                  <Link
                    href={`/mentoria/panel/alumno/examenes?studentId=${encodeURIComponent(studentId)}`}
                    className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                  >
                    📅 Exámenes
                  </Link>
                  <Link
                    href={`/mentoria/app/progress?studentId=${encodeURIComponent(studentId)}`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Progreso
                  </Link>
                  <Link
                    href={`/mentoria/app/alertas?studentId=${encodeURIComponent(studentId)}`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Alertas
                  </Link>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <StatPill label="Sesiones" value={detail.totalSessions} />
              <StatPill label="Minutos" value={detail.totalMinutes} color="blue" />
              <StatPill label="🔥 Racha" value={`${detail.streakDays}d`} color="amber" />
              <StatPill label="Exámenes" value={detail.upcomingExams.length} />
              <StatPill label="Materias" value={detail.subjectBreakdown.length} color="emerald" />
            </div>

            {/* Última actividad */}
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-slate-600">
                  Última sesión: <span className="font-medium text-slate-900">{formatRelativeDate(detail.lastSessionAt)}</span>
                  {detail.lastSubjectName && <span className="text-slate-500"> · {detail.lastSubjectName}</span>}
                </p>
                {detail.lastEmotionalState && (
                  <span className="text-sm">{MOOD_EMOJI[detail.lastEmotionalState.toLowerCase()] ?? "🙂"} {detail.lastEmotionalState}</span>
                )}
              </div>
              {(detail.learningPreference || detail.supportNotes) && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                  {detail.learningPreference && (
                    <p className="text-xs text-slate-500">
                      Estilo: <span className="text-slate-700">{detail.learningPreference}</span>
                    </p>
                  )}
                  {detail.supportNotes && (
                    <p className="text-xs text-slate-500">
                      Notas: <span className="text-slate-700">{detail.supportNotes}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Sesiones recientes */}
              <div className="rounded-[28px] bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-950 mb-3 text-sm">Sesiones recientes</h2>
                {detail.recentSessions.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin sesiones completadas.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.recentSessions.map((s) => <SessionCard key={s.id} session={s} />)}
                  </div>
                )}
              </div>

              {/* Próximos exámenes */}
              <div className="rounded-[28px] bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-950 mb-3 text-sm">Próximos exámenes</h2>
                {detail.upcomingExams.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin exámenes próximos.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.upcomingExams.map((e) => <ExamCard key={e.id} exam={e} />)}
                  </div>
                )}
              </div>
            </div>

            {/* Materias */}
            {detail.subjectBreakdown.length > 0 && (
              <div className="rounded-[28px] bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-950 mb-4 text-sm">Materias trabajadas</h2>
                <div className="space-y-3">
                  {detail.subjectBreakdown.map((e) => (
                    <SubjectBar key={e.subjectName} entry={e} max={detail.subjectBreakdown[0]?.sessionCount ?? 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Estado emocional */}
            {detail.moodBreakdown.length > 0 && (
              <div className="rounded-[28px] bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-950 mb-3 text-sm">Estado emocional durante sesiones</h2>
                <MoodBar entries={detail.moodBreakdown} />
              </div>
            )}

            {/* Registro rápido de asistencia */}
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-950 text-sm">Asistencia</h2>
                <button
                  type="button"
                  onClick={() => { setAttFormOpen((v) => !v); setAttError(null); }}
                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                >
                  {attFormOpen ? "Cancelar" : "➕ Registrar"}
                </button>
              </div>

              {attFormOpen && (
                <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                      <input
                        type="date"
                        value={attDate}
                        onChange={(e) => setAttDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
                      <select
                        value={attStatus}
                        onChange={(e) => setAttStatus(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-400 focus:outline-none"
                      >
                        <option value="present">✅ Asistió</option>
                        <option value="absent_justified">📋 Falta justificada</option>
                        <option value="absent">❌ Falta</option>
                        <option value="late">⏰ Tarde</option>
                        <option value="left_early">🚪 Salió antes</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura (opcional)</label>
                    <input
                      type="text"
                      value={attSubject}
                      onChange={(e) => setAttSubject(e.target.value)}
                      placeholder="Matemáticas, Inglés…"
                      maxLength={60}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
                    <input
                      type="text"
                      value={attNotes}
                      onChange={(e) => setAttNotes(e.target.value)}
                      placeholder="Observación breve…"
                      maxLength={200}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  {attError && (
                    <p className="text-xs text-rose-600">{attError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSaveAttendance()}
                    disabled={attSaving}
                    className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
                  >
                    {attSaving ? "Guardando…" : "Guardar asistencia"}
                  </button>
                </div>
              )}

              {attendance.length === 0 && !attFormOpen ? (
                <p className="text-xs text-slate-400">Sin registros de asistencia.</p>
              ) : attendance.length > 0 ? (
                <div className="space-y-2">
                  {attendance.slice(0, 10).map((r) => {
                    const meta = ATTENDANCE_LABELS[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600", emoji: "•" };
                    return (
                      <div key={r.id} className="flex items-start gap-3">
                        <span className={`shrink-0 mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-slate-500">{new Date(r.recordDate).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</span>
                          {r.subjectSlug && <span className="ml-1.5 text-xs text-slate-400">{r.subjectSlug}</span>}
                          {r.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{r.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Comportamiento */}
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-950 text-sm">Comportamiento en clase</h2>
                <button
                  type="button"
                  onClick={() => { setBehFormOpen((v) => !v); setBehError(null); }}
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  {behFormOpen ? "Cancelar" : "➕ Registrar"}
                </button>
              </div>

              {behFormOpen && (
                <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                      <input
                        type="date"
                        value={behDate}
                        onChange={(e) => setBehDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                      <select
                        value={behType}
                        onChange={(e) => setBehType(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-400 focus:outline-none"
                      >
                        <option value="positive">⭐ Positivo</option>
                        <option value="neutral">😐 Normal</option>
                        <option value="attention">⚠️ Necesita atención</option>
                        <option value="disruptive">🔴 Conducta difícil</option>
                        <option value="disengaged">💭 Desconectado</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Intensidad: <span className="font-semibold text-slate-800">{behIntensity}/5</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={behIntensity}
                      onChange={(e) => setBehIntensity(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura (opcional)</label>
                    <input
                      type="text"
                      value={behSubject}
                      onChange={(e) => setBehSubject(e.target.value)}
                      placeholder="Matemáticas, Inglés…"
                      maxLength={60}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nota (opcional)</label>
                    <input
                      type="text"
                      value={behNote}
                      onChange={(e) => setBehNote(e.target.value)}
                      placeholder="Observación breve…"
                      maxLength={300}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  {behError && <p className="text-xs text-rose-600">{behError}</p>}
                  <button
                    type="button"
                    onClick={() => void handleSaveBehavior()}
                    disabled={behSaving}
                    className="w-full rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                  >
                    {behSaving ? "Guardando…" : "Guardar comportamiento"}
                  </button>
                </div>
              )}

              {behavior.length === 0 && !behFormOpen ? (
                <p className="text-xs text-slate-400">Sin registros de comportamiento.</p>
              ) : behavior.length > 0 ? (
                <div className="space-y-2">
                  {behavior.slice(0, 10).map((r) => {
                    const meta = BEHAVIOR_LABELS[r.behaviorType] ?? { label: r.behaviorType, color: "bg-slate-100 text-slate-600", emoji: "•" };
                    return (
                      <div key={r.id} className="flex items-start gap-3">
                        <span className={`shrink-0 mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-slate-500">{new Date(r.recordDate).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</span>
                          {r.intensity > 1 && <span className="ml-1.5 text-xs text-slate-400">Intensidad {r.intensity}/5</span>}
                          {r.note && <p className="text-xs text-slate-500 mt-0.5 truncate">{r.note}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
