import type {
  MentoriaFamilyStructure,
  MentoriaGuardianStudentAccess,
  MentoriaLearningStage,
  MentoriaProgress,
  MentoriaStudentSubjectMemory,
  MentoriaStudentSubject,
  StudentProfile,
} from "@/lib/mentoria/types";
import type { StudentLearningMemory } from "@/lib/mentoria/student-learning-memory";
import { pickActiveStudentSubjectMemory, rankFragileSubjectMemories } from "@/lib/mentoria/student-subject-memory";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

export type DynamicProfileLevel = "low" | "medium" | "high";
export type DynamicResponseSpeed = "slow" | "medium" | "fast";

export type DynamicSubjectProfile = {
  subjectId: string;
  subjectSlug: string;
  subjectName: string;
  initialLevel: "me_cuesta_mucho" | "voy_normal" | "se_me_da_bien";
  masteryScore: number | null;
  confidenceScore: number | null;
  isWeak: boolean;
  isStrong: boolean;
};

export type DynamicStudentProfile = {
  studentId: string;
  academic: {
    stage: MentoriaLearningStage;
    schoolYear: string;
    expectedAge: number | null;
    actualAge: number | null;
    hasRepeatedCourse: boolean;
    courseAgeMismatch: boolean;
    subjects: DynamicSubjectProfile[];
  };
  cognitive: {
    comprehensionLevel: DynamicProfileLevel;
    errorRate: number;
    responseSpeed: DynamicResponseSpeed;
  };
  emotional: {
    frustrationLevel: DynamicProfileLevel;
    confidenceLevel: DynamicProfileLevel;
    consistency: DynamicProfileLevel;
  };
  contextual: {
    familyStructure: MentoriaFamilyStructure;
    supportLevel: DynamicProfileLevel;
    supportSignals: string[];
  };
  memory?: {
    preferredExplanationStyle: StudentLearningMemory["preferredExplanationStyle"];
    averageResponseSpeed: StudentLearningMemory["averageResponseSpeed"];
    confidenceTrend: StudentLearningMemory["confidenceTrend"];
    frustrationTrend: StudentLearningMemory["frustrationTrend"];
    consistencyTrend: StudentLearningMemory["consistencyTrend"];
    motivationPattern: StudentLearningMemory["motivationPattern"];
    bestSessionLength: number;
    bestSessionTimeWindow: StudentLearningMemory["bestSessionTimeWindow"];
    weakestSubjects: string[];
    strongestSubjects: string[];
    repetitionRiskSignals: string[];
    lastAdaptationSummary: StudentLearningMemory["lastAdaptationSummary"];
    activeConceptKey?: string;
    activeConceptMastery?: MentoriaStudentSubjectMemory["masteryLevel"];
    activeConceptConfidence?: MentoriaStudentSubjectMemory["confidenceLevel"];
    activeConceptNeedsReinforcement?: boolean;
    activeConceptSupportStyle?: MentoriaStudentSubjectMemory["preferredSupportStyle"];
    activeConceptSummary?: string;
    fragileConcepts?: Array<{
      subjectSlug: string;
      conceptKey: string;
      masteryLevel: MentoriaStudentSubjectMemory["masteryLevel"];
      recurrenceCount: number;
      needsReinforcement: boolean;
    }>;
  };
  updatedAt: string;
};

export type BuildDynamicStudentProfileInput = {
  student: StudentProfile;
  studentSubjects?: MentoriaStudentSubject[];
  progress?: MentoriaProgress[];
  evolution?: StudentEvolutionProfile | null;
  learningMemory?: StudentLearningMemory | null;
  subjectMemories?: MentoriaStudentSubjectMemory[];
  guardianStudentAccess?: MentoriaGuardianStudentAccess[];
  familyStructure?: MentoriaFamilyStructure | null;
  activeSubjectSlug?: string | null;
  activeTopic?: string | null;
};

export function expectedAgeFromSchoolYear(schoolYear: string): number | null {
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
  return null;
}

export function levelFromScore(value: number): DynamicProfileLevel {
  if (value < 0.4) return "low";
  if (value >= 0.7) return "high";
  return "medium";
}

export function numericLevel(value: DynamicProfileLevel): number {
  if (value === "low") return 0.25;
  if (value === "high") return 0.85;
  return 0.55;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function parseFamilyStructure(notes?: string): MentoriaFamilyStructure | null {
  const value = notes?.toLowerCase() ?? "";
  if (value.includes("estructura familiar padres separados")) return "separated_parents";
  if (value.includes("estructura familiar dos tutores")) return "two_guardians";
  if (value.includes("estructura familiar tutor legal")) return "legal_guardian";
  if (value.includes("estructura familiar un tutor")) return "single_guardian";
  return null;
}

function parseRepeatedCourse(notes?: string): boolean | null {
  const value = notes?.toLowerCase() ?? "";
  if (value.includes("repeticion si")) return true;
  if (value.includes("repeticion no")) return false;
  return null;
}

function responseSpeedFromMinutes(minutes: number): DynamicResponseSpeed {
  if (minutes >= 24) return "slow";
  if (minutes <= 10) return "fast";
  return "medium";
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function buildSubjects(input: BuildDynamicStudentProfileInput): DynamicSubjectProfile[] {
  const progressBySubject = new Map((input.progress ?? []).map((item) => [item.subjectId, item]));

  return (input.studentSubjects ?? []).map((item) => {
    const progress = progressBySubject.get(item.subjectId) ?? null;
    const mastery = progress?.masteryScore ?? null;
    const confidence = progress?.confidenceScore ?? null;
    return {
      subjectId: item.subjectId,
      subjectSlug: item.subject?.slug ?? item.subjectId,
      subjectName: item.subject?.name ?? item.subject?.slug ?? item.subjectId,
      initialLevel: item.initialLevel,
      masteryScore: mastery,
      confidenceScore: confidence,
      isWeak: item.initialLevel === "me_cuesta_mucho" || (mastery !== null && mastery < 58) || (confidence !== null && confidence < 52),
      isStrong: item.initialLevel === "se_me_da_bien" || (mastery !== null && mastery >= 76 && confidence !== null && confidence >= 70),
    };
  });
}

function supportLevel(input: {
  familyStructure: MentoriaFamilyStructure;
  guardianStudentAccess?: MentoriaGuardianStudentAccess[];
  hasRepeatedCourse: boolean;
  courseAgeMismatch: boolean;
  frustrationLevel: DynamicProfileLevel;
  consistency: DynamicProfileLevel;
  repetitionRiskSignals?: string[];
  frustrationTrend?: StudentLearningMemory["frustrationTrend"];
  consistencyTrend?: StudentLearningMemory["consistencyTrend"];
}): { level: DynamicProfileLevel; signals: string[] } {
  const signals: string[] = [];
  const primaryContacts = (input.guardianStudentAccess ?? []).filter((item) => item.isPrimaryContact).length;
  const closeSupervision = (input.guardianStudentAccess ?? []).some((item) => item.supervisionLevel === "close");

  if (input.familyStructure === "single_guardian") signals.push("single_guardian");
  if (input.familyStructure === "separated_parents") signals.push("separated_parents");
  if (input.hasRepeatedCourse || input.courseAgeMismatch) signals.push("course_repetition_or_mismatch");
  for (const signal of input.repetitionRiskSignals ?? []) signals.push(signal);
  if (input.frustrationLevel === "high") signals.push("high_frustration");
  if (input.consistency === "low") signals.push("low_consistency");
  if (input.frustrationTrend === "rising") signals.push("frustration_trend_rising");
  if (input.consistencyTrend === "falling") signals.push("consistency_trend_falling");
  if (primaryContacts === 0) signals.push("no_primary_contact");
  if (closeSupervision) signals.push("close_supervision");

  if (
    input.frustrationLevel === "high"
    || input.consistency === "low"
    || input.hasRepeatedCourse
    || input.courseAgeMismatch
    || input.frustrationTrend === "rising"
    || input.consistencyTrend === "falling"
  ) {
    return { level: "high", signals };
  }
  if (input.familyStructure === "separated_parents" || input.familyStructure === "single_guardian" || closeSupervision) {
    return { level: "medium", signals };
  }
  return { level: "low", signals };
}

export function buildDynamicStudentProfile(input: BuildDynamicStudentProfileInput): DynamicStudentProfile {
  const subjects = buildSubjects(input);
  const memory = input.learningMemory ?? null;
  const subjectMemories = input.subjectMemories ?? [];
  const activeSubjectMemory = pickActiveStudentSubjectMemory(subjectMemories, {
    subjectSlug: input.activeSubjectSlug,
    topic: input.activeTopic,
  });
  const fragileConcepts = rankFragileSubjectMemories(subjectMemories, {
    subjectSlug: input.activeSubjectSlug,
  }).slice(0, 3);
  const expectedAge = expectedAgeFromSchoolYear(input.student.schoolYear);
  const actualAge = Number.isFinite(input.student.age) ? input.student.age : null;
  const courseAgeMismatch = expectedAge !== null && actualAge !== null ? Math.abs(actualAge - expectedAge) >= 2 : false;
  const hasRepeatedCourse = parseRepeatedCourse(input.student.supportNotes) ?? courseAgeMismatch;
  const familyStructure =
    input.familyStructure
    ?? parseFamilyStructure(input.student.supportNotes)
    ?? ((input.guardianStudentAccess?.length ?? 0) >= 2 ? "two_guardians" : "single_guardian");
  const progressScores = (input.progress ?? []).map((item) => (item.masteryScore + item.confidenceScore) / 200);
  const averageProgress = average(progressScores);
  const weakSubjectRatio = subjects.length > 0 ? subjects.filter((item) => item.isWeak).length / subjects.length : 0;
  const memoryWeakSubjectRatio = memory && subjects.length > 0
    ? subjects.filter((item) => {
        const haystack = `${item.subjectSlug} ${item.subjectName}`.toLowerCase();
        return memory.weakestSubjects.some((subject) => haystack.includes(subject.toLowerCase()) || subject.toLowerCase().includes(item.subjectName.toLowerCase()));
      }).length / subjects.length
    : 0;
  const trendConfidenceAdjustment = memory?.confidenceTrend === "rising" ? 0.08 : memory?.confidenceTrend === "falling" ? -0.08 : 0;
  const trendConsistencyAdjustment = memory?.consistencyTrend === "rising" ? 0.05 : memory?.consistencyTrend === "falling" ? -0.08 : 0;
  const progressionVelocity = clamp01((input.evolution?.progressionVelocity ?? averageProgress ?? 0.5) + trendConfidenceAdjustment + trendConsistencyAdjustment);
  const comprehensionSignal = clamp01((averageProgress ?? progressionVelocity) - weakSubjectRatio * 0.18 - memoryWeakSubjectRatio * 0.12);
  const errorRate = clamp01(
    (input.evolution?.commonMistakes.length ?? 0) / 8 * 0.45
    + weakSubjectRatio * 0.35
    + memoryWeakSubjectRatio * 0.18
    + ((memory?.repetitionRiskSignals.length ?? 0) > 0 ? 0.1 : 0)
    + (progressionVelocity < 0.45 ? 0.2 : 0),
  );
  const frustrationScore = clamp01(
    (input.evolution?.frustrationLevel ?? (input.student.emotionalBaseline.frustration === "high" ? 0.78 : input.student.emotionalBaseline.frustration === "low" ? 0.22 : 0.48))
    + (memory?.frustrationTrend === "rising" ? 0.16 : memory?.frustrationTrend === "falling" ? -0.1 : 0),
  );
  const activeConceptPenalty = activeSubjectMemory?.needsReinforcement
    ? activeSubjectMemory.recurrenceCount >= 3
      ? 0.16
      : 0.1
    : 0;
  const consistencyScore = clamp01(
    (input.evolution?.consistencyScore ?? (input.student.emotionalBaseline.concentration === "high" ? 0.76 : input.student.emotionalBaseline.concentration === "low" ? 0.32 : 0.54))
    + (memory?.consistencyTrend === "rising" ? 0.1 : memory?.consistencyTrend === "falling" ? -0.14 : 0),
  );
  const frustration = levelFromScore(clamp01(frustrationScore + activeConceptPenalty));
  const consistency = levelFromScore(consistencyScore);
  const confidence = levelFromScore(
    clamp01(
      (average((input.progress ?? []).map((item) => item.confidenceScore / 100)) ?? numericLevel(consistency))
      + (frustration === "high" ? -0.2 : 0)
      + (activeSubjectMemory?.confidenceLevel === "low" ? -0.12 : activeSubjectMemory?.confidenceLevel === "high" ? 0.08 : 0)
      + (progressionVelocity >= 0.72 ? 0.12 : 0),
    ),
  );
  const support = supportLevel({
    familyStructure,
    guardianStudentAccess: input.guardianStudentAccess,
    hasRepeatedCourse,
    courseAgeMismatch,
    frustrationLevel: frustration,
    consistency,
    repetitionRiskSignals: memory?.repetitionRiskSignals,
    frustrationTrend: memory?.frustrationTrend,
    consistencyTrend: memory?.consistencyTrend,
  });

  return {
    studentId: input.student.id,
    academic: {
      stage: input.student.learningStage,
      schoolYear: input.student.schoolYear,
      expectedAge,
      actualAge,
      hasRepeatedCourse,
      courseAgeMismatch,
      subjects,
    },
    cognitive: {
      comprehensionLevel: levelFromScore(comprehensionSignal),
      errorRate,
      responseSpeed: memory?.averageResponseSpeed ?? responseSpeedFromMinutes(input.evolution?.averageResponseTime ?? input.student.preferredStudyMinutes),
    },
    emotional: {
      frustrationLevel: frustration,
      confidenceLevel: confidence,
      consistency,
    },
    contextual: {
      familyStructure,
      supportLevel: support.level,
      supportSignals: support.signals,
    },
    memory: memory
      ? {
          preferredExplanationStyle: memory.preferredExplanationStyle,
          averageResponseSpeed: memory.averageResponseSpeed,
          confidenceTrend: memory.confidenceTrend,
          frustrationTrend: memory.frustrationTrend,
          consistencyTrend: memory.consistencyTrend,
          motivationPattern: memory.motivationPattern,
          bestSessionLength: memory.bestSessionLength,
          bestSessionTimeWindow: memory.bestSessionTimeWindow,
          weakestSubjects: memory.weakestSubjects,
          strongestSubjects: memory.strongestSubjects,
          repetitionRiskSignals: memory.repetitionRiskSignals,
          lastAdaptationSummary: memory.lastAdaptationSummary,
          activeConceptKey: activeSubjectMemory?.conceptKey,
          activeConceptMastery: activeSubjectMemory?.masteryLevel,
          activeConceptConfidence: activeSubjectMemory?.confidenceLevel,
          activeConceptNeedsReinforcement: activeSubjectMemory?.needsReinforcement,
          activeConceptSupportStyle: activeSubjectMemory?.preferredSupportStyle,
          activeConceptSummary: activeSubjectMemory?.evidenceSummary,
          fragileConcepts: fragileConcepts.map((item) => ({
            subjectSlug: item.subjectSlug,
            conceptKey: item.conceptKey,
            masteryLevel: item.masteryLevel,
            recurrenceCount: item.recurrenceCount,
            needsReinforcement: item.needsReinforcement,
          })),
        }
      : undefined,
    updatedAt: new Date().toISOString(),
  };
}
