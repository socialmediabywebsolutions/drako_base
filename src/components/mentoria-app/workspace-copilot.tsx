"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { BehavioralExplanationFrame } from "@/lib/behavioral-engine/explanation";
import type { NextBestAction as BehavioralNextBestAction } from "@/lib/behavioral-engine/contracts";
import type { MentoriaWorkspaceEntry, DailyPlan, MentoriaSessionContract, MentoriaSessionMode, MentoriaSessionModeOption, MentoriaStudentMemorySummary, MentoriaGuardianHookEvent, StudentProfile } from "@/lib/mentoria/types";
import type { OrchestratorContext, StateActions, StateDecision } from "@/lib/mentoria/state/state-types";
import type { WorkspaceOrchestratorAction, WorkspaceOrchestratorPlan } from "@/lib/mentoria/workspace-orchestrator";

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
  sessionContract: MentoriaSessionContract;
  sessionModeOptions?: MentoriaSessionModeOption[];
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
  orchestratorPlan?: WorkspaceOrchestratorPlan | null;
  onSendMessage: (message: string) => void;
  onQuickAction: (action: { topic: string; prompt: string; subjectSlug?: string | null; sessionMode?: MentoriaSessionMode; sessionInputKind?: MentoriaSessionModeOption["inputKind"] }) => void;
  onSelectSessionMode?: (option: MentoriaSessionModeOption) => void;
  onRunNextAction?: () => void;
  onRunOrchestratorAction?: (action: WorkspaceOrchestratorAction) => void;
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
  sessionContract,
  sessionModeOptions = [],
  tutorMessages = [],
  tutorResult,
  activeGuidedStep = null,
  guidedFeedback = null,
  sessionProgressPercent = 0,
  orchestratorPlan = null,
  onSendMessage,
  onQuickAction,
  onSelectSessionMode,
  onRunNextAction,
  onRunOrchestratorAction,
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
  const resolvedPrimaryNextAction = orchestratorPlan?.nextStep ?? primaryNextAction;
  const resolvedCompactActionLabel = orchestratorPlan?.primaryAction.label ?? compactActionLabel;
  const resolvedOrchestratorPrimaryCopy = orchestratorPlan?.message ?? orchestratorPrimaryCopy;
  const modeBadgeTone = sessionContract.mode === "task_resolution"
    ? "bg-amber-100 text-amber-900"
    : sessionContract.mode === "exam_preparation"
      ? "bg-rose-100 text-rose-900"
      : sessionContract.mode === "subject_reinforcement"
        ? "bg-emerald-100 text-emerald-900"
        : sessionContract.mode === "study_routine"
          ? "bg-sky-100 text-sky-900"
          : "bg-violet-100 text-violet-900";

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

  function handleOrchestratorAction(action: WorkspaceOrchestratorAction) {
    if (onRunOrchestratorAction) {
      onRunOrchestratorAction(action);
      return;
    }

    if (action.kind === "run_next") {
      onRunNextAction?.();
      return;
    }

    if (action.kind === "quick_action" && action.prompt && action.topic) {
      onQuickAction({
        topic: action.topic,
        prompt: action.prompt,
        subjectSlug: action.subjectSlug,
      });
      return;
    }

    if (action.kind === "send_message") {
      onSendMessage(action.prompt ?? action.label);
    }
  }

  const showNowPanel = Boolean(orchestratorPlan || resolvedPrimaryNextAction || currentTask || tutorResult?.progressMessage || activeGuidedStep);
  const showQuickActionsPanel = Boolean(entry && entry.quickActions.length > 0 && !dynamicNextAction);
  const showSecondaryContext = Boolean(activeGuidedStep || guidedFeedback || memorySummary || primaryHook || motivationMessage || showQuickActionsPanel);
  const compactSecondaryActions = orchestratorPlan?.secondaryActions.slice(0, 2) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="border-b border-slate-200 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Chat orquestador</div>
        <h2 className="mt-1 text-base font-semibold text-slate-900">El tutor dirige la sesión</h2>
        <p className="mt-1 text-xs text-slate-500">{orchestratorPlan?.intentLabel ?? resolvedStateUi?.subheader ?? "Aquí decides, preguntas o sigues la siguiente indicación."}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
          <span className={`rounded-full px-2.5 py-1 ${modeBadgeTone}`}>{sessionContract.label}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{sessionContract.entryLabel}</span>
        </div>
        {(stageLabel || selectedSubjectName || activeSubjectSlug || tutorResult?.topic) ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
            {selectedSubjectName || activeSubjectSlug ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{selectedSubjectName ?? activeSubjectSlug}</span> : null}
            {tutorResult?.topic ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{tutorResult.topic}</span> : null}
            {stageLabel ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{stageLabel}</span> : null}
          </div>
        ) : null}
      </header>

      {showNowPanel ? (
        <section className={`border-b border-slate-200 p-4 ${resolvedStateUi?.panel ?? "bg-emerald-50/70"}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            <span>{orchestratorPlan?.stageLabel ?? "Ahora mismo"}</span>
            {orchestratorPlan?.progressLabel ? <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-700">{orchestratorPlan.progressLabel}</span> : null}
            {orchestratorContext ? <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-700">{visibleTone}</span> : null}
            {orchestratorContext ? <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-700">{visibleIntensity}</span> : null}
          </div>
          {!isBehavioralReentry ? <div className="text-sm font-semibold text-slate-900">{resolvedOrchestratorPrimaryCopy}</div> : null}
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
          {orchestratorPlan?.microObjective ? (
            <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-900">
              Siguiente foco: <span className="font-semibold">{orchestratorPlan.microObjective}</span>
            </div>
          ) : null}
          <div className="mt-3 text-sm font-semibold text-slate-900">Ahora toca: {resolvedPrimaryNextAction ?? resolvedCompactActionLabel}</div>
          {orchestratorPlan?.boardFocus ? <div className="mt-1 text-xs leading-5 text-slate-700">En la pizarra: {orchestratorPlan.boardFocus}</div> : null}
          {orchestratorPlan?.primaryAction ? (
            <button
              type="button"
              onClick={() => handleOrchestratorAction(orchestratorPlan.primaryAction)}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              disabled={sessionState === "checking"}
            >
              {orchestratorPlan.primaryAction.label}
            </button>
          ) : dynamicNextAction && dynamicNextAction.kind !== "exercise" ? (
            <button
              type="button"
              onClick={() => onRunNextAction?.()}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              disabled={sessionState === "checking"}
            >
              {resolvedCompactActionLabel}
            </button>
          ) : null}
          {compactSecondaryActions.length ? (
            <div className="mt-3 grid gap-2">
              {compactSecondaryActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleOrchestratorAction(action)}
                  className="rounded-lg border border-white/80 bg-white/75 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-white"
                >
                  <span className="block text-slate-900">{action.label}</span>
                  <span className="mt-1 block font-normal leading-5 text-slate-600">{action.description}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
        {tutorMessages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            {orchestratorPlan?.message ?? "Empieza una materia o una tarea y el chat irá siguiendo el hilo real de la sesión."}
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

      <div className="border-t border-slate-200 bg-white p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Habla con el tutor</div>
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
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Enviar
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">Pregunta, responde o pide una pista corta. La pizarra ejecuta el trabajo.</div>
        {showSecondaryContext ? (
          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">Ver apoyo extra</summary>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Modo de esta sesión</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{sessionContract.headline}</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">{sessionContract.chatBehavior}</div>
              </div>

              {activeGuidedStep ? (
                <div className="rounded-lg bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Paso activo</div>
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

              {showQuickActionsPanel && entry ? (
                <div className="rounded-lg bg-white p-3">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Atajos útiles</div>
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
                            sessionMode: sessionContract.mode,
                            sessionInputKind: action.subjectSlug ? "selected_subject" : sessionContract.entryKind,
                          })
                        }
                        className="w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100"
                      >
                        <div className="font-semibold text-slate-900">{action.label}</div>
                        <div className="text-slate-600">{action.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {sessionModeOptions.length > 0 ? (
                <div className="rounded-lg bg-white p-3">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Cambiar modo de sesión</div>
                  <div className="space-y-2">
                    {sessionModeOptions.slice(0, 3).map((option) => (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={() => onSelectSessionMode?.(option)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${option.mode === sessionContract.mode ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="mt-1 leading-5">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {memorySummary ? (
                <div className="rounded-lg bg-white p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">Recuerda esto</div>
                  <div className="text-sm text-slate-700">{memorySummary}</div>
                </div>
              ) : null}

              {primaryHook ? (
                <div className="rounded-lg bg-white p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">Señal importante</div>
                  <div className="text-xs font-semibold text-slate-900">{primaryHook.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{primaryHook.summary}</div>
                </div>
              ) : null}

              {motivationMessage && !primaryNextAction && !currentTask ? (
                <div className="rounded-lg bg-white p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">Motivación</div>
                  <div className="text-sm leading-relaxed text-slate-900">{motivationMessage}</div>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
