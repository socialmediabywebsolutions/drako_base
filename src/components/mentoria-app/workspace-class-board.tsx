"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, ChevronRight, PenLine, Lightbulb, AlertCircle, Trophy, StickyNote, TrendingUp, Hash } from "lucide-react";
import type { MentoriaBoardUpdate, MentoriaStudentSubject } from "@/lib/mentoria/types";

type WorkspaceClassBoardProps = {
  studentName?: string | null;
  boardUpdate: MentoriaBoardUpdate | null;
  sessionStatusMessage?: string | null;
  exerciseAnswer: string;
  onExerciseAnswerChange: (answer: string) => void;
  onSubmitBoardResponse: () => void;
  onGenerateAnotherQuestion: () => void;
  onEndSession: () => void;
  studentSubjects?: MentoriaStudentSubject[];
  onSubjectSelect?: (subjectSlug: string) => void;
};

function hasVisibleBoardContent(boardUpdate: MentoriaBoardUpdate | null) {
  if (!boardUpdate) return false;
  if (boardUpdate.intent === "idle") return false;
  return Boolean(
    boardUpdate.conceptDefinition
    || boardUpdate.explanation.length > 0
    || boardUpdate.steps.length > 0
    || boardUpdate.example
    || boardUpdate.exercise
    || boardUpdate.task
    || boardUpdate.exam
    || boardUpdate.documentFeedback
    || boardUpdate.correction,
  );
}

function activePrompt(boardUpdate: MentoriaBoardUpdate | null) {
  if (!boardUpdate) return null;
  if (boardUpdate.mode === "exam" || boardUpdate.mode === "task") return boardUpdate.nextAction ?? null;
  return (
    boardUpdate.activeQuestion
    ?? boardUpdate.guidedQuestion
    ?? boardUpdate.exercise?.prompt
    ?? boardUpdate.task?.prompt
    ?? boardUpdate.exam?.questions[0]
    ?? boardUpdate.nextAction
    ?? null
  );
}

function difficultyDots(level?: number | null) {
  const max = 5;
  const filled = Math.min(level ?? 1, max);
  return Array.from({ length: max }, (_, i) => i < filled);
}

// ── Animated step reveal ───────────────────────────────────────────────────
function useRevealSteps(steps: string[], deps: unknown[]) {
  const [revealed, setRevealed] = useState(0);
  const prevKey = useRef<string>("");
  const key = steps.join("|");

  useEffect(() => {
    if (key !== prevKey.current) {
      prevKey.current = key;
      setRevealed(0);
      if (steps.length === 0) return;
      let i = 0;
      const tick = () => {
        i++;
        setRevealed(i);
        if (i < steps.length) setTimeout(tick, 320);
      };
      setTimeout(tick, 180);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  return revealed;
}

// ── Board section wrapper ──────────────────────────────────────────────────
function BoardSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white px-6 py-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children, color = "slate" }: { children: React.ReactNode; color?: "slate" | "emerald" | "sky" | "amber" | "rose" | "violet" | "indigo" }) {
  const colors: Record<string, string> = {
    slate: "text-slate-500",
    emerald: "text-emerald-700",
    sky: "text-sky-700",
    amber: "text-amber-700",
    rose: "text-rose-600",
    violet: "text-violet-700",
    indigo: "text-indigo-700",
  };
  return (
    <p className={`mb-3 text-[10px] font-black tracking-[0.2em] uppercase ${colors[color]}`}>{children}</p>
  );
}

export function WorkspaceClassBoard({
  studentName = null,
  boardUpdate,
  sessionStatusMessage = null,
  exerciseAnswer,
  onExerciseAnswerChange,
  onSubmitBoardResponse,
  studentSubjects = [],
  onSubjectSelect,
}: WorkspaceClassBoardProps) {
  const visibleBoard = hasVisibleBoardContent(boardUpdate);
  const currentQuestion = activePrompt(boardUpdate);
  const firstName = studentName?.split(" ")[0] ?? "Alumno";
  const learningState = boardUpdate?.learningState ?? null;

  const steps = boardUpdate?.steps.length
    ? boardUpdate.steps
    : boardUpdate?.explanation ?? [];

  const revealedCount = useRevealSteps(steps, [boardUpdate?.topic]);

  // ── Empty state ────────────────────────────────────────────────────────
  if (!visibleBoard) {
    return (
      <div className="flex h-full flex-col bg-slate-50">
        {/* Subject pills */}
        {studentSubjects.length > 0 && onSubjectSelect ? (
          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3">
            {studentSubjects.map((item) => {
              const slug = item.subject?.slug ?? "";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { if (slug) onSubjectSelect(slug); }}
                  disabled={!slug}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {item.subject?.name ?? "Materia"}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
            <PenLine className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-950">
            {firstName}, ¿qué trabajamos hoy?
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
            Dime qué no entiendes o qué tema quieres repasar — la pizarra se activa en cuanto empieces.
          </p>
          {sessionStatusMessage ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900">
              {sessionStatusMessage}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Active board ───────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-slate-50">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <PenLine className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{boardUpdate?.subjectName ?? "Clase"}</p>
            <p className="text-sm font-bold text-slate-900 leading-tight">{boardUpdate?.topic ?? "Tema"}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {learningState ? (
            <div className="flex items-center gap-1.5">
              {difficultyDots(learningState.difficultyLevel).map((filled, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${filled ? "bg-emerald-500" : "bg-slate-200"}`}
                />
              ))}
            </div>
          ) : null}
          {studentSubjects.length > 0 && onSubjectSelect ? (
            <div className="flex gap-1.5 overflow-x-auto">
              {studentSubjects.map((item) => {
                const slug = item.subject?.slug ?? "";
                const isActive = Boolean(slug) && slug === boardUpdate?.subjectSlug;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { if (slug) onSubjectSelect(slug); }}
                    disabled={!slug}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isActive
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                    }`}
                  >
                    {item.subject?.name ?? "Materia"}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Board canvas ─────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-3xl space-y-4">

          {/* Status alert */}
          {sessionStatusMessage ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {sessionStatusMessage}
            </div>
          ) : null}

          {/* ── Concept / Big idea ───────────────────────────────────── */}
          {boardUpdate?.conceptDefinition ? (
            <BoardSection>
              <SectionLabel color="emerald">Idea clave</SectionLabel>
              <p className="text-xl font-black leading-tight text-slate-950">
                {boardUpdate.conceptDefinition}
              </p>
              {boardUpdate.feedback ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3">
                  <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-sm font-semibold leading-6 text-emerald-900">{boardUpdate.feedback}</p>
                </div>
              ) : null}
            </BoardSection>
          ) : boardUpdate?.explanation[0] ? (
            <BoardSection>
              <SectionLabel color="emerald">Explicación</SectionLabel>
              <p className="text-xl font-black leading-tight text-slate-950">
                {boardUpdate.explanation[0]}
              </p>
              {boardUpdate.feedback ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3">
                  <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-sm font-semibold leading-6 text-emerald-900">{boardUpdate.feedback}</p>
                </div>
              ) : null}
            </BoardSection>
          ) : null}

          {/* ── Steps — animated reveal ──────────────────────────────── */}
          {steps.length > 0 ? (
            <BoardSection>
              <SectionLabel color="slate">Paso a paso</SectionLabel>
              <ol className="space-y-3">
                {steps.map((step, i) => {
                  const visible = i < revealedCount;
                  const done = learningState ? i < learningState.stepIndex : false;
                  const current = learningState ? i === learningState.stepIndex : i === 0;
                  return (
                    <li
                      key={`step-${i}`}
                      className={`flex items-start gap-3 transition-all duration-300 ${
                        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                      }`}
                    >
                      <span className={`mt-0.5 shrink-0 transition-colors ${
                        done ? "text-emerald-500" : current ? "text-sky-600" : "text-slate-300"
                      }`}>
                        {done ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : current ? (
                          <ChevronRight className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </span>
                      <p className={`text-base leading-7 font-semibold ${
                        done ? "text-slate-400 line-through" : current ? "text-slate-950" : "text-slate-600"
                      }`}>
                        {step}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </BoardSection>
          ) : null}

          {/* ── Example ─────────────────────────────────────────────── */}
          {boardUpdate?.example ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <SectionLabel color="amber">Ejemplo</SectionLabel>
              </div>
              <p className="text-base font-semibold leading-7 text-amber-950">{boardUpdate.example}</p>
            </div>
          ) : null}

          {/* ── Formula ─────────────────────────────────────────────── */}
          {boardUpdate?.formula ? (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Hash className="h-4 w-4 text-indigo-600" />
                <SectionLabel color="indigo">Fórmula</SectionLabel>
              </div>
              <div className="overflow-x-auto rounded-xl bg-white px-5 py-4 border border-indigo-100">
                <pre className="font-mono text-base font-bold text-indigo-950 whitespace-pre-wrap leading-7">
                  {boardUpdate.formula}
                </pre>
              </div>
            </div>
          ) : null}

          {/* ── Diagrams ────────────────────────────────────────────── */}
          {(boardUpdate?.diagram ?? []).length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5">
              <SectionLabel>Esquema</SectionLabel>
              <div className="space-y-2">
                {(boardUpdate?.diagram ?? []).map((line, i) => (
                  <p key={i} className="text-sm font-mono font-semibold leading-6 text-slate-800">{line}</p>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Correction ──────────────────────────────────────────── */}
          {boardUpdate?.correction ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <SectionLabel color="rose">Ojo aquí</SectionLabel>
              </div>
              <p className="text-base font-semibold leading-7 text-rose-950">{boardUpdate.correction}</p>
            </div>
          ) : null}

          {/* ── Task / Exam ──────────────────────────────────────────── */}
          {boardUpdate?.task ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-6 py-5">
              <SectionLabel color="violet">{boardUpdate.task.title}</SectionLabel>
              <p className="text-lg font-bold leading-8 text-violet-950">{boardUpdate.task.prompt}</p>
            </div>
          ) : null}

          {boardUpdate?.exam ? (
            <div className="rounded-2xl border border-slate-300 bg-slate-100 px-6 py-5">
              <SectionLabel>{boardUpdate.exam.title}</SectionLabel>
              <ol className="mt-1 space-y-2">
                {boardUpdate.exam.questions.map((q, i) => (
                  <li key={i} className="text-sm font-semibold leading-6 text-slate-800">
                    {i + 1}. {q}
                  </li>
                ))}
              </ol>
              {boardUpdate.exam.scoring ? (
                <p className="mt-3 text-xs font-semibold text-slate-500">{boardUpdate.exam.scoring}</p>
              ) : null}
            </div>
          ) : null}

          {/* ── Active question — the "¿lo sabes?" prompt ───────────── */}
          {currentQuestion ? (
            <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <PenLine className="h-4 w-4 text-sky-600" />
                <SectionLabel color="sky">Tu turno</SectionLabel>
              </div>
              <p className="text-xl font-black leading-tight text-sky-950">{currentQuestion}</p>
              <div className="mt-4 flex flex-col gap-3">
                <textarea
                  value={exerciseAnswer}
                  onChange={(e) => onExerciseAnswerChange(e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="button"
                  onClick={onSubmitBoardResponse}
                  disabled={!exerciseAnswer.trim()}
                  className="self-end rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-40"
                >
                  Enviar respuesta
                </button>
              </div>
            </div>
          ) : null}

          {/* ── Progress summary ─────────────────────────────────────── */}
          {boardUpdate?.progressSummary ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-3">
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm font-semibold leading-6 text-emerald-900">{boardUpdate.progressSummary}</p>
            </div>
          ) : null}

          {/* ── Note ─────────────────────────────────────────────────── */}
          {boardUpdate?.note ? (
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-3">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-sm font-medium leading-6 text-slate-600 italic">{boardUpdate.note}</p>
            </div>
          ) : null}

          {/* ── Next action hint ─────────────────────────────────────── */}
          {boardUpdate?.nextAction && !currentQuestion ? (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-sm font-semibold leading-6 text-slate-700">{boardUpdate.nextAction}</p>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
