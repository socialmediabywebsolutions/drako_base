export type StudentState =
  | "focused"
  | "progressing"
  | "demotivated"
  | "overloaded"
  | "inconsistent"
  | "disconnected"
  | "at_risk"
  | "recovering";

export type StateSeverity = "low" | "medium" | "high";

export type InterventionPriority = "low" | "medium" | "high" | "critical";

export type StateSignals = {
  studyMinutesRatio: number;
  taskCompletionRatio: number;
  consistencyRatio: number;
  academicDropRatio: number;
  sessionAbandonRate: number;
  unfinishedTaskRate: number;
  reentryFragility: number;
  irregularityScore: number;
  negativeToneScore: number;
  helpSeekingScore: number;
  chatResponseLatency: number;
  chatEngagementRatio: number;
  daysInactive: number;
  usageDrop7d: number;
  lateNightOverloadPattern: boolean;
  burstThenDropPattern: boolean;
};

export type StateDecision = {
  state: StudentState;
  severity: StateSeverity;
  priority: InterventionPriority;
  confidence: number;
  reasons: string[];
  signals: StateSignals;
};

export type StateActions = {
  boardMode:
    | "normal"
    | "reinforce_progress"
    | "simplified_focus"
    | "overload_reduction"
    | "reentry"
    | "intervention"
    | "recovery";
  chatTone: "light" | "motivating" | "calm" | "firm" | "supportive";
  chatIntensity: "low" | "medium" | "high";
  guardianAlert: "none" | "soft" | "recommended" | "critical";
  guardianSummary?: string;
  primaryStudentAction: string;
};

export type OrchestratorActorType = "student" | "guardian";

export type OrchestratorContext = {
  actorType: OrchestratorActorType;
  tone: StateActions["chatTone"];
  intensity: StateActions["chatIntensity"];
  messageGoal: string;
  restrictions: string[];
  promptContext: {
    state: StudentState;
    severity: StateSeverity;
    priority: InterventionPriority;
    confidence: number;
    reasons: string[];
    primaryStudentAction: string;
    guardianSummary?: string;
  };
};

export type GuardianViewModel = {
  state: StudentState;
  priority: InterventionPriority;
  summary: string;
  message: string;
  requiresIntervention: boolean;
  alertLevel: StateActions["guardianAlert"];
};
