"use client";

import type { ChangeEvent } from "react";
import type { MentoriaBoardUpdate } from "@/lib/mentoria/types";

type WorkspaceClassBoardProps = {
  studentName?: string | null;
  boardUpdate: MentoriaBoardUpdate | null;
  boardHistory: MentoriaBoardUpdate[];
  sessionStatusMessage?: string | null;
  launchPanel?: {
    title: string;
    detail: string;
    ctaLabel: string;
  } | null;
  onLaunchPanel?: () => void;
  exerciseAnswer: string;
  onExerciseAnswerChange: (answer: string) => void;
  onSubmitExercise: () => void;
  onAdvanceBoardStep: () => void;
  onRequestSimplerExplanation: () => void;
  onRequestAnotherExample: () => void;
  onRequestPractice: () => void;
};

function formatModeLabel(mode: MentoriaBoardUpdate["mode"]) {
  if (mode === "example") return "Ejemplo";
  if (mode === "practice") return "Practica";
  if (mode === "correction") return "Correccion";
  if (mode === "summary") return "Resumen";
  return "Explicacion";
}

export function WorkspaceClassBoard({
  studentName = null,
  boardUpdate,
  boardHistory,
  sessionStatusMessage = null,
  launchPanel = null,
  onLaunchPanel,
  exerciseAnswer,
  onExerciseAnswerChange,
  onSubmitExercise,
  onAdvanceBoardStep,
  onRequestSimplerExplanation,
  onRequestAnotherExample,
  onRequestPractice,
}: WorkspaceClassBoardProps) {
  const historyTopics = Array.from(
    new Set(
      boardHistory
        .slice(0, -1)
        .map((item) => item.topic.trim())
        .filter(Boolean),
    ),
  ).slice(-4);

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="sr-only">{studentName ? `Hola, ${studentName.split(" ")[0]}` : "Hola"}</h1>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {boardUpdate?.subjectName ?? "Pizarra"}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {boardUpdate?.topic ?? "Empieza por una duda concreta"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {boardUpdate?.schoolYear ? <span>{boardUpdate.schoolYear}</span> : null}
              {boardUpdate?.studentName ? <span>{boardUpdate.studentName}</span> : null}
            </div>
          </div>

          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
            {formatModeLabel(boardUpdate?.mode ?? "explanation")}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          {sessionStatusMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
              {sessionStatusMessage}
            </div>
          ) : null}

          {launchPanel ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-950">{launchPanel.title}</div>
                  <div className="mt-2 text-sm text-slate-600">{launchPanel.detail}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchPanel?.()}
                  className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-black"
                >
                  {launchPanel.ctaLabel}
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            {boardUpdate ? (
              <div className="space-y-6">
                {boardUpdate.conceptDefinition ? (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Concepto</div>
                    <p className="mt-3 text-lg font-semibold leading-8 text-slate-950">{boardUpdate.conceptDefinition}</p>
                  </section>
                ) : null}

                <section className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Explicacion</div>
                  <div className="space-y-3">
                    {boardUpdate.explanation.map((line, index) => (
                      <p key={`${line}-${index}`} className="text-base leading-8 text-slate-800">
                        {line}
                      </p>
                    ))}
                  </div>
                </section>

                {boardUpdate.formula ? (
                  <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Formula o regla</div>
                    <div className="mt-3 text-base font-semibold text-sky-950">{boardUpdate.formula}</div>
                  </section>
                ) : null}

                {boardUpdate.diagram?.length ? (
                  <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Esquema</div>
                    <div className="mt-3 space-y-2 text-sm font-medium text-violet-950">
                      {boardUpdate.diagram.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
                    </div>
                  </section>
                ) : null}

                {boardUpdate.example ? (
                  <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Ejemplo trabajado</div>
                    <p className="mt-3 text-base leading-8 text-amber-950">{boardUpdate.example}</p>
                  </section>
                ) : null}

                {boardUpdate.steps.length ? (
                  <section className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pasos</div>
                    <div className="space-y-3">
                      {boardUpdate.steps.map((step, index) => (
                        <div key={`${step}-${index}`} className="flex gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                            {index + 1}
                          </div>
                          <div className="min-w-0 text-base leading-7 text-slate-800">{step}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {boardUpdate.exercise ? (
                  <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Ejercicio actual</div>
                    <p className="mt-3 text-base font-semibold leading-8 text-emerald-950">{boardUpdate.exercise.prompt}</p>
                    {boardUpdate.exercise.answerFormat ? (
                      <p className="mt-2 text-sm text-emerald-900">Formato: {boardUpdate.exercise.answerFormat}</p>
                    ) : null}
                    {boardUpdate.exercise.hints?.length ? (
                      <div className="mt-4 space-y-2 text-sm text-emerald-900">
                        {boardUpdate.exercise.hints.map((hint, index) => (
                          <div key={`${hint}-${index}`}>Pista {index + 1}: {hint}</div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-4 space-y-3">
                      <label htmlFor="mentoria-board-answer" className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                        Tu respuesta
                      </label>
                      <textarea
                        id="mentoria-board-answer"
                        value={exerciseAnswer}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onExerciseAnswerChange(event.target.value)}
                        placeholder="Escribe aqui tu respuesta"
                        className="min-h-[120px] w-full resize-none rounded-3xl border border-emerald-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </section>
                ) : null}

                {boardUpdate.correction ? (
                  <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Correccion</div>
                    <p className="mt-3 text-base leading-8 text-rose-950">{boardUpdate.correction}</p>
                  </section>
                ) : null}

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Siguiente pregunta guiada</div>
                  <p className="mt-3 text-base font-semibold leading-8 text-slate-950">{boardUpdate.nextAction}</p>
                </section>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Escribe tu duda al tutor y la explicacion aparecera aqui.
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={onAdvanceBoardStep}
                className="rounded-2xl bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition hover:bg-black"
              >
                Siguiente paso
              </button>
              <button
                type="button"
                onClick={onRequestSimplerExplanation}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                No lo entiendo
              </button>
              <button
                type="button"
                onClick={onRequestAnotherExample}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Dame otro ejemplo
              </button>
              <button
                type="button"
                onClick={boardUpdate?.exercise ? onSubmitExercise : onRequestPractice}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
              >
                {boardUpdate?.exercise ? "Enviar respuesta" : "Practicar"}
              </button>
            </div>
          </div>

          {historyTopics.length > 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Historial de esta materia</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {historyTopics.map((item) => (
                  <div key={item} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
