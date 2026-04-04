export type BehavioralStrategy =
  | "resume_session"
  | "gentle_restart"
  | "momentum_push"
  | "plan_task"
  | "entry";

export type BehavioralTaskCandidate = {
  id: string;
  subject: string;
  subjectId?: string | null;
  type: "practice" | "review" | "challenge" | "other";
  difficulty?: number | null;
  completed?: boolean;
};

export type UserState = {
  userId: string;
  tenantId: string;
  lifecycleStage: "new" | "active" | "returning";
  activeContext: string | null;
};

export type BehaviorSignals = {
  lastActivityAt: string | null;
  hoursSinceActivity: number | null;
  streak: number;
  motivationProfile: "fragile" | "stable" | "high_performer" | null;
  consistencyScore: number | null;
  progressionVelocity: number | null;
  frustrationLevel: number | null;
  dailyCompletionRate: number;
  completedTasksCount: number;
  pendingTasksCount: number;
  recentSessionId: string | null;
  recentSessionTopic: string | null;
  recentSessionRecommendedNextStep: string | null;
  pendingTasks: BehavioralTaskCandidate[];
  entryPromptAvailable: boolean;
  carryOverPromptAvailable: boolean;
};

export type BehavioralContext = {
  userState: UserState;
  signals: BehaviorSignals;
  product: string;
  surface: string;
  nowIso: string;
  availableActions: {
    canResumeSession: boolean;
    canStartPendingTask: boolean;
    canUseEntryPrompt: boolean;
  };
};

export type NextBestAction = {
  strategy: BehavioralStrategy;
  title: string;
  description: string;
  rationale: string[];
  confidence: number;
  task: BehavioralTaskCandidate | null;
  prompt: string | null;
};

export type ClosureSummary = {
  closureDate: string;
  status: "completed" | "in_progress" | "needs_support" | "incomplete";
  summary: string;
  carryOverPrompt: string | null;
  readinessForNextEntry: "high" | "medium" | "low";
};

export type FutureProjection = {
  headline: string;
  narrative: string;
  targetState: string;
  evidence: string[];
  bridgeAction: string | null;
  confidenceBand: "emerging" | "credible" | "strong";
};

export type BehavioralShadowComparison = {
  currentStrategy: BehavioralStrategy;
  shadowStrategy: BehavioralStrategy;
  diverged: boolean;
  currentAction: NextBestAction;
  shadowAction: NextBestAction;
  loggedAt: string;
};
