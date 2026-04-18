"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/mentoria-app/workspace-shell";
import { WorkspaceNav } from "@/components/mentoria-app/workspace-nav";
import { WorkspaceBoard } from "@/components/mentoria-app/workspace-board";
import { WorkspaceCopilot } from "@/components/mentoria-app/workspace-copilot";
import { getWorkspaceUiCopy } from "@/lib/mentoria/microcopy";
import type {
  DailyPlan,
  FocusSession,
  LearningSession,
  MentoriaExercise,
  MentoriaGuardianHookEvent,
  MentoriaProgress,
  MentoriaStudentMemorySummary,
  MentoriaStudentSubject,
  MentoriaWorkspaceEntry,
  ParentAccount,
  StudentProfile,
} from "@/lib/mentoria/types";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";

type WorkspaceSection = "board" | "subjects" | "sessions" | "progress" | "planner" | "focus" | "exercises" | "memory";
type ReentryMode = "resume_session" | "gentle_restart" | "momentum_push" | "plan_task" | "entry";
type GuidedFeedbackStatus = "correct" | "almost" | "incorrect";
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
  parents: ParentAccount[];
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
  guardianHooks: MentoriaGuardianHookEvent[];
};

type WorkspaceApiResponse = WorkspaceState & {
  ok?: boolean;
  error?: string;
  student?: StudentProfile | null;
  parents?: ParentAccount[];
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
  guardianHooks?: MentoriaGuardianHookEvent[];
};

type SessionApiResponse = {
  ok?: boolean;
  error?: string;
  reply?: string;
  explanation?: string;
  suggestedSteps?: string[];
  reinforcementQuestion?: string;
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

function evaluateGuidedResponse(step: string, answer: string): GuidedFeedback {
  const normalizedAnswer = answer.trim();
  if (!normalizedAnswer) {
    return {
      status: "incorrect",
      message: "Necesito una respuesta para saber si seguimos o ajustamos el paso.",
      rationale: "Todavía no puedo comprobar nada porque no has dejado una idea concreta para evaluar.",
    };
  }

  const stepTokens = Array.from(new Set(normalizeGuidedTokens(step)));
  const answerTokens = Array.from(new Set(normalizeGuidedTokens(normalizedAnswer)));
  const overlap = stepTokens.filter((token) => answerTokens.includes(token)).length;
  const overlapRatio = stepTokens.length > 0 ? overlap / stepTokens.length : 0;

  if (normalizedAnswer.length >= 18 && (overlapRatio >= 0.35 || answerTokens.length >= 4)) {
    return {
      status: "correct",
      message: "Correcto. Has resuelto bien este paso y podemos avanzar.",
      rationale: "Tu respuesta recoge la idea principal del paso y la desarrolla con suficiente detalle para seguir.",
    };
  }

  if (normalizedAnswer.length >= 8 && (overlapRatio >= 0.15 || answerTokens.length >= 2)) {
    return {
      status: "almost",
      message: "Casi. La idea va bien, así que avanzamos manteniendo atención en el siguiente paso.",
      rationale: "Has captado parte de la intención, pero falta concretar mejor la relación entre la idea principal y tu respuesta.",
    };
  }

  return {
    status: "incorrect",
    message: "Incorrecto. Revisa la idea principal y prueba una respuesta más concreta.",
    rationale: "La respuesta es demasiado breve o se aleja del foco del paso, así que conviene reformularla antes de seguir.",
  };
}

export function MentoriaWorkspace() {
  const initialUi = getWorkspaceUiCopy("eso");
  const [state, setState] = useState<WorkspaceState>({
    student: null,
    parents: [],
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
    guardianHooks: [],
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

  const selectedSubject = useMemo(
    () => state.studentSubjects.find((item: MentoriaStudentSubject) => item.subject?.slug === subjectSlug) ?? null,
    [state.studentSubjects, subjectSlug],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const workspaceRes = await fetch("/api/mentoria/workspace", { cache: "no-store" });
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

      setState({
        student: workspaceBody.student ?? null,
        parents: workspaceBody.parents ?? [],
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
        guardianHooks: workspaceBody.guardianHooks ?? [],
      });
      setActiveExerciseId(workspaceBody.exercises?.find((exercise) => exercise.status === "pending")?.id ?? null);
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
    const billingState = searchParams.get("billing");
    const sessionId = searchParams.get("session_id");
    if (billingState !== "success" || !sessionId) return;
    void (async () => {
      await fetch("/api/mentoria/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      void load();
      window.history.replaceState({}, "", "/mentoria/app");
    })();
  }, [searchParams]);

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

  function resetGuidedFlow() {
    setActiveStepIndex(0);
    setGuidedStepInput("");
    setGuidedFeedback(null);
    setSessionState("idle");
  }

  async function handleSendMessage(
    input?:
      | string
      | {
          message?: string;
          subjectSlug?: string;
          topic?: string;
          entryMode?: ReentryMode;
          sessionId?: string;
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
    setTopic(resolvedTopic);
    setMessage(resolvedMessage);
    setActiveSection("board");
    setTutorMessages((current: TutorMessage[]) => [
      ...current,
      { role: "student", content: resolvedMessage, kind: "message" },
    ]);

    const response = await fetch("/api/mentoria/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectSlug: resolvedSubjectSlug,
        topic: resolvedTopic,
        message: resolvedMessage,
        entryMode: normalizedInput?.entryMode,
        sessionId: normalizedInput?.sessionId ?? latestSession?.id,
      }),
    });

    const body = (await response.json()) as SessionApiResponse;
    if (!response.ok) {
      setError(body.error ?? null);
      return;
    }

    if (body.reply) {
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
      if (body.sessionFeedback?.progressMessage) {
        nextTutorMessages.push({ role: "tutor", content: body.sessionFeedback.progressMessage, kind: "feedback" });
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
    const response = await fetch("/api/mentoria/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "correct", exerciseId: latestExercise.id, studentAnswer: exerciseAnswer }),
    });

    const body = (await response.json()) as { error?: string; exercise?: MentoriaExercise };
    if (!response.ok) {
      setError(body.error ?? null);
      return;
    }

    setExerciseAnswer("");
    void load();
  }

  async function handleStartDailyTask(task: DailyPlan["tasks"][number]) {
    setActiveTaskId(task.id);
    resetGuidedFlow();
    const taskSubjectSlug = resolveSubjectSlugFromSubjectId(task.subjectId) || undefined;
    if (taskSubjectSlug) {
      setSubjectSlug(taskSubjectSlug);
    }
    setActiveSection("board");
    setSessionStatusMessage(`Plan del día: ${task.subject}. Vamos paso a paso 👇`);
    await handleSendMessage({
      message: `Empezar tarea: ${task.subject}`,
      subjectSlug: taskSubjectSlug,
      topic: task.subject,
      entryMode: "plan_task",
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
    });
  }

  async function handleResumeSession(session: LearningSession) {
    setTutorResult(null);
    setActiveTaskId(null);
    resetGuidedFlow();
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
    if (session.recommendedNextStep) {
      await handleSendMessage({
        message: session.recommendedNextStep,
        topic: session.topic,
        subjectSlug: resumeSubjectSlug,
        entryMode: "resume_session",
        sessionId: session.id,
      });
    }
  }

  async function handleQuickAction(action: { topic: string; prompt: string; subjectSlug?: string | null }) {
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
    });
  }

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

  const latestSession = state.recentSessions[0] ?? null;
  const latestExercise =
    state.exercises.find((ex: MentoriaExercise) => ex.id === activeExerciseId)
    ?? state.exercises.find((ex: MentoriaExercise) => ex.status === "pending")
    ?? null;
  const activeDailyTask = state.dailyPlan?.tasks.find((task: DailyPlan["tasks"][number]) => task.id === activeTaskId)
    ?? state.dailyPlan?.tasks.find((task: DailyPlan["tasks"][number]) => !task.completed)
    ?? null;
  const actionableDailyPlan = state.dailyPlan
    ? {
        ...state.dailyPlan,
        completedTaskIds,
        tasks: state.dailyPlan.tasks.map((task: DailyPlan["tasks"][number]) => ({
          ...task,
          completed: task.completed || completedTaskIds.includes(task.id),
        })),
      }
    : null;
  const activeSubjectSlugForUi = subjectSlug || tutorResult?.subjectSlug || state.entry?.recommendedSubjectSlug || null;
  const motivationMessage =
    state.motivation?.motivationProfile === "fragile"
      ? "Hoy es un buen día para empezar con algo pequeño y claro"
      : state.motivation?.motivationProfile === "high_performer"
        ? "Estás en racha, aprovecha el momento"
        : "Sigue con tu ritmo, vas bien";
  const nextAction = useMemo<WorkspaceNextAction | null>(() => {
    if (activeGuidedStep) {
      if (derivedSessionState === "completed") {
        return {
          kind: "guided_step",
          title: "Sesión guiada completada",
          detail: "Has cerrado la secuencia principal. Revisa el cierre y prepárate para el siguiente bloque.",
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
              ? "Responder el paso activo"
              : "Preparar la respuesta del paso activo",
        detail: derivedSessionState === "retry"
          ? "Ajusta la respuesta con la explicación recibida y vuelve a intentarlo sobre este mismo paso."
          : derivedSessionState === "checking"
            ? "Estamos validando si la idea principal está bien resuelta antes de avanzar."
            : derivedSessionState === "answering"
              ? "Ya has empezado a responder. Remata la idea principal antes de comprobar."
              : "Lee el paso, piensa la idea clave y escribe una respuesta corta y concreta.",
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
        ctaLabel: "Entregar ejercicio",
        sessionState: derivedSessionState,
      };
    }

    if (activeDailyTask) {
      return {
        kind: "task",
        title: "Empezar la tarea del día",
        detail: `Tu siguiente movimiento es abrir ${activeDailyTask.subject} y entrar en su sesión guiada.`,
        ctaLabel: "Empezar tarea del día",
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
        detail: `La materia ya está elegida. Solo falta abrir la sesión y empezar a trabajar.`,
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
  }, [activeDailyTask, activeGuidedStep, derivedSessionState, guidedFeedback?.status, latestExercise, latestSession, selectedSubject, state.entry, state.focusSessions.length]);

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

    if (nextAction.kind === "task" && activeDailyTask) {
      void handleStartDailyTask(activeDailyTask);
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

  return (
    <WorkspaceShell
      leftNav={
        <WorkspaceNav
          student={state.student}
          studentSubjects={state.studentSubjects}
          progress={state.progress}
          recentSessions={state.recentSessions}
          focusSessions={state.focusSessions}
          parents={state.parents}
          activeSection={activeSection}
          activeSubjectSlug={activeSubjectSlugForUi}
          onSectionChange={(section) => setActiveSection(section as WorkspaceSection)}
          onSubjectSelect={(slug) => {
            setActiveTaskId(null);
            setSubjectSlug(slug);
            setTutorResult(null);
            setSessionStatusMessage(`Materia activa: ${state.studentSubjects.find((item: MentoriaStudentSubject) => item.subject?.slug === slug)?.subject?.name ?? slug}`);
            setActiveSection("subjects");
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
          latestSession={latestSession}
          recentSessions={state.recentSessions}
          latestExercise={latestExercise}
          exercises={state.exercises}
          activeDailyTask={activeDailyTask}
          memory={state.memory}
          analysis={state.analysis}
          guardianHooks={state.guardianHooks}
          motivationMessage={motivationMessage}
          activeSubjectSlug={activeSubjectSlugForUi}
          selectedSubject={selectedSubject}
          tutorResult={tutorResult}
          nextAction={nextAction}
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
          onQuickAction={handleQuickAction}
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
          dynamicNextAction={nextAction}
          sessionState={derivedSessionState}
          student={state.student}
          activeSubjectSlug={activeSubjectSlugForUi}
          selectedSubjectName={selectedSubject?.subject?.name ?? selectedSubject?.subject?.slug ?? null}
          tutorMessages={tutorMessages}
          tutorResult={tutorResult}
          activeGuidedStep={activeGuidedStep}
          guidedFeedback={guidedFeedback}
          sessionProgressPercent={sessionProgressPercent}
          onSendMessage={handleSendMessage}
          onQuickAction={handleQuickAction}
          onRunNextAction={handleRunNextAction}
        />
      }
    />
  );
}
