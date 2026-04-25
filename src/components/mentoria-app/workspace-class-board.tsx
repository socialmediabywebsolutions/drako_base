"use client";

import type { ChangeEvent } from "react";
import type { MentoriaBoardUpdate } from "@/lib/mentoria/types";

type WorkspaceClassBoardProps = {
  studentName?: string | null;
  boardUpdate: MentoriaBoardUpdate | null;
  sessionStatusMessage?: string | null;
  exerciseAnswer: string;
  onExerciseAnswerChange: (answer: string) => void;
  onSubmitBoardResponse: () => void;
  onGenerateAnotherQuestion: () => void;
  onEndSession: () => void;
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

export function WorkspaceClassBoard({
  studentName = null,
  boardUpdate,
  sessionStatusMessage = null,
  exerciseAnswer,
  onExerciseAnswerChange,
  onSubmitBoardResponse,
  onGenerateAnotherQuestion,
  onEndSession,
}: WorkspaceClassBoardProps) {
  const visibleBoard = hasVisibleBoardContent(boardUpdate);
  const responseLabel =
    boardUpdate?.mode === "exam"
      ? "Tu examen"
      : boardUpdate?.mode === "task"
        ? "Tu respuesta"
        : "Tu respuesta";
  const responsePlaceholder =
    boardUpdate?.mode === "exam"
      ? "Escribe aquí tus respuestas antes de pedir la corrección"
      : boardUpdate?.mode === "task"
        ? "Escribe aquí cómo la resolverías"
        : "Escribe aquí tu respuesta";
  const canSubmitResponse = Boolean(
    boardUpdate?.exercise
    || boardUpdate?.task
    || boardUpdate?.exam,
  );

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto max-w-5xl">
          <h1 className="sr-only">{studentName ? `Hola, ${studentName.split(" ")[0]}` : "Hola"}</h1>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {boardUpdate?.subjectName ?? "Pizarra"}
          </div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {boardUpdate?.topic ?? "Clase activa"}
          </div>
          <div className="mt-3 text-sm text-slate-500">
            {studentName ? `${studentName.split(" ")[0]}, cuéntale al tutor qué quieres trabajar.` : "Escribe al tutor qué quieres trabajar."}
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

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            {!visibleBoard ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Escribe al tutor qué quieres trabajar.
              </div>
            ) : (
              <div className="space-y-6">
                {boardUpdate?.conceptDefinition ? (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Concepto</div>
                    <p className="mt-3 text-lg font-semibold leading-8 text-slate-950">{boardUpdate.conceptDefinition}</p>
                  </section>
                ) : null}

                {boardUpdate?.mode === "document_feedback" && boardUpdate.documentFeedback ? (
                  <section className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Resumen</div>
                      <p className="mt-3 text-base leading-8 text-slate-800">{boardUpdate.documentFeedback.summary}</p>
                    </div>
                    {boardUpdate.documentFeedback.detectedErrors.length > 0 ? (
                      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Errores detectados</div>
                        <div className="mt-3 space-y-2 text-sm leading-7 text-rose-950">
                          {boardUpdate.documentFeedback.detectedErrors.map((error, index) => (
                            <div key={`${error}-${index}`}>{index + 1}. {error}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {boardUpdate.documentFeedback.reviewTopics.length > 0 ? (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Qué repasar</div>
                        <div className="mt-3 space-y-2 text-sm leading-7 text-amber-950">
                          {boardUpdate.documentFeedback.reviewTopics.map((topic, index) => (
                            <div key={`${topic}-${index}`}>{index + 1}. {topic}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {boardUpdate?.explanation.length ? (
                  <section className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Explicación</div>
                    <div className="space-y-3">
                      {boardUpdate.explanation.map((line, index) => (
                        <p key={`${line}-${index}`} className="text-base leading-8 text-slate-800">
                          {line}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}

                {boardUpdate?.steps.length ? (
                  <section className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {boardUpdate.mode === "exam" ? "Preguntas" : "Pasos"}
                    </div>
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

                {boardUpdate?.diagram?.length ? (
                  <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Esquema</div>
                    <div className="mt-3 space-y-2 text-sm font-medium text-sky-950">
                      {boardUpdate.diagram.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {boardUpdate?.formula ? (
                  <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Regla</div>
                    <div className="mt-3 text-base font-semibold text-sky-950">{boardUpdate.formula}</div>
                  </section>
                ) : null}

                {boardUpdate?.example ? (
                  <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Ejemplo</div>
                    <p className="mt-3 text-base leading-8 text-amber-950">{boardUpdate.example}</p>
                  </section>
                ) : null}

                {boardUpdate?.task ? (
                  <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{boardUpdate.task.title}</div>
                    <p className="mt-3 text-base font-semibold leading-8 text-emerald-950">{boardUpdate.task.prompt}</p>
                    {boardUpdate.task.allowedSteps.length > 0 ? (
                      <div className="mt-4 space-y-2 text-sm text-emerald-900">
                        {boardUpdate.task.allowedSteps.map((step, index) => (
                          <div key={`${step}-${index}`}>Paso permitido {index + 1}: {step}</div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {boardUpdate?.exam ? (
                  <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">{boardUpdate.exam.title}</div>
                    <div className="mt-3 space-y-3 text-base leading-8 text-violet-950">
                      {boardUpdate.exam.questions.map((question, index) => (
                        <div key={`${question}-${index}`}>{question}</div>
                      ))}
                    </div>
                    {boardUpdate.exam.timeLimitMinutes ? (
                      <div className="mt-4 text-sm text-violet-900">Tiempo orientativo: {boardUpdate.exam.timeLimitMinutes} min</div>
                    ) : null}
                    {boardUpdate.exam.scoring ? (
                      <div className="mt-2 text-sm text-violet-900">{boardUpdate.exam.scoring}</div>
                    ) : null}
                  </section>
                ) : null}

                {boardUpdate?.exercise ? (
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
                  </section>
                ) : null}

                {canSubmitResponse ? (
                  <section className="space-y-3">
                    <label htmlFor="mentoria-board-answer" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {responseLabel}
                    </label>
                    <textarea
                      id="mentoria-board-answer"
                      value={exerciseAnswer}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onExerciseAnswerChange(event.target.value)}
                      placeholder={responsePlaceholder}
                      className="min-h-[140px] w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </section>
                ) : null}

                {boardUpdate?.correction ? (
                  <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Corrección</div>
                    <p className="mt-3 text-base leading-8 text-rose-950">{boardUpdate.correction}</p>
                  </section>
                ) : null}

                {boardUpdate?.note ? (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Nota del tutor</div>
                    <p className="mt-3 text-base leading-8 text-slate-800">{boardUpdate.note}</p>
                  </section>
                ) : null}

                {boardUpdate?.guidedQuestion ? (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pregunta guiada</div>
                    <p className="mt-3 text-base font-semibold leading-8 text-slate-950">{boardUpdate.guidedQuestion}</p>
                  </section>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-3">
              {canSubmitResponse ? (
                <button
                  type="button"
                  onClick={onSubmitBoardResponse}
                  className="rounded-2xl bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Corregir respuesta
                </button>
              ) : null}
              {visibleBoard ? (
                <button
                  type="button"
                  onClick={onGenerateAnotherQuestion}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Generar otra pregunta
                </button>
              ) : null}
              <button
                type="button"
                onClick={onEndSession}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-950 transition hover:bg-rose-100"
              >
                Terminar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
