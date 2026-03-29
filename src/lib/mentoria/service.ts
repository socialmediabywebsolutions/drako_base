import { createActivationEvent, type ActivationEvent } from "@/lib/drako/activation";
import { executeAgent, createAgentResponse, createAgentTask } from "@/lib/drako/agent-core";
import { createInsight, generateInsights, type Insight } from "@/lib/drako/insights";
import { createUserContext, getUserContext, saveUserContext, type UserContext } from "@/lib/drako/memory";
import { createMetricEvent, listEventsForUser, trackEvent } from "@/lib/drako/metrics";
import { buildOnboardingUserContext, type OnboardingInput } from "@/lib/drako/onboarding";
import { evaluateStudentEmotion } from "@/lib/agents/mentoria/emotional-orchestrator";
import type { MentoriaAgentHistoryTurn } from "@/lib/agents/mentoria/base-agent";
import { correctExercise } from "@/lib/agents/mentoria/exercise-agent";
import { buildStudyPlan } from "@/lib/agents/mentoria/planner-agent";
import { buildInitialProgressFromOnboarding } from "@/lib/agents/mentoria/progress-agent";
import { getCanonicalSubscriptionState } from "@/lib/billing/subscriptions";
import { ensureMentoriaAgentHandlersRegistered } from "@/lib/mentoria/drako-agent-handlers";
import { detectInterventions, materializeInterventions } from "@/lib/mentoria/intervention-engine";
import { completeDailyPlanTask, generateDailyPlan } from "@/lib/mentoria/learning-loop-engine";
import {
  createInitialMotivationState,
  detectMotivationProfile,
  type MotivationState,
  updateMotivationFromSession,
} from "@/lib/mentoria/motivation-engine";
import {
  applyMentoriaGrowthEntitlements,
  assertMentoriaLimit,
  buildMentoriaBillingSummary,
} from "@/lib/mentoria/plans";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import {
  buildGuardianHookEvents,
  buildStudentMemorySummary,
  buildWorkspaceEntry,
  inferSubjectAndTopic,
} from "@/lib/mentoria/product-experience";
import {
  applyReferralReward,
  buildGrowthRecommendations,
  buildProgressShareMessage,
  buildProgressSharePayload,
  buildReferralInviteMessage,
  buildReferralRewardPackage,
  generateInviteToken,
  generateReferralCode,
  resolveGrowthEntitlements,
} from "@/lib/mentoria/referral-system";
import { MentoriaRepository } from "@/lib/mentoria/repository";
import { SessionPersistenceManager } from "@/lib/mentoria/session-persistence";
import { generateSessionSummary } from "@/lib/mentoria/session-summary";
import { sendParentSessionNotification, detectAndTriggerAlerts } from "@/lib/mentoria/parent-notifications";
import { generateSessionFeedback, buildSessionCompletionMessage } from "@/lib/mentoria/session-feedback";
import { TrialManager } from "@/lib/mentoria/trial-system";
import { checkAccessControl, UpgradeFlowError, buildTrialExpiringWarning } from "@/lib/mentoria/upgrade-flow";
import {
  createInitialEvolutionProfile,
  updateEvolutionFromSession,
  updateEvolutionProfileFromExercise,
  type StudentEvolutionProfile,
} from "@/lib/mentoria/student-evolution";
import type {
  DailyPlan,
  MentoriaBillingSummary,
  MentoriaDashboard,
  MentoriaProgress,
  MentoriaEmotionalBaseline,
  MentoriaExercise,
  MentoriaGuardianHookEvent,
  MentoriaGrowthSummary,
  MentoriaIntervention,
  MentoriaInitialLevel,
  MentoriaLearningPreference,
  MentoriaProgressShare,
  MentoriaReferral,
  MentoriaReferralProfile,
  MentoriaStudentMemorySummary,
  MentoriaSubject,
  MentoriaSupervisionLevel,
  MentoriaWorkspaceEntry,
  ParentAccount,
  StudentProfile,
  StudyPlan,
} from "@/lib/mentoria/types";

type MentoriaSessionActor = Pick<UserContext, "userId" | "email" | "tenantId"> & {
  role: "admin" | "user";
};

type OnboardingSubjectInput = {
  subjectSlug: string;
  initialLevel: MentoriaInitialLevel;
};

type OnboardingParentInput = {
  slot: "Parent A" | "Parent B";
  fullName: string;
  email: string;
  dailyStudyMinutes: number;
  supervisionLevel: MentoriaSupervisionLevel;
};

type OnboardingPayload = {
  fullName: string;
  age: number;
  schoolYear: string;
  subjects: OnboardingSubjectInput[];
  emotionalBaseline?: MentoriaEmotionalBaseline;
  learningPreference?: MentoriaLearningPreference;
  parents?: OnboardingParentInput[];
  objective?: "improve_understanding" | "pass_subject" | "build_habit" | "gain_confidence";
  confidenceLevel?: "low" | "medium" | "high";
  referralCode?: string;
  inviteToken?: string;
};

type MentoriaOnboardingAttributes = {
  schoolYear: string;
  objective?: OnboardingPayload["objective"];
  confidenceLevel: "low" | "medium" | "high";
  learningPreference?: MentoriaLearningPreference;
};

function deriveEmotionalBaselineFromConfidence(confidenceLevel: "low" | "medium" | "high"): MentoriaEmotionalBaseline {
  if (confidenceLevel === "low") {
    return { frustration: "high", motivation: "medium", concentration: "low" };
  }
  if (confidenceLevel === "high") {
    return { frustration: "low", motivation: "high", concentration: "high" };
  }
  return { frustration: "medium", motivation: "medium", concentration: "medium" };
}

function deriveLearningPreferenceFromObjective(
  objective: OnboardingPayload["objective"],
  schoolYear: string,
): MentoriaLearningPreference {
  if (objective === "build_habit" || objective === "pass_subject") {
    return "step_by_step";
  }
  if (objective === "gain_confidence") {
    return "practical_examples";
  }
  return schoolYear.toLowerCase().includes("bachillerato") ? "quick_summaries" : "practical_examples";
}

function deriveLearningGoalsFromObjective(subjects: Array<{ name: string }>, objective: OnboardingPayload["objective"]): string[] {
  if (objective === "pass_subject") {
    return subjects.map((subject) => `Aprobar ${subject.name} con una base mas segura`);
  }
  if (objective === "build_habit") {
    return subjects.map((subject) => `Crear una rutina estable en ${subject.name}`);
  }
  if (objective === "gain_confidence") {
    return subjects.map((subject) => `Recuperar confianza al trabajar ${subject.name}`);
  }
  return subjects.map((subject) => `Comprender mejor ${subject.name} con ayuda guiada`);
}

function derivePreferredStudyMinutesFromConfidence(schoolYear: string, confidenceLevel: "low" | "medium" | "high"): number {
  const stageBoost = schoolYear.toLowerCase().includes("bachillerato") ? 10 : schoolYear.toLowerCase().includes("eso") ? 5 : 0;
  const base = confidenceLevel === "low" ? 25 : confidenceLevel === "high" ? 40 : 30;
  return Math.max(20, base + stageBoost);
}

function buildActivationPrompt(input: {
  student: StudentProfile;
  objective: OnboardingPayload["objective"];
  confidenceLevel: "low" | "medium" | "high";
  weakestSubjectName: string;
}) {
  const confidenceMessage =
    input.confidenceLevel === "low"
      ? "Me cuesta arrancar con confianza."
      : input.confidenceLevel === "high"
        ? "Quiero avanzar con buen ritmo desde ya."
        : "Quiero empezar con claridad y sin liarme.";
  const objectiveMessage =
    input.objective === "pass_subject"
      ? `Quiero aprobar ${input.weakestSubjectName}.`
      : input.objective === "build_habit"
        ? `Quiero coger habito en ${input.weakestSubjectName}.`
        : input.objective === "gain_confidence"
          ? `Quiero sentirme mas seguro con ${input.weakestSubjectName}.`
          : `Quiero entender mejor ${input.weakestSubjectName}.`;

  return {
    topic: input.weakestSubjectName,
    message: `${objectiveMessage} ${confidenceMessage} Ayudame a empezar por una primera idea facil de seguir.`,
  };
}

function deriveBaseEmotionalState(baseline: MentoriaEmotionalBaseline): StudentProfile["baseEmotionalState"] {
  if (baseline.concentration === "low") return "blocked";
  if (baseline.frustration === "high") return "frustrated";
  if (baseline.motivation === "low") return "demotivated";
  if (baseline.frustration === "low" && baseline.motivation === "high" && baseline.concentration === "high") return "confident";
  return "steady";
}

function deriveLearningGoals(subjects: Array<{ name: string }>): string[] {
  return subjects.map((subject) => `Construir una base solida en ${subject.name}`);
}

function deriveStrengths(input: OnboardingSubjectInput[], subjects: Array<{ id: string; name: string }>): string[] {
  return input
    .filter((item) => item.initialLevel === "se_me_da_bien")
    .map((item) => subjects.find((subject) => subject.id === item.subjectSlug || subject.name === item.subjectSlug)?.name ?? item.subjectSlug);
}

function averageDailyMinutes(parents: OnboardingParentInput[]): number {
  return Math.max(20, Math.round(parents.reduce((total, parent) => total + parent.dailyStudyMinutes, 0) / parents.length));
}

function toOnboardingInput(
  payload: OnboardingPayload,
  learningGoals: string[],
  confidenceLevel: "low" | "medium" | "high",
): OnboardingInput<MentoriaOnboardingAttributes, OnboardingSubjectInput> {
  return {
    fullName: payload.fullName,
    age: payload.age,
    goals: learningGoals,
    attributes: {
      schoolYear: payload.schoolYear,
      objective: payload.objective,
      confidenceLevel,
      learningPreference: payload.learningPreference,
    },
    selections: payload.subjects,
    metadata: {
      referralCode: payload.referralCode ?? null,
      inviteToken: payload.inviteToken ?? null,
    },
  };
}

export class MentoriaService {
  constructor(
    private repository = new MentoriaRepository(),
    private familyRepository = new MentoriaFamilyRepository(),
    private persistence = new SessionPersistenceManager(),
    private trialManager = new TrialManager(),
  ) {
    ensureMentoriaAgentHandlersRegistered();
  }

  private canManageBilling(actor: MentoriaSessionActor): boolean {
    return Boolean(actor.userId && actor.tenantId);
  }

  private async syncUserContext(
    actor: MentoriaSessionActor,
    student: StudentProfile,
    options?: {
      progress?: MentoriaProgress[];
      evolution?: StudentEvolutionProfile;
      motivation?: MotivationState;
      dailyPlan?: DailyPlan | null;
      lastSubject?: MentoriaSubject | null;
    },
  ): Promise<UserContext> {
    const existing = await getUserContext(actor.userId);
    const progress = options?.progress ?? (await this.repository.listProgress(actor.tenantId, student.id));
    const evolution = options?.evolution ?? (await this.ensureEvolutionProfile(actor.tenantId, student));
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = options?.motivation ?? (await this.ensureMotivationState(actor.tenantId, student, evolution, interventions));
    const dailyPlan = options?.dailyPlan ?? (await this.ensureDailyPlan(actor.tenantId, student, { progress, evolution, interventions, motivation }));
    const subjects = await this.repository.listSubjects(actor.tenantId);
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject.name]));
    const weakSubjects = progress
      .filter((item) => item.masteryScore < 65 || item.confidenceScore < 60)
      .map((item) => subjectById.get(item.subjectId) ?? item.subjectId);
    const strongSubjects = progress
      .filter((item) => item.masteryScore >= 80 && item.confidenceScore >= 75)
      .map((item) => subjectById.get(item.subjectId) ?? item.subjectId);
    const sessionsCompleted = progress.reduce((total, item) => total + item.sessionsCompleted, 0);
    const exercisesCompleted = progress.reduce((total, item) => total + item.exercisesCompleted, 0);

    const context = createUserContext({
      tenantId: actor.tenantId,
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      lifecycleStage: student.onboardingCompleted ? "active" : "new",
      goals: student.learningGoals,
      tags: Array.from(new Set([...(existing?.tags ?? []), "mentoria"])),
      traits: {
        ...(existing?.traits ?? {}),
        fullName: student.fullName,
        schoolYear: student.schoolYear,
        learningStage: student.learningStage,
        preferredStudyMinutes: student.preferredStudyMinutes,
        weakSubjects,
        strongSubjects,
        consistencyScore: Number(evolution.consistencyScore.toFixed(4)),
        frustrationLevel: Number(evolution.frustrationLevel.toFixed(4)),
        progressionVelocity: Number(evolution.progressionVelocity.toFixed(4)),
        motivationProfile: motivation.motivationProfile,
        effortScore: Number(motivation.effortScore.toFixed(4)),
        streak: motivation.streak,
        sessionsCompleted,
        exercisesCompleted,
        dailyPlanPriority: dailyPlan.priority,
        onboardingCompleted: student.onboardingCompleted,
        lastActiveSubject: options?.lastSubject?.name ?? (existing?.traits?.lastActiveSubject as string | undefined) ?? "",
      },
      preferences: {
        ...(existing?.preferences ?? {}),
        learningPreference: student.learningPreference,
      },
    });

    return saveUserContext(actor.userId, context);
  }

  private async buildUserInsights(actor: MentoriaSessionActor, context: UserContext): Promise<Insight[]> {
    const events = await listEventsForUser(actor.userId, 100);
    return generateInsights({
      context,
      events,
    });
  }

  private async buildProgressAnalysis(input: {
    actor: MentoriaSessionActor;
    student: StudentProfile;
    progress: MentoriaProgress[];
    studentSubjects: Array<{ subjectId: string }>;
    evolution: StudentEvolutionProfile;
    interventions: MentoriaIntervention[];
    motivation: MotivationState;
    dailyPlan: DailyPlan;
  }): Promise<{ weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] }> {
    const subjectIds = new Set(input.studentSubjects.map((item) => item.subjectId));
    const subjects = (await this.repository.listSubjects(input.actor.tenantId)).filter((subject) => subjectIds.has(subject.id));
    const userContext = await this.syncUserContext(input.actor, input.student, {
      progress: input.progress,
      evolution: input.evolution,
      motivation: input.motivation,
      dailyPlan: input.dailyPlan,
    });
    const analysis = await executeAgent<
      {
        progress: MentoriaProgress[];
        subjects: MentoriaSubject[];
        schoolYear?: string;
        age?: number;
        evolution?: StudentEvolutionProfile;
        interventions?: MentoriaIntervention[];
        motivation?: MotivationState;
      },
      { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] }
    >(
      createAgentTask({
        kind: "progress-evaluator",
        channel: "mentoria_progress",
        objective: "Evaluar progreso actual",
        context: userContext,
        input: {
          progress: input.progress,
          subjects,
          schoolYear: input.student.schoolYear,
          age: input.student.age,
          evolution: input.evolution,
          interventions: input.interventions,
          motivation: input.motivation,
        },
        metadata: {
          product: "mentoria",
        },
      }),
    );
    return analysis.output;
  }

  private async ensureEvolutionProfile(tenantId: string, student: StudentProfile): Promise<StudentEvolutionProfile> {
    const existing = await this.repository.getStudentEvolutionProfile(tenantId, student.id);
    if (existing) {
      return existing;
    }

    const [progress, subjects] = await Promise.all([
      this.repository.listProgress(tenantId, student.id),
      this.repository.listSubjects(tenantId),
    ]);
    const initial = createInitialEvolutionProfile({
      student,
      progress,
      subjects,
    });
    return this.repository.saveStudentEvolutionProfile(tenantId, initial);
  }

  private async syncInterventions(
    tenantId: string,
    studentId: string,
    evolution: StudentEvolutionProfile,
  ): Promise<MentoriaIntervention[]> {
    const existing = await this.repository.listInterventions(tenantId, studentId);
    const decisions = detectInterventions(evolution);
    const materialized = materializeInterventions(tenantId, studentId, decisions, existing);
    return this.repository.saveInterventions(tenantId, materialized);
  }

  private async ensureMotivationState(
    tenantId: string,
    student: StudentProfile,
    evolution: StudentEvolutionProfile,
    interventions: MentoriaIntervention[],
  ): Promise<MotivationState> {
    const existing = await this.repository.getMotivationState(tenantId, student.id);
    if (existing) {
      return existing;
    }

    const initial = createInitialMotivationState(student.id, new Date().toISOString());
    initial.motivationProfile = detectMotivationProfile({
      consistencyScore: evolution.consistencyScore,
      frustrationLevel: evolution.frustrationLevel,
      progressionVelocity: evolution.progressionVelocity,
      interventions: detectInterventions(evolution),
    });
    return this.repository.saveMotivationState(tenantId, initial);
  }

  private async ensureReferralProfile(tenantId: string, student: StudentProfile): Promise<MentoriaReferralProfile> {
    const existing = await this.repository.getReferralProfile(tenantId, student.id);
    if (existing) {
      return existing;
    }
    return this.repository.saveReferralProfile(tenantId, {
      id: crypto.randomUUID(),
      tenantId,
      studentId: student.id,
      referralCode: generateReferralCode({ studentName: student.fullName, studentId: student.id }),
      totalInvites: 0,
      registeredInvites: 0,
      convertedInvites: 0,
      premiumAccessUntil: undefined,
      rewardPointsEarned: 0,
      featureUnlocks: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private async getGrowthSummary(
    actor: MentoriaSessionActor,
    student: StudentProfile,
    options?: {
      evolution?: StudentEvolutionProfile;
      interventions?: MentoriaIntervention[];
      motivation?: MotivationState;
      dailyPlan?: DailyPlan;
      progress?: MentoriaProgress[];
    },
  ): Promise<MentoriaGrowthSummary> {
    const referralProfile = await this.ensureReferralProfile(actor.tenantId, student);
    const [referrals, latestShare, progress, evolution, interventions, motivation, dailyPlan] = await Promise.all([
      this.repository.listReferralsByInviter(actor.tenantId, student.id),
      this.repository.getLatestProgressShare(actor.tenantId, student.id),
      options?.progress ? Promise.resolve(options.progress) : this.repository.listProgress(actor.tenantId, student.id),
      options?.evolution ? Promise.resolve(options.evolution) : this.ensureEvolutionProfile(actor.tenantId, student),
      options?.interventions ? Promise.resolve(options.interventions) : this.repository.listInterventions(actor.tenantId, student.id),
      options?.motivation
        ? Promise.resolve(options.motivation)
        : this.ensureMotivationState(
            actor.tenantId,
            student,
            options?.evolution ?? (await this.ensureEvolutionProfile(actor.tenantId, student)),
            options?.interventions ?? (await this.repository.listInterventions(actor.tenantId, student.id)),
          ),
      options?.dailyPlan
        ? Promise.resolve(options.dailyPlan)
        : this.ensureDailyPlan(
            actor.tenantId,
            student,
            {
              evolution: options?.evolution,
              interventions: options?.interventions,
              motivation: options?.motivation,
              progress: options?.progress,
            },
          ),
    ]);
    const entitlements = resolveGrowthEntitlements(referralProfile);
    const recommendations = buildGrowthRecommendations({
      student,
      evolution,
      motivation,
      interventions,
      dailyPlan,
      referralProfile,
    });
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/mentorias/auths/registrations?ref=${encodeURIComponent(referralProfile.referralCode)}`;
    return {
      referralProfile,
      referrals,
      latestShare,
      rewardEntitlements: entitlements,
      recommendedShareMessage: recommendations.shareMessage,
      recommendedInviteMessage: latestShare
        ? recommendations.inviteReason
        : buildReferralInviteMessage({
            student,
            referralCode: referralProfile.referralCode,
            inviteUrl,
          }),
    };
  }

  private async buildPlanForStudent(
    tenantId: string,
    student: StudentProfile,
    parents?: ParentAccount[],
  ): Promise<StudyPlan> {
    const progress = await this.repository.listProgress(tenantId, student.id);
    const selectedSubjects = await this.repository.listStudentSubjects(tenantId, student.id);
    const subjectIds = new Set(selectedSubjects.map((item) => item.subjectId));
    const subjects = (await this.repository.listSubjects(tenantId)).filter((subject) => subjectIds.has(subject.id));
    const evolution = await this.ensureEvolutionProfile(tenantId, student);
    const interventions = await this.syncInterventions(tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(tenantId, student, evolution, interventions);
    const dailyPlan = await this.ensureDailyPlan(tenantId, student, { subjects, progress, evolution, interventions, motivation });
    const billing = await this.getBillingSummary({ tenantId, canManageBilling: true }, student);
    const adaptiveContext = this.getAdaptiveContext(billing, interventions, motivation);
    const plan = buildStudyPlan({
      profile: student,
      subjects,
      progress,
      parents,
      evolution,
      interventions: adaptiveContext.interventions,
      motivation: adaptiveContext.motivation,
      dailyPlan,
      billing,
    });
    const weekStart = new Date();
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    return this.repository.saveStudyPlan({
      tenantId,
      studentProfileId: student.id,
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      goalsSummary: plan.goalsSummary,
      blocks: plan.blocks,
      generatedBy: "planner-agent",
    });
  }

  private async ensureDailyPlan(
    tenantId: string,
    student: StudentProfile,
    options?: {
      force?: boolean;
      subjects?: Awaited<ReturnType<MentoriaRepository["listSubjects"]>>;
      progress?: MentoriaProgress[];
      evolution?: StudentEvolutionProfile;
      interventions?: MentoriaIntervention[];
      motivation?: MotivationState;
    },
  ): Promise<DailyPlan> {
    const planDate = new Date().toISOString().slice(0, 10);
    const existing = await this.repository.getDailyPlan(tenantId, student.id, planDate);
    if (existing && !options?.force) {
      return existing;
    }

    const selectedSubjects = await this.repository.listStudentSubjects(tenantId, student.id);
    const allSubjects = options?.subjects ?? (await this.repository.listSubjects(tenantId));
    const subjectIds = new Set(selectedSubjects.map((item) => item.subjectId));
    const subjects = allSubjects.filter((subject) => subjectIds.has(subject.id));
    const progress = options?.progress ?? (await this.repository.listProgress(tenantId, student.id));
    const evolution = options?.evolution ?? (await this.ensureEvolutionProfile(tenantId, student));
    const interventions = options?.interventions ?? (await this.syncInterventions(tenantId, student.id, evolution));
    const motivation = options?.motivation ?? (await this.ensureMotivationState(tenantId, student, evolution, interventions));

    return this.repository.saveDailyPlan(
      tenantId,
      generateDailyPlan({
        profile: student,
        subjects,
        progress,
        evolution,
        motivation,
        interventions,
        existingPlan: existing,
      }),
    );
  }

  private async completeDailyPlan(
    tenantId: string,
    student: StudentProfile,
    input: { subjectId?: string; preferredTypes?: Array<"practice" | "review" | "challenge"> },
    options?: {
      forceRegeneration?: boolean;
      subjects?: Awaited<ReturnType<MentoriaRepository["listSubjects"]>>;
      progress?: MentoriaProgress[];
      evolution?: StudentEvolutionProfile;
      interventions?: MentoriaIntervention[];
      motivation?: MotivationState;
    },
  ): Promise<DailyPlan> {
    const plan = await this.ensureDailyPlan(tenantId, student, {
      force: options?.forceRegeneration,
      subjects: options?.subjects,
      progress: options?.progress,
      evolution: options?.evolution,
      interventions: options?.interventions,
      motivation: options?.motivation,
    });
    return this.repository.saveDailyPlan(tenantId, completeDailyPlanTask(plan, input));
  }

  private async getBillingSummary(
    context: { tenantId: string; canManageBilling: boolean },
    student: StudentProfile,
  ): Promise<MentoriaBillingSummary> {
    const isoDay = new Date().toISOString().slice(0, 10);
    const [subscription, guidedSessionsToday, exercisesToday, plannerRegenerationsToday, referralProfile] = await Promise.all([
      getCanonicalSubscriptionState({ tenantId: context.tenantId, saasSlug: "mentoria" }),
      this.repository.countLearningSessionsForDay(context.tenantId, student.id, isoDay),
      this.repository.countExercisesForDay(context.tenantId, student.id, isoDay),
      this.repository.countPlannerRegenerationsForDay(context.tenantId, student.id, isoDay),
      this.repository.getReferralProfile(context.tenantId, student.id),
    ]);

    const billing = buildMentoriaBillingSummary({
      subscription,
      usage: {
        guidedSessionsToday,
        exercisesToday,
        plannerRegenerationsToday,
      },
      canManageBilling: context.canManageBilling,
    });
    return applyMentoriaGrowthEntitlements(billing, resolveGrowthEntitlements(referralProfile));
  }

  private getAdaptiveContext(
    billing: MentoriaBillingSummary,
    interventions: MentoriaIntervention[],
    motivation: MotivationState,
  ): { interventions: MentoriaIntervention[]; motivation: MotivationState } {
    return {
      interventions: billing.features.adaptiveInterventions ? interventions : [],
      motivation: billing.features.adaptiveMotivation
        ? motivation
        : {
            ...motivation,
            rewardPoints: 0,
            achievements: [],
            level: 1,
            motivationProfile: "stable",
          },
    };
  }

  private async applyReferralAttribution(
    actor: MentoriaSessionActor,
    student: StudentProfile,
    motivation: MotivationState,
    input: { referralCode: string; inviteToken?: string },
  ): Promise<MotivationState> {
    const normalizedCode = input.referralCode.trim();
    if (!normalizedCode) {
      return motivation;
    }

    const inviterProfile = await this.repository.getReferralProfileByCode(actor.tenantId, normalizedCode);
    if (!inviterProfile || inviterProfile.studentId === student.id) {
      return motivation;
    }

    const existingForInvitee = await this.repository.getReferralByInvitee(actor.tenantId, student.id);
    if (existingForInvitee?.status === "rewarded") {
      return motivation;
    }

    const rewardPackage = buildReferralRewardPackage();
    const now = new Date().toISOString();
    const matchedInvite = input.inviteToken ? await this.repository.getReferralByInviteToken(actor.tenantId, input.inviteToken) : null;
    const baseReferral: MentoriaReferral =
      matchedInvite && matchedInvite.inviterStudentId === inviterProfile.studentId
        ? {
            ...matchedInvite,
            inviteeStudentId: student.id,
            status: "rewarded",
            convertedAt: now,
            rewardedAt: now,
            updatedAt: now,
          }
        : {
            id: crypto.randomUUID(),
            tenantId: actor.tenantId,
            inviterStudentId: inviterProfile.studentId,
            inviteeStudentId: student.id,
            invitedEmail: actor.email,
            referralCode: inviterProfile.referralCode,
            inviteToken: input.inviteToken,
            status: "rewarded",
            rewardPremiumDays: rewardPackage.premiumDays,
            rewardPoints: rewardPackage.rewardPoints,
            rewardFeatures: rewardPackage.featureUnlocks,
            source: matchedInvite ? matchedInvite.source : "organic_code",
            createdAt: now,
            registeredAt: now,
            convertedAt: now,
            rewardedAt: now,
            updatedAt: now,
          };

    const savedReferral = await this.repository.saveReferral(actor.tenantId, {
      ...baseReferral,
      rewardPremiumDays: rewardPackage.premiumDays,
      rewardPoints: rewardPackage.rewardPoints,
      rewardFeatures: rewardPackage.featureUnlocks,
    });

    const updatedInviterProfile = applyReferralReward({
      profile: inviterProfile,
      referral: savedReferral,
      now,
    });
    await this.repository.saveReferralProfile(actor.tenantId, updatedInviterProfile);

    return this.repository.saveMotivationState(actor.tenantId, {
      ...motivation,
      rewardPoints: motivation.rewardPoints + 18,
      level: Math.max(motivation.level, 1 + Math.floor((motivation.rewardPoints + 18) / 120)),
      achievements: Array.from(new Set([...motivation.achievements, "Arranque por recomendacion"])).slice(0, 12),
    });
  }

  async getProfile(actor: MentoriaSessionActor): Promise<StudentProfile | null> {
    await this.repository.seedSubjects(actor.tenantId);
    return this.repository.getStudentProfileByUser(actor.tenantId, actor.userId);
  }

  async createReferralInvite(actor: MentoriaSessionActor, input: { invitedEmail?: string }) {
    const student = await this.requireOnboardedStudent(actor);
    const referralProfile = await this.ensureReferralProfile(actor.tenantId, student);
    const rewardPackage = buildReferralRewardPackage();
    const inviteToken = generateInviteToken();
    const now = new Date().toISOString();
    const referral = await this.repository.saveReferral(actor.tenantId, {
      id: crypto.randomUUID(),
      tenantId: actor.tenantId,
      inviterStudentId: student.id,
      inviteeStudentId: undefined,
      invitedEmail: input.invitedEmail?.trim() || undefined,
      referralCode: referralProfile.referralCode,
      inviteToken,
      status: "pending",
      rewardPremiumDays: rewardPackage.premiumDays,
      rewardPoints: rewardPackage.rewardPoints,
      rewardFeatures: rewardPackage.featureUnlocks,
      source: "direct_invite",
      createdAt: now,
      registeredAt: undefined,
      convertedAt: undefined,
      rewardedAt: undefined,
      updatedAt: now,
    });
    const savedProfile = await this.repository.saveReferralProfile(actor.tenantId, {
      ...referralProfile,
      totalInvites: referralProfile.totalInvites + 1,
      updatedAt: now,
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const inviteUrl = `${baseUrl}/mentorias/auths/registrations?ref=${encodeURIComponent(savedProfile.referralCode)}&invite=${inviteToken}`;
    return {
      referral,
      referralProfile: savedProfile,
      inviteUrl,
      message: buildReferralInviteMessage({
        student,
        referralCode: savedProfile.referralCode,
        inviteUrl,
      }),
    };
  }

  async createProgressShare(actor: MentoriaSessionActor) {
    const dashboard = await this.getDashboard(actor);
    const payload = buildProgressSharePayload({
      student: dashboard.student,
      progress: dashboard.progress,
      dailyPlan: dashboard.dailyPlan,
      motivation: dashboard.motivation,
      interventions: dashboard.interventions,
    });
    const shareCode = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();
    const share = await this.repository.createProgressShare(actor.tenantId, {
      id: crypto.randomUUID(),
      tenantId: actor.tenantId,
      studentId: dashboard.student.id,
      createdByUserId: actor.userId,
      shareCode,
      shareKind: "progress",
      title: `Resumen de progreso de ${dashboard.student.fullName}`,
      payload,
      createdAt: now,
      updatedAt: now,
    });
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/mentoria/share/${share.shareCode}`;
    return {
      share,
      shareUrl,
      message: buildProgressShareMessage({
        student: dashboard.student,
        shareUrl,
        payload,
      }),
    };
  }

  async getOnboardingState(actor: MentoriaSessionActor) {
    await this.repository.seedSubjects(actor.tenantId);
    const profile = await this.repository.getStudentProfileByUser(actor.tenantId, actor.userId);
    const subjects = await this.repository.listSubjects(actor.tenantId);
    if (!profile) {
      return { profile: null, subjects, studentSubjects: [], parents: [] };
    }
    const [studentSubjects, parents] = await Promise.all([
      this.repository.listStudentSubjects(actor.tenantId, profile.id),
      this.repository.listParentAccounts(actor.tenantId, profile.id),
    ]);
    return { profile, subjects, studentSubjects, parents };
  }

  private async requireOnboardedStudent(actor: MentoriaSessionActor): Promise<StudentProfile> {
    const student = await this.getProfile(actor);
    if (!student || !student.onboardingCompleted) {
      throw new Error("ONBOARDING_REQUIRED");
    }
    return student;
  }

  async submitOnboarding(actor: MentoriaSessionActor, payload: OnboardingPayload): Promise<{
    student: StudentProfile;
    parents: ParentAccount[];
    plan: StudyPlan;
    progress: MentoriaProgress[];
    activation: ActivationEvent & {
      subjectSlug: string;
      subjectName: string;
      reply: string;
      dailyPlan: DailyPlan;
    };
  }> {
    await this.repository.seedSubjects(actor.tenantId);

    if (!payload.fullName.trim()) throw new Error("INVALID_STUDENT_NAME");
    if (payload.age < 5 || payload.age > 18) throw new Error("INVALID_AGE");
    if (!payload.schoolYear.trim()) throw new Error("INVALID_SCHOOL_YEAR");
    if (payload.subjects.length === 0) throw new Error("SUBJECTS_REQUIRED");

    const allSubjects = await this.repository.listSubjects(actor.tenantId);
    const subjectsBySlug = new Map(allSubjects.map((subject) => [subject.slug, subject]));
    const selectedSubjects = payload.subjects.map((item) => {
      const subject = subjectsBySlug.get(item.subjectSlug);
      if (!subject) throw new Error(`SUBJECT_NOT_FOUND:${item.subjectSlug}`);
      return { selection: item, subject };
    });

    const confidenceLevel = payload.confidenceLevel ?? "medium";
    const emotionalBaseline = payload.emotionalBaseline ?? deriveEmotionalBaselineFromConfidence(confidenceLevel);
    const learningPreference = payload.learningPreference ?? deriveLearningPreferenceFromObjective(payload.objective, payload.schoolYear);
    const preferredStudyMinutes =
      payload.parents && payload.parents.length > 0
        ? averageDailyMinutes(payload.parents)
        : derivePreferredStudyMinutesFromConfidence(payload.schoolYear, confidenceLevel);
    const baseEmotionalState = deriveBaseEmotionalState(emotionalBaseline);
    const learningGoals = deriveLearningGoalsFromObjective(selectedSubjects.map((item) => ({ name: item.subject.name })), payload.objective);
    const strengths = deriveStrengths(
      payload.subjects.map((item) => ({ ...item, subjectSlug: item.subjectSlug })),
      selectedSubjects.map((item) => ({ id: item.subject.slug, name: item.subject.name })),
    );
    const onboardingInput = toOnboardingInput(payload, learningGoals, confidenceLevel);
    const onboardingContext = buildOnboardingUserContext({
      actor,
      onboarding: onboardingInput,
      tags: ["mentoria", "onboarding"],
      traits: {
        schoolYear: payload.schoolYear,
        objective: payload.objective ?? "improve_understanding",
      },
      preferences: {
        learningPreference: learningPreference,
        confidenceLevel,
      },
    });

    const student = await this.repository.upsertStudentProfile({
      tenantId: actor.tenantId,
      userId: actor.userId,
      fullName: payload.fullName.trim(),
      age: payload.age,
      schoolYear: payload.schoolYear,
      learningGoals,
      baseEmotionalState,
      emotionalBaseline,
      learningPreference,
      preferredStudyMinutes,
      strengths,
      onboardingCompleted: true,
      supportNotes: `Objetivo inicial ${payload.objective ?? "improve_understanding"} | confianza ${confidenceLevel}`,
    });

    await this.familyRepository.upsertStudent({
      id: student.id,
      familyId: actor.tenantId,
      name: student.fullName,
      age: student.age,
      level: student.schoolYear,
    });

    await this.repository.replaceStudentSubjects({
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjects: selectedSubjects.map((item) => ({
        subjectId: item.subject.id,
        initialLevel: item.selection.initialLevel,
      })),
    });

    const onboardingParents = payload.parents ?? [];
    await this.repository.deleteParentAccountsForStudent(actor.tenantId, student.id);
    const parents: ParentAccount[] = [];
    for (const parent of onboardingParents) {
      if (!parent.fullName.trim() || !parent.email.trim()) continue;
      await this.familyRepository.upsertGuardian({
        email: parent.email.trim(),
        familyId: actor.tenantId,
        name: parent.fullName.trim(),
        role: "tutor",
      });
      parents.push(
        await this.repository.upsertParentAccount({
          tenantId: actor.tenantId,
          userId: `${student.id}:${parent.slot.toLowerCase().replace(/\s+/g, "-")}`,
          studentProfileId: student.id,
          fullName: parent.fullName.trim(),
          email: parent.email.trim(),
          relation: parent.slot,
          dailyStudyMinutes: parent.dailyStudyMinutes,
          supervisionLevel: parent.supervisionLevel,
          canViewFullProgress: true,
          canManageSchedule: parent.supervisionLevel !== "light",
          notificationPreferences: ["progress", "planner"],
        }),
      );
    }

    await this.repository.deleteProgressForStudent(actor.tenantId, student.id);
    for (const item of selectedSubjects) {
      const initialProgress = buildInitialProgressFromOnboarding({
        subjectId: item.subject.id,
        initialLevel: item.selection.initialLevel,
        schoolYear: student.schoolYear,
        age: student.age,
      });
      await this.repository.upsertProgress({
        tenantId: actor.tenantId,
        studentProfileId: student.id,
        subjectId: item.subject.id,
        masteryScore: initialProgress.masteryScore,
        confidenceScore: initialProgress.confidenceScore,
        streakDays: initialProgress.streakDays,
        sessionsCompleted: initialProgress.sessionsCompleted,
        exercisesCompleted: initialProgress.exercisesCompleted,
        weakTopics: initialProgress.weakTopics,
        strongTopics: initialProgress.strongTopics,
      });
    }

    const progress = await this.repository.listProgress(actor.tenantId, student.id);
    await this.repository.saveStudentEvolutionProfile(
      actor.tenantId,
      createInitialEvolutionProfile({
        student,
        progress,
        subjects: allSubjects,
      }),
    );
    const syncedEvolution = await this.ensureEvolutionProfile(actor.tenantId, student);
    const syncedInterventions = await this.syncInterventions(actor.tenantId, student.id, syncedEvolution);
    await this.repository.saveMotivationState(
      actor.tenantId,
      createInitialMotivationState(student.id, new Date().toISOString()),
    );
    let syncedMotivation = await this.ensureMotivationState(actor.tenantId, student, syncedEvolution, syncedInterventions);
    if (payload.referralCode) {
      syncedMotivation = await this.applyReferralAttribution(actor, student, syncedMotivation, {
        referralCode: payload.referralCode,
        inviteToken: payload.inviteToken,
      });
    }
    const plan = await this.buildPlanForStudent(actor.tenantId, student, parents);
    const dailyPlan = await this.ensureDailyPlan(actor.tenantId, student, {
      force: true,
      progress,
      evolution: syncedEvolution,
      interventions: syncedInterventions,
      motivation: syncedMotivation,
    });
    const persistedOnboardingContext = await this.syncUserContext(actor, student, {
      progress,
      evolution: syncedEvolution,
      motivation: syncedMotivation,
      dailyPlan,
    });
    const weakestSubjectSelection =
      selectedSubjects.find((item) => item.selection.initialLevel === "me_cuesta_mucho") ?? selectedSubjects[0];
    const activationPrompt = buildActivationPrompt({
      student,
      objective: payload.objective ?? "improve_understanding",
      confidenceLevel,
      weakestSubjectName: weakestSubjectSelection.subject.name,
    });
    const activationTask = createAgentTask({
      kind: "user_activation",
      channel: "mentoria_onboarding",
      objective: `Arrancar la primera accion guiada para ${weakestSubjectSelection.subject.name}`,
      context: persistedOnboardingContext,
      input: {
        subjectSlug: weakestSubjectSelection.subject.slug,
        topic: activationPrompt.topic,
        message: activationPrompt.message,
      },
      metadata: {
        product: "mentoria",
        objective: payload.objective ?? "improve_understanding",
        confidenceLevel,
      },
    });
    const firstSession = await this.startGuidedSession(actor, {
      subjectSlug: weakestSubjectSelection.subject.slug,
      topic: activationPrompt.topic,
      message: activationPrompt.message,
    });
    const refreshedProgress = await this.getProgress(actor);
    const refreshedDailyPlan = (await this.getDashboard(actor)).dailyPlan;
    const activationResponse = createAgentResponse({
      task: activationTask,
      reply: firstSession.reply,
      output: {
        subjectSlug: weakestSubjectSelection.subject.slug,
        subjectName: weakestSubjectSelection.subject.name,
        recommendedNextStep: firstSession.session.recommendedNextStep,
      },
      recommendations: refreshedProgress.analysis.nextActions,
      metadata: {
        emotionalState: firstSession.adaptation.emotionalState,
        product: "mentoria",
      },
    });
    const activationInsights = [
      createInsight({
        category: "activation",
        title: "Primer valor entregado",
        summary: `Se ha activado una primera ayuda en ${weakestSubjectSelection.subject.name}.`,
        actions: refreshedProgress.analysis.nextActions,
        metadata: {
          subjectSlug: weakestSubjectSelection.subject.slug,
          planDate: refreshedDailyPlan.planDate,
        },
      }),
      createInsight({
        category: "planner",
        title: "Plan diario inicial",
        summary: refreshedDailyPlan.adaptationReason,
        severity: refreshedDailyPlan.priority === "high" ? "warning" : "info",
        actions: refreshedDailyPlan.tasks.slice(0, 3).map((task) => `${task.subject}: ${task.type}`),
        metadata: {
          completionRate: refreshedDailyPlan.completionRate,
          recommendedDuration: refreshedDailyPlan.recommendedDuration,
        },
      }),
    ];
    const activation = createActivationEvent({
      context: persistedOnboardingContext,
      type: "onboarding_completed",
      channel: "onboarding",
      task: activationTask,
      response: activationResponse,
      insights: activationInsights,
      nextActions: refreshedProgress.analysis.nextActions,
      metadata: {
        subjectSlug: weakestSubjectSelection.subject.slug,
        subjectName: weakestSubjectSelection.subject.name,
      },
    });
    await trackEvent(activation);

    return {
      student,
      parents,
      plan,
      progress,
      activation: {
        ...activation,
        subjectSlug: weakestSubjectSelection.subject.slug,
        subjectName: weakestSubjectSelection.subject.name,
        reply: activationResponse.reply,
        dailyPlan: refreshedDailyPlan,
      },
    };
  }

  async getDashboard(actor: MentoriaSessionActor): Promise<MentoriaDashboard & { evolution: StudentEvolutionProfile; interventions: MentoriaIntervention[]; motivation: MotivationState; dailyPlan: DailyPlan; billing: MentoriaBillingSummary; growth: MentoriaGrowthSummary; insights: Insight[] }> {
    const student = await this.requireOnboardedStudent(actor);
    const evolution = await this.ensureEvolutionProfile(actor.tenantId, student);
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, student, evolution, interventions);
    const dailyPlan = await this.ensureDailyPlan(actor.tenantId, student, { evolution, interventions, motivation });
    const billing = await this.getBillingSummary({ tenantId: actor.tenantId, canManageBilling: this.canManageBilling(actor) }, student);
    const dashboard = await this.repository.getDashboard(actor.tenantId, student.id);
    const growth = await this.getGrowthSummary(actor, student, {
      evolution,
      interventions,
      motivation,
      dailyPlan,
      progress: dashboard?.progress,
    });
    const userContext = await this.syncUserContext(actor, student, {
      progress: dashboard?.progress,
      evolution,
      motivation,
      dailyPlan,
    });
    const insights = await this.buildUserInsights(actor, userContext);
    return { ...(dashboard as MentoriaDashboard), evolution, interventions, motivation, dailyPlan, billing, growth, insights };
  }

  async getWorkspaceExperience(actor: MentoriaSessionActor): Promise<
    MentoriaDashboard & {
      evolution: StudentEvolutionProfile;
      interventions: MentoriaIntervention[];
      motivation: MotivationState;
      dailyPlan: DailyPlan;
      billing: MentoriaBillingSummary;
      growth: MentoriaGrowthSummary;
      insights: Insight[];
      analysis: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] };
      entry: MentoriaWorkspaceEntry;
      memory: MentoriaStudentMemorySummary;
      guardianHooks: MentoriaGuardianHookEvent[];
      exercises: MentoriaExercise[];
    }
  > {
    const dashboard = await this.getDashboard(actor);
    const analysis = await this.buildProgressAnalysis({
      actor,
      student: dashboard.student,
      progress: dashboard.progress,
      studentSubjects: dashboard.studentSubjects,
      evolution: dashboard.evolution,
      interventions: dashboard.interventions,
      motivation: dashboard.motivation,
      dailyPlan: dashboard.dailyPlan,
    });
    const memory = buildStudentMemorySummary({
      evolution: dashboard.evolution,
      progress: dashboard.progress,
      dailyPlan: dashboard.dailyPlan,
    });
    const entry = buildWorkspaceEntry({
      student: dashboard.student,
      subjects: dashboard.subjects.filter((subject) => dashboard.studentSubjects.some((item) => item.subjectId === subject.id)),
      progress: dashboard.progress,
      dailyPlan: dashboard.dailyPlan,
      memory,
      analysis,
    });
    const events = await listEventsForUser(actor.userId, 50);
    const guardianHooks = buildGuardianHookEvents({
      student: dashboard.student,
      progress: dashboard.progress,
      recentSessions: dashboard.recentSessions,
      focusSessions: dashboard.focusSessions,
      interventions: dashboard.interventions,
      events,
    });
    const exercises = await this.repository.listExercises(actor.tenantId, dashboard.student.id);

    return {
      ...dashboard,
      analysis,
      entry,
      memory,
      guardianHooks,
      exercises,
    };
  }

  async saveParents(
    actor: MentoriaSessionActor,
    parents: Array<{
      slot: "Parent A" | "Parent B";
      fullName: string;
      email: string;
      dailyStudyMinutes: number;
      supervisionLevel: MentoriaSupervisionLevel;
      canViewFullProgress: boolean;
      canManageSchedule: boolean;
    }>,
  ) {
    const student = await this.requireOnboardedStudent(actor);
    const saved = [];
    for (const parent of parents) {
      if (!parent.fullName || !parent.email) continue;
      saved.push(
        await this.repository.upsertParentAccount({
          tenantId: actor.tenantId,
          userId: `${student.id}:${parent.slot.toLowerCase().replace(/\s+/g, "-")}`,
          studentProfileId: student.id,
          fullName: parent.fullName,
          email: parent.email,
          relation: parent.slot,
          dailyStudyMinutes: parent.dailyStudyMinutes,
          supervisionLevel: parent.supervisionLevel,
          canViewFullProgress: parent.canViewFullProgress,
          canManageSchedule: parent.canManageSchedule,
          notificationPreferences: ["progress", "planner"],
        }),
      );
    }
    return saved;
  }

  async startGuidedSession(actor: MentoriaSessionActor, payload: {
    subjectSlug?: string;
    topic?: string;
    message: string;
    sessionId?: string;
  }): Promise<{
    session: Awaited<ReturnType<MentoriaRepository["createLearningSession"]>>;
    subject: MentoriaSubject;
    adaptation: ReturnType<typeof evaluateStudentEmotion>;
    reply: string;
    explanation: string;
    suggestedSteps: string[];
    reinforcementQuestion: string;
    insights: Insight[];
    isRecovered?: boolean;
    sessionFeedback?: {
      progressMessage: string;
      scoreChange: number;
      masteryLevel: string;
      confidenceLevel: string;
      nextSteps: string[];
      encouragement: string;
      completionMessage: string;
    };
  }> {
    const student = await this.requireOnboardedStudent(actor);
    
    // TRIAL AUTO-START: Begin 7-day free trial on first session
    const existingTrial = await this.trialManager.getTrial(actor.tenantId, student.id);
    if (!existingTrial) {
      await this.trialManager.startTrial(actor.tenantId, student.id);
    }
    
    // SESSION RECOVERY: Check for active session to resume
    let recoveredSession = null;
    if (payload.sessionId) {
      recoveredSession = await this.persistence.getSessionSnapshot(actor.tenantId, payload.sessionId);
    } else {
      recoveredSession = await this.persistence.getActiveSession(actor.tenantId, student.id);
    }
    
    if (recoveredSession && recoveredSession.status === "active") {
      await this.persistence.resumeSession(actor.tenantId, recoveredSession.sessionId);
    }
    
    const billing = await this.getBillingSummary({ tenantId: actor.tenantId, canManageBilling: this.canManageBilling(actor) }, student);
    const isTrialActive = await this.trialManager.isTrialActive(actor.tenantId, student.id);
    const daysRemaining = await this.trialManager.getTrialDaysRemaining(actor.tenantId, student.id);
    
    // ACCESS CONTROL: Check if user can start session (trial or paid plan)
    try {
      checkAccessControl({
        isTrialActive,
        planCode: billing.planCode,
        limitKey: "guidedSessionsPerDay",
        currentLimit: billing.limits.guidedSessionsPerDay,
        usedToday: billing.usage.guidedSessionsToday,
        daysRemaining,
        upgradeUrl: `${actor.tenantId}/upgrade`,
      });
    } catch (error) {
      if (error instanceof UpgradeFlowError) {
        throw error;
      }
      throw error;
    }
    
    // PRE-FLIGHT BILLING VALIDATION: Check remaining sessions before starting
    assertMentoriaLimit(
      billing,
      "guidedSessionsPerDay",
      "Has llegado al limite diario de sesiones guiadas de tu plan actual.",
      "MENTORIA_GUIDED_SESSIONS_LIMIT_REACHED",
    );
    const [evolution, progress, recentSessions, studentSubjects, subjects] = await Promise.all([
      this.ensureEvolutionProfile(actor.tenantId, student),
      this.repository.listProgress(actor.tenantId, student.id),
      this.repository.listLearningSessions(actor.tenantId, student.id),
      this.repository.listStudentSubjects(actor.tenantId, student.id),
      this.repository.listSubjects(actor.tenantId),
    ]);
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, student, evolution, interventions);
    const dailyPlan = await this.ensureDailyPlan(actor.tenantId, student, { evolution, interventions, motivation, progress });
    const enabledSubjectIds = new Set(studentSubjects.map((item) => item.subjectId));
    const availableSubjects = subjects.filter((subject) => enabledSubjectIds.has(subject.id));
    const subjectSelection = inferSubjectAndTopic({
      requestedSubjectSlug: payload.subjectSlug,
      topic: payload.topic,
      message: payload.message,
      subjects: availableSubjects,
      dailyPlan,
      evolution,
    });
    const subject = subjectSelection.subject;
    const resolvedTopic = subjectSelection.topic;
    const current = progress.find((item) => item.subjectId === subject.id);
    const actorContext = await this.syncUserContext(actor, student, {
      progress,
      evolution,
      motivation,
      dailyPlan,
      lastSubject: subject,
    });
    const tutorTask = createAgentTask({
      kind: "tutor",
      channel: "mentoria_tutor",
      objective: resolvedTopic,
      context: actorContext,
      input: {
        profile: student,
        subject,
        topic: resolvedTopic,
        studentMessage: payload.message,
        adaptation: {
          tone: "calm",
          explanationDepth: "guided",
          difficultyAdjustment: "steady",
          tutorInstruction: "",
        },
        evolution,
        interventions: [],
        motivation,
        dailyPlan,
        billing,
      },
      metadata: {
        product: "mentoria",
        subjectId: subject.id,
      },
    });
    const sessionMetric = createMetricEvent({
      context: actorContext,
      name: "guided_session_requested",
      type: "guided_session_requested",
      source: "mentoria.service.startGuidedSession",
      metadata: {
        subjectSlug: subject.slug,
        subjectInferenceReason: subjectSelection.reason,
      },
    });

    const adaptiveContext = this.getAdaptiveContext(billing, interventions, motivation);
    const adaptation = evaluateStudentEmotion({
      message: payload.message,
      profile: student,
      evolution,
      subjectName: subject.name,
      interventions: adaptiveContext.interventions,
      motivation: adaptiveContext.motivation,
    });
    const history: MentoriaAgentHistoryTurn[] = recentSessions
      .filter((item) => item.subjectId === subject.id)
      .slice(0, 3)
      .flatMap((item) => item.transcript)
      .slice(-6);

    const tutorResponse = await executeAgent<{
      profile: StudentProfile;
      subject: MentoriaSubject;
      topic: string;
      studentMessage: string;
      adaptation: typeof adaptation;
      evolution: StudentEvolutionProfile;
      interventions: MentoriaIntervention[];
      motivation: MotivationState;
      dailyPlan: DailyPlan;
      billing: MentoriaBillingSummary;
      history?: MentoriaAgentHistoryTurn[];
    }, {
      tutorSummary: string;
      recommendedNextStep: string;
      explanation: string;
      suggestedSteps: string[];
      reinforcementQuestion: string;
    }>(
      {
        ...tutorTask,
        input: {
          ...tutorTask.input,
          adaptation,
          interventions: adaptiveContext.interventions,
          motivation: adaptiveContext.motivation,
          history,
        },
      },
    );
    await trackEvent(sessionMetric);

    const session = await this.repository.createLearningSession({
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjectId: subject.id,
      topic: resolvedTopic,
      transcript: [
        { role: "student", content: payload.message, createdAt: new Date().toISOString() },
        { role: "tutor", content: tutorResponse.reply, createdAt: new Date().toISOString() },
      ],
      emotionalState: adaptation.emotionalState,
      tutorSummary: String(tutorResponse.output.tutorSummary),
      recommendedNextStep: String(tutorResponse.output.recommendedNextStep),
      aiTokensUsed: tutorResponse.usage?.tokens ?? 0,
    });

    await this.persistence.saveSessionSnapshot({
      sessionId: session.id,
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjectId: subject.id,
      topic: resolvedTopic,
      status: "active",
      transcript: session.transcript,
      emotionalState: adaptation.emotionalState,
      lastActivityAt: new Date().toISOString(),
      aiTokensUsed: tutorResponse.usage?.tokens ?? 0,
      durationMinutes: session.durationMinutes,
    });

    await this.repository.upsertProgress({
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjectId: subject.id,
      masteryScore: Math.min(
        100,
        (current?.masteryScore ?? 50) +
          (evolution.progressionVelocity >= 0.72 ? 4 : evolution.frustrationLevel >= 0.7 ? 2 : 3),
      ),
      confidenceScore: Math.min(
        100,
        (current?.confidenceScore ?? 50) +
          (adaptation.emotionalState === "frustrated" || adaptation.emotionalState === "blocked" ? 1 : evolution.consistencyScore >= 0.6 ? 4 : 3),
      ),
      streakDays: Math.max(1, current?.streakDays ?? 0) + 1,
      sessionsCompleted: (current?.sessionsCompleted ?? 0) + 1,
      exercisesCompleted: current?.exercisesCompleted ?? 0,
      weakTopics: current?.weakTopics ?? [],
      strongTopics: current?.strongTopics ?? [],
      lastActivityAt: new Date().toISOString(),
    });

    await this.repository.saveStudentEvolutionProfile(
      actor.tenantId,
      updateEvolutionFromSession(evolution, {
        session,
        subject,
        studentMessage: payload.message,
        tutorReply: tutorResponse.reply,
        progress: current,
      }),
    );
    const syncedEvolution = await this.ensureEvolutionProfile(actor.tenantId, student);
    const syncedInterventions = await this.syncInterventions(actor.tenantId, student.id, syncedEvolution);
    const savedMotivation = await this.repository.saveMotivationState(
      actor.tenantId,
      updateMotivationFromSession(motivation, {
        studentId: student.id,
        happenedAt: session.createdAt,
        durationMinutes: session.durationMinutes,
        scoreSignal: Math.min(1, ((current?.masteryScore ?? 50) + 10) / 100),
        completed: true,
        source: "session",
        evolution: syncedEvolution,
        interventions: detectInterventions(syncedEvolution),
      }),
    );
    const updatedProgress = await this.repository.listProgress(actor.tenantId, student.id);
    await this.completeDailyPlan(
      actor.tenantId,
      student,
      { subjectId: subject.id, preferredTypes: ["review", "practice"] },
      {
        forceRegeneration: true,
        progress: updatedProgress,
        evolution: syncedEvolution,
        interventions: syncedInterventions,
        motivation: savedMotivation,
      },
    );
    const syncedContext = await this.syncUserContext(actor, student, {
      progress: updatedProgress,
      evolution: syncedEvolution,
      motivation: savedMotivation,
      dailyPlan: await this.ensureDailyPlan(actor.tenantId, student, {
        progress: updatedProgress,
        evolution: syncedEvolution,
        interventions: syncedInterventions,
        motivation: savedMotivation,
      }),
      lastSubject: subject,
    });
    const trackedSessions = await this.repository.listLearningSessions(actor.tenantId, student.id);
    if (trackedSessions.length === 1) {
      await trackEvent(
        createMetricEvent({
          context: syncedContext,
          type: "first_session",
          name: "first_session",
          source: "mentoria.service.startGuidedSession",
          metadata: {
            subject: subject.name,
            sessionId: session.id,
          },
        }),
      );
    }
    if (savedMotivation.streak === 2) {
      await trackEvent(
        createMetricEvent({
          context: syncedContext,
          type: "repeat_day_2",
          name: "repeat_day_2",
          source: "mentoria.service.startGuidedSession",
          metadata: {
            sessionId: session.id,
          },
        }),
      );
    }
    const insights = await this.buildUserInsights(actor, syncedContext);
    await trackEvent(
      createMetricEvent({
        context: syncedContext,
        name: "mentoria_activity_session",
        type: "mentoria_activity_session",
        source: "mentoria.service.startGuidedSession",
        metadata: {
          sessionId: session.id,
          subject: subject.name,
          topic: resolvedTopic,
          recommendation: tutorResponse.output.recommendedNextStep,
        },
      }),
    );
    const updatedSubjectProgress = updatedProgress.find((item) => item.subjectId === subject.id);
    await trackEvent(
      createMetricEvent({
        context: syncedContext,
        name: "mentoria_progress_update",
        type: "mentoria_progress_update",
        source: "mentoria.service.startGuidedSession",
        metadata: {
          sessionId: session.id,
          subject: subject.name,
          masteryScore: updatedSubjectProgress?.masteryScore ?? null,
          confidenceScore: updatedSubjectProgress?.confidenceScore ?? null,
        },
      }),
    );
    const activeAlert = syncedInterventions.find((item) => item.status === "active" && (item.severity === "high" || item.severity === "critical"));
    if (activeAlert) {
      await trackEvent(
        createMetricEvent({
          context: syncedContext,
          name: "mentoria_guardian_alert",
          type: "mentoria_guardian_alert",
          source: "mentoria.service.startGuidedSession",
          metadata: {
            interventionId: activeAlert.id,
            severity: activeAlert.severity,
            summary: activeAlert.summary,
          },
        }),
      );
    }
    // MARK SESSION AS COMPLETED
    await this.persistence.completeSession(actor.tenantId, session.id);

    // GENERATE SESSION SUMMARY FOR PARENT VALUE DELIVERY
    const sessionSummary = generateSessionSummary({
      sessionId: session.id,
      student,
      subject,
      topic: resolvedTopic,
      durationMinutes: session.durationMinutes,
      progress: current || { masteryScore: 50, confidenceScore: 50 } as MentoriaProgress,
      evolution: syncedEvolution,
      motivation: savedMotivation,
      emotionalState: adaptation.emotionalState,
      aiTokensUsed: tutorResponse.usage?.tokens ?? 0,
    });

    // GENERATE SESSION FEEDBACK FOR STUDENT (NO EMPTY EXPERIENCE)
    const sessionFeedback = generateSessionFeedback({
      previousMastery: current?.masteryScore ?? 50,
      currentMastery: updatedSubjectProgress?.masteryScore ?? (current?.masteryScore ?? 50),
      previousConfidence: current?.confidenceScore ?? 50,
      currentConfidence: updatedSubjectProgress?.confidenceScore ?? (current?.confidenceScore ?? 50),
      performanceScore: updatedSubjectProgress?.masteryScore ?? (current?.masteryScore ?? 50),
      sessionCount: (current?.sessionsCompleted ?? 0) + 1,
      studentName: student.name,
    });

    const completionMessage = buildSessionCompletionMessage(sessionFeedback, subject.name);

    // SEND PARENT NOTIFICATION VIA WHATSAPP (ASYNC, NON-BLOCKING)
    if (student.parentPhoneNumber) {
      sendParentSessionNotification({
        sessionId: session.id,
        studentId: student.id,
        parentPhone: student.parentPhoneNumber,
        summary: sessionSummary,
      }).catch((error) => {
        console.error("[SessionCompletion] Failed to send parent notification:", error);
      });

      // DETECT AND TRIGGER ALERTS IF NEEDED
      detectAndTriggerAlerts({
        tenantId: actor.tenantId,
        studentId: student.id,
        parentPhone: student.parentPhoneNumber,
        performanceScore: current?.masteryScore ?? 50,
        frustrationLevel: syncedEvolution.frustrationLevel,
        sessionsCompleted: (current?.sessionsCompleted ?? 0) + 1,
        lastActivityAt: new Date().toISOString(),
      }).catch((error) => {
        console.error("[SessionCompletion] Failed to detect alerts:", error);
      });
    }

    return {
      session,
      subject,
      adaptation,
      reply: tutorResponse.reply,
      explanation: String(tutorResponse.output.explanation),
      suggestedSteps: Array.isArray(tutorResponse.output.suggestedSteps) ? tutorResponse.output.suggestedSteps.map((item) => String(item)) : [],
      reinforcementQuestion: String(tutorResponse.output.reinforcementQuestion),
      insights,
      isRecovered: !!recoveredSession,
      sessionFeedback: {
        progressMessage: sessionFeedback.progressMessage,
        scoreChange: sessionFeedback.scoreChange,
        masteryLevel: sessionFeedback.masteryLevel,
        confidenceLevel: sessionFeedback.confidenceLevel,
        nextSteps: sessionFeedback.nextSteps,
        encouragement: sessionFeedback.encouragement,
        completionMessage,
      },
    };
  }

  async createExercise(actor: MentoriaSessionActor, payload: {
    subjectSlug: string;
    topic: string;
    difficultyLevel?: string;
  }): Promise<MentoriaExercise> {
    const student = await this.requireOnboardedStudent(actor);
    const billing = await this.getBillingSummary({ tenantId: actor.tenantId, canManageBilling: this.canManageBilling(actor) }, student);
    assertMentoriaLimit(
      billing,
      "exercisesPerDay",
      "Has agotado las practicas incluidas hoy en tu plan actual.",
      "MENTORIA_EXERCISES_LIMIT_REACHED",
    );
    const subject = await this.repository.getSubjectBySlug(actor.tenantId, payload.subjectSlug);
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");
    const evolution = await this.ensureEvolutionProfile(actor.tenantId, student);
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, student, evolution, interventions);
    const dailyPlan = await this.ensureDailyPlan(actor.tenantId, student, { evolution, interventions, motivation });
    const actorContext = await this.syncUserContext(actor, student, {
      evolution,
      motivation,
      dailyPlan,
      lastSubject: subject,
    });
    const exerciseTask = createAgentTask({
      kind: "exercise-generator",
      channel: "mentoria_exercise",
      context: actorContext,
      objective: payload.topic,
      input: {
        profile: student,
        subject,
        topic: payload.topic,
        difficultyLevel: payload.difficultyLevel ?? "medium",
        evolution,
        interventions: [],
        motivation,
        dailyPlan,
        billing,
      },
      metadata: {
        product: "mentoria",
        subjectId: subject.id,
      },
    });
    const adaptiveContext = this.getAdaptiveContext(billing, interventions, motivation);
    const generated = await executeAgent<
      {
        profile: StudentProfile;
        subject: MentoriaSubject;
        topic: string;
        difficultyLevel: string;
        evolution: StudentEvolutionProfile;
        interventions: MentoriaIntervention[];
        motivation: MotivationState;
        dailyPlan: DailyPlan;
        billing: MentoriaBillingSummary;
      },
      {
        prompt: string;
        expectedCompetency: string;
        hints: string[];
        answerFormat: string;
        difficultyLevel: string;
      }
    >({
      ...exerciseTask,
      input: {
        ...exerciseTask.input,
        interventions: adaptiveContext.interventions,
        motivation: adaptiveContext.motivation,
      },
    });
    return this.repository.createExercise({
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjectId: subject.id,
      prompt: generated.output.prompt,
      expectedCompetency: generated.output.expectedCompetency,
      hints: generated.output.hints,
      answerFormat: generated.output.answerFormat,
      difficultyLevel: generated.output.difficultyLevel,
      sessionId: exerciseTask.id,
    });
  }

  async correctExercise(actor: MentoriaSessionActor, payload: { exerciseId: string; studentAnswer: string }): Promise<MentoriaExercise> {
    const student = await this.requireOnboardedStudent(actor);
    const exercises = await this.repository.listExercises(actor.tenantId, student.id);
    const exercise = exercises.find((item) => item.id === payload.exerciseId);
    if (!exercise) throw new Error("EXERCISE_NOT_FOUND");
    const subject = await this.repository.getSubjectById(actor.tenantId, exercise.subjectId);
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");
    const [evolution, progress] = await Promise.all([
      this.ensureEvolutionProfile(actor.tenantId, student),
      this.repository.listProgress(actor.tenantId, student.id),
    ]);
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, student, evolution, interventions);
    const current = progress.find((item) => item.subjectId === subject.id);
    await this.ensureDailyPlan(actor.tenantId, student, { evolution, interventions, motivation, progress });
    const billing = await this.getBillingSummary({ tenantId: actor.tenantId, canManageBilling: this.canManageBilling(actor) }, student);
    const adaptiveContext = this.getAdaptiveContext(billing, interventions, motivation);
    const correction = await correctExercise({
      profile: student,
      subject,
      exercise,
      studentAnswer: payload.studentAnswer,
      evolution,
      interventions: adaptiveContext.interventions,
      motivation: adaptiveContext.motivation,
    });
    const saved = await this.repository.completeExercise({
      tenantId: actor.tenantId,
      exerciseId: exercise.id,
      studentProfileId: student.id,
      studentAnswer: payload.studentAnswer,
      correctionFeedback: correction.feedback,
      score: correction.score,
    });
    await this.repository.upsertProgress({
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjectId: subject.id,
      masteryScore: Math.min(
        100,
        (current?.masteryScore ?? 50) +
          Math.round(correction.score / (evolution.progressionVelocity >= 0.72 ? 22 : evolution.frustrationLevel >= 0.7 ? 30 : 25)),
      ),
      confidenceScore: Math.min(
        100,
        (current?.confidenceScore ?? 50) +
          Math.round(correction.score / (evolution.frustrationLevel >= 0.7 ? 35 : 30)),
      ),
      streakDays: current?.streakDays ?? 0,
      sessionsCompleted: current?.sessionsCompleted ?? 0,
      exercisesCompleted: (current?.exercisesCompleted ?? 0) + 1,
      weakTopics: correction.score < 70 ? [exercise.expectedCompetency, ...(current?.weakTopics ?? [])].slice(0, 6) : current?.weakTopics ?? [],
      strongTopics: correction.score >= 80 ? [exercise.expectedCompetency, ...(current?.strongTopics ?? [])].slice(0, 6) : current?.strongTopics ?? [],
      lastActivityAt: new Date().toISOString(),
    });
    if (!saved) {
      throw new Error("EXERCISE_SAVE_FAILED");
    }
    await this.repository.saveStudentEvolutionProfile(
      actor.tenantId,
      updateEvolutionProfileFromExercise(evolution, {
        exercise: saved,
        subject,
        studentAnswer: payload.studentAnswer,
        score: correction.score,
        correctionFeedback: correction.feedback,
        progress: current,
      }),
    );
    const syncedEvolution = await this.ensureEvolutionProfile(actor.tenantId, student);
    const syncedInterventions = await this.syncInterventions(actor.tenantId, student.id, syncedEvolution);
    const savedMotivation = await this.repository.saveMotivationState(
      actor.tenantId,
      updateMotivationFromSession(motivation, {
        studentId: student.id,
        happenedAt: saved.updatedAt,
        durationMinutes: Math.max(6, Math.round((saved.score ?? correction.score) / 4)),
        scoreSignal: correction.score / 100,
        completed: true,
        source: "exercise",
        evolution: syncedEvolution,
        interventions: detectInterventions(syncedEvolution),
      }),
    );
    const updatedProgress = await this.repository.listProgress(actor.tenantId, student.id);
    await this.completeDailyPlan(
      actor.tenantId,
      student,
      {
        subjectId: subject.id,
        preferredTypes: correction.score >= 80 ? ["challenge", "practice"] : ["practice", "review"],
      },
      {
        forceRegeneration: true,
        progress: updatedProgress,
        evolution: syncedEvolution,
        interventions: syncedInterventions,
        motivation: savedMotivation,
      },
    );
    const syncedContext = await this.syncUserContext(actor, student, {
      progress: updatedProgress,
      evolution: syncedEvolution,
      motivation: savedMotivation,
      dailyPlan: await this.ensureDailyPlan(actor.tenantId, student, {
        progress: updatedProgress,
        evolution: syncedEvolution,
        interventions: syncedInterventions,
        motivation: savedMotivation,
      }),
      lastSubject: subject,
    });
    await trackEvent(
      createMetricEvent({
        context: syncedContext,
        type: "exercise_completed",
        name: "exercise_completed",
        source: "mentoria.service.correctExercise",
        value: correction.score,
        metadata: {
          exerciseId: exercise.id,
          subject: subject.name,
          expectedCompetency: exercise.expectedCompetency,
          score: correction.score,
        },
      }),
    );
    if (savedMotivation.streak === 2) {
      await trackEvent(
        createMetricEvent({
          context: syncedContext,
          type: "repeat_day_2",
          name: "repeat_day_2",
          source: "mentoria.service.correctExercise",
          metadata: {
            exerciseId: exercise.id,
          },
        }),
      );
    }
    await trackEvent(
      createMetricEvent({
        context: syncedContext,
        name: "mentoria_activity_exercise",
        type: "mentoria_activity_exercise",
        source: "mentoria.service.correctExercise",
        value: correction.score,
        metadata: {
          exerciseId: exercise.id,
          subject: subject.name,
          score: correction.score,
          competency: exercise.expectedCompetency,
        },
      }),
    );
    return saved;
  }

  async getProgress(actor: MentoriaSessionActor): Promise<{
    progress: MentoriaProgress[];
    analysis: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] };
  }> {
    const student = await this.requireOnboardedStudent(actor);
    const [progress, studentSubjects] = await Promise.all([
      this.repository.listProgress(actor.tenantId, student.id),
      this.repository.listStudentSubjects(actor.tenantId, student.id),
    ]);
    const evolution = await this.ensureEvolutionProfile(actor.tenantId, student);
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, student, evolution, interventions);
    const dailyPlan = await this.ensureDailyPlan(actor.tenantId, student, { progress, evolution, interventions, motivation });
    const analysis = await this.buildProgressAnalysis({
      actor,
      student,
      progress,
      studentSubjects,
      evolution,
      interventions,
      motivation,
      dailyPlan,
    });
    return {
      progress,
      analysis,
    };
  }

  async generatePlan(actor: MentoriaSessionActor, studentProfileId?: string): Promise<StudyPlan> {
    const student = await this.requireOnboardedStudent(actor);
    const targetStudent = studentProfileId
      ? ((await this.repository.getStudentProfileById(actor.tenantId, studentProfileId)) as StudentProfile)
      : student;
    const billing = await this.getBillingSummary({ tenantId: actor.tenantId, canManageBilling: this.canManageBilling(actor) }, targetStudent);
    assertMentoriaLimit(
      billing,
      "plannerRegenerationsPerDay",
      "Has alcanzado el limite diario de regeneraciones del planner.",
      "MENTORIA_PLANNER_LIMIT_REACHED",
    );
    const parents = await this.repository.listParentAccounts(actor.tenantId, targetStudent.id);
    const evolution = await this.ensureEvolutionProfile(actor.tenantId, targetStudent);
    const interventions = await this.syncInterventions(actor.tenantId, targetStudent.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, targetStudent, evolution, interventions);
    await this.ensureDailyPlan(actor.tenantId, targetStudent, { force: true, evolution, interventions, motivation });
    return this.buildPlanForStudent(actor.tenantId, targetStudent, parents);
  }

  async startFocus(actor: MentoriaSessionActor, payload: {
    subjectId?: string;
    studyPlanId?: string;
    durationMinutes: number;
    notes?: string;
  }) {
    const student = await this.requireOnboardedStudent(actor);
    return this.repository.startFocusSession({
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjectId: payload.subjectId,
      studyPlanId: payload.studyPlanId,
      durationMinutes: payload.durationMinutes,
      notes: payload.notes,
    });
  }

  async completeFocus(actor: MentoriaSessionActor, payload: {
    focusSessionId: string;
    distractionsCount: number;
    notes?: string;
  }) {
    const student = await this.requireOnboardedStudent(actor);
    const [focusSession, evolution] = await Promise.all([
      this.repository.completeFocusSession({
        tenantId: actor.tenantId,
        focusSessionId: payload.focusSessionId,
        studentProfileId: student.id,
        distractionsCount: payload.distractionsCount,
        notes: payload.notes,
      }),
      this.ensureEvolutionProfile(actor.tenantId, student),
    ]);
    if (focusSession) {
      const updatedEvolution = await this.repository.saveStudentEvolutionProfile(actor.tenantId, {
        ...evolution,
        consistencyScore: Math.max(0, Math.min(1, evolution.consistencyScore + (payload.distractionsCount <= 1 ? 0.06 : -0.04))),
        frustrationLevel: Math.max(0, Math.min(1, evolution.frustrationLevel + Math.min(0.08, payload.distractionsCount * 0.02))),
        averageResponseTime: Math.round((evolution.averageResponseTime + focusSession.durationMinutes) / 2),
        updatedAt: new Date().toISOString(),
      });
      const syncedInterventions = await this.syncInterventions(actor.tenantId, student.id, updatedEvolution);
      const motivation = await this.ensureMotivationState(actor.tenantId, student, updatedEvolution, syncedInterventions);
      const savedMotivation = await this.repository.saveMotivationState(
        actor.tenantId,
        updateMotivationFromSession(motivation, {
          studentId: student.id,
          happenedAt: focusSession.updatedAt,
          durationMinutes: focusSession.durationMinutes,
          scoreSignal: payload.distractionsCount <= 1 ? 0.82 : payload.distractionsCount <= 3 ? 0.62 : 0.4,
          completed: true,
          source: "focus",
          evolution: updatedEvolution,
          interventions: detectInterventions(updatedEvolution),
        }),
      );
      await this.completeDailyPlan(
        actor.tenantId,
        student,
        { subjectId: focusSession.subjectId, preferredTypes: ["practice", "review"] },
        {
          forceRegeneration: true,
          progress: await this.repository.listProgress(actor.tenantId, student.id),
          evolution: updatedEvolution,
          interventions: syncedInterventions,
          motivation: savedMotivation,
        },
      );
      const syncedContext = await this.syncUserContext(actor, student, {
        progress: await this.repository.listProgress(actor.tenantId, student.id),
        evolution: updatedEvolution,
        motivation: savedMotivation,
        dailyPlan: await this.ensureDailyPlan(actor.tenantId, student, {
          evolution: updatedEvolution,
          interventions: syncedInterventions,
          motivation: savedMotivation,
        }),
      });
      await trackEvent(
        createMetricEvent({
          context: syncedContext,
          name: "mentoria_activity_focus",
          type: "mentoria_activity_focus",
          source: "mentoria.service.completeFocus",
          metadata: {
            focusSessionId: focusSession.id,
            durationMinutes: focusSession.durationMinutes,
            distractionsCount: focusSession.distractionsCount,
          },
        }),
      );
    }
    return focusSession;
  }

  async listExercises(actor: MentoriaSessionActor) {
    const student = await this.requireOnboardedStudent(actor);
    return this.repository.listExercises(actor.tenantId, student.id);
  }

  async getParentDashboard(actor: MentoriaSessionActor) {
    const dashboard = await this.getDashboard(actor);
    const billing = dashboard.billing;
    if (!billing.features.advancedParentInsights) {
      return {
        ...dashboard,
        interventions: [],
        insights: [],
      };
    }
    return dashboard;
  }
}
