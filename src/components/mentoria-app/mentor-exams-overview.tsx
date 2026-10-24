"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MentorExamAllRow } from "@/app/api/mentoria/mentor-exams-all/route";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-rose-50 text-rose-700",
};

function urgencyBadge(daysUntil: number) {
  if (daysUntil < 0) return <span className="text-xs rounded-lg bg-slate-100 text-slate-400 px-2 py-0.5">Pasado</span>;
  if (daysUntil === 0) return <span className="text-xs rounded-lg bg-rose-100 text-rose-700 font-semibold px-2 py-0.5">¡Hoy!</span>;
  if (daysUntil === 1) return <span className="text-xs rounded-lg bg-rose-50 text-rose-600 px-2 py-0.5">Mañana</span>;
  if (daysUntil <= 3) return <span className="text-xs rounded-lg bg-amber-50 text-amber-700 px-2 py-0.5">{daysUntil}d</span>;
  if (daysUntil <= 7) return <span className="text-xs rounded-lg bg-amber-50 text-amber-600 px-2 py-0.5">{daysUntil}d</span>;
  return <span className="text-xs rounded-lg bg-slate-100 text-slate-500 px-2 py-0.5">{daysUntil}d</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

function ExamCard({ exam }: { exam: MentorExamAllRow }) {
  const prepPct = exam.sessionsPlanned > 0
    ? Math.min(100, Math.round((exam.sessionsDone / exam.sessionsPlanned) * 100))
    : 0;
  const diffColor = DIFFICULTY_COLORS[exam.difficulty] ?? DIFFICULTY_COLORS.medium;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(exam.studentId)}`}
              className="font-semibold text-slate-900 hover:text-emerald-700 transition text-sm"
            >
              {exam.studentName}
            </Link>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-sm text-slate-700">{exam.subjectName}</span>
            {exam.examLabel && (
              <span className="text-xs text-slate-400">— {exam.examLabel}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className={`text-xs rounded-lg px-2 py-0.5 ${diffColor}`}>
              {DIFFICULTY_LABELS[exam.difficulty] ?? exam.difficulty}
            </span>
            <span className="text-xs text-slate-400">{formatDate(exam.examDate)}</span>
            {urgencyBadge(exam.daysUntil)}
          </div>
        </div>
        <Link
          href={`/mentoria/panel/alumno/examenes?studentId=${encodeURIComponent(exam.studentId)}`}
          className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
        >
          Ver →
        </Link>
      </div>

      {exam.sessionsPlanned > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Preparación</span>
            <span>{exam.sessionsDone}/{exam.sessionsPlanned} sesiones ({prepPct}%)</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${prepPct >= 80 ? "bg-emerald-500" : prepPct >= 40 ? "bg-amber-400" : "bg-rose-400"}`}
              style={{ width: `${prepPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function MentorExamsOverview() {
  const router = useRouter();
  const [exams, setExams] = useState<MentorExamAllRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "completed">("active");

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/mentoria/mentor-exams-all?status=${statusFilter}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel"; return; }
        if (res.status === 403) { setError("Acceso restringido."); setLoading(false); return; }
        const data = await res.json().catch(() => null) as { exams?: MentorExamAllRow[] } | null;
        setExams(data?.exams ?? []);
        setLoading(false);
      });
  }, [statusFilter]);

  // Group by urgency buckets
  const urgent = exams.filter((e) => e.daysUntil >= 0 && e.daysUntil <= 3);
  const thisWeek = exams.filter((e) => e.daysUntil > 3 && e.daysUntil <= 7);
  const upcoming = exams.filter((e) => e.daysUntil > 7);
  const past = exams.filter((e) => e.daysUntil < 0);

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Exámenes</h1>
              <p className="mt-0.5 text-sm text-slate-500">Próximos exámenes de todos tus alumnos</p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/mentoria/panel")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              ← Panel
            </button>
          </div>

          {/* Status tabs */}
          <div className="mt-4 flex gap-2">
            {(["active", "completed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  statusFilter === s
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s === "active" ? "Activos" : "Completados"}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Cargando exámenes…</div>
        )}

        {!loading && exams.length === 0 && (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">📅</div>
            <div className="font-semibold text-slate-950">
              {statusFilter === "active" ? "Sin exámenes pendientes" : "Sin exámenes completados"}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {statusFilter === "active"
                ? "Añade exámenes desde el perfil de cada alumno."
                : "Aparecerán aquí los exámenes marcados como completados."}
            </p>
          </div>
        )}

        {!loading && statusFilter === "active" && (
          <>
            {urgent.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-2 px-1">
                  🔴 Urgente (≤3 días) — {urgent.length}
                </h2>
                <div className="space-y-2">
                  {urgent.map((e) => <ExamCard key={e.id} exam={e} />)}
                </div>
              </div>
            )}
            {thisWeek.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 px-1">
                  🟡 Esta semana — {thisWeek.length}
                </h2>
                <div className="space-y-2">
                  {thisWeek.map((e) => <ExamCard key={e.id} exam={e} />)}
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
                  Próximos — {upcoming.length}
                </h2>
                <div className="space-y-2">
                  {upcoming.map((e) => <ExamCard key={e.id} exam={e} />)}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
                  Pasados (aún activos) — {past.length}
                </h2>
                <div className="space-y-2">
                  {past.map((e) => <ExamCard key={e.id} exam={e} />)}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && statusFilter === "completed" && exams.length > 0 && (
          <div className="space-y-2">
            {exams.map((e) => <ExamCard key={e.id} exam={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}
