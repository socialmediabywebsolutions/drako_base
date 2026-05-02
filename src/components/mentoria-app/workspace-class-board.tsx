"use client";

import { PencilLine } from "lucide-react";
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

function phaseLabel(boardUpdate: MentoriaBoardUpdate | null) {
  if (!boardUpdate) return "Esperando";
  if (boardUpdate.classroomPhase === "correct") return "Corrijo";
  if (boardUpdate.classroomPhase === "evaluate") return "Evaluo";
  if (boardUpdate.classroomPhase === "ask") return "Pregunto";
  return "Explico";
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

function difficultyLabel(level?: number | null) {
  if (!level || level <= 1) return "Base";
  if (level === 2) return "Guiado";
  if (level === 3) return "Mixto";
  if (level === 4) return "Reto";
  return "Autonomo";
}

export function WorkspaceClassBoard({
  studentName = null,
  boardUpdate,
  sessionStatusMessage = null,
  exerciseAnswer: _exerciseAnswer,
  onExerciseAnswerChange: _onExerciseAnswerChange,
  onSubmitBoardResponse: _onSubmitBoardResponse,
  studentSubjects = [],
  onSubjectSelect,
}: WorkspaceClassBoardProps) {
  const visibleBoard = hasVisibleBoardContent(boardUpdate);
  const currentQuestion = activePrompt(boardUpdate);
  const learningState = boardUpdate?.learningState ?? null;
  const firstName = studentName?.split(" ")[0] ?? "Alumno";

  return (
    <div className="flex h-full flex-col bg-[#f8faf7] text-slate-950">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase text-emerald-700">{phaseLabel(boardUpdate)}</div>
            <h1 className="sr-only">{studentName ? `Hola, ${firstName}` : "Hola"}</h1>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{boardUpdate?.topic ?? "Clase privada"}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span>{boardUpdate?.subjectName ?? "Materia"}</span>
            {learningState ? (
              <>
                <span aria-hidden="true">/</span>
                <span>Paso {learningState.stepIndex + 1}</span>
                <span aria-hidden="true">/</span>
                <span>{difficultyLabel(learningState.difficultyLevel)}</span>
              </>
            ) : null}
          </div>
        </div>
        {studentSubjects.length > 0 && onSubjectSelect ? (
          <div className="mx-auto mt-3 flex max-w-6xl gap-2 overflow-x-auto pb-1">
            {studentSubjects.map((item) => {
              const slug = item.subject?.slug ?? "";
              const isActive = Boolean(slug) && slug === boardUpdate?.subjectSlug;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (slug) onSubjectSelect(slug);
                  }}
                  disabled={!slug}
                  className={`shrink-0 border px-3 py-2 text-xs font-bold transition ${
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                  }`}
                >
                  {item.subject?.name ?? "Materia"}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-6xl">
          <main className="space-y-6">
            {sessionStatusMessage ? (
              <div className="border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
                {sessionStatusMessage}
              </div>
            ) : null}

            {!visibleBoard ? (
              <section className="min-h-[420px] bg-white px-6 py-8 shadow-sm">
                <div className="text-sm font-bold uppercase text-slate-500">Profesor</div>
                <p className="mt-5 max-w-2xl text-3xl font-black leading-tight text-slate-950">
                  {firstName}, dime que no entiendes y empiezo la clase con un ejemplo.
                </p>
                <p className="sr-only">Escribe al tutor qué quieres trabajar.</p>
              </section>
            ) : (
              <>
                <section className="bg-white px-6 py-7 shadow-sm">
                  <div className="text-sm font-bold uppercase text-slate-500">Paso actual</div>
                  <p className="mt-4 text-3xl font-black leading-tight text-slate-950">
                    {boardUpdate?.conceptDefinition ?? boardUpdate?.explanation[0] ?? "Vamos paso a paso."}
                  </p>
                  {boardUpdate?.feedback ? (
                    <p className="mt-4 border-l-4 border-emerald-500 pl-4 text-base font-semibold leading-7 text-emerald-950">
                      {boardUpdate.feedback}
                    </p>
                  ) : null}
                </section>

                <section className="space-y-5">
                  <div className="bg-white px-6 py-6 shadow-sm">
                    <div className="text-sm font-bold uppercase text-slate-500">Explicacion visual</div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {(boardUpdate?.exam?.questions.length
                        ? boardUpdate.exam.questions
                        : boardUpdate?.steps.length
                          ? boardUpdate.steps
                          : boardUpdate?.explanation ?? []
                      ).slice(0, 4).map((step, index) => (
                        <div key={`${step}-${index}`} className="grid grid-cols-[36px_minmax(0,1fr)] gap-4">
                          <div className="flex h-9 w-9 items-center justify-center bg-slate-950 text-sm font-black text-white">
                            {index + 1}
                          </div>
                          <p className="min-w-0 pt-1 text-lg font-semibold leading-7 text-slate-800">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#fff7df] px-5 py-6 shadow-sm">
                    <div className="text-sm font-bold uppercase text-amber-800">Ejemplo</div>
                    <p className="mt-4 text-base font-semibold leading-7 text-amber-950">
                      {boardUpdate?.example ?? boardUpdate?.formula ?? boardUpdate?.diagram?.[0] ?? "Mira el orden: idea, ejemplo, respuesta."}
                    </p>
                    {learningState ? (
                      <div className="mt-5 space-y-1 text-sm font-semibold text-amber-950">
                        <div>Dominio {learningState.masteryScore}%</div>
                        <div>Frustracion {learningState.frustrationLevel}</div>
                      </div>
                    ) : null}
                  </div>
                </section>

                {boardUpdate?.exam ? (
                  <section className="bg-violet-50 px-6 py-6 shadow-sm">
                    <div className="text-sm font-bold uppercase text-violet-800">{boardUpdate.exam.title}</div>
                    {boardUpdate.exam.scoring ? (
                      <p className="mt-3 text-sm font-semibold text-violet-950">{boardUpdate.exam.scoring}</p>
                    ) : null}
                  </section>
                ) : null}

                {boardUpdate?.task ? (
                  <section className="bg-emerald-50 px-6 py-6 shadow-sm">
                    <div className="text-sm font-bold uppercase text-emerald-800">{boardUpdate.task.title}</div>
                    <p className="mt-4 text-lg font-semibold leading-8 text-emerald-950">{boardUpdate.task.prompt}</p>
                  </section>
                ) : null}

                {boardUpdate?.correction ? (
                  <section className="bg-rose-50 px-6 py-6 shadow-sm">
                    <div className="text-sm font-bold uppercase text-rose-700">Correccion inmediata</div>
                    <p className="mt-4 text-lg font-semibold leading-8 text-rose-950">{boardUpdate.correction}</p>
                  </section>
                ) : null}

                <section className="bg-sky-50 px-6 py-6 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase text-sky-800">
                    <PencilLine className="h-4 w-4" aria-hidden="true" />
                    Pregunta activa
                  </div>
                  <p className="mt-4 text-2xl font-black leading-tight text-sky-950">
                    {currentQuestion ?? "Responde al tutor para seguir."}
                  </p>
                  <p className="mt-4 text-sm font-semibold leading-6 text-sky-900">
                    Responde en el chat de clase para que el profesor corrija y actualice esta pizarra.
                  </p>
                </section>

                {boardUpdate?.nextAction ? (
                  <section className="bg-white px-6 py-5 shadow-sm">
                    <div className="text-sm font-bold uppercase text-slate-500">Siguiente paso</div>
                    <p className="mt-3 text-lg font-bold leading-7 text-slate-900">{boardUpdate.nextAction}</p>
                  </section>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
