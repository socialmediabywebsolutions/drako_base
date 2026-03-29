"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MentoriaFocusMode } from "@/components/mentoria-app/focus-mode";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy, getWorkspaceUiCopy } from "@/lib/mentoria/microcopy";
import type {
  DailyPlan,
  FocusSession,
  LearningSession,
  MentoriaBillingSummary,
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
  guardianHooks: MentoriaGuardianHookEvent[];
};

type TutorResult = {
  reply: string;
  explanation: string;
  suggestedSteps: string[];
  reinforcementQuestion: string;
  subjectName?: string;
};

export function MentoriaWorkspace() {
  const initialUi = getWorkspaceUiCopy("eso");
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
      guardianHooks: [],
    });
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const workspaceBody = (await workspaceRes.json()) as WorkspaceState & {
        student?: StudentProfile;
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
        guardianHooks?: MentoriaGuardianHookEvent[];
      };

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
        guardianHooks: workspaceBody.guardianHooks ?? [],
      });
      if (!hasAppliedEntry && workspaceBody.entry) {
        setSubjectSlug(workspaceBody.entry.recommendedSubjectSlug ?? "");
        setTopic(workspaceBody.entry.recommendedTopic);
        setMessage(workspaceBody.entry.recommendedPrompt);
        setHasAppliedEntry(true);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : null);
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

  async function sendTutorMessage() {
    setError(null);
    setTutorResult(null);
    const response = await fetch("/api/mentoria/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectSlug: subjectSlug || undefined, topic, message }),
    });
    const body = (await response.json()) as {
      error?: string;
      reply?: string;
      explanation?: string;
      suggestedSteps?: string[];
      reinforcementQuestion?: string;
      subject?: { name?: string; slug?: string };
    };
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
    } : null);
    if (body.subject?.slug) {
      setSubjectSlug(body.subject.slug);
    }
    void load();
  }

  async function createExercise() {
    setError(null);
    const fallbackSubjectSlug = subjectSlug || state.entry?.recommendedSubjectSlug || state.studentSubjects[0]?.subject?.slug || "";
    const response = await fetch("/api/mentoria/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectSlug: fallbackSubjectSlug, topic, difficultyLevel: "medium" }),
    });
    const body = (await response.json()) as { error?: string; exercise?: MentoriaExercise };
    if (!response.ok) {
      setError(body.error ?? null);
      return;
    }
    setActiveExerciseId(body.exercise?.id ?? null);
    void load();
  }

  async function submitExercise() {
    if (!activeExerciseId) return;
    setError(null);
    const response = await fetch("/api/mentoria/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "correct", exerciseId: activeExerciseId, studentAnswer: exerciseAnswer }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? null);
      return;
    }
    setExerciseAnswer("");
    void load();
  }

  async function regeneratePlan() {
    const response = await fetch("/api/mentoria/planner", { method: "POST" });
    if (response.ok) void load();
  }

  async function startFocus() {
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
    if (response.ok) {
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

  if (!state.student) {
    return null;
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
  const recommendedPlan = state.billing?.paywall?.recommendedPlan ?? "pro";
  const latestSession = state.recentSessions[0] ?? null;
  const latestFocusSession = state.focusSessions[0] ?? null;

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
                  {`${ui.billingPlanLabel}: ${state.billing.planLabel} · ${ui.billingUsageLabel}: ${state.billing.usage.guidedSessionsToday}/${state.billing.limits.guidedSessionsPerDay} sesiones, ${state.billing.usage.exercisesToday}/${state.billing.limits.exercisesPerDay} practicas.`}
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
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{`${ui.dailyPlanDifficultyPrefix}${task.difficulty}`}</div>
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
                        {`${task.subject} · ${ui.dailyPlanTaskTypes[task.type]}`}
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
            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">{ui.tutorTitle}</h2>
                <button onClick={createExercise} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  {ui.tutorAction}
                </button>
              </div>
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
              <button onClick={sendTutorMessage} className="mt-3 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">
                {ui.tutorButton}
              </button>
              {tutorResult ? (
                <div className="mt-4 rounded-3xl bg-emerald-50 p-4 text-sm leading-7 text-slate-700">
                  {tutorResult.subjectName ? <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{tutorResult.subjectName}</div> : null}
                  <p className="font-medium">{tutorResult.explanation}</p>
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

            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">{ui.exercisesTitle}</h2>
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
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{latestSession.recommendedNextStep}</div>
                  </div>
                ) : null}
                {latestFocusSession ? (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <div className="text-sm font-semibold">Ultimo bloque de foco</div>
                    <div className="mt-2 text-sm text-slate-600">{`${latestFocusSession.durationMinutes} minutos · ${latestFocusSession.distractionsCount} distracciones`}</div>
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
              <a href="/mentoria/app/parents" className="mt-4 inline-block text-sm font-semibold text-rose-700">{ui.parentsAction}</a>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
