import type { DynamicProfileLevel, DynamicResponseSpeed } from "@/lib/mentoria/student-profile";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { LearningSession, MentoriaProgress, MentoriaStudentSubject, MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";

export type StudentExplanationStyle =
  | "visual_step_by_step"
  | "concrete_examples"
  | "text_step_by_step"
  | "short_guided"
  | "challenge_first";

export type StudentLearningTrend = "rising" | "stable" | "falling";
export type StudentMotivationPattern = "fragile" | "steady" | "momentum" | "bursty" | "avoidant";
export type StudentSessionTimeWindow = "morning" | "afternoon" | "evening" | "unknown";

export type StudentLearningMemoryLastAdaptationSummary = {
  worked: string;
  friction: string;
  nextStart: string;
};

export type StudentLearningMemory = {
  studentId: string;
  tenantId?: string;
  strongestSubjects: string[];
  weakestSubjects: string[];
  preferredExplanationStyle: StudentExplanationStyle;
  averageResponseSpeed: DynamicResponseSpeed;
  confidenceTrend: StudentLearningTrend;
  frustrationTrend: StudentLearningTrend;
  consistencyTrend: StudentLearningTrend;
  repetitionRiskSignals: string[];
  motivationPattern: StudentMotivationPattern;
  bestSessionLength: number;
  bestSessionTimeWindow: StudentSessionTimeWindow;
  lastAdaptationSummary: StudentLearningMemoryLastAdaptationSummary;
  styleEvidence: Partial<Record<StudentExplanationStyle, number>>;
  timeWindowEvidence: Partial<Record<StudentSessionTimeWindow, number>>;
  adaptationCount: number;
  updatedAt: string;
};

export type BuildInitialStudentLearningMemoryInput = {
  student: StudentProfile;
  evolution?: StudentEvolutionProfile | null;
  progress?: MentoriaProgress[];
  subjects?: MentoriaSubject[];
  studentSubjects?: MentoriaStudentSubject[];
  recentSessions?: LearningSession[];
};

function clamp01(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
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

function levelFromScore(value: number): DynamicProfileLevel {
  if (value < 0.4) return "low";
  if (value >= 0.7) return "high";
  return "medium";
}

function trendFromScore(value: number, highIsRising = true): StudentLearningTrend {
  const level = levelFromScore(value);
  if (level === "medium") return "stable";
  if (level === "high") return highIsRising ? "rising" : "falling";
  return highIsRising ? "falling" : "rising";
}

function responseSpeedFromMinutes(minutes: number): DynamicResponseSpeed {
  if (minutes >= 24) return "slow";
  if (minutes <= 10) return "fast";
  return "medium";
}

function expectedAgeFromSchoolYear(schoolYear: string): number | null {
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

function subjectNameMap(input: Pick<BuildInitialStudentLearningMemoryInput, "subjects" | "studentSubjects">): Map<string, string> {
  const names = new Map<string, string>();
  for (const subject of input.subjects ?? []) {
    names.set(subject.id, subject.name);
    names.set(subject.slug, subject.name);
  }
  for (const item of input.studentSubjects ?? []) {
    if (item.subject) {
      names.set(item.subjectId, item.subject.name);
      names.set(item.subject.slug, item.subject.name);
    }
  }
  return names;
}

function rankSubjects(input: BuildInitialStudentLearningMemoryInput): {
  strongestSubjects: string[];
  weakestSubjects: string[];
} {
  const names = subjectNameMap(input);
  const ordered = [...(input.progress ?? [])].sort((left, right) => {
    const leftScore = left.masteryScore + left.confidenceScore;
    const rightScore = right.masteryScore + right.confidenceScore;
    return leftScore - rightScore;
  });

  const weakestFromProgress = ordered
    .filter((item) => item.masteryScore < 62 || item.confidenceScore < 58)
    .flatMap((item) => [names.get(item.subjectId) ?? item.subject?.name ?? item.subjectId, ...item.weakTopics]);
  const strongestFromProgress = [...ordered]
    .reverse()
    .filter((item) => item.masteryScore >= 76 || item.confidenceScore >= 72)
    .flatMap((item) => [names.get(item.subjectId) ?? item.subject?.name ?? item.subjectId, ...item.strongTopics]);

  return {
    strongestSubjects: dedupe([...(input.evolution?.strengths ?? []), ...strongestFromProgress], 8),
    weakestSubjects: dedupe([...(input.evolution?.weaknesses ?? []), ...weakestFromProgress, ...(input.evolution?.commonMistakes ?? [])], 8),
  };
}

function inferInitialStyle(student: StudentProfile, evolution?: StudentEvolutionProfile | null): StudentExplanationStyle {
  if (student.learningPreference === "practical_examples") return "concrete_examples";
  if (student.learningPreference === "quick_summaries") return "short_guided";
  if ((evolution?.frustrationLevel ?? 0) >= 0.72) return "short_guided";
  if ((evolution?.progressionVelocity ?? 0) >= 0.76 && (evolution?.consistencyScore ?? 0) >= 0.64) return "challenge_first";
  return "text_step_by_step";
}

function inferMotivationPattern(evolution?: StudentEvolutionProfile | null): StudentMotivationPattern {
  if (!evolution) return "steady";
  if (evolution.frustrationLevel >= 0.72 && evolution.consistencyScore <= 0.42) return "fragile";
  if (evolution.progressionVelocity >= 0.72 && evolution.consistencyScore >= 0.62) return "momentum";
  if (evolution.consistencyScore <= 0.34) return "bursty";
  if (evolution.lastSessions > 0 && evolution.averageResponseTime >= 28) return "avoidant";
  return "steady";
}

function inferBestSessionLength(student: StudentProfile, evolution?: StudentEvolutionProfile | null, recentSessions?: LearningSession[]): number {
  const successful = (recentSessions ?? []).filter((session) => session.emotionalState === "confident" || session.emotionalState === "steady");
  if (successful.length > 0) {
    const avg = successful.slice(0, 5).reduce((total, session) => total + Math.max(6, session.durationMinutes), 0) / Math.min(5, successful.length);
    return Math.max(8, Math.min(32, Math.round(avg)));
  }
  if ((evolution?.frustrationLevel ?? 0) >= 0.72 || (evolution?.consistencyScore ?? 1) <= 0.36) return 12;
  if ((evolution?.progressionVelocity ?? 0) >= 0.76) return Math.min(30, Math.max(18, student.preferredStudyMinutes));
  return Math.max(10, Math.min(28, student.preferredStudyMinutes));
}

export function getSessionTimeWindow(iso?: string | null): StudentSessionTimeWindow {
  if (!iso) return "unknown";
  const hour = new Date(iso).getHours();
  if (!Number.isFinite(hour)) return "unknown";
  if (hour >= 6 && hour < 13) return "morning";
  if (hour >= 13 && hour < 20) return "afternoon";
  return "evening";
}

function inferBestTimeWindow(recentSessions?: LearningSession[]): StudentSessionTimeWindow {
  const evidence: Partial<Record<StudentSessionTimeWindow, number>> = {};
  for (const session of recentSessions ?? []) {
    if (session.emotionalState !== "confident" && session.emotionalState !== "steady") continue;
    const window = getSessionTimeWindow(session.createdAt);
    evidence[window] = (evidence[window] ?? 0) + 1;
  }
  return (Object.entries(evidence).sort((left, right) => right[1] - left[1])[0]?.[0] as StudentSessionTimeWindow | undefined) ?? "unknown";
}

function inferRepetitionRiskSignals(student: StudentProfile, evolution?: StudentEvolutionProfile | null): string[] {
  const signals: string[] = [];
  const expectedAge = expectedAgeFromSchoolYear(student.schoolYear);
  if (expectedAge !== null && Math.abs(student.age - expectedAge) >= 2) signals.push("age_course_mismatch");
  const notes = student.supportNotes?.toLowerCase() ?? "";
  if (notes.includes("repeticion si")) signals.push("declared_repetition");
  if ((evolution?.progressionVelocity ?? 1) <= 0.38) signals.push("slow_progression");
  if ((evolution?.commonMistakes.length ?? 0) >= 4) signals.push("recurring_errors");
  return dedupe(signals, 6);
}

export function createInitialStudentLearningMemory(input: BuildInitialStudentLearningMemoryInput): StudentLearningMemory {
  const ranked = rankSubjects(input);
  const style = inferInitialStyle(input.student, input.evolution);
  const bestSessionTimeWindow = inferBestTimeWindow(input.recentSessions);

  return {
    studentId: input.student.id,
    tenantId: input.student.tenantId,
    strongestSubjects: ranked.strongestSubjects,
    weakestSubjects: ranked.weakestSubjects,
    preferredExplanationStyle: style,
    averageResponseSpeed: responseSpeedFromMinutes(input.evolution?.averageResponseTime ?? input.student.preferredStudyMinutes),
    confidenceTrend: trendFromScore(input.evolution?.progressionVelocity ?? 0.5, true),
    frustrationTrend: trendFromScore(input.evolution?.frustrationLevel ?? 0.46, true),
    consistencyTrend: trendFromScore(input.evolution?.consistencyScore ?? 0.54, true),
    repetitionRiskSignals: inferRepetitionRiskSignals(input.student, input.evolution),
    motivationPattern: inferMotivationPattern(input.evolution),
    bestSessionLength: inferBestSessionLength(input.student, input.evolution, input.recentSessions),
    bestSessionTimeWindow,
    lastAdaptationSummary: {
      worked: "Arranque inicial con datos de onboarding, progreso y evolucion.",
      friction: ranked.weakestSubjects[0] ? `Vigilar ${ranked.weakestSubjects[0]}.` : "Sin friccion repetida registrada todavia.",
      nextStart: "Empezar con una comprobacion corta y ajustar desde la respuesta.",
    },
    styleEvidence: { [style]: 1 },
    timeWindowEvidence: bestSessionTimeWindow === "unknown" ? {} : { [bestSessionTimeWindow]: 1 },
    adaptationCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function scoreTrend(current: StudentLearningTrend, signal: number, highIsRising = true): StudentLearningTrend {
  const next = trendFromScore(clamp01(signal), highIsRising);
  if (next === current) return current;
  if (current === "stable") return next;
  return next === "stable" ? current : "stable";
}
