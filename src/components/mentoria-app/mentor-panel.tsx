"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MentorStudentRow } from "@/app/api/mentoria/mentor-panel/route";

const MOOD_EMOJI: Record<string, string> = {
  animado: "😊",
  neutro: "😐",
  desanimado: "😔",
  bloqueado: "😤",
  happy: "😊",
  neutral: "😐",
  sad: "😔",
  frustrated: "😤",
};

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (diffH < 1) return "Hace menos de 1h";
  if (diffH < 24) return `Hace ${Math.round(diffH)}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Ayer";
  if (diffD <= 7) return `Hace ${diffD} días`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function inactivityColor(lastSessionAt: string | null): string {
  if (!lastSessionAt) return "bg-slate-100 text-slate-500";
  const diffH = (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60);
  if (diffH > 168) return "bg-rose-100 text-rose-700"; // >7d
  if (diffH > 48) return "bg-amber-100 text-amber-700"; // >48h
  return "bg-emerald-100 text-emerald-700";
}

function StudentRow({ student }: { student: MentorStudentRow }) {
  const mood = student.lastEmotionalState?.toLowerCase() ?? "";
  const emoji = MOOD_EMOJI[mood] ?? "🙂";
  const badgeClass = inactivityColor(student.lastSessionAt);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl">{emoji}</span>
          <div className="min-w-0">
            <Link
              href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(student.studentId)}`}
              className="font-semibold text-slate-950 hover:text-emerald-700 truncate block transition"
            >
              {student.fullName}
            </Link>
            {student.guardianEmail && (
              <div className="text-xs text-slate-400 truncate">{student.guardianEmail}</div>
            )}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          {formatRelativeDate(student.lastSessionAt)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span>
          <span className="font-medium text-slate-700">{student.totalSessions}</span> sesiones
        </span>
        <span>
          🔥 <span className="font-medium text-slate-700">{student.streakDays}</span> racha
        </span>
        {student.activeExams > 0 && (
          <span>
            📅 <span className="font-medium text-slate-700">{student.activeExams}</span>{" "}
            {student.activeExams === 1 ? "examen" : "exámenes"}
          </span>
        )}
        {student.lastSubjectName && (
          <span className="truncate">
            Última materia: <span className="font-medium text-slate-700">{student.lastSubjectName}</span>
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          href={`/mentoria/app/progress?studentId=${encodeURIComponent(student.studentId)}`}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
        >
          Ver progreso
        </Link>
        <Link
          href={`/mentoria/app/alertas?studentId=${encodeURIComponent(student.studentId)}`}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
        >
          Alertas
        </Link>
        <Link
          href={`/mentoria/app/resumen-academico?studentId=${encodeURIComponent(student.studentId)}`}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
        >
          Académico
        </Link>
        <Link
          href={`/mentoria/panel/notas?studentId=${encodeURIComponent(student.studentId)}`}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
        >
          📝 Notas
        </Link>
      </div>
    </div>
  );
}

export function MentorPanel() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<MentorStudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/mentoria/mentor-panel", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel"; return; }
      if (res.status === 403) { setError("Acceso restringido al panel de mentor."); setLoading(false); return; }
      if (res.status === 409) { window.location.href = "/mentoria/onboarding"; return; }
      const body = await res.json().catch(() => null) as { students?: MentorStudentRow[] } | null;
      if (!body) { setError("Error al cargar el panel."); setLoading(false); return; }
      setStudents(body.students ?? []);
      setLoading(false);
    })();
  }, []);

  const inactive7d = students.filter(
    (s) => !s.lastSessionAt || (Date.now() - new Date(s.lastSessionAt).getTime()) > 7 * 24 * 60 * 60 * 1000,
  ).length;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Panel del mentor</h1>
              <p className="mt-1 text-sm text-slate-500">
                {students.length > 0
                  ? `${students.length} alumnos · ${inactive7d} inactivos +7d`
                  : "Visión general de todos los alumnos."}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/mentoria/panel/stats"
                className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                📊 Estadísticas
              </Link>
              <Link
                href="/mentoria/panel/plan"
                className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                💳 Plan
              </Link>
              <Link
                href="/mentoria/panel/config"
                className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                ⚙️ Config
              </Link>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando alumnos…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && students.length === 0 && (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">👩‍🏫</div>
            <div className="font-semibold text-slate-950">Sin alumnos registrados</div>
            <p className="mt-1 text-sm text-slate-500">
              Cuando se den de alta alumnos en este tenant aparecerán aquí.
            </p>
          </div>
        )}

        {students.length > 0 && (
          <>
            {/* Stats rápidas */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                <div className="text-2xl font-bold text-slate-950">{students.length}</div>
                <div className="text-xs text-slate-500 mt-1">Alumnos</div>
              </div>
              <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                <div className="text-2xl font-bold text-rose-600">{inactive7d}</div>
                <div className="text-xs text-slate-500 mt-1">Inactivos +7d</div>
              </div>
              <div className="rounded-[28px] bg-white p-5 shadow-sm text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {students.filter((s) => s.activeExams > 0).length}
                </div>
                <div className="text-xs text-slate-500 mt-1">Con exámenes</div>
              </div>
            </div>

            {/* Lista alumnos */}
            <div className="space-y-3">
              {students.map((s) => (
                <StudentRow key={s.studentId} student={s} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
