export type MentoriaEmotionalState = "steady" | "frustrated" | "blocked" | "demotivated" | "confident";
export type { ActivationEvent } from "@/lib/drako/activation";
export type { AgentResponse, AgentTask } from "@/lib/drako/agent-core";
export type { ContentArtifact, ContentRequest } from "@/lib/drako/content";
export type { Insight } from "@/lib/drako/insights";
export type { UserContext } from "@/lib/drako/memory";
export type { MetricEvent } from "@/lib/drako/metrics";
export type { OnboardingInput } from "@/lib/drako/onboarding";
export type MentoriaEmotionalLevel = "low" | "medium" | "high";
export type MentoriaLearningPreference = "practical_examples" | "step_by_step" | "quick_summaries";
export type MentoriaInitialLevel = "me_cuesta_mucho" | "voy_normal" | "se_me_da_bien";
export type MentoriaSupervisionLevel = "light" | "balanced" | "close";
export type InterventionType = "high_frustration" | "low_consistency" | "rapid_progress" | "stagnation" | "risk_student";
export type MentoriaInterventionSeverity = "low" | "medium" | "high" | "critical";
export type MentoriaInterventionStatus = "active" | "resolved";
export type DailyPlanTaskType = "practice" | "review" | "challenge";
export type DailyPlanPriority = "low" | "medium" | "high";
export type MentoriaPlanCode = "free" | "pro" | "family";
export type MentoriaReferralStatus = "pending" | "registered" | "converted" | "rewarded";
export type MentoriaRewardFeature = "advanced_parent_insights" | "adaptive_motivation_boost" | "progress_sharing_branding";
export type MentoriaGuardianRole = "father" | "mother" | "tutor";

export type MentoriaFamily = {
  id: string;
  createdAt: string;
};

export type MentoriaGuardian = {
  id: string;
  email: string;
  name?: string | null;
  familyId: string;
  role: MentoriaGuardianRole;
  createdAt: string;
};

export type MentoriaFamilyStudent = {
  id: string;
  name: string;
  age?: number | null;
  level?: string | null;
  familyId: string;
  createdAt: string;
};

export type MentoriaEmotionalBaseline = {
  frustration: MentoriaEmotionalLevel;
  motivation: MentoriaEmotionalLevel;
  concentration: MentoriaEmotionalLevel;
};

export type StudentProfile = {
  id: string;
  tenantId: string;
  userId?: string;
  learningStage: "primary" | "eso" | "bachillerato";
  fullName: string;
  name?: string;
  age: number;
  schoolYear: string;
  learningGoals: string[];
  baseEmotionalState: MentoriaEmotionalState;
  emotionalBaseline: MentoriaEmotionalBaseline;
  learningPreference: MentoriaLearningPreference;
  preferredStudyMinutes: number;
  strengths: string[];
  supportNotes?: string;
  parentPhoneNumber?: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaSubject = {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string;
  difficultyBand: string;
  createdAt: string;
  updatedAt: string;
};

export type ParentAccount = {
  id: string;
  tenantId: string;
  userId?: string;
  studentProfileId: string;
  fullName: string;
  email: string;
  relation: string;
  dailyStudyMinutes: number;
  supervisionLevel: MentoriaSupervisionLevel;
  canViewFullProgress: boolean;
  canManageSchedule: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaStudentSubject = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  subjectId: string;
  initialLevel: MentoriaInitialLevel;
  subject?: MentoriaSubject;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaSessionMessage = {
  role: "student" | "tutor";
  content: string;
  createdAt: string;
};

export type LearningSession = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  subjectId: string;
  mentorId: string;
  clientId: string;
  topic: string;
  status: "scheduled" | "active" | "completed" | "billed";
  durationMinutes: number;
  aiTokensUsed: number;
  emotionalState: MentoriaEmotionalState;
  tutorSummary: string;
  recommendedNextStep: string;
  explanation?: string;
  suggestedSteps?: string[];
  reinforcementQuestion?: string;
  transcript: MentoriaSessionMessage[];
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
};

export type MentoriaExercise = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  subjectId: string;
  sessionId?: string;
  prompt: string;
  expectedCompetency: string;
  difficultyLevel: string;
  hints: string[];
  answerFormat: string;
  studentAnswer?: string;
  correctionFeedback?: string;
  status: "pending" | "submitted" | "corrected";
  score?: number;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaProgress = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  subjectId: string;
  subject?: MentoriaSubject;
  masteryScore: number;
  confidenceScore: number;
  streakDays: number;
  sessionsCompleted: number;
  exercisesCompleted: number;
  strongTopics: string[];
  weakTopics: string[];
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StudyPlanBlock = {
  id: string;
  day: string;
  subjectId: string;
  title: string;
  goal: string;
  durationMinutes: number;
  focusMode: boolean;
};

export type StudyPlan = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  weekStart: string;
  weekEnd: string;
  goalsSummary: string;
  generatedBy: string;
  blocks: StudyPlanBlock[];
  createdAt: string;
  updatedAt: string;
};

export type DailyPlanTask = {
  id: string;
  subject: string;
  subjectId?: string;
  type: DailyPlanTaskType;
  difficulty: number;
  completed: boolean;
};

export type DailyPlan = {
  id: string;
  tenantId: string;
  studentId: string;
  planDate: string;
  recommendedDuration: number;
  tasks: DailyPlanTask[];
  priority: DailyPlanPriority;
  adaptationReason: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  completedTaskIds: string[];
  completionRate: number;
};

export type MentoriaBillingUsage = {
  guidedSessionsToday: number;
  exercisesToday: number;
  plannerRegenerationsToday: number;
};

export type MentoriaBillingSummary = {
  planCode: MentoriaPlanCode;
  planLabel: string;
  subscriptionStatus: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string | null;
  usage: MentoriaBillingUsage;
  limits: {
    guidedSessionsPerDay: number;
    exercisesPerDay: number;
    plannerRegenerationsPerDay: number;
  };
  features: {
    fullParentHub: boolean;
    advancedParentInsights: boolean;
    adaptiveInterventions: boolean;
    adaptiveMotivation: boolean;
    multiStudentSeats: number;
  };
  paywall: {
    title: string;
    message: string;
    ctaLabel: string;
    recommendedPlan: Exclude<MentoriaPlanCode, "free">;
    canManageBilling: boolean;
  } | null;
};

export type MentoriaGrowthEntitlements = {
  premiumAccessUntil?: string;
  featureUnlocks: Partial<Record<MentoriaRewardFeature, string>>;
  rewardPointsEarned: number;
};

export type FocusSession = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  subjectId?: string;
  studyPlanId?: string;
  durationMinutes: number;
  distractionsCount: number;
  status: "active" | "completed" | "cancelled";
  startedAt: string;
  endedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaIntervention = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  type: InterventionType;
  severity: MentoriaInterventionSeverity;
  status: MentoriaInterventionStatus;
  summary: string;
  recommendations: string[];
  channels: string[];
  metadata: Record<string, string | number | boolean | string[]>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
};

export type MentoriaDashboard = {
  student: StudentProfile;
  subjects: MentoriaSubject[];
  studentSubjects: MentoriaStudentSubject[];
  progress: MentoriaProgress[];
  currentPlan: StudyPlan | null;
  dailyPlan: DailyPlan | null;
  billing: MentoriaBillingSummary;
  focusSessions: FocusSession[];
  recentSessions: LearningSession[];
  parents: ParentAccount[];
  insights?: import("@/lib/drako/insights").Insight[];
};

export type MentoriaStudentMemorySummary = {
  commonMistakes: string[];
  watchouts: string[];
  strengths: string[];
  suggestedDifficulty: "guided" | "steady" | "stretch";
  nextPrioritySubjectId?: string | null;
  nextPriorityTask?: string | null;
};

export type MentoriaDailyClosureSummary = {
  closureDate: string;
  source: "live" | "event";
  status: "completed" | "in_progress" | "needs_support" | "incomplete";
  title: string;
  summary: string;
  carryOverPrompt: string | null;
  carryOverTopic: string | null;
  carryOverSubjectId?: string | null;
  completionRate: number;
  completedTasks: number;
  totalTasks: number;
  lastActivityAt?: string | null;
};

export type MentoriaWorkspaceQuickAction = {
  id: string;
  label: string;
  description: string;
  subjectSlug?: string | null;
  topic: string;
  prompt: string;
};

export type MentoriaWorkspaceEntry = {
  headline: string;
  subheadline: string;
  recommendedSubjectSlug?: string | null;
  recommendedTopic: string;
  recommendedPrompt: string;
  quickActions: MentoriaWorkspaceQuickAction[];
};

export type MentoriaGuardianHookEvent = {
  id: string;
  category: "progress" | "activity" | "alert";
  title: string;
  summary: string;
  severity: "info" | "medium" | "high";
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type MentoriaPreparedImage = {
  assetId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  summary: string;
  status: "received_for_future_interpretation";
  preparedAt: string;
};

export type MentoriaMaterialIntakeKind = "exam_photo" | "homework_photo" | "notes_photo" | "exercise_photo" | "academic_image";

export type MentoriaMaterialIntake = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  channel: "whatsapp";
  sourceMessageId: string;
  phoneNumber: string;
  mediaType: "image";
  intakeKind: MentoriaMaterialIntakeKind;
  providerMediaId: string;
  mimeType: string;
  caption?: string | null;
  originalText?: string | null;
  status: "received";
  createdAt: string;
  updatedAt: string;
};

export type MentoriaReferralProfile = {
  id: string;
  tenantId: string;
  studentId: string;
  referralCode: string;
  totalInvites: number;
  registeredInvites: number;
  convertedInvites: number;
  premiumAccessUntil?: string;
  rewardPointsEarned: number;
  featureUnlocks: Partial<Record<MentoriaRewardFeature, string>>;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaReferral = {
  id: string;
  tenantId: string;
  inviterStudentId: string;
  inviteeStudentId?: string;
  invitedEmail?: string;
  referralCode: string;
  inviteToken?: string;
  status: MentoriaReferralStatus;
  rewardPremiumDays: number;
  rewardPoints: number;
  rewardFeatures: MentoriaRewardFeature[];
  source: "direct_invite" | "shared_progress" | "organic_code";
  createdAt: string;
  registeredAt?: string;
  convertedAt?: string;
  rewardedAt?: string;
  updatedAt: string;
};

export type MentoriaProgressSharePayload = {
  studentName: string;
  schoolYear: string;
  summaryMessage: string;
  headlineMetric: string;
  progress: Array<{
    subject: string;
    masteryScore: number;
    confidenceScore: number;
    sessionsCompleted: number;
    exercisesCompleted: number;
  }>;
  dailyPlan: {
    recommendedDuration: number;
    completionRate: number;
    tasks: Array<{
      subject: string;
      type: DailyPlanTaskType;
      difficulty: number;
      completed: boolean;
    }>;
  } | null;
  achievements: string[];
  recommendations: string[];
};

export type MentoriaProgressShare = {
  id: string;
  tenantId: string;
  studentId: string;
  createdByUserId: string;
  shareCode: string;
  shareKind: "progress" | "achievement";
  title: string;
  payload: MentoriaProgressSharePayload;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaGrowthSummary = {
  referralProfile: MentoriaReferralProfile;
  referrals: MentoriaReferral[];
  latestShare: MentoriaProgressShare | null;
  rewardEntitlements: MentoriaGrowthEntitlements;
  recommendedShareMessage: string;
  recommendedInviteMessage: string;
};
