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
import { recordCampamentoEvent } from "@/lib/empire/events";
import type { MentoriaRequestSession } from "@/lib/mentoria/auth/request";
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
  adaptDailyPlanWithLearningMemory,
  updateStudentLearningMemory,
} from "@/lib/mentoria/student-memory-engine";
import {
  buildStudentSubjectMemoryEventConcept,
  updateStudentSubjectMemory,
} from "@/lib/mentoria/student-subject-memory-engine";
import {
  createInitialStudentLearningMemory,
  type StudentLearningMemory,
} from "@/lib/mentoria/student-learning-memory";
import {
  applyMentoriaGrowthEntitlements,
  assertMentoriaLimit,
  buildMentoriaBillingSummary,
} from "@/lib/mentoria/plans";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";
import { runMentoriaBehavioralShadow } from "@/lib/behavioral-engine/adapters/mentoria";
import type { BehavioralShadowComparison } from "@/lib/behavioral-engine/contracts";
import { getMentoriaBehavioralEngineRollout, type BehavioralEngineRolloutMode } from "@/lib/behavioral-engine/rollout";
import {
  buildDailyClosureSummary,
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
import { buildMentoriaSessionContract, resolveMentoriaSessionMode } from "@/lib/mentoria/session-modes";
import {
  applyTutorBehaviorPolicy,
  buildTutorBehaviorPolicy,
  resolveSessionModeFromProfile,
  updateDynamicStudentProfile,
  type TutorBehaviorPolicy,
} from "@/lib/mentoria/profile-engine";
import { SessionPersistenceManager } from "@/lib/mentoria/session-persistence";
import { generateSessionSummary } from "@/lib/mentoria/session-summary";
import { generateSessionFeedback, buildSessionCompletionMessage } from "@/lib/mentoria/session-feedback";
import { buildDynamicStudentProfile, type DynamicStudentProfile } from "@/lib/mentoria/student-profile";
import { TrialManager } from "@/lib/mentoria/trial-system";
import { checkAccessControl, UpgradeFlowError, buildTrialExpiringWarning, buildUpgradePrompt } from "@/lib/mentoria/upgrade-flow";
import { getMentoriaOrchestrator } from "@/lib/mentoria/resilience/orchestrator";
import {
  createInitialEvolutionProfile,
  updateEvolutionFromSession,
  updateEvolutionProfileFromExercise,
  type StudentEvolutionProfile,
} from "@/lib/mentoria/student-evolution";
import type {
  DailyPlan,
  MentoriaCanonicalFamilyContract,
  MentoriaBillingSummary,
  MentoriaFamily,
  MentoriaDailyClosureSummary,
  MentoriaDashboard,
  MentoriaProgress,
  FocusSession,
  LearningSession,
  MentoriaEmotionalBaseline,
  MentoriaExercise,
  MentoriaGuardianHookEvent,
  MentoriaGuardian,
  MentoriaGuardianStudentAccess,
  MentoriaGrowthSummary,
  MentoriaIntervention,
  MentoriaFamilyStructure,
  MentoriaLearningPreference,
  MentoriaLearningStage,
  MentoriaOnboardingAdditionalStudentInput,
  MentoriaSessionContext,
  MentoriaSupportStyle,
  MentoriaSupervisionLevel,
  MentoriaOnboardingPayload,
  MentoriaOnboardingPrimaryGuardian,
  MentoriaOnboardingState,
  MentoriaRepeatedCourseStatus,
  MentoriaStudentAgeCourseFit,
  MentoriaStudentSessionSignal,
  MentoriaOnboardingSubjectInput,
  MentoriaStudentSupportNeed,
  MentoriaProgressShare,
  MentoriaReferral,
  MentoriaReferralProfile,
  MentoriaSessionInputKind,
  MentoriaSessionMode,
  MentoriaStudentMemorySummary,
  MentoriaStudentSubjectMemory,
  MentoriaSubject,
  MentoriaWorkspaceEntry,
  ParentAccount,
  StudentProfile,
  StudyPlan,
} from "@/lib/mentoria/types";

type MentoriaSessionActor = MentoriaRequestSession;

type MentoriaEntryMode = "resume_session" | "gentle_restart" | "momentum_push" | "plan_task" | "entry";

function getTutorModeInstruction(mode: MentoriaSessionMode, contractHeadline: string) {
  if (mode === "task_resolution") {
    return `${contractHeadline}. Trabaja desde un deber real, aclara el enunciado y evita convertir la sesión en explicación abstracta.`;
  }
  if (mode === "exam_preparation") {
    return `${contractHeadline}. Ordena el repaso por prioridad, reduce ansiedad y deja claro qué bloque conviene preparar hoy.`;
  }
  if (mode === "subject_reinforcement") {
    return `${contractHeadline}. Refuerza comprensión aunque no haya tarea y cierra con una práctica de consolidación.`;
  }
  if (mode === "study_routine") {
    return `${contractHeadline}. Convierte la rutina en un bloque viable, humano y claro, sin sonar a panel administrativo.`;
  }
  return `${contractHeadline}. Protege la vuelta suave, baja carga y busca una primera victoria rápida antes de exigir más.`;
}

function buildSessionSignalInstruction(signal?: MentoriaStudentSessionSignal | null) {
  if (!signal) return "";
  const priority = signal.priority === "exam"
    ? "prioridad de hoy: examen cercano"
    : signal.priority === "homework"
      ? "prioridad de hoy: deber o tarea concreta"
      : signal.priority === "organization"
        ? "prioridad de hoy: ordenar la rutina"
        : signal.priority === "reinforcement"
          ? "prioridad de hoy: reforzar comprension"
          : "prioridad de hoy: duda libre";
  const emotion = signal.emotion === "blocked"
    ? "estado del alumno: bloqueado"
    : signal.emotion === "tired"
      ? "estado del alumno: cansado"
      : signal.emotion === "motivated"
        ? "estado del alumno: con ganas"
        : "estado del alumno: estable";
  const helpType = signal.helpType === "explain_from_zero"
    ? "tipo de ayuda: explicar desde cero"
    : signal.helpType === "guided_practice"
      ? "tipo de ayuda: practica guiada"
      : signal.helpType === "quick_check"
        ? "tipo de ayuda: comprobacion rapida"
        : "tipo de ayuda: paso a paso";
  return `${priority}. ${emotion}. ${helpType}.`;
}

function resolveSessionModeFromSignal(
  signal: MentoriaStudentSessionSignal,
  input: { hasActiveTask: boolean; recentActivityLabel?: string | null },
): MentoriaSessionMode {
  if (signal.emotion === "blocked" || signal.emotion === "tired") return "soft_reentry";
  if (signal.entry === "exam" || signal.priority === "exam") return "exam_preparation";
  if (signal.entry === "homework" || signal.priority === "homework") return "task_resolution";
  if (signal.entry === "study_block" || signal.priority === "organization") return "study_routine";
  if (input.hasActiveTask && input.recentActivityLabel === "ayer") return "soft_reentry";
  return "subject_reinforcement";
}

function resolveSessionInputKindFromSignal(signal: MentoriaStudentSessionSignal): MentoriaSessionInputKind {
  if (signal.entry === "exam" || signal.priority === "exam") return "exam_photo";
  if (signal.entry === "study_block" || signal.priority === "organization") return "family_routine";
  if (signal.entry === "homework") return "task_photo";
  return "student_state_signal";
}

type MentoriaOnboardingAttributes = {
  schoolYear: string;
  stage?: MentoriaLearningStage;
  age: number;
  ageCourseFit: MentoriaStudentAgeCourseFit;
  learningPreference: MentoriaLearningPreference;
  supportNeeds: MentoriaStudentSupportNeed[];
  supportStyle: MentoriaSupportStyle;
  familyStructure?: MentoriaFamilyStructure;
  repeatedCourseStatus: MentoriaRepeatedCourseStatus;
  repeatedCourseYears: string[];
};

function getTutorEntryModeAdjustments(entryMode?: MentoriaEntryMode) {
  if (entryMode === "gentle_restart") {
    return {
      explanationDepth: "step_by_step" as const,
      difficultyAdjustment: "down" as const,
      tutorInstruction:
        "Esta respuesta nace desde un reenganche suave. Empieza por una victoria rapida, reduce la carga cognitiva y deja claro el primer paso antes de ampliar.",
    };
  }

  if (entryMode === "momentum_push") {
    return {
      explanationDepth: "challenge" as const,
      difficultyAdjustment: "up" as const,
      tutorInstruction:
        "Esta respuesta nace desde un momento de buena inercia. Sube un poco el liston, pero deja un reto muy claro y accionable desde el primer turno.",
    };
  }

  if (entryMode === "resume_session") {
    return {
      explanationDepth: "guided" as const,
      difficultyAdjustment: "steady" as const,
      tutorInstruction:
        "Esta respuesta retoma una sesion anterior. Entra directamente en el siguiente paso y evita repetir una introduccion generica o empezar desde cero.",
    };
  }

  if (entryMode === "plan_task") {
    return {
      explanationDepth: "guided" as const,
      difficultyAdjustment: "steady" as const,
      tutorInstruction:
        "Esta respuesta nace desde la siguiente tarea del plan del dia. Haz visible por que esta accion encaja ahora mismo y conecta el primer paso con el plan.",
    };
  }

  return {
    explanationDepth: null,
    difficultyAdjustment: null,
    tutorInstruction: "",
  };
}

function getExerciseEntryModeAdjustments(entryMode?: MentoriaEntryMode) {
  if (entryMode === "gentle_restart") {
    return {
      difficultyLevel: "easy",
      promptInstruction:
        "La primera experiencia tras volver debe sentirse facil de arrancar, con una consigna corta y una primera pista especialmente clara.",
    };
  }

  if (entryMode === "momentum_push") {
    return {
      difficultyLevel: "hard",
      promptInstruction:
        "La primera experiencia tras volver debe sentirse como un pequeno salto de nivel: mas exigente que una practica estandar, pero aun resoluble en pocos minutos.",
    };
  }

  if (entryMode === "plan_task") {
    return {
      difficultyLevel: null,
      promptInstruction:
        "La primera experiencia tras volver debe sentirse como continuidad natural del plan del dia, no como una tarea aislada.",
    };
  }

  if (entryMode === "resume_session") {
    return {
      difficultyLevel: null,
      promptInstruction:
        "La primera experiencia tras volver debe conectar con el siguiente paso de la sesion anterior y no sonar como un ejercicio generico.",
    };
  }

  return {
    difficultyLevel: null,
    promptInstruction: "",
  };
}

function deriveEmotionalBaselineFromSupportNeeds(supportNeeds: MentoriaStudentSupportNeed[]): MentoriaEmotionalBaseline {
  const needs = new Set(supportNeeds);
  return {
    frustration: needs.has("frustration") || needs.has("exam_anxiety") ? "high" : needs.has("base_gap") ? "medium" : "low",
    motivation: needs.has("study_habit") || needs.has("organization") ? "medium" : needs.has("frustration") ? "low" : "high",
    concentration: needs.has("attention") || needs.has("organization") ? "low" : "medium",
  };
}

function getAgeFromSchoolYear(schoolYear: string): number {
  const year = schoolYear.toLowerCase().trim();
  if (year === "1 primaria") return 6;
  if (year === "2 primaria") return 7;
  if (year === "3 primaria") return 8;
  if (year === "4 primaria") return 9;
  if (year === "5 primaria") return 10;
  if (year === "6 primaria") return 11;
  if (year === "1 eso") return 12;
  if (year === "2 eso") return 13;
  if (year === "3 eso") return 14;
  if (year === "4 eso") return 15;
  if (year === "1 bachillerato") return 16;
  if (year === "2 bachillerato") return 17;
  return 16;
}

function deriveLearningPreferenceFromSupportStyle(style: MentoriaSupportStyle): MentoriaLearningPreference {
  if (style === "guided_practice" || style === "step_by_step") return "step_by_step";
  if (style === "retrieval_check") return "quick_summaries";
  return "practical_examples";
}

function deriveLearningGoalsFromSupportNeeds(
  subjects: Array<{ name: string }>,
  supportNeeds: MentoriaStudentSupportNeed[],
): string[] {
  const needs = new Set(supportNeeds);
  return subjects.map((subject) => {
    if (needs.has("organization") || needs.has("study_habit")) {
      return `Construir una rutina clara para avanzar en ${subject.name}`;
    }
    if (needs.has("frustration") || needs.has("exam_anxiety")) {
      return `Recuperar seguridad al trabajar ${subject.name}`;
    }
    if (needs.has("base_gap")) {
      return `Reconstruir la base de ${subject.name} sin lagunas`;
    }
    return `Avanzar con mas claridad en ${subject.name}`;
  });
}

function derivePreferredStudyMinutesFromProfile(schoolYear: string, supportNeeds: MentoriaStudentSupportNeed[]): number {
  const stageBoost = schoolYear.toLowerCase().includes("bachillerato") ? 10 : schoolYear.toLowerCase().includes("eso") ? 5 : 0;
  const needs = new Set(supportNeeds);
  const base = needs.has("attention") || needs.has("frustration") ? 25 : needs.has("study_habit") ? 30 : 35;
  return Math.max(20, base + stageBoost);
}

function resolveAgeCourseFit(age: number, schoolYear: string): MentoriaStudentAgeCourseFit {
  const expectedAge = getAgeFromSchoolYear(schoolYear);
  if (age <= expectedAge - 1) return "ahead";
  if (age >= expectedAge + 1) return "behind";
  return "expected";
}

function deriveBaseEmotionalState(baseline: MentoriaEmotionalBaseline): StudentProfile["baseEmotionalState"] {
  if (baseline.concentration === "low") return "blocked";
  if (baseline.frustration === "high") return "frustrated";
  if (baseline.motivation === "low") return "demotivated";
  if (baseline.frustration === "low" && baseline.motivation === "high" && baseline.concentration === "high") return "confident";
  return "steady";
}

function deriveStrengths(input: MentoriaOnboardingSubjectInput[], subjects: Array<{ id: string; name: string }>): string[] {
  return input
    .filter((item) => item.initialLevel === "se_me_da_bien")
    .map((item) => subjects.find((subject) => subject.id === item.subjectSlug || subject.name === item.subjectSlug)?.name ?? item.subjectSlug);
}

function formatAgeCourseFit(value: MentoriaStudentAgeCourseFit) {
  if (value === "ahead") return "adelantado para el curso";
  if (value === "behind") return "edad superior al curso";
  return "edad alineada con el curso";
}

function formatRepeatedCourseStatus(value: MentoriaRepeatedCourseStatus) {
  if (value === "current") return "repite actualmente";
  if (value === "before") return "ha repetido antes";
  return "no ha repetido";
}

function formatSupportNeed(value: MentoriaStudentSupportNeed) {
  if (value === "base_gap") return "falta de base";
  if (value === "frustration") return "frustracion";
  if (value === "organization") return "organizacion";
  if (value === "study_habit") return "habito de estudio";
  if (value === "attention") return "atencion";
  return "ansiedad ante examenes";
}

function formatSupportStyle(style: MentoriaSupportStyle) {
  if (style === "step_by_step") return "paso a paso";
  if (style === "visual_steps") return "visual y por bloques";
  if (style === "concrete_example") return "con ejemplos concretos";
  if (style === "guided_practice") return "practica guiada";
  return "comprobaciones cortas";
}

function formatGuardianRoleForSupportNotes(guardian: MentoriaOnboardingPrimaryGuardian): string {
  if (guardian.relation === "father") return "Padre";
  if (guardian.relation === "mother") return "Madre";
  return "Tutor";
}

function formatFamilyStructureForSupportNotes(value: MentoriaFamilyStructure): string {
  if (value === "two_guardians") return "dos tutores";
  if (value === "separated_parents") return "padres separados";
  if (value === "legal_guardian") return "tutor legal";
  return "un tutor";
}

function toOnboardingInput(
  payload: MentoriaOnboardingPayload,
  learningGoals: string[],
  age: number,
  learningPreference: MentoriaLearningPreference,
): OnboardingInput<MentoriaOnboardingAttributes, MentoriaOnboardingSubjectInput> {
  const ageCourseFit = resolveAgeCourseFit(age, payload.student.schoolYear);
  return {
    fullName: payload.student.fullName,
    age,
    goals: learningGoals,
    attributes: {
      schoolYear: payload.student.schoolYear,
      stage: payload.student.stage,
      age,
      ageCourseFit,
      learningPreference,
      supportNeeds: payload.student.supportNeeds,
      supportStyle: payload.student.supportStyle,
      familyStructure: payload.familyStructure,
      repeatedCourseStatus: payload.student.repeatedCourseStatus,
      repeatedCourseYears: payload.student.repeatedCourseYears ?? [],
    },
    selections: payload.student.subjects,
    metadata: {
      referralCode: payload.referralCode ?? null,
      inviteToken: payload.inviteToken ?? null,
    },
  };
}

function normalizeAdditionalStudents(input: MentoriaOnboardingAdditionalStudentInput[] | undefined): MentoriaOnboardingAdditionalStudentInput[] {
  return (input ?? [])
    .map((student) => ({
      ...student,
      fullName: student.fullName.trim(),
      schoolYear: student.schoolYear.trim(),
      age: Number(student.age ?? 0),
    }))
    .filter((student) => student.fullName && student.schoolYear && Number.isFinite(student.age) && student.age > 0);
}

function buildLegacyParentsProjection(input: {
  tenantId: string;
  studentId: string;
  guardians: MentoriaGuardian[];
  accesses: MentoriaGuardianStudentAccess[];
}): ParentAccount[] {
  return input.accesses.map((access) => {
    const guardian = input.guardians.find((item) => item.id === access.guardianId) ?? null;
    return {
      id: `legacy:${access.guardianId}:${access.studentProfileId}`,
      tenantId: input.tenantId,
      userId: guardian?.id,
      studentProfileId: input.studentId,
      fullName: guardian?.name?.trim() || guardian?.email || access.guardianId,
      email: guardian?.email ?? "",
      relation: guardian?.systemRole === "primary_guardian" ? "Parent A" : "Parent B",
      dailyStudyMinutes: access.dailyStudyMinutes,
      supervisionLevel: access.supervisionLevel,
      canViewFullProgress: access.canViewFullProgress,
      canManageSchedule: access.canManageSchedule,
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
    };
  });
}

type MentoriaLegacyParentInput = {
  slot: "Parent A" | "Parent B";
  fullName: string;
  email: string;
  dailyStudyMinutes: number;
  supervisionLevel: MentoriaSupervisionLevel;
  canViewFullProgress: boolean;
  canManageSchedule: boolean;
};

type MentoriaGuardianProfileInput = {
  id?: string | null;
  fullName: string;
  email: string;
  familyRelation?: "father" | "mother" | "tutor";
  systemRole: "primary_guardian" | "secondary_guardian";
  access: {
    dailyStudyMinutes: number;
    supervisionLevel: MentoriaSupervisionLevel;
    canViewFullProgress: boolean;
    canManageSchedule: boolean;
    notificationPreferences?: string[];
    isPrimaryContact?: boolean;
  };
};

type MentoriaFamilyProfileInput = {
  primaryGuardian: MentoriaGuardianProfileInput | null;
  secondaryGuardians: MentoriaGuardianProfileInput[];
};

export class MentoriaService {
  constructor(
    private repository = new MentoriaRepository(getMentoriaDb(env?.())),
    private familyRepository = new MentoriaFamilyRepository(getMentoriaDb(env?.())),
    private persistence = new SessionPersistenceManager(),
    private trialManager = new TrialManager(),
  ) {
    ensureMentoriaAgentHandlersRegistered();
  }

  private canManageBilling(actor: MentoriaSessionActor): boolean {
    return Boolean(actor.userId && actor.tenantId);
  }

  private async getCanonicalFamilyContract(actor: MentoriaSessionActor, student: StudentProfile): Promise<MentoriaCanonicalFamilyContract> {
    const [family, guardians, guardianStudentAccess] = await Promise.all([
      this.familyRepository.getFamilyById(actor.tenantId),
      this.familyRepository.listGuardiansByFamily(actor.tenantId),
      this.familyRepository.listGuardianStudentAccessByStudent(actor.tenantId, student.id),
    ]);

    const primaryGuardian = guardians.find((guardian) => guardian.systemRole === "primary_guardian") ?? null;
    const secondaryGuardians = guardians.filter((guardian) => guardian.systemRole !== "primary_guardian");

    return {
      family,
      primaryGuardian,
      secondaryGuardians,
      guardianStudentAccess,
    };
  }

  private async syncCanonicalGuardiansFromProfile(
    actor: MentoriaSessionActor,
    student: StudentProfile,
    profile: MentoriaFamilyProfileInput,
  ): Promise<MentoriaCanonicalFamilyContract> {
    const existingGuardians = await this.familyRepository.listGuardiansByFamily(actor.tenantId);
    const existingPrimaryGuardian = existingGuardians.find((guardian) => guardian.systemRole === "primary_guardian") ?? null;
    const existingSecondaryGuardians = existingGuardians.filter((guardian) => guardian.systemRole !== "primary_guardian");

    const normalizedPrimaryGuardian = profile.primaryGuardian && profile.primaryGuardian.fullName.trim() && profile.primaryGuardian.email.trim()
      ? {
          ...profile.primaryGuardian,
          fullName: profile.primaryGuardian.fullName.trim(),
          email: profile.primaryGuardian.email.trim().toLowerCase(),
        }
      : null;

    const normalizedSecondaryGuardians = profile.secondaryGuardians
      .map((guardian) => ({
        ...guardian,
        fullName: guardian.fullName.trim(),
        email: guardian.email.trim().toLowerCase(),
      }))
      .filter((guardian) => guardian.fullName && guardian.email);

    const keptGuardianIds = new Set<string>();

    const primaryGuardian = normalizedPrimaryGuardian
      ? await this.familyRepository.upsertGuardian({
          id: normalizedPrimaryGuardian.id ?? existingPrimaryGuardian?.id,
          email: normalizedPrimaryGuardian.email,
          familyId: actor.tenantId,
          name: normalizedPrimaryGuardian.fullName,
          familyRelation: normalizedPrimaryGuardian.familyRelation ?? existingPrimaryGuardian?.familyRelation ?? "tutor",
          systemRole: "primary_guardian",
        })
      : existingPrimaryGuardian;

    if (primaryGuardian) {
      keptGuardianIds.add(primaryGuardian.id);
      await this.familyRepository.upsertGuardianStudentAccess({
        familyId: actor.tenantId,
        guardianId: primaryGuardian.id,
        studentId: student.id,
        studentProfileId: student.id,
        canViewFullProgress: normalizedPrimaryGuardian?.access.canViewFullProgress ?? true,
        canManageSchedule: normalizedPrimaryGuardian?.access.canManageSchedule ?? true,
        dailyStudyMinutes: normalizedPrimaryGuardian?.access.dailyStudyMinutes ?? 45,
        supervisionLevel: normalizedPrimaryGuardian?.access.supervisionLevel ?? "balanced",
        notificationPreferences: normalizedPrimaryGuardian?.access.notificationPreferences ?? ["progress", "planner"],
        isPrimaryContact: normalizedPrimaryGuardian?.access.isPrimaryContact ?? true,
      });
    }

    for (const secondaryGuardian of normalizedSecondaryGuardians) {
      const matchedExistingGuardian = existingSecondaryGuardians.find((guardian) => guardian.email.toLowerCase() === secondaryGuardian.email) ?? null;
      const guardian = await this.familyRepository.upsertGuardian({
        id: secondaryGuardian.id ?? matchedExistingGuardian?.id,
        email: secondaryGuardian.email,
        familyId: actor.tenantId,
        name: secondaryGuardian.fullName,
        familyRelation: secondaryGuardian.familyRelation ?? matchedExistingGuardian?.familyRelation ?? "tutor",
        systemRole: "secondary_guardian",
      });

      keptGuardianIds.add(guardian.id);

      await this.familyRepository.upsertGuardianStudentAccess({
        familyId: actor.tenantId,
        guardianId: guardian.id,
        studentId: student.id,
        studentProfileId: student.id,
        canViewFullProgress: secondaryGuardian.access.canViewFullProgress,
        canManageSchedule: secondaryGuardian.access.canManageSchedule,
        dailyStudyMinutes: secondaryGuardian.access.dailyStudyMinutes,
        supervisionLevel: secondaryGuardian.access.supervisionLevel,
        notificationPreferences: secondaryGuardian.access.notificationPreferences ?? ["progress", "planner"],
        isPrimaryContact: secondaryGuardian.access.isPrimaryContact ?? false,
      });
    }

    const removableSecondaryGuardians = existingSecondaryGuardians.filter((guardian) => !keptGuardianIds.has(guardian.id));
    if (removableSecondaryGuardians.length > 0) {
      const removableIds = removableSecondaryGuardians.map((guardian) => guardian.id);
      await this.familyRepository.deleteGuardianStudentAccessByStudentAndGuardianIds(actor.tenantId, student.id, removableIds);
      await this.familyRepository.deleteSecondaryGuardiansByIds(actor.tenantId, removableIds);
    }

    await this.repository.deleteParentAccountsForStudent(actor.tenantId, student.id);
    const syncedGuardians = await this.familyRepository.listGuardiansByFamily(actor.tenantId);
    const syncedAccess = await this.familyRepository.listGuardianStudentAccessByStudent(actor.tenantId, student.id);
    const legacyParentsProjection = buildLegacyParentsProjection({
      tenantId: actor.tenantId,
      studentId: student.id,
      guardians: syncedGuardians,
      accesses: syncedAccess,
    });
    for (const legacyParent of legacyParentsProjection) {
      await this.repository.upsertParentAccount({
        tenantId: legacyParent.tenantId,
        userId: legacyParent.userId ?? `${student.id}:${legacyParent.relation.toLowerCase().replace(/\s+/g, "-")}`,
        studentProfileId: legacyParent.studentProfileId,
        fullName: legacyParent.fullName,
        email: legacyParent.email,
        relation: legacyParent.relation,
        dailyStudyMinutes: legacyParent.dailyStudyMinutes,
        supervisionLevel: legacyParent.supervisionLevel,
        canViewFullProgress: legacyParent.canViewFullProgress,
        canManageSchedule: legacyParent.canManageSchedule,
        notificationPreferences: ["progress", "planner"],
      });
    }

    return {
      family: await this.familyRepository.getFamilyById(actor.tenantId),
      primaryGuardian,
      secondaryGuardians: syncedGuardians.filter((guardian) => guardian.systemRole !== "primary_guardian"),
      guardianStudentAccess: syncedAccess,
    };
  }

  private buildSessionContext(actor: MentoriaSessionActor, student: StudentProfile | null, canonical?: MentoriaCanonicalFamilyContract): MentoriaSessionContext {
    const directStudentOwner = Boolean(student?.userId && actor.userId && student.userId === actor.userId);
    if (directStudentOwner && student) {
      return {
        actorType: "student",
        familyId: actor.tenantId ?? canonical?.family?.id ?? null,
        studentProfileId: student.id,
        guardianId: null,
        systemRole: null,
      };
    }

    if (canonical?.primaryGuardian || canonical?.secondaryGuardians.length) {
      const guardian = canonical.primaryGuardian
        ?? canonical.secondaryGuardians.find((item) => item.email && actor.email && item.email.toLowerCase() === actor.email.toLowerCase())
        ?? canonical.secondaryGuardians[0]
        ?? null;
      return {
        actorType: guardian ? "guardian" : "unknown",
        familyId: actor.tenantId ?? canonical?.family?.id ?? null,
        guardianId: guardian?.id ?? null,
        studentProfileId: student?.id ?? null,
        systemRole: guardian?.systemRole ?? null,
      };
    }

    return {
      actorType: "unknown",
      familyId: actor.tenantId ?? canonical?.family?.id ?? null,
      guardianId: null,
      studentProfileId: student?.id ?? null,
      systemRole: null,
    };
  }

  private async resolveStudentForActor(
    actor: MentoriaSessionActor,
    options?: { studentProfileId?: string | null; fallbackToFirstAccessible?: boolean },
  ): Promise<StudentProfile | null> {
    const requestedStudentProfileId = options?.studentProfileId?.trim() || "";
    const directStudent = await this.repository.getStudentProfileByUser(actor.tenantId, actor.userId);
    if (directStudent) {
      if (requestedStudentProfileId && directStudent.id !== requestedStudentProfileId) {
        throw new Error("STUDENT_ACCESS_DENIED");
      }
      return directStudent;
    }

    const accessibleStudents = await this.repository.listGuardianAccessibleStudents(actor.tenantId, actor.userId).catch(() => []);
    if (accessibleStudents.length === 0) {
      return null;
    }

    if (requestedStudentProfileId) {
      const explicitAccess = accessibleStudents.find((item) => item.studentProfileId === requestedStudentProfileId || item.studentId === requestedStudentProfileId) ?? null;
      if (!explicitAccess) {
        throw new Error("STUDENT_ACCESS_DENIED");
      }
      return this.repository.getStudentProfileById(actor.tenantId, explicitAccess.studentProfileId);
    }

    if (options?.fallbackToFirstAccessible === false) {
      return null;
    }

    const prioritizedStudents = [...accessibleStudents].sort((left, right) => {
      if (left.isPrimaryContact !== right.isPrimaryContact) {
        return Number(right.isPrimaryContact) - Number(left.isPrimaryContact);
      }

      const leftCreatedAt = Date.parse(left.createdAt);
      const rightCreatedAt = Date.parse(right.createdAt);
      const leftTime = Number.isFinite(leftCreatedAt) ? leftCreatedAt : 0;
      const rightTime = Number.isFinite(rightCreatedAt) ? rightCreatedAt : 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.studentProfileId.localeCompare(right.studentProfileId);
    });

    for (const access of prioritizedStudents) {
      const student = await this.repository.getStudentProfileById(actor.tenantId, access.studentProfileId);
      if (student) {
        return student;
      }
    }

    return null;
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
    let existing: UserContext | undefined;
    try {
      existing = (await getUserContext(actor.userId)) ?? undefined;
    } catch {
      existing = undefined;
    }
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

    try {
      return await saveUserContext(actor.userId, context);
    } catch {
      return context;
    }
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

  private async ensureLearningMemoryProfile(
    tenantId: string,
    student: StudentProfile,
    options?: {
      evolution?: StudentEvolutionProfile | null;
      progress?: MentoriaProgress[];
      subjects?: MentoriaSubject[];
      studentSubjects?: Awaited<ReturnType<MentoriaRepository["listStudentSubjects"]>>;
      recentSessions?: LearningSession[];
    },
  ): Promise<StudentLearningMemory> {
    const existing = await this.repository.getStudentLearningMemory(tenantId, student.id);
    if (existing) {
      return existing;
    }

    const [evolution, progress, subjects, studentSubjects, recentSessions] = await Promise.all([
      options?.evolution ? Promise.resolve(options.evolution) : this.ensureEvolutionProfile(tenantId, student),
      options?.progress ? Promise.resolve(options.progress) : this.repository.listProgress(tenantId, student.id),
      options?.subjects ? Promise.resolve(options.subjects) : this.repository.listSubjects(tenantId),
      options?.studentSubjects ? Promise.resolve(options.studentSubjects) : this.repository.listStudentSubjects(tenantId, student.id),
      options?.recentSessions ? Promise.resolve(options.recentSessions) : this.repository.listLearningSessions(tenantId, student.id),
    ]);

    const initial = createInitialStudentLearningMemory({
      student,
      evolution,
      progress,
      subjects,
      studentSubjects,
      recentSessions,
    });
    return this.repository.saveStudentLearningMemory(tenantId, initial);
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
    guardianStudentAccess?: MentoriaGuardianStudentAccess[],
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
      guardianStudentAccess,
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
      learningMemory?: StudentLearningMemory;
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
    const learningMemory = options?.learningMemory ?? (await this.ensureLearningMemoryProfile(tenantId, student, {
      evolution,
      progress,
      subjects,
      studentSubjects: selectedSubjects,
    }));

    return this.repository.saveDailyPlan(
      tenantId,
      adaptDailyPlanWithLearningMemory(generateDailyPlan({
        profile: student,
        subjects,
        progress,
        evolution,
        motivation,
        interventions,
        existingPlan: existing,
      }), learningMemory),
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
      learningMemory?: StudentLearningMemory;
    },
  ): Promise<DailyPlan> {
    const plan = await this.ensureDailyPlan(tenantId, student, {
      force: options?.forceRegeneration,
      subjects: options?.subjects,
      progress: options?.progress,
      evolution: options?.evolution,
      interventions: options?.interventions,
      motivation: options?.motivation,
      learningMemory: options?.learningMemory,
    });
    return this.repository.saveDailyPlan(tenantId, completeDailyPlanTask(plan, input));
  }

  async getBillingSummary(
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

  async getProfile(actor: MentoriaSessionActor, studentProfileId?: string): Promise<StudentProfile | null> {
    await this.repository.seedSubjects(actor.tenantId);
    return this.resolveStudentForActor(actor, { studentProfileId });
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

  async getOnboardingState(actor: MentoriaSessionActor): Promise<MentoriaOnboardingState> {
    await this.repository.seedSubjects(actor.tenantId);
    const primaryGuardian = actor.email
      ? await this.familyRepository.getGuardianByFamilyAndEmail(actor.tenantId, actor.email)
      : null;
    const student = await this.resolveStudentForActor(actor);
    const familyStudents = typeof this.repository.listStudentsForTenant === "function"
      ? await this.repository.listStudentsForTenant(actor.tenantId)
      : student
        ? [student]
        : [];
    const subjects = await this.repository.listSubjects(actor.tenantId);
    const canonical = student ? await this.getCanonicalFamilyContract(actor, student) : {
      family: await this.familyRepository.getFamilyById(actor.tenantId),
      primaryGuardian,
      secondaryGuardians: primaryGuardian ? [] : await this.familyRepository.listGuardiansByFamily(actor.tenantId).then((guardians) => guardians.filter((guardian) => guardian.systemRole !== "primary_guardian")),
      guardianStudentAccess: [] as MentoriaGuardianStudentAccess[],
    };
    if (!student) {
      return {
        sessionEmail: actor.email ?? null,
        primaryGuardian: primaryGuardian
          ? {
              fullName: primaryGuardian.name ?? "",
              relation: primaryGuardian.familyRelation,
            }
          : null,
        student: null,
        profile: null,
        familyStudents,
        subjects,
        studentSubjects: [],
        family: canonical.family,
        secondaryGuardians: canonical.secondaryGuardians,
        guardianStudentAccess: canonical.guardianStudentAccess,
        sessionContext: this.buildSessionContext(actor, null, canonical),
      };
    }
    const studentSubjects = await this.repository.listStudentSubjects(actor.tenantId, student.id);
    return {
      sessionEmail: actor.email ?? null,
      primaryGuardian: primaryGuardian
        ? {
            fullName: primaryGuardian.name ?? "",
            relation: primaryGuardian.familyRelation,
          }
        : null,
      student,
      profile: student,
      familyStudents,
      subjects,
      studentSubjects,
      family: canonical.family,
      secondaryGuardians: canonical.secondaryGuardians,
      guardianStudentAccess: canonical.guardianStudentAccess,
      sessionContext: this.buildSessionContext(actor, student, canonical),
    };
  }

  async requireOnboardedStudent(actor: MentoriaSessionActor, studentProfileId?: string): Promise<StudentProfile> {
    const student = await this.getProfile(actor, studentProfileId);
    if (!student || !student.onboardingCompleted) {
      throw new Error("ONBOARDING_REQUIRED");
    }
    return student;
  }

  async submitOnboarding(actor: MentoriaSessionActor, payload: MentoriaOnboardingPayload): Promise<{
    student: StudentProfile;
    family: MentoriaFamily | null;
    primaryGuardian: MentoriaGuardian | null;
    secondaryGuardians: MentoriaGuardian[];
    guardianStudentAccess: MentoriaGuardianStudentAccess[];
    sessionContext: MentoriaSessionContext;
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

    if (!payload.primaryGuardian.fullName.trim()) throw new Error("INVALID_PRIMARY_GUARDIAN_NAME");
    if (!payload.primaryGuardian.relation) throw new Error("INVALID_PRIMARY_GUARDIAN_RELATION");
    if (!payload.student.fullName.trim()) throw new Error("INVALID_STUDENT_NAME");
    if (!payload.student.schoolYear.trim()) throw new Error("INVALID_SCHOOL_YEAR");
    if (!Number.isFinite(payload.student.age) || payload.student.age < 5 || payload.student.age > 21) throw new Error("INVALID_STUDENT_AGE");
    if (payload.student.subjects.length === 0) throw new Error("SUBJECTS_REQUIRED");
    if ((payload.student.supportNeeds ?? []).length === 0) throw new Error("SUPPORT_NEEDS_REQUIRED");

    const familyStructure = payload.familyStructure ?? "single_guardian";
    const secondaryGuardian =
      payload.secondaryGuardian && (payload.secondaryGuardian.fullName.trim() || payload.secondaryGuardian.email?.trim())
        ? {
            fullName: payload.secondaryGuardian.fullName.trim(),
            relation: payload.secondaryGuardian.relation,
            email: payload.secondaryGuardian.email?.trim().toLowerCase() ?? "",
          }
        : null;

    if (familyStructure === "two_guardians" && !secondaryGuardian?.fullName) {
      throw new Error("INVALID_SECONDARY_GUARDIAN_NAME");
    }
    if (familyStructure === "two_guardians" && !secondaryGuardian?.email) {
      throw new Error("INVALID_SECONDARY_GUARDIAN_EMAIL");
    }
    if (secondaryGuardian && !secondaryGuardian.fullName) {
      throw new Error("INVALID_SECONDARY_GUARDIAN_NAME");
    }
    if (secondaryGuardian && secondaryGuardian.email && !secondaryGuardian.email.includes("@")) {
      throw new Error("INVALID_SECONDARY_GUARDIAN_EMAIL");
    }

    const allSubjects = await this.repository.listSubjects(actor.tenantId);
    const subjectsBySlug = new Map(allSubjects.map((subject) => [subject.slug, subject]));
    const selectedSubjects = payload.student.subjects.map((item: MentoriaOnboardingSubjectInput) => {
      const subject = subjectsBySlug.get(item.subjectSlug);
      if (!subject) throw new Error(`SUBJECT_NOT_FOUND:${item.subjectSlug}`);
      return { selection: item, subject };
    });

    const studentAge = payload.student.age;
    const emotionalBaseline = deriveEmotionalBaselineFromSupportNeeds(payload.student.supportNeeds);
    const learningPreference = deriveLearningPreferenceFromSupportStyle(payload.student.supportStyle);
    const preferredStudyMinutes = derivePreferredStudyMinutesFromProfile(payload.student.schoolYear, payload.student.supportNeeds);
    const baseEmotionalState = deriveBaseEmotionalState(emotionalBaseline);
    const learningGoals = deriveLearningGoalsFromSupportNeeds(
      selectedSubjects.map((item) => ({ name: item.subject.name })),
      payload.student.supportNeeds,
    );
    const strengths = deriveStrengths(
      payload.student.subjects.map((item: MentoriaOnboardingSubjectInput) => ({ ...item, subjectSlug: item.subjectSlug })),
      selectedSubjects.map((item) => ({ id: item.subject.slug, name: item.subject.name })),
    );
    const ageCourseFit = resolveAgeCourseFit(studentAge, payload.student.schoolYear);
    const supportNotesParts = [
      `${formatGuardianRoleForSupportNotes(payload.primaryGuardian)} principal ${payload.primaryGuardian.fullName.trim()}`,
      `estructura familiar ${formatFamilyStructureForSupportNotes(familyStructure)}`,
      `etapa ${payload.student.stage ?? "sin especificar"}`,
      `curso ${payload.student.schoolYear}`,
      `edad ${studentAge}`,
      `encaje edad-curso ${formatAgeCourseFit(ageCourseFit)}`,
      `repeticion ${formatRepeatedCourseStatus(payload.student.repeatedCourseStatus)}`,
      `apoyos ${payload.student.supportNeeds.map((item) => formatSupportNeed(item)).join(", ")}`,
      `estilo ${formatSupportStyle(payload.student.supportStyle)}`,
    ];
    if ((payload.student.repeatedCourseYears ?? []).length > 0) {
      supportNotesParts.push(`cursos repetidos ${(payload.student.repeatedCourseYears ?? []).join(", ")}`);
    }
    if (secondaryGuardian?.fullName) {
      supportNotesParts.push(`${formatGuardianRoleForSupportNotes(secondaryGuardian)} secundario ${secondaryGuardian.fullName}`);
    }
    const additionalStudents = normalizeAdditionalStudents(payload.additionalStudents);
    if (additionalStudents.length > 0) {
      supportNotesParts.push(`familia con ${1 + additionalStudents.length} alumnos`);
    }

    const onboardingInput = toOnboardingInput(payload, learningGoals, studentAge, learningPreference);
    const onboardingContext = buildOnboardingUserContext({
      actor,
      onboarding: onboardingInput,
      tags: ["mentoria", "onboarding"],
      traits: {
        schoolYear: payload.student.schoolYear,
        supportStyle: payload.student.supportStyle,
        ageCourseFit,
      },
      preferences: {
        learningPreference,
        supportStyle: payload.student.supportStyle,
      },
    });

    const existingStudent = actor.actorType === "student"
      ? await this.resolveStudentForActor(actor, { studentProfileId: actor.studentProfileId ?? undefined })
      : null;

    const student = await this.repository.upsertStudentProfile({
      studentId: existingStudent?.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      fullName: payload.student.fullName.trim(),
      age: studentAge,
      schoolYear: payload.student.schoolYear,
      learningGoals,
      baseEmotionalState,
      emotionalBaseline,
      learningPreference,
      preferredStudyMinutes,
      strengths,
      onboardingCompleted: true,
      supportNotes: supportNotesParts.join(" | "),
    });
    await this.familyRepository.createFamily(actor.tenantId);
    const canonical = actor.email
      ? await this.syncCanonicalGuardiansFromProfile(actor, student, {
          primaryGuardian: {
            fullName: payload.primaryGuardian.fullName.trim(),
            email: actor.email,
            familyRelation: payload.primaryGuardian.relation,
            systemRole: "primary_guardian",
            access: {
              dailyStudyMinutes: preferredStudyMinutes,
              supervisionLevel: "balanced",
              canViewFullProgress: true,
              canManageSchedule: true,
              notificationPreferences: ["progress", "alerts", "planner"],
              isPrimaryContact: true,
            },
          },
          secondaryGuardians: secondaryGuardian?.email
            ? [
                {
                  fullName: secondaryGuardian.fullName,
                  email: secondaryGuardian.email,
                  familyRelation: secondaryGuardian.relation,
                  systemRole: "secondary_guardian",
                  access: {
                    dailyStudyMinutes: preferredStudyMinutes,
                    supervisionLevel: familyStructure === "separated_parents" ? "light" : "balanced",
                    canViewFullProgress: true,
                    canManageSchedule: familyStructure !== "separated_parents",
                    notificationPreferences: ["progress", "planner"],
                    isPrimaryContact: false,
                  },
                },
              ]
            : [],
        })
      : await this.getCanonicalFamilyContract(actor, student);

    await this.familyRepository.upsertStudent({
      id: student.id,
      familyId: actor.tenantId,
      name: student.fullName,
      age: student.age,
      level: student.schoolYear,
    });
    for (const additionalStudent of additionalStudents) {
      await this.familyRepository.createStudent({
        familyId: actor.tenantId,
        name: additionalStudent.fullName,
        age: additionalStudent.age,
        level: additionalStudent.schoolYear,
      });
    }

    await this.repository.replaceStudentSubjects({
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjects: selectedSubjects.map((item) => ({
        subjectId: item.subject.id,
        initialLevel: item.selection.initialLevel,
      })),
    });

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
    const plan = await this.buildPlanForStudent(actor.tenantId, student, canonical.guardianStudentAccess);
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
    const activationTask = createAgentTask({
      kind: "user_activation",
      channel: "mentoria_onboarding",
      objective: `Dejar listo el espacio estructural de ${student.fullName}`,
      context: persistedOnboardingContext,
      input: {
        subjectSlug: weakestSubjectSelection.subject.slug,
        topic: weakestSubjectSelection.subject.name,
        message: "Onboarding estructural completado. El siguiente paso se decide al entrar en el workspace.",
      },
      metadata: {
        product: "mentoria",
        supportStyle: payload.student.supportStyle,
        onboardingOnly: true,
      },
    });
    const refreshedProgress = await this.getProgress(actor);
    const refreshedDailyPlan = (await this.getDashboard(actor)).dailyPlan;
    const activationResponse = createAgentResponse({
      task: activationTask,
      reply: "Tu estructura ya esta lista. A partir de aqui, el alumno entra en su workspace y define como viene hoy para que la IA adapte la sesion real.",
      output: {
        subjectSlug: weakestSubjectSelection.subject.slug,
        subjectName: weakestSubjectSelection.subject.name,
        recommendedNextStep: "Entrar al workspace y elegir la prioridad de hoy.",
      },
      recommendations: refreshedProgress.analysis.nextActions,
      metadata: {
        product: "mentoria",
        onboardingOnly: true,
      },
    });
    const activationInsights = [
      createInsight({
        category: "activation",
        title: "Primer valor entregado",
        summary: `Se ha dejado listo el workspace estructural de ${student.fullName}.`,
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

    await recordCampamentoEvent({
      tenantId: actor.tenantId,
      type: "mentoria.onboarding.completed",
      severity: "INFO",
      source: "mentoria.onboarding",
      message: "Onboarding completed",
      correlationId: student.id,
      metadata: {
        studentId: student.id,
        firstSubjectId: weakestSubjectSelection.subject.slug ?? weakestSubjectSelection.subject.id,
      },
    });

    return {
      student,
      family: canonical.family,
      primaryGuardian: canonical.primaryGuardian,
      secondaryGuardians: canonical.secondaryGuardians,
      guardianStudentAccess: canonical.guardianStudentAccess,
      sessionContext: this.buildSessionContext(actor, student, canonical),
      plan,
      progress: refreshedProgress.progress,
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
    const canonical = await this.getCanonicalFamilyContract(actor, student);
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
    return {
      ...(dashboard as MentoriaDashboard),
      family: canonical.family,
      primaryGuardian: canonical.primaryGuardian,
      secondaryGuardians: canonical.secondaryGuardians,
      guardianStudentAccess: canonical.guardianStudentAccess,
      sessionContext: this.buildSessionContext(actor, student, canonical),
      evolution,
      interventions,
      motivation,
      dailyPlan,
      billing,
      growth,
      insights,
    };
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
      learningMemory: StudentLearningMemory;
      subjectMemories: MentoriaStudentSubjectMemory[];
      dailyClosure: MentoriaDailyClosureSummary | null;
      guardianHooks: MentoriaGuardianHookEvent[];
      exercises: MentoriaExercise[];
      behavioralRollout: BehavioralEngineRolloutMode;
      behavioralShadow: BehavioralShadowComparison;
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
    const subjectMemories = await this.repository.listStudentSubjectMemories(actor.tenantId, dashboard.student.id);
    const memory = buildStudentMemorySummary({
      evolution: dashboard.evolution,
      progress: dashboard.progress,
      dailyPlan: dashboard.dailyPlan,
      subjectMemories,
    });
    const learningMemory = await this.ensureLearningMemoryProfile(actor.tenantId, dashboard.student, {
      evolution: dashboard.evolution,
      progress: dashboard.progress,
      subjects: dashboard.subjects,
      studentSubjects: dashboard.studentSubjects,
      recentSessions: dashboard.recentSessions,
    });
    const entry = buildWorkspaceEntry({
      student: dashboard.student,
      subjects: dashboard.subjects.filter((subject) => dashboard.studentSubjects.some((item) => item.subjectId === subject.id)),
      progress: dashboard.progress,
      dailyPlan: dashboard.dailyPlan,
      memory,
      subjectMemories,
      analysis,
    });
    const events = await listEventsForUser(actor.userId, 50);
    const dailyClosure = buildDailyClosureSummary({
      student: dashboard.student,
      progress: dashboard.progress,
      dailyPlan: dashboard.dailyPlan,
      motivation: dashboard.motivation,
      recentSessions: dashboard.recentSessions,
      focusSessions: dashboard.focusSessions,
      events,
      todayIso: new Date().toISOString().slice(0, 10),
    });
    const guardianHooks = buildGuardianHookEvents({
      student: dashboard.student,
      progress: dashboard.progress,
      recentSessions: dashboard.recentSessions,
      focusSessions: dashboard.focusSessions,
      interventions: dashboard.interventions,
      events,
    });
    const exercises = await this.repository.listExercises(actor.tenantId, dashboard.student.id);
    const behavioralRollout = getMentoriaBehavioralEngineRollout();
    let behavioralShadow: BehavioralShadowComparison = {
      currentStrategy: "entry",
      shadowStrategy: "entry",
      diverged: false,
      currentAction: {
        strategy: "entry",
        title: "Empezar ahora",
        description: "Conviene entrar por el prompt ya preparado.",
        rationale: ["Shadow evaluation fallback."],
        confidence: 0,
        task: null,
        prompt: null,
      },
      shadowAction: {
        strategy: "entry",
        title: "Empezar ahora",
        description: "Conviene entrar por el prompt ya preparado.",
        rationale: ["Shadow evaluation fallback."],
        confidence: 0,
        task: null,
        prompt: null,
      },
      loggedAt: new Date().toISOString(),
    };

    try {
      behavioralShadow = runMentoriaBehavioralShadow({
        actor: {
          userId: actor.userId,
          tenantId: actor.tenantId,
        },
        student: dashboard.student,
        dailyPlan: dashboard.dailyPlan,
        motivation: dashboard.motivation,
        recentSessions: dashboard.recentSessions,
        entry,
        dailyClosure,
        evolution: dashboard.evolution,
      });
    } catch (error) {
      console.warn("[BehavioralEngineShadow] Unable to evaluate mentoria rollout shadow", {
        tenantId: actor.tenantId,
        userId: actor.userId,
        behavioralRollout,
        reason: error instanceof Error ? error.message : "UNKNOWN",
      });
    }

    if (behavioralShadow.diverged) {
      console.warn("[BehavioralEngineShadow] Mentoria divergence detected", {
        tenantId: actor.tenantId,
        userId: actor.userId,
        behavioralRollout,
        currentStrategy: behavioralShadow.currentStrategy,
        shadowStrategy: behavioralShadow.shadowStrategy,
        currentTask: behavioralShadow.currentAction.task,
        shadowTask: behavioralShadow.shadowAction.task,
      });

      const shadowContext = await getUserContext(actor.userId);
      if (shadowContext) {
        await trackEvent(
          createMetricEvent({
            context: shadowContext,
            name: "behavioral_engine_shadow_divergence",
            type: "behavioral_engine_shadow_divergence",
            source: "mentoria.service.getWorkspaceExperience",
            metadata: {
              currentStrategy: behavioralShadow.currentStrategy,
              shadowStrategy: behavioralShadow.shadowStrategy,
              currentTaskType: behavioralShadow.currentAction.task?.type ?? null,
              shadowTaskType: behavioralShadow.shadowAction.task?.type ?? null,
              currentTaskSubjectId: behavioralShadow.currentAction.task?.subjectId ?? null,
              shadowTaskSubjectId: behavioralShadow.shadowAction.task?.subjectId ?? null,
            },
          }),
        );
      }
    }

    return {
      ...dashboard,
      analysis,
      entry,
      memory,
      learningMemory,
      subjectMemories,
      dailyClosure,
      guardianHooks,
      exercises,
      behavioralRollout,
      behavioralShadow,
    };
  }

  async saveFamilyGuardiansProfile(
    actor: MentoriaSessionActor,
    profile: MentoriaFamilyProfileInput,
  ) {
    const student = await this.requireOnboardedStudent(actor);
    return this.syncCanonicalGuardiansFromProfile(actor, student, profile);
  }

  private async trackDailyClosureSnapshot(input: {
    actor: MentoriaSessionActor;
    student: StudentProfile;
    progress: MentoriaProgress[];
    motivation: MotivationState;
    dailyPlan: DailyPlan;
    context: UserContext;
    recentSessions?: LearningSession[];
    focusSessions?: FocusSession[];
  }): Promise<MentoriaDailyClosureSummary | null> {
    const recentSessions = input.recentSessions ?? (await this.repository.listLearningSessions(input.actor.tenantId, input.student.id));
    const focusSessions = input.focusSessions ?? (await this.repository.listFocusSessions(input.actor.tenantId, input.student.id));
    const summary = buildDailyClosureSummary({
      student: input.student,
      progress: input.progress,
      dailyPlan: input.dailyPlan,
      motivation: input.motivation,
      recentSessions,
      focusSessions,
      todayIso: new Date().toISOString().slice(0, 10),
    });
    if (!summary) {
      return null;
    }
    await trackEvent(
      createMetricEvent({
        context: input.context,
        name: "mentoria_daily_closure",
        type: "mentoria_daily_closure",
        source: "mentoria.service.trackDailyClosureSnapshot",
        metadata: summary,
      }),
    );
    return summary;
  }

  async startGuidedSession(actor: MentoriaSessionActor, payload: {
    subjectSlug?: string;
    topic?: string;
    message: string;
    sessionId?: string;
    entryMode?: MentoriaEntryMode;
    sessionMode?: MentoriaSessionMode;
    sessionInputKind?: MentoriaSessionInputKind;
    sessionSignal?: MentoriaStudentSessionSignal;
  }): Promise<{
    session: Awaited<ReturnType<MentoriaRepository["createLearningSession"]>>;
    subject: MentoriaSubject;
    adaptation: ReturnType<typeof evaluateStudentEmotion>;
    reply: string;
    explanation: string;
    suggestedSteps: string[];
    reinforcementQuestion: string;
    sessionMode: MentoriaSessionMode;
    sessionInputKind: MentoriaSessionInputKind;
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
    
    // ATOMIC TRIAL ENFORCEMENT: Get trial + billing in single batch to prevent race condition
    const orchestrator = getMentoriaOrchestrator();
    const [billing, isTrialActive, daysRemaining] = await Promise.all([
      this.getBillingSummary({ tenantId: actor.tenantId, canManageBilling: this.canManageBilling(actor) }, student),
      this.trialManager.isTrialActive(actor.tenantId, student.id),
      this.trialManager.getTrialDaysRemaining(actor.tenantId, student.id),
    ]);
    
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
    const [evolution, progress, recentSessions, studentSubjects, subjects, canonicalFamily] = await Promise.all([
      this.ensureEvolutionProfile(actor.tenantId, student),
      this.repository.listProgress(actor.tenantId, student.id),
      this.repository.listLearningSessions(actor.tenantId, student.id),
      this.repository.listStudentSubjects(actor.tenantId, student.id),
      this.repository.listSubjects(actor.tenantId),
      this.getCanonicalFamilyContract(actor, student).catch(() => null),
    ]);
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, student, evolution, interventions);
    const learningMemory = await this.ensureLearningMemoryProfile(actor.tenantId, student, {
      evolution,
      progress,
      subjects,
      studentSubjects,
      recentSessions,
    });
    const dailyPlan = await this.ensureDailyPlan(actor.tenantId, student, { evolution, interventions, motivation, progress, learningMemory });
    const enabledSubjectIds = new Set(studentSubjects.map((item) => item.subjectId));
    const availableSubjects = subjects.filter((subject) => enabledSubjectIds.has(subject.id));
    const signalInstruction = buildSessionSignalInstruction(payload.sessionSignal);
    const effectiveStudentMessage = [signalInstruction, payload.message].filter(Boolean).join(" ").trim();
    const subjectSelection = inferSubjectAndTopic({
      requestedSubjectSlug: payload.subjectSlug,
      topic: payload.topic,
      message: effectiveStudentMessage,
      subjects: availableSubjects,
      dailyPlan,
      evolution,
    });
    const subject = subjectSelection.subject;
    const resolvedTopic = subjectSelection.topic;
    const current = progress.find((item) => item.subjectId === subject.id);
    const subjectMemories = await this.repository.listStudentSubjectMemories(actor.tenantId, student.id);
    const dynamicProfile = buildDynamicStudentProfile({
      student,
      studentSubjects,
      progress,
      evolution,
      learningMemory,
      subjectMemories,
      guardianStudentAccess: canonicalFamily?.guardianStudentAccess ?? [],
      activeSubjectSlug: subject.slug,
      activeTopic: resolvedTopic,
    });
    const tutorPolicy = buildTutorBehaviorPolicy(dynamicProfile);
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
        studentMessage: effectiveStudentMessage,
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
        dynamicProfile,
        learningMemory,
        tutorPolicy,
      },
      metadata: {
        product: "mentoria",
        subjectId: subject.id,
        dynamicTone: tutorPolicy.tone,
        dynamicDifficulty: tutorPolicy.difficulty,
        dynamicPace: tutorPolicy.pace,
        memoryStyle: learningMemory.preferredExplanationStyle,
        memoryBestSessionLength: learningMemory.bestSessionLength,
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
        dynamicTone: tutorPolicy.tone,
        dynamicDifficulty: tutorPolicy.difficulty,
        dynamicPace: tutorPolicy.pace,
        memoryStyle: learningMemory.preferredExplanationStyle,
      },
    });

    const adaptiveContext = this.getAdaptiveContext(billing, interventions, motivation);
    const adaptation = evaluateStudentEmotion({
      message: effectiveStudentMessage,
      profile: student,
      evolution,
      subjectName: subject.name,
      interventions: adaptiveContext.interventions,
      motivation: adaptiveContext.motivation,
    });
    const entryModeAdjustments = getTutorEntryModeAdjustments(payload.entryMode);
    const signalBaseSessionMode = payload.sessionSignal
      ? resolveSessionModeFromSignal(payload.sessionSignal, {
          hasActiveTask: dailyPlan.tasks.some((task) => !task.completed),
          recentActivityLabel: recentSessions[0]?.updatedAt ? "hoy" : null,
        })
      : null;
    const baseSessionMode = resolveMentoriaSessionMode({
      student,
      dailyPlan,
      latestSession: recentSessions[0] ?? null,
      selectedSubject: studentSubjects.find((item) => item.subjectId === subject.id) ?? null,
      activeTask: dailyPlan.tasks.find((task) => task.subjectId === subject.id && !task.completed) ?? dailyPlan.tasks.find((task) => !task.completed) ?? null,
      currentTopic: payload.topic ?? subjectSelection.topic,
      currentMessage: effectiveStudentMessage,
      stateLabel: adaptiveContext.interventions[0]?.summary ?? motivation.motivationProfile ?? null,
      suggestedInputKind: payload.sessionInputKind ?? (payload.sessionSignal ? resolveSessionInputKindFromSignal(payload.sessionSignal) : null),
    });
    const resolvedSessionMode = payload.sessionMode ?? resolveSessionModeFromProfile(dynamicProfile, signalBaseSessionMode ?? baseSessionMode);
    const fallbackInputKind: MentoriaSessionInputKind = resolvedSessionMode === "exam_preparation"
      ? "exam_photo"
      : resolvedSessionMode === "study_routine"
        ? "family_routine"
        : resolvedSessionMode === "soft_reentry"
          ? "student_state_signal"
          : payload.entryMode === "resume_session"
            ? "recent_session"
            : payload.entryMode === "plan_task"
              ? "family_routine"
              : "free_message";
    const resolvedSessionInputKind = payload.sessionInputKind ?? (payload.sessionSignal ? resolveSessionInputKindFromSignal(payload.sessionSignal) : fallbackInputKind);
    const sessionContract = buildMentoriaSessionContract(resolvedSessionMode, resolvedSessionInputKind);
    const profileAdaptation = applyTutorBehaviorPolicy(adaptation, tutorPolicy);
    const adaptedEntry = {
      ...profileAdaptation,
      explanationDepth: entryModeAdjustments.explanationDepth ?? profileAdaptation.explanationDepth,
      difficultyAdjustment: entryModeAdjustments.difficultyAdjustment ?? profileAdaptation.difficultyAdjustment,
      tutorInstruction: [
        profileAdaptation.tutorInstruction,
        entryModeAdjustments.tutorInstruction,
        getTutorModeInstruction(resolvedSessionMode, sessionContract.headline),
      ].filter(Boolean).join(" ").trim(),
    };
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
      dynamicProfile?: DynamicStudentProfile;
      learningMemory?: StudentLearningMemory;
      tutorPolicy?: TutorBehaviorPolicy;
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
          adaptation: adaptedEntry,
          interventions: adaptiveContext.interventions,
          motivation: adaptiveContext.motivation,
          dynamicProfile,
          learningMemory,
          tutorPolicy,
          history,
        },
      },
    );
    await trackEvent(sessionMetric);

    // ATOMIC TRIAL ENFORCEMENT: Re-verify trial status immediately before session creation
    // This prevents race condition where trial expires between initial check and session creation
    const finalTrialCheck = await this.trialManager.isTrialActive(actor.tenantId, student.id);
    const finalBillingCheck = await this.getBillingSummary({ tenantId: actor.tenantId, canManageBilling: this.canManageBilling(actor) }, student);
    
    // If trial or billing status changed, reject session creation
    if (isTrialActive !== finalTrialCheck || billing.planCode !== finalBillingCheck.planCode) {
      throw new UpgradeFlowError(
        "trial_expired",
        "Tu estado de acceso cambió durante la sesión. Por favor, intenta de nuevo."
      );
    }

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
        studentMessage: effectiveStudentMessage,
        tutorReply: tutorResponse.reply,
        progress: current,
      }),
    );
    const updatedDynamicProfile = updateDynamicStudentProfile(dynamicProfile, {
      kind: "session",
      emotionalState: session.emotionalState,
      totalAnswers: tutorResponse.output.reinforcementQuestion ? 1 : 0,
      correctAnswers: adaptation.emotionalState === "confident" || adaptation.emotionalState === "steady" ? 1 : 0,
      abandoned: false,
      responseSpeed: session.durationMinutes <= 10 ? "fast" : session.durationMinutes >= 24 ? "slow" : "medium",
    });
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
    const updatedSubjectProgress = updatedProgress.find((item) => item.subjectId === subject.id) ?? current ?? null;
    const updatedLearningMemory = await this.repository.saveStudentLearningMemory(
      actor.tenantId,
      updateStudentLearningMemory(learningMemory, {
        kind: "guided_session",
        subject,
        session,
        studentMessage: effectiveStudentMessage,
        tutorReply: tutorResponse.reply,
        progress: updatedSubjectProgress,
        allProgress: updatedProgress,
        evolution: syncedEvolution,
        dynamicProfile: updatedDynamicProfile,
        tutorPolicy,
        happenedAt: session.createdAt,
      }),
    );
    const sessionConceptKey = buildStudentSubjectMemoryEventConcept({
      subject,
      topic: resolvedTopic,
      studentText: effectiveStudentMessage,
    });
    const currentSubjectMemory = await this.repository.getStudentSubjectMemory(actor.tenantId, student.id, subject.slug, sessionConceptKey);
    const updatedSubjectMemory = await this.repository.saveStudentSubjectMemory(
      actor.tenantId,
      updateStudentSubjectMemory(currentSubjectMemory, {
        kind: "guided_session",
        studentId: student.id,
        tenantId: actor.tenantId,
        subject,
        topic: resolvedTopic,
        studentText: effectiveStudentMessage,
        tutorReply: tutorResponse.reply,
        tutorPolicy,
        dynamicProfile: updatedDynamicProfile,
        success: adaptation.emotionalState === "confident" || adaptation.emotionalState === "steady",
        happenedAt: session.createdAt,
      }),
    );
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
        learningMemory: updatedLearningMemory,
      },
    );
    const refreshedDailyPlan = await this.ensureDailyPlan(actor.tenantId, student, {
      progress: updatedProgress,
      evolution: syncedEvolution,
      interventions: syncedInterventions,
      motivation: savedMotivation,
      learningMemory: updatedLearningMemory,
    });
    const syncedContext = await this.syncUserContext(actor, student, {
      progress: updatedProgress,
      evolution: syncedEvolution,
      motivation: savedMotivation,
      dailyPlan: refreshedDailyPlan,
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
    await this.trackDailyClosureSnapshot({
      actor,
      student,
      progress: updatedProgress,
      motivation: savedMotivation,
      dailyPlan: refreshedDailyPlan,
      context: syncedContext,
      recentSessions: trackedSessions,
    });
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

    await recordCampamentoEvent({
      tenantId: actor.tenantId,
      type: "mentoria.session.completed",
      severity: "INFO",
      source: "mentoria.session",
      message: "Learning session completed",
      metadata: {
        studentId: student.id,
        subjectId: subject.id,
        topic: resolvedTopic,
        durationMinutes: session.durationMinutes ?? null,
        aiTokensUsed: tutorResponse.usage?.tokens ?? 0,
        emotionalState: adaptation.emotionalState,
        dynamicProfile: {
          comprehensionLevel: updatedDynamicProfile.cognitive.comprehensionLevel,
          frustrationLevel: updatedDynamicProfile.emotional.frustrationLevel,
          confidenceLevel: updatedDynamicProfile.emotional.confidenceLevel,
          consistency: updatedDynamicProfile.emotional.consistency,
        },
        learningMemory: {
          preferredExplanationStyle: updatedLearningMemory.preferredExplanationStyle,
          confidenceTrend: updatedLearningMemory.confidenceTrend,
          frustrationTrend: updatedLearningMemory.frustrationTrend,
          consistencyTrend: updatedLearningMemory.consistencyTrend,
          activeConceptKey: updatedSubjectMemory.conceptKey,
          activeConceptMastery: updatedSubjectMemory.masteryLevel,
          activeConceptConfidence: updatedSubjectMemory.confidenceLevel,
          activeConceptNeedsReinforcement: updatedSubjectMemory.needsReinforcement,
          bestSessionLength: updatedLearningMemory.bestSessionLength,
          nextStart: updatedLearningMemory.lastAdaptationSummary.nextStart,
        },
      },
      correlationId: session.id,
    });

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
      studentName: student.name || student.fullName,
    });

    const completionMessage = buildSessionCompletionMessage(sessionFeedback, subject.name);

    // GUARANTEED NOTIFICATION DELIVERY: Via persistent queue with retry
    if (student.parentPhoneNumber) {
      await orchestrator.sendNotificationGuaranteed({
        tenantId: actor.tenantId,
        studentId: student.id,
        parentPhone: student.parentPhoneNumber,
        message: `Session completed: ${sessionSummary}`,
      });
    }

    // GUARANTEED FEEDBACK PERSISTENCE: Via persistent queue with retry
    await orchestrator.collectFeedbackGuaranteed({
      tenantId: actor.tenantId,
      studentId: student.id,
      sessionCount: (current?.sessionsCompleted ?? 0) + 1,
      liked: [],
      missing: [],
      wouldRecommend: sessionFeedback.scoreChange > 0,
    });

    // GUARANTEED ACQUISITION TRACKING: only when explicitly enabled and with a valid published post id
    const enableAcqTracking = process.env.MENTORIA_ENABLE_ACQUISITION_TRACKING === "1";
    const acqPostId = process.env.MENTORIA_ACQUISITION_POST_ID;
    if (enableAcqTracking && acqPostId && sessionFeedback.scoreChange > 0) {
      try {
        await orchestrator.trackAcquisitionTrialStart(actor.tenantId, acqPostId);
      } catch (error) {
        console.error("[SessionCompletion] Acquisition tracking failed:", error);
      }
    }

    return {
      session,
      subject,
      adaptation: adaptedEntry,
      reply: tutorResponse.reply,
      explanation: String(tutorResponse.output.explanation),
      suggestedSteps: Array.isArray(tutorResponse.output.suggestedSteps) ? tutorResponse.output.suggestedSteps.map((item) => String(item)) : [],
      reinforcementQuestion: String(tutorResponse.output.reinforcementQuestion),
      sessionMode: resolvedSessionMode,
      sessionInputKind: resolvedSessionInputKind,
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
    entryMode?: MentoriaEntryMode;
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
    const [evolution, progress, studentSubjects] = await Promise.all([
      this.ensureEvolutionProfile(actor.tenantId, student),
      this.repository.listProgress(actor.tenantId, student.id),
      this.repository.listStudentSubjects(actor.tenantId, student.id),
    ]);
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, student, evolution, interventions);
    const learningMemory = await this.ensureLearningMemoryProfile(actor.tenantId, student, {
      evolution,
      progress,
      subjects: [subject],
      studentSubjects,
    });
    const dailyPlan = await this.ensureDailyPlan(actor.tenantId, student, { evolution, interventions, motivation, progress, learningMemory });
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
        entryMode: payload.entryMode,
        promptInstruction: "",
        evolution,
        interventions: [],
        motivation,
        dailyPlan,
        billing,
        learningMemory,
      },
      metadata: {
        product: "mentoria",
        subjectId: subject.id,
      },
    });
    const adaptiveContext = this.getAdaptiveContext(billing, interventions, motivation);
    const entryModeAdjustments = getExerciseEntryModeAdjustments(payload.entryMode);
    const generated = await executeAgent<
      {
        profile: StudentProfile;
        subject: MentoriaSubject;
        topic: string;
        difficultyLevel: string;
        entryMode?: MentoriaEntryMode;
        promptInstruction?: string;
        evolution: StudentEvolutionProfile;
        interventions: MentoriaIntervention[];
        motivation: MotivationState;
        dailyPlan: DailyPlan;
        billing: MentoriaBillingSummary;
        learningMemory?: StudentLearningMemory;
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
        difficultyLevel: entryModeAdjustments.difficultyLevel ?? exerciseTask.input.difficultyLevel,
        entryMode: payload.entryMode,
        promptInstruction: entryModeAdjustments.promptInstruction,
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
    const studentSubjects = await this.repository.listStudentSubjects(actor.tenantId, student.id);
    const interventions = await this.syncInterventions(actor.tenantId, student.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, student, evolution, interventions);
    const learningMemory = await this.ensureLearningMemoryProfile(actor.tenantId, student, {
      evolution,
      progress,
      subjects: [subject],
      studentSubjects,
    });
    const subjectMemories = await this.repository.listStudentSubjectMemories(actor.tenantId, student.id);
    const current = progress.find((item) => item.subjectId === subject.id);
    await this.ensureDailyPlan(actor.tenantId, student, { evolution, interventions, motivation, progress, learningMemory });
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
    const updatedSubjectProgress = updatedProgress.find((item) => item.subjectId === subject.id) ?? current ?? null;
    const exerciseDynamicProfile = buildDynamicStudentProfile({
      student,
      studentSubjects,
      progress: updatedProgress,
      evolution: syncedEvolution,
      learningMemory,
      subjectMemories,
      activeSubjectSlug: subject.slug,
      activeTopic: exercise.expectedCompetency,
    });
    const updatedLearningMemory = await this.repository.saveStudentLearningMemory(
      actor.tenantId,
      updateStudentLearningMemory(learningMemory, {
        kind: "exercise",
        subject,
        exercise: saved,
        score: correction.score,
        studentMessage: payload.studentAnswer,
        correctionFeedback: correction.feedback,
        progress: updatedSubjectProgress,
        allProgress: updatedProgress,
        evolution: syncedEvolution,
        dynamicProfile: exerciseDynamicProfile,
        happenedAt: saved.updatedAt,
      }),
    );
    const exerciseConceptKey = buildStudentSubjectMemoryEventConcept({
      subject,
      topic: exercise.expectedCompetency,
      expectedCompetency: exercise.expectedCompetency,
      studentText: payload.studentAnswer,
    });
    const currentExerciseSubjectMemory = await this.repository.getStudentSubjectMemory(actor.tenantId, student.id, subject.slug, exerciseConceptKey);
    const updatedSubjectMemory = await this.repository.saveStudentSubjectMemory(
      actor.tenantId,
      updateStudentSubjectMemory(currentExerciseSubjectMemory, {
        kind: correction.score >= 85 ? "microevaluation" : correction.score >= 70 ? "practice" : "reinforcement",
        studentId: student.id,
        tenantId: actor.tenantId,
        subject,
        topic: exercise.expectedCompetency,
        expectedCompetency: exercise.expectedCompetency,
        studentText: payload.studentAnswer,
        correctionFeedback: correction.feedback,
        score: correction.score,
        dynamicProfile: exerciseDynamicProfile,
        success: correction.score >= 78,
        happenedAt: saved.updatedAt,
      }),
    );
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
        learningMemory: updatedLearningMemory,
      },
    );
    const refreshedDailyPlan = await this.ensureDailyPlan(actor.tenantId, student, {
      progress: updatedProgress,
      evolution: syncedEvolution,
      interventions: syncedInterventions,
      motivation: savedMotivation,
      learningMemory: updatedLearningMemory,
    });
    const syncedContext = await this.syncUserContext(actor, student, {
      progress: updatedProgress,
      evolution: syncedEvolution,
      motivation: savedMotivation,
      dailyPlan: refreshedDailyPlan,
      lastSubject: subject,
    });
    await this.trackDailyClosureSnapshot({
      actor,
      student,
      progress: updatedProgress,
      motivation: savedMotivation,
      dailyPlan: refreshedDailyPlan,
      context: syncedContext,
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
          memoryStyle: updatedLearningMemory.preferredExplanationStyle,
          memoryNextStart: updatedLearningMemory.lastAdaptationSummary.nextStart,
          conceptKey: updatedSubjectMemory.conceptKey,
          conceptMastery: updatedSubjectMemory.masteryLevel,
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
          confidenceTrend: updatedLearningMemory.confidenceTrend,
          frustrationTrend: updatedLearningMemory.frustrationTrend,
          conceptKey: updatedSubjectMemory.conceptKey,
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
    const canonical = await this.getCanonicalFamilyContract(actor, targetStudent);
    const evolution = await this.ensureEvolutionProfile(actor.tenantId, targetStudent);
    const interventions = await this.syncInterventions(actor.tenantId, targetStudent.id, evolution);
    const motivation = await this.ensureMotivationState(actor.tenantId, targetStudent, evolution, interventions);
    await this.ensureDailyPlan(actor.tenantId, targetStudent, { force: true, evolution, interventions, motivation });
    return this.buildPlanForStudent(actor.tenantId, targetStudent, canonical.guardianStudentAccess);
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
      const updatedProgress = await this.repository.listProgress(actor.tenantId, student.id);
      const refreshedDailyPlan = await this.ensureDailyPlan(actor.tenantId, student, {
        progress: updatedProgress,
        evolution: updatedEvolution,
        interventions: syncedInterventions,
        motivation: savedMotivation,
      });
      const syncedContext = await this.syncUserContext(actor, student, {
        progress: updatedProgress,
        evolution: updatedEvolution,
        motivation: savedMotivation,
        dailyPlan: refreshedDailyPlan,
      });
      await this.trackDailyClosureSnapshot({
        actor,
        student,
        progress: updatedProgress,
        motivation: savedMotivation,
        dailyPlan: refreshedDailyPlan,
        context: syncedContext,
        focusSessions: [focusSession],
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

