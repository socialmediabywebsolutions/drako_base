"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { MentorSubjectStat } from "@/app/api/mentoria/mentor-subject-stats/route";

function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (diffH < 1) return "Hace menos de 1h";
  if (diffH < 24) return `Hace ${Math.round(diffH)}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Ayer";
  if (diffD <= 7) return `Hace ${diffD}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function SubjectCard({
  subject,
  maxSessions,
}: {
  subject: MentorSubjectStat;
  maxSessions: number;
}) {
  const pct = maxSessions > 0 ? Math.round((subject.sessionCount / maxSessions) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{subject.subjectName}</div>
          <div className="mt-1 text-xs text-slate-400">
            Última sesión: {formatRelativeDate(subject.lastSessionAt)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-slate-950">{subject.sessionCount}</div>
          <div className="text-xs text-slate-400">sesiones</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span>
          ⏱ <span className="font-medium text-slate-700">{formatMinutes(subject.totalMinutes)}</span>{" "}
          totales
        </span>
        <span>
          ⌀{" "}
          <span className="font-medium text-slate-700">{subject.avgDurationMinutes} min</span>/sesión
        </span>
      </div>
    </div>
  );
}

export function MentorStudentSubjects() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<MentorSubjectStat[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>("");

  useEffect(() => {
    if (!studentId) {
      setError("No se especificó el alumno.");
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      const [subjectsRes, studentRes] = await Promise.all([
        fetch(
          `/api/mentoria/mentor-subject-stats?studentId=${encodeURIComponent(studentId)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/mentoria/mentor-student?studentId=${encodeURIComponent(studentId)}`,
          { cache: "no-store" },
        ),
      ]);

      if (subjectsRes.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel";
        return;
      }
      if (subjectsRes.status === 403) {
        setError("Acceso restringido.");
        setLoading(false);
        return;
      }

      const body = await subjectsRes.json().catch(() => null) as {
        subjects?: MentorSubjectStat[];
        totalSessions?: number;
        totalMinutes?: number;
      } | null;

      if (!body) {
        setError("Error al cargar las materias.");
        setLoading(false);
        return;
      }

      setSubjects(body.subjects ?? []);
      setTotalSessions(body.totalSessions ?? 0);
      setTotalMinutes(body.totalMinutes ?? 0);

      if (studentRes.ok) {
        const studentBody = await studentRes.json().catch(() => null) as { fullName?: string } | null;
        setStudentName(studentBody?.fullName ?? "");
      }

      setLoading(false);
    })();
  }, [studentId]);

  const maxSessions = subjects.reduce((m, s) => Math.max(m, s.sessionCount), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-500">Cargando materias…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg space-y-5">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Materias</h1>
              {studentName && (
                <p className="mt-0.5 text-sm text-slate-500">{studentName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                router.push(`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`)
              }
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Summary */}
        {subjects.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-[28px] bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-slate-950">{subjects.length}</div>
              <div className="text-xs text-slate-500 mt-1">Materias</div>
            </div>
            <div className="rounded-[28px] bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-emerald-600">{totalSessions}</div>
              <div className="text-xs text-slate-500 mt-1">Sesiones</div>
            </div>
            <div className="rounded-[28px] bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-blue-600">{formatMinutes(totalMinutes)}</div>
              <div className="text-xs text-slate-500 mt-1">Tiempo total</div>
            </div>
          </div>
        )}

        {/* Empty */}
        {subjects.length === 0 && (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">📚</div>
            <div className="font-semibold text-slate-950">Sin materias registradas</div>
            <p className="mt-1 text-sm text-slate-500">
              Las materias aparecerán aquí cuando el alumno complete sesiones de estudio.
            </p>
          </div>
        )}

        {/* Subjects list */}
        {subjects.length > 0 && (
          <div className="space-y-3">
            {subjects.map((s) => (
              <SubjectCard key={s.subjectId} subject={s} maxSessions={maxSessions} />
            ))}
          </div>
        )}

        <div className="text-center">
          <Link
            href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`}
            className="text-sm text-slate-400 hover:text-slate-600 transition"
          >
            ← Volver al perfil del alumno
          </Link>
        </div>
      </div>
    </div>
  );
}
