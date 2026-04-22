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
export type MentoriaOnboardingGoal = "improve_understanding" | "pass_subject" | "build_habit" | "gain_confidence";
export type InterventionType = "high_frustration" | "low_consistency" | "rapid_progress" | "stagnation" | "risk_student";
export type MentoriaInterventionSeverity = "low" | "medium" | "high" | "critical";
export type MentoriaInterventionStatus = "active" | "resolved";
export type DailyPlanTaskType = "practice" | "review" | "challenge";
export type DailyPlanPriority = "low" | "medium" | "high";
export type MentoriaPlanCode = "free" | "pro" | "family";
export type MentoriaReferralStatus = "pending" | "registered" | "converted" | "rewarded";
export type MentoriaRewardFeature = "advanced_parent_insights" | "adaptive_motivation_boost" | "progress_sharing_branding";
export type MentoriaGuardianFamilyRelation = "father" | "mother" | "tutor";
export type MentoriaGuardianSystemRole = "primary_guardian" | "secondary_guardian";
export type MentoriaActorSystemRole = MentoriaGuardianSystemRole | "student";
export type MentoriaGuardianRole = MentoriaGuardianFamilyRelation;
export type MentoriaConversationScopeType = "family" | "student";
export type MentoriaConversationChannel = "whatsapp";

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
  systemRole: MentoriaGuardianSystemRole;
  familyRelation: MentoriaGuardianFamilyRelation;
  tenantId?: string | null;
  createdAt: string;
};

export type MentoriaOnboardingPrimaryGuardian = {
  fullName: string;
  relation: MentoriaGuardianRole;
};

export type MentoriaOnboardingSubjectInput = {
  subjectSlug: string;
  initialLevel: MentoriaInitialLevel;
};

export type MentoriaOnboardingPayload = {
  primaryGuardian: MentoriaOnboardingPrimaryGuardian;
  student: {
    fullName: string;
    schoolYear: string;
    approximateAge?: number;
    schoolName?: string;
  };
  subjects: MentoriaOnboardingSubjectInput[];
  goal: MentoriaOnboardingGoal;
  confidenceLevel: "low" | "medium" | "high";
  primaryConcern?: string;
  referralCode?: string;
  inviteToken?: string;
};

export type MentoriaSessionActorType = "guardian" | "student" | "unknown";

export type MentoriaSessionMode =
  | "task_resolution"
  | "exam_preparation"
  | "subject_reinforcement"
  | "study_routine"
  | "soft_reentry";

export type MentoriaSessionInputKind =
  | "task_photo"
  | "exam_photo"
  | "pasted_text"
  | "selected_subject"
  | "orchestrator_recommendation"
  | "family_routine"
  | "student_state_signal"
  | "recent_session"
  | "free_message";

export type MentoriaSessionContract = {
  mode: MentoriaSessionMode;
  label: string;
  headline: string;
  subheadline: string;
  objective: string;
  entryKind: MentoriaSessionInputKind;
  entryLabel: string;
  primaryCta: string;
  chatBehavior: string;
  boardBehavior: string;
  progression: string[];
  tutorTone: string;
  completionRule: string;
  familyRole: string;
  statusLabel: string;
};

export type MentoriaSessionModeOption = {
  mode: MentoriaSessionMode;
  label: string;
  description: string;
  ctaLabel: string;
  topic: string;
  prompt: string;
  inputKind: MentoriaSessionInputKind;
  subjectSlug?: string | null;
};

export type MentoriaSessionContext = {
  actorType: MentoriaSessionActorType;
  familyId: string | null;
  guardianId?: string | null;
  studentProfileId?: string | null;
  systemRole?: MentoriaActorSystemRole | null;
};

export type MentoriaCanonicalFamilyContract = {
  family: MentoriaFamily | null;
  primaryGuardian: MentoriaGuardian | null;
  secondaryGuardians: MentoriaGuardian[];
  guardianStudentAccess: MentoriaGuardianStudentAccess[];
};

export type MentoriaOnboardingState = {
  sessionEmail?: string | null;
  primaryGuardian: MentoriaOnboardingPrimaryGuardian | null;
  student: StudentProfile | null;
  profile: StudentProfile | null;
  subjects: MentoriaSubject[];
  studentSubjects: MentoriaStudentSubject[];
  family: MentoriaFamily | null;
  secondaryGuardians: MentoriaGuardian[];
  guardianStudentAccess: MentoriaGuardianStudentAccess[];
  sessionContext: MentoriaSessionContext;
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

export type MentoriaMaterialContextNote = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  materialIntakeId: string;
  channel: "whatsapp";
  sourceMessageId: string;
  body: string;
  createdAt: string;
};

export type MentoriaGuardianStudentAccess = {
  id: string;
  familyId: string;
  guardianId: string;
  studentId: string;
  studentProfileId: string;
  canViewFullProgress: boolean;
  canManageSchedule: boolean;
  dailyStudyMinutes: number;
  supervisionLevel: MentoriaSupervisionLevel;
  notificationPreferences: string[];
  isPrimaryContact: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaGuardianAccessibleStudent = MentoriaGuardianStudentAccess & {
  guardianEmail?: string | null;
  guardianName?: string | null;
  guardianSystemRole?: MentoriaGuardianSystemRole | null;
  guardianFamilyRelation?: MentoriaGuardianFamilyRelation | null;
  studentName: string;
  source: "canonical" | "legacy_parent_accounts";
};

export type MentoriaConversationContext = {
  id: string;
  familyId: string;
  actorType: "guardian_actor" | "student_actor";
  actorId: string;
  channel: MentoriaConversationChannel;
  threadKey: string;
  scopeType: MentoriaConversationScopeType;
  activeStudentId?: string | null;
  status: "active" | "closed";
  resolvedBy: "single_access" | "explicit_switch" | "legacy_fallback";
  lastExplicitSwitchAt?: string | null;
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
  family: MentoriaFamily | null;
  primaryGuardian: MentoriaGuardian | null;
  secondaryGuardians: MentoriaGuardian[];
  guardianStudentAccess: MentoriaGuardianStudentAccess[];
  sessionContext: MentoriaSessionContext;
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

export type MentoriaMaterialIntakeKind =
  | "exam_photo"
  | "homework_photo"
  | "notes_photo"
  | "exercise_photo"
  | "academic_image"
  | "exam_document"
  | "homework_document"
  | "notes_document"
  | "study_document"
  | "academic_document";

export type MentoriaMaterialIntake = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  channel: "whatsapp";
  sourceMessageId: string;
  phoneNumber: string;
  mediaType: "image" | "document";
  intakeKind: MentoriaMaterialIntakeKind;
  providerMediaId: string;
  mimeType: string;
  fileName?: string | null;
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
