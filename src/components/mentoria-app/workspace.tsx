"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/mentoria-app/workspace-shell";
import { WorkspaceNav } from "@/components/mentoria-app/workspace-nav";
import { WorkspaceBoard } from "@/components/mentoria-app/workspace-board";
import { WorkspaceCopilot } from "@/components/mentoria-app/workspace-copilot";
import {
  buildBoardUpdateFromExercise,
  buildBoardUpdateFromLearningSession,
  buildEmptyBoardUpdate,
} from "@/lib/mentoria/board-update";
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
  MentoriaBoardUpdate,
  MentoriaClassroomIntent,
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
  MentoriaStudentSessionSignal,
  MentoriaStudentMemorySummary,
  MentoriaStudentSubjectMemory,
  MentoriaStudentSubject,
  MentoriaWorkspaceEntry,
  StudentProfile,
} from "@/lib/mentoria/types";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { buildDynamicStudentProfile } from "@/lib/mentoria/student-profile";
import type { StudentLearningMemory } from "@/lib/mentoria/student-learning-memory";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

type WorkspaceSection = "board" | "subjects" | "sessions" | "progress" | "planner" | "focus" | "exercises" | "memory";
type ReentryMode = "resume_session" | "gentle_restart" | "momentum_push" | "plan_task" | "entry";
type GuidedFeedbackStatus = "correct" | "almost" | "incorrect";
type GuidedResponseLevel = "short" | "superficial" | "explained" | "incorrect";
type GuidedSupportTone = "guided" | "direct" | "paced";
type GuidedSessionState = "idle" | "answering" | "checking" | "retry" | "completed";
const DEFAULT_SESSION_SIGNAL: MentoriaStudentSessionSignal = {
  priority: "reinforcement",
  emotion: "steady",
  helpType: "step_by_step",
  entry: "reinforcement",
};

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
  learningMemory: StudentLearningMemory | null;
  subjectMemories: MentoriaStudentSubjectMemory[];
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
  learningMemory?: StudentLearningMemory | null;
  subjectMemories?: MentoriaStudentSubjectMemory[];
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
  tutorMessage?: string;
  chatMessage?: string;
  reply?: string;
  intent?: MentoriaClassroomIntent;
  provider?: string;
  model?: string;
  subjectSlug?: string;
  topic?: string;
  mode?: string;
  steps?: string[];
  example?: string | null;
  exercise?: { prompt: string; answerFormat?: string | null; hints?: string[] } | null;
  nextAction?: string;
  boardUpdate?: MentoriaBoardUpdate | null;
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

function formatTutorApiError(errorCode?: string | null) {
  if (errorCode === "AI_BINDING_MISSING") {
    return "Tutor IA no disponible. Falta el binding AI de Cloudflare Workers AI en este entorno.";
  }
  if (errorCode === "AI_PROVIDER_UNAVAILABLE") {
    return "Workers AI no puede responder ahora mismo por cuota, trial o billing del proveedor. Revisa Cloudflare.";
  }
  if (errorCode === "MENTORIA_AI_NOT_AVAILABLE") {
    return "Tutor IA no disponible. Revisa el binding de Cloudflare Workers AI en el entorno de desarrollo.";
  }
  if (errorCode === "MENTORIA_AI_PROVIDER_ERROR") {
    return "Tutor IA ha fallado al hablar con Workers AI. Revisa proveedor, gateway y logs.";
  }
  if (errorCode === "MENTORIA_AI_TIMEOUT") {
    return "Tutor IA agotó el tiempo de respuesta. Revisa latencia y logs del proveedor.";
  }
  if (errorCode === "MENTORIA_AI_EMPTY_RESPONSE") {
    return "Tutor IA devolvió una respuesta vacía. Revisa el modelo y el parser de salida.";
  }
  if (errorCode === "SUBJECT_CONTEXT_MISMATCH") {
    return "La respuesta recibida no coincide con la materia activa.";
  }
  if (errorCode === "SUBJECT_REQUIRED") {
    return "Elige una materia para que el tutor y la pizarra trabajen sobre la misma base.";
  }
  if (errorCode === "trial_expired") {
    return "El acceso del aula está bloqueado porque el trial de Mentoría ha expirado.";
  }
  if (errorCode === "usage_limit_reached") {
    return "El aula ha alcanzado el límite diario permitido para este plan.";
  }
  return errorCode ?? "MENTORIA_CHAT_FAILED";
}

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

function buildSessionSignalSummary(signal: MentoriaStudentSessionSignal, subjectName?: string | null) {
  const priority = signal.priority === "exam"
    ? "preparar un examen"
    : signal.priority === "homework"
      ? "resolver una tarea concreta"
      : signal.priority === "organization"
        ? "ordenar el bloque de estudio"
        : signal.priority === "free_question"
          ? "abrir una duda libre"
          : `reforzar ${subjectName ?? "la materia"}`;
  const emotion = signal.emotion === "blocked"
    ? "vienes bloqueado"
    : signal.emotion === "tired"
      ? "vienes con poca energia"
      : signal.emotion === "motivated"
        ? "vienes con ganas"
        : "vienes estable";
  const help = signal.helpType === "explain_from_zero"
    ? "explicacion desde cero"
    : signal.helpType === "guided_practice"
      ? "practica guiada"
      : signal.helpType === "quick_check"
        ? "comprobacion rapida"
        : "paso a paso";
  return `Hoy toca ${priority}, ${emotion} y te conviene ${help}.`;
}

function resolveSessionModeFromSignal(signal: MentoriaStudentSessionSignal): MentoriaSessionMode {
  if (signal.emotion === "blocked" || signal.emotion === "tired") return "soft_reentry";
  if (signal.priority === "exam" || signal.entry === "exam") return "exam_preparation";
  if (signal.priority === "homework" || signal.entry === "homework") return "task_resolution";
  if (signal.priority === "organization" || signal.entry === "study_block") return "study_routine";
  return "subject_reinforcement";
}

function resolveSessionInputKindFromSignal(signal: MentoriaStudentSessionSignal, hasSubject: boolean): MentoriaSessionInputKind {
  if (signal.priority === "exam" || signal.entry === "exam") return "exam_photo";
  if (signal.priority === "organization" || signal.entry === "study_block") return "family_routine";
  if (signal.priority === "homework" || signal.entry === "homework") return hasSubject ? "selected_subject" : "task_photo";
  if (hasSubject && signal.entry !== "question") return "selected_subject";
  return "student_state_signal";
}

function buildSessionLaunchFromSignal(signal: MentoriaStudentSessionSignal, subjectName?: string | null) {
  const resolvedSubject = subjectName ?? "la materia";
  const emotionMessage = signal.emotion === "blocked"
    ? "Hoy vengo bloqueado y necesito una entrada muy facil."
    : signal.emotion === "tired"
      ? "Hoy vengo cansado y necesito bajar friccion para arrancar."
      : signal.emotion === "motivated"
        ? "Hoy vengo con ganas y puedo sostener un poco mas de ritmo."
        : "Hoy vengo normal y quiero entrar con claridad.";
  const helpMessage = signal.helpType === "explain_from_zero"
    ? "Explicamelo desde cero y con ejemplos claros."
    : signal.helpType === "guided_practice"
      ? "Quiero practicar conmigo, no solo que me lo expliques."
      : signal.helpType === "quick_check"
        ? "Hazme una comprobacion corta y directa."
        : "Llevalo paso a paso y sin saltos.";

  if (signal.priority === "exam") {
    return {
      topic: `Examen de ${resolvedSubject}`,
      prompt: `Quiero preparar un examen de ${resolvedSubject}. ${emotionMessage} ${helpMessage}`,
    };
  }
  if (signal.priority === "homework") {
    return {
      topic: `Tarea de ${resolvedSubject}`,
      prompt: `Quiero resolver una tarea de ${resolvedSubject}. ${emotionMessage} ${helpMessage}`,
    };
  }
  if (signal.priority === "organization") {
    return {
      topic: `Bloque de estudio de ${resolvedSubject}`,
      prompt: `Quiero organizar mi bloque de estudio de ${resolvedSubject}. ${emotionMessage} ${helpMessage}`,
    };
  }
  if (signal.priority === "free_question") {
    return {
      topic: `Duda en ${resolvedSubject}`,
      prompt: `Tengo una duda concreta sobre ${resolvedSubject}. ${emotionMessage} ${helpMessage}`,
    };
  }
  return {
    topic: `Refuerzo de ${resolvedSubject}`,
    prompt: `Quiero reforzar ${resolvedSubject}. ${emotionMessage} ${helpMessage}`,
  };
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
    learningMemory: null,
    subjectMemories: [],
    evolution: null,
    growth: null,
    dailyClosure: null,
    guardianHooks: [],
    behavioralRollout: null,
    behavioralShadow: null,
  });

  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get("studentId")?.trim() || null;
  const selectedSubjectParam = searchParams.get("subjectSlug")?.trim() || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("board");
  const [subjectSlug, setSubjectSlug] = useState(selectedSubjectParam);
  const [topic, setTopic] = useState(initialUi.defaultTopic);
  const [message, setMessage] = useState(initialUi.defaultMessage);
  const [tutorResult, setTutorResult] = useState<TutorResult | null>(null);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [boardHistoryByScope, setBoardHistoryByScope] = useState<Record<string, MentoriaBoardUpdate[]>>({});
  const boardHistoryByScopeRef = useRef<Record<string, MentoriaBoardUpdate[]>>({});
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
  const [sessionSignal, setSessionSignal] = useState<MentoriaStudentSessionSignal>(DEFAULT_SESSION_SIGNAL);
  const activeSubjectSlugRef = useRef<string | null>(selectedSubjectParam || null);
  const workspaceLoadRequestRef = useRef(0);

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

  useEffect(() => {
    activeSubjectSlugRef.current = subjectSlug.trim() ? subjectSlug : null;
  }, [subjectSlug]);

  function buildStudentScopedUrl(path: string, options?: { subjectSlug?: string | null }) {
    const target = new URL(path, window.location.origin);
    if (selectedStudentId) {
      target.searchParams.set("studentId", selectedStudentId);
    }
    if (options?.subjectSlug) {
      target.searchParams.set("subjectSlug", options.subjectSlug);
    }
    return `${target.pathname}${target.search}`;
  }

  async function load(requestedSubjectSlug?: string | null) {
    const normalizedSubjectSlug = requestedSubjectSlug?.trim() || null;
    const requestId = workspaceLoadRequestRef.current + 1;
    workspaceLoadRequestRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const workspaceRes = await fetch(
        buildStudentScopedUrl("/api/mentoria/workspace", { subjectSlug: normalizedSubjectSlug }),
        { cache: "no-store" },
      );
      if (!workspaceRes || typeof workspaceRes.json !== "function") {
        if (workspaceLoadRequestRef.current === requestId) {
          setError("MENTORIA_WORKSPACE_LOAD_FAILED");
        }
        return;
      }
      if (workspaceRes.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app";
        return;
      }
      if (workspaceRes.status === 409 && normalizedSubjectSlug === null) {
        window.location.href = "/mentoria/onboarding";
        return;
      }
      const workspaceBody = (await workspaceRes.json().catch(() => null)) as WorkspaceApiResponse | null;

      if (workspaceLoadRequestRef.current !== requestId) {
        return;
      }
      if (normalizedSubjectSlug !== null && activeSubjectSlugRef.current !== normalizedSubjectSlug) {
        return;
      }

      if (!workspaceRes.ok) {
        setError(workspaceBody?.error ?? "MENTORIA_WORKSPACE_LOAD_FAILED");
        return;
      }

      if (!workspaceBody?.student) {
        setError(workspaceBody?.error ?? "MENTORIA_WORKSPACE_INCOMPLETE");
        return;
      }

      const signals = await collectStudentSignals(workspaceBody.student.id);
      if (workspaceLoadRequestRef.current !== requestId) {
        return;
      }
      if (normalizedSubjectSlug !== null && activeSubjectSlugRef.current !== normalizedSubjectSlug) {
        return;
      }

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
      const scopedSubject = normalizedSubjectSlug
        ? (workspaceBody.studentSubjects ?? []).find((item) => item.subject?.slug === normalizedSubjectSlug)?.subject ?? null
        : null;
      if (normalizedSubjectSlug && !scopedSubject) {
        setError("SUBJECT_ACCESS_DENIED");
        return;
      }
      const scopedProgress = scopedSubject
        ? (workspaceBody.progress ?? []).filter((item) => item.subjectId === scopedSubject.id)
        : workspaceBody.progress ?? [];
      const scopedExercises = scopedSubject
        ? (workspaceBody.exercises ?? []).filter((exercise) => exercise.subjectId === scopedSubject.id)
        : workspaceBody.exercises ?? [];
      const scopedRecentSessions = scopedSubject
        ? (workspaceBody.recentSessions ?? []).filter((session) => session.subjectId === scopedSubject.id)
        : workspaceBody.recentSessions ?? [];
      const scopedFocusSessions = scopedSubject
        ? (workspaceBody.focusSessions ?? []).filter((session) => session.subjectId === scopedSubject.id)
        : workspaceBody.focusSessions ?? [];
      const scopedDailyPlan = workspaceBody.dailyPlan
        ? {
            ...workspaceBody.dailyPlan,
            tasks: scopedSubject
              ? workspaceBody.dailyPlan.tasks.filter((task) => task.subjectId === scopedSubject.id)
              : workspaceBody.dailyPlan.tasks,
          }
        : null;
      const scopedTaskIds = new Set((scopedDailyPlan?.tasks ?? []).map((task) => task.id));
      const normalizedDailyPlan = scopedDailyPlan
        ? {
            ...scopedDailyPlan,
            completedTaskIds: (workspaceBody.dailyPlan?.completedTaskIds ?? []).filter((taskId) => scopedTaskIds.has(taskId)),
            completionRate:
              (scopedDailyPlan.tasks ?? []).length > 0
                ? scopedDailyPlan.tasks.filter((task) => task.completed || (workspaceBody.dailyPlan?.completedTaskIds ?? []).includes(task.id)).length / scopedDailyPlan.tasks.length
                : 0,
          }
        : null;
      const normalizedEntry = scopedSubject && workspaceBody.entry?.recommendedSubjectSlug !== scopedSubject.slug
        ? null
        : workspaceBody.entry ?? null;
      const normalizedDailyClosure = scopedSubject && workspaceBody.dailyClosure?.carryOverSubjectId !== scopedSubject.id
        ? null
        : workspaceBody.dailyClosure ?? null;
      const workspaceView = {
        ...workspaceBody,
        progress: scopedProgress,
        exercises: scopedExercises,
        dailyPlan: normalizedDailyPlan,
        recentSessions: scopedRecentSessions,
        focusSessions: scopedFocusSessions,
        entry: normalizedEntry,
        dailyClosure: normalizedDailyClosure,
      };

      setState({
        student: workspaceView.student ?? null,
        family: workspaceView.family ?? null,
        primaryGuardian: workspaceView.primaryGuardian ?? null,
        secondaryGuardians: workspaceView.secondaryGuardians ?? [],
        guardianStudentAccess: workspaceView.guardianStudentAccess ?? [],
        studentSubjects: workspaceView.studentSubjects ?? [],
        progress: workspaceView.progress ?? [],
        analysis: workspaceView.analysis ?? null,
        exercises: workspaceView.exercises ?? [],
        motivation: workspaceView.motivation ?? null,
        dailyPlan: workspaceView.dailyPlan ?? null,
        recentSessions: workspaceView.recentSessions ?? [],
        focusSessions: workspaceView.focusSessions ?? [],
        entry: workspaceView.entry ?? null,
        memory: workspaceView.memory ?? null,
        learningMemory: workspaceView.learningMemory ?? null,
        subjectMemories: workspaceView.subjectMemories ?? [],
        evolution: workspaceView.evolution ?? null,
        growth: workspaceView.growth ?? null,
        dailyClosure: workspaceView.dailyClosure ?? null,
        guardianHooks: workspaceView.guardianHooks ?? [],
        behavioralRollout: workspaceView.behavioralRollout ?? null,
        behavioralShadow: workspaceView.behavioralShadow ?? null,
      });
      setStateDecision(nextStateDecision);
      setStateActions(nextStateActions);
      setOrchestratorContextStudent(nextOrchestratorContextStudent);
      setGuardianViewModel(nextGuardianViewModel);
      setActiveExerciseId((current: string | null) => {
        const pendingExerciseId = workspaceView.exercises?.find((exercise) => exercise.status === "pending")?.id ?? null;
        if (pendingExerciseId) return pendingExerciseId;
        if (current && workspaceView.exercises?.some((exercise) => exercise.id === current)) {
          return current;
        }
        return null;
      });
      setSessionSignal((current: MentoriaStudentSessionSignal) => ({
        ...current,
        priority: workspaceView.dailyPlan?.tasks.length ? "organization" : current.priority,
        entry: workspaceView.dailyPlan?.tasks.length ? "study_block" : current.entry,
      }));
      setCompletedTaskIds(workspaceView.dailyPlan?.completedTaskIds ?? []);

      if (!normalizedSubjectSlug) {
        setTutorMessages([]);
        return;
      }
      if (!scopedSubject) {
        setError("SUBJECT_ACCESS_DENIED");
        return;
      }

      const scopedBoardHistory = (workspaceView.recentSessions ?? []).reduce<MentoriaBoardUpdate[]>((accumulator, session) => {
        if (!workspaceBody.student) return accumulator;
        return [
          ...accumulator,
          buildBoardUpdateFromLearningSession({
            student: workspaceBody.student,
            subject: scopedSubject,
            session,
          }),
        ];
      }, []);
      const existingBoardHistory = workspaceBody.student
        ? boardHistoryByScopeRef.current[buildBoardScopeKey(workspaceBody.student.id, normalizedSubjectSlug) ?? ""] ?? []
        : [];
      const nextBoardHistory = scopedBoardHistory.length > 0
        ? scopedBoardHistory
        : existingBoardHistory.length > 0
          ? existingBoardHistory
        : [buildEmptyBoardUpdate({
          student: workspaceBody.student,
          subject: scopedSubject,
          topic: scopedSubject.name,
        })];
      setBoardHistoryForSubject(workspaceBody.student.id, normalizedSubjectSlug, nextBoardHistory);
      const scopedRecentSession = workspaceView.recentSessions?.[0] ?? null;
      if (scopedRecentSession) {
        setTutorMessages(mapTranscriptToTutorMessages(scopedRecentSession.transcript ?? []));
        setTopic(scopedRecentSession.topic ?? scopedSubject.name);
        setMessage(scopedRecentSession.recommendedNextStep ?? initialUi.defaultMessage);
      } else if (existingBoardHistory.length === 0) {
        setTutorMessages([]);
        setTopic(scopedSubject.name);
        setMessage(initialUi.defaultMessage);
      }
    } catch (loadError) {
      if (workspaceLoadRequestRef.current === requestId) {
        setError(loadError instanceof Error ? loadError.message : "MENTORIA_WORKSPACE_LOAD_FAILED");
      }
    } finally {
      if (workspaceLoadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load(subjectSlug || null);
  }, [selectedStudentId]);

  useEffect(() => {
    if (billingState !== "success" || !billingSessionId) return;
    void (async () => {
      await fetch("/api/mentoria/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: billingSessionId }),
      });
      void load(subjectSlug || null);
      window.history.replaceState({}, "", selectedStudentId ? `/mentoria/app?studentId=${selectedStudentId}` : "/mentoria/app");
    })();
  }, [billingSessionId, billingState, selectedStudentId, subjectSlug]);

  function resolveSubjectSlugFromSubjectId(subjectId?: string) {
    if (!subjectId) return "";
    return state.studentSubjects.find((item: MentoriaStudentSubject) => item.subjectId === subjectId)?.subject?.slug ?? "";
  }

  function resolveSubjectBySlug(nextSubjectSlug?: string | null) {
    if (!nextSubjectSlug) return null;
    return state.studentSubjects.find((item: MentoriaStudentSubject) => item.subject?.slug === nextSubjectSlug)?.subject ?? null;
  }

  function buildBoardScopeKey(nextStudentId?: string | null, nextSubjectSlug?: string | null) {
    if (!nextStudentId || !nextSubjectSlug) return "";
    return `${nextStudentId}:${nextSubjectSlug}`;
  }

  function getLatestBoardUpdateForSubject(nextSubjectSlug?: string | null) {
    const scopeKey = buildBoardScopeKey(state.student?.id ?? null, nextSubjectSlug);
    if (!scopeKey) return null;
    const scopedHistory = boardHistoryByScopeRef.current[scopeKey] ?? [];
    return scopedHistory[scopedHistory.length - 1] ?? null;
  }

  function resolveTopicForSubject(nextSubjectSlug?: string | null, fallbackTopic?: string | null) {
    const scopedBoardUpdate = getLatestBoardUpdateForSubject(nextSubjectSlug);
    if (scopedBoardUpdate?.topic) return scopedBoardUpdate.topic;
    if (fallbackTopic?.trim()) return fallbackTopic.trim();
    return resolveSubjectBySlug(nextSubjectSlug)?.name ?? initialUi.defaultTopic;
  }

  function pushBoardUpdate(nextBoardUpdate: MentoriaBoardUpdate) {
    const scopeKey = buildBoardScopeKey(nextBoardUpdate.studentId, nextBoardUpdate.subjectSlug);
    if (!scopeKey) return;
    setBoardHistoryByScope((current) => {
      const currentHistory = current[scopeKey] ?? [];
      const previousUpdate = currentHistory[currentHistory.length - 1] ?? null;
      const shouldReplace =
        previousUpdate
        && previousUpdate.topic === nextBoardUpdate.topic
        && previousUpdate.mode === nextBoardUpdate.mode
        && previousUpdate.updatedAt === nextBoardUpdate.updatedAt;
      const nextHistory = shouldReplace
        ? [...currentHistory.slice(0, -1), nextBoardUpdate]
        : [...currentHistory, nextBoardUpdate];
      const nextState = {
        ...current,
        [scopeKey]: [...nextHistory]
          .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))
          .slice(-8),
      };
      boardHistoryByScopeRef.current = nextState;
      return nextState;
    });
  }

  function setBoardHistoryForSubject(nextStudentId: string, nextSubjectSlug: string, updates: MentoriaBoardUpdate[]) {
    const scopeKey = buildBoardScopeKey(nextStudentId, nextSubjectSlug);
    if (!scopeKey) return;
    setBoardHistoryByScope((current) => {
      const nextState = {
        ...current,
        [scopeKey]: [...updates]
          .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))
          .slice(-8),
      };
      boardHistoryByScopeRef.current = nextState;
      return nextState;
    });
  }

  function mapTranscriptToTutorMessages(transcript: LearningSession["transcript"] = []): TutorMessage[] {
    return transcript.map((item) => ({
      role: item.role,
      content: item.content,
      kind: "message" as const,
    }));
  }

  function ensureBoardForSubject(nextSubjectSlug?: string | null, nextTopic?: string | null) {
    if (!state.student || !nextSubjectSlug) return;
    const subject = resolveSubjectBySlug(nextSubjectSlug);
    if (!subject) return;
    const scopeKey = buildBoardScopeKey(state.student.id, nextSubjectSlug);
    if (scopeKey && (boardHistoryByScopeRef.current[scopeKey]?.length ?? 0) > 0) return;
    setBoardHistoryForSubject(
      state.student.id,
      nextSubjectSlug,
      [buildEmptyBoardUpdate({ student: state.student, subject, topic: nextTopic ?? subject.name })],
    );
  }

  function resetSubjectWorkspace(nextSubjectSlug?: string | null, options?: { statusMessage?: string | null }) {
    setError(null);
    setTutorResult(null);
    setTutorMessages([]);
    setActiveExerciseId(null);
    setActiveTaskId(null);
    setSessionStatusMessage(options?.statusMessage ?? null);
    setSessionModeOverride(nextSubjectSlug ? "subject_reinforcement" : null);
    setSessionInputKindOverride(nextSubjectSlug ? "selected_subject" : null);
    resetGuidedFlow();

    if (!nextSubjectSlug) {
      setTopic(initialUi.defaultTopic);
      setMessage(initialUi.defaultMessage);
      return;
    }

    const subject = resolveSubjectBySlug(nextSubjectSlug);
    if (state.student && subject) {
      setBoardHistoryForSubject(
        state.student.id,
        nextSubjectSlug,
        [buildEmptyBoardUpdate({
          student: state.student,
          subject,
          topic: subject.name,
        })],
      );
      setTopic(subject.name);
      setMessage(initialUi.defaultMessage);
      return;
    }

    setTopic(initialUi.defaultTopic);
    setMessage(initialUi.defaultMessage);
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

  const activeSubjectSlugForUi = subjectSlug || null;
  const activeEntry = useMemo(() => {
    if (!state.entry || !activeSubjectSlugForUi) return null;
    return state.entry.recommendedSubjectSlug === activeSubjectSlugForUi ? state.entry : null;
  }, [activeSubjectSlugForUi, state.entry]);
  const activeDailyClosure = useMemo(() => {
    if (!state.dailyClosure || !activeSubjectSlugForUi) return null;
    const closureSubjectSlug = resolveSubjectSlugFromSubjectId(state.dailyClosure.carryOverSubjectId ?? undefined);
    return closureSubjectSlug === activeSubjectSlugForUi ? state.dailyClosure : null;
  }, [activeSubjectSlugForUi, state.dailyClosure, state.studentSubjects]);
  const subjectScopedProgress = useMemo(
    () => activeSubjectSlugForUi
      ? state.progress.filter((item: MentoriaProgress) => resolveSubjectSlugFromSubjectId(item.subjectId) === activeSubjectSlugForUi)
      : [],
    [activeSubjectSlugForUi, state.progress, state.studentSubjects],
  );
  const subjectScopedRecentSessions = useMemo(
    () => activeSubjectSlugForUi
      ? state.recentSessions.filter((session: LearningSession) => resolveSubjectSlugFromSubjectId(session.subjectId) === activeSubjectSlugForUi)
      : [],
    [activeSubjectSlugForUi, state.recentSessions, state.studentSubjects],
  );
  const latestSession = subjectScopedRecentSessions[0] ?? null;
  const subjectScopedFocusSessions = useMemo(
    () => activeSubjectSlugForUi
      ? state.focusSessions.filter((session: FocusSession) => resolveSubjectSlugFromSubjectId(session.subjectId) === activeSubjectSlugForUi)
      : [],
    [activeSubjectSlugForUi, state.focusSessions, state.studentSubjects],
  );
  const subjectScopedExercises = useMemo(
    () => activeSubjectSlugForUi
      ? state.exercises.filter((exercise: MentoriaExercise) => resolveSubjectSlugFromSubjectId(exercise.subjectId) === activeSubjectSlugForUi)
      : [],
    [activeSubjectSlugForUi, state.exercises, state.studentSubjects],
  );
  const latestExercise =
    subjectScopedExercises.find((ex: MentoriaExercise) => ex.id === activeExerciseId)
    ?? subjectScopedExercises.find((ex: MentoriaExercise) => ex.status === "pending")
    ?? null;
  const activeBoardScopeKey = buildBoardScopeKey(state.student?.id ?? null, activeSubjectSlugForUi);
  const activeBoardHistory = activeBoardScopeKey ? boardHistoryByScope[activeBoardScopeKey] ?? [] : [];
  const activeBoardUpdate = useMemo(() => {
    if (activeBoardHistory.length > 0) {
      return activeBoardHistory[activeBoardHistory.length - 1] ?? null;
    }
    if (state.student && selectedSubject?.subject) {
      return buildEmptyBoardUpdate({
        student: state.student,
        subject: selectedSubject.subject,
        topic: resolveTopicForSubject(selectedSubject.subject.slug, topic),
      });
    }
    return null;
  }, [activeBoardHistory, selectedSubject?.subject, state.student, topic]);
  const actionableDailyPlan = useMemo(() => {
    if (!state.dailyPlan || !activeSubjectSlugForUi) {
      return null;
    }
    const tasks = state.dailyPlan.tasks
      .map((task: DailyPlan["tasks"][number]) => ({
        ...task,
        completed: task.completed || completedTaskIds.includes(task.id),
      }))
      .filter((task: DailyPlan["tasks"][number]) => resolveSubjectSlugFromSubjectId(task.subjectId) === activeSubjectSlugForUi);
    const taskIds = new Set(tasks.map((task: DailyPlan["tasks"][number]) => task.id));
    const nextCompletedTaskIds = Array.from(
      new Set([...state.dailyPlan.completedTaskIds, ...completedTaskIds].filter((taskId) => taskIds.has(taskId))),
    );
    const completedTasks = tasks.filter((task: DailyPlan["tasks"][number]) => task.completed).length;

    return {
      ...state.dailyPlan,
      tasks,
      completedTaskIds: nextCompletedTaskIds,
      completionRate: tasks.length > 0 ? completedTasks / tasks.length : 0,
    };
  }, [activeSubjectSlugForUi, completedTaskIds, state.dailyPlan, state.studentSubjects]);
  const activeDailyTask = (activeTaskId
    ? actionableDailyPlan?.tasks.find((task: DailyPlan["tasks"][number]) => task.id === activeTaskId && !task.completed)
    : null)
    ?? actionableDailyPlan?.tasks.find((task: DailyPlan["tasks"][number]) => !task.completed)
    ?? null;
  const selectedSubjectNameForUi = selectedSubject?.subject?.name ?? null;
  const sessionSignalSummary = useMemo(
    () => buildSessionSignalSummary(sessionSignal, selectedSubjectNameForUi),
    [selectedSubjectNameForUi, sessionSignal],
  );

  useEffect(() => {
    ensureBoardForSubject(activeSubjectSlugForUi, topic);
  }, [activeSubjectSlugForUi, topic, state.student?.id, state.studentSubjects]);

  useEffect(() => {
    if (!state.student || !latestExercise || latestExercise.status !== "pending") return;
    const pendingExerciseSubjectSlug = resolveSubjectSlugFromSubjectId(latestExercise.subjectId);
    if (!pendingExerciseSubjectSlug) return;
    const pendingExerciseSubject = resolveSubjectBySlug(pendingExerciseSubjectSlug);
    if (!pendingExerciseSubject) return;
    const scopeKey = buildBoardScopeKey(state.student.id, pendingExerciseSubjectSlug);
    const currentScopeHistory = scopeKey ? boardHistoryByScope[scopeKey] ?? [] : [];
    const currentBoardUpdate = currentScopeHistory[currentScopeHistory.length - 1] ?? null;
    if (
      currentBoardUpdate?.exercise?.prompt === latestExercise.prompt
      && currentBoardUpdate.updatedAt === latestExercise.updatedAt
    ) {
      return;
    }
    pushBoardUpdate(
      buildBoardUpdateFromExercise({
        student: state.student,
        subject: pendingExerciseSubject,
        topic: resolveTopicForSubject(pendingExerciseSubjectSlug, latestExercise.expectedCompetency ?? pendingExerciseSubject.name),
        exercise: latestExercise,
      }),
    );
  }, [activeBoardUpdate?.topic, boardHistoryByScope, latestExercise, state.student, state.studentSubjects]);

  const recentActivityLabel = useMemo(() => {
    const activityIso = latestSession?.updatedAt ?? null;
    if (!activityIso) return null;
    const hours = (Date.now() - new Date(activityIso).getTime()) / (1000 * 60 * 60);
    if (hours >= 24 && hours < 48) return "ayer";
    if (hours < 24) return "hoy";
    return null;
  }, [latestSession?.updatedAt]);

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
    return "free_message";
  }, [activeDailyTask, latestSession?.recommendedNextStep, message, selectedSubject, sessionInputKindOverride, topic, tutorResult?.topic]);

  const sessionMode = useMemo<MentoriaSessionMode>(() => {
    if (sessionModeOverride) return sessionModeOverride;
    return resolveMentoriaSessionMode({
      student: state.student,
      entry: activeEntry,
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
  }, [actionableDailyPlan, activeDailyTask, activeEntry, latestSession, message, recentActivityLabel, resolvedSessionInputKind, selectedSubject, sessionModeOverride, state.student, stateDecision?.state, topic]);

  const sessionContract = useMemo<MentoriaSessionContract>(
    () => buildMentoriaSessionContract(sessionMode, resolvedSessionInputKind),
    [resolvedSessionInputKind, sessionMode],
  );

  const sessionModeOptions = useMemo<MentoriaSessionModeOption[]>(
    () => buildMentoriaSessionModeOptions({
      student: state.student,
      entry: activeEntry,
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
    [actionableDailyPlan, activeDailyTask, activeEntry, latestSession, message, recentActivityLabel, resolvedSessionInputKind, selectedSubject, state.student, stateDecision?.state, topic],
  );

  async function handleSendMessage(
    input?:
      | string
      | {
          message?: string;
          subjectSlug?: string;
          topic?: string;
          intent?: MentoriaClassroomIntent;
          entryMode?: ReentryMode;
          sessionId?: string;
          sessionMode?: MentoriaSessionMode;
          sessionInputKind?: MentoriaSessionInputKind;
          sessionSignal?: MentoriaStudentSessionSignal;
        },
  ) {
    setError(null);
    const normalizedInput = typeof input === "string" ? { message: input } : input;
    const resolvedSubjectSlug = (normalizedInput?.subjectSlug ?? activeSubjectSlugForUi) || undefined;
    const resolvedTopic = (normalizedInput?.topic ?? topic)?.trim() || resolveTopicForSubject(resolvedSubjectSlug, selectedSubject?.subject?.name ?? null);
    const resolvedMessage = normalizedInput?.message ?? message;
    if (!resolvedSubjectSlug) {
      setError("SUBJECT_REQUIRED");
      setSessionStatusMessage("Elige una materia para que el tutor y la pizarra trabajen sobre la misma base.");
      return;
    }
    setSubjectSlug(resolvedSubjectSlug);
    activeSubjectSlugRef.current = resolvedSubjectSlug;
    if (normalizedInput?.sessionMode) {
      setSessionModeOverride(normalizedInput.sessionMode);
    }
    if (normalizedInput?.sessionInputKind) {
      setSessionInputKindOverride(normalizedInput.sessionInputKind);
    }
    if (normalizedInput?.sessionSignal) {
      setSessionSignal(normalizedInput.sessionSignal);
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
      response = await fetch("/api/mentoria/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          {
            studentId: selectedStudentId ?? state.student?.id ?? undefined,
            subjectSlug: resolvedSubjectSlug,
            topic: resolvedTopic,
            message: resolvedMessage,
            intent: normalizedInput?.intent,
            entryMode: normalizedInput?.entryMode,
            sessionId: normalizedInput?.sessionId,
            sessionMode: normalizedInput?.sessionMode,
            sessionInputKind: normalizedInput?.sessionInputKind,
            sessionSignal: normalizedInput?.sessionSignal,
          },
        ),
      });
    } catch {
      if (activeSubjectSlugRef.current === resolvedSubjectSlug) {
        setError("MENTORIA_CHAT_FAILED");
        setSessionStatusMessage("No se pudo conectar con el aula IA. Revisa la red o el servidor local.");
      }
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
      if (activeSubjectSlugRef.current !== resolvedSubjectSlug) {
        return;
      }
      setError(body?.error ?? null);
      setSessionStatusMessage(formatTutorApiError(body?.error ?? null));
      return;
    }

    if (activeSubjectSlugRef.current !== resolvedSubjectSlug) {
      return;
    }

    if (body?.reply || body?.chatMessage || body?.tutorMessage) {
      const responseSubjectSlug = body.subject?.slug ?? body.subjectSlug ?? null;
      if (responseSubjectSlug !== resolvedSubjectSlug) {
        setError("SUBJECT_CONTEXT_MISMATCH");
        setSessionStatusMessage(formatTutorApiError("SUBJECT_CONTEXT_MISMATCH"));
        return;
      }
      if (!body.boardUpdate || !body.tutorMessage?.trim()) {
        setError("MENTORIA_AI_EMPTY_RESPONSE");
        setSessionStatusMessage(formatTutorApiError("MENTORIA_AI_EMPTY_RESPONSE"));
        return;
      }
      if (body.boardUpdate.subjectSlug !== resolvedSubjectSlug) {
        setError("SUBJECT_CONTEXT_MISMATCH");
        setSessionStatusMessage("La pizarra ha rechazado una actualizacion de otra materia.");
        return;
      }
      const tutorReply = body.tutorMessage ?? body.chatMessage ?? body.reply ?? "";
      const nextTutorMessages: TutorMessage[] = [{ role: "tutor", content: tutorReply, kind: "message" }];
      if (body.sessionFeedback?.completionMessage) {
        nextTutorMessages.push({ role: "tutor", content: body.sessionFeedback.completionMessage, kind: "feedback" });
      }
      if (body.sessionFeedback?.progressMessage) {
        nextTutorMessages.push({ role: "tutor", content: body.sessionFeedback.progressMessage, kind: "feedback" });
      }
      if (body.sessionFeedback?.encouragement) {
        nextTutorMessages.push({ role: "tutor", content: body.sessionFeedback.encouragement, kind: "feedback" });
      }
      pushBoardUpdate(body.boardUpdate);
      if (body.boardUpdate.mode !== "practice" && body.boardUpdate.mode !== "correction" && body.boardUpdate.mode !== "task" && body.boardUpdate.mode !== "exam") {
        setActiveExerciseId(null);
      }
      setTutorResult({
        reply: tutorReply,
        explanation: body.explanation ?? "",
        suggestedSteps: body.suggestedSteps ?? [],
        reinforcementQuestion: body.reinforcementQuestion ?? "",
        subjectName: body.subject?.name,
        subjectSlug: resolvedSubjectSlug,
        topic: body.session?.topic ?? resolvedTopic,
        progressMessage: body.sessionFeedback?.progressMessage,
        completionMessage: body.sessionFeedback?.completionMessage,
        encouragement: body.sessionFeedback?.encouragement,
        nextSteps: body.sessionFeedback?.nextSteps,
        recommendedNextStep: body.session?.recommendedNextStep,
      });
      setSessionModeOverride(body.sessionMode ?? normalizedInput?.sessionMode ?? null);
      setSessionInputKindOverride(body.sessionInputKind ?? normalizedInput?.sessionInputKind ?? null);
      setSubjectSlug(resolvedSubjectSlug);
      setTopic(body.session?.topic ?? body.topic ?? resolvedTopic);
      setMessage(body.boardUpdate.nextAction ?? body.nextAction ?? body.session?.recommendedNextStep ?? resolvedMessage);
      setTutorMessages((current: TutorMessage[]) => [...current, ...nextTutorMessages]);
      setSessionStatusMessage(null);
      resetGuidedFlow();
    }

    void load(resolvedSubjectSlug);
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
      subjectScopedExercises.find((ex: MentoriaExercise) => ex.id === activeExerciseId)
      ?? subjectScopedExercises.find((ex: MentoriaExercise) => ex.status === "pending")
      ?? null;
    if (!latestExercise) return;

    setError(null);
    let response: Response | null = null;
    try {
      response = await fetch("/api/mentoria/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "correct", studentId: selectedStudentId ?? undefined, exerciseId: latestExercise.id, studentAnswer: exerciseAnswer }),
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
    const correctedExercise = body?.exercise ?? null;
    if (correctedExercise && state.student) {
      const correctedSubject = state.studentSubjects.find((item: MentoriaStudentSubject) => item.subjectId === correctedExercise.subjectId)?.subject ?? null;
      if (correctedSubject) {
        pushBoardUpdate(
          buildBoardUpdateFromExercise({
            student: state.student,
            subject: correctedSubject,
            topic: resolveTopicForSubject(correctedSubject.slug, correctedExercise.expectedCompetency ?? correctedSubject.name),
            exercise: correctedExercise,
            correction: correctedExercise.correctionFeedback ?? null,
          }),
        );
      }
    }
    setSessionStatusMessage("He corregido el ejercicio en la pizarra para que veas justo donde ajustar.");
    void load(activeSubjectSlugForUi ?? null);
  }

  async function handleSubmitBoardResponse() {
    if (!activeBoardUpdate) return;
    if (activeBoardUpdate.exercise && latestExercise && latestExercise.status !== "corrected") {
      await handleSubmitExercise();
      return;
    }
    if (!exerciseAnswer.trim()) {
      setSessionStatusMessage("Escribe tu respuesta antes de pedir la corrección.");
      return;
    }
    await handleSendMessage({
      message:
        activeBoardUpdate.mode === "exam"
          ? `Corrigeme este simulacro de ${activeBoardUpdate.topic}. Mis respuestas son: ${exerciseAnswer}`
          : `Corrigeme esta respuesta sobre ${activeBoardUpdate.topic}. Mi trabajo es: ${exerciseAnswer}`,
      topic: activeBoardUpdate.topic,
      subjectSlug: activeBoardUpdate.subjectSlug,
      intent: "correction",
      entryMode: "entry",
      sessionMode: activeBoardUpdate.mode === "exam" ? "exam_preparation" : "task_resolution",
      sessionInputKind: "free_message",
    });
    setExerciseAnswer("");
  }

  async function handleGenerateAnotherQuestion() {
    if (!activeBoardUpdate) return;
    await handleSendMessage({
      message:
        activeBoardUpdate.mode === "exam"
          ? `Hazme otra pregunta de examen de ${activeBoardUpdate.topic}.`
          : activeBoardUpdate.mode === "task"
            ? `Ponme otra tarea corta sobre ${activeBoardUpdate.topic}.`
            : `Hazme otra pregunta guiada sobre ${activeBoardUpdate.topic}.`,
      topic: activeBoardUpdate.topic,
      subjectSlug: activeBoardUpdate.subjectSlug,
      intent:
        activeBoardUpdate.mode === "exam"
          ? "exam"
          : activeBoardUpdate.mode === "task"
            ? "task"
            : activeBoardUpdate.mode === "practice" || activeBoardUpdate.mode === "correction"
              ? "practice"
              : "question",
      entryMode: "entry",
      sessionMode:
        activeBoardUpdate.mode === "exam"
          ? "exam_preparation"
          : activeBoardUpdate.mode === "task"
            ? "task_resolution"
            : "subject_reinforcement",
      sessionInputKind: "free_message",
    });
  }

  function handleEndSession() {
    if (!activeSubjectSlugForUi) return;
    resetSubjectWorkspace(activeSubjectSlugForUi, {
      statusMessage: "Clase terminada. La pizarra queda limpia para empezar otra sesión en esta materia.",
    });
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
    const taskSubjectSlug = resolveSubjectSlugFromSubjectId(task.subjectId) || undefined;
    const starterCopy = buildTaskStarterCopy(task);
    if (taskSubjectSlug) {
      setSubjectSlug(taskSubjectSlug);
      activeSubjectSlugRef.current = taskSubjectSlug;
    }
    resetSubjectWorkspace(taskSubjectSlug ?? null, {
      statusMessage: statusMessageOverride ?? starterCopy.status,
    });
    setActiveTaskId(task.id);
    setTopic(starterCopy.topic);
    setMessage(starterCopy.message);
    setActiveSection("board");
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
    if (!slug) {
      setError("SUBJECT_REQUIRED");
      setSessionStatusMessage("No hemos podido abrir esa materia porque falta su identificador.");
      return;
    }
    setSubjectSlug(slug);
    activeSubjectSlugRef.current = slug;
    resetSubjectWorkspace(slug, {
      statusMessage: `Vamos con ${subjectName}.`,
    });
    setTopic(subjectName);
    setMessage(`Quiero avanzar en ${subjectName}`);
    setActiveSection("board");
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
    const selectedExercise = state.exercises.find((exercise: MentoriaExercise) => exercise.id === exerciseId) ?? null;
    const exerciseSubjectSlug = resolveSubjectSlugFromSubjectId(selectedExercise?.subjectId);
    if (!selectedExercise || !exerciseSubjectSlug || !state.student) {
      setError("SUBJECT_CONTEXT_MISMATCH");
      setSessionStatusMessage("Este ejercicio no pertenece a una materia valida del alumno.");
      return;
    }
    const exerciseSubject = resolveSubjectBySlug(exerciseSubjectSlug);
    if (!exerciseSubject) {
      setError("SUBJECT_CONTEXT_MISMATCH");
      setSessionStatusMessage("Este ejercicio apunta a una materia que el alumno no tiene activa.");
      return;
    }
    setSubjectSlug(exerciseSubjectSlug);
    activeSubjectSlugRef.current = exerciseSubjectSlug;
    resetSubjectWorkspace(exerciseSubjectSlug, {
      statusMessage: "Vamos a seguir con este ejercicio.",
    });
    setActiveExerciseId(exerciseId);
    pushBoardUpdate(
      buildBoardUpdateFromExercise({
        student: state.student,
        subject: exerciseSubject,
        topic: resolveTopicForSubject(exerciseSubjectSlug, selectedExercise.expectedCompetency ?? exerciseSubject.name),
        exercise: selectedExercise,
      }),
    );
    setActiveSection("board");
  }

  async function handleStartFocusSession() {
    const focusSubjectSlug = activeSubjectSlugForUi || undefined;
    if (!focusSubjectSlug) {
      setError("SUBJECT_REQUIRED");
      setSessionStatusMessage("Elige una materia antes de abrir un bloque de foco.");
      return;
    }
    setSubjectSlug(focusSubjectSlug);
    activeSubjectSlugRef.current = focusSubjectSlug;
    resetSubjectWorkspace(focusSubjectSlug, {
      statusMessage: `Entrando en modo concentracion para ${selectedSubject?.subject?.name ?? focusSubjectSlug}.`,
    });
    setActiveSection("board");
    await handleSendMessage({
      message: "Quiero empezar una sesion de concentracion",
      subjectSlug: focusSubjectSlug,
      topic: resolveTopicForSubject(focusSubjectSlug, selectedSubject?.subject?.name ?? null),
      entryMode: "entry",
      sessionMode: "study_routine",
      sessionInputKind: "selected_subject",
    });
  }

  async function handleResumeSession(session: LearningSession) {
    const resumeSubjectSlug = resolveSubjectSlugFromSubjectId(session.subjectId) || undefined;
    if (!resumeSubjectSlug || !state.student) {
      setError("SUBJECT_CONTEXT_MISMATCH");
      setSessionStatusMessage("La sesion no tiene una materia valida para retomarla.");
      return;
    }
    const resumeSubject = resolveSubjectBySlug(resumeSubjectSlug);
    if (!resumeSubject) {
      setError("SUBJECT_CONTEXT_MISMATCH");
      setSessionStatusMessage("La sesion pertenece a una materia que el alumno no tiene disponible.");
      return;
    }
    setSubjectSlug(resumeSubjectSlug);
    activeSubjectSlugRef.current = resumeSubjectSlug;
    resetSubjectWorkspace(resumeSubjectSlug, {
      statusMessage: `Retomamos ${resumeSubject.name}.`,
    });
    setActiveSection("board");
    setTutorMessages(mapTranscriptToTutorMessages(session.transcript ?? []));
    pushBoardUpdate(
      buildBoardUpdateFromLearningSession({
        student: state.student,
        subject: resumeSubject,
        session,
      }),
    );
    setTopic(session.topic ?? resumeSubject.name);
    setMessage(session.recommendedNextStep ?? initialUi.defaultMessage);
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
    const targetSubjectSlug = action.subjectSlug?.trim() || activeSubjectSlugForUi || null;
    if (!targetSubjectSlug) {
      setError("SUBJECT_REQUIRED");
      setSessionStatusMessage("Elige una materia antes de lanzar esta accion.");
      return;
    }
    setSubjectSlug(targetSubjectSlug);
    activeSubjectSlugRef.current = targetSubjectSlug;
    resetSubjectWorkspace(targetSubjectSlug, {
      statusMessage: "Preparando esta clase.",
    });
    setTopic(action.topic);
    setMessage(action.prompt);
    await handleSendMessage({
      message: action.prompt,
      topic: action.topic,
      subjectSlug: targetSubjectSlug,
      entryMode: "entry",
      sessionMode: action.sessionMode,
      sessionInputKind: action.sessionInputKind,
      sessionSignal,
    });
  }

  function handleResumeDailyClosure(closure: MentoriaDailyClosureSummary) {
    const carryOverSubjectSlug = resolveSubjectSlugFromSubjectId(closure.carryOverSubjectId ?? undefined) || undefined;
    if (!carryOverSubjectSlug) {
      setError("SUBJECT_CONTEXT_MISMATCH");
      setSessionStatusMessage("No podemos retomar ese cierre porque falta la materia.");
      return;
    }
    const carryOverSubject = resolveSubjectBySlug(carryOverSubjectSlug);
    if (!carryOverSubject) {
      setError("SUBJECT_ACCESS_DENIED");
      setSessionStatusMessage("No tienes acceso a la materia asociada a ese cierre.");
      return;
    }
    const carryOverTopic = closure.carryOverTopic ?? carryOverSubject.name;
    const carryOverPrompt = closure.carryOverPrompt ?? initialUi.defaultMessage;
    setSubjectSlug(carryOverSubjectSlug);
    activeSubjectSlugRef.current = carryOverSubjectSlug;
    resetSubjectWorkspace(carryOverSubjectSlug, {
      statusMessage: "Ayer dejaste una pista clara y hoy puedes retomarla sin empezar desde cero.",
    });
    setTopic(carryOverTopic);
    setMessage(carryOverPrompt);
    setSessionModeOverride("soft_reentry");
    setSessionInputKindOverride("recent_session");
    setActiveSection("board");
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

  async function handleApplySessionSignal() {
    const launch = buildSessionLaunchFromSignal(sessionSignal, selectedSubjectNameForUi);
    const hasSubject = Boolean(activeSubjectSlugForUi);
    await handleQuickAction({
      topic: launch.topic,
      prompt: launch.prompt,
      subjectSlug: activeSubjectSlugForUi ?? undefined,
      sessionMode: resolveSessionModeFromSignal(sessionSignal),
      sessionInputKind: resolveSessionInputKindFromSignal(sessionSignal, hasSubject),
    });
  }

  const behavioralContext = useMemo<BehavioralContext>(() => {
    const normalizedCompletionRate = state.dailyPlan?.completionRate ?? 0;
    const completionRate = normalizedCompletionRate > 1 ? normalizedCompletionRate / 100 : normalizedCompletionRate;
    const lastActivityAt = latestSession?.updatedAt ?? null;
    const hoursSinceActivity = lastActivityAt ? Math.max(0, (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60)) : null;
    const pendingTasks = (actionableDailyPlan?.tasks ?? [])
      .filter((task: DailyPlan["tasks"][number]) => !task.completed && Boolean(activeSubjectSlugForUi))
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
        entryPromptAvailable: Boolean(activeEntry?.recommendedPrompt),
        carryOverPromptAvailable: false,
      },
      product: "mentoria",
      surface: "workspace",
      nowIso: new Date().toISOString(),
      availableActions: {
        canResumeSession: Boolean(latestSession?.recommendedNextStep),
        canStartPendingTask: pendingTasks.length > 0,
        canUseEntryPrompt: Boolean(activeEntry?.recommendedPrompt),
      },
    };
  }, [actionableDailyPlan?.completedTaskIds.length, actionableDailyPlan?.tasks, activeEntry?.recommendedPrompt, activeSubjectSlugForUi, latestSession?.id, latestSession?.recommendedNextStep, latestSession?.topic, latestSession?.updatedAt, state.dailyPlan?.completionRate, state.motivation?.motivationProfile, state.motivation?.streak, state.student?.tenantId, state.student?.userId]);
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
    if (!activeSubjectSlugForUi) {
      return false;
    }
    if (state.behavioralRollout === "engine_strategy" || state.behavioralRollout === "engine_strategy_and_explanation") {
      return true;
    }
    return Boolean(state.motivation || latestSession);
  }, [activeSubjectSlugForUi, latestSession, state.behavioralRollout, state.motivation]);
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

    if (selectedSubject && activeEntry?.recommendedPrompt && activeEntry?.recommendedTopic) {
      return {
        kind: "quick_action",
        title: "Empezar por la recomendación principal",
        detail: "Esta es la entrada más clara para arrancar la sesión sin decidir entre varias opciones.",
        ctaLabel: activeEntry.recommendedTopic,
        sessionState: derivedSessionState,
      };
    }

    if (selectedSubject && subjectScopedFocusSessions.length > 0) {
      return {
        kind: "focus_session",
        title: "Entrar en bloque de foco",
        detail: "Si no hay sesión activa, el siguiente paso más claro es abrir un bloque corto de concentración.",
        ctaLabel: "Empezar bloque de foco",
        sessionState: derivedSessionState,
      };
    }

    return null;
  }, [actionableDailyPlan?.tasks, activeDailyTask, activeEntry, activeGuidedStep, behavioralFrame.primaryLabel, behavioralFrame.title, behavioralFrame.whyToday, derivedSessionState, guidedFeedback?.level, latestExercise, latestSession, selectedBehavioralAction.strategy, selectedBehavioralAction.task, selectedSubject, shouldUseBehavioralReentry, subjectScopedFocusSessions.length]);

  const copilotPrimaryActionLabel = useMemo(() => {
    if (!nextAction) return null;
    if (nextAction.kind === "exercise") return "Corregir desde el chat";
    if (nextAction.kind === "task" && nextAction.title === "Tu siguiente paso ya esta preparado.") {
      return behavioralFrame.primaryLabel;
    }
    if (nextAction.kind === "task") return "Sigue con este paso";
    return nextAction.ctaLabel;
  }, [behavioralFrame.primaryLabel, nextAction]);

  const dynamicStudentProfile = useMemo(
    () => state.student
      ? buildDynamicStudentProfile({
          student: state.student,
          studentSubjects: state.studentSubjects,
          progress: state.progress,
          evolution: state.evolution,
          learningMemory: state.learningMemory,
          subjectMemories: state.subjectMemories,
          guardianStudentAccess: state.guardianStudentAccess,
          activeSubjectSlug: activeSubjectSlugForUi,
          activeTopic: topic,
        })
      : null,
    [activeSubjectSlugForUi, state.evolution, state.guardianStudentAccess, state.learningMemory, state.progress, state.student, state.studentSubjects, state.subjectMemories, topic],
  );

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
      entry: activeEntry,
      activeDailyTask,
      latestExercise,
      latestSession,
      motivationMessage,
      dynamicProfile: dynamicStudentProfile,
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
      activeEntry,
      dynamicStudentProfile,
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
              onClick={() => void load(subjectSlug || null)}
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
        ? actionableDailyPlan?.tasks.find((task: DailyPlan["tasks"][number]) => task.id === selectedBehavioralAction.task?.id)
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

    if (nextAction.kind === "quick_action" && activeEntry) {
      void handleQuickAction({
        topic: activeEntry.recommendedTopic,
        prompt: activeEntry.recommendedPrompt,
        subjectSlug: activeSubjectSlugForUi ?? undefined,
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
        topic: action.topic ?? activeEntry?.recommendedTopic ?? topic,
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
      copilotMode="floating"
      copilotLabel="Tutor"
      leftNav={
        <WorkspaceNav
          student={state.student}
          studentSubjects={state.studentSubjects}
          progress={subjectScopedProgress}
          recentSessions={subjectScopedRecentSessions}
          focusSessions={subjectScopedFocusSessions}
          connectedGuardians={connectedGuardians}
          activeSection={activeSection}
          activeSubjectSlug={activeSubjectSlugForUi}
          onSectionChange={(section) => setActiveSection(section as WorkspaceSection)}
          onSubjectSelect={(slug) => {
            setSubjectSlug(slug);
            activeSubjectSlugRef.current = slug;
            resetSubjectWorkspace(slug, {
              statusMessage: `Materia activa: ${state.studentSubjects.find((item: MentoriaStudentSubject) => item.subject?.slug === slug)?.subject?.name ?? slug}`,
            });
            setActiveSection("board");
            void load(slug);
          }}
        />
      }
      centerBoard={
        <WorkspaceBoard
          activeSection={activeSection}
          student={state.student}
          studentSubjects={state.studentSubjects}
          progress={subjectScopedProgress}
          dailyPlan={actionableDailyPlan}
          focusSessions={subjectScopedFocusSessions}
          entry={activeEntry}
          evolution={state.evolution}
          growth={state.growth}
          dailyClosure={activeDailyClosure}
          latestSession={latestSession}
          recentSessions={subjectScopedRecentSessions}
          latestExercise={latestExercise}
          exercises={subjectScopedExercises}
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
          activeBoardUpdate={activeBoardUpdate}
          sessionSignal={sessionSignal}
          sessionSignalSummary={sessionSignalSummary}
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
          onSubmitBoardResponse={handleSubmitBoardResponse}
          onGenerateAnotherQuestion={handleGenerateAnotherQuestion}
          onEndSession={handleEndSession}
          onSessionSignalChange={setSessionSignal}
          onApplySessionSignal={handleApplySessionSignal}
          onSelectSessionMode={handleSelectSessionMode}
          onRunNextAction={handleRunNextAction}
        />
      }
      rightCopilot={
        <WorkspaceCopilot
          entry={activeEntry}
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
          sessionSignalSummary={sessionSignalSummary}
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
