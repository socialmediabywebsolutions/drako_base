"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { SendHorizontal } from "lucide-react";
import type { BehavioralExplanationFrame } from "@/lib/behavioral-engine/explanation";
import type { NextBestAction as BehavioralNextBestAction } from "@/lib/behavioral-engine/contracts";
import type {
  DailyPlan,
  MentoriaSessionContract,
  MentoriaSessionMode,
  MentoriaSessionModeOption,
  MentoriaStudentMemorySummary,
  MentoriaGuardianHookEvent,
  MentoriaWorkspaceEntry,
  StudentProfile,
} from "@/lib/mentoria/types";
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
  sessionSignalSummary?: string | null;
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

type TutorChatMessage = {
  role: "student" | "tutor";
  content: string;
  kind?: "message" | "explanation" | "steps" | "question" | "feedback";
};

function splitMessageLines(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function tutorIntentLabel(kind?: TutorChatMessage["kind"]) {
  if (kind === "feedback") return "Evaluo";
  if (kind === "question") return "Pregunto";
  if (kind === "explanation" || kind === "steps") return "Explico";
  return "Profesor";
}

export function WorkspaceCopilot({
  entry,
  dailyPlan,
  behavioralAction = null,
  latestSessionSummary = null,
  activeSubjectSlug = null,
  selectedSubjectName = null,
  tutorMessages = [],
  tutorResult = null,
  onSendMessage,
}: WorkspaceCopilotProps) {
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const currentTask = activeSubjectSlug ? dailyPlan?.tasks.find((task) => !task.completed) ?? null : null;

  const starterMessages = useMemo<TutorChatMessage[]>(() => {
    const messages: TutorChatMessage[] = [];
    if (behavioralAction?.strategy === "resume_session" && latestSessionSummary) {
      messages.push({ role: "tutor", content: "Mira la pizarra y responde el siguiente paso. Retomamos donde lo dejaste.", kind: "question" });
      messages.push({ role: "tutor", content: latestSessionSummary, kind: "message" });
    } else if (selectedSubjectName) {
      messages.push({ role: "tutor", content: `Estamos en ${selectedSubjectName}. Dime que no entiendes y lo convierto en ejemplo, pregunta y correccion.`, kind: "question" });
    } else {
      messages.push({ role: "tutor", content: "Elige una materia y empezamos una clase real: explico en la pizarra y tu respondes.", kind: "question" });
    }

    if (tutorResult?.recommendedNextStep) {
      messages.push({ role: "tutor", content: `Siguiente accion: ${tutorResult.recommendedNextStep}.`, kind: "question" });
    } else if (currentTask) {
      messages.push({ role: "tutor", content: `Mira la pizarra: empezamos por ${currentTask.subject} con un ejemplo facil y una respuesta corta.`, kind: "question" });
    } else if (selectedSubjectName) {
      messages.push({ role: "tutor", content: `Primera accion: escribe una duda concreta de ${selectedSubjectName}.`, kind: "question" });
    } else if (entry?.headline) {
      messages.push({ role: "tutor", content: "Cuando elijas una materia, te ayudo a ordenar la duda paso a paso.", kind: "question" });
    }

    return messages.slice(0, 2);
  }, [
    activeSubjectSlug,
    behavioralAction,
    currentTask,
    entry?.headline,
    latestSessionSummary,
    selectedSubjectName,
    tutorResult?.recommendedNextStep,
  ]);

  const visibleMessages = tutorMessages.length > 0 ? tutorMessages : starterMessages;

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [visibleMessages]);

  function handleSubmitMessage() {
    const trimmedMessage = chatInput.trim();
    if (!trimmedMessage) return;
    onSendMessage(trimmedMessage);
    setChatInput("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    handleSubmitMessage();
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-xs font-bold uppercase text-emerald-700">Profesor</div>
        <div className="mt-1 text-xl font-black text-slate-950">Chat de clase</div>
        <div className="sr-only">
          <Link href="/mentoria/app/academic">Vida académica</Link>
          <Link href="/mentoria/app/progress">Mi progreso</Link>
        </div>
      </div>

      <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-3 py-4">
        {visibleMessages.map((message, index) => (
          <div
            key={`${message.role}-${index}-${message.content}`}
            className={`max-w-[88%] px-4 py-3 shadow-sm ${
              message.role === "student"
                ? "ml-auto bg-emerald-600 text-white"
                : "mr-auto border border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className={`mb-1 text-[11px] font-semibold ${message.role === "student" ? "text-emerald-100" : "text-slate-400"}`}>
              {message.role === "student" ? "Alumno" : tutorIntentLabel(message.kind)}
            </div>
            {message.kind === "steps" ? (
              <div className="space-y-2">
                {splitMessageLines(message.content).map((line, lineIndex) => (
                  <div
                    key={`${line}-${lineIndex}`}
                    className={`px-3 py-2 text-sm leading-6 ${
                      message.role === "student" ? "bg-emerald-500/60 text-white" : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    {lineIndex + 1}. {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`whitespace-pre-line text-sm leading-6 ${message.role === "student" ? "text-white" : "text-slate-700"}`}>
                {message.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 bg-white px-3 py-3">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="mentoria-tutor-input" className="sr-only">
              Escribe tu duda o cuéntame qué no entendiste
            </label>
            <textarea
              id="mentoria-tutor-input"
              value={chatInput}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setChatInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu duda o cuéntame qué no entendiste"
              className="min-h-[96px] w-full resize-none border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmitMessage}
            className="inline-flex h-12 shrink-0 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-black"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
