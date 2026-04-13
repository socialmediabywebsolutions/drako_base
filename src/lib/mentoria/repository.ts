import { getDb } from "@/lib/db";
import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type {
  DailyPlan,
  DailyPlanTask,
  FocusSession,
  InterventionType,
  LearningSession,
  MentoriaConversationContext,
  MentoriaConversationScopeType,
  MentoriaIntervention,
  MentoriaMaterialContextNote,
  MentoriaMaterialIntake,
  MentoriaMaterialIntakeKind,
  MentoriaDashboard,
  MentoriaEmotionalBaseline,
  MentoriaExercise,
  MentoriaGuardianAccessibleStudent,
  MentoriaGuardianFamilyRelation,
  MentoriaGuardianSystemRole,
  MentoriaInitialLevel,
  MentoriaProgress,
  MentoriaProgressShare,
  MentoriaProgressSharePayload,
  MentoriaReferral,
  MentoriaReferralProfile,
  MentoriaRewardFeature,
  MentoriaSessionMessage,
  MentoriaStudentSubject,
  MentoriaSubject,
  ParentAccount,
  StudentProfile,
  StudyPlan,
  StudyPlanBlock,
} from "@/lib/mentoria/types";

type DbLike = D1Database;

type StudentProfileRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  full_name: string;
  age: number;
  school_year: string;
  learning_goals_json: string | null;
  base_emotional_state: string;
  emotional_baseline_json: string | null;
  learning_preference: string | null;
  preferred_study_minutes: number;
  strengths_json: string | null;
  support_notes: string | null;
  onboarding_completed: number;
  created_at: string;
  updated_at: string;
};

type MaterialContextNoteRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  material_intake_id: string;
  channel: string;
  source_message_id: string;
  body: string;
  created_at: string;
};

type SubjectRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  description: string | null;
  difficulty_band: string;
  created_at: string;
  updated_at: string;
};

type ParentAccountRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  student_profile_id: string;
  full_name: string;
  email: string;
  relation: string;
  relationship_label: string | null;
  notification_preferences_json: string | null;
  daily_study_minutes: number | null;
  supervision_level: string | null;
  can_view_full_progress: number;
  can_manage_schedule: number;
  created_at: string;
  updated_at: string;
};

type GuardianAccessibleStudentRow = {
  access_id?: string | null;
  family_id: string;
  guardian_id?: string | null;
  student_id: string;
  student_profile_id?: string | null;
  can_view_full_progress?: number | null;
  can_manage_schedule?: number | null;
  daily_study_minutes?: number | null;
  supervision_level?: string | null;
  notification_preferences_json?: string | null;
  is_primary_contact?: number | null;
  guardian_email?: string | null;
  guardian_name?: string | null;
  guardian_system_role?: MentoriaGuardianSystemRole | null;
  guardian_family_relation?: MentoriaGuardianFamilyRelation | null;
  student_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ConversationContextRow = {
  id: string;
  family_id: string;
  actor_type: "guardian_actor" | "student_actor";
  actor_id: string;
  channel: "whatsapp";
  thread_key: string;
  scope_type: MentoriaConversationScopeType;
  active_student_id: string | null;
  status: "active" | "closed";
  resolved_by: "single_access" | "explicit_switch" | "legacy_fallback";
  last_explicit_switch_at: string | null;
  created_at: string;
  updated_at: string;
};

type StudentSubjectRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  subject_id: string;
  initial_level: string;
  created_at: string;
  updated_at: string;
};

type StudyPlanRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  week_start: string;
  week_end: string;
  goals_summary: string | null;
  blocks_json: string;
  generated_by: string;
  created_at: string;
  updated_at: string;
};

type ProgressRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  subject_id: string;
  mastery_score: number;
  confidence_score: number;
  streak_days: number;
  sessions_completed: number;
  exercises_completed: number;
  weak_topics_json: string | null;
  strong_topics_json: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

type ExerciseRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  subject_id: string;
  session_id: string | null;
  prompt: string;
  expected_competency: string;
  hints_json: string | null;
  answer_format: string;
  student_answer: string | null;
  correction_feedback: string | null;
  status: string;
  difficulty_level: string;
  score: number | null;
  created_at: string;
  updated_at: string;
};

type FocusSessionRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  subject_id: string | null;
  study_plan_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  distractions_count: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LearningSessionRow = {
  id: string;
  tenant_id: string;
  mentor_id: string;
  client_id: string;
  student_profile_id: string | null;
  subject_id: string | null;
  topic: string | null;
  status: string;
  duration_minutes: number | null;
  ai_tokens_used: number | null;
  transcript_json: string | null;
  emotional_state: string | null;
  tutor_summary: string | null;
  recommended_next_step: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
};

type MaterialIntakeRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  channel: string;
  source_message_id: string;
  phone_number: string;
  media_type: string;
  intake_kind: string;
  provider_media_id: string;
  mime_type: string;
  file_name: string | null;
  caption: string | null;
  original_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type StudentEvolutionRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  strengths_json: string;
  weaknesses_json: string;
  frustration_level: number;
  consistency_score: number;
  average_response_time: number;
  last_sessions: number;
  common_mistakes_json: string;
  progression_velocity: number;
  created_at: string;
  updated_at: string;
};

type InterventionRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  intervention_type: string;
  severity: string;
  status: string;
  summary: string;
  recommendations_json: string;
  channels_json: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type MotivationStateRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  streak: number;
  last_activity_at: string;
  effort_score: number;
  reward_points: number;
  level: number;
  achievements_json: string;
  motivation_profile: string;
  created_at: string;
  updated_at: string;
};

type DailyPlanRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  plan_date: string;
  recommended_duration: number;
  tasks_json: string;
  completed_task_ids_json: string;
  priority: string;
  adaptation_reason: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

type ReferralProfileRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  referral_code: string;
  total_invites: number;
  registered_invites: number;
  converted_invites: number;
  premium_access_until: string | null;
  reward_points_earned: number;
  feature_unlocks_json: string;
  created_at: string;
  updated_at: string;
};

type ReferralRow = {
  id: string;
  tenant_id: string;
  inviter_student_profile_id: string;
  invitee_student_profile_id: string | null;
  invited_email: string | null;
  referral_code: string;
  invite_token: string | null;
  status: string;
  reward_premium_days: number;
  reward_points: number;
  reward_features_json: string;
  source: string;
  created_at: string;
  registered_at: string | null;
  converted_at: string | null;
  rewarded_at: string | null;
  updated_at: string;
};

type ProgressShareRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  created_by_user_id: string;
  share_code: string;
  share_kind: string;
  title: string;
  summary_json: string;
  created_at: string;
  updated_at: string;
};

type DashboardRow = {
  student_id: string;
  student_name: string;
  school_year: string;
  base_emotional_state: string;
  preferred_study_minutes: number;
  plan_id: string | null;
  plan_week_start: string | null;
  plan_week_end: string | null;
  plan_goals_summary: string | null;
  plan_blocks_json: string | null;
};

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseEmotionalBaseline(value: string | null): MentoriaEmotionalBaseline {
  if (!value) {
    return { frustration: "medium", motivation: "medium", concentration: "medium" };
  }
  try {
    const parsed = JSON.parse(value) as Partial<MentoriaEmotionalBaseline>;
    return {
      frustration: parsed.frustration === "low" || parsed.frustration === "high" ? parsed.frustration : "medium",
      motivation: parsed.motivation === "low" || parsed.motivation === "high" ? parsed.motivation : "medium",
      concentration: parsed.concentration === "low" || parsed.concentration === "high" ? parsed.concentration : "medium",
    };
  } catch {
    return { frustration: "medium", motivation: "medium", concentration: "medium" };
  }
}

function parseBlocks(value: string | null): StudyPlanBlock[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as StudyPlanBlock[]) : [];
  } catch {
    return [];
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("unique constraint");
}

function mapStudent(row: StudentProfileRow): StudentProfile {
  const anyRow = row as unknown as Record<string, any>;
  const fullName = anyRow.full_name ?? anyRow.display_name ?? "";
  const schoolYear = anyRow.school_year ?? anyRow.grade_level ?? "";
  const learningGoalsJson = (anyRow.learning_goals_json ?? anyRow.goals_json ?? "[]") as string | null;
  const baseEmotionalState = (anyRow.base_emotional_state ?? anyRow.emotional_baseline ?? "steady") as StudentProfile["baseEmotionalState"];
  const emotionalBaselineJson = (anyRow.emotional_baseline_json ?? null) as string | null;
  const learningPreference = (anyRow.learning_preference ?? anyRow.learning_style ?? "step_by_step") as StudentProfile["learningPreference"];
  const preferredStudyMinutes = (anyRow.preferred_study_minutes ?? anyRow.preferred_session_minutes ?? 25) as number;
  const strengthsJson = (anyRow.strengths_json ?? "[]") as string | null;
  const supportNotes = (anyRow.support_notes ?? undefined) as string | undefined;
  const onboardingCompleted = Boolean(anyRow.onboarding_completed ?? 1);
  const learningProfile = getLearningProfile({ schoolYear, age: row.age });
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: (anyRow.user_id as string | null) ?? undefined,
    learningStage: learningProfile.stage,
    fullName,
    age: row.age,
    schoolYear,
    learningGoals: parseJsonArray<string>(learningGoalsJson),
    baseEmotionalState,
    emotionalBaseline: parseEmotionalBaseline(emotionalBaselineJson),
    learningPreference,
    preferredStudyMinutes,
    strengths: parseJsonArray<string>(strengthsJson),
    supportNotes,
    onboardingCompleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMaterialContextNote(row: MaterialContextNoteRow): MentoriaMaterialContextNote {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    materialIntakeId: row.material_intake_id,
    channel: row.channel as MentoriaMaterialContextNote["channel"],
    sourceMessageId: row.source_message_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapMaterialIntake(row: MaterialIntakeRow): MentoriaMaterialIntake {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    channel: row.channel as MentoriaMaterialIntake["channel"],
    sourceMessageId: row.source_message_id,
    phoneNumber: row.phone_number,
    mediaType: row.media_type as MentoriaMaterialIntake["mediaType"],
    intakeKind: row.intake_kind as MentoriaMaterialIntakeKind,
    providerMediaId: row.provider_media_id,
    mimeType: row.mime_type,
    fileName: row.file_name,
    caption: row.caption,
    originalText: row.original_text,
    status: row.status as MentoriaMaterialIntake["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubject(row: SubjectRow): MentoriaSubject {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    difficultyBand: (row as any).difficulty_band
      ? ((row as any).difficulty_band as unknown as string)
      : (() => {
          const w = (row as any).difficulty_weight as unknown as number | undefined;
          if (typeof w === "number") {
            return w <= 1.05 ? "core" : "growth";
          }
          return "core";
        })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapParent(row: ParentAccountRow): ParentAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id ?? undefined,
    studentProfileId: row.student_profile_id,
    fullName: row.full_name,
    email: row.email,
    relation: row.relationship_label ?? row.relation,
    dailyStudyMinutes: Number(row.daily_study_minutes ?? 0),
    supervisionLevel: (row.supervision_level ?? "balanced") as ParentAccount["supervisionLevel"],
    canViewFullProgress: Boolean(row.can_view_full_progress),
    canManageSchedule: Boolean(row.can_manage_schedule),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function mapGuardianAccessibleStudent(row: GuardianAccessibleStudentRow): MentoriaGuardianAccessibleStudent {
  const studentProfileId = row.student_profile_id ?? row.student_id;
  const createdAt = row.created_at ?? new Date(0).toISOString();
  const updatedAt = row.updated_at ?? createdAt;
  return {
    id: row.access_id ?? `legacy:${row.family_id}:${studentProfileId}`,
    familyId: row.family_id,
    guardianId: row.guardian_id ?? "",
    studentId: row.student_id,
    studentProfileId,
    canViewFullProgress: row.can_view_full_progress === null || row.can_view_full_progress === undefined ? true : Boolean(row.can_view_full_progress),
    canManageSchedule: Boolean(row.can_manage_schedule),
    dailyStudyMinutes: Number(row.daily_study_minutes ?? 0),
    supervisionLevel: (row.supervision_level ?? "balanced") as MentoriaGuardianAccessibleStudent["supervisionLevel"],
    notificationPreferences: parseStringArray(row.notification_preferences_json),
    isPrimaryContact: Boolean(row.is_primary_contact),
    guardianEmail: row.guardian_email ?? null,
    guardianName: row.guardian_name ?? null,
    guardianSystemRole: row.guardian_system_role ?? null,
    guardianFamilyRelation: row.guardian_family_relation ?? null,
    studentName: row.student_name?.trim() || studentProfileId,
    source: row.access_id ? "canonical" : "legacy_parent_accounts",
    createdAt,
    updatedAt,
  };
}

function mapConversationContext(row: ConversationContextRow): MentoriaConversationContext {
  return {
    id: row.id,
    familyId: row.family_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    channel: row.channel,
    threadKey: row.thread_key,
    scopeType: row.scope_type,
    activeStudentId: row.active_student_id ?? null,
    status: row.status,
    resolvedBy: row.resolved_by,
    lastExplicitSwitchAt: row.last_explicit_switch_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStudentSubject(row: StudentSubjectRow, subject?: MentoriaSubject): MentoriaStudentSubject {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    subjectId: row.subject_id,
    initialLevel: row.initial_level as MentoriaInitialLevel,
    subject,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlan(row: StudyPlanRow): StudyPlan {
  const rawBlocks = (row as any).blocks_json ?? (row as any).plan_json ?? "[]";
  const goalsSummary = (row as any).goals_summary ?? (row as any).title ?? "";
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    weekStart: (row as any).week_start ?? "",
    weekEnd: (row as any).week_end ?? (row as any).week_start ?? "",
    goalsSummary,
    blocks: parseBlocks(rawBlocks),
    generatedBy: (row as any).generated_by ?? "planner-agent",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProgress(row: ProgressRow, subject?: MentoriaSubject): MentoriaProgress {
  const weakTopics = parseJsonArray<string>((row as any).weak_topics_json ?? (row as any).weaknesses_json ?? null);
  const strongTopics = parseJsonArray<string>((row as any).strong_topics_json ?? (row as any).strengths_json ?? null);
  const confidence = (row as any).confidence_score as unknown as number | undefined;
  const fallbackConfidence = (row as any).focus_score as unknown as number | undefined;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    subjectId: row.subject_id,
    subject,
    masteryScore: row.mastery_score,
    confidenceScore: typeof confidence === "number" ? confidence : typeof fallbackConfidence === "number" ? fallbackConfidence : 0,
    streakDays: row.streak_days,
    sessionsCompleted: row.sessions_completed,
    exercisesCompleted: row.exercises_completed,
    weakTopics,
    strongTopics,
    lastActivityAt: row.last_activity_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExercise(row: ExerciseRow): MentoriaExercise {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    subjectId: row.subject_id,
    sessionId: row.session_id ?? undefined,
    prompt: row.prompt,
    expectedCompetency: row.expected_competency,
    hints: parseJsonArray<string>(row.hints_json),
    answerFormat: row.answer_format,
    studentAnswer: row.student_answer ?? undefined,
    correctionFeedback: row.correction_feedback ?? undefined,
    status: row.status as MentoriaExercise["status"],
    difficultyLevel: row.difficulty_level,
    score: row.score ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFocus(row: FocusSessionRow): FocusSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    subjectId: row.subject_id ?? undefined,
    studyPlanId: row.study_plan_id ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationMinutes: row.duration_minutes,
    distractionsCount: row.distractions_count,
    status: row.status as FocusSession["status"],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessages(value: string | null): MentoriaSessionMessage[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as MentoriaSessionMessage[]) : [];
  } catch {
    return [];
  }
}

function mapLearningSession(row: LearningSessionRow): LearningSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    mentorId: row.mentor_id,
    clientId: row.client_id,
    studentProfileId: row.student_profile_id ?? "",
    subjectId: row.subject_id ?? "",
    topic: row.topic ?? "",
    status: row.status as LearningSession["status"],
    durationMinutes: row.duration_minutes ?? 0,
    aiTokensUsed: row.ai_tokens_used ?? 0,
    transcript: mapMessages(row.transcript_json),
    emotionalState: (row.emotional_state ?? "steady") as LearningSession["emotionalState"],
    tutorSummary: row.tutor_summary ?? "",
    recommendedNextStep: row.recommended_next_step ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function mapStudentEvolution(row: StudentEvolutionRow): StudentEvolutionProfile {
  return {
    studentId: row.student_profile_id,
    strengths: parseJsonArray<string>(row.strengths_json),
    weaknesses: parseJsonArray<string>(row.weaknesses_json),
    frustrationLevel: row.frustration_level,
    consistencyScore: row.consistency_score,
    averageResponseTime: row.average_response_time,
    lastSessions: row.last_sessions,
    commonMistakes: parseJsonArray<string>(row.common_mistakes_json),
    progressionVelocity: row.progression_velocity,
    updatedAt: row.updated_at,
  };
}

function parseMetadata(value: string): Record<string, string | number | boolean | string[]> {
  try {
    const parsed = JSON.parse(value) as Record<string, string | number | boolean | string[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function mapIntervention(row: InterventionRow): MentoriaIntervention {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    type: row.intervention_type as InterventionType,
    severity: row.severity as MentoriaIntervention["severity"],
    status: row.status as MentoriaIntervention["status"],
    summary: row.summary,
    recommendations: parseJsonArray<string>(row.recommendations_json),
    channels: parseJsonArray<string>(row.channels_json),
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

function mapMotivationState(row: MotivationStateRow): MotivationState {
  return {
    studentId: row.student_profile_id,
    streak: row.streak,
    lastActivityAt: row.last_activity_at,
    effortScore: row.effort_score,
    rewardPoints: row.reward_points,
    level: row.level,
    achievements: parseJsonArray<string>(row.achievements_json),
    motivationProfile: row.motivation_profile as MotivationState["motivationProfile"],
  };
}

function mapDailyPlan(row: DailyPlanRow): DailyPlan {
  const tasks = parseJsonArray<DailyPlanTask>(row.tasks_json);
  const completedTaskIds = parseJsonArray<string>(row.completed_task_ids_json);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_profile_id,
    planDate: row.plan_date,
    recommendedDuration: row.recommended_duration,
    tasks: tasks.map((task) => ({
      ...task,
      completed: completedTaskIds.includes(task.id) || Boolean(task.completed),
    })),
    completedTaskIds,
    priority: row.priority as DailyPlan["priority"],
    adaptationReason: row.adaptation_reason,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completionRate: tasks.length ? completedTaskIds.length / tasks.length : 0,
  };
}

function parseJsonObject<T extends Record<string, unknown>>(value: string | null): T {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed && typeof parsed === "object" ? parsed : ({} as T);
  } catch {
    return {} as T;
  }
}

function mapReferralProfile(row: ReferralProfileRow): MentoriaReferralProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_profile_id,
    referralCode: row.referral_code,
    totalInvites: row.total_invites,
    registeredInvites: row.registered_invites,
    convertedInvites: row.converted_invites,
    premiumAccessUntil: row.premium_access_until ?? undefined,
    rewardPointsEarned: row.reward_points_earned,
    featureUnlocks: parseJsonObject<Partial<Record<MentoriaRewardFeature, string>>>(row.feature_unlocks_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReferral(row: ReferralRow): MentoriaReferral {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    inviterStudentId: row.inviter_student_profile_id,
    inviteeStudentId: row.invitee_student_profile_id ?? undefined,
    invitedEmail: row.invited_email ?? undefined,
    referralCode: row.referral_code,
    inviteToken: row.invite_token ?? undefined,
    status: row.status as MentoriaReferral["status"],
    rewardPremiumDays: row.reward_premium_days,
    rewardPoints: row.reward_points,
    rewardFeatures: parseJsonArray<MentoriaRewardFeature>(row.reward_features_json),
    source: row.source as MentoriaReferral["source"],
    createdAt: row.created_at,
    registeredAt: row.registered_at ?? undefined,
    convertedAt: row.converted_at ?? undefined,
    rewardedAt: row.rewarded_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

function mapProgressShare(row: ProgressShareRow): MentoriaProgressShare {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_profile_id,
    createdByUserId: row.created_by_user_id,
    shareCode: row.share_code,
    shareKind: row.share_kind as MentoriaProgressShare["shareKind"],
    title: row.title,
    payload: parseJsonObject<MentoriaProgressSharePayload>(row.summary_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MentoriaRepository {
  constructor(private db: DbLike = getDb()) {}

  private async hasTable(table: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name = ?
         LIMIT 1`,
      )
      .bind(table)
      .all<{ name: string }>();
    const row = result.results?.[0] ?? null;
    return Boolean(row?.name);
  }

  private async hasColumn(table: string, column: string): Promise<boolean> {
    const res = await this.db.prepare(`PRAGMA table_info(${table})`).bind().all<{ name: string }>();
    const names = (res.results ?? []).map((r) => (r?.name ?? "").toLowerCase());
    return names.includes(column.toLowerCase());
  }

  async listGuardianAccessibleStudents(tenantId: string, guardianUserId: string): Promise<MentoriaGuardianAccessibleStudent[]> {
    if (await this.hasTable("guardian_student_access")) {
      const canonicalRows = await this.db
        .prepare(
          `SELECT
             gsa.id AS access_id,
             gsa.family_id,
             gsa.guardian_id,
             gsa.student_id,
             COALESCE(gsa.student_profile_id, gsa.student_id) AS student_profile_id,
             gsa.can_view_full_progress,
             gsa.can_manage_schedule,
             gsa.daily_study_minutes,
             gsa.supervision_level,
             gsa.notification_preferences_json,
             gsa.is_primary_contact,
             g.email AS guardian_email,
             g.name AS guardian_name,
             ${await this.hasColumn("guardians", "system_role") ? "g.system_role" : "NULL"} AS guardian_system_role,
             ${await this.hasColumn("guardians", "family_relation") ? "g.family_relation" : "g.role"} AS guardian_family_relation,
             COALESCE(sp.full_name, sp.display_name, s.name) AS student_name,
             gsa.created_at,
             gsa.updated_at
           FROM guardian_student_access gsa
           JOIN guardians g
             ON g.id = gsa.guardian_id
            AND g.family_id = gsa.family_id
           JOIN (
             SELECT tenant_id, user_id, lower(email) AS guardian_email
             FROM parent_accounts
             WHERE user_id IS NOT NULL
             GROUP BY tenant_id, user_id, lower(email)
           ) guardian_bridge
             ON guardian_bridge.tenant_id = gsa.family_id
            AND guardian_bridge.user_id = ?
            AND guardian_bridge.guardian_email = lower(g.email)
           LEFT JOIN student_profiles sp
             ON sp.tenant_id = gsa.family_id
            AND sp.id = COALESCE(gsa.student_profile_id, gsa.student_id)
           LEFT JOIN students s
             ON s.family_id = gsa.family_id
            AND s.id = gsa.student_id
           WHERE gsa.family_id = ?
           ORDER BY student_name ASC`,
        )
        .bind(guardianUserId, tenantId)
        .all<GuardianAccessibleStudentRow>()
        .catch(() => ({ results: [] as GuardianAccessibleStudentRow[] }));

      const canonical = (canonicalRows.results ?? []).map(mapGuardianAccessibleStudent);
      if (canonical.length > 0) {
        return canonical;
      }
    }

    const legacyRows = await this.db
      .prepare(
        `SELECT
           NULL AS access_id,
           pa.tenant_id AS family_id,
           NULL AS guardian_id,
           pa.student_profile_id AS student_id,
           pa.student_profile_id AS student_profile_id,
           pa.can_view_full_progress,
           pa.can_manage_schedule,
           pa.daily_study_minutes,
           pa.supervision_level,
           pa.notification_preferences_json,
           0 AS is_primary_contact,
           pa.email AS guardian_email,
           pa.full_name AS guardian_name,
           NULL AS guardian_system_role,
           pa.relationship_label AS guardian_family_relation,
           COALESCE(sp.full_name, sp.display_name, pa.student_profile_id) AS student_name,
           pa.created_at,
           pa.updated_at
         FROM parent_accounts pa
         LEFT JOIN student_profiles sp
           ON sp.tenant_id = pa.tenant_id
          AND sp.id = pa.student_profile_id
         WHERE pa.tenant_id = ? AND pa.user_id = ?
         ORDER BY student_name ASC`,
      )
      .bind(tenantId, guardianUserId)
      .all<GuardianAccessibleStudentRow>();

    const seen = new Set<string>();
    return (legacyRows.results ?? [])
      .map(mapGuardianAccessibleStudent)
      .filter((row) => {
        const key = `${row.studentId}:${row.studentProfileId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  async getConversationContext(input: {
    familyId: string;
    channel: "whatsapp";
    threadKey: string;
    actorType: "guardian_actor" | "student_actor";
    actorId: string;
  }): Promise<MentoriaConversationContext | null> {
    if (!(await this.hasTable("conversation_context"))) {
      return null;
    }

    const row = await this.db
      .prepare(
        `SELECT *
         FROM conversation_context
         WHERE family_id = ? AND channel = ? AND thread_key = ? AND actor_type = ? AND actor_id = ?
         LIMIT 1`,
      )
      .bind(input.familyId, input.channel, input.threadKey, input.actorType, input.actorId)
      .first<ConversationContextRow>();
    return row ? mapConversationContext(row) : null;
  }

  async upsertConversationContext(input: {
    familyId: string;
    channel: "whatsapp";
    threadKey: string;
    actorType: "guardian_actor" | "student_actor";
    actorId: string;
    scopeType: MentoriaConversationScopeType;
    activeStudentId?: string | null;
    resolvedBy: MentoriaConversationContext["resolvedBy"];
    status?: MentoriaConversationContext["status"];
    markExplicitSwitch?: boolean;
  }): Promise<MentoriaConversationContext> {
    if (!(await this.hasTable("conversation_context"))) {
      const now = new Date().toISOString();
      return {
        id: `synthetic:${input.familyId}:${input.channel}:${input.threadKey}:${input.actorType}:${input.actorId}`,
        familyId: input.familyId,
        actorType: input.actorType,
        actorId: input.actorId,
        channel: input.channel,
        threadKey: input.threadKey,
        scopeType: input.scopeType,
        activeStudentId: input.activeStudentId ?? null,
        status: input.status ?? "active",
        resolvedBy: input.resolvedBy,
        lastExplicitSwitchAt: input.markExplicitSwitch ? now : null,
        createdAt: now,
        updatedAt: now,
      };
    }

    const now = new Date().toISOString();
    const existing = await this.getConversationContext({
      familyId: input.familyId,
      channel: input.channel,
      threadKey: input.threadKey,
      actorType: input.actorType,
      actorId: input.actorId,
    });

    const id = existing?.id ?? crypto.randomUUID();
    const lastExplicitSwitchAt = input.markExplicitSwitch ? now : existing?.lastExplicitSwitchAt ?? null;

    await this.db
      .prepare(
        `INSERT INTO conversation_context (
           id, family_id, actor_type, actor_id, channel, thread_key, scope_type, active_student_id,
           status, resolved_by, last_explicit_switch_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(family_id, channel, thread_key, actor_type, actor_id) DO UPDATE SET
           scope_type = excluded.scope_type,
           active_student_id = excluded.active_student_id,
           status = excluded.status,
           resolved_by = excluded.resolved_by,
           last_explicit_switch_at = excluded.last_explicit_switch_at,
           updated_at = excluded.updated_at`,
      )
      .bind(
        id,
        input.familyId,
        input.actorType,
        input.actorId,
        input.channel,
        input.threadKey,
        input.scopeType,
        input.activeStudentId ?? null,
        input.status ?? "active",
        input.resolvedBy,
        lastExplicitSwitchAt,
        existing?.createdAt ?? now,
        now,
      )
      .run();

    return (await this.getConversationContext({
      familyId: input.familyId,
      channel: input.channel,
      threadKey: input.threadKey,
      actorType: input.actorType,
      actorId: input.actorId,
    })) as MentoriaConversationContext;
  }

  async getStudentProfileByUser(tenantId: string, userId: string): Promise<StudentProfile | null> {
    const hasUserId = await this.hasColumn("student_profiles", "user_id");
    if (!hasUserId) return null;
    const row = await this.db
      .prepare(
        `SELECT * FROM student_profiles
         WHERE tenant_id = ? AND user_id = ?
         LIMIT 1`,
      )
      .bind(tenantId, userId)
      .first<StudentProfileRow>();
    return row ? mapStudent(row) : null;
  }

  async getStudentProfileById(tenantId: string, studentId: string): Promise<StudentProfile | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM student_profiles
         WHERE tenant_id = ? AND id = ?
         LIMIT 1`,
      )
      .bind(tenantId, studentId)
      .first<StudentProfileRow>();
    return row ? mapStudent(row) : null;
  }

  async listStudentsForTenant(tenantId: string): Promise<StudentProfile[]> {
    const hasFullName = await this.hasColumn("student_profiles", "full_name");
    const orderBy = hasFullName ? "full_name" : "display_name";
    const result = await this.db
      .prepare(`SELECT * FROM student_profiles WHERE tenant_id = ? ORDER BY ${orderBy} ASC`)
      .bind(tenantId)
      .all<StudentProfileRow>();
    return (result.results ?? []).map(mapStudent);
  }

  async getStudentEvolutionProfile(tenantId: string, studentId: string): Promise<StudentEvolutionProfile | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_student_evolution
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`,
      )
      .bind(tenantId, studentId)
      .first<StudentEvolutionRow>();
    return row ? mapStudentEvolution(row) : null;
  }

  async saveStudentEvolutionProfile(
    tenantId: string,
    profile: StudentEvolutionProfile,
  ): Promise<StudentEvolutionProfile> {
    const existing = await this.db
      .prepare(
        `SELECT id FROM mentoria_student_evolution
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`,
      )
      .bind(tenantId, profile.studentId)
      .first<{ id: string }>();
    const now = profile.updatedAt || new Date().toISOString();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_student_evolution
           SET strengths_json = ?, weaknesses_json = ?, frustration_level = ?, consistency_score = ?,
               average_response_time = ?, last_sessions = ?, common_mistakes_json = ?, progression_velocity = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`,
        )
        .bind(
          JSON.stringify(profile.strengths),
          JSON.stringify(profile.weaknesses),
          profile.frustrationLevel,
          profile.consistencyScore,
          profile.averageResponseTime,
          profile.lastSessions,
          JSON.stringify(profile.commonMistakes),
          profile.progressionVelocity,
          now,
          tenantId,
          existing.id,
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO mentoria_student_evolution (
            id, tenant_id, student_profile_id, strengths_json, weaknesses_json, frustration_level,
            consistency_score, average_response_time, last_sessions, common_mistakes_json,
            progression_velocity, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          tenantId,
          profile.studentId,
          JSON.stringify(profile.strengths),
          JSON.stringify(profile.weaknesses),
          profile.frustrationLevel,
          profile.consistencyScore,
          profile.averageResponseTime,
          profile.lastSessions,
          JSON.stringify(profile.commonMistakes),
          profile.progressionVelocity,
          now,
          now,
        )
        .run();
    }

    const saved = await this.getStudentEvolutionProfile(tenantId, profile.studentId);
    if (!saved) {
      throw new Error("MENTORIA_EVOLUTION_PROFILE_PERSIST_FAILED");
    }
    return saved;
  }

  async listInterventions(tenantId: string, studentId: string): Promise<MentoriaIntervention[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM mentoria_interventions
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY updated_at DESC`,
      )
      .bind(tenantId, studentId)
      .all<InterventionRow>();
    return (result.results ?? []).map(mapIntervention);
  }

  async saveInterventions(tenantId: string, interventions: MentoriaIntervention[]): Promise<MentoriaIntervention[]> {
    for (const item of interventions) {
      const existing = await this.db
        .prepare(`SELECT id FROM mentoria_interventions WHERE tenant_id = ? AND id = ? LIMIT 1`)
        .bind(tenantId, item.id)
        .first<{ id: string }>();

      if (existing) {
        await this.db
          .prepare(
            `UPDATE mentoria_interventions
             SET student_profile_id = ?, intervention_type = ?, severity = ?, status = ?, summary = ?,
                 recommendations_json = ?, channels_json = ?, metadata_json = ?, updated_at = ?, resolved_at = ?
             WHERE tenant_id = ? AND id = ?`,
          )
          .bind(
            item.studentProfileId,
            item.type,
            item.severity,
            item.status,
            item.summary,
            JSON.stringify(item.recommendations),
            JSON.stringify(item.channels),
            JSON.stringify(item.metadata),
            item.updatedAt,
            item.resolvedAt ?? null,
            tenantId,
            item.id,
          )
          .run();
      } else {
        await this.db
          .prepare(
            `INSERT INTO mentoria_interventions (
              id, tenant_id, student_profile_id, intervention_type, severity, status, summary,
              recommendations_json, channels_json, metadata_json, created_at, updated_at, resolved_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            item.id,
            tenantId,
            item.studentProfileId,
            item.type,
            item.severity,
            item.status,
            item.summary,
            JSON.stringify(item.recommendations),
            JSON.stringify(item.channels),
            JSON.stringify(item.metadata),
            item.createdAt,
            item.updatedAt,
            item.resolvedAt ?? null,
          )
          .run();
      }
    }

    const studentId = interventions[0]?.studentProfileId;
    if (!studentId) {
      return [];
    }
    return this.listInterventions(tenantId, studentId);
  }

  async getMotivationState(tenantId: string, studentId: string): Promise<MotivationState | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_motivation_states
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`,
      )
      .bind(tenantId, studentId)
      .first<MotivationStateRow>();
    return row ? mapMotivationState(row) : null;
  }

  async saveMotivationState(tenantId: string, state: MotivationState): Promise<MotivationState> {
    const existing = await this.db
      .prepare(
        `SELECT id FROM mentoria_motivation_states
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`,
      )
      .bind(tenantId, state.studentId)
      .first<{ id: string }>();
    const now = new Date().toISOString();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_motivation_states
           SET streak = ?, last_activity_at = ?, effort_score = ?, reward_points = ?, level = ?,
               achievements_json = ?, motivation_profile = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`,
        )
        .bind(
          state.streak,
          state.lastActivityAt,
          state.effortScore,
          state.rewardPoints,
          state.level,
          JSON.stringify(state.achievements),
          state.motivationProfile,
          now,
          tenantId,
          existing.id,
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO mentoria_motivation_states (
            id, tenant_id, student_profile_id, streak, last_activity_at, effort_score, reward_points,
            level, achievements_json, motivation_profile, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          tenantId,
          state.studentId,
          state.streak,
          state.lastActivityAt,
          state.effortScore,
          state.rewardPoints,
          state.level,
          JSON.stringify(state.achievements),
          state.motivationProfile,
          now,
          now,
        )
        .run();
    }

    const saved = await this.getMotivationState(tenantId, state.studentId);
    if (!saved) {
      throw new Error("MENTORIA_MOTIVATION_STATE_PERSIST_FAILED");
    }
    return saved;
  }

  async getDailyPlan(tenantId: string, studentId: string, planDate = new Date().toISOString().slice(0, 10)): Promise<DailyPlan | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_daily_plans
         WHERE tenant_id = ? AND student_profile_id = ? AND plan_date = ?
         LIMIT 1`,
      )
      .bind(tenantId, studentId, planDate)
      .first<DailyPlanRow>();
    return row ? mapDailyPlan(row) : null;
  }

  async saveDailyPlan(tenantId: string, plan: DailyPlan): Promise<DailyPlan> {
    const existing = await this.db
      .prepare(
        `SELECT id FROM mentoria_daily_plans
         WHERE tenant_id = ? AND student_profile_id = ? AND plan_date = ?
         LIMIT 1`,
      )
      .bind(tenantId, plan.studentId, plan.planDate)
      .first<{ id: string }>();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_daily_plans
           SET recommended_duration = ?, tasks_json = ?, completed_task_ids_json = ?, priority = ?,
               adaptation_reason = ?, generated_at = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`,
        )
        .bind(
          plan.recommendedDuration,
          JSON.stringify(plan.tasks),
          JSON.stringify(plan.completedTaskIds),
          plan.priority,
          plan.adaptationReason,
          plan.generatedAt,
          plan.updatedAt,
          tenantId,
          existing.id,
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO mentoria_daily_plans (
            id, tenant_id, student_profile_id, plan_date, recommended_duration, tasks_json,
            completed_task_ids_json, priority, adaptation_reason, generated_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          plan.id,
          tenantId,
          plan.studentId,
          plan.planDate,
          plan.recommendedDuration,
          JSON.stringify(plan.tasks),
          JSON.stringify(plan.completedTaskIds),
          plan.priority,
          plan.adaptationReason,
          plan.generatedAt,
          plan.createdAt,
          plan.updatedAt,
        )
        .run();
    }

    const saved = await this.getDailyPlan(tenantId, plan.studentId, plan.planDate);
    if (!saved) {
      throw new Error("MENTORIA_DAILY_PLAN_PERSIST_FAILED");
    }
    return saved;
  }

  async getReferralProfile(tenantId: string, studentId: string): Promise<MentoriaReferralProfile | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_referral_profiles
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`,
      )
      .bind(tenantId, studentId)
      .first<ReferralProfileRow>();
    return row ? mapReferralProfile(row) : null;
  }

  async getReferralProfileByCode(tenantId: string, referralCode: string): Promise<MentoriaReferralProfile | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_referral_profiles
         WHERE tenant_id = ? AND referral_code = ?
         LIMIT 1`,
      )
      .bind(tenantId, referralCode)
      .first<ReferralProfileRow>();
    return row ? mapReferralProfile(row) : null;
  }

  async saveReferralProfile(tenantId: string, profile: MentoriaReferralProfile): Promise<MentoriaReferralProfile> {
    const existing = await this.getReferralProfile(tenantId, profile.studentId);
    const now = new Date().toISOString();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_referral_profiles
           SET referral_code = ?, total_invites = ?, registered_invites = ?, converted_invites = ?,
               premium_access_until = ?, reward_points_earned = ?, feature_unlocks_json = ?, updated_at = ?
           WHERE tenant_id = ? AND student_profile_id = ?`,
        )
        .bind(
          profile.referralCode,
          profile.totalInvites,
          profile.registeredInvites,
          profile.convertedInvites,
          profile.premiumAccessUntil ?? null,
          profile.rewardPointsEarned,
          JSON.stringify(profile.featureUnlocks),
          now,
          tenantId,
          profile.studentId,
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO mentoria_referral_profiles (
            id, tenant_id, student_profile_id, referral_code, total_invites, registered_invites,
            converted_invites, premium_access_until, reward_points_earned, feature_unlocks_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          profile.id,
          tenantId,
          profile.studentId,
          profile.referralCode,
          profile.totalInvites,
          profile.registeredInvites,
          profile.convertedInvites,
          profile.premiumAccessUntil ?? null,
          profile.rewardPointsEarned,
          JSON.stringify(profile.featureUnlocks),
          profile.createdAt,
          now,
        )
        .run();
    }

    const saved = await this.getReferralProfile(tenantId, profile.studentId);
    if (!saved) {
      throw new Error("MENTORIA_REFERRAL_PROFILE_PERSIST_FAILED");
    }
    return saved;
  }

  async listReferralsByInviter(tenantId: string, inviterStudentId: string): Promise<MentoriaReferral[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM mentoria_referrals
         WHERE tenant_id = ? AND inviter_student_profile_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(tenantId, inviterStudentId)
      .all<ReferralRow>();
    return (result.results ?? []).map(mapReferral);
  }

  async getReferralByInviteToken(tenantId: string, inviteToken: string): Promise<MentoriaReferral | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_referrals
         WHERE tenant_id = ? AND invite_token = ?
         LIMIT 1`,
      )
      .bind(tenantId, inviteToken)
      .first<ReferralRow>();
    return row ? mapReferral(row) : null;
  }

  async getReferralByInvitee(tenantId: string, inviteeStudentId: string): Promise<MentoriaReferral | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_referrals
         WHERE tenant_id = ? AND invitee_student_profile_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .bind(tenantId, inviteeStudentId)
      .first<ReferralRow>();
    return row ? mapReferral(row) : null;
  }

  async saveReferral(tenantId: string, referral: MentoriaReferral): Promise<MentoriaReferral> {
    const existing = await this.db
      .prepare(
        `SELECT id FROM mentoria_referrals
         WHERE tenant_id = ? AND id = ?
         LIMIT 1`,
      )
      .bind(tenantId, referral.id)
      .first<{ id: string }>();
    const now = new Date().toISOString();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_referrals
           SET invitee_student_profile_id = ?, invited_email = ?, referral_code = ?, invite_token = ?, status = ?,
               reward_premium_days = ?, reward_points = ?, reward_features_json = ?, source = ?, registered_at = ?,
               converted_at = ?, rewarded_at = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`,
        )
        .bind(
          referral.inviteeStudentId ?? null,
          referral.invitedEmail ?? null,
          referral.referralCode,
          referral.inviteToken ?? null,
          referral.status,
          referral.rewardPremiumDays,
          referral.rewardPoints,
          JSON.stringify(referral.rewardFeatures),
          referral.source,
          referral.registeredAt ?? null,
          referral.convertedAt ?? null,
          referral.rewardedAt ?? null,
          now,
          tenantId,
          referral.id,
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO mentoria_referrals (
            id, tenant_id, inviter_student_profile_id, invitee_student_profile_id, invited_email,
            referral_code, invite_token, status, reward_premium_days, reward_points, reward_features_json,
            source, created_at, registered_at, converted_at, rewarded_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          referral.id,
          tenantId,
          referral.inviterStudentId,
          referral.inviteeStudentId ?? null,
          referral.invitedEmail ?? null,
          referral.referralCode,
          referral.inviteToken ?? null,
          referral.status,
          referral.rewardPremiumDays,
          referral.rewardPoints,
          JSON.stringify(referral.rewardFeatures),
          referral.source,
          referral.createdAt,
          referral.registeredAt ?? null,
          referral.convertedAt ?? null,
          referral.rewardedAt ?? null,
          now,
        )
        .run();
    }

    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_referrals
         WHERE tenant_id = ? AND id = ?
         LIMIT 1`,
      )
      .bind(tenantId, referral.id)
      .first<ReferralRow>();
    if (!row) {
      throw new Error("MENTORIA_REFERRAL_PERSIST_FAILED");
    }
    return mapReferral(row);
  }

  async createProgressShare(tenantId: string, share: MentoriaProgressShare): Promise<MentoriaProgressShare> {
    await this.db
      .prepare(
        `INSERT INTO mentoria_progress_shares (
          id, tenant_id, student_profile_id, created_by_user_id, share_code, share_kind, title,
          summary_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        share.id,
        tenantId,
        share.studentId,
        share.createdByUserId,
        share.shareCode,
        share.shareKind,
        share.title,
        JSON.stringify(share.payload),
        share.createdAt,
        share.updatedAt,
      )
      .run();

    const saved = await this.getProgressShareByCode(tenantId, share.shareCode);
    if (!saved) {
      throw new Error("MENTORIA_PROGRESS_SHARE_PERSIST_FAILED");
    }
    return saved;
  }

  async getLatestProgressShare(tenantId: string, studentId: string): Promise<MentoriaProgressShare | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_progress_shares
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(tenantId, studentId)
      .first<ProgressShareRow>();
    return row ? mapProgressShare(row) : null;
  }

  async getProgressShareByCode(tenantId: string, shareCode: string): Promise<MentoriaProgressShare | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_progress_shares
         WHERE tenant_id = ? AND share_code = ?
         LIMIT 1`,
      )
      .bind(tenantId, shareCode)
      .first<ProgressShareRow>();
    return row ? mapProgressShare(row) : null;
  }

  async getProgressShareByCodeGlobal(shareCode: string): Promise<MentoriaProgressShare | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_progress_shares
         WHERE share_code = ?
         LIMIT 1`,
      )
      .bind(shareCode)
      .first<ProgressShareRow>();
    return row ? mapProgressShare(row) : null;
  }

  async upsertStudentProfile(input: {
    tenantId: string;
    studentId?: string;
    userId?: string | null;
    fullName: string;
    age: number;
    schoolYear: string;
    learningGoals: string[];
    baseEmotionalState: StudentProfile["baseEmotionalState"];
    emotionalBaseline: StudentProfile["emotionalBaseline"];
    learningPreference: StudentProfile["learningPreference"];
    preferredStudyMinutes: number;
    strengths: string[];
    onboardingCompleted: boolean;
    supportNotes?: string;
  }): Promise<StudentProfile> {
    const hasUserId = await this.hasColumn("student_profiles", "user_id");
    const hasFullName = await this.hasColumn("student_profiles", "full_name");
    const hasSchoolYear = await this.hasColumn("student_profiles", "school_year");
    const hasLearningGoalsJson = await this.hasColumn("student_profiles", "learning_goals_json");
    const hasBaseEmotionalState = await this.hasColumn("student_profiles", "base_emotional_state");
    const hasPreferredStudy = await this.hasColumn("student_profiles", "preferred_study_minutes");
    const hasStrengths = await this.hasColumn("student_profiles", "strengths_json");
    const hasSupportNotes = await this.hasColumn("student_profiles", "support_notes");
    const hasEmotionalBaselineJson = await this.hasColumn("student_profiles", "emotional_baseline_json");
    const hasLearningPreference = await this.hasColumn("student_profiles", "learning_preference");
    const hasOnboardingCompleted = await this.hasColumn("student_profiles", "onboarding_completed");

    const existing =
      (input.studentId ? await this.getStudentProfileById(input.tenantId, input.studentId) : null) ??
      (hasUserId && input.userId ? await this.getStudentProfileByUser(input.tenantId, input.userId) : null);
    const now = new Date().toISOString();
    if (existing) {
      // Build dynamic UPDATE with available columns
      const sets: string[] = ["display_name = ?", "age = ?", "grade_level = ?", "goals_json = ?", "emotional_baseline = ?", "learning_style = ?", "preferred_session_minutes = ?"]; 
      const binds: any[] = [
        input.fullName,
        input.age,
        input.schoolYear,
        JSON.stringify(input.learningGoals),
        input.baseEmotionalState,
        input.learningPreference,
        input.preferredStudyMinutes,
      ];
      if (hasFullName) {
        sets.push("full_name = ?");
        binds.push(input.fullName);
      }
      if (hasUserId && input.userId !== undefined) {
        sets.push("user_id = ?");
        binds.push(input.userId ?? null);
      }
      if (hasSchoolYear) {
        sets.push("school_year = ?");
        binds.push(input.schoolYear);
      }
      if (hasLearningGoalsJson) {
        sets.push("learning_goals_json = ?");
        binds.push(JSON.stringify(input.learningGoals));
      }
      if (hasBaseEmotionalState) {
        sets.push("base_emotional_state = ?");
        binds.push(input.baseEmotionalState);
      }
      if (hasEmotionalBaselineJson) {
        sets.push("emotional_baseline_json = ?");
        binds.push(JSON.stringify(input.emotionalBaseline));
      }
      if (hasLearningPreference) {
        sets.push("learning_preference = ?");
        binds.push(input.learningPreference);
      }
      if (hasPreferredStudy) {
        sets.push("preferred_study_minutes = ?");
        binds.push(input.preferredStudyMinutes);
      }
      if (hasStrengths) {
        sets.push("strengths_json = ?");
        binds.push(JSON.stringify(input.strengths));
      }
      if (hasSupportNotes) {
        sets.push("support_notes = ?");
        binds.push(input.supportNotes ?? null);
      }
      if (hasOnboardingCompleted) {
        sets.push("onboarding_completed = ?");
        binds.push(input.onboardingCompleted ? 1 : 0);
      }
      sets.push("updated_at = ?");
      binds.push(now);
      binds.push(input.tenantId, existing.id);
      const sql = `UPDATE student_profiles SET ${sets.join(", ")} WHERE tenant_id = ? AND id = ?`;
      await this.db.prepare(sql).bind(...binds).run();
      return (await this.getStudentProfileById(input.tenantId, existing.id)) as StudentProfile;
    }

    // INSERT path
    const id = input.studentId ?? crypto.randomUUID();
    const cols = [
      "id",
      "tenant_id",
      "display_name",
      ...(hasUserId ? ["user_id"] : []),
      ...(hasFullName ? ["full_name"] : []),
      "age",
      "grade_level",
      ...(hasSchoolYear ? ["school_year"] : []),
      "goals_json",
      ...(hasLearningGoalsJson ? ["learning_goals_json"] : []),
      "emotional_baseline",
      ...(hasBaseEmotionalState ? ["base_emotional_state"] : []),
      "learning_style",
      ...(hasEmotionalBaselineJson ? ["emotional_baseline_json"] : []),
      ...(hasLearningPreference ? ["learning_preference"] : []),
      "preferred_session_minutes",
      ...(hasPreferredStudy ? ["preferred_study_minutes"] : []),
      ...(hasStrengths ? ["strengths_json"] : []),
      ...(hasSupportNotes ? ["support_notes"] : []),
      ...(hasOnboardingCompleted ? ["onboarding_completed"] : []),
      "created_at",
      "updated_at",
    ];
    const values: any[] = [
      id,
      input.tenantId,
      input.fullName,
      ...(hasUserId ? [input.userId ?? null] : []),
      ...(hasFullName ? [input.fullName] : []),
      input.age,
      input.schoolYear,
      ...(hasSchoolYear ? [input.schoolYear] : []),
      JSON.stringify(input.learningGoals),
      ...(hasLearningGoalsJson ? [JSON.stringify(input.learningGoals)] : []),
      input.baseEmotionalState,
      ...(hasBaseEmotionalState ? [input.baseEmotionalState] : []),
      input.learningPreference,
      ...(hasEmotionalBaselineJson ? [JSON.stringify(input.emotionalBaseline)] : []),
      ...(hasLearningPreference ? [input.learningPreference] : []),
      input.preferredStudyMinutes,
      ...(hasPreferredStudy ? [input.preferredStudyMinutes] : []),
      ...(hasStrengths ? [JSON.stringify(input.strengths)] : []),
      ...(hasSupportNotes ? [input.supportNotes ?? null] : []),
      ...(hasOnboardingCompleted ? [input.onboardingCompleted ? 1 : 0] : []),
      now,
      now,
    ];
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT INTO student_profiles (${cols.join(", ")}) VALUES (${placeholders})`;
    await this.db.prepare(sql).bind(...values).run();
    return (await this.getStudentProfileById(input.tenantId, id)) as StudentProfile;
  }

  async seedSubjects(tenantId: string): Promise<MentoriaSubject[]> {
    const defaults = [
      ["matematicas", "Matematicas", "Razonamiento, calculo y resolucion guiada.", "core"],
      ["lengua", "Lengua", "Comprension, expresion escrita y lectura.", "core"],
      ["ciencias", "Ciencias", "Ciencias naturales y metodo cientifico.", "core"],
      ["historia", "Historia", "Contexto, memoria y pensamiento critico.", "growth"],
      ["ingles", "Ingles", "Comprension, speaking y vocabulario.", "growth"],
    ] as const;

    const hasBand = await this.hasColumn("mentoria_subjects", "difficulty_band");
    const hasWeight = hasBand ? false : await this.hasColumn("mentoria_subjects", "difficulty_weight");
    const hasDescription = await this.hasColumn("mentoria_subjects", "description");
    for (const [slug, name, description, difficultyBand] of defaults) {
      const now = new Date().toISOString();
      if (hasBand) {
        await this.db
          .prepare(
            `INSERT OR IGNORE INTO mentoria_subjects (
              id, tenant_id, slug, name, ${hasDescription ? "description, " : ""}difficulty_band, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ${hasDescription ? "?, " : ""}?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            tenantId,
            slug,
            name,
            ...(hasDescription ? [description] : []),
            difficultyBand,
            now,
            now,
          )
          .run();
      } else if (hasWeight) {
        const weight = difficultyBand === "growth" ? 1.2 : 1.0;
        await this.db
          .prepare(
            `INSERT OR IGNORE INTO mentoria_subjects (
              id, tenant_id, slug, name, ${hasDescription ? "description, " : ""}difficulty_weight, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ${hasDescription ? "?, " : ""}?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            tenantId,
            slug,
            name,
            ...(hasDescription ? [description] : []),
            weight,
            now,
            now,
          )
          .run();
      } else {
        // Fallback: insert without difficulty column if none exists (unlikely legacy)
        await this.db
          .prepare(
            `INSERT OR IGNORE INTO mentoria_subjects (
              id, tenant_id, slug, name, ${hasDescription ? "description, " : ""}created_at, updated_at
            ) VALUES (?, ?, ?, ?, ${hasDescription ? "?, " : ""}?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            tenantId,
            slug,
            name,
            ...(hasDescription ? [description] : []),
            now,
            now,
          )
          .run();
      }
    }
    return this.listSubjects(tenantId);
  }

  async listSubjects(tenantId: string): Promise<MentoriaSubject[]> {
    const result = await this.db
      .prepare(`SELECT * FROM mentoria_subjects WHERE tenant_id = ? ORDER BY name ASC`)
      .bind(tenantId)
      .all<SubjectRow>();
    return (result.results ?? []).map(mapSubject);
  }

  async getSubjectBySlug(tenantId: string, slug: string): Promise<MentoriaSubject | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_subjects WHERE tenant_id = ? AND slug = ? LIMIT 1`)
      .bind(tenantId, slug)
      .first<SubjectRow>();
    return row ? mapSubject(row) : null;
  }

  async getSubjectById(tenantId: string, subjectId: string): Promise<MentoriaSubject | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_subjects WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(tenantId, subjectId)
      .first<SubjectRow>();
    return row ? mapSubject(row) : null;
  }

  async listParentAccounts(tenantId: string, studentProfileId: string): Promise<ParentAccount[]> {
    const hasFullName = await this.hasColumn("parent_accounts", "full_name");
    const orderBy = hasFullName ? "full_name" : "display_name";
    const result = await this.db
      .prepare(
        `SELECT * FROM parent_accounts
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY ${orderBy} ASC`,
      )
      .bind(tenantId, studentProfileId)
      .all<ParentAccountRow>();
    return (result.results ?? []).map(mapParent);
  }

  async deleteParentAccountsForStudent(tenantId: string, studentProfileId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM parent_accounts WHERE tenant_id = ? AND student_profile_id = ?`)
      .bind(tenantId, studentProfileId)
      .run();
  }

  async getParentAccountByUser(tenantId: string, userId: string): Promise<ParentAccount | null> {
    const row = await this.db
      .prepare(`SELECT * FROM parent_accounts WHERE tenant_id = ? AND user_id = ? LIMIT 1`)
      .bind(tenantId, userId)
      .first<ParentAccountRow>();
    return row ? mapParent(row) : null;
  }

  async upsertParentAccount(input: {
    tenantId: string;
    userId: string;
    studentProfileId: string;
    fullName: string;
    email: string;
    relation: string;
    dailyStudyMinutes: number;
    supervisionLevel: ParentAccount["supervisionLevel"];
    canViewFullProgress: boolean;
    canManageSchedule: boolean;
    notificationPreferences?: string[];
  }): Promise<ParentAccount> {
    const hasUserId = await this.hasColumn("parent_accounts", "user_id");
    const existingRow = hasUserId
      ? await this.getParentAccountByUser(input.tenantId, input.userId)
      : (await this.db
          .prepare(
            `SELECT * FROM parent_accounts WHERE tenant_id = ? AND student_profile_id = ? AND relationship = ? LIMIT 1`,
          )
          .bind(input.tenantId, input.studentProfileId, input.relation)
          .first<ParentAccountRow>())
          ? mapParent(
              (await this.db
                .prepare(
                  `SELECT * FROM parent_accounts WHERE tenant_id = ? AND student_profile_id = ? AND relationship = ? LIMIT 1`,
                )
                .bind(input.tenantId, input.studentProfileId, input.relation)
                .first<ParentAccountRow>()) as ParentAccountRow,
            )
          : null;
    const now = new Date().toISOString();
    if (existingRow) {
      // Detect legacy/new columns
      const hasFullName = await this.hasColumn("parent_accounts", "full_name");
      const hasRelation = await this.hasColumn("parent_accounts", "relation");
      const hasRelLabel = await this.hasColumn("parent_accounts", "relationship_label");
      const hasNotif = await this.hasColumn("parent_accounts", "notification_preferences_json");
      const hasDailyStudy = await this.hasColumn("parent_accounts", "daily_study_minutes");
      const hasSupervision = await this.hasColumn("parent_accounts", "supervision_level");
      const hasCanView = await this.hasColumn("parent_accounts", "can_view_full_progress");
      const hasCanManage = await this.hasColumn("parent_accounts", "can_manage_schedule");
      const hasVisibility = await this.hasColumn("parent_accounts", "visibility_mode");
      const hasDailyLimit = await this.hasColumn("parent_accounts", "daily_minutes_limit");

      if (hasFullName && hasRelation && hasRelLabel && hasNotif && hasDailyStudy && hasSupervision && hasCanView && hasCanManage) {
        const whereSql = hasUserId
          ? `WHERE tenant_id = ? AND user_id = ?`
          : `WHERE tenant_id = ? AND student_profile_id = ? AND relationship = ?`;
        const stmt = this.db.prepare(
          `UPDATE parent_accounts
           SET student_profile_id = ?, label = ?, display_name = ?, full_name = ?, email = ?, relationship = ?, relation = ?, visibility_mode = ?, relationship_label = ?,
               notification_preferences_json = ?, daily_study_minutes = ?, supervision_level = ?,
               daily_minutes_limit = ?, can_view_full_progress = ?, can_manage_schedule = ?, updated_at = ?
           ${whereSql}`,
        );
        const binds = [
          input.studentProfileId,
          input.relation,
          input.fullName,
          input.fullName,
          input.email,
          input.relation,
          input.fullName,
          input.relation,
          input.supervisionLevel,
          input.relation,
          JSON.stringify(input.notificationPreferences ?? []),
          input.dailyStudyMinutes,
          input.supervisionLevel,
          input.dailyStudyMinutes,
          input.canViewFullProgress ? 1 : 0,
          input.canManageSchedule ? 1 : 0,
          now,
          input.tenantId,
          ...(hasUserId ? [input.userId] : [input.studentProfileId, input.relation]),
        ];
        await stmt.bind(...binds).run();
      } else {
        // Legacy minimal update
        const whereSql = hasUserId
          ? `WHERE tenant_id = ? AND user_id = ?`
          : `WHERE tenant_id = ? AND student_profile_id = ? AND relationship = ?`;
        const stmt = this.db.prepare(
          `UPDATE parent_accounts
           SET student_profile_id = ?, label = ?, display_name = ?, email = ?, relationship = ?, ${hasVisibility ? "visibility_mode = ?," : ""} ${hasDailyLimit ? "daily_minutes_limit = ?," : ""} updated_at = ?
           ${whereSql}`,
        );
        const binds = [
          input.studentProfileId,
          input.relation,
          input.fullName,
          input.email,
          input.relation,
          ...(hasVisibility ? [input.supervisionLevel] : []),
          ...(hasDailyLimit ? [input.dailyStudyMinutes] : []),
          now,
          input.tenantId,
          ...(hasUserId ? [input.userId] : [input.studentProfileId, input.relation]),
        ];
        await stmt.bind(...binds).run();
      }
      if (hasUserId) {
        return (await this.getParentAccountByUser(input.tenantId, input.userId)) as ParentAccount;
      }
      const updated = await this.db
        .prepare(
          `SELECT * FROM parent_accounts WHERE tenant_id = ? AND student_profile_id = ? AND relationship = ? LIMIT 1`,
        )
        .bind(input.tenantId, input.studentProfileId, input.relation)
        .first<ParentAccountRow>();
      return mapParent(updated as ParentAccountRow);
    }

    const id = crypto.randomUUID();
    const hasFullName = await this.hasColumn("parent_accounts", "full_name");
    const hasRelation = await this.hasColumn("parent_accounts", "relation");
    const hasRelLabel = await this.hasColumn("parent_accounts", "relationship_label");
    const hasNotif = await this.hasColumn("parent_accounts", "notification_preferences_json");
    const hasDailyStudy = await this.hasColumn("parent_accounts", "daily_study_minutes");
    const hasSupervision = await this.hasColumn("parent_accounts", "supervision_level");
    const hasCanView = await this.hasColumn("parent_accounts", "can_view_full_progress");
    const hasCanManage = await this.hasColumn("parent_accounts", "can_manage_schedule");
    const hasVisibility = await this.hasColumn("parent_accounts", "visibility_mode");
    const hasDailyLimit = await this.hasColumn("parent_accounts", "daily_minutes_limit");

    if (hasFullName && hasRelation && hasRelLabel && hasNotif && hasDailyStudy && hasSupervision && hasCanView && hasCanManage) {
      if (hasUserId) {
        await this.db
          .prepare(
            `INSERT INTO parent_accounts (
              id, tenant_id, user_id, student_profile_id, label, display_name, full_name, email, relationship, relation, visibility_mode, relationship_label,
              notification_preferences_json, daily_study_minutes, supervision_level, can_view_full_progress,
              can_manage_schedule, daily_minutes_limit, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            input.tenantId,
            input.userId,
            input.studentProfileId,
            input.relation,
            input.fullName,
            input.fullName,
            input.email,
            input.relation,
            input.relation,
            input.supervisionLevel,
            input.relation,
            JSON.stringify(input.notificationPreferences ?? []),
            input.dailyStudyMinutes,
            input.supervisionLevel,
            input.canViewFullProgress ? 1 : 0,
            input.canManageSchedule ? 1 : 0,
            input.dailyStudyMinutes,
            now,
            now,
          )
          .run();
      } else {
        await this.db
          .prepare(
            `INSERT INTO parent_accounts (
              id, tenant_id, student_profile_id, label, display_name, full_name, email, relationship, relation, visibility_mode, relationship_label,
              notification_preferences_json, daily_study_minutes, supervision_level, can_view_full_progress,
              can_manage_schedule, daily_minutes_limit, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            input.tenantId,
            input.studentProfileId,
            input.relation,
            input.fullName,
            input.fullName,
            input.email,
            input.relation,
            input.relation,
            input.supervisionLevel,
            input.relation,
            JSON.stringify(input.notificationPreferences ?? []),
            input.dailyStudyMinutes,
            input.supervisionLevel,
            input.canViewFullProgress ? 1 : 0,
            input.canManageSchedule ? 1 : 0,
            input.dailyStudyMinutes,
            now,
            now,
          )
          .run();
      }
    } else {
      // Legacy minimal insert
      if (hasUserId) {
        await this.db
          .prepare(
            `INSERT INTO parent_accounts (
              id, tenant_id, user_id, student_profile_id, label, display_name, email, relationship${hasVisibility ? ", visibility_mode" : ""}${hasDailyLimit ? ", daily_minutes_limit" : ""}, created_at, updated_at
            ) VALUES (${[...Array(10 + (hasVisibility ? 1 : 0) + (hasDailyLimit ? 1 : 0))].map((_, i) => (i === 0 ? "?" : ", ?")).join("")})`,
          )
          .bind(
            id,
            input.tenantId,
            input.userId,
            input.studentProfileId,
            input.relation,
            input.fullName,
            input.email,
            input.relation,
            ...(hasVisibility ? [input.supervisionLevel] : []),
            ...(hasDailyLimit ? [input.dailyStudyMinutes] : []),
            now,
            now,
          )
          .run();
      } else {
        await this.db
          .prepare(
            `INSERT INTO parent_accounts (
              id, tenant_id, student_profile_id, label, display_name, email, relationship${hasVisibility ? ", visibility_mode" : ""}${hasDailyLimit ? ", daily_minutes_limit" : ""}, created_at, updated_at
            ) VALUES (${[...Array(9 + (hasVisibility ? 1 : 0) + (hasDailyLimit ? 1 : 0))].map((_, i) => (i === 0 ? "?" : ", ?")).join("")})`,
          )
          .bind(
            id,
            input.tenantId,
            input.studentProfileId,
            input.relation,
            input.fullName,
            input.email,
            input.relation,
            ...(hasVisibility ? [input.supervisionLevel] : []),
            ...(hasDailyLimit ? [input.dailyStudyMinutes] : []),
            now,
            now,
          )
          .run();
      }
    }
    if (hasUserId) {
      return (await this.getParentAccountByUser(input.tenantId, input.userId)) as ParentAccount;
    }
    const inserted = await this.db
      .prepare(
        `SELECT * FROM parent_accounts WHERE tenant_id = ? AND student_profile_id = ? AND relationship = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(input.tenantId, input.studentProfileId, input.relation)
      .first<ParentAccountRow>();
    return mapParent(inserted as ParentAccountRow);
  }

  async getCurrentStudyPlan(tenantId: string, studentProfileId: string): Promise<StudyPlan | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_study_plans
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY week_start DESC
         LIMIT 1`,
      )
      .bind(tenantId, studentProfileId)
      .first<StudyPlanRow>();
    return row ? mapPlan(row) : null;
  }

  async replaceStudentSubjects(input: {
    tenantId: string;
    studentProfileId: string;
    subjects: Array<{ subjectId: string; initialLevel: MentoriaInitialLevel }>;
  }): Promise<MentoriaStudentSubject[]> {
    await this.db
      .prepare(`DELETE FROM mentoria_student_subjects WHERE tenant_id = ? AND student_profile_id = ?`)
      .bind(input.tenantId, input.studentProfileId)
      .run();

    const now = new Date().toISOString();
    for (const item of input.subjects) {
      await this.db
        .prepare(
          `INSERT INTO mentoria_student_subjects (
            id, tenant_id, student_profile_id, subject_id, initial_level, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), input.tenantId, input.studentProfileId, item.subjectId, item.initialLevel, now, now)
        .run();
    }
    return this.listStudentSubjects(input.tenantId, input.studentProfileId);
  }

  async listStudentSubjects(tenantId: string, studentProfileId: string): Promise<MentoriaStudentSubject[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM mentoria_student_subjects
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY updated_at DESC`,
      )
      .bind(tenantId, studentProfileId)
      .all<StudentSubjectRow>();
    const rows = result.results ?? [];
    const subjects = await this.listSubjects(tenantId);
    const byId = new Map(subjects.map((subject) => [subject.id, subject]));
    return rows.map((row) => mapStudentSubject(row, byId.get(row.subject_id)));
  }

  async saveStudyPlan(input: {
    tenantId: string;
    studentProfileId: string;
    weekStart: string;
    weekEnd: string;
    goalsSummary: string;
    blocks: StudyPlanBlock[];
    generatedBy: string;
  }): Promise<StudyPlan> {
    const existing = await this.db
      .prepare(
        `SELECT id FROM mentoria_study_plans
         WHERE tenant_id = ? AND student_profile_id = ? AND week_start = ?
         LIMIT 1`,
      )
      .bind(input.tenantId, input.studentProfileId, input.weekStart)
      .first<{ id: string }>();
    const now = new Date().toISOString();
    const hasBlocks = await this.hasColumn("mentoria_study_plans", "blocks_json");
    const hasGoals = await this.hasColumn("mentoria_study_plans", "goals_summary");
    const hasWeekEnd = await this.hasColumn("mentoria_study_plans", "week_end");
    const hasTitle = await this.hasColumn("mentoria_study_plans", "title");
    const hasPlanJson = await this.hasColumn("mentoria_study_plans", "plan_json");

    if (existing) {
      if (hasBlocks && hasGoals) {
        await this.db
          .prepare(
            `UPDATE mentoria_study_plans
             SET ${hasWeekEnd ? "week_end = ?," : ""} goals_summary = ?, blocks_json = ?, generated_by = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ?`,
          )
          .bind(
            ...(hasWeekEnd ? [input.weekEnd] : []),
            input.goalsSummary,
            JSON.stringify(input.blocks),
            input.generatedBy,
            now,
            input.tenantId,
            existing.id,
          )
          .run();
      } else if (hasTitle && hasPlanJson) {
        await this.db
          .prepare(
            `UPDATE mentoria_study_plans
             SET title = ?, plan_json = ?, generated_by = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ?`,
          )
          .bind(
            input.goalsSummary,
            JSON.stringify(input.blocks),
            input.generatedBy,
            now,
            input.tenantId,
            existing.id,
          )
          .run();
      }
    } else {
      if (hasBlocks && hasGoals) {
        const cols = [
          "id",
          "tenant_id",
          "student_profile_id",
          "week_start",
          ...(hasWeekEnd ? ["week_end"] : []),
          "goals_summary",
          "blocks_json",
          "generated_by",
          "created_at",
          "updated_at",
        ];
        const placeholders = cols.map(() => "?").join(", ");
        await this.db
          .prepare(
            `INSERT INTO mentoria_study_plans (${cols.join(", ")}) VALUES (${placeholders})`,
          )
          .bind(
            crypto.randomUUID(),
            input.tenantId,
            input.studentProfileId,
            input.weekStart,
            ...(hasWeekEnd ? [input.weekEnd] : []),
            input.goalsSummary,
            JSON.stringify(input.blocks),
            input.generatedBy,
            now,
            now,
          )
          .run();
      } else if (hasTitle && hasPlanJson) {
        await this.db
          .prepare(
            `INSERT INTO mentoria_study_plans (
              id, tenant_id, student_profile_id, title, week_start, plan_json, status, generated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            input.tenantId,
            input.studentProfileId,
            input.goalsSummary || "Plan de estudio",
            input.weekStart,
            JSON.stringify(input.blocks),
            "active",
            input.generatedBy,
            now,
            now,
          )
          .run();
      }
    }

    return (await this.getCurrentStudyPlan(input.tenantId, input.studentProfileId)) as StudyPlan;
  }

  async listProgress(tenantId: string, studentProfileId: string): Promise<MentoriaProgress[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM mentoria_progress
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY updated_at DESC`,
      )
      .bind(tenantId, studentProfileId)
      .all<ProgressRow>();
    const rows = result.results ?? [];
    const subjects = await this.listSubjects(tenantId);
    const byId = new Map(subjects.map((subject) => [subject.id, subject]));
    return rows.map((row) => mapProgress(row, byId.get(row.subject_id)));
  }

  async upsertProgress(input: {
    tenantId: string;
    studentProfileId: string;
    subjectId: string;
    masteryScore: number;
    confidenceScore: number;
    streakDays: number;
    sessionsCompleted: number;
    exercisesCompleted: number;
    weakTopics: string[];
    strongTopics: string[];
    lastActivityAt?: string;
  }): Promise<MentoriaProgress> {
    const existing = await this.db
      .prepare(
        `SELECT id FROM mentoria_progress
         WHERE tenant_id = ? AND student_profile_id = ? AND subject_id = ?
         LIMIT 1`,
      )
      .bind(input.tenantId, input.studentProfileId, input.subjectId)
      .first<{ id: string }>();
    const now = new Date().toISOString();
    const hasConfidence = await this.hasColumn("mentoria_progress", "confidence_score");
    const hasWeakTopics = await this.hasColumn("mentoria_progress", "weak_topics_json");
    const hasStrongTopics = await this.hasColumn("mentoria_progress", "strong_topics_json");
    const hasWeaknesses = hasWeakTopics ? false : await this.hasColumn("mentoria_progress", "weaknesses_json");
    const hasStrengths = hasStrongTopics ? false : await this.hasColumn("mentoria_progress", "strengths_json");
    const hasStreak = await this.hasColumn("mentoria_progress", "streak_days");
    const hasSessionsCompleted = await this.hasColumn("mentoria_progress", "sessions_completed");
    const hasExercisesCompleted = await this.hasColumn("mentoria_progress", "exercises_completed");

    if (existing) {
      if (hasConfidence && hasWeakTopics && hasStrongTopics) {
        await this.db
          .prepare(
            `UPDATE mentoria_progress
             SET mastery_score = ?, confidence_score = ?, ${hasStreak ? "streak_days = ?," : ""} ${hasSessionsCompleted ? "sessions_completed = ?," : ""}
                 ${hasExercisesCompleted ? "exercises_completed = ?," : ""} weak_topics_json = ?, strong_topics_json = ?, last_activity_at = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ?`,
          )
          .bind(
            input.masteryScore,
            input.confidenceScore,
            ...(hasStreak ? [input.streakDays] : []),
            ...(hasSessionsCompleted ? [input.sessionsCompleted] : []),
            ...(hasExercisesCompleted ? [input.exercisesCompleted] : []),
            JSON.stringify(input.weakTopics),
            JSON.stringify(input.strongTopics),
            input.lastActivityAt ?? now,
            now,
            input.tenantId,
            existing.id,
          )
          .run();
      } else {
        // Legacy schema fallback
        await this.db
          .prepare(
            `UPDATE mentoria_progress
             SET mastery_score = ?, ${hasConfidence ? "confidence_score = ?," : "focus_score = ?,"} ${hasStreak ? "streak_days = ?," : ""} ${hasSessionsCompleted ? "sessions_completed = ?," : ""}
                 ${hasExercisesCompleted ? "exercises_completed = ?," : ""} ${hasWeaknesses ? "weaknesses_json = ?," : "weak_topics_json = ?,"} ${hasStrengths ? "strengths_json = ?," : "strong_topics_json = ?,"} last_activity_at = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ?`,
          )
          .bind(
            input.masteryScore,
            input.confidenceScore,
            ...(hasStreak ? [input.streakDays] : []),
            ...(hasSessionsCompleted ? [input.sessionsCompleted] : []),
            ...(hasExercisesCompleted ? [input.exercisesCompleted] : []),
            JSON.stringify(input.weakTopics),
            JSON.stringify(input.strongTopics),
            input.lastActivityAt ?? now,
            now,
            input.tenantId,
            existing.id,
          )
          .run();
      }
    } else {
      if (hasConfidence && hasWeakTopics && hasStrongTopics) {
        await this.db
          .prepare(
            `INSERT INTO mentoria_progress (
              id, tenant_id, student_profile_id, subject_id, mastery_score, confidence_score${hasStreak ? ", streak_days" : ""}${hasSessionsCompleted ? ", sessions_completed" : ""}${hasExercisesCompleted ? ", exercises_completed" : ""},
              weak_topics_json, strong_topics_json, last_activity_at, created_at, updated_at
            ) VALUES (${["?","?","?","?","?","?"].concat(hasStreak?["?"]:[]).concat(hasSessionsCompleted?["?"]:[]).concat(hasExercisesCompleted?["?"]:[]).concat(["?","?","?","?","?"]).join(", ")})`,
          )
          .bind(
            crypto.randomUUID(),
            input.tenantId,
            input.studentProfileId,
            input.subjectId,
            input.masteryScore,
            input.confidenceScore,
            ...(hasStreak ? [input.streakDays] : []),
            ...(hasSessionsCompleted ? [input.sessionsCompleted] : []),
            ...(hasExercisesCompleted ? [input.exercisesCompleted] : []),
            JSON.stringify(input.weakTopics),
            JSON.stringify(input.strongTopics),
            input.lastActivityAt ?? now,
            now,
            now,
          )
          .run();
      } else {
        await this.db
          .prepare(
            `INSERT INTO mentoria_progress (
              id, tenant_id, student_profile_id, subject_id, mastery_score, ${hasConfidence ? "confidence_score" : "focus_score"}${hasStreak ? ", streak_days" : ""}${hasSessionsCompleted ? ", sessions_completed" : ""}${hasExercisesCompleted ? ", exercises_completed" : ""},
              ${hasWeaknesses ? "weaknesses_json" : "weak_topics_json"}, ${hasStrengths ? "strengths_json" : "strong_topics_json"}, last_activity_at, created_at, updated_at
            ) VALUES (${["?","?","?","?","?","?"].concat(hasStreak?["?"]:[]).concat(hasSessionsCompleted?["?"]:[]).concat(hasExercisesCompleted?["?"]:[]).concat(["?","?","?","?","?"]).join(", ")})`,
          )
          .bind(
            crypto.randomUUID(),
            input.tenantId,
            input.studentProfileId,
            input.subjectId,
            input.masteryScore,
            input.confidenceScore,
            ...(hasStreak ? [input.streakDays] : []),
            ...(hasSessionsCompleted ? [input.sessionsCompleted] : []),
            ...(hasExercisesCompleted ? [input.exercisesCompleted] : []),
            JSON.stringify(input.weakTopics),
            JSON.stringify(input.strongTopics),
            input.lastActivityAt ?? now,
            now,
            now,
          )
          .run();
      }
    }

    return (await this.listProgress(input.tenantId, input.studentProfileId)).find((item) => item.subjectId === input.subjectId) as MentoriaProgress;
  }

  async deleteProgressForStudent(tenantId: string, studentProfileId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM mentoria_progress WHERE tenant_id = ? AND student_profile_id = ?`)
      .bind(tenantId, studentProfileId)
      .run();
  }

  async listExercises(tenantId: string, studentProfileId: string, subjectId?: string): Promise<MentoriaExercise[]> {
    const statement = subjectId
      ? this.db.prepare(
          `SELECT * FROM mentoria_exercises
           WHERE tenant_id = ? AND student_profile_id = ? AND subject_id = ?
           ORDER BY created_at DESC`,
        ).bind(tenantId, studentProfileId, subjectId)
      : this.db.prepare(
          `SELECT * FROM mentoria_exercises
           WHERE tenant_id = ? AND student_profile_id = ?
           ORDER BY created_at DESC`,
        ).bind(tenantId, studentProfileId);
    const result = await statement.all<ExerciseRow>();
    return (result.results ?? []).map(mapExercise);
  }

  async createExercise(input: {
    tenantId: string;
    studentProfileId: string;
    subjectId: string;
    sessionId?: string;
    prompt: string;
    expectedCompetency: string;
    hints: string[];
    answerFormat: string;
    difficultyLevel: string;
  }): Promise<MentoriaExercise> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO mentoria_exercises (
          id, tenant_id, student_profile_id, subject_id, session_id, prompt, expected_competency,
          hints_json, answer_format, status, difficulty_level, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      )
      .bind(
        id,
        input.tenantId,
        input.studentProfileId,
        input.subjectId,
        input.sessionId ?? null,
        input.prompt,
        input.expectedCompetency,
        JSON.stringify(input.hints),
        input.answerFormat,
        input.difficultyLevel,
        now,
        now,
      )
      .run();
    return (await this.listExercises(input.tenantId, input.studentProfileId, input.subjectId)).find((exercise) => exercise.id === id) as MentoriaExercise;
  }

  async completeExercise(input: {
    tenantId: string;
    exerciseId: string;
    studentProfileId: string;
    studentAnswer: string;
    correctionFeedback: string;
    score: number;
  }): Promise<MentoriaExercise | null> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE mentoria_exercises
         SET student_answer = ?, correction_feedback = ?, score = ?, status = 'corrected', updated_at = ?
         WHERE tenant_id = ? AND id = ? AND student_profile_id = ?`,
      )
      .bind(
        input.studentAnswer,
        input.correctionFeedback,
        input.score,
        now,
        input.tenantId,
        input.exerciseId,
        input.studentProfileId,
      )
      .run();
    const exercises = await this.listExercises(input.tenantId, input.studentProfileId);
    return exercises.find((exercise) => exercise.id === input.exerciseId) ?? null;
  }

  async createLearningSession(input: {
    tenantId: string;
    studentProfileId: string;
    subjectId: string;
    topic: string;
    transcript: MentoriaSessionMessage[];
    emotionalState: string;
    tutorSummary: string;
    recommendedNextStep: string;
    aiTokensUsed: number;
  }): Promise<LearningSession> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO mentoria_sessions (
          id, tenant_id, mentor_id, client_id, student_profile_id, subject_id, topic, status,
          duration_minutes, ai_tokens_used, transcript_json, emotional_state, tutor_summary,
          recommended_next_step, created_at, updated_at
        ) VALUES (?, ?, 'mentor-orchestrated', ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.tenantId,
        input.studentProfileId,
        input.studentProfileId,
        input.subjectId,
        input.topic,
        Math.max(10, input.transcript.length * 3),
        input.aiTokensUsed,
        JSON.stringify(input.transcript),
        input.emotionalState,
        input.tutorSummary,
        input.recommendedNextStep,
        now,
        now,
      )
      .run();
    return (await this.getLearningSessionById(input.tenantId, id)) as LearningSession;
  }

  async getLearningSessionById(tenantId: string, id: string): Promise<LearningSession | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_sessions WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(tenantId, id)
      .first<LearningSessionRow>();
    return row ? mapLearningSession(row) : null;
  }

  async listLearningSessions(tenantId: string, studentProfileId: string): Promise<LearningSession[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM mentoria_sessions
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .bind(tenantId, studentProfileId)
      .all<LearningSessionRow>();
    return (result.results ?? []).map(mapLearningSession);
  }

  async createMaterialIntake(input: {
    tenantId: string;
    studentProfileId: string;
    sourceMessageId: string;
    phoneNumber: string;
    mediaType: "image" | "document";
    intakeKind: MentoriaMaterialIntakeKind;
    providerMediaId: string;
    mimeType: string;
    fileName?: string | null;
    caption?: string | null;
    originalText?: string | null;
  }): Promise<{ intake: MentoriaMaterialIntake; replayed: boolean }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await this.db
        .prepare(
          `INSERT INTO mentoria_material_intakes (
             id, tenant_id, student_profile_id, channel, source_message_id, phone_number,
             media_type, intake_kind, provider_media_id, mime_type, file_name, caption, original_text,
             status, created_at, updated_at
           ) VALUES (?, ?, ?, 'whatsapp', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)`
        )
        .bind(
          id,
          input.tenantId,
          input.studentProfileId,
          input.sourceMessageId,
          input.phoneNumber,
          input.mediaType,
          input.intakeKind,
          input.providerMediaId,
          input.mimeType,
          input.fileName ?? null,
          input.caption ?? null,
          input.originalText ?? null,
          now,
          now,
        )
        .run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await this.getMaterialIntakeBySourceMessage(input.tenantId, input.sourceMessageId);
        if (existing) {
          return { intake: existing, replayed: true };
        }
      }
      throw error;
    }

    const row = await this.db
      .prepare(`SELECT * FROM mentoria_material_intakes WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(input.tenantId, id)
      .first<MaterialIntakeRow>();

    if (!row) {
      throw new Error("MENTORIA_MATERIAL_INTAKE_PERSIST_FAILED");
    }

    return { intake: mapMaterialIntake(row), replayed: false };
  }

  async getLatestMaterialIntake(tenantId: string, studentProfileId: string): Promise<MentoriaMaterialIntake | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_material_intakes
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(tenantId, studentProfileId)
      .first<MaterialIntakeRow>();
    return row ? mapMaterialIntake(row) : null;
  }

  async getMaterialIntakeBySourceMessage(tenantId: string, sourceMessageId: string): Promise<MentoriaMaterialIntake | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_material_intakes
         WHERE tenant_id = ? AND source_message_id = ?
         LIMIT 1`
      )
      .bind(tenantId, sourceMessageId)
      .first<MaterialIntakeRow>();
    return row ? mapMaterialIntake(row) : null;
  }

  async updateMaterialIntakeKind(input: {
    tenantId: string;
    intakeId: string;
    intakeKind: MentoriaMaterialIntakeKind;
  }): Promise<{ intake: MentoriaMaterialIntake; replayed: boolean }> {
    const existing = await this.db
      .prepare(`SELECT * FROM mentoria_material_intakes WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(input.tenantId, input.intakeId)
      .first<MaterialIntakeRow>();

    if (!existing) {
      throw new Error("MENTORIA_MATERIAL_INTAKE_NOT_FOUND");
    }

    if (existing.intake_kind === input.intakeKind) {
      return { intake: mapMaterialIntake(existing), replayed: true };
    }

    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE mentoria_material_intakes
         SET intake_kind = ?, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(input.intakeKind, now, input.tenantId, input.intakeId)
      .run();

    const updated = await this.db
      .prepare(`SELECT * FROM mentoria_material_intakes WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(input.tenantId, input.intakeId)
      .first<MaterialIntakeRow>();

    if (!updated) {
      throw new Error("MENTORIA_MATERIAL_INTAKE_PERSIST_FAILED");
    }

    return { intake: mapMaterialIntake(updated), replayed: false };
  }

  async createMaterialContextNote(input: {
    tenantId: string;
    studentProfileId: string;
    materialIntakeId: string;
    sourceMessageId: string;
    body: string;
  }): Promise<{ note: MentoriaMaterialContextNote; replayed: boolean }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await this.db
        .prepare(
          `INSERT INTO mentoria_material_context_notes (
             id, tenant_id, student_profile_id, material_intake_id, channel, source_message_id, body, created_at
           ) VALUES (?, ?, ?, ?, 'whatsapp', ?, ?, ?)`
        )
        .bind(id, input.tenantId, input.studentProfileId, input.materialIntakeId, input.sourceMessageId, input.body, now)
        .run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await this.getMaterialContextNoteBySourceMessage(input.tenantId, input.sourceMessageId);
        if (existing) {
          return { note: existing, replayed: true };
        }
      }
      throw error;
    }

    const row = await this.db
      .prepare(`SELECT * FROM mentoria_material_context_notes WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(input.tenantId, id)
      .first<MaterialContextNoteRow>();

    if (!row) {
      throw new Error("MENTORIA_MATERIAL_CONTEXT_NOTE_PERSIST_FAILED");
    }

    return { note: mapMaterialContextNote(row), replayed: false };
  }

  async getMaterialContextNoteBySourceMessage(tenantId: string, sourceMessageId: string): Promise<MentoriaMaterialContextNote | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_material_context_notes
         WHERE tenant_id = ? AND source_message_id = ?
         LIMIT 1`
      )
      .bind(tenantId, sourceMessageId)
      .first<MaterialContextNoteRow>();
    return row ? mapMaterialContextNote(row) : null;
  }

  async countLearningSessionsForDay(tenantId: string, studentProfileId: string, isoDay: string): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) as total
         FROM mentoria_sessions
         WHERE tenant_id = ? AND student_profile_id = ? AND substr(created_at, 1, 10) = ?`,
      )
      .bind(tenantId, studentProfileId, isoDay)
      .first<{ total: number }>();
    return Number(row?.total ?? 0);
  }

  async countExercisesForDay(tenantId: string, studentProfileId: string, isoDay: string): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) as total
         FROM mentoria_exercises
         WHERE tenant_id = ? AND student_profile_id = ? AND substr(created_at, 1, 10) = ?`,
      )
      .bind(tenantId, studentProfileId, isoDay)
      .first<{ total: number }>();
    return Number(row?.total ?? 0);
  }

  async countPlannerRegenerationsForDay(tenantId: string, studentProfileId: string, isoDay: string): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) as total
         FROM mentoria_study_plans
         WHERE tenant_id = ? AND student_profile_id = ? AND substr(updated_at, 1, 10) = ?`,
      )
      .bind(tenantId, studentProfileId, isoDay)
      .first<{ total: number }>();
    return Number(row?.total ?? 0);
  }

  async startFocusSession(input: {
    tenantId: string;
    studentProfileId: string;
    subjectId?: string;
    studyPlanId?: string;
    durationMinutes: number;
    notes?: string;
  }): Promise<FocusSession> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO mentoria_focus_sessions (
          id, tenant_id, student_profile_id, subject_id, study_plan_id, started_at,
          duration_minutes, distractions_count, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?, ?)`,
      )
      .bind(
        id,
        input.tenantId,
        input.studentProfileId,
        input.subjectId ?? null,
        input.studyPlanId ?? null,
        now,
        input.durationMinutes,
        input.notes ?? null,
        now,
        now,
      )
      .run();
    return (await this.getFocusSessionById(input.tenantId, id)) as FocusSession;
  }

  async completeFocusSession(input: {
    tenantId: string;
    focusSessionId: string;
    studentProfileId: string;
    distractionsCount: number;
    notes?: string;
  }): Promise<FocusSession | null> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE mentoria_focus_sessions
         SET ended_at = ?, distractions_count = ?, status = 'completed', notes = ?, updated_at = ?
         WHERE tenant_id = ? AND id = ? AND student_profile_id = ?`,
      )
      .bind(
        now,
        input.distractionsCount,
        input.notes ?? null,
        now,
        input.tenantId,
        input.focusSessionId,
        input.studentProfileId,
      )
      .run();
    return this.getFocusSessionById(input.tenantId, input.focusSessionId);
  }

  async getFocusSessionById(tenantId: string, focusSessionId: string): Promise<FocusSession | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_focus_sessions WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(tenantId, focusSessionId)
      .first<FocusSessionRow>();
    return row ? mapFocus(row) : null;
  }

  async listFocusSessions(tenantId: string, studentProfileId: string): Promise<FocusSession[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM mentoria_focus_sessions
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY started_at DESC
         LIMIT 20`,
      )
      .bind(tenantId, studentProfileId)
      .all<FocusSessionRow>();
    return (result.results ?? []).map(mapFocus);
  }

  async incrementSessionsCompleted(input: {
    tenantId: string;
    studentProfileId: string;
    subjectId: string;
  }): Promise<MentoriaProgress> {
    const progress = await this.listProgress(input.tenantId, input.studentProfileId);
    const current = progress.find((p) => p.subjectId === input.subjectId);
    
    if (!current) {
      throw new Error("MENTORIA_PROGRESS_NOT_FOUND");
    }

    return this.upsertProgress({
      tenantId: input.tenantId,
      studentProfileId: input.studentProfileId,
      subjectId: input.subjectId,
      masteryScore: current.masteryScore,
      confidenceScore: current.confidenceScore,
      streakDays: current.streakDays,
      sessionsCompleted: current.sessionsCompleted + 1,
      exercisesCompleted: current.exercisesCompleted,
      weakTopics: current.weakTopics,
      strongTopics: current.strongTopics,
      lastActivityAt: new Date().toISOString(),
    });
  }

  async incrementExercisesCompleted(input: {
    tenantId: string;
    studentProfileId: string;
    subjectId: string;
  }): Promise<MentoriaProgress> {
    const progress = await this.listProgress(input.tenantId, input.studentProfileId);
    const current = progress.find((p) => p.subjectId === input.subjectId);
    
    if (!current) {
      throw new Error("MENTORIA_PROGRESS_NOT_FOUND");
    }

    return this.upsertProgress({
      tenantId: input.tenantId,
      studentProfileId: input.studentProfileId,
      subjectId: input.subjectId,
      masteryScore: current.masteryScore,
      confidenceScore: current.confidenceScore,
      streakDays: current.streakDays,
      sessionsCompleted: current.sessionsCompleted,
      exercisesCompleted: current.exercisesCompleted + 1,
      weakTopics: current.weakTopics,
      strongTopics: current.strongTopics,
      lastActivityAt: new Date().toISOString(),
    });
  }

  async getDashboard(tenantId: string, studentProfileId: string): Promise<Omit<MentoriaDashboard, "billing"> | null> {
    const hasStudyPlansTable = await this.hasTable("mentoria_study_plans");
    const hasPlanWeekEnd = hasStudyPlansTable && await this.hasColumn("mentoria_study_plans", "week_end");
    const hasPlanGoalsSummary = hasStudyPlansTable && await this.hasColumn("mentoria_study_plans", "goals_summary");
    const hasPlanBlocksJson = hasStudyPlansTable && await this.hasColumn("mentoria_study_plans", "blocks_json");
    const hasPlanTitle = hasStudyPlansTable && await this.hasColumn("mentoria_study_plans", "title");
    const hasPlanJson = hasStudyPlansTable && await this.hasColumn("mentoria_study_plans", "plan_json");
    const planSelect = hasStudyPlansTable
      ? `,
            p.id AS plan_id,
            p.week_start AS plan_week_start,
            ${hasPlanWeekEnd ? "p.week_end" : "p.week_start"} AS plan_week_end,
            ${hasPlanGoalsSummary ? "p.goals_summary" : hasPlanTitle ? "p.title" : "NULL"} AS plan_goals_summary,
            ${hasPlanBlocksJson ? "p.blocks_json" : hasPlanJson ? "p.plan_json" : "'[]'"} AS plan_blocks_json`
      : `,
            NULL AS plan_id,
            NULL AS plan_week_start,
            NULL AS plan_week_end,
            NULL AS plan_goals_summary,
            NULL AS plan_blocks_json`;
    const planJoin = hasStudyPlansTable
      ? `
         LEFT JOIN mentoria_study_plans p
           ON p.tenant_id = s.tenant_id
          AND p.student_profile_id = s.id
          AND p.week_start = (
            SELECT MAX(week_start) FROM mentoria_study_plans
            WHERE tenant_id = s.tenant_id AND student_profile_id = s.id
          )`
      : "";
    const row = await this.db
      .prepare(
        `SELECT
            s.id AS student_id,
            s.full_name AS student_name,
            s.school_year,
            s.base_emotional_state,
            s.preferred_study_minutes
            ${planSelect}
         FROM student_profiles s${planJoin}
         WHERE s.tenant_id = ? AND s.id = ?
         LIMIT 1`,
      )
      .bind(tenantId, studentProfileId)
      .first<DashboardRow>();
    if (!row) return null;

    const [profile, subjects, studentSubjects, progress, sessions, focusSessions, parents, dailyPlan] = await Promise.all([
      this.getStudentProfileById(tenantId, studentProfileId),
      this.listSubjects(tenantId),
      this.listStudentSubjects(tenantId, studentProfileId),
      this.listProgress(tenantId, studentProfileId),
      this.listLearningSessions(tenantId, studentProfileId),
      this.listFocusSessions(tenantId, studentProfileId),
      this.listParentAccounts(tenantId, studentProfileId),
      this.getDailyPlan(tenantId, studentProfileId),
    ]);

    return {
      student: profile as StudentProfile,
      subjects,
      studentSubjects,
      currentPlan: row.plan_id
        ? {
            id: row.plan_id,
            tenantId,
            studentProfileId,
            weekStart: row.plan_week_start as string,
            weekEnd: row.plan_week_end as string,
            goalsSummary: row.plan_goals_summary ?? "",
            blocks: parseBlocks(row.plan_blocks_json),
            generatedBy: "planner-agent",
            createdAt: row.plan_week_start as string,
            updatedAt: row.plan_week_end as string,
          }
        : null,
      dailyPlan,
      progress,
      recentSessions: sessions,
      focusSessions,
      parents,
    };
  }
}
