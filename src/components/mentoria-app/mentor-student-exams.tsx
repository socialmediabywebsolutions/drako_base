"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { MentorExamRow } from "@/app/api/mentoria/mentor-exams/route";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Fácil",
  medium: "Normal",
  hard: "Difícil",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

function daysUntil(dateStr: string): number {
  const exam = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function ExamCard({ exam }: { exam: MentorExamRow }) {
  const days = daysUntil(exam.examDate);
  const diffColor = DIFFICULTY_COLOR[exam.difficulty] ?? "bg-slate-100 text-slate-600";

  let urgencyClass = "bg-slate-50 border-slate-200";
  let daysLabel = "";
  if (days < 0) {
    urgencyClass = "bg-slate-50 border-slate-200";
    daysLabel = "Pasado";
  } else if (days === 0) {
    urgencyClass = "bg-rose-50 border-rose-200";
    daysLabel = "¡Hoy!";
  } else if (days <= 3) {
    urgencyClass = "bg-rose-50 border-rose-200";
    daysLabel = `${days}d`;
  } else if (days <= 7) {
    urgencyClass = "bg-amber-50 border-amber-200";
    daysLabel = `${days}d`;
  } else {
    urgencyClass = "bg-white border-slate-200";
    daysLabel = `${days}d`;
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 ${urgencyClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{exam.subjectName}</div>
          {exam.examLabel && (
            <div className="text-xs text-slate-500 truncate mt-0.5">{exam.examLabel}</div>
          )}
          <div className="mt-1 text-xs text-slate-500">
            {new Date(exam.examDate + "T00:00:00").toLocaleDateString("es-ES", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${diffColor}`}>
            {DIFFICULTY_LABEL[exam.difficulty] ?? exam.difficulty}
          </span>
          {days >= 0 && (
            <span className="text-xs font-bold text-slate-600">{daysLabel}</span>
          )}
        </div>
      </div>
      {exam.sessionsPlanned > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          Sesiones:{" "}
          <span className="font-semibold text-slate-700">
            {exam.sessionsDone}/{exam.sessionsPlanned}
          </span>{" "}
          planificadas
        </div>
      )}
    </div>
  );
}

export function MentorStudentExams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<MentorExamRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>("");

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [examLabel, setExamLabel] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [sessionsPlanned, setSessionsPlanned] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) {
      setError("No se especificó el alumno.");
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      const [examsRes, studentRes] = await Promise.all([
        fetch(`/api/mentoria/mentor-exams?studentId=${encodeURIComponent(studentId)}&status=active`, {
          cache: "no-store",
        }),
        fetch(`/api/mentoria/mentor-student?studentId=${encodeURIComponent(studentId)}`, {
          cache: "no-store",
        }),
      ]);

      if (examsRes.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel";
        return;
      }
      if (examsRes.status === 403) {
        setError("Acceso restringido.");
        setLoading(false);
        return;
      }

      const examsBody = await examsRes.json().catch(() => null) as { exams?: MentorExamRow[] } | null;
      setExams(examsBody?.exams ?? []);

      if (studentRes.ok) {
        const studentBody = await studentRes.json().catch(() => null) as { fullName?: string } | null;
        setStudentName(studentBody?.fullName ?? "");
      }

      setLoading(false);
    })();
  }, [studentId]);

  async function handleAddExam(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectName.trim() || !examDate) return;

    setSaving(true);
    setSaveError(null);

    const res = await fetch(`/api/mentoria/mentor-exams?studentId=${encodeURIComponent(studentId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectName: subjectName.trim(),
        examDate,
        examLabel: examLabel.trim() || undefined,
        difficulty,
        sessionsPlanned,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      setSaveError(body?.error ?? "Error al guardar el examen.");
      setSaving(false);
      return;
    }

    const body = await res.json().catch(() => null) as { id?: string } | null;

    const newExam: MentorExamRow = {
      id: body?.id ?? crypto.randomUUID(),
      subjectId: crypto.randomUUID(),
      subjectName: subjectName.trim(),
      examDate,
      examLabel: examLabel.trim() || null,
      difficulty,
      status: "active",
      sessionsPlanned,
      sessionsDone: 0,
      scoreAfter: null,
      createdAt: new Date().toISOString(),
    };

    setExams((prev) => [...prev, newExam].sort((a, b) => a.examDate.localeCompare(b.examDate)));
    setFormOpen(false);
    setSubjectName("");
    setExamLabel("");
    setDifficulty("medium");
    setSessionsPlanned(3);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-500">Cargando exámenes…</p>
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
              <h1 className="text-xl font-semibold text-slate-950">Exámenes</h1>
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

        {/* Add exam button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition"
          >
            {formOpen ? "✕ Cancelar" : "➕ Añadir examen"}
          </button>
        </div>

        {/* Add exam form */}
        {formOpen && (
          <form
            onSubmit={(e) => void handleAddExam(e)}
            className="rounded-[28px] bg-white p-6 shadow-sm space-y-4"
          >
            <h2 className="font-semibold text-slate-900">Nuevo examen</h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="subjectName">
                Asignatura <span className="text-rose-500">*</span>
              </label>
              <input
                id="subjectName"
                type="text"
                required
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Matemáticas, Física…"
                maxLength={80}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="examLabel">
                Descripción (opcional)
              </label>
              <input
                id="examLabel"
                type="text"
                value={examLabel}
                onChange={(e) => setExamLabel(e.target.value)}
                placeholder="Trimestral, Recuperación, Tema 5…"
                maxLength={100}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="examDate">
                Fecha del examen <span className="text-rose-500">*</span>
              </label>
              <input
                id="examDate"
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="difficulty">
                Dificultad
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="easy">Fácil</option>
                <option value="medium">Normal</option>
                <option value="hard">Difícil</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="sessions">
                Sesiones planificadas:{" "}
                <span className="font-semibold text-emerald-700">{sessionsPlanned}</span>
              </label>
              <input
                id="sessions"
                type="range"
                min={0}
                max={20}
                step={1}
                value={sessionsPlanned}
                onChange={(e) => setSessionsPlanned(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>0</span>
                <span>20</span>
              </div>
            </div>

            {saveError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {saveError}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
            >
              {saving ? "Guardando…" : "Guardar examen"}
            </button>
          </form>
        )}

        {/* Exams list */}
        {exams.length === 0 ? (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">📅</div>
            <div className="font-semibold text-slate-950">Sin exámenes registrados</div>
            <p className="mt-1 text-sm text-slate-500">
              Añade el próximo examen del alumno para planificar las sesiones.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-500 px-1">
              {exams.length} examen{exams.length !== 1 ? "es" : ""} activo{exams.length !== 1 ? "s" : ""}
            </div>
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        )}

        {/* Link to add more from student detail */}
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
