"use client";

import { useEffect, useState } from "react";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";

type ExamItem = {
  id: string;
  subjectName: string;
  examDate: string;
  examLabel: string | null;
  difficulty: string;
  daysUntil: number;
};

type SimulationQuestion = {
  question: string;
  expectedAnswer: string;
  hint: string;
  topic: string;
  difficulty: string;
};

type SimulationResult = {
  questions: SimulationQuestion[];
  durationSeconds: number;
  focusTopic: string;
  simulacroLabel: string;
};

// ── Pantalla de selección de examen ──────────────────────────────────────────
function ExamSelector({
  exams,
  onSelect,
}: {
  exams: ExamItem[];
  onSelect: (exam: ExamItem) => void;
}) {
  const urgency = (d: number) =>
    d <= 3 ? "border-rose-300 bg-rose-50" : d <= 7 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white";

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Elige el examen para el que quieres hacer un simulacro.</p>
      {exams.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
          No tienes exámenes activos.{" "}
          <a href="/mentoria/app/examenes" className="text-emerald-600 hover:underline">
            Declara uno aquí.
          </a>
        </div>
      )}
      {exams.map((exam) => (
        <button
          key={exam.id}
          onClick={() => onSelect(exam)}
          className={`w-full rounded-2xl border px-5 py-4 text-left transition hover:shadow-md ${urgency(exam.daysUntil)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-950">{exam.subjectName}</div>
              {exam.examLabel && <div className="text-xs text-slate-500 mt-0.5">{exam.examLabel}</div>}
              <div className="mt-1 text-xs text-slate-400">{exam.examDate}</div>
            </div>
            <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${exam.daysUntil <= 3 ? "bg-rose-100 text-rose-700" : exam.daysUntil <= 7 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {exam.daysUntil === 0 ? "Hoy" : `${exam.daysUntil}d`}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Simulacro ─────────────────────────────────────────────────────────────────
function SimulacroRunner({
  exam,
  sim,
  onFinish,
}: {
  exam: ExamItem;
  sim: SimulationResult;
  onFinish: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answers, setAnswers] = useState<Record<number, "good" | "bad">>({});
  const [done, setDone] = useState(false);

  const q = sim.questions[idx];
  const total = sim.questions.length;
  const good = Object.values(answers).filter((v) => v === "good").length;

  function mark(val: "good" | "bad") {
    setAnswers((a) => ({ ...a, [idx]: val }));
    setShowAnswer(false);
    setShowHint(false);
    if (idx + 1 < total) {
      setIdx((i) => i + 1);
    } else {
      setDone(true);
      void (async () => {
        await fetch("/api/mentoria/exam-mode", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examId: exam.id,
            action: "complete_simulation",
            simulationData: {
              durationSeconds: sim.durationSeconds,
              questionsCount: total,
              correctCount: good + (val === "good" ? 1 : 0),
            },
          }),
        });
      })();
    }
  }

  if (done) {
    const finalGood = Object.values(answers).filter((v) => v === "good").length;
    const pct = Math.round((finalGood / total) * 100);
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm text-center space-y-4">
        <div className="text-4xl">{pct >= 70 ? "🎉" : pct >= 50 ? "💪" : "📖"}</div>
        <div className="text-2xl font-bold text-slate-950">{finalGood}/{total} correctas</div>
        <div className={`text-lg font-semibold ${pct >= 70 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-600"}`}>
          {pct}% de acierto
        </div>
        <p className="text-sm text-slate-500">
          {pct >= 70
            ? "¡Muy bien! Estás preparado."
            : pct >= 50
            ? "Repasa los temas erróneos antes del examen."
            : "Necesitas más práctica. ¡Sigue adelante!"}
        </p>
        <button
          onClick={onFinish}
          className="mt-2 rounded-xl bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
        >
          Volver a exámenes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{sim.simulacroLabel}</span>
        <span>{idx + 1} / {total}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((idx) / total) * 100}%` }} />
      </div>

      {/* Question card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{q.topic}</div>
        <p className="text-base font-medium text-slate-950 leading-relaxed">{q.question}</p>

        {!showAnswer && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowHint(true)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition"
            >
              💡 Ver pista
            </button>
            <button
              onClick={() => setShowAnswer(true)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs text-white hover:bg-slate-700 transition"
            >
              Revelar respuesta
            </button>
          </div>
        )}

        {showHint && !showAnswer && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            💡 {q.hint}
          </div>
        )}

        {showAnswer && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-slate-800">
              <div className="font-semibold text-emerald-700 mb-1">Respuesta</div>
              {q.expectedAnswer}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">¿Lo sabías?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => mark("good")}
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition"
                >
                  ✓ Sí, bien
                </button>
                <button
                  onClick={() => mark("bad")}
                  className="flex-1 rounded-xl bg-rose-100 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-200 transition"
                >
                  ✗ No, repasar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function MentoriaSimulacro() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [loadingSim, setLoadingSim] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/mentoria/exam-mode?action=list", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/simulacro"; return; }
      if (res.status === 409) { window.location.href = "/mentoria/onboarding"; return; }
      const body = await res.json().catch(() => ({ exams: [] })) as { exams: ExamItem[] };
      setExams(body.exams ?? []);
      setLoading(false);
    })();
  }, []);

  async function startSim(exam: ExamItem) {
    setSelectedExam(exam);
    setLoadingSim(true);
    setSimError(null);
    const res = await fetch(`/api/mentoria/exam-mode?action=simulation&exam_id=${exam.id}`);
    if (!res.ok) {
      setSimError("No se pudo generar el simulacro. Inténtalo de nuevo.");
      setLoadingSim(false);
      return;
    }
    const body = await res.json().catch(() => null) as { simulation?: SimulationResult } | null;
    if (!body?.simulation) {
      setSimError("Respuesta inesperada del servidor.");
      setLoadingSim(false);
      return;
    }
    setSim(body.simulation);
    setLoadingSim(false);
  }

  function reset() {
    setSelectedExam(null);
    setSim(null);
    setSimError(null);
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <MentoriaAppSectionNav active="simulacro" />
        <div className="space-y-6">
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-950">Simulacro de examen</h1>
                <p className="mt-1 text-sm text-slate-500">Practica con preguntas generadas por IA para tu examen.</p>
              </div>
              {(selectedExam || sim) && (
                <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-700">
                  ← Volver
                </button>
              )}
            </div>
          </div>

          {loading && (
            <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Cargando exámenes…</div>
          )}

          {!loading && !selectedExam && (
            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <ExamSelector exams={exams} onSelect={(e) => { void startSim(e); }} />
            </div>
          )}

          {loadingSim && (
            <div className="rounded-[28px] bg-white p-8 text-center shadow-sm">
              <div className="text-2xl mb-3">🤖</div>
              <div className="text-sm text-slate-500">Generando simulacro con IA para {selectedExam?.subjectName}…</div>
            </div>
          )}

          {simError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {simError}
            </div>
          )}

          {sim && selectedExam && !loadingSim && (
            <SimulacroRunner exam={selectedExam} sim={sim} onFinish={reset} />
          )}
        </div>
      </div>
    </div>
  );
}
