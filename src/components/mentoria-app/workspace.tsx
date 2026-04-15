"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [exerciseAnswer, setExerciseAnswer] = useState("");
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [sessionStatusMessage, setSessionStatusMessage] = useState<string | null>(null);

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
      setSessionStatusMessage(null);
    }

    void load();
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
    setActiveSection("board");
    setSessionStatusMessage("Perfecto. Vamos a empezar con esto 👇");
    await handleSendMessage({
      message: `Empezar tarea: ${task.subject}`,
      subjectSlug: resolveSubjectSlugFromSubjectId(task.subjectId) || undefined,
      topic: task.subject,
      entryMode: "plan_task",
    });
  }

  async function handleStartSubjectSession(subject: MentoriaStudentSubject | MentoriaProgress) {
    const subjectName = subject.subject?.name ?? "esta materia";
    const slug = (subject.subject?.slug ?? resolveSubjectSlugFromSubjectId(subject.subjectId)) || undefined;
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
    setActiveSection("board");
    setSessionStatusMessage("Entrando en modo concentración...");
    await handleSendMessage({
      message: "Quiero empezar una sesión de concentración",
      entryMode: "entry",
    });
  }

  async function handleResumeSession(session: LearningSession) {
    setTutorResult(null);
    if (session.recommendedNextStep) {
      await handleSendMessage({
        message: session.recommendedNextStep,
        topic: session.topic,
        subjectSlug: resolveSubjectSlugFromSubjectId(session.subjectId) || undefined,
        entryMode: "resume_session",
        sessionId: session.id,
      });
    }
  }

  async function handleQuickAction(action: { topic: string; prompt: string; subjectSlug?: string | null }) {
    setTutorResult(null);
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
  const activeDailyTask = state.dailyPlan?.tasks.find((task) => !task.completed) ?? null;
  const tutorMessages = tutorResult
    ? [
        { role: "student" as const, content: message },
        { role: "tutor" as const, content: tutorResult.reply },
      ]
    : [];
  const motivationMessage =
    state.motivation?.motivationProfile === "fragile"
      ? "Hoy es un buen día para empezar con algo pequeño y claro"
      : state.motivation?.motivationProfile === "high_performer"
        ? "Estás en racha, aprovecha el momento"
        : "Sigue con tu ritmo, vas bien";

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
          onSectionChange={(section) => setActiveSection(section as WorkspaceSection)}
        />
      }
      centerBoard={
        <WorkspaceBoard
          activeSection={activeSection}
          student={state.student}
          studentSubjects={state.studentSubjects}
          progress={state.progress}
          dailyPlan={state.dailyPlan}
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
          tutorMessages={tutorMessages}
          exerciseAnswer={exerciseAnswer}
          sessionStatusMessage={sessionStatusMessage}
          onSendMessage={handleSendMessage}
          onSubmitExercise={handleSubmitExercise}
          onExerciseAnswerChange={setExerciseAnswer}
          onStartDailyTask={handleStartDailyTask}
          onStartFocusSession={handleStartFocusSession}
          onStartSubjectSession={handleStartSubjectSession}
          onOpenExercise={handleOpenExercise}
          onSectionChange={(section) => setActiveSection(section as WorkspaceSection)}
          onResumeSession={handleResumeSession}
          onQuickAction={handleQuickAction}
        />
      }
      rightCopilot={
        <WorkspaceCopilot
          entry={state.entry}
          dailyPlan={state.dailyPlan}
          memory={state.memory}
          guardianHooks={state.guardianHooks}
          analysisNextActions={state.analysis?.nextActions ?? []}
          motivationMessage={motivationMessage}
          onQuickAction={handleQuickAction}
        />
      }
    />
  );
}
