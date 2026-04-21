"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { BehavioralExplanationFrame } from "@/lib/behavioral-engine/explanation";
import type { NextBestAction as BehavioralNextBestAction } from "@/lib/behavioral-engine/contracts";
import type { MentoriaWorkspaceEntry, DailyPlan, MentoriaStudentMemorySummary, MentoriaGuardianHookEvent, StudentProfile } from "@/lib/mentoria/types";
import type { OrchestratorContext, StateActions, StateDecision } from "@/lib/mentoria/state/state-types";

type WorkspaceCopilotProps = {
  entry: MentoriaWorkspaceEntry | null;
  dailyPlan: DailyPlan | null;
  memory: MentoriaStudentMemorySummary | null;
  guardianHooks: MentoriaGuardianHookEvent[];
  analysisNextActions: string[];
  motivationMessage: string | null;
  behavioralAction?: BehavioralNextBestAction | null;
  behavioralFrame?: BehavioralExplanationFrame | null;
  behavioralRollout?: "shadow_only" | "engine_strategy" | "engine_strategy_and_explanation" | null;
  recentActivityLabel?: string | null;
  motivationStreak?: number | null;
  latestSessionSummary?: string | null;
  stateDecision?: StateDecision | null;
  stateActions?: StateActions | null;
  orchestratorContext?: OrchestratorContext | null;
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
  guidedFeedback?: { status: "correct" | "almost" | "incorrect"; level: "short" | "superficial" | "explained" | "incorrect"; tone: "guided" | "direct" | "paced"; message: string; rationale: string } | null;
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
  behavioralAction = null,
  behavioralFrame = null,
  behavioralRollout = null,
  recentActivityLabel = null,
  motivationStreak = null,
  latestSessionSummary = null,
  stateDecision = null,
  stateActions = null,
  orchestratorContext = null,
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
  const completedTaskCount = dailyPlan?.tasks.filter((task) => task.completed).length ?? 0;
  const dailyCompletionPercent = Number.isFinite(dailyPlan?.completionRate)
    ? Math.round(dailyPlan?.completionRate ?? 0)
    : 0;
  const taskTypeLabelMap: Record<string, string> = {
    practice: "practica guiada",
    review: "repaso guiado",
    challenge: "reto corto",
  };
  const normalizedCurrentTaskType = currentTask?.type
    ? (taskTypeLabelMap[currentTask.type] ?? currentTask.type.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    : null;
  const memorySummary = memory?.watchouts[0] ?? memory?.commonMistakes[0] ?? null;
  const primaryHook = guardianHooks[0] ?? null;
  const isBehavioralReentry = behavioralAction
    ? behavioralAction.strategy === "resume_session"
      || behavioralAction.strategy === "gentle_restart"
      || behavioralAction.strategy === "momentum_push"
      || behavioralAction.strategy === "plan_task"
    : false;
  const behavioralDescription = behavioralRollout === "engine_strategy_and_explanation" && behavioralAction?.strategy === "plan_task"
    ? `La siguiente tarea util es ${behavioralAction.task?.subject ?? "tu siguiente tarea"} - ${behavioralAction.task?.type ?? "task"}.`
    : behavioralFrame?.description ?? null;
  const behavioralExpectedOutcome = behavioralRollout === "engine_strategy_and_explanation" && behavioralAction?.strategy === "plan_task"
    ? "Si haces clic, entraras directamente en la siguiente tarea natural del plan."
    : behavioralFrame?.expectedOutcome ?? null;
  const primaryNextAction = dynamicNextAction?.title ?? tutorResult?.recommendedNextStep ?? analysisNextActions[0] ?? null;
  const stageLabel = student?.learningStage === "primary" ? "Primaria" : student?.learningStage === "bachillerato" ? "Bachillerato" : student?.learningStage === "eso" ? "ESO" : null;
  const stateUi = {
    focused: {
      header: "Acompañamiento ligero",
      subheader: "Mantengo el contexto corto y te dejo avanzar.",
      panel: "border-emerald-200 bg-emerald-50/70",
    },
    progressing: {
      header: "Refuerzo de avance",
      subheader: "Te marco el siguiente cierre útil sin meter presión.",
      panel: "border-emerald-200 bg-emerald-50/70",
    },
    demotivated: {
      header: "Guía clara y corta",
      subheader: "Bajamos fricción y vamos a una meta pequeña.",
      panel: "border-sky-200 bg-sky-50/80",
    },
    overloaded: {
      header: "Contención de carga",
      subheader: "Te doy una sola prioridad para reducir saturación.",
      panel: "border-amber-200 bg-amber-50/80",
    },
    inconsistent: {
      header: "Reactivar continuidad",
      subheader: "No hace falta hacerlo perfecto; hace falta sostener el ritmo.",
      panel: "border-sky-200 bg-sky-50/80",
    },
    disconnected: {
      header: "Reentrada guiada",
      subheader: "La idea es volver fácil, no exigir demasiado hoy.",
      panel: "border-violet-200 bg-violet-50/80",
    },
    at_risk: {
      header: "Intervención breve",
      subheader: "Voy a ser más directo y reducir el ruido al mínimo.",
      panel: "border-rose-200 bg-rose-50/80",
    },
    recovering: {
      header: "Recuperando ritmo",
      subheader: "Protejo el avance y evito añadir carga extra.",
      panel: "border-cyan-200 bg-cyan-50/80",
    },
  } as const;
  const resolvedStateUi = stateDecision ? stateUi[stateDecision.state] : null;
  const sessionStateCopy = {
    idle: "Contexto: toca responder el paso activo con una idea clara.",
    answering: "Contexto: ya has empezado; ahora ciérralo mejor.",
    checking: "Contexto: estoy comprobando tu respuesta.",
    retry: "Contexto: toca rehacer este mismo paso.",
    completed: "Contexto: este bloque principal ya está hecho.",
  } as const;
  const compactActionLabel = dynamicNextAction
    ? dynamicNextAction.kind === "task"
      ? (isBehavioralReentry && behavioralFrame?.primaryLabel ? behavioralFrame.primaryLabel : "Sigue con este paso")
      : dynamicNextAction.ctaLabel
    : (sessionState === "completed" ? "Sesión completada" : "Sigue con este paso");
  const adaptiveSessionContext = guidedFeedback?.level === "short"
    ? "Contexto: la respuesta apunta bien, pero toca ampliarla un poco."
    : guidedFeedback?.level === "superficial"
      ? "Contexto: vas bien; falta justo la parte clave."
      : guidedFeedback?.tone === "paced"
        ? "Contexto: está bien resuelto; seguimos con ritmo."
        : guidedFeedback?.level === "incorrect"
          ? "Contexto: aún no está claro; vuelve a la idea principal."
          : sessionStateCopy[sessionState];
  const orchestratorPrimaryCopy = orchestratorContext?.messageGoal
    ? `Objetivo: ${orchestratorContext.messageGoal}.`
    : adaptiveSessionContext;
  const visibleTone = orchestratorContext?.tone === "light"
    ? "Ligero"
    : orchestratorContext?.tone === "motivating"
      ? "Motivador"
      : orchestratorContext?.tone === "calm"
        ? "Calmo"
        : orchestratorContext?.tone === "firm"
          ? "Directo"
          : "De apoyo";
  const visibleIntensity = orchestratorContext?.intensity === "high"
    ? "Alta guía"
    : orchestratorContext?.intensity === "medium"
      ? "Guía media"
      : "Guía ligera";
  const adaptivePlaceholder = stateDecision?.state === "focused" || stateDecision?.state === "progressing"
    ? "Escribe una duda concreta o responde al paso activo..."
    : stateDecision?.state === "overloaded" || stateDecision?.state === "at_risk"
      ? "Escribe solo la idea principal o pide una pista corta..."
      : "Responde al paso o pide una pista corta...";

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
        <p className="text-xs text-slate-500">{resolvedStateUi?.subheader ?? "Contexto corto, acción clara."}</p>
      </header>

      <div className="border-b border-slate-200/80 p-4">
        {(resolvedStateUi || orchestratorContext || stateActions) && (
          <div className={`mb-4 rounded-xl border p-4 ${resolvedStateUi?.panel ?? "border-slate-200 bg-white/80"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
              <span>{resolvedStateUi?.header ?? "Acompañamiento"}</span>
              {stateDecision ? <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-700">{stateDecision.state}</span> : null}
              {orchestratorContext ? <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-700">{visibleTone}</span> : null}
              {orchestratorContext ? <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-700">{visibleIntensity}</span> : null}
            </div>
            <div className="text-sm text-slate-900">{orchestratorPrimaryCopy}</div>
            {stateActions?.primaryStudentAction ? <div className="mt-2 text-sm font-semibold text-slate-900">Siguiente foco: {stateActions.primaryStudentAction}</div> : null}
          </div>
        )}
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
            placeholder={adaptivePlaceholder}
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
          <div className={`rounded-xl border p-4 ${resolvedStateUi?.panel ?? "border-emerald-100 bg-emerald-50/75"}`}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">Ahora mismo</div>
            {!isBehavioralReentry ? <div className="text-sm text-slate-900">{orchestratorPrimaryCopy}</div> : null}
            {isBehavioralReentry && behavioralFrame ? (
              <div className="mt-2 space-y-1 text-sm text-slate-900">
                <div>{behavioralFrame.title}</div>
                {behavioralAction?.strategy === "resume_session" ? <div>Seguimos donde lo dejaste</div> : null}
                {behavioralAction?.strategy === "resume_session" && latestSessionSummary ? <div>{latestSessionSummary}</div> : null}
                {behavioralAction?.strategy === "resume_session" && recentActivityLabel ? <div>Ultima actividad: {recentActivityLabel}</div> : null}
                {behavioralAction?.strategy === "resume_session" && typeof motivationStreak === "number" ? <div>Racha actual: {motivationStreak} dias</div> : null}
                {behavioralFrame.modeBadge ? <div>{behavioralFrame.modeBadge}</div> : null}
                {behavioralDescription ? <div>{behavioralDescription}</div> : null}
                {behavioralAction?.strategy === "plan_task" && currentTask ? (
                  <>
                    <div>Tu plan de hoy sigue esperandote con {currentTask.subject}.</div>
                    <div>Llevas {completedTaskCount} tareas cerradas y la siguiente es {currentTask.subject} - {normalizedCurrentTaskType ?? currentTask.type}.</div>
                    <div>{behavioralFrame.whyToday}</div>
                    <div>{behavioralExpectedOutcome ?? "Si haces clic, entraras directamente en la siguiente tarea util del plan de hoy."}</div>
                  </>
                ) : null}
                {behavioralAction?.strategy !== "plan_task" && behavioralFrame.whyToday ? <div>{behavioralFrame.whyToday}</div> : null}
                {behavioralAction?.strategy !== "plan_task" && behavioralExpectedOutcome ? <div>{behavioralExpectedOutcome}</div> : null}
              </div>
            ) : null}
            <div className="mt-2 text-sm font-semibold text-slate-900">Acción: {primaryNextAction ?? compactActionLabel}</div>
            {dynamicNextAction && dynamicNextAction.kind !== "exercise" ? (
              <button
                type="button"
                onClick={() => onRunNextAction?.()}
                className="mt-3 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                disabled={sessionState === "checking"}
              >
                {compactActionLabel}
              </button>
            ) : null}
          </div>
        )}

        {activeGuidedStep ? (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">Paso activo</div>
            <div className="mt-2 text-sm text-slate-900">{activeGuidedStep}</div>
            {guidedFeedback ? (
              <div className={`mt-3 rounded-lg px-3 py-3 ${guidedFeedback.status === "correct" ? "bg-emerald-50 text-emerald-800" : guidedFeedback.status === "almost" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}>
                <div className="text-xs font-semibold">
                  {guidedFeedback.status === "correct" ? "Correcto" : guidedFeedback.status === "almost" ? "Casi" : "Incorrecto"}
                </div>
                <div className="mt-1 text-xs leading-5">{guidedFeedback.rationale}</div>
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
