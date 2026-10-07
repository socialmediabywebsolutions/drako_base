"use client";

import { useEffect, useState } from "react";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";

type DeclaredExam = {
  id: string;
  subject_id: string;
  subject_name: string;
  exam_date: string;
  exam_label: string | null;
  difficulty: "easy" | "medium" | "hard";
  status: string;
  sessions_planned: number;
  sessions_done: number;
  score_after: string | null;
  created_at: string;
};

const DIFF_LABELS: Record<string, string> = {
  easy: "🟢 Fácil",
  medium: "🟡 Media",
  hard: "🔴 Difícil",
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function ExamCard({ exam }: { exam: DeclaredExam }) {
  const days = daysUntil(exam.exam_date);
  const urgency = days <= 3 ? "rose" : days <= 7 ? "amber" : "emerald";
  const colorMap = {
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-950">{exam.subject_name}</div>
          {exam.exam_label && <div className="text-xs text-slate-500 mt-0.5">{exam.exam_label}</div>}
          <div className="mt-1 text-sm text-slate-500">{exam.exam_date}</div>
        </div>
        <div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${colorMap[urgency]}`}>
          {days < 0 ? "Pasado" : days === 0 ? "Hoy" : `${days}d`}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{DIFF_LABELS[exam.difficulty]}</span>
        <span>·</span>
        <span>{exam.sessions_done}/{exam.sessions_planned} sesiones</span>
      </div>
      {exam.sessions_planned > 0 && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, Math.round((exam.sessions_done / exam.sessions_planned) * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function CreateExamForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subjectName: "",
    examDate: "",
    difficulty: "medium" as "easy" | "medium" | "hard",
    sessionsPlanned: 3,
    examLabel: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subjectName || !form.examDate) return;
    setSubmitting(true);
    await fetch("/api/mentoria/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId: form.subjectName.toLowerCase().replace(/\s+/g, "-"),
        subjectName: form.subjectName,
        examDate: form.examDate,
        examLabel: form.examLabel || undefined,
        difficulty: form.difficulty,
        sessionsPlanned: form.sessionsPlanned,
      }),
    });
    setSubmitting(false);
    setOpen(false);
    setForm({ subjectName: "", examDate: "", difficulty: "medium", sessionsPlanned: 3, examLabel: "" });
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition"
      >
        + Declarar nuevo examen
      </button>
    );
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
      <h3 className="font-semibold text-slate-950">Nuevo examen</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura *</label>
          <input
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            placeholder="Ej. Matemáticas"
            value={form.subjectName}
            onChange={(e) => setForm((f) => ({ ...f, subjectName: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Etiqueta (opcional)</label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            placeholder="Ej. Parcial T3"
            value={form.examLabel}
            onChange={(e) => setForm((f) => ({ ...f, examLabel: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha del examen *</label>
          <input
            required
            type="date"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            value={form.examDate}
            onChange={(e) => setForm((f) => ({ ...f, examDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Dificultad</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            value={form.difficulty}
            onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as "easy" | "medium" | "hard" }))}
          >
            <option value="easy">Fácil</option>
            <option value="medium">Media</option>
            <option value="hard">Difícil</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sesiones previstas</label>
          <input
            type="number"
            min={0}
            max={20}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            value={form.sessionsPlanned}
            onChange={(e) => setForm((f) => ({ ...f, sessionsPlanned: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {submitting ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function MentoriaExams() {
  const [exams, setExams] = useState<DeclaredExam[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/mentoria/exams?status=active", { cache: "no-store" });
    if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/examenes"; return; }
    if (res.status === 409) { window.location.href = "/mentoria/onboarding"; return; }
    const body = await res.json().catch(() => ({ exams: [] })) as { exams: DeclaredExam[] };
    setExams(body.exams ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <MentoriaAppSectionNav active="examenes" />
        <div className="space-y-6">
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-950">Mis exámenes</h1>
            <p className="mt-1 text-sm text-slate-500">Declara tus próximos exámenes para que Mentoría te prepare.</p>
          </div>

          {loading && (
            <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Cargando exámenes…</div>
          )}

          {!loading && (
            <div className="space-y-3">
              <CreateExamForm onCreated={() => { void load(); }} />
              {exams.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  No tienes exámenes declarados. ¡Añade el primero!
                </div>
              ) : (
                exams.map((exam) => <ExamCard key={exam.id} exam={exam} />)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
