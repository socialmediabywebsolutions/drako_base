import type { TutorBehaviorPolicy } from "@/lib/mentoria/profile-engine";
import type { DynamicStudentProfile } from "@/lib/mentoria/student-profile";
import {
  createInitialStudentSubjectMemory,
  deriveSupportStyleFromPolicy,
  humanizeConceptKey,
  inferConceptKey,
  inferLastErrorType,
  scoreToMastery,
  type InferConceptKeyInput,
} from "@/lib/mentoria/student-subject-memory";
import type {
  MentoriaConceptConfidenceLevel,
  MentoriaConceptInternalSummary,
  MentoriaConceptMasteryLevel,
  MentoriaStudentSubjectMemory,
  MentoriaSubject,
} from "@/lib/mentoria/types";

export type StudentSubjectMemoryEventKind =
  | "guided_session"
  | "exercise_correction"
  | "practice"
  | "microevaluation"
  | "reinforcement";

export type StudentSubjectMemoryEvent = {
  kind: StudentSubjectMemoryEventKind;
  studentId: string;
  tenantId?: string;
  subject: MentoriaSubject;
  topic?: string | null;
  expectedCompetency?: string | null;
  studentText?: string | null;
  tutorReply?: string | null;
  correctionFeedback?: string | null;
  score?: number | null;
  success?: boolean | null;
  tutorPolicy?: TutorBehaviorPolicy | null;
  dynamicProfile?: DynamicStudentProfile | null;
  happenedAt?: string | null;
};

export type StudentSubjectMemoryInsight = {
  conceptKey: string;
  shouldExplainFromScratch: boolean;
  shouldUseVisualSteps: boolean;
  shouldUseSimpleExampleFirst: boolean;
  shouldReinforceBeforeContinuing: boolean;
  recommendedStage: "guided_practice" | "reinforcement" | "light_evaluation";
  shouldLowerLevel: boolean;
  rationale: string[];
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function isSuccess(event: StudentSubjectMemoryEvent): boolean {
  if (typeof event.success === "boolean") return event.success;
  if (typeof event.score === "number") return event.score >= 78;
  const profileConfidence = event.dynamicProfile?.emotional.confidenceLevel;
  const frustration = event.dynamicProfile?.emotional.frustrationLevel;
  return profileConfidence === "high" && frustration !== "high";
}

function hadStrongFriction(event: StudentSubjectMemoryEvent): boolean {
  if (typeof event.score === "number") return event.score < 62;
  return event.dynamicProfile?.emotional.frustrationLevel === "high" || event.dynamicProfile?.cognitive.comprehensionLevel === "low";
}

function deriveConfidenceLevel(score: number, memory: MentoriaStudentSubjectMemory): MentoriaConceptConfidenceLevel {
  if (score >= 2.45) return "high";
  if (score >= 1.35) return "medium";
  return memory.recurrenceCount >= 3 ? "low" : "medium";
}

function buildEvidenceSummary(input: {
  memory: MentoriaStudentSubjectMemory;
  supportStyle: MentoriaStudentSubjectMemory["preferredSupportStyle"];
  success: boolean;
  errorType: string | null;
  topic?: string | null;
  score?: number | null;
}): string {
  const conceptLabel = humanizeConceptKey(input.memory.conceptKey);
  const scoreLabel = typeof input.score === "number" ? ` puntuacion ${Math.round(input.score)}%.` : "";
  if (input.success) {
    return `${conceptLabel}: funciono ${input.supportStyle.replace(/_/g, " ")}${input.topic ? ` en ${input.topic}` : ""}.${scoreLabel}`.trim();
  }
  return `${conceptLabel}: persiste ${input.errorType ?? "error conceptual"}; conviene ${input.supportStyle.replace(/_/g, " ")}${input.topic ? ` en ${input.topic}` : ""}.${scoreLabel}`.trim();
}

function buildInternalSummary(input: {
  memory: MentoriaStudentSubjectMemory;
  supportStyle: MentoriaStudentSubjectMemory["preferredSupportStyle"];
  success: boolean;
  errorType: string | null;
  score?: number | null;
  eventKind: StudentSubjectMemoryEventKind;
}): MentoriaConceptInternalSummary {
  return {
    conceptWorked: humanizeConceptKey(input.memory.conceptKey),
    errorDetected: input.success ? null : input.errorType,
    interventionThatWorked: input.success ? input.supportStyle.replace(/_/g, " ") : input.memory.internalSummary.interventionThatWorked,
    revisitSoon: !input.success || input.eventKind === "reinforcement" || (typeof input.score === "number" && input.score < 85),
  };
}

export function buildStudentSubjectMemoryEventConcept(input: Pick<StudentSubjectMemoryEvent, "subject" | "topic" | "expectedCompetency" | "studentText">): string {
  return inferConceptKey({
    subjectSlug: input.subject.slug,
    topic: input.topic,
    expectedCompetency: input.expectedCompetency,
    text: input.studentText,
  });
}

export function updateStudentSubjectMemory(
  current: MentoriaStudentSubjectMemory | null,
  event: StudentSubjectMemoryEvent,
): MentoriaStudentSubjectMemory {
  const conceptKey = inferConceptKey({
    subjectSlug: event.subject.slug,
    topic: event.topic,
    expectedCompetency: event.expectedCompetency,
    text: event.studentText,
  } satisfies InferConceptKeyInput);
  const happenedAt = event.happenedAt ?? new Date().toISOString();
  const memory = current ?? createInitialStudentSubjectMemory({
    studentId: event.studentId,
    tenantId: event.tenantId,
    subjectSlug: event.subject.slug,
    conceptKey,
    happenedAt,
    errorType: inferLastErrorType({
      conceptKey,
      correctionFeedback: event.correctionFeedback,
      studentText: event.studentText,
      subjectSlug: event.subject.slug,
    }),
  });

  const success = isSuccess(event);
  const strongFriction = hadStrongFriction(event);
  const supportStyle = deriveSupportStyleFromPolicy({
    previous: memory.preferredSupportStyle,
    tutorExampleUse: event.tutorPolicy?.exampleUse ?? null,
    tutorDetailLevel: event.tutorPolicy?.detailLevel ?? null,
    tutorStage: event.tutorPolicy?.sessionStage ?? null,
    tutorDifficulty: event.tutorPolicy?.difficulty ?? null,
    tutorReply: event.tutorReply ?? event.correctionFeedback ?? null,
    success,
  });
  const errorType = success
    ? null
    : inferLastErrorType({
        conceptKey: memory.conceptKey,
        correctionFeedback: event.correctionFeedback,
        studentText: event.studentText,
        subjectSlug: event.subject.slug,
      });

  const previousMasteryScore = memory.masteryLevel === "mastered"
    ? 3
    : memory.masteryLevel === "secure"
      ? 2
      : memory.masteryLevel === "developing"
        ? 1
        : 0;
  const masteryDelta = success
    ? event.kind === "microevaluation"
      ? 1.1
      : 0.8
    : strongFriction
      ? -0.9
      : -0.45;
  const masteryScore = clamp(previousMasteryScore + masteryDelta, 0, 3);
  const masteryLevel: MentoriaConceptMasteryLevel = scoreToMastery(masteryScore);

  const recurrenceCount = success
    ? memory.recurrenceCount > 0 && masteryLevel !== "fragile"
      ? Math.max(0, memory.recurrenceCount - 1)
      : memory.recurrenceCount
    : memory.recurrenceCount + 1;

  const confidenceSignal = typeof event.score === "number"
    ? event.score / 100
    : success
      ? 0.76
      : strongFriction
        ? 0.22
        : 0.45;
  const confidenceLevel = deriveConfidenceLevel(confidenceSignal * 3, {
    ...memory,
    recurrenceCount,
  });
  const wasPreviouslySolid = memory.masteryLevel === "secure" || memory.masteryLevel === "mastered";
  const needsReinforcement = !success || recurrenceCount >= 2 || (wasPreviouslySolid && masteryLevel !== "secure");
  const evidenceSummary = buildEvidenceSummary({
    memory,
    supportStyle,
    success,
    errorType,
    topic: event.topic,
    score: event.score,
  });
  const internalSummary = buildInternalSummary({
    memory,
    supportStyle,
    success,
    errorType,
    score: event.score,
    eventKind: event.kind,
  });

  return {
    ...memory,
    tenantId: event.tenantId ?? memory.tenantId,
    studentId: event.studentId,
    subjectSlug: event.subject.slug,
    conceptKey,
    confidenceLevel,
    masteryLevel,
    recurrenceCount,
    lastErrorType: errorType,
    preferredSupportStyle: success ? supportStyle : memory.preferredSupportStyle !== supportStyle ? supportStyle : memory.preferredSupportStyle,
    lastWorkedAt: happenedAt,
    needsReinforcement,
    evidenceSummary,
    internalSummary,
    updatedAt: happenedAt,
  };
}

export function buildStudentSubjectMemoryInsight(memory: MentoriaStudentSubjectMemory | null | undefined): StudentSubjectMemoryInsight | null {
  if (!memory) return null;
  const rationale: string[] = [];
  const weak = memory.masteryLevel === "fragile" || memory.masteryLevel === "developing";
  const repeated = memory.recurrenceCount >= 2;
  const visual = memory.preferredSupportStyle === "visual_steps";
  const simpleExample = memory.preferredSupportStyle === "concrete_example" || repeated;
  const shouldReinforce = memory.needsReinforcement || repeated;
  const shouldLowerLevel = weak && repeated;
  const shouldExplainFromScratch = weak || memory.lastErrorType !== null;
  const recommendedStage = shouldReinforce
    ? "reinforcement"
    : memory.masteryLevel === "secure" || memory.masteryLevel === "mastered"
      ? "light_evaluation"
      : "guided_practice";

  if (shouldExplainFromScratch) rationale.push("Hay fragilidad conceptual activa.");
  if (repeated) rationale.push(`Se repitio el error ${memory.recurrenceCount} veces.`);
  if (visual) rationale.push("La memoria didactica favorece pasos visuales.");
  if (memory.lastErrorType) rationale.push(`Ultimo patron: ${memory.lastErrorType}.`);
  if (memory.needsReinforcement) rationale.push("Conviene recuperar este concepto antes de subir carga.");

  return {
    conceptKey: memory.conceptKey,
    shouldExplainFromScratch,
    shouldUseVisualSteps: visual,
    shouldUseSimpleExampleFirst: simpleExample,
    shouldReinforceBeforeContinuing: shouldReinforce,
    recommendedStage,
    shouldLowerLevel,
    rationale,
  };
}
