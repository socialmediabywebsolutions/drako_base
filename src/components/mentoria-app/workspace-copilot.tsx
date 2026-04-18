"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { MentoriaWorkspaceEntry, DailyPlan, MentoriaStudentMemorySummary, MentoriaGuardianHookEvent, StudentProfile } from "@/lib/mentoria/types";

type WorkspaceCopilotProps = {
  entry: MentoriaWorkspaceEntry | null;
  dailyPlan: DailyPlan | null;
  memory: MentoriaStudentMemorySummary | null;
  guardianHooks: MentoriaGuardianHookEvent[];
  analysisNextActions: string[];
  motivationMessage: string | null;
  dynamicNextAction?: {
    kind: "guided_step" | "exercise" | "task" | "resume_session" | "subject_session" | "quick_action" | "focus_session";
    title: string;
    detail: string;
    ctaLabel: string;
    sessionState?: "idle" | "answering" | "checking" | "retry" | "completed";
  } | null;
  sessionState?: "idle" | "answering" | "checking" | "retry" | "completed";
  student?: StudentProfile | null;
  activeSubjectSlug?: string | null;
  selectedSubjectName?: string | null;
  tutorMessages?: Array<{ role: "student" | "tutor"; content: string; kind?: "message" | "explanation" | "steps" | "question" | "feedback" }>;
  tutorResult?: {
    topic?: string;
    reinforcementQuestion?: string;
    progressMessage?: string;
    recommendedNextStep?: string;
  } | null;
  activeGuidedStep?: string | null;
  guidedFeedback?: { status: "correct" | "almost" | "incorrect"; message: string; rationale: string } | null;
  sessionProgressPercent?: number;
  onSendMessage: (message: string) => void;
  onQuickAction: (action: { topic: string; prompt: string; subjectSlug?: string | null }) => void;
  onRunNextAction?: () => void;
};

export function WorkspaceCopilot({
  entry,
  dailyPlan,
  memory,
  guardianHooks,
  analysisNextActions,
  motivationMessage,
  dynamicNextAction = null,
  sessionState = "idle",
  student,
  activeSubjectSlug,
  selectedSubjectName,
  tutorMessages = [],
  tutorResult,
  activeGuidedStep = null,
  guidedFeedback = null,
  sessionProgressPercent = 0,
  onSendMessage,
  onQuickAction,
  onRunNextAction,
}: WorkspaceCopilotProps) {
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const currentTask = dailyPlan?.tasks.find((task) => !task.completed) ?? null;
  const memorySummary = memory?.watchouts[0] ?? memory?.commonMistakes[0] ?? null;
  const primaryHook = guardianHooks[0] ?? null;
  const primaryNextAction = dynamicNextAction?.title ?? tutorResult?.recommendedNextStep ?? analysisNextActions[0] ?? null;
  const stageLabel = student?.learningStage === "primary" ? "Primaria" : student?.learningStage === "bachillerato" ? "Bachillerato" : student?.learningStage === "eso" ? "ESO" : null;
  const sessionStateCopy = {
    idle: "Todavía estamos preparando la respuesta. Primero piensa la idea clave del paso.",
    answering: "Ya hay una base. Ahora conviene cerrar mejor la respuesta antes de comprobar.",
    checking: "Estoy revisando si la respuesta cubre la idea principal del paso.",
    retry: "No toca cambiar de tema: usa la explicación y vuelve a formular este mismo paso.",
    completed: "La secuencia principal está cerrada. Quédate con la idea final antes de abrir otro bloque.",
  } as const;

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [tutorMessages]);

  function splitMessageLines(content: string) {
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function handleSubmitMessage() {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput("");
  }

  return (
    <div className="flex h-full flex-col bg-slate-50/60">
      <header className="border-b border-slate-200/80 p-5">
        <h2 className="text-base font-semibold text-slate-800">Entrenador de sesión</h2>
        <p className="text-xs text-slate-500">No vuelve a explicar todo: reacciona a tu respuesta y te empuja al siguiente paso.</p>
      </header>

      <div className="border-b border-slate-200/80 p-4">
        {(stageLabel || activeSubjectSlug || tutorResult?.topic) && (
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Sesión actual
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              {tutorResult?.topic ? <div><span className="font-semibold text-slate-900">Tema:</span> {tutorResult.topic}</div> : null}
              {selectedSubjectName || activeSubjectSlug ? <div><span className="font-semibold text-slate-900">Materia:</span> {selectedSubjectName ?? activeSubjectSlug}</div> : null}
              {stageLabel ? <div><span className="font-semibold text-slate-900">Nivel:</span> {stageLabel}</div> : null}
              {activeGuidedStep ? <div><span className="font-semibold text-slate-900">Paso activo:</span> {activeGuidedStep}</div> : null}
            </div>
          </div>
        )}
      </div>

      <div ref={chatScrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {tutorMessages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500">
            Empieza una materia o una tarea y el chat irá siguiendo el hilo real de la sesión.
          </div>
        ) : (
          tutorMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded-3xl px-4 py-4 shadow-sm ${
                msg.role === "student"
                  ? "ml-8 border border-emerald-200 bg-emerald-50/95 text-slate-900"
                  : "mr-8 border border-slate-200 bg-white text-slate-900"
              }`}
            >
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {msg.role === "student"
                  ? "Tú"
                  : msg.kind === "question"
                    ? "Tutor · pregunta"
                    : msg.kind === "steps"
                      ? "Tutor · pasos"
                      : msg.kind === "feedback"
                        ? "Tutor · avance"
                        : msg.kind === "explanation"
                          ? "Tutor · explicación"
                          : "Tutor"}
              </div>
              {msg.kind === "steps" ? (
                <div className="space-y-2">
                  {splitMessageLines(msg.content).map((line, index) => (
                    <div key={`${line}-${index}`} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      {index + 1}. {line}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="whitespace-pre-line text-sm leading-7 text-slate-700">{msg.content}</div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-200/80 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Responder al entrenador</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setChatInput(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => event.key === "Enter" && handleSubmitMessage()}
            placeholder="Responde al paso o pide una pista corta..."
            className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <button
            type="button"
            onClick={handleSubmitMessage}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Enviar
          </button>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-200/80 p-4">
        {(primaryNextAction || currentTask || tutorResult?.progressMessage || activeGuidedStep) && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/75 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">Ahora mismo</div>
            <div className="space-y-2 text-sm text-slate-900">
              {currentTask ? <div><span className="font-semibold">Plan:</span> {currentTask.subject}</div> : null}
              <div><span className="font-semibold">Estado:</span> {sessionState}</div>
              {activeGuidedStep ? <div><span className="font-semibold">Paso:</span> {activeGuidedStep}</div> : null}
              {primaryNextAction ? <div><span className="font-semibold">Siguiente paso:</span> {primaryNextAction}</div> : null}
              {dynamicNextAction?.detail ? <div className="text-slate-700">{dynamicNextAction.detail}</div> : null}
              <div className="text-slate-700">{sessionStateCopy[sessionState]}</div>
              {tutorResult?.progressMessage ? <div className="text-slate-700">{tutorResult.progressMessage}</div> : null}
            </div>
            {dynamicNextAction ? (
              <button
                type="button"
                onClick={() => onRunNextAction?.()}
                className="mt-3 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                disabled={sessionState === "checking" || sessionState === "completed"}
              >
                {dynamicNextAction.ctaLabel}
              </button>
            ) : null}
          </div>
        )}

        {activeGuidedStep ? (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">Progreso</div>
              <div className="text-xs font-semibold text-slate-600">{sessionProgressPercent}%</div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${sessionProgressPercent}%` }} />
            </div>
            {guidedFeedback ? (
              <div className={`mt-3 rounded-lg px-3 py-3 ${guidedFeedback.status === "correct" ? "bg-emerald-50 text-emerald-800" : guidedFeedback.status === "almost" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}>
                <div className="text-xs font-semibold">
                  {guidedFeedback.status === "correct" ? "Correcto" : guidedFeedback.status === "almost" ? "Casi" : "Incorrecto"}
                </div>
                <div className="mt-2 text-xs leading-5">{guidedFeedback.rationale}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {entry && entry.quickActions.length > 0 && !dynamicNextAction && (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Atajos útiles
            </div>
            <div className="space-y-2">
              {entry.quickActions
                .filter((action) => !activeSubjectSlug || !action.subjectSlug || action.subjectSlug === activeSubjectSlug)
                .slice(0, 2)
                .map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() =>
                    onQuickAction({
                      topic: action.topic,
                      prompt: action.prompt,
                      subjectSlug: action.subjectSlug,
                    })
                  }
                  className="w-full rounded-lg bg-slate-50/90 px-3 py-2 text-left text-xs hover:bg-slate-100"
                >
                  <div className="font-semibold text-slate-900">{action.label}</div>
                  <div className="text-slate-600">{action.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {memorySummary && (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">Recuerda esto</div>
            <div className="text-sm text-slate-700">{memorySummary}</div>
          </div>
        )}

        {primaryHook && (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">Señal importante</div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-900">{primaryHook.title}</div>
                <div className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">{primaryHook.category}</div>
              </div>
              <div className="text-xs text-slate-600">{primaryHook.summary}</div>
            </div>
          </div>
        )}

        {motivationMessage && !primaryNextAction && !currentTask ? (
          <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-pink-50/80 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700">Motivación</div>
            <div className="text-sm leading-relaxed text-slate-900">{motivationMessage}</div>
          </div>
        ) : null}

        {!primaryNextAction && !currentTask && !memorySummary && !primaryHook && !motivationMessage && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
            <div className="mb-2 text-2xl">🤖</div>
            <div className="text-xs text-slate-500">
              Este panel solo aparece para reforzar la sesión cuando haga falta
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
