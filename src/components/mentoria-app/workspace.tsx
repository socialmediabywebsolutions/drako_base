"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/mentoria-app/workspace-shell";
import { WorkspaceNav } from "@/components/mentoria-app/workspace-nav";
import { WorkspaceBoard } from "@/components/mentoria-app/workspace-board";
import { WorkspaceCopilot } from "@/components/mentoria-app/workspace-copilot";
import { getWorkspaceUiCopy } from "@/lib/mentoria/microcopy";
import { decideNextBestAction } from "@/lib/behavioral-engine/decision";
import { buildBehavioralExplanationFrame } from "@/lib/behavioral-engine/explanation";
import type { BehavioralContext, BehavioralShadowComparison, BehavioralTaskCandidate, NextBestAction as BehavioralNextBestAction } from "@/lib/behavioral-engine/contracts";
import { buildOrchestratorContext } from "@/lib/mentoria/state/orchestrator-policy";
import { buildGuardianViewModel } from "@/lib/mentoria/state/guardian-visibility-policy";
import { deriveStateActions } from "@/lib/mentoria/state/intervention-engine";
import { collectStudentSignals, evaluateStudentState } from "@/lib/mentoria/state/student-state-engine";
import {
  buildMentoriaSessionContract,
  buildMentoriaSessionModeOptions,
  resolveMentoriaSessionMode,
} from "@/lib/mentoria/session-modes";
import { buildWorkspaceOrchestratorPlan } from "@/lib/mentoria/workspace-orchestrator";
import type { GuardianViewModel, OrchestratorContext, StateActions, StateDecision } from "@/lib/mentoria/state/state-types";
import type { WorkspaceOrchestratorAction } from "@/lib/mentoria/workspace-orchestrator";
import type {
  DailyPlan,
  FocusSession,
  LearningSession,
  MentoriaExercise,
  MentoriaFamily,
  MentoriaDailyClosureSummary,
  MentoriaGuardian,
  MentoriaGuardianHookEvent,
  MentoriaGuardianStudentAccess,
  MentoriaGrowthSummary,
  MentoriaProgress,
  MentoriaSessionContract,
  MentoriaSessionInputKind,
  MentoriaSessionMode,
  MentoriaSessionModeOption,
  MentoriaStudentMemorySummary,
  MentoriaStudentSubject,
  MentoriaWorkspaceEntry,
  StudentProfile,
} from "@/lib/mentoria/types";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

type WorkspaceSection = "board" | "subjects" | "sessions" | "progress" | "planner" | "focus" | "exercises" | "memory";
type ReentryMode = "resume_session" | "gentle_restart" | "momentum_push" | "plan_task" | "entry";
type GuidedFeedbackStatus = "correct" | "almost" | "incorrect";
type GuidedResponseLevel = "short" | "superficial" | "explained" | "incorrect";
type GuidedSupportTone = "guided" | "direct" | "paced";
type GuidedSessionState = "idle" | "answering" | "checking" | "retry" | "completed";
type TutorResult = {
  reply: string;
  explanation: string;
  suggestedSteps: string[];
  reinforcementQuestion: string;
  subjectName?: string;
  subjectSlug?: string;
  topic?: string;
  progressMessage?: string;
  completionMessage?: string;
  encouragement?: string;
  nextSteps?: string[];
  recommendedNextStep?: string;
};

type TutorMessage = {
  role: "student" | "tutor";
  content: string;
  kind?: "message" | "explanation" | "steps" | "question" | "feedback";
};

type GuidedFeedback = {
  status: GuidedFeedbackStatus;
  level: GuidedResponseLevel;
  tone: GuidedSupportTone;
  message: string;
  rationale: string;
};

type WorkspaceNextAction = {
  kind: "guided_step" | "exercise" | "task" | "resume_session" | "subject_session" | "quick_action" | "focus_session";
  title: string;
  detail: string;
  ctaLabel: string;
  sessionState?: GuidedSessionState;
};

type WorkspaceState = {
  student: StudentProfile | null;
  family: MentoriaFamily | null;
  primaryGuardian: MentoriaGuardian | null;
  secondaryGuardians: MentoriaGuardian[];
  guardianStudentAccess: MentoriaGuardianStudentAccess[];
  studentSubjects: MentoriaStudentSubject[];
  progress: MentoriaProgress[];
  analysis: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] } | null;
  exercises: MentoriaExercise[];
  motivation: MotivationState | null;
  dailyPlan: DailyPlan | null;
  recentSessions: LearningSession[];
  focusSessions: FocusSession[];
  entry: MentoriaWorkspaceEntry | null;
  memory: MentoriaStudentMemorySummary | null;
  evolution: StudentEvolutionProfile | null;
  growth: MentoriaGrowthSummary | null;
  dailyClosure: MentoriaDailyClosureSummary | null;
  guardianHooks: MentoriaGuardianHookEvent[];
  behavioralRollout?: "shadow_only" | "engine_strategy" | "engine_strategy_and_explanation" | null;
  behavioralShadow?: BehavioralShadowComparison | null;
};

type WorkspaceApiResponse = WorkspaceState & {
  ok?: boolean;
  error?: string;
  student?: StudentProfile | null;
  family?: MentoriaFamily | null;
  primaryGuardian?: MentoriaGuardian | null;
  secondaryGuardians?: MentoriaGuardian[];
  guardianStudentAccess?: MentoriaGuardianStudentAccess[];
  studentSubjects?: MentoriaStudentSubject[];
  motivation?: MotivationState | null;
  dailyPlan?: DailyPlan | null;
  progress?: MentoriaProgress[];
  analysis?: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] };
  exercises?: MentoriaExercise[];
  recentSessions?: LearningSession[];
  focusSessions?: FocusSession[];
  entry?: MentoriaWorkspaceEntry | null;
  memory?: MentoriaStudentMemorySummary | null;
  evolution?: StudentEvolutionProfile | null;
  growth?: MentoriaGrowthSummary | null;
  dailyClosure?: MentoriaDailyClosureSummary | null;
  guardianHooks?: MentoriaGuardianHookEvent[];
  behavioralRollout?: "shadow_only" | "engine_strategy" | "engine_strategy_and_explanation" | null;
  behavioralShadow?: BehavioralShadowComparison | null;
};

type SessionApiResponse = {
  ok?: boolean;
  error?: string;
  reply?: string;
  explanation?: string;
  suggestedSteps?: string[];
  reinforcementQuestion?: string;
  sessionMode?: MentoriaSessionMode;
  sessionInputKind?: MentoriaSessionInputKind;
  subject?: { name?: string; slug?: string };
  session?: { id?: string; topic?: string; recommendedNextStep?: string };
  sessionFeedback?: {
    progressMessage?: string;
    scoreChange?: number;
    masteryLevel?: string;
    confidenceLevel?: string;
    nextSteps?: string[];
    encouragement?: string;
    completionMessage?: string;
  };
};

function normalizeGuidedTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-záéíóúñ0-9\s]/gi, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 3);
}

function normalizeBehavioralTaskType(type?: string | null): BehavioralTaskCandidate["type"] {
  if (type === "practice" || type === "review" || type === "challenge" || type === "other") return type;
  return "other";
}

function formatBehavioralTaskType(type?: string | null) {
  if (type === "practice") return "practica guiada";
  if (type === "review") return "repaso guiado";
  if (type === "challenge") return "reto corto";
  return type ?? "tarea";
}

function actionNeedsTask(action: BehavioralNextBestAction) {
  return action.strategy === "gentle_restart" || action.strategy === "momentum_push" || action.strategy === "plan_task";
}

function isValidBehavioralAction(action: BehavioralNextBestAction | null | undefined): action is BehavioralNextBestAction {
  if (!action) return false;
  if (!action.strategy || !action.title) return false;
  if (actionNeedsTask(action) && !action.task) return false;
  return true;
}

function evaluateGuidedResponse(step: string, answer: string): GuidedFeedback {
  const normalizedAnswer = answer.trim();
  if (!normalizedAnswer) {
    return {
      status: "incorrect",
      level: "short",
      tone: "guided",
      message: "Todavía no hay respuesta.",
      rationale: "Escribe una idea concreta para poder comprobar si va en la dirección correcta.",
    };
  }

  const stepTokens = Array.from(new Set(normalizeGuidedTokens(step)));
  const answerTokens = Array.from(new Set(normalizeGuidedTokens(normalizedAnswer)));
  const overlap = stepTokens.filter((token) => answerTokens.includes(token)).length;
  const overlapRatio = stepTokens.length > 0 ? overlap / stepTokens.length : 0;
  const isVeryShort = normalizedAnswer.length < 18 || answerTokens.length <= 2;
  const isWellExplained = normalizedAnswer.length >= 42 || answerTokens.length >= 7 || overlapRatio >= 0.6;

  if (normalizedAnswer.length >= 18 && (overlapRatio >= 0.35 || answerTokens.length >= 4)) {
    return {
      status: "correct",
      level: isWellExplained ? "explained" : "superficial",
      tone: isWellExplained ? "paced" : "direct",
      message: isWellExplained ? "Bien. Está claro." : "Bien, pero ve al grano.",
      rationale: isWellExplained
        ? "La idea principal está bien explicada. Avanzamos."
        : "La idea es correcta, aunque algo superficial. Ya puedes seguir.",
    };
  }

  if (normalizedAnswer.length >= 8 && (overlapRatio >= 0.15 || answerTokens.length >= 2)) {
    return {
      status: "almost",
      level: isVeryShort ? "short" : "superficial",
      tone: isVeryShort ? "guided" : "direct",
      message: isVeryShort ? "Vas bien, pero está muy corto." : "Vas bien, pero falta una parte clave.",
      rationale: isVeryShort
        ? "Amplía una idea más para que se entienda qué quieres decir."
        : "Se entiende la base, pero falta decir exactamente qué relación o punto principal cierra el paso.",
    };
  }

  return {
    status: "incorrect",
    level: "incorrect",
    tone: "guided",
    message: isVeryShort ? "Aún no. Está demasiado corto." : "Aún no. Rehaz este paso.",
    rationale: isVeryShort
      ? "Vuelve al paso y escribe qué idea principal te está pidiendo."
      : "La respuesta se sale del foco. Vuelve a la idea principal y exprésala de forma más simple.",
  };
}

export function MentoriaWorkspace() {
  const initialUi = getWorkspaceUiCopy("eso");
  const [state, setState] = useState<WorkspaceState>({
    student: null,
    family: null,
    primaryGuardian: null,
    secondaryGuardians: [],
    guardianStudentAccess: [],
    studentSubjects: [],
    progress: [],
    analysis: null,
    exercises: [],
    motivation: null,
    dailyPlan: null,
    recentSessions: [],
    focusSessions: [],
    entry: null,
    memory: null,
    evolution: null,
    growth: null,
    dailyClosure: null,
    guardianHooks: [],
    behavioralRollout: null,
    behavioralShadow: null,
  });

  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("board");
  const [subjectSlug, setSubjectSlug] = useState("");
  const [topic, setTopic] = useState(initialUi.defaultTopic);
  const [message, setMessage] = useState(initialUi.defaultMessage);
  const [tutorResult, setTutorResult] = useState<TutorResult | null>(null);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [exerciseAnswer, setExerciseAnswer] = useState("");
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [sessionStatusMessage, setSessionStatusMessage] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [guidedStepInput, setGuidedStepInput] = useState("");
  const [guidedFeedback, setGuidedFeedback] = useState<GuidedFeedback | null>(null);
  const [sessionState, setSessionState] = useState<GuidedSessionState>("idle");
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [stateDecision, setStateDecision] = useState<StateDecision | null>(null);
  const [stateActions, setStateActions] = useState<StateActions | null>(null);
  const [orchestratorContextStudent, setOrchestratorContextStudent] = useState<OrchestratorContext | null>(null);
  const [guardianViewModel, setGuardianViewModel] = useState<GuardianViewModel | null>(null);
  const [sessionModeOverride, setSessionModeOverride] = useState<MentoriaSessionMode | null>(null);
  const [sessionInputKindOverride, setSessionInputKindOverride] = useState<MentoriaSessionInputKind | null>(null);

  const selectedSubject = useMemo(
    () => state.studentSubjects.find((item: MentoriaStudentSubject) => item.subject?.slug === subjectSlug) ?? null,
    [state.studentSubjects, subjectSlug],
  );
  const billingState = searchParams.get("billing");
  const billingSessionId = searchParams.get("session_id");
  const connectedGuardians = useMemo(
    () => [state.primaryGuardian, ...state.secondaryGuardians].filter((item): item is MentoriaGuardian => Boolean(item)),
    [state.primaryGuardian, state.secondaryGuardians],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const workspaceRes = await fetch("/api/mentoria/workspace", { cache: "no-store" });
      if (!workspaceRes || typeof workspaceRes.json !== "function") {
        setError("MENTORIA_WORKSPACE_LOAD_FAILED");
        return;
      }
      if (workspaceRes.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app";
        return;
      }
      if (workspaceRes.status === 409) {
        window.location.href = "/mentoria/onboarding";
        return;
      }
      const workspaceBody = (await workspaceRes.json().catch(() => null)) as WorkspaceApiResponse | null;

      if (!workspaceRes.ok) {
        setError(workspaceBody?.error ?? "MENTORIA_WORKSPACE_LOAD_FAILED");
        return;
      }

      if (!workspaceBody?.student) {
        setError(workspaceBody?.error ?? "MENTORIA_WORKSPACE_INCOMPLETE");
        return;
      }

      const signals = await collectStudentSignals(workspaceBody.student.id);
      const nextStateDecision = evaluateStudentState(signals);
      const nextStateActions = deriveStateActions(nextStateDecision);
      const nextOrchestratorContextStudent = buildOrchestratorContext({
        decision: nextStateDecision,
        actions: nextStateActions,
        actorType: "student",
      });
      const nextGuardianViewModel = buildGuardianViewModel({
        decision: nextStateDecision,
        actions: nextStateActions,
      });

      setState({
        student: workspaceBody.student ?? null,
        family: workspaceBody.family ?? null,
        primaryGuardian: workspaceBody.primaryGuardian ?? null,
        secondaryGuardians: workspaceBody.secondaryGuardians ?? [],
        guardianStudentAccess: workspaceBody.guardianStudentAccess ?? [],
        studentSubjects: workspaceBody.studentSubjects ?? [],
        progress: workspaceBody.progress ?? [],
        analysis: workspaceBody.analysis ?? null,
        exercises: workspaceBody.exercises ?? [],
        motivation: workspaceBody.motivation ?? null,
        dailyPlan: workspaceBody.dailyPlan ?? null,
        recentSessions: workspaceBody.recentSessions ?? [],
        focusSessions: workspaceBody.focusSessions ?? [],
        entry: workspaceBody.entry ?? null,
        memory: workspaceBody.memory ?? null,
        evolution: workspaceBody.evolution ?? null,
        growth: workspaceBody.growth ?? null,
        dailyClosure: workspaceBody.dailyClosure ?? null,
        guardianHooks: workspaceBody.guardianHooks ?? [],
        behavioralRollout: workspaceBody.behavioralRollout ?? null,
        behavioralShadow: workspaceBody.behavioralShadow ?? null,
      });
      setStateDecision(nextStateDecision);
      setStateActions(nextStateActions);
      setOrchestratorContextStudent(nextOrchestratorContextStudent);
      setGuardianViewModel(nextGuardianViewModel);
      setActiveExerciseId(
        workspaceBody.exercises?.find((exercise) => exercise.status === "pending")?.id
          ?? activeExerciseId
          ?? workspaceBody.exercises?.[0]?.id
          ?? null,
      );
      if (!subjectSlug && workspaceBody.entry?.recommendedSubjectSlug) {
        setSubjectSlug(workspaceBody.entry.recommendedSubjectSlug);
      }
      if (workspaceBody.entry?.recommendedTopic && topic === initialUi.defaultTopic) {
        setTopic(workspaceBody.entry.recommendedTopic);
      }
      if (workspaceBody.entry?.recommendedPrompt && message === initialUi.defaultMessage) {
        setMessage(workspaceBody.entry.recommendedPrompt);
      }
      if ((workspaceBody.recentSessions?.length ?? 0) > 0) {
        const transcript = workspaceBody.recentSessions?.[0]?.transcript ?? [];
        if (transcript.length > 0) {
          setTutorMessages(
            transcript.map((item) => ({
              role: item.role,
              content: item.content,
              kind: "message" as const,
            })),
          );
        }
      }
      setCompletedTaskIds(workspaceBody.dailyPlan?.completedTaskIds ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "MENTORIA_WORKSPACE_LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (billingState !== "success" || !billingSessionId) return;
    void (async () => {
      await fetch("/api/mentoria/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: billingSessionId }),
      });
      void load();
      window.history.replaceState({}, "", "/mentoria/app");
    })();
  }, [billingSessionId, billingState]);

  function resolveSubjectSlugFromSubjectId(subjectId?: string) {
    if (!subjectId) return "";
    return state.studentSubjects.find((item: MentoriaStudentSubject) => item.subjectId === subjectId)?.subject?.slug ?? "";
  }

  const guidedSteps = useMemo(() => {
    if ((tutorResult?.suggestedSteps?.length ?? 0) > 0) return tutorResult?.suggestedSteps ?? [];
    if (tutorResult?.recommendedNextStep) return [tutorResult.recommendedNextStep];
    if (tutorResult?.reinforcementQuestion) return [tutorResult.reinforcementQuestion];
    return [];
  }, [tutorResult?.reinforcementQuestion, tutorResult?.recommendedNextStep, tutorResult?.suggestedSteps]);

  const activeGuidedStep = guidedSteps[activeStepIndex] ?? null;
  const sessionProgressPercent = guidedSteps.length > 0 ? Math.round(((Math.min(activeStepIndex, guidedSteps.length - 1) + (guidedFeedback?.status && guidedFeedback.status !== "incorrect" ? 1 : 0)) / guidedSteps.length) * 100) : 0;
  const derivedSessionState = useMemo<GuidedSessionState>(() => {
    if (guidedSteps.length === 0) return "idle";
    if (sessionState === "checking") return "checking";
    if (sessionState === "completed") return "completed";
    if (guidedFeedback?.status === "incorrect") return "retry";
    if (guidedStepInput.trim().length > 0) return "answering";
    return "idle";
  }, [guidedFeedback?.status, guidedStepInput, guidedSteps.length, sessionState]);

  const latestSession = state.recentSessions[0] ?? null;
  const latestExercise =
    state.exercises.find((ex: MentoriaExercise) => ex.id === activeExerciseId)
    ?? state.exercises.find((ex: MentoriaExercise) => ex.status === "pending")
    ?? null;
  const actionableDailyPlan = state.dailyPlan
    ? {
        ...state.dailyPlan,
        completedTaskIds: Array.from(new Set([...state.dailyPlan.completedTaskIds, ...completedTaskIds])),
        tasks: state.dailyPlan.tasks.map((task: DailyPlan["tasks"][number]) => ({
          ...task,
          completed: task.completed || completedTaskIds.includes(task.id),
        })),
      }
    : null;
  const activeDailyTask = (activeTaskId
    ? actionableDailyPlan?.tasks.find((task: DailyPlan["tasks"][number]) => task.id === activeTaskId && !task.completed)
    : null)
    ?? actionableDailyPlan?.tasks.find((task: DailyPlan["tasks"][number]) => !task.completed)
    ?? null;
  const activeSubjectSlugForUi = subjectSlug || tutorResult?.subjectSlug || state.entry?.recommendedSubjectSlug || null;
  const recentActivityLabel = useMemo(() => {
    const activityIso = latestSession?.updatedAt ?? state.motivation?.lastActivityAt ?? null;
    if (!activityIso) return null;
    const hours = (Date.now() - new Date(activityIso).getTime()) / (1000 * 60 * 60);
    if (hours >= 24 && hours < 48) return "ayer";
    if (hours < 24) return "hoy";
    return null;
  }, [latestSession?.updatedAt, state.motivation?.lastActivityAt]);

  function resetGuidedFlow() {
    setActiveStepIndex(0);
    setGuidedStepInput("");
    setGuidedFeedback(null);
    setSessionState("idle");
  }

  const resolvedSessionInputKind = useMemo<MentoriaSessionInputKind>(() => {
    if (sessionInputKindOverride) return sessionInputKindOverride;
    const normalizedSessionText = `${topic} ${message} ${tutorResult?.topic ?? ""}`.toLowerCase();
    if (normalizedSessionText.includes("examen") || normalizedSessionText.includes("control") || normalizedSessionText.includes("prueba")) {
      return "exam_photo";
    }
    if (activeDailyTask) return "family_routine";
    if (selectedSubject) return "selected_subject";
    if (latestSession?.recommendedNextStep) return "recent_session";
    if (state.entry?.recommendedPrompt) return "orchestrator_recommendation";
    return "free_message";
  }, [activeDailyTask, latestSession?.recommendedNextStep, message, selectedSubject, sessionInputKindOverride, state.entry?.recommendedPrompt, topic, tutorResult?.topic]);

  const sessionMode = useMemo<MentoriaSessionMode>(() => {
    if (sessionModeOverride) return sessionModeOverride;
    return resolveMentoriaSessionMode({
      student: state.student,
      entry: state.entry,
      dailyPlan: actionableDailyPlan,
      latestSession,
      selectedSubject,
      activeTask: activeDailyTask,
      currentTopic: topic,
      currentMessage: message,
      stateLabel: stateDecision?.state ?? null,
      suggestedInputKind: resolvedSessionInputKind,
      recentActivityLabel,
    });
  }, [actionableDailyPlan, activeDailyTask, latestSession, message, recentActivityLabel, resolvedSessionInputKind, selectedSubject, sessionModeOverride, state.entry, state.student, stateDecision?.state, topic]);

  const sessionContract = useMemo<MentoriaSessionContract>(
    () => buildMentoriaSessionContract(sessionMode, resolvedSessionInputKind),
    [resolvedSessionInputKind, sessionMode],
  );

  const sessionModeOptions = useMemo<MentoriaSessionModeOption[]>(
    () => buildMentoriaSessionModeOptions({
      student: state.student,
      entry: state.entry,
      dailyPlan: actionableDailyPlan,
      latestSession,
      selectedSubject,
      activeTask: activeDailyTask,
      currentTopic: topic,
      currentMessage: message,
      stateLabel: stateDecision?.state ?? null,
      suggestedInputKind: resolvedSessionInputKind,
      recentActivityLabel,
    }),
    [actionableDailyPlan, activeDailyTask, latestSession, message, recentActivityLabel, resolvedSessionInputKind, selectedSubject, state.entry, state.student, stateDecision?.state, topic],
  );

  async function handleSendMessage(
    input?:
      | string
      | {
          message?: string;
          subjectSlug?: string;
          topic?: string;
          entryMode?: ReentryMode;
          sessionId?: string;
          sessionMode?: MentoriaSessionMode;
          sessionInputKind?: MentoriaSessionInputKind;
        },
  ) {
    setError(null);
    const normalizedInput = typeof input === "string" ? { message: input } : input;
    const inferredTaskSubjectSlug = activeDailyTask?.subjectId ? resolveSubjectSlugFromSubjectId(activeDailyTask.subjectId) : undefined;
    const resolvedSubjectSlug = (normalizedInput?.subjectSlug ?? subjectSlug) || inferredTaskSubjectSlug || undefined;
    const resolvedTopic = (normalizedInput?.topic ?? topic) || latestSession?.topic || activeDailyTask?.subject || initialUi.defaultTopic;
    const resolvedMessage = normalizedInput?.message ?? message;
    if (resolvedSubjectSlug !== undefined) {
      setSubjectSlug(resolvedSubjectSlug);
    }
    if (normalizedInput?.sessionMode) {
      setSessionModeOverride(normalizedInput.sessionMode);
    }
    if (normalizedInput?.sessionInputKind) {
      setSessionInputKindOverride(normalizedInput.sessionInputKind);
    }
    setTopic(resolvedTopic);
    setMessage(resolvedMessage);
    setActiveSection("board");
    setTutorMessages((current: TutorMessage[]) => [
      ...current,
      { role: "student", content: resolvedMessage, kind: "message" },
    ]);

    let response: Response | null = null;
    try {
      response = await fetch("/api/mentoria/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectSlug: resolvedSubjectSlug,
          topic: resolvedTopic,
          message: resolvedMessage,
          entryMode: normalizedInput?.entryMode,
          sessionId: normalizedInput?.sessionId ?? latestSession?.id,
          sessionMode: normalizedInput?.sessionMode,
          sessionInputKind: normalizedInput?.sessionInputKind,
        }),
      });
    } catch {
      return;
    }

    if (!response || typeof response.json !== "function") {
      return;
    }

    let body: SessionApiResponse | null = null;
    try {
      body = (await response.json()) as SessionApiResponse;
    } catch {
      body = null;
    }

    if (!response.ok) {
      setError(body?.error ?? null);
      return;
    }

    if (body?.reply) {
      const nextTutorMessages: TutorMessage[] = [{ role: "tutor", content: body.reply ?? "", kind: "message" }];
      if (body.explanation) {
        nextTutorMessages.push({ role: "tutor", content: body.explanation, kind: "explanation" });
      }
      if ((body.suggestedSteps ?? []).length > 0) {
        nextTutorMessages.push({ role: "tutor", content: (body.suggestedSteps ?? []).join("\n"), kind: "steps" });
      }
      if (body.reinforcementQuestion) {
        nextTutorMessages.push({ role: "tutor", content: body.reinforcementQuestion, kind: "question" });
      }
      if (body.sessionFeedback?.completionMessage) {
        nextTutorMessages.push({ role: "tutor", content: body.sessionFeedback.completionMessage, kind: "feedback" });
      }
      if (body.sessionFeedback?.progressMessage) {
        nextTutorMessages.push({ role: "tutor", content: body.sessionFeedback.progressMessage, kind: "feedback" });
      }
      if (body.sessionFeedback?.encouragement) {
        nextTutorMessages.push({ role: "tutor", content: body.sessionFeedback.encouragement, kind: "feedback" });
      }
      setTutorResult({
        reply: body.reply ?? "",
        explanation: body.explanation ?? "",
        suggestedSteps: body.suggestedSteps ?? [],
        reinforcementQuestion: body.reinforcementQuestion ?? "",
        subjectName: body.subject?.name,
        subjectSlug: body.subject?.slug,
        topic: body.session?.topic ?? resolvedTopic,
        progressMessage: body.sessionFeedback?.progressMessage,
        completionMessage: body.sessionFeedback?.completionMessage,
        encouragement: body.sessionFeedback?.encouragement,
        nextSteps: body.sessionFeedback?.nextSteps,
        recommendedNextStep: body.session?.recommendedNextStep,
      });
      setSessionModeOverride(body.sessionMode ?? normalizedInput?.sessionMode ?? null);
      setSessionInputKindOverride(body.sessionInputKind ?? normalizedInput?.sessionInputKind ?? null);
      setTopic(body.session?.topic ?? resolvedTopic);
      setMessage(body.session?.recommendedNextStep ?? resolvedMessage);
      setTutorMessages((current: TutorMessage[]) => [...current, ...nextTutorMessages]);
      setSessionStatusMessage(null);
      resetGuidedFlow();
    }

    void load();
  }

  function handleGuidedStepSubmit() {
    if (!activeGuidedStep || !guidedStepInput.trim()) return;
    setSessionState("checking");
    const feedback = evaluateGuidedResponse(activeGuidedStep, guidedStepInput);
    const shouldAdvance = feedback.status !== "incorrect";
    const isLastStep = activeStepIndex >= guidedSteps.length - 1;
    const nextStepIndex = shouldAdvance && !isLastStep ? activeStepIndex + 1 : activeStepIndex;

    setGuidedFeedback(feedback);
    setTutorMessages((current: TutorMessage[]) => {
      const nextMessages: TutorMessage[] = [
        ...current,
        { role: "student", content: guidedStepInput, kind: "message" },
        { role: "tutor", content: feedback.message, kind: "feedback" },
        { role: "tutor", content: feedback.rationale, kind: "explanation" },
      ];

      if (shouldAdvance && !isLastStep && guidedSteps[nextStepIndex]) {
        nextMessages.push({ role: "tutor", content: `Siguiente paso: ${guidedSteps[nextStepIndex]}`, kind: "question" });
      }

      if (shouldAdvance && isLastStep) {
        nextMessages.push({ role: "tutor", content: "Has completado la secuencia principal de esta sesión.", kind: "feedback" });
      }

      return nextMessages;
    });

    if (shouldAdvance && !isLastStep) {
      setActiveStepIndex(nextStepIndex);
      setGuidedStepInput("");
      setSessionState("idle");
      setSessionStatusMessage(`Bien. Ahora toca el paso ${nextStepIndex + 1}.`);
      return;
    }

    if (shouldAdvance && isLastStep) {
      setGuidedStepInput("");
      setSessionState("completed");
      setSessionStatusMessage("Sesión completada. Ya sabes cuál es el siguiente movimiento.");
      if (activeTaskId) {
        setCompletedTaskIds((current: string[]) => (current.includes(activeTaskId) ? current : [...current, activeTaskId]));
      }
      return;
    }

    setSessionState("retry");
    setSessionStatusMessage("Todavía no. Ajusta tu respuesta y vuelve a intentarlo.");
  }

  async function handleSubmitExercise() {
    const latestExercise =
      state.exercises.find((ex: MentoriaExercise) => ex.id === activeExerciseId)
      ?? state.exercises.find((ex: MentoriaExercise) => ex.status === "pending")
      ?? null;
    if (!latestExercise) return;

    setError(null);
    let response: Response | null = null;
    try {
      response = await fetch("/api/mentoria/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "correct", exerciseId: latestExercise.id, studentAnswer: exerciseAnswer }),
      });
    } catch {
      return;
    }

    if (!response || typeof response.json !== "function") {
      return;
    }

    let body: { error?: string; exercise?: MentoriaExercise } | null = null;
    try {
      body = (await response.json()) as { error?: string; exercise?: MentoriaExercise };
    } catch {
      body = null;
    }

    if (!response.ok) {
      setError(body?.error ?? null);
      return;
    }

    setExerciseAnswer("");
    void load();
  }

  function buildTaskStarterCopy(task: DailyPlan["tasks"][number]) {
    if (task.type === "review") {
      return {
        topic: `Repaso de ${task.subject}`,
        message: `Quiero repasar ${task.subject} paso a paso y ver que debo vigilar hoy.`,
        status: `Tarea lista: ${task.subject} - ${formatBehavioralTaskType(task.type)}. Ya puedes avanzar desde el tutor.`,
      };
    }
    if (task.type === "challenge") {
      return {
        topic: `Reto de ${task.subject}`,
        message: `Quiero resolver un reto corto de ${task.subject} con una primera pista clara.`,
        status: `Reto listo: ${task.subject} - ${formatBehavioralTaskType(task.type)}. Ya puedes avanzar desde el tutor.`,
      };
    }
    return {
      topic: `Practica de ${task.subject}`,
      message: `Quiero practicar ${task.subject} con una guia corta y clara.`,
      status: `Practica lista para ${task.subject}. Cuando la completes, el plan se actualizara aqui mismo.`,
    };
  }

  async function handleStartDailyTask(
    task: DailyPlan["tasks"][number],
    statusMessageOverride?: string | null,
    entryModeOverride?: ReentryMode,
  ) {
    setActiveTaskId(task.id);
    resetGuidedFlow();
    const taskSubjectSlug = resolveSubjectSlugFromSubjectId(task.subjectId) || undefined;
    const starterCopy = buildTaskStarterCopy(task);
    if (taskSubjectSlug) {
      setSubjectSlug(taskSubjectSlug);
    }
    setTopic(starterCopy.topic);
    setMessage(starterCopy.message);
    setActiveSection("board");
    setSessionStatusMessage(statusMessageOverride ?? starterCopy.status);
    await handleSendMessage({
      message: starterCopy.message,
      subjectSlug: taskSubjectSlug,
      topic: starterCopy.topic,
      entryMode: entryModeOverride ?? "plan_task",
      sessionMode: "study_routine",
      sessionInputKind: "family_routine",
    });
  }

  async function handleStartSubjectSession(subject: MentoriaStudentSubject | MentoriaProgress) {
    const subjectName = subject.subject?.name ?? "esta materia";
    const slug = (subject.subject?.slug ?? resolveSubjectSlugFromSubjectId(subject.subjectId)) || undefined;
    setActiveTaskId(null);
    resetGuidedFlow();
    if (slug) {
      setSubjectSlug(slug);
    }
    setActiveSection("board");
    setSessionStatusMessage(`Vamos con ${subjectName} 👇`);
    await handleSendMessage({
      message: `Quiero avanzar en ${subjectName}`,
      topic: subjectName,
      subjectSlug: slug,
      entryMode: "entry",
      sessionMode: "subject_reinforcement",
      sessionInputKind: "selected_subject",
    });
  }

  function handleOpenExercise(exerciseId: string) {
    setActiveExerciseId(exerciseId);
    setActiveSection("board");
    setSessionStatusMessage("Vamos a seguir con este ejercicio 👇");
  }

  async function handleStartFocusSession() {
    resetGuidedFlow();
    const focusSubjectSlug = subjectSlug || state.entry?.recommendedSubjectSlug || undefined;
    if (focusSubjectSlug) {
      setSubjectSlug(focusSubjectSlug);
    }
    setActiveSection("board");
    setSessionStatusMessage(`Entrando en modo concentración${focusSubjectSlug ? ` para ${selectedSubject?.subject?.name ?? focusSubjectSlug}` : ""}...`);
    await handleSendMessage({
      message: "Quiero empezar una sesión de concentración",
      subjectSlug: focusSubjectSlug,
      topic: selectedSubject?.subject?.name ?? topic,
      entryMode: "entry",
      sessionMode: "study_routine",
      sessionInputKind: focusSubjectSlug ? "selected_subject" : "orchestrator_recommendation",
    });
  }

  async function handleResumeSession(session: LearningSession) {
    setTutorResult(null);
    setActiveTaskId(null);
    resetGuidedFlow();
    setActiveSection("board");
    setTutorMessages(
      session.transcript?.map((item) => ({
        role: item.role,
        content: item.content,
        kind: "message" as const,
      })) ?? [],
    );
    const resumeSubjectSlug = resolveSubjectSlugFromSubjectId(session.subjectId) || undefined;
    if (resumeSubjectSlug) {
      setSubjectSlug(resumeSubjectSlug);
    }
    if (session.topic) {
      setTopic(session.topic);
    }
    if (session.recommendedNextStep) {
      setMessage(session.recommendedNextStep);
    }
    if (session.recommendedNextStep) {
      await handleSendMessage({
        message: session.recommendedNextStep,
        topic: session.topic,
        subjectSlug: resumeSubjectSlug,
        entryMode: "resume_session",
        sessionId: session.id,
        sessionMode: stateDecision?.state === "disconnected" || stateDecision?.state === "overloaded" ? "soft_reentry" : "subject_reinforcement",
        sessionInputKind: "recent_session",
      });
    }
  }

  async function handleQuickAction(action: { topic: string; prompt: string; subjectSlug?: string | null; sessionMode?: MentoriaSessionMode; sessionInputKind?: MentoriaSessionInputKind }) {
    setTutorResult(null);
    setActiveTaskId(null);
    resetGuidedFlow();
    if (action.subjectSlug) {
      setSubjectSlug(action.subjectSlug);
    }
    await handleSendMessage({
      message: action.prompt,
      topic: action.topic,
      subjectSlug: action.subjectSlug ?? undefined,
      entryMode: "entry",
      sessionMode: action.sessionMode,
      sessionInputKind: action.sessionInputKind,
    });
  }

  function handleResumeDailyClosure(closure: MentoriaDailyClosureSummary) {
    const carryOverTopic = closure.carryOverTopic ?? state.entry?.recommendedTopic ?? initialUi.defaultTopic;
    const carryOverPrompt = closure.carryOverPrompt ?? state.entry?.recommendedPrompt ?? initialUi.defaultMessage;
    const carryOverSubjectSlug = resolveSubjectSlugFromSubjectId(closure.carryOverSubjectId ?? undefined)
      || state.entry?.recommendedSubjectSlug
      || undefined;
    setTutorResult(null);
    setActiveTaskId(null);
    resetGuidedFlow();
    if (carryOverSubjectSlug) {
      setSubjectSlug(carryOverSubjectSlug);
    }
    setTopic(carryOverTopic);
    setMessage(carryOverPrompt);
    setSessionModeOverride("soft_reentry");
    setSessionInputKindOverride("recent_session");
    setActiveSection("board");
    setSessionStatusMessage("Ayer te dejaste una pista clara y hoy puedes retomarla con ventaja, sin volver a pensar desde cero.");
  }

  async function handleSelectSessionMode(option: MentoriaSessionModeOption) {
    await handleQuickAction({
      topic: option.topic,
      prompt: option.prompt,
      subjectSlug: option.subjectSlug,
      sessionMode: option.mode,
      sessionInputKind: option.inputKind,
    });
  }

  const behavioralContext = useMemo<BehavioralContext>(() => {
    const normalizedCompletionRate = state.dailyPlan?.completionRate ?? 0;
    const completionRate = normalizedCompletionRate > 1 ? normalizedCompletionRate / 100 : normalizedCompletionRate;
    const lastActivityAt = state.motivation?.lastActivityAt ?? latestSession?.updatedAt ?? null;
    const hoursSinceActivity = lastActivityAt ? Math.max(0, (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60)) : null;
    const pendingTasks = (actionableDailyPlan?.tasks ?? [])
      .filter((task: DailyPlan["tasks"][number]) => !task.completed)
      .map((task: DailyPlan["tasks"][number]) => ({
        id: task.id,
        subject: task.subject,
        subjectId: task.subjectId,
        type: normalizeBehavioralTaskType(task.type),
        difficulty: task.difficulty,
        completed: task.completed,
      }));
    return {
      userState: {
        userId: state.student?.userId ?? "workspace_user",
        tenantId: state.student?.tenantId ?? "workspace_tenant",
        lifecycleStage: "returning",
        activeContext: activeSubjectSlugForUi,
      },
      signals: {
        lastActivityAt,
        hoursSinceActivity,
        streak: state.motivation?.streak ?? 0,
        motivationProfile: state.motivation?.motivationProfile ?? null,
        consistencyScore: null,
        progressionVelocity: null,
        frustrationLevel: null,
        dailyCompletionRate: Number.isFinite(completionRate) ? completionRate : 0,
        completedTasksCount: actionableDailyPlan?.completedTaskIds.length ?? 0,
        pendingTasksCount: pendingTasks.length,
        recentSessionId: latestSession?.id ?? null,
        recentSessionTopic: latestSession?.topic ?? null,
        recentSessionRecommendedNextStep: latestSession?.recommendedNextStep ?? null,
        pendingTasks,
        entryPromptAvailable: Boolean(state.entry?.recommendedPrompt),
        carryOverPromptAvailable: false,
      },
      product: "mentoria",
      surface: "workspace",
      nowIso: new Date().toISOString(),
      availableActions: {
        canResumeSession: Boolean(latestSession?.recommendedNextStep),
        canStartPendingTask: pendingTasks.length > 0,
        canUseEntryPrompt: Boolean(state.entry?.recommendedPrompt),
      },
    };
  }, [actionableDailyPlan?.completedTaskIds.length, actionableDailyPlan?.tasks, activeSubjectSlugForUi, latestSession?.id, latestSession?.recommendedNextStep, latestSession?.topic, latestSession?.updatedAt, state.dailyPlan?.completionRate, state.entry?.recommendedPrompt, state.motivation?.lastActivityAt, state.motivation?.motivationProfile, state.motivation?.streak, state.student?.tenantId, state.student?.userId]);
  const liveBehavioralAction = useMemo(() => decideNextBestAction(behavioralContext), [behavioralContext]);
  const selectedBehavioralAction = useMemo(() => {
    const rollout = state.behavioralRollout;
    const shadowAction = state.behavioralShadow?.shadowAction;
    if ((rollout === "engine_strategy" || rollout === "engine_strategy_and_explanation") && isValidBehavioralAction(shadowAction)) {
      return shadowAction;
    }
    return liveBehavioralAction;
  }, [liveBehavioralAction, state.behavioralRollout, state.behavioralShadow?.shadowAction]);
  const behavioralFrame = useMemo(
    () => buildBehavioralExplanationFrame(selectedBehavioralAction, behavioralContext),
    [behavioralContext, selectedBehavioralAction],
  );
  const shouldUseBehavioralReentry = useMemo(() => {
    if (state.behavioralRollout === "engine_strategy" || state.behavioralRollout === "engine_strategy_and_explanation") {
      return true;
    }
    return Boolean(state.motivation || latestSession);
  }, [latestSession, state.behavioralRollout, state.motivation]);
  const motivationMessage =
    stateActions?.primaryStudentAction
      ?? (stateDecision?.state === "demotivated" || stateDecision?.state === "recovering"
        ? "Hoy no hace falta hacer mucho: hace falta cerrar bien el siguiente paso."
        : stateDecision?.state === "overloaded" || stateDecision?.state === "at_risk"
          ? "Vamos a bajar el ruido y centrarnos en una sola prioridad."
          : state.motivation?.motivationProfile === "fragile"
      ? "Hoy es un buen día para empezar con algo pequeño y claro"
      : state.motivation?.motivationProfile === "high_performer"
        ? "Estás en racha, aprovecha el momento"
        : "Sigue con tu ritmo, vas bien");
  const nextAction = useMemo<WorkspaceNextAction | null>(() => {
    if (activeGuidedStep) {
      if (derivedSessionState === "completed") {
        return {
          kind: "guided_step",
          title: "Sesión guiada completada",
          detail: "Has terminado la secuencia principal.",
          ctaLabel: "Sesión completada",
          sessionState: "completed",
        };
      }

      return {
        kind: "guided_step",
        title: derivedSessionState === "retry"
          ? "Reformular este paso"
          : derivedSessionState === "checking"
            ? "Comprobando la respuesta"
            : derivedSessionState === "answering"
              ? "Terminar este paso"
              : "Responder este paso",
        detail: derivedSessionState === "retry"
          ? guidedFeedback?.level === "short"
            ? "Amplía tu respuesta antes de volver a comprobar."
            : guidedFeedback?.level === "incorrect"
              ? "Vuelve a la idea principal y reházalo más simple."
              : "Añade justo la parte que falta y vuelve a comprobar."
          : derivedSessionState === "checking"
            ? "Estamos revisando si este paso ya está claro."
          : derivedSessionState === "answering"
            ? "Cierra tu respuesta y después comprueba."
          : "Escribe una respuesta corta con la idea clave.",
        ctaLabel: derivedSessionState === "retry"
          ? "Reintentar este paso"
          : derivedSessionState === "checking"
            ? "Comprobando..."
            : "Comprobar y seguir",
        sessionState: derivedSessionState,
      };
    }

    if (latestExercise && latestExercise.status !== "corrected") {
      return {
        kind: "exercise",
        title: "Entregar el ejercicio actual",
        detail: "Ahora mismo lo importante es resolver este ejercicio para mantener el hilo de la sesión.",
        ctaLabel: "Corregir respuesta",
        sessionState: derivedSessionState,
      };
    }

    if (latestExercise?.status === "corrected" && typeof latestExercise.score === "number") {
      const nextPendingTask = actionableDailyPlan?.tasks.find((task: DailyPlan["tasks"][number]) => !task.completed) ?? null;
      const nextTaskLabel = nextPendingTask ? `${nextPendingTask.subject} - ${formatBehavioralTaskType(nextPendingTask.type)}` : "la siguiente tarea";
      if (latestExercise.score >= 80) {
        return {
          kind: "task",
          title: "Vamos a aprovechar que te ha salido bien",
          detail: `Siguiente accion: ${nextTaskLabel}`,
          ctaLabel: "Lanzar siguiente reto",
          sessionState: derivedSessionState,
        };
      }
      return {
        kind: "task",
        title: "Bajamos un paso para consolidar",
        detail: `Siguiente accion: ${nextTaskLabel}`,
        ctaLabel: "Abrir ayuda guiada",
        sessionState: derivedSessionState,
      };
    }

    if (shouldUseBehavioralReentry && selectedBehavioralAction.strategy === "resume_session" && latestSession) {
      return {
        kind: "resume_session",
        title: "Seguimos donde lo dejaste",
        detail: "Retoma el siguiente paso ya preparado en tu ultima sesion.",
        ctaLabel: behavioralFrame.primaryLabel,
        sessionState: derivedSessionState,
      };
    }

    if (
      shouldUseBehavioralReentry
      && (selectedBehavioralAction.strategy === "plan_task"
        || selectedBehavioralAction.strategy === "gentle_restart"
        || selectedBehavioralAction.strategy === "momentum_push")
      && selectedBehavioralAction.task
    ) {
      return {
        kind: "task",
        title: "Tu siguiente paso ya esta preparado.",
        detail: "Revisa la recomendacion y entra con un solo clic.",
        ctaLabel: "Abrir siguiente paso",
        sessionState: derivedSessionState,
      };
    }

    if (activeDailyTask) {
      return {
        kind: "task",
        title: "Empezar la tarea del día",
        detail: `Tu siguiente movimiento es abrir ${activeDailyTask.subject} y entrar en su sesión guiada.`,
        ctaLabel: shouldUseBehavioralReentry ? "Volver al plan de hoy" : "Preparar con el tutor",
        sessionState: derivedSessionState,
      };
    }

    if (latestSession) {
      return {
        kind: "resume_session",
        title: "Retomar la última sesión",
        detail: "Sigue desde donde lo dejaste para no perder continuidad ni contexto.",
        ctaLabel: "Retomar sesión",
        sessionState: derivedSessionState,
      };
    }

    if (selectedSubject) {
      return {
        kind: "subject_session",
        title: "Abrir sesión guiada de la materia activa",
        detail: "La materia ya está elegida. Solo falta abrir la sesión y empezar a trabajar.",
        ctaLabel: "Abrir sesión guiada",
        sessionState: derivedSessionState,
      };
    }

    if (state.entry?.recommendedPrompt && state.entry?.recommendedTopic) {
      return {
        kind: "quick_action",
        title: "Empezar por la recomendación principal",
        detail: "Esta es la entrada más clara para arrancar la sesión sin decidir entre varias opciones.",
        ctaLabel: state.entry.recommendedTopic,
        sessionState: derivedSessionState,
      };
    }

    if (state.focusSessions.length > 0) {
      return {
        kind: "focus_session",
        title: "Entrar en bloque de foco",
        detail: "Si no hay sesión activa, el siguiente paso más claro es abrir un bloque corto de concentración.",
        ctaLabel: "Empezar bloque de foco",
        sessionState: derivedSessionState,
      };
    }

    return null;
  }, [actionableDailyPlan?.tasks, activeDailyTask, activeGuidedStep, behavioralFrame.primaryLabel, behavioralFrame.title, behavioralFrame.whyToday, derivedSessionState, guidedFeedback?.level, latestExercise, latestSession, selectedBehavioralAction.strategy, selectedBehavioralAction.task, selectedSubject, shouldUseBehavioralReentry, state.entry, state.focusSessions.length]);

  const copilotPrimaryActionLabel = useMemo(() => {
    if (!nextAction) return null;
    if (nextAction.kind === "exercise") return "Corregir desde el chat";
    if (nextAction.kind === "task" && nextAction.title === "Tu siguiente paso ya esta preparado.") {
      return behavioralFrame.primaryLabel;
    }
    if (nextAction.kind === "task") return "Sigue con este paso";
    return nextAction.ctaLabel;
  }, [behavioralFrame.primaryLabel, nextAction]);

  const orchestratorPlan = useMemo(
    () => buildWorkspaceOrchestratorPlan({
      nextAction,
      primaryActionLabel: copilotPrimaryActionLabel,
      sessionState: derivedSessionState,
      selectedSubjectName: selectedSubject?.subject?.name ?? selectedSubject?.subject?.slug ?? null,
      activeSubjectSlug: activeSubjectSlugForUi,
      currentTopic: topic,
      currentMessage: message,
      activeGuidedStep,
      activeStepIndex,
      totalSteps: guidedSteps.length,
      sessionProgressPercent,
      guidedFeedback,
      tutorResult,
      entry: state.entry,
      activeDailyTask,
      latestExercise,
      latestSession,
      motivationMessage,
    }),
    [
      activeDailyTask,
      activeGuidedStep,
      activeStepIndex,
      activeSubjectSlugForUi,
      copilotPrimaryActionLabel,
      derivedSessionState,
      guidedFeedback,
      guidedSteps.length,
      latestExercise,
      latestSession,
      message,
      motivationMessage,
      nextAction,
      selectedSubject?.subject?.name,
      selectedSubject?.subject?.slug,
      sessionProgressPercent,
      state.entry,
      topic,
      tutorResult,
    ],
  );

  if (loading && !state.student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{initialUi.productBadge}</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">{initialUi.emptyWorkspaceTitle}</h1>
          <p className="mt-3 text-sm text-slate-600">{initialUi.loading}</p>
        </div>
      </div>
    );
  }

  if (!state.student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{initialUi.productBadge}</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">No pudimos preparar tu espacio</h1>
          <p className="mt-3 text-sm text-slate-600">
            {error ?? "Necesitamos recargar el estado del alumno para continuar con Mentoria."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Reintentar
            </button>
            <Link href="/mentoria/onboarding" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold">
              Volver al onboarding
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleRunNextAction() {
    if (!nextAction) return;

    if (nextAction.kind === "guided_step") {
      if (nextAction.sessionState === "checking" || nextAction.sessionState === "completed") return;
      handleGuidedStepSubmit();
      return;
    }

    if (nextAction.kind === "exercise") {
      void handleSubmitExercise();
      return;
    }

    if (nextAction.kind === "task") {
      const strategyTask = selectedBehavioralAction.task?.id
        ? actionableDailyPlan?.tasks.find((task) => task.id === selectedBehavioralAction.task?.id)
        : null;
      const resolvedTask = strategyTask ?? activeDailyTask;
      if (!resolvedTask) return;
      const momentumStatus = selectedBehavioralAction.strategy === "momentum_push"
        ? `Hoy vienes con ritmo: ${resolvedTask.subject} - ${formatBehavioralTaskType(resolvedTask.type)}. Vamos a aprovecharlo con una primera accion un poco mas ambiciosa.`
        : null;
      void handleStartDailyTask(resolvedTask, momentumStatus, selectedBehavioralAction.strategy);
      return;
    }

    if (nextAction.kind === "resume_session" && latestSession) {
      void handleResumeSession(latestSession);
      return;
    }

    if (nextAction.kind === "subject_session" && selectedSubject) {
      void handleStartSubjectSession(selectedSubject);
      return;
    }

    if (nextAction.kind === "quick_action" && state.entry) {
      void handleQuickAction({
        topic: state.entry.recommendedTopic,
        prompt: state.entry.recommendedPrompt,
        subjectSlug: state.entry.recommendedSubjectSlug,
      });
      return;
    }

    if (nextAction.kind === "focus_session") {
      void handleStartFocusSession();
    }
  }

  function handleRunOrchestratorAction(action: WorkspaceOrchestratorAction) {
    if (action.kind === "run_next") {
      void handleRunNextAction();
      return;
    }

    if (action.kind === "quick_action" && action.prompt) {
      void handleQuickAction({
        topic: action.topic ?? state.entry?.recommendedTopic ?? topic,
        prompt: action.prompt,
        subjectSlug: action.subjectSlug,
      });
      return;
    }

    if (action.kind === "send_message") {
      void handleSendMessage({
        message: action.prompt ?? action.label,
        topic: action.topic ?? topic,
        subjectSlug: action.subjectSlug ?? activeSubjectSlugForUi ?? undefined,
        entryMode: "entry",
      });
    }
  }

  return (
    <WorkspaceShell
      leftNav={
        <WorkspaceNav
          student={state.student}
          studentSubjects={state.studentSubjects}
          progress={state.progress}
          recentSessions={state.recentSessions}
          focusSessions={state.focusSessions}
          connectedGuardians={connectedGuardians}
          activeSection={activeSection}
          activeSubjectSlug={activeSubjectSlugForUi}
          onSectionChange={(section) => setActiveSection(section as WorkspaceSection)}
          onSubjectSelect={(slug) => {
            setActiveTaskId(null);
            setSubjectSlug(slug);
            setTutorResult(null);
            setSessionModeOverride("subject_reinforcement");
            setSessionInputKindOverride("selected_subject");
            setSessionStatusMessage(`Materia activa: ${state.studentSubjects.find((item: MentoriaStudentSubject) => item.subject?.slug === slug)?.subject?.name ?? slug}`);
            setActiveSection("board");
          }}
        />
      }
      centerBoard={
        <WorkspaceBoard
          activeSection={activeSection}
          student={state.student}
          studentSubjects={state.studentSubjects}
          progress={state.progress}
          dailyPlan={actionableDailyPlan}
          focusSessions={state.focusSessions}
          entry={state.entry}
          evolution={state.evolution}
          growth={state.growth}
          dailyClosure={state.dailyClosure}
          latestSession={latestSession}
          recentSessions={state.recentSessions}
          latestExercise={latestExercise}
          exercises={state.exercises}
          activeDailyTask={activeDailyTask}
          memory={state.memory}
          analysis={state.analysis}
          guardianHooks={state.guardianHooks}
          motivationMessage={motivationMessage}
          stateDecision={stateDecision}
          stateActions={stateActions}
          guardianViewModel={guardianViewModel}
          activeSubjectSlug={activeSubjectSlugForUi}
          selectedSubject={selectedSubject}
          currentTopic={topic}
          currentMessage={message}
          sessionContract={sessionContract}
          sessionModeOptions={sessionModeOptions}
          tutorResult={tutorResult}
          nextAction={nextAction}
          orchestratorPlan={orchestratorPlan}
          sessionState={derivedSessionState}
          activeGuidedStep={activeGuidedStep}
          activeStepIndex={activeStepIndex}
          totalSteps={guidedSteps.length}
          sessionProgressPercent={sessionProgressPercent}
          guidedStepInput={guidedStepInput}
          guidedFeedback={guidedFeedback}
          exerciseAnswer={exerciseAnswer}
          sessionStatusMessage={sessionStatusMessage}
          onGuidedStepInputChange={setGuidedStepInput}
          onSubmitGuidedStep={handleGuidedStepSubmit}
          onSubmitExercise={handleSubmitExercise}
          onExerciseAnswerChange={setExerciseAnswer}
          onStartDailyTask={handleStartDailyTask}
          onStartFocusSession={handleStartFocusSession}
          onStartSubjectSession={handleStartSubjectSession}
          onOpenExercise={handleOpenExercise}
          onSectionChange={(section) => setActiveSection(section as WorkspaceSection)}
          onResumeSession={handleResumeSession}
          onResumeDailyClosure={handleResumeDailyClosure}
          onQuickAction={handleQuickAction}
          onSelectSessionMode={handleSelectSessionMode}
          onRunNextAction={handleRunNextAction}
        />
      }
      rightCopilot={
        <WorkspaceCopilot
          entry={state.entry}
          dailyPlan={actionableDailyPlan}
          memory={state.memory}
          guardianHooks={state.guardianHooks}
          analysisNextActions={state.analysis?.nextActions ?? []}
          motivationMessage={motivationMessage}
          behavioralAction={selectedBehavioralAction}
          behavioralFrame={behavioralFrame}
          behavioralRollout={state.behavioralRollout ?? null}
          recentActivityLabel={recentActivityLabel}
          motivationStreak={state.motivation?.streak ?? null}
          latestSessionSummary={latestSession?.tutorSummary ?? null}
          stateDecision={stateDecision}
          stateActions={stateActions}
          orchestratorContext={orchestratorContextStudent}
          dynamicNextAction={nextAction}
          sessionState={derivedSessionState}
          student={state.student}
          activeSubjectSlug={activeSubjectSlugForUi}
          selectedSubjectName={selectedSubject?.subject?.name ?? selectedSubject?.subject?.slug ?? null}
          sessionContract={sessionContract}
          sessionModeOptions={sessionModeOptions}
          tutorMessages={tutorMessages}
          tutorResult={tutorResult}
          activeGuidedStep={activeGuidedStep}
          guidedFeedback={guidedFeedback}
          sessionProgressPercent={sessionProgressPercent}
          orchestratorPlan={orchestratorPlan}
          onSendMessage={handleSendMessage}
          onQuickAction={handleQuickAction}
          onSelectSessionMode={handleSelectSessionMode}
          onRunNextAction={handleRunNextAction}
          onRunOrchestratorAction={handleRunOrchestratorAction}
        />
      }
    />
  );
}
