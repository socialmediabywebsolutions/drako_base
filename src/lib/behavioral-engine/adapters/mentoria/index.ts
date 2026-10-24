import type {
  BehavioralContext,
  BehavioralShadowComparison,
  BehaviorSignals,
  BehavioralTaskCandidate,
  NextBestAction,
  UserState,
} from "@/lib/behavioral-engine/contracts";
import { runBehavioralEngine } from "@/lib/behavioral-engine/engine-core";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type {
  DailyPlan,
  LearningSession,
  MentoriaDailyClosureSummary,
  MentoriaWorkspaceEntry,
  StudentProfile,
} from "@/lib/mentoria/types";

type MentoriaBehavioralSnapshot = {
  actor: {
    userId: string;
    tenantId: string;
  };
  student: StudentProfile;
  dailyPlan: DailyPlan | null;
  motivation: MotivationState | null;
  recentSessions: LearningSession[];
  entry: MentoriaWorkspaceEntry | null;
  dailyClosure: MentoriaDailyClosureSummary | null;
  evolution: StudentEvolutionProfile | null;
  nowIso?: string;
};

function toIsoDay(value?: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function hoursSince(value?: string | null, nowIso?: string): number | null {
  if (!value) return null;
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now - timestamp) / (1000 * 60 * 60));
}

function mapPendingTasks(dailyPlan: DailyPlan | null): BehavioralTaskCandidate[] {
  return (dailyPlan?.tasks ?? [])
    .filter((task) => !task.completed)
    .map((task) => ({
      id: task.id,
      subject: task.subject,
      subjectId: task.subjectId ?? null,
      type: task.type,
      difficulty: task.difficulty,
      completed: task.completed,
    }));
}

function pickLifecycleStage(input: {
  hoursSinceActivity: number | null;
  recentSessions: LearningSession[];
  dailyPlan: DailyPlan | null;
}): UserState["lifecycleStage"] {
  if (input.recentSessions.length === 0 && (input.dailyPlan?.completedTaskIds.length ?? 0) === 0) {
    return "new";
  }
  if ((input.hoursSinceActivity ?? 0) >= 24) {
    return "returning";
  }
  return "active";
}

function sortTasksForGentleRestart(tasks: BehavioralTaskCandidate[]): BehavioralTaskCandidate[] {
  const typeWeight: Record<BehavioralTaskCandidate["type"], number> = {
    review: 0,
    practice: 1,
    challenge: 2,
    other: 3,
  };

  return [...tasks].sort((left, right) => {
    if (typeWeight[left.type] !== typeWeight[right.type]) {
      return typeWeight[left.type] - typeWeight[right.type];
    }
    return (left.difficulty ?? 0) - (right.difficulty ?? 0);
  });
}

function sortTasksForMomentum(tasks: BehavioralTaskCandidate[]): BehavioralTaskCandidate[] {
  const typeWeight: Record<BehavioralTaskCandidate["type"], number> = {
    challenge: 0,
    practice: 1,
    review: 2,
    other: 3,
  };

  return [...tasks].sort((left, right) => {
    if (typeWeight[left.type] !== typeWeight[right.type]) {
      return typeWeight[left.type] - typeWeight[right.type];
    }
    return (right.difficulty ?? 0) - (left.difficulty ?? 0);
  });
}

function buildCurrentMentoriaAction(input: {
  signals: BehaviorSignals;
  context: BehavioralContext;
}): NextBestAction {
  const { signals, context } = input;
  const nextDailyTask = signals.pendingTasks[0] ?? null;
  const gentleRestartTask = sortTasksForGentleRestart(signals.pendingTasks)[0] ?? null;
  const momentumTask = sortTasksForMomentum(signals.pendingTasks)[0] ?? null;
  const needsGentleRestart =
    signals.motivationProfile === "fragile"
    || ((signals.hoursSinceActivity ?? 0) >= 48);
  const hasMomentumMode =
    (signals.motivationProfile === "high_performer" || signals.streak >= 4)
    && (signals.hoursSinceActivity === null || signals.hoursSinceActivity <= 30);
  const reentryTask =
    needsGentleRestart
      ? (gentleRestartTask ?? nextDailyTask)
      : hasMomentumMode
        ? (momentumTask ?? nextDailyTask)
        : nextDailyTask;

  if (signals.recentSessionRecommendedNextStep && !needsGentleRestart && context.availableActions.canResumeSession) {
    return {
      strategy: "resume_session",
      title: "Retomar ultimo paso",
      description: "La sesion anterior ya dejo un siguiente paso listo para continuar.",
      rationale: ["Sesion reciente con recommendedNextStep.", "No hay necesidad de reinicio suave."],
      confidence: 0.94,
      task: null,
      prompt: signals.recentSessionRecommendedNextStep,
    };
  }

  if (reentryTask) {
    if (hasMomentumMode) {
      return {
        strategy: "momentum_push",
        title: "Subir un paso hoy",
        description: "La mejor primera accion del dia puede ser un poco mas exigente.",
        rationale: ["Racha alta o perfil high_performer.", `Tarea elegida: ${reentryTask.subject} - ${reentryTask.type}.`],
        confidence: 0.9,
        task: reentryTask,
        prompt: null,
      };
    }

    if (needsGentleRestart) {
      return {
        strategy: "gentle_restart",
        title: "Volver con algo facil",
        description: "La mejor primera accion del dia debe recuperar traccion sin friccion.",
        rationale: ["Perfil fragile o mucho tiempo sin actividad.", `Tarea elegida: ${reentryTask.subject} - ${reentryTask.type}.`],
        confidence: 0.9,
        task: reentryTask,
        prompt: null,
      };
    }

    return {
      strategy: "plan_task",
      title: "Volver al plan de hoy",
      description: "La continuidad natural viene de la siguiente tarea pendiente del plan.",
      rationale: ["Hay tarea pendiente y no hay una senal mas fuerte."],
      confidence: 0.86,
      task: reentryTask,
      prompt: null,
    };
  }

  return {
    strategy: "entry",
    title: "Empezar ahora",
    description: "Conviene entrar por el prompt ya preparado.",
    rationale: ["No hay sesion reciente dominante ni tarea pendiente clara."],
    confidence: 0.76,
    task: null,
    prompt: null,
  };
}

export function mapMentoriaStateToUserState(input: MentoriaBehavioralSnapshot): UserState {
  const lastActivityAt =
    input.recentSessions[0]?.updatedAt
    ?? input.motivation?.lastActivityAt
    ?? input.dailyClosure?.lastActivityAt
    ?? null;
  const activityHours = hoursSince(lastActivityAt, input.nowIso);

  return {
    userId: input.actor.userId,
    tenantId: input.actor.tenantId,
    lifecycleStage: pickLifecycleStage({
      hoursSinceActivity: activityHours,
      recentSessions: input.recentSessions,
      dailyPlan: input.dailyPlan,
    }),
    activeContext:
      input.recentSessions[0]?.topic
      ?? input.dailyClosure?.carryOverTopic
      ?? input.entry?.recommendedTopic
      ?? null,
  };
}

export function mapMentoriaSignalsToBehaviorSignals(input: MentoriaBehavioralSnapshot): BehaviorSignals {
  const latestSession = input.recentSessions[0] ?? null;
  const lastActivityAt =
    latestSession?.updatedAt
    ?? input.motivation?.lastActivityAt
    ?? input.dailyClosure?.lastActivityAt
    ?? null;
  const pendingTasks = mapPendingTasks(input.dailyPlan);

  return {
    lastActivityAt,
    hoursSinceActivity: hoursSince(lastActivityAt, input.nowIso),
    streak: input.motivation?.streak ?? 0,
    motivationProfile: input.motivation?.motivationProfile ?? null,
    consistencyScore: input.evolution?.consistencyScore ?? null,
    progressionVelocity: input.evolution?.progressionVelocity ?? null,
    frustrationLevel: input.evolution?.frustrationLevel ?? null,
    dailyCompletionRate: input.dailyPlan?.completionRate ?? 0,
    completedTasksCount: input.dailyPlan?.completedTaskIds.length ?? 0,
    pendingTasksCount: pendingTasks.length,
    recentSessionId: latestSession?.id ?? null,
    recentSessionTopic: latestSession?.topic ?? null,
    recentSessionRecommendedNextStep: latestSession?.recommendedNextStep ?? null,
    pendingTasks,
    entryPromptAvailable: Boolean(input.entry?.recommendedPrompt),
    carryOverPromptAvailable: Boolean(input.dailyClosure?.carryOverPrompt),
  };
}

export function buildMentoriaBehavioralContext(input: MentoriaBehavioralSnapshot): BehavioralContext {
  const userState = mapMentoriaStateToUserState(input);
  const signals = mapMentoriaSignalsToBehaviorSignals(input);

  return {
    userState,
    signals,
    product: "mentoria",
    surface: "workspace",
    nowIso: input.nowIso ?? new Date().toISOString(),
    availableActions: {
      canResumeSession: Boolean(signals.recentSessionRecommendedNextStep),
      canStartPendingTask: signals.pendingTasks.length > 0,
      canUseEntryPrompt: Boolean(input.entry?.recommendedPrompt || input.dailyClosure?.carryOverPrompt),
    },
  };
}

export function resolveMentoriaCurrentStrategy(input: MentoriaBehavioralSnapshot): NextBestAction {
  const context = buildMentoriaBehavioralContext(input);
  return buildCurrentMentoriaAction({
    signals: context.signals,
    context,
  });
}

export function runMentoriaBehavioralShadow(input: MentoriaBehavioralSnapshot): BehavioralShadowComparison {
  const context = buildMentoriaBehavioralContext(input);
  const currentAction = buildCurrentMentoriaAction({
    signals: context.signals,
    context,
  });
  const shadowAction = runBehavioralEngine(context).nextBestAction;
  const diverged =
    currentAction.strategy !== shadowAction.strategy
    || (currentAction.task?.subjectId ?? null) !== (shadowAction.task?.subjectId ?? null)
    || (currentAction.task?.type ?? null) !== (shadowAction.task?.type ?? null);

  return {
    currentStrategy: currentAction.strategy,
    shadowStrategy: shadowAction.strategy,
    diverged,
    currentAction,
    shadowAction,
    loggedAt: input.nowIso ?? new Date().toISOString(),
  };
}
