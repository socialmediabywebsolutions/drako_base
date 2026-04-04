"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MentoriaFocusMode } from "@/components/mentoria-app/focus-mode";
import type { BehavioralShadowComparison } from "@/lib/behavioral-engine/contracts";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy, getWorkspaceUiCopy } from "@/lib/mentoria/microcopy";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type {
  DailyPlan,
  FocusSession,
  LearningSession,
  MentoriaBillingSummary,
  MentoriaGrowthSummary,
  MentoriaDailyClosureSummary,
  MentoriaExercise,
  MentoriaGuardianHookEvent,
  MentoriaPreparedImage,
  MentoriaProgress,
  MentoriaStudentMemorySummary,
  MentoriaStudentSubject,
  MentoriaWorkspaceEntry,
  ParentAccount,
  StudentProfile,
  StudyPlan,
} from "@/lib/mentoria/types";

type WorkspaceState = {
  student: StudentProfile | null;
  parents: ParentAccount[];
  studentSubjects: MentoriaStudentSubject[];
  progress: MentoriaProgress[];
  analysis: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] } | null;
  plan: StudyPlan | null;
  exercises: MentoriaExercise[];
  motivation: MotivationState | null;
  dailyPlan: DailyPlan | null;
  billing: MentoriaBillingSummary | null;
  recentSessions: LearningSession[];
  focusSessions: FocusSession[];
  entry: MentoriaWorkspaceEntry | null;
  memory: MentoriaStudentMemorySummary | null;
  evolution: StudentEvolutionProfile | null;
  growth: MentoriaGrowthSummary | null;
  dailyClosure: MentoriaDailyClosureSummary | null;
  guardianHooks: MentoriaGuardianHookEvent[];
  behavioralShadow?: BehavioralShadowComparison | null;
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

type WorkspaceApiResponse = WorkspaceState & {
  ok?: boolean;
  error?: string;
  student?: StudentProfile | null;
  parents?: ParentAccount[];
  studentSubjects?: MentoriaStudentSubject[];
  motivation?: MotivationState | null;
  dailyPlan?: DailyPlan | null;
  billing?: MentoriaBillingSummary | null;
  progress?: MentoriaProgress[];
  analysis?: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] };
  currentPlan?: StudyPlan | null;
  exercises?: MentoriaExercise[];
  recentSessions?: LearningSession[];
  focusSessions?: FocusSession[];
  entry?: MentoriaWorkspaceEntry | null;
  memory?: MentoriaStudentMemorySummary | null;
  evolution?: StudentEvolutionProfile | null;
  growth?: MentoriaGrowthSummary | null;
  dailyClosure?: MentoriaDailyClosureSummary | null;
  guardianHooks?: MentoriaGuardianHookEvent[];
  behavioralShadow?: BehavioralShadowComparison | null;
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

type ReentryMode = "resume_session" | "gentle_restart" | "momentum_push" | "plan_task" | "entry";
type EntryLaunchState = {
  area: "tutor" | "exercise";
  title: string;
  detail: string;
};

type PostActionMode = "support" | "steady" | "momentum";

type PostActionOutcome = {
  source: "session" | "exercise" | "focus";
  mode: PostActionMode;
  subjectId?: string;
  summary: string;
};

type DynamicNextAction = {
  mode: PostActionMode;
  badge: string;
  title: string;
  explanation: string;
  actionLabel: string;
  task: DailyPlan["tasks"][number];
};

export function MentoriaWorkspace() {
  const initialUi = getWorkspaceUiCopy("eso");
  const taskTypeLabels: Record<"practice" | "review" | "challenge", string> = {
    practice: "practica guiada",
    review: "repaso guiado",
    challenge: "reto corto",
  };
  const [state, setState] = useState<WorkspaceState>({
    student: null,
    parents: [],
    studentSubjects: [],
    progress: [],
    analysis: null,
    plan: null,
      exercises: [],
      motivation: null,
      dailyPlan: null,
      billing: null,
      recentSessions: [],
      focusSessions: [],
      entry: null,
      memory: null,
      evolution: null,
      growth: null,
      dailyClosure: null,
      guardianHooks: [],
      behavioralShadow: null,
    });
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyPlanFeedback, setDailyPlanFeedback] = useState<string | null>(null);
  const [dynamicNextAction, setDynamicNextAction] = useState<DynamicNextAction | null>(null);
  const [subjectSlug, setSubjectSlug] = useState("");
  const [topic, setTopic] = useState(initialUi.defaultTopic);
  const [message, setMessage] = useState(initialUi.defaultMessage);
  const [tutorResult, setTutorResult] = useState<TutorResult | null>(null);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [exerciseAnswer, setExerciseAnswer] = useState("");
  const [focusTimer, setFocusTimer] = useState(25);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [preparedImage, setPreparedImage] = useState<MentoriaPreparedImage | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageNotes, setImageNotes] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hasAppliedEntry, setHasAppliedEntry] = useState(false);
  const [entryLaunchState, setEntryLaunchState] = useState<EntryLaunchState | null>(null);
  const pendingPostActionOutcomeRef = useRef<PostActionOutcome | null>(null);

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

      if (workspaceBody.behavioralShadow?.diverged) {
        console.warn("[BehavioralEngineShadow] Client divergence observed", {
          currentStrategy: workspaceBody.behavioralShadow.currentStrategy,
          shadowStrategy: workspaceBody.behavioralShadow.shadowStrategy,
          currentTask: workspaceBody.behavioralShadow.currentAction.task,
          shadowTask: workspaceBody.behavioralShadow.shadowAction.task,
        });
      }

      const previousCompletedTaskCount = state.dailyPlan?.completedTaskIds.length ?? 0;
      const nextCompletedTaskCount = workspaceBody.dailyPlan?.completedTaskIds.length ?? 0;
      if (state.student && nextCompletedTaskCount > previousCompletedTaskCount) {
        const completedDelta = nextCompletedTaskCount - previousCompletedTaskCount;
        const nextPendingTask = workspaceBody.dailyPlan?.tasks.find((task) => !task.completed) ?? null;
        setDailyPlanFeedback(
          nextPendingTask
            ? `Has completado ${completedDelta} ${completedDelta === 1 ? "tarea" : "tareas"} del plan de hoy. Siguiente paso: ${nextPendingTask.subject} - ${taskTypeLabels[nextPendingTask.type]}.`
            : "Has completado todo el plan de hoy. Buen trabajo, ya puedes volver mas tarde o pedir un nuevo reto.",
        );
      }

      if (pendingPostActionOutcomeRef.current && workspaceBody.dailyPlan) {
        setDynamicNextAction(buildDynamicNextAction(workspaceBody.dailyPlan, pendingPostActionOutcomeRef.current));
        pendingPostActionOutcomeRef.current = null;
      }

      setState({
        student: workspaceBody.student ?? null,
        parents: workspaceBody.parents ?? [],
        studentSubjects: workspaceBody.studentSubjects ?? [],
        progress: workspaceBody.progress ?? [],
        analysis: workspaceBody.analysis ?? null,
        plan: workspaceBody.currentPlan ?? null,
        exercises: workspaceBody.exercises ?? [],
        motivation: workspaceBody.motivation ?? null,
        dailyPlan: workspaceBody.dailyPlan ?? null,
        billing: workspaceBody.billing ?? null,
        recentSessions: workspaceBody.recentSessions ?? [],
        focusSessions: workspaceBody.focusSessions ?? [],
        entry: workspaceBody.entry ?? null,
        memory: workspaceBody.memory ?? null,
        evolution: workspaceBody.evolution ?? null,
        growth: workspaceBody.growth ?? null,
        dailyClosure: workspaceBody.dailyClosure ?? null,
        guardianHooks: workspaceBody.guardianHooks ?? [],
        behavioralShadow: workspaceBody.behavioralShadow ?? null,
      });
      setActiveExerciseId(workspaceBody.exercises?.find((exercise) => exercise.status === "pending")?.id ?? null);
      if (!hasAppliedEntry && workspaceBody.entry) {
        setSubjectSlug(workspaceBody.entry.recommendedSubjectSlug ?? "");
        setTopic(workspaceBody.entry.recommendedTopic);
        setMessage(workspaceBody.entry.recommendedPrompt);
        setHasAppliedEntry(true);
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
    if (!focusSession || focusSession.status !== "active") return;
    const timer = window.setInterval(() => {
      setFocusTimer((current) => (current > 0 ? current - 1 : 0));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [focusSession]);

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

  async function startCheckout(plan: "pro" | "family") {
    const response = await fetch("/api/mentoria/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const body = (await response.json()) as { url?: string; error?: string; code?: string };
    if (!response.ok || !body.url) {
      setError(body.error ?? body.code ?? "MENTORIA_BILLING_CHECKOUT_FAILED");
      return;
    }
    window.location.href = body.url;
  }

  async function openBillingPortal() {
    const response = await fetch("/api/mentoria/billing/portal", { method: "POST" });
    const body = (await response.json()) as { url?: string; error?: string; code?: string };
    if (!response.ok || !body.url) {
      setError(body.error ?? body.code ?? "MENTORIA_BILLING_PORTAL_FAILED");
      return;
    }
    window.location.href = body.url;
  }

  function scrollToArea(area: "tutor" | "exercise") {
    const id = area === "tutor" ? "mentoria-tutor-card" : "mentoria-exercise-card";
    const element = document.getElementById(id);
    if (element && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function sendTutorMessage(input?: {
    subjectSlug?: string;
    topic?: string;
    message?: string;
    entryMode?: ReentryMode;
    launchState?: EntryLaunchState;
  }) {
    setError(null);
    setTutorResult(null);
    setDynamicNextAction(null);
    const resolvedSubjectSlug = input?.subjectSlug ?? (subjectSlug || undefined);
    const resolvedTopic = input?.topic ?? topic;
    const resolvedMessage = input?.message ?? message;
    if (resolvedSubjectSlug !== undefined) {
      setSubjectSlug(resolvedSubjectSlug);
    }
    setTopic(resolvedTopic);
    setMessage(resolvedMessage);
    if (input?.launchState) {
      setEntryLaunchState(input.launchState);
      scrollToArea(input.launchState.area);
    }
    const response = await fetch("/api/mentoria/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectSlug: resolvedSubjectSlug,
        topic: resolvedTopic,
        message: resolvedMessage,
        entryMode: input?.entryMode,
      }),
    });
    const body = (await response.json()) as SessionApiResponse;
    setEntryLaunchState(null);
    if (!response.ok) {
      setError(body.error ?? null);
      return;
    }
    setTutorResult(body.reply ? {
      reply: body.reply,
      explanation: body.explanation ?? body.reply,
      suggestedSteps: body.suggestedSteps ?? [],
      reinforcementQuestion: body.reinforcementQuestion ?? "",
      subjectName: body.subject?.name,
      subjectSlug: body.subject?.slug,
      topic: body.session?.topic ?? resolvedTopic,
      progressMessage: body.sessionFeedback?.progressMessage,
      completionMessage: body.sessionFeedback?.completionMessage,
      encouragement: body.sessionFeedback?.encouragement,
      nextSteps: body.sessionFeedback?.nextSteps ?? [],
      recommendedNextStep: body.session?.recommendedNextStep,
    } : null);
    pendingPostActionOutcomeRef.current = {
      source: "session",
      mode: getSessionOutcomeMode(body.sessionFeedback?.scoreChange ?? 0),
      subjectId: resolveSubjectIdFromSlug(body.subject?.slug ?? resolvedSubjectSlug),
      summary:
        (body.sessionFeedback?.scoreChange ?? 0) >= 3
          ? "La primera accion te ha salido bien y el plan puede subir un poco el siguiente paso."
          : (body.sessionFeedback?.scoreChange ?? 0) <= 0
            ? "La primera accion ha pedido mas apoyo y el siguiente paso conviene hacerlo mas guiado."
            : "La primera accion ha quedado bien cerrada y el sistema ya prepara el siguiente paso natural.",
    };
    if (body.subject?.slug) {
      setSubjectSlug(body.subject.slug);
    }
    if (input?.entryMode) {
      const immediateNextStep =
        body.sessionFeedback?.nextSteps?.[0]
        ?? body.session?.recommendedNextStep
        ?? body.reinforcementQuestion
        ?? resolvedMessage;
      setMessage(immediateNextStep);
      if (body.session?.topic) {
        setTopic(body.session.topic);
      }
    }
    void load();
  }

  async function createExercise(input?: {
    subjectSlug?: string;
    topic?: string;
    difficultyLevel?: string;
    entryMode?: ReentryMode;
    launchState?: EntryLaunchState;
  }) {
    setError(null);
    setDynamicNextAction(null);
    const fallbackSubjectSlug =
      input?.subjectSlug ?? (subjectSlug || state.entry?.recommendedSubjectSlug || state.studentSubjects[0]?.subject?.slug || "");
    const resolvedTopic = input?.topic ?? topic;
    if (input?.launchState) {
      setEntryLaunchState(input.launchState);
      scrollToArea(input.launchState.area);
    }
    const response = await fetch("/api/mentoria/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectSlug: fallbackSubjectSlug,
        topic: resolvedTopic,
        difficultyLevel: input?.difficultyLevel ?? "medium",
        entryMode: input?.entryMode,
      }),
    });
    const body = (await response.json()) as { error?: string; exercise?: MentoriaExercise };
    setEntryLaunchState(null);
    if (!response.ok) {
      setError(body.error ?? null);
      return;
    }
    setActiveExerciseId(body.exercise?.id ?? null);
    void load();
  }

  async function submitExercise() {
    const currentExerciseId = activeExerciseId ?? state.exercises.find((exercise) => exercise.status === "pending")?.id ?? null;
    if (!currentExerciseId) return;
    setError(null);
    const response = await fetch("/api/mentoria/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "correct", exerciseId: currentExerciseId, studentAnswer: exerciseAnswer }),
    });
    const body = (await response.json()) as { error?: string; exercise?: MentoriaExercise };
    if (!response.ok) {
      setError(body.error ?? null);
      return;
    }
    pendingPostActionOutcomeRef.current = {
      source: "exercise",
      mode: getExerciseOutcomeMode(body.exercise?.score),
      subjectId: body.exercise?.subjectId,
      summary:
        (body.exercise?.score ?? 0) >= 80
          ? "La practica te ha salido con buen dominio, asi que el sistema puede empujarte un paso mas."
          : (body.exercise?.score ?? 0) < 70
            ? "La practica ha mostrado friccion, asi que el siguiente paso baja un poco la exigencia para consolidar."
            : "La practica ha quedado razonablemente bien y el siguiente paso se recoloca con continuidad natural.",
    };
    setExerciseAnswer("");
    void load();
  }

  async function regeneratePlan() {
    const response = await fetch("/api/mentoria/planner", { method: "POST" });
    if (response.ok) void load();
  }

  async function startFocus() {
    setDynamicNextAction(null);
    const stage = state.student?.learningStage ?? "eso";
    const ui = getWorkspaceUiCopy(stage);
    const selectedSubject = state.studentSubjects.find((item) => item.subject?.slug === subjectSlug);
    const response = await fetch("/api/mentoria/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        durationMinutes: focusTimer,
        subjectId: selectedSubject?.subjectId,
        notes: `${ui.focusStartNotesPrefix} ${subjectSlug}`,
      }),
    });
    const body = (await response.json()) as { focusSession?: FocusSession };
    if (response.ok) setFocusSession(body.focusSession ?? null);
  }

  async function completeFocus() {
    if (!focusSession) return;
    const stage = state.student?.learningStage ?? "eso";
    const ui = getWorkspaceUiCopy(stage);
    const response = await fetch("/api/mentoria/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", focusSessionId: focusSession.id, distractionsCount: 0, notes: ui.focusCompleteNotes }),
    });
    const body = (await response.json()) as { focusSession?: FocusSession };
    if (response.ok) {
      pendingPostActionOutcomeRef.current = {
        source: "focus",
        mode: getFocusOutcomeMode(body.focusSession?.distractionsCount ?? 0),
        subjectId: body.focusSession?.subjectId,
        summary:
          (body.focusSession?.distractionsCount ?? 0) <= 1
            ? "Has cerrado el foco con buena estabilidad y el siguiente paso puede aprovechar ese ritmo."
            : "El bloque de foco ha tenido algo de friccion, asi que el siguiente paso conviene mantenerlo claro y manejable.",
      };
      setFocusSession(null);
      setFocusTimer(25);
      void load();
    }
  }

  function applyQuickAction(action: MentoriaWorkspaceEntry["quickActions"][number]) {
    setSubjectSlug(action.subjectSlug ?? "");
    setTopic(action.topic);
    setMessage(action.prompt);
  }

  async function prepareImage() {
    if (!selectedImage) return;
    setUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", selectedImage);
      if (imageNotes.trim()) {
        formData.append("notes", imageNotes.trim());
      }
      const response = await fetch("/api/mentoria/session/image", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; image?: MentoriaPreparedImage };
      if (!response.ok || !body.image) {
        setError(body.error ?? "IMAGE_PREPARE_FAILED");
        return;
      }
      setPreparedImage(body.image);
    } finally {
      setUploadingImage(false);
    }
  }

  if (loading && !state.student) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f2e8_0%,#fbfaf7_55%,#f2f7ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[32px] bg-white/90 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-700">{initialUi.productBadge}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">{initialUi.emptyWorkspaceTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{initialUi.loading}</p>
        </div>
      </div>
    );
  }

  if (!state.student) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f2e8_0%,#fbfaf7_55%,#f2f7ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[32px] bg-white/90 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-700">{initialUi.productBadge}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">No pudimos preparar tu espacio</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {error ?? "Necesitamos recargar el estado del alumno para continuar con Mentoria."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void load();
              }}
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

  const stage = state.student.learningStage;
  const ui = getWorkspaceUiCopy(stage);
  const dashboardMessage = getMicrocopy(stage, "dashboard_message");
  const fallbackSubjectOptions = ui.fallbackSubjects;
  const latestExercise = state.exercises[0] ?? null;
  const motivationMessage =
    state.motivation?.motivationProfile === "fragile"
      ? ui.motivationFragileMessage
      : state.motivation?.motivationProfile === "high_performer"
        ? ui.motivationHighPerformerMessage
        : ui.motivationStableMessage;
  const subjectOptions = state.studentSubjects
    .map((item) => ({
      slug: item.subject?.slug ?? "",
      label: item.subject?.name ?? ui.genericSubjectLabel,
    }))
    .filter((item) => item.slug);
  const completedDailyTasks = state.dailyPlan?.tasks.filter((task) => task.completed) ?? [];
  const pendingDailyTasks = state.dailyPlan?.tasks.filter((task) => !task.completed) ?? [];
  const dailyPlanPercent = Math.round((state.dailyPlan?.completionRate ?? 0) * 100);
  const nextDailyTask = pendingDailyTasks[0] ?? null;
  const recommendedPlan = state.billing?.paywall?.recommendedPlan ?? "pro";
  const latestSession = state.recentSessions[0] ?? null;
  const latestFocusSession = state.focusSessions[0] ?? null;
  const totalSessionsCompleted = state.progress.reduce((sum, item) => sum + item.sessionsCompleted, 0);
  const totalExercisesCompleted = state.progress.reduce((sum, item) => sum + item.exercisesCompleted, 0);
  const strongestSubject = [...state.progress].sort((left, right) => right.masteryScore - left.masteryScore)[0] ?? null;
  const primaryStrength = state.evolution?.strengths[0] ?? state.memory?.strengths[0] ?? strongestSubject?.subject?.name ?? null;
  const consistencyPercent = Math.round((state.evolution?.consistencyScore ?? 0) * 100);
  const velocityPercent = Math.round((state.evolution?.progressionVelocity ?? 0) * 100);
  const todayIso = new Date().toISOString().slice(0, 10);
  const reentryReferenceAt =
    latestSession?.updatedAt ??
    latestFocusSession?.updatedAt ??
    state.motivation?.lastActivityAt ??
    null;
  const completedTasksCount = completedDailyTasks.length;
  const hoursSinceActivity = reentryReferenceAt ? (Date.now() - new Date(reentryReferenceAt).getTime()) / (1000 * 60 * 60) : null;

  function formatReentryMoment(value?: string | null) {
    if (!value) return "hace un tiempo";
    const diffMs = Date.now() - new Date(value).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 6) return "hace poco";
    if (diffHours < 24) return "hoy";
    if (diffHours < 48) return "ayer";
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return `hace ${diffDays} dias`;
  }

  function applyDailyClosureCarryOver() {
    if (!state.dailyClosure?.carryOverPrompt) return;
    const resolvedSubjectSlug =
      resolveSubjectSlugFromSubjectId(state.dailyClosure.carryOverSubjectId ?? undefined) || state.entry?.recommendedSubjectSlug || "";
    if (resolvedSubjectSlug) {
      setSubjectSlug(resolvedSubjectSlug);
    }
    if (state.dailyClosure.carryOverTopic) {
      setTopic(state.dailyClosure.carryOverTopic);
    }
    setMessage(state.dailyClosure.carryOverPrompt);
    setDailyPlanFeedback(
      state.dailyClosure.source === "event" && state.dailyClosure.closureDate < todayIso
        ? "Ayer te dejaste una pista clara y hoy puedes retomarla con ventaja, sin volver a pensar desde cero."
        : "Tu cierre de hoy ya deja un gancho preparado para que manana vuelvas con continuidad y curiosidad.",
    );
  }

  function sortTasksForGentleRestart(tasks: DailyPlan["tasks"]) {
    return [...tasks].sort((left, right) => {
      const typeWeight: Record<DailyPlan["tasks"][number]["type"], number> = {
        review: 0,
        practice: 1,
        challenge: 2,
      };
      if (typeWeight[left.type] !== typeWeight[right.type]) {
        return typeWeight[left.type] - typeWeight[right.type];
      }
      return left.difficulty - right.difficulty;
    });
  }

  function sortTasksForMomentum(tasks: DailyPlan["tasks"]) {
    return [...tasks].sort((left, right) => {
      const typeWeight: Record<DailyPlan["tasks"][number]["type"], number> = {
        challenge: 0,
        practice: 1,
        review: 2,
      };
      if (typeWeight[left.type] !== typeWeight[right.type]) {
        return typeWeight[left.type] - typeWeight[right.type];
      }
      return right.difficulty - left.difficulty;
    });
  }

  function resolveSubjectSlugFromSubjectId(subjectId?: string) {
    if (!subjectId) return "";
    return state.studentSubjects.find((item) => item.subjectId === subjectId)?.subject?.slug ?? "";
  }

  function resolveSubjectIdFromSlug(slug?: string) {
    if (!slug) return undefined;
    return state.studentSubjects.find((item) => item.subject?.slug === slug)?.subjectId;
  }

  function getSessionOutcomeMode(scoreChange: number): PostActionMode {
    if (scoreChange >= 3) return "momentum";
    if (scoreChange <= 0) return "support";
    return "steady";
  }

  function getExerciseOutcomeMode(score?: number): PostActionMode {
    if ((score ?? 0) >= 80) return "momentum";
    if ((score ?? 0) < 70) return "support";
    return "steady";
  }

  function getFocusOutcomeMode(distractionsCount: number): PostActionMode {
    if (distractionsCount <= 1) return "momentum";
    if (distractionsCount >= 3) return "support";
    return "steady";
  }

  function buildContinuationPrompt(input: {
    recommendedNextStep?: string;
    reinforcementQuestion?: string;
    nextSteps?: string[];
  }) {
    return input.nextSteps?.[0] || input.reinforcementQuestion || input.recommendedNextStep || "";
  }

  function pickDynamicNextTask(plan: DailyPlan, outcome: PostActionOutcome) {
    const pendingTasks = plan.tasks.filter((task) => !task.completed);
    if (pendingTasks.length === 0) return null;

    const preferredTypes =
      outcome.mode === "support"
        ? ["review", "practice", "challenge"]
        : outcome.mode === "momentum"
          ? ["challenge", "practice", "review"]
          : outcome.source === "focus"
            ? ["practice", "review", "challenge"]
            : ["practice", "review", "challenge"];
    const sameSubjectPending = outcome.subjectId
      ? pendingTasks.filter((task) => task.subjectId === outcome.subjectId)
      : [];

    for (const type of preferredTypes) {
      const sameSubjectMatch = sameSubjectPending.find((task) => task.type === type);
      if (sameSubjectMatch) return sameSubjectMatch;
      const genericMatch = pendingTasks.find((task) => task.type === type);
      if (genericMatch) return genericMatch;
    }

    return sameSubjectPending[0] ?? pendingTasks[0] ?? null;
  }

  function buildDynamicNextAction(plan: DailyPlan, outcome: PostActionOutcome): DynamicNextAction | null {
    const task = pickDynamicNextTask(plan, outcome);
    if (!task) return null;

    if (outcome.mode === "support") {
      return {
        mode: outcome.mode,
        badge: "Ajuste tras friccion",
        title: "Bajamos un paso para consolidar",
        explanation: `${outcome.summary} Ahora te conviene ${taskTypeLabels[task.type]} en ${task.subject} para recuperar seguridad antes de apretar mas.`,
        actionLabel: task.type === "review" ? "Abrir ayuda guiada" : "Abrir practica mas facil",
        task,
      };
    }

    if (outcome.mode === "momentum") {
      return {
        mode: outcome.mode,
        badge: "Ajuste tras buen avance",
        title: "Vamos a aprovechar que te ha salido bien",
        explanation: `${outcome.summary} El siguiente paso sube a ${task.subject} - ${taskTypeLabels[task.type]} para usar el buen momento sin perder claridad.`,
        actionLabel: task.type === "challenge" ? "Lanzar siguiente reto" : "Seguir con el siguiente bloque",
        task,
      };
    }

    return {
      mode: outcome.mode,
      badge: "Siguiente paso recalculado",
      title: "Tu siguiente accion ya se ha ajustado",
      explanation: `${outcome.summary} Lo mas natural ahora es seguir con ${task.subject} - ${taskTypeLabels[task.type]}.`,
      actionLabel: task.type === "review" ? "Abrir siguiente ayuda" : "Abrir siguiente practica",
      task,
    };
  }

  function resumeFromLatestSession(session: LearningSession) {
    const resumedSubjectSlug = resolveSubjectSlugFromSubjectId(session.subjectId);
    if (resumedSubjectSlug) {
      setSubjectSlug(resumedSubjectSlug);
    }
    setTopic(session.topic || initialUi.defaultTopic);
    setMessage(session.recommendedNextStep || session.tutorSummary || initialUi.defaultMessage);
    setDailyPlanFeedback("Seguimos donde lo dejaste. El tutor ya esta preparado con tu siguiente paso.");
  }

  function buildTaskTopic(task: DailyPlan["tasks"][number]) {
    return task.type === "review" ? `Repaso de ${task.subject}` : `${task.subject}`;
  }

  function buildTaskPrompt(task: DailyPlan["tasks"][number]) {
    if (task.type === "review") {
      return `Quiero repasar ${task.subject} paso a paso y ver que debo vigilar hoy.`;
    }
    if (task.type === "challenge") {
      return `Quiero un reto corto de ${task.subject} para comprobar si ya lo domino.`;
    }
    return `Quiero practicar ${task.subject} con una actividad guiada de ${ui.dailyPlanDifficultyPrefix}${task.difficulty}.`;
  }

  function prepareDailyPlanTask(task: DailyPlan["tasks"][number], feedbackOverride?: string) {
    const resolvedSubjectSlug = resolveSubjectSlugFromSubjectId(task.subjectId);
    if (resolvedSubjectSlug) {
      setSubjectSlug(resolvedSubjectSlug);
    }
    setTopic(buildTaskTopic(task));
    setMessage(buildTaskPrompt(task));
    setDailyPlanFeedback(
      feedbackOverride ?? `Tarea lista: ${task.subject} - ${taskTypeLabels[task.type]}. Ya puedes avanzar desde el tutor.`,
    );
  }

  async function createExerciseForTask(task: DailyPlan["tasks"][number], feedbackOverride?: string) {
    const resolvedSubjectSlug = resolveSubjectSlugFromSubjectId(task.subjectId);
    if (!resolvedSubjectSlug) {
      prepareDailyPlanTask(task, feedbackOverride);
      return;
    }

    setError(null);
    setSubjectSlug(resolvedSubjectSlug);
    setTopic(buildTaskTopic(task));
    setMessage(buildTaskPrompt(task));

    await createExercise({
      subjectSlug: resolvedSubjectSlug,
      topic: buildTaskTopic(task),
      difficultyLevel: task.difficulty >= 4 ? "hard" : task.difficulty <= 2 ? "easy" : "medium",
      launchState: {
        area: "exercise",
        title: `Preparando ${taskTypeLabels[task.type]} de ${task.subject}`,
        detail: "Te dejamos la primera accion del dia lista para que empieces sin pensar mas de la cuenta.",
      },
    });
    setDailyPlanFeedback(feedbackOverride ?? `Practica lista para ${task.subject}. Cuando la completes, el plan se actualizara aqui mismo.`);
  }

  async function startDailyPlanTask(
    task: DailyPlan["tasks"][number],
    options?: { feedbackOverride?: string; forceTutorPrep?: boolean; autoLaunch?: boolean; entryMode?: ReentryMode },
  ) {
    setDynamicNextAction(null);
    if (options?.forceTutorPrep || task.type === "review") {
      if (options?.autoLaunch) {
        await sendTutorMessage({
          subjectSlug: resolveSubjectSlugFromSubjectId(task.subjectId) || undefined,
          topic: buildTaskTopic(task),
          message: buildTaskPrompt(task),
          entryMode: options.entryMode,
          launchState: {
            area: "tutor",
            title: `Abriendo ${taskTypeLabels[task.type]} de ${task.subject}`,
            detail: "Entraras directamente en una ayuda guiada para empezar hoy con el contexto correcto.",
          },
        });
        setDailyPlanFeedback(
          options.feedbackOverride ?? `Tarea lista: ${task.subject} - ${taskTypeLabels[task.type]}. Ya puedes avanzar desde el tutor.`,
        );
        return;
      }
      prepareDailyPlanTask(task, options?.feedbackOverride);
      return;
    }
    await createExerciseForTask(task, options?.feedbackOverride);
  }

  function launchDynamicNextAction(recommendation: DynamicNextAction) {
    void startDailyPlanTask(recommendation.task, {
      autoLaunch: true,
      forceTutorPrep: recommendation.task.type === "review",
      entryMode: "plan_task",
      feedbackOverride:
        recommendation.mode === "support"
          ? `Seguimos con un paso mas guiado: ${recommendation.task.subject} - ${taskTypeLabels[recommendation.task.type]}.`
          : recommendation.mode === "momentum"
            ? `Seguimos con un paso mas ambicioso: ${recommendation.task.subject} - ${taskTypeLabels[recommendation.task.type]}.`
            : `Seguimos con la siguiente accion ajustada: ${recommendation.task.subject} - ${taskTypeLabels[recommendation.task.type]}.`,
    });
  }

  const gentleRestartTask = sortTasksForGentleRestart(pendingDailyTasks)[0] ?? null;
  const momentumTask = sortTasksForMomentum(pendingDailyTasks)[0] ?? null;
  const needsGentleRestart =
    state.motivation?.motivationProfile === "fragile" ||
    (hoursSinceActivity !== null && hoursSinceActivity >= 48);
  const hasMomentumMode =
    (state.motivation?.motivationProfile === "high_performer" || (state.motivation?.streak ?? 0) >= 4) &&
    (hoursSinceActivity === null || hoursSinceActivity <= 30);
  const reentryTask =
    needsGentleRestart
      ? (gentleRestartTask ?? nextDailyTask)
      : hasMomentumMode
        ? (momentumTask ?? nextDailyTask)
        : nextDailyTask;
  const reentryMode: ReentryMode =
    latestSession?.recommendedNextStep && !needsGentleRestart
      ? "resume_session"
      : reentryTask
        ? hasMomentumMode
          ? "momentum_push"
          : needsGentleRestart
            ? "gentle_restart"
        : "plan_task"
        : "entry";
  const closureStatusLabel =
    state.dailyClosure?.status === "completed"
      ? "Dia cerrado"
      : state.dailyClosure?.status === "needs_support"
        ? "Reenganche suave"
        : state.dailyClosure?.status === "in_progress"
          ? "Avance preparado"
          : "Cierre parcial";
  const closureLead =
    state.dailyClosure?.source === "event" && state.dailyClosure.closureDate < todayIso
      ? "Esto quedo preparado para que hoy vuelvas con ventaja"
      : "Asi queda guardado tu avance para que manana apetezca volver";
  const closureDateValue = state.dailyClosure?.closureDate ?? todayIso;
  const closureFutureLabel =
    state.dailyClosure?.status === "completed"
      ? "Mañana ya no empiezas calentando: puedes entrar directamente en el siguiente nivel de trabajo."
      : state.dailyClosure?.status === "needs_support"
        ? "Mañana la entrada sera mas amable: lo siguiente ya queda pensado para que volver cueste menos."
        : state.dailyClosure?.status === "in_progress"
          ? "Mañana retomaras con traccion: ya has hecho la parte dificil de arrancar."
          : "Mañana no te tocara decidir desde cero: ya queda una pista clara para volver.";
  const closureCarryOverLabel =
    closureDateValue < todayIso
      ? "Lo que te estaba esperando hoy"
      : "Lo que ya queda esperandote manana";
  const identityHeadline =
    (state.motivation?.streak ?? 0) >= 5 || (state.evolution?.consistencyScore ?? 0) >= 0.72
      ? "Ya estas construyendo un ritmo propio"
      : totalSessionsCompleted >= 5 || totalExercisesCompleted >= 10
        ? "Ya no estas empezando desde cero"
        : primaryStrength
          ? "Ya empiezan a verse fortalezas tuyas"
          : "Tu esfuerzo ya esta dejando huella";
  const identityNarrativeParts = [
    totalSessionsCompleted > 0 || totalExercisesCompleted > 0
      ? `Desde que empezaste llevas ${totalSessionsCompleted} sesiones y ${totalExercisesCompleted} practicas.`
      : null,
    (state.motivation?.streak ?? 0) > 0
      ? `Tu racha actual es de ${state.motivation?.streak ?? 0} dias, que ya habla de constancia y no de un intento aislado.`
      : null,
    primaryStrength
      ? `Tu perfil ya empieza a apoyarse en ${primaryStrength}, y eso se nota en como vuelves a estudiar.`
      : null,
    (state.evolution?.progressionVelocity ?? 0) >= 0.6
      ? "Tu avance ya se parece mas a una mejora sostenida que a un buen dia suelto."
      : (state.evolution?.frustrationLevel ?? 0) >= 0.55 && (state.motivation?.streak ?? 0) > 0
        ? "Aunque haya dias con mas friccion, sigues volviendo: eso tambien es progreso real."
        : null,
  ].filter(Boolean);
  const identityBadges = [
    (state.motivation?.streak ?? 0) > 0 ? `Constancia: ${state.motivation?.streak} dias` : null,
    strongestSubject ? `Dominio emergente: ${strongestSubject.subject?.name ?? strongestSubject.subjectId}` : null,
    consistencyPercent > 0 ? `Consistencia: ${consistencyPercent}%` : null,
    velocityPercent > 0 ? `Velocidad de mejora: ${velocityPercent}%` : null,
  ].filter(Boolean);
  const projectionSubjectName = strongestSubject?.subject?.name ?? primaryStrength ?? "tu materia prioritaria";
  const projectionHeadline =
    (state.motivation?.streak ?? 0) >= 5 || (state.evolution?.progressionVelocity ?? 0) >= 0.62
      ? "Tu siguiente nivel ya se empieza a ver"
      : (state.evolution?.frustrationLevel ?? 0) >= 0.5
        ? "Tu siguiente nivel alcanzable es volver con mas seguridad"
        : "Ya se intuye hacia donde puedes crecer";
  const projectionNarrative =
    (state.motivation?.streak ?? 0) >= 5 || (state.evolution?.progressionVelocity ?? 0) >= 0.62
      ? `Si mantienes este ritmo unas cuantas sesiones mas, es realista pensar que podras trabajar ${projectionSubjectName} con menos ayuda y sostener retos un poco mas largos sin perder claridad.`
      : (state.evolution?.frustrationLevel ?? 0) >= 0.5
        ? `Tu siguiente salto no es ir mas rapido, sino volver a ${projectionSubjectName} con menos bloqueo y mas autonomia. Con el ritmo actual, eso ya es un objetivo creible para los proximos dias.`
        : `Si sigues asi, ${projectionSubjectName} puede convertirse en una base cada vez mas estable: entraras antes en contexto, dudaras menos al empezar y necesitaras menos empuje externo.`;
  const projectionEvidence = [
    (state.motivation?.streak ?? 0) > 0 ? `Racha actual: ${state.motivation?.streak} dias` : null,
    consistencyPercent > 0 ? `Consistencia reciente: ${consistencyPercent}%` : null,
    velocityPercent > 0 ? `Velocidad de mejora: ${velocityPercent}%` : null,
    state.analysis?.nextActions[0] ? `Puente hacia ese nivel: ${state.analysis.nextActions[0]}` : null,
  ].filter(Boolean);

  const reentryTitle =
    reentryMode === "resume_session"
      ? `Tu ultima sesion fue ${formatReentryMoment(reentryReferenceAt)} y ya tienes un siguiente paso listo.`
      : reentryMode === "gentle_restart"
        ? "Hoy te conviene volver con una victoria rapida para recuperar ritmo."
        : reentryMode === "momentum_push"
          ? "Vienes con buena inercia. Hoy toca subir un paso sin perder claridad."
          : reentryMode === "plan_task"
            ? `Tu plan de hoy sigue esperandote con ${reentryTask?.subject ?? "tu siguiente tarea"}.`
            : "Tu siguiente paso ya esta preparado para volver sin friccion.";
  const reentryDescription =
    reentryMode === "resume_session"
      ? (latestSession?.tutorSummary ?? "Tu ultima sesion ya dejo el siguiente paso listo para continuar.")
      : reentryMode === "gentle_restart"
        ? reentryTask
          ? `Han pasado ${formatReentryMoment(reentryReferenceAt)} desde tu ultima actividad. Empezamos por ${reentryTask.subject} - ${taskTypeLabels[reentryTask.type]} para que vuelvas a engancharte sin friccion.`
          : "Hoy conviene volver con un paso sencillo y guiado para recuperar ritmo."
        : reentryMode === "momentum_push"
          ? reentryTask
            ? `Tu racha va bien y puedes asumir ${reentryTask.subject} - ${taskTypeLabels[reentryTask.type]} como primera accion del dia.`
            : "Tu momento de hoy pide una accion un poco mas exigente para mantener el avance."
          : reentryMode === "plan_task"
            ? reentryTask
              ? `Llevas ${completedTasksCount} ${completedTasksCount === 1 ? "tarea cerrada" : "tareas cerradas"} y la siguiente es ${reentryTask.subject} - ${taskTypeLabels[reentryTask.type]}.`
              : (state.entry?.subheadline ?? "Tu espacio ya tiene contexto suficiente para guiarte desde el primer clic.")
            : state.entry?.subheadline ?? "Tu espacio ya tiene contexto suficiente para guiarte desde el primer clic.";
  const reentryPrimaryLabel =
    reentryMode === "resume_session"
      ? "Retomar ultimo paso"
      : reentryMode === "gentle_restart"
        ? "Volver con algo facil"
        : reentryMode === "momentum_push"
          ? "Subir un paso hoy"
          : reentryMode === "plan_task"
            ? "Volver al plan de hoy"
            : "Empezar ahora";
  const reentryModeBadge =
    reentryMode === "resume_session"
      ? "Modo de hoy: continuidad"
      : reentryMode === "gentle_restart"
        ? "Modo de hoy: vuelta suave"
        : reentryMode === "momentum_push"
          ? "Modo de hoy: subir un paso"
          : reentryMode === "plan_task"
            ? "Modo de hoy: plan del dia"
            : "Modo de hoy: entrada guiada";
  const reentryWhyToday =
    reentryMode === "resume_session"
      ? `Tu ultima sesion ya dejo una accion concreta y retomar ahora evita volver a pensar desde cero.`
      : reentryMode === "gentle_restart"
        ? state.motivation?.motivationProfile === "fragile"
          ? "Hoy priorizamos un arranque suave porque tu ritmo reciente necesita recuperar confianza antes de exigir mas."
          : `Hoy priorizamos un arranque suave porque llevas ${formatReentryMoment(reentryReferenceAt)} sin entrar y conviene recuperar traccion rapido.`
        : reentryMode === "momentum_push"
          ? `Hoy te proponemos un paso un poco mas ambicioso porque llevas ${state.motivation?.streak ?? 0} dias de ritmo y tu inercia esta a favor.`
          : reentryMode === "plan_task"
            ? `Hoy lo mas sensato es seguir el plan: ya llevas ${dailyPlanPercent}% del dia encaminado y esta es la siguiente pieza natural.`
            : "Hoy te dejamos un punto de entrada simple para que no tengas que decidir por donde empezar.";
  const reentryOutcome =
    reentryMode === "resume_session"
      ? "Si haces clic, el tutor abre justo el siguiente paso que dejaste preparado en tu ultima sesion."
      : reentryMode === "gentle_restart"
        ? "Si haces clic, entraras en una accion facil y guiada para volver a coger ritmo sin friccion."
        : reentryMode === "momentum_push"
          ? "Si haces clic, empezaras por una accion mas potente, pensada para aprovechar tu buen momento de hoy."
          : reentryMode === "plan_task"
            ? "Si haces clic, entraras directamente en la siguiente tarea util del plan de hoy."
            : "Si haces clic, el sistema te dejara la entrada preparada con el mejor prompt disponible ahora mismo.";

  function handleReentryPrimaryAction() {
    if (reentryMode === "resume_session" && latestSession) {
      void sendTutorMessage({
        subjectSlug: resolveSubjectSlugFromSubjectId(latestSession.subjectId) || undefined,
        topic: latestSession.topic || initialUi.defaultTopic,
        message: latestSession.recommendedNextStep || latestSession.tutorSummary || initialUi.defaultMessage,
        entryMode: "resume_session",
        launchState: {
          area: "tutor",
          title: "Retomando tu siguiente paso",
          detail: "Te llevamos directo al punto que ya habias dejado preparado para no perder contexto.",
        },
      });
      setDailyPlanFeedback("Seguimos donde lo dejaste. El tutor ya esta preparado con tu siguiente paso.");
      return;
    }
    if (reentryMode === "gentle_restart" && reentryTask) {
      void startDailyPlanTask(reentryTask, {
        forceTutorPrep: true,
        autoLaunch: true,
        entryMode: "gentle_restart",
        feedbackOverride: `Hoy toca volver con un paso facil: ${reentryTask.subject} - ${taskTypeLabels[reentryTask.type]}. Empieza sin presion y el siguiente paso se ajustara despues.`,
      });
      return;
    }
    if (reentryMode === "momentum_push" && reentryTask) {
      void startDailyPlanTask(reentryTask, {
        autoLaunch: true,
        entryMode: "momentum_push",
        feedbackOverride: `Hoy vienes con ritmo: ${reentryTask.subject} - ${taskTypeLabels[reentryTask.type]}. Vamos a aprovecharlo con una primera accion un poco mas ambiciosa.`,
      });
      return;
    }
    if (reentryMode === "plan_task" && reentryTask) {
      void startDailyPlanTask(reentryTask, { autoLaunch: true, entryMode: "plan_task" });
      return;
    }
    if (state.entry?.recommendedPrompt) {
      setSubjectSlug(state.entry.recommendedSubjectSlug ?? "");
      setTopic(state.entry.recommendedTopic);
      setMessage(state.entry.recommendedPrompt);
      setDailyPlanFeedback("Tu punto de reentrada ya esta preparado para que vuelvas a empezar sin pensar demasiado.");
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f2e8_0%,#fbfaf7_55%,#f2f7ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[32px] bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-700">{ui.productBadge}</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">{`${ui.greetingPrefix}, ${state.student.fullName}`}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{dashboardMessage}</p>
            </div>
            <div className="rounded-3xl bg-emerald-50 px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">{ui.courseLabel}</div>
              <div className="mt-1 text-xl font-bold">{state.student.schoolYear}</div>
            </div>
          </div>
        </div>

        {loading ? <div className="rounded-3xl bg-white p-6">{ui.loading}</div> : null}
        {error ? <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {dailyPlanFeedback ? (
          <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {dailyPlanFeedback}
          </div>
        ) : null}
        {dynamicNextAction ? (
          <section className="mb-6 rounded-[28px] border border-sky-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">{dynamicNextAction.badge}</div>
                <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{dynamicNextAction.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{dynamicNextAction.explanation}</p>
                <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                  {`Siguiente accion: ${dynamicNextAction.task.subject} - ${taskTypeLabels[dynamicNextAction.task.type]}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => launchDynamicNextAction(dynamicNextAction)}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                {dynamicNextAction.actionLabel}
              </button>
            </div>
          </section>
        ) : null}
        {state.dailyClosure ? (
          <section className="mb-6 rounded-[28px] border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">{closureLead}</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{state.dailyClosure.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{state.dailyClosure.summary}</p>
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Por que merece la pena volver</div>
                  <div className="mt-2">{closureFutureLabel}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-900">{closureStatusLabel}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-2">{`${state.dailyClosure.completedTasks}/${state.dailyClosure.totalTasks} tareas cerradas`}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-2">{`${Math.round(state.dailyClosure.completionRate * 100)}% del dia`}</span>
                  <span className="rounded-full bg-sky-100 px-3 py-2 text-sky-900">
                    {closureDateValue < todayIso ? "Preparado para hoy" : "Preparado para manana"}
                  </span>
                </div>
                {state.dailyClosure.carryOverPrompt ? (
                  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">{closureCarryOverLabel}</div>
                    <div className="mt-2">{state.dailyClosure.carryOverPrompt}</div>
                  </div>
                ) : null}
              </div>
              {state.dailyClosure.carryOverPrompt ? (
                <button
                  type="button"
                  onClick={applyDailyClosureCarryOver}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                >
                  {closureDateValue < todayIso ? "Volver justo por aqui" : "Ver el siguiente paso que dejas preparado"}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
        {(latestSession || nextDailyTask || state.entry) ? (
          <section className="mb-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Seguimos donde lo dejaste</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {reentryTitle}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {reentryDescription}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Por que hoy</div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">{reentryWhyToday}</div>
                  </div>
                  <div className="rounded-2xl bg-sky-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">Que pasa si sigues</div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">{reentryOutcome}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-2">{reentryModeBadge}</span>
                  {reentryReferenceAt ? (
                    <span className="rounded-full bg-slate-100 px-3 py-2">{`Ultima actividad: ${formatReentryMoment(reentryReferenceAt)}`}</span>
                  ) : null}
                  {latestSession?.recommendedNextStep && reentryMode === "resume_session" ? (
                    <span className="rounded-full bg-sky-100 px-3 py-2 text-sky-900">{`Retoma: ${latestSession.recommendedNextStep}`}</span>
                  ) : null}
                  {reentryTask ? (
                    <span className="rounded-full bg-amber-100 px-3 py-2 text-amber-900">{`Arranque recomendado: ${reentryTask.subject} - ${taskTypeLabels[reentryTask.type]}`}</span>
                  ) : null}
                  {state.motivation ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-900">{`Racha actual: ${state.motivation.streak} dias`}</span>
                  ) : null}
                  {state.dailyPlan ? (
                    <span className="rounded-full bg-violet-100 px-3 py-2 text-violet-900">{`Plan de hoy: ${dailyPlanPercent}%`}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleReentryPrimaryAction}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                >
                  {reentryPrimaryLabel}
                </button>
                {nextDailyTask ? (
                  <button
                    type="button"
                    onClick={() => prepareDailyPlanTask(nextDailyTask)}
                    className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold"
                  >
                    Ver siguiente tarea
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {state.entry ? (
          <section className="mb-6 rounded-[28px] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] p-6 text-white shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200">Tu siguiente mejor paso</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">{state.entry.headline}</h2>
                <p className="mt-3 text-sm leading-6 text-sky-100">{state.entry.subheadline}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-sky-100">
                  <span className="rounded-full bg-white/10 px-3 py-2">{`Materia sugerida: ${state.entry.recommendedTopic}`}</span>
                  {state.memory?.suggestedDifficulty ? <span className="rounded-full bg-white/10 px-3 py-2">{`Ritmo recomendado: ${state.memory.suggestedDifficulty}`}</span> : null}
                  {state.memory?.nextPriorityTask ? <span className="rounded-full bg-white/10 px-3 py-2">{`Siguiente tarea: ${state.memory.nextPriorityTask}`}</span> : null}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {state.entry.quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => applyQuickAction(action)}
                    className="rounded-3xl bg-white/10 p-4 text-left transition hover:bg-white/20"
                  >
                    <div className="text-sm font-bold">{action.label}</div>
                    <div className="mt-2 text-xs leading-5 text-sky-100">{action.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {state.billing ? (
          <section className="mb-6 rounded-[28px] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold">{ui.billingTitle}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {`${ui.billingPlanLabel}: ${state.billing.planLabel} - ${ui.billingUsageLabel}: ${state.billing.usage.guidedSessionsToday}/${state.billing.limits.guidedSessionsPerDay} sesiones, ${state.billing.usage.exercisesToday}/${state.billing.limits.exercisesPerDay} practicas.`}
                </p>
                {state.billing.paywall ? <p className="mt-3 text-sm text-amber-700">{state.billing.paywall.message}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {state.billing.paywall?.canManageBilling ? (
                  <button
                    onClick={() => startCheckout(recommendedPlan)}
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                  >
                    {ui.billingUpgradeAction}
                  </button>
                ) : null}
                {state.billing.planCode !== "free" ? (
                  <button onClick={openBillingPortal} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold">
                    {ui.billingManageAction}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {state.motivation ? (
          <section className="mb-6 rounded-[28px] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold">{ui.motivationTitle}</h2>
                <p className="mt-2 text-sm text-slate-600">{motivationMessage}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-3xl bg-emerald-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">{ui.streakLabel}</div>
                  <div className="mt-1 text-2xl font-bold">{state.motivation.streak}</div>
                </div>
                <div className="rounded-3xl bg-sky-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-sky-700">{ui.effortLabel}</div>
                  <div className="mt-1 text-2xl font-bold">{`${Math.round(state.motivation.effortScore * 100)}%`}</div>
                </div>
                <div className="rounded-3xl bg-amber-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-700">{ui.levelLabel}</div>
                  <div className="mt-1 text-2xl font-bold">{state.motivation.level}</div>
                </div>
                <div className="rounded-3xl bg-rose-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-rose-700">{ui.pointsLabel}</div>
                  <div className="mt-1 text-2xl font-bold">{state.motivation.rewardPoints}</div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold">{ui.achievementsTitle}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {state.motivation.achievements.length > 0 ? (
                  state.motivation.achievements.slice(0, 6).map((achievement) => (
                    <div key={achievement} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                      {achievement}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">{ui.noAchievements}</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {state.dailyPlan ? (
          <section className="mb-6 rounded-[28px] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold">{ui.dailyPlanTitle}</h2>
                <p className="mt-2 text-sm text-slate-600">{state.dailyPlan.adaptationReason}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl bg-violet-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-violet-700">{ui.dailyPlanDurationLabel}</div>
                  <div className="mt-1 text-2xl font-bold">{`${state.dailyPlan.recommendedDuration} ${ui.focusMinutesSuffix}`}</div>
                </div>
                <div className="rounded-3xl bg-cyan-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-700">{ui.dailyPlanPriorityLabel}</div>
                  <div className="mt-1 text-2xl font-bold">{ui.dailyPlanPriorityValues[state.dailyPlan.priority]}</div>
                </div>
                <div className="rounded-3xl bg-emerald-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">{ui.dailyPlanProgressLabel}</div>
                  <div className="mt-1 text-2xl font-bold">{`${dailyPlanPercent}%`}</div>
                </div>
              </div>
            </div>
            {nextDailyTask ? (
              <div className="mt-5 rounded-3xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Empieza por aqui</div>
                <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{nextDailyTask.subject}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {`${taskTypeLabels[nextDailyTask.type]} - ${ui.dailyPlanDifficultyPrefix}${nextDailyTask.difficulty}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void startDailyPlanTask(nextDailyTask);
                    }}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {nextDailyTask.type === "review" ? "Preparar con el tutor" : "Crear practica ahora"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="text-sm font-semibold">{ui.dailyPlanReasonLabel}</div>
                <div className="mt-3 space-y-3">
                  {(pendingDailyTasks.length > 0 ? pendingDailyTasks : state.dailyPlan.tasks).map((task) => (
                    <div key={task.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{task.subject}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {ui.dailyPlanTaskTypes[task.type]}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                            Pendiente
                          </div>
                          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{`${ui.dailyPlanDifficultyPrefix}${task.difficulty}`}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void startDailyPlanTask(task);
                          }}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        >
                          {task.type === "review" ? "Preparar con el tutor" : "Crear practica ahora"}
                        </button>
                        <button
                          type="button"
                          onClick={() => prepareDailyPlanTask(task)}
                          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
                        >
                          Guiarme con esta tarea
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="text-sm font-semibold">{ui.dailyPlanCompletedLabel}</div>
                <div className="mt-3 space-y-3">
                  {completedDailyTasks.length > 0 ? (
                    completedDailyTasks.map((task) => (
                      <div key={task.id} className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-900">
                        <div className="flex items-center justify-between gap-3">
                          <span>{`${task.subject} - ${ui.dailyPlanTaskTypes[task.type]}`}</span>
                          <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-900">
                            Hecha
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">{ui.dailyPlanCompletedEmpty}</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section id="mentoria-tutor-card" className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">{ui.tutorTitle}</h2>
                <button onClick={() => void createExercise()} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  {ui.tutorAction}
                </button>
              </div>
              {entryLaunchState?.area === "tutor" ? (
                <div className="mb-4 rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3">
                  <div className="text-sm font-semibold text-sky-900">{entryLaunchState.title}</div>
                  <div className="mt-1 text-sm text-slate-700">{entryLaunchState.detail}</div>
                </div>
              ) : null}
              <div className="mb-4 rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {`Escribe tu duda con naturalidad. Si dejas la materia en automatico, Mentoria la detecta segun tu mensaje, tu plan y tus dificultades guardadas.`}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select value={subjectSlug} onChange={(event) => setSubjectSlug(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <option value="">Materia automatica</option>
                  {(subjectOptions.length > 0 ? subjectOptions : fallbackSubjectOptions).map((subject) => (
                    <option key={subject.slug} value={subject.slug}>{subject.label}</option>
                  ))}
                </select>
                <input value={topic} onChange={(event) => setTopic(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder={ui.topicPlaceholder} />
              </div>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="mt-3 min-h-32 w-full rounded-3xl border border-slate-200 px-4 py-4" />
              <div className="mt-3 rounded-3xl border border-dashed border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Preparar una imagen para una futura interpretacion</div>
                    <div className="mt-1 text-xs text-slate-500">Puedes dejar lista una foto de ejercicio o apuntes. Hoy la recibimos, la normalizamos y la dejamos preparada para vision.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
                      className="max-w-xs text-sm"
                    />
                    <button
                      onClick={prepareImage}
                      disabled={!selectedImage || uploadingImage}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadingImage ? "Preparando..." : "Preparar imagen"}
                    </button>
                  </div>
                </div>
                <input
                  value={imageNotes}
                  onChange={(event) => setImageNotes(event.target.value)}
                  placeholder="Que quieres que tenga en cuenta cuando activemos vision"
                  className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
                {preparedImage ? (
                  <div className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-slate-700">
                    <div className="font-semibold">{preparedImage.fileName}</div>
                    <div className="mt-1">{preparedImage.summary}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-sky-700">{preparedImage.status}</div>
                  </div>
                ) : null}
              </div>
              <button onClick={() => void sendTutorMessage()} className="mt-3 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">
                {ui.tutorButton}
              </button>
              {tutorResult ? (
                <div className="mt-4 rounded-3xl bg-emerald-50 p-4 text-sm leading-7 text-slate-700">
                  {tutorResult.subjectName ? <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{tutorResult.subjectName}</div> : null}
                  {tutorResult.completionMessage ? (
                    <div className="mb-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900">
                      {tutorResult.completionMessage}
                    </div>
                  ) : null}
                  <p className="font-medium">{tutorResult.explanation}</p>
                  {tutorResult.progressMessage ? (
                    <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                      {tutorResult.progressMessage}
                    </div>
                  ) : null}
                  {tutorResult.encouragement ? (
                    <div className="mt-3 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-950">
                      {tutorResult.encouragement}
                    </div>
                  ) : null}
                  {tutorResult.suggestedSteps.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {tutorResult.suggestedSteps.map((step, index) => (
                        <div key={`${step}-${index}`} className="rounded-2xl bg-white px-4 py-3">
                          {`${index + 1}. ${step}`}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {tutorResult.reinforcementQuestion ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                      <strong>Pregunta de refuerzo:</strong> {tutorResult.reinforcementQuestion}
                    </div>
                  ) : null}
                  {buildContinuationPrompt({
                    recommendedNextStep: tutorResult.recommendedNextStep,
                    reinforcementQuestion: tutorResult.reinforcementQuestion,
                    nextSteps: tutorResult.nextSteps,
                  }) ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (tutorResult.subjectSlug) {
                          setSubjectSlug(tutorResult.subjectSlug);
                        }
                        if (tutorResult.topic) {
                          setTopic(tutorResult.topic);
                        }
                        setMessage(
                          buildContinuationPrompt({
                            recommendedNextStep: tutorResult.recommendedNextStep,
                            reinforcementQuestion: tutorResult.reinforcementQuestion,
                            nextSteps: tutorResult.nextSteps,
                          }),
                        );
                      }}
                      className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Continuar con este siguiente paso
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">{ui.plannerTitle}</h2>
                <button onClick={regeneratePlan} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
                  {ui.plannerAction}
                </button>
              </div>
              <p className="text-sm text-slate-600">{state.plan?.goalsSummary ?? ui.plannerEmpty}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(state.plan?.blocks ?? []).map((block) => (
                  <div key={block.id} className="rounded-3xl bg-slate-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{block.day}</div>
                    <div className="mt-1 text-lg font-bold">{block.title}</div>
                    <p className="mt-2 text-sm text-slate-600">{block.goal}</p>
                    <div className="mt-3 text-sm font-semibold text-emerald-700">{`${block.durationMinutes} ${ui.focusMinutesSuffix}`}</div>
                  </div>
                ))}
              </div>
            </section>

            <section id="mentoria-exercise-card" className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">{ui.exercisesTitle}</h2>
              {entryLaunchState?.area === "exercise" ? (
                <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-sm font-semibold text-amber-900">{entryLaunchState.title}</div>
                  <div className="mt-1 text-sm text-slate-700">{entryLaunchState.detail}</div>
                </div>
              ) : null}
              {latestExercise ? (
                <div className="mt-4 rounded-3xl bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-800">{latestExercise.prompt}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.2em] text-amber-700">{latestExercise.expectedCompetency}</div>
                  <ul className="mt-3 space-y-1 text-sm text-slate-700">
                    {latestExercise.hints.map((hint, index) => <li key={index}>{`${ui.hintPrefix} ${index + 1}: ${hint}`}</li>)}
                  </ul>
                  <textarea value={exerciseAnswer} onChange={(event) => setExerciseAnswer(event.target.value)} className="mt-3 min-h-24 w-full rounded-2xl border border-amber-200 px-4 py-3" placeholder={ui.exercisePlaceholder} />
                  <button onClick={submitExercise} className="mt-3 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950">
                    {ui.exerciseAction}
                  </button>
                  {latestExercise.correctionFeedback ? <div className="mt-3 rounded-2xl bg-white p-3 text-sm">{latestExercise.correctionFeedback}</div> : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">{ui.exerciseEmpty}</p>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">{ui.progressTitle}</h2>
              {(identityNarrativeParts.length > 0 || identityBadges.length > 0) ? (
                <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Lo que ya esta cambiando</div>
                  <div className="mt-2 text-lg font-black tracking-tight text-slate-950">{identityHeadline}</div>
                  <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                    {identityNarrativeParts.map((part) => (
                      <p key={part}>{part}</p>
                    ))}
                  </div>
                  {identityBadges.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                      {identityBadges.map((badge) => (
                        <span key={badge} className="rounded-full bg-white px-3 py-2">
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {projectionEvidence.length > 0 ? (
                <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Lo que puede pasar si sigues asi</div>
                  <div className="mt-2 text-lg font-black tracking-tight text-slate-950">{projectionHeadline}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">{projectionNarrative}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                    {projectionEvidence.map((evidence) => (
                      <span key={evidence} className="rounded-full bg-white px-3 py-2">
                        {evidence}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                {state.progress.map((item) => (
                  <div key={item.id} className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{item.subject?.name ?? ui.genericSubjectLabel}</div>
                      <div className="text-sm text-slate-500">{`${item.masteryScore}%`}</div>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${item.masteryScore}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {state.analysis ? (
                <div className="mt-4 rounded-3xl bg-sky-50 p-4 text-sm text-slate-700">
                  <p><strong>{`${ui.progressReinforcement}:`}</strong> {state.analysis.weakSubjects.join(", ") || ui.progressNoAlerts}</p>
                  <p className="mt-2"><strong>{`${ui.progressNextStep}:`}</strong> {state.analysis.nextActions[0]}</p>
                </div>
              ) : null}
            </section>

            <MentoriaFocusMode
              student={state.student}
              motivation={state.motivation}
              focusTimer={focusTimer}
              focusSession={focusSession}
              onTimerSelect={setFocusTimer}
              onStart={startFocus}
              onComplete={completeFocus}
            />

            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Memoria del alumno</h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Errores que vigilar</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {state.memory?.commonMistakes.length ? state.memory.commonMistakes.join(", ") : "Aun no hay errores recurrentes guardados."}
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Puntos de apoyo</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {state.memory?.strengths.length ? state.memory.strengths.join(", ") : "Todavia estamos detectando fortalezas."}
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Atencion en la siguiente sesion</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {state.memory?.watchouts.length ? state.memory.watchouts.join(", ") : "Mantener una progresion estable y guiada."}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Hooks para familia y WhatsApp</h2>
              <div className="mt-4 space-y-3">
                {state.guardianHooks.length > 0 ? state.guardianHooks.map((hook) => (
                  <div key={hook.id} className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{hook.title}</div>
                      <div className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">{hook.category}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">{hook.summary}</div>
                  </div>
                )) : (
                  <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">Todavia no hay eventos listos para compartir con familia.</div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Actividad reciente</h2>
              <div className="mt-4 space-y-3">
                {latestSession ? (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <div className="text-sm font-semibold">Ultima sesion</div>
                    <div className="mt-2 text-sm text-slate-600">{latestSession.topic || "Sesion guiada"}</div>
                    <div className="mt-2 text-sm text-slate-700">{latestSession.tutorSummary}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{latestSession.recommendedNextStep}</div>
                    <button
                      type="button"
                      onClick={() => resumeFromLatestSession(latestSession)}
                      className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
                    >
                      Retomar esta sesion
                    </button>
                  </div>
                ) : null}
                {latestFocusSession ? (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <div className="text-sm font-semibold">Ultimo bloque de foco</div>
                    <div className="mt-2 text-sm text-slate-600">{`${latestFocusSession.durationMinutes} minutos - ${latestFocusSession.distractionsCount} distracciones`}</div>
                  </div>
                ) : null}
                {!latestSession && !latestFocusSession ? (
                  <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">Cuando empieces a usar Mentoria veras aqui tu rastro real de estudio.</div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">{ui.parentsTitle}</h2>
              <div className="mt-4 space-y-3">
                {state.parents.map((parent) => (
                  <div key={parent.id} className="rounded-3xl bg-rose-50 p-4">
                    <div className="font-semibold">{parent.fullName}</div>
                    <div className="text-sm text-slate-600">{parent.relation}</div>
                  </div>
                ))}
              </div>
              <Link href="/mentoria/app/parents" className="mt-4 inline-block text-sm font-semibold text-rose-700">{ui.parentsAction}</Link>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

