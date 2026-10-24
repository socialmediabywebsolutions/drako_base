import type { TutorBehaviorPolicy } from "@/lib/mentoria/profile-engine";
import type { DynamicStudentProfile } from "@/lib/mentoria/student-profile";
import {
  getSessionTimeWindow,
  scoreTrend,
  type StudentExplanationStyle,
  type StudentLearningMemory,
  type StudentLearningMemoryLastAdaptationSummary,
  type StudentMotivationPattern,
  type StudentSessionTimeWindow,
} from "@/lib/mentoria/student-learning-memory";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DailyPlan, LearningSession, MentoriaExercise, MentoriaProgress, MentoriaSubject } from "@/lib/mentoria/types";

export type StudentLearningMemoryEvent = {
  kind: "guided_session" | "exercise";
  subject: MentoriaSubject;
  session?: LearningSession | null;
  exercise?: MentoriaExercise | null;
  score?: number | null;
  studentMessage?: string | null;
  tutorReply?: string | null;
  correctionFeedback?: string | null;
  progress?: MentoriaProgress | null;
  allProgress?: MentoriaProgress[];
  evolution?: StudentEvolutionProfile | null;
  dynamicProfile?: DynamicStudentProfile | null;
  tutorPolicy?: TutorBehaviorPolicy | null;
  abandoned?: boolean;
  happenedAt?: string | null;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function dedupe(values: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function eventSucceeded(event: StudentLearningMemoryEvent): boolean {
  if (typeof event.score === "number") return event.score >= 78;
  const emotionalState = event.session?.emotionalState;
  return emotionalState === "confident" || emotionalState === "steady";
}

function eventHadFriction(event: StudentLearningMemoryEvent): boolean {
  if (event.abandoned) return true;
  if (typeof event.score === "number") return event.score < 62;
  const emotionalState = event.session?.emotionalState;
  return emotionalState === "blocked" || emotionalState === "frustrated" || emotionalState === "demotivated";
}

function inferStyleFromEvent(event: StudentLearningMemoryEvent, memory: StudentLearningMemory): StudentExplanationStyle {
  const text = `${event.studentMessage ?? ""} ${event.tutorReply ?? ""} ${event.correctionFeedback ?? ""}`.toLowerCase();
  if (text.includes("dibuja") || text.includes("esquema") || text.includes("visual") || text.includes("grafico")) {
    return "visual_step_by_step";
  }
  if (event.tutorPolicy?.exampleUse === "challenge_example" || event.tutorPolicy?.difficulty === "up") {
    return "challenge_first";
  }
  if (event.tutorPolicy?.explanationLength === "short" || event.tutorPolicy?.detailLevel === "minimal") {
    return "short_guided";
  }
  if (event.tutorPolicy?.exampleUse === "concrete_first") {
    return "concrete_examples";
  }
  return memory.preferredExplanationStyle;
}

function incrementEvidence<T extends string>(
  evidence: Partial<Record<T, number>>,
  key: T,
  delta: number,
): Partial<Record<T, number>> {
  return {
    ...evidence,
    [key]: clamp((evidence[key] ?? 0) + delta, 0, 99),
  };
}

function strongestEvidence<T extends string>(
  evidence: Partial<Record<T, number>>,
  fallback: T,
): T {
  return (Object.entries(evidence).sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] as T | undefined) ?? fallback;
}

function updateSubjects(memory: StudentLearningMemory, event: StudentLearningMemoryEvent): {
  strongestSubjects: string[];
  weakestSubjects: string[];
} {
  const subjectName = event.subject.name || event.subject.slug;
  const progressStrong = (event.allProgress ?? [])
    .filter((item) => item.masteryScore >= 78 || item.confidenceScore >= 74)
    .flatMap((item) => [item.subject?.name, ...item.strongTopics]);
  const progressWeak = (event.allProgress ?? [])
    .filter((item) => item.masteryScore < 62 || item.confidenceScore < 58)
    .flatMap((item) => [item.subject?.name, ...item.weakTopics]);

  const strongestSubjects = eventSucceeded(event)
    ? dedupe([subjectName, event.exercise?.expectedCompetency, ...progressStrong, ...memory.strongestSubjects], 8)
    : dedupe([...progressStrong, ...memory.strongestSubjects], 8);
  const weakestSubjects = eventHadFriction(event)
    ? dedupe([subjectName, event.exercise?.expectedCompetency, ...progressWeak, ...memory.weakestSubjects], 8)
    : dedupe([...progressWeak, ...memory.weakestSubjects.filter((item) => item.toLowerCase() !== subjectName.toLowerCase())], 8);

  return { strongestSubjects, weakestSubjects };
}

function updateBestSessionLength(memory: StudentLearningMemory, event: StudentLearningMemoryEvent): number {
  const duration = event.session?.durationMinutes ?? null;
  if (event.abandoned && duration !== null && duration >= memory.bestSessionLength) {
    return clamp(memory.bestSessionLength - 5, 8, 32);
  }
  if (eventHadFriction(event) && duration !== null && duration >= 22) {
    return clamp(memory.bestSessionLength - 3, 8, 32);
  }
  if (eventSucceeded(event) && duration !== null) {
    const blended = memory.bestSessionLength * 0.72 + duration * 0.28;
    return clamp(Math.round(blended), 8, 32);
  }
  return memory.bestSessionLength;
}

function updateMotivationPattern(memory: StudentLearningMemory, event: StudentLearningMemoryEvent): StudentMotivationPattern {
  if (event.abandoned) return "avoidant";
  if (event.evolution && event.evolution.frustrationLevel >= 0.72 && event.evolution.consistencyScore <= 0.42) return "fragile";
  if (event.evolution && event.evolution.progressionVelocity >= 0.74 && event.evolution.consistencyScore >= 0.62) return "momentum";
  if (event.evolution && event.evolution.consistencyScore <= 0.36) return "bursty";
  if (eventSucceeded(event) && memory.motivationPattern === "fragile") return "steady";
  return memory.motivationPattern;
}

function buildAdaptationSummary(
  memory: StudentLearningMemory,
  event: StudentLearningMemoryEvent,
  preferredStyle: StudentExplanationStyle,
  bestSessionLength: number,
): StudentLearningMemoryLastAdaptationSummary {
  const subjectName = event.subject.name || event.subject.slug;
  const worked = eventSucceeded(event)
    ? `Funciono ${preferredStyle.replaceAll("_", " ")} en ${subjectName}.`
    : memory.lastAdaptationSummary.worked;
  const friction = eventHadFriction(event)
    ? `Hubo friccion en ${subjectName}; conviene bajar carga y comprobar antes de avanzar.`
    : "Sin friccion fuerte en la ultima actividad.";
  const nextStart = eventHadFriction(event)
    ? `Empezar con un ejemplo corto de ${subjectName} y una sola comprobacion.`
    : bestSessionLength <= 14
      ? `Arrancar con bloque breve de ${bestSessionLength} minutos y cierre rapido.`
      : preferredStyle === "challenge_first"
        ? `Arrancar con una comprobacion de autonomia en ${subjectName}.`
        : `Arrancar retomando el patron que funciono en ${subjectName}.`;

  return { worked, friction, nextStart };
}

export function updateStudentLearningMemory(
  memory: StudentLearningMemory,
  event: StudentLearningMemoryEvent,
): StudentLearningMemory {
  const style = inferStyleFromEvent(event, memory);
  const styleDelta = eventSucceeded(event) ? 2 : eventHadFriction(event) ? -1 : 1;
  const styleEvidence = incrementEvidence<StudentExplanationStyle>(memory.styleEvidence, style, styleDelta);
  const preferredExplanationStyle = strongestEvidence<StudentExplanationStyle>(styleEvidence, memory.preferredExplanationStyle);

  const happenedAt = event.happenedAt ?? event.session?.createdAt ?? event.exercise?.updatedAt ?? new Date().toISOString();
  const timeWindow = getSessionTimeWindow(happenedAt);
  const timeWindowEvidence = eventSucceeded(event) && timeWindow !== "unknown"
    ? incrementEvidence<StudentSessionTimeWindow>(memory.timeWindowEvidence, timeWindow, 1)
    : memory.timeWindowEvidence;
  const bestSessionTimeWindow = strongestEvidence<StudentSessionTimeWindow>(timeWindowEvidence, memory.bestSessionTimeWindow);
  const bestSessionLength = updateBestSessionLength(memory, event);
  const subjects = updateSubjects(memory, event);
  const frustrationSignal =
    event.dynamicProfile?.emotional.frustrationLevel === "high" || eventHadFriction(event)
      ? 0.82
      : eventSucceeded(event)
        ? 0.24
        : event.evolution?.frustrationLevel ?? 0.5;
  const confidenceSignal =
    typeof event.score === "number"
      ? event.score / 100
      : event.dynamicProfile?.emotional.confidenceLevel === "high" || eventSucceeded(event)
        ? 0.82
        : eventHadFriction(event)
          ? 0.28
          : event.evolution?.progressionVelocity ?? 0.5;
  const consistencySignal =
    event.abandoned
      ? 0.22
      : event.session && event.session.durationMinutes <= Math.max(10, memory.bestSessionLength + 6)
        ? 0.74
        : event.evolution?.consistencyScore ?? 0.5;
  const repetitionRiskSignals = dedupe([
    ...memory.repetitionRiskSignals,
    ...(event.dynamicProfile?.academic.courseAgeMismatch ? ["age_course_mismatch"] : []),
    ...(event.dynamicProfile?.academic.hasRepeatedCourse ? ["declared_or_inferred_repetition"] : []),
    ...(event.evolution && event.evolution.commonMistakes.length >= 5 ? ["recurring_errors"] : []),
    ...(eventHadFriction(event) && subjects.weakestSubjects.length >= 3 ? ["multi_subject_friction"] : []),
  ], 8);

  return {
    ...memory,
    strongestSubjects: subjects.strongestSubjects,
    weakestSubjects: subjects.weakestSubjects,
    preferredExplanationStyle,
    averageResponseSpeed: event.dynamicProfile?.cognitive.responseSpeed ?? memory.averageResponseSpeed,
    confidenceTrend: scoreTrend(memory.confidenceTrend, confidenceSignal, true),
    frustrationTrend: scoreTrend(memory.frustrationTrend, frustrationSignal, true),
    consistencyTrend: scoreTrend(memory.consistencyTrend, consistencySignal, true),
    repetitionRiskSignals,
    motivationPattern: updateMotivationPattern(memory, event),
    bestSessionLength,
    bestSessionTimeWindow,
    lastAdaptationSummary: buildAdaptationSummary(memory, event, preferredExplanationStyle, bestSessionLength),
    styleEvidence,
    timeWindowEvidence,
    adaptationCount: memory.adaptationCount + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function adaptDailyPlanWithLearningMemory(plan: DailyPlan, memory: StudentLearningMemory | null | undefined): DailyPlan {
  if (!memory) return plan;
  const recommendedDuration = clamp(memory.bestSessionLength, 8, 32);
  const priority =
    memory.frustrationTrend === "rising" || memory.motivationPattern === "fragile"
      ? "high"
      : memory.confidenceTrend === "rising" && memory.consistencyTrend === "rising"
        ? "low"
        : plan.priority;

  return {
    ...plan,
    recommendedDuration,
    priority,
    adaptationReason: plan.adaptationReason,
    tasks: plan.tasks.map((task) => {
      const weak = memory.weakestSubjects.some((subject) => subject.toLowerCase().includes(task.subject.toLowerCase()));
      if (!weak && memory.confidenceTrend !== "rising") return task;
      return {
        ...task,
        difficulty: weak && memory.frustrationTrend === "rising"
          ? Math.max(1, task.difficulty - 1)
          : memory.confidenceTrend === "rising" && memory.consistencyTrend === "rising"
            ? Math.min(5, task.difficulty + 1)
            : task.difficulty,
      };
    }),
  };
}
