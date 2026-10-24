import type { LearningSession, MentoriaExercise, MentoriaProgress, MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";

export interface StudentEvolutionProfile {
  studentId: string;
  subjectSlug: string;
  strengths: string[];
  weaknesses: string[];
  frustrationLevel: number;
  consistencyScore: number;
  averageResponseTime: number;
  lastSessions: number;
  commonMistakes: string[];
  progressionVelocity: number;
  updatedAt: string;
}

export type EvolutionAdaptiveSignals = {
  supportLevel: "high" | "medium" | "low";
  challengeLevel: "down" | "steady" | "up";
  explanationMode: "scaffolded" | "guided" | "analytical";
  reinforcementFrequency: "high" | "medium" | "low";
  focusPriority: "stability" | "balance" | "acceleration";
  prioritizedWeaknesses: string[];
  prioritizedStrengths: string[];
  promptDirectives: string[];
};

type ExerciseEvolutionInput = {
  exercise: MentoriaExercise;
  subject: MentoriaSubject;
  studentAnswer: string;
  score: number;
  correctionFeedback: string;
  progress?: MentoriaProgress | null;
};

type SessionEvolutionInput = {
  session: LearningSession;
  subject: MentoriaSubject;
  studentMessage: string;
  tutorReply: string;
  progress?: MentoriaProgress | null;
};

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function takeRecent(values: Array<string | null | undefined>, limit: number): string[] {
  return dedupe(values).slice(0, limit);
}

function blend(current: number, next: number, weight = 0.35): number {
  return clamp01(current * (1 - weight) + next * weight);
}

function normalizedSubjectName(subject: MentoriaSubject): string {
  return subject.slug || subject.name.toLowerCase();
}

function inferProgressSignal(progress?: MentoriaProgress | null): number {
  if (!progress) return 0.5;
  return clamp01((progress.masteryScore + progress.confidenceScore) / 200);
}

export function detectFrustration(input: {
  message?: string;
  score?: number;
  durationMinutes?: number;
  emotionalState?: LearningSession["emotionalState"];
  correctionFeedback?: string;
  averageResponseTime?: number;
  distractionsCount?: number;
}): number {
  const normalizedMessage = (input.message ?? "").toLowerCase();
  const normalizedFeedback = (input.correctionFeedback ?? "").toLowerCase();
  let frustration = 0.22;

  if (input.emotionalState === "frustrated") frustration += 0.35;
  if (input.emotionalState === "blocked") frustration += 0.45;
  if (input.emotionalState === "demotivated") frustration += 0.28;
  if (input.emotionalState === "confident") frustration -= 0.18;

  if (typeof input.score === "number") {
    if (input.score < 50) frustration += 0.28;
    else if (input.score < 70) frustration += 0.14;
    else if (input.score >= 85) frustration -= 0.14;
  }

  if (typeof input.durationMinutes === "number" && input.durationMinutes > 0) {
    if (input.durationMinutes >= 25) frustration += 0.16;
    else if (input.durationMinutes <= 8) frustration -= 0.05;
  }

  if (typeof input.averageResponseTime === "number" && input.averageResponseTime > 0) {
    if (input.averageResponseTime >= 20) frustration += 0.12;
    else if (input.averageResponseTime <= 7) frustration -= 0.06;
  }

  if (typeof input.distractionsCount === "number") {
    frustration += Math.min(0.15, input.distractionsCount * 0.03);
  }

  if (normalizedMessage.includes("no entiendo") || normalizedMessage.includes("me bloqueo") || normalizedMessage.includes("imposible")) {
    frustration += 0.22;
  }
  if (normalizedMessage.includes("otra vez") || normalizedMessage.includes("siempre me equivoco")) {
    frustration += 0.16;
  }
  if (normalizedFeedback.includes("revisar") || normalizedFeedback.includes("afinar")) {
    frustration += 0.05;
  }

  return clamp01(frustration);
}

export function detectWeaknessPatterns(input: {
  subject: MentoriaSubject;
  expectedCompetency?: string;
  score?: number;
  weakTopics?: string[];
  transcript?: Array<{ content: string }>;
  commonMistakes?: string[];
}): string[] {
  const patterns: string[] = [];
  const subjectName = normalizedSubjectName(input.subject);
  const competency = input.expectedCompetency?.trim();

  if (typeof input.score === "number" && input.score < 70) {
    patterns.push(subjectName);
  }
  if (competency && typeof input.score === "number" && input.score < 75) {
    patterns.push(competency);
  }
  for (const weakTopic of input.weakTopics ?? []) {
    patterns.push(weakTopic);
  }
  for (const message of input.transcript ?? []) {
    const content = message.content.toLowerCase();
    if (content.includes("no entiendo") || content.includes("me cuesta")) {
      patterns.push(subjectName);
    }
  }
  for (const mistake of input.commonMistakes ?? []) {
    patterns.push(mistake);
  }

  return takeRecent(patterns, 8);
}

export function updateEvolutionProfileFromExercise(
  profile: StudentEvolutionProfile,
  input: ExerciseEvolutionInput,
): StudentEvolutionProfile {
  if (profile.subjectSlug !== input.subject.slug && profile.subjectSlug !== "general") {
    throw new Error("EVOLUTION_SCOPE_MISMATCH");
  }
  const responseMinutes = Math.max(
    1,
    Math.round((new Date(input.exercise.updatedAt || input.exercise.createdAt).getTime() - new Date(input.exercise.createdAt).getTime()) / 60000) || 1,
  );
  const frustrationSignal = detectFrustration({
    message: input.studentAnswer,
    score: input.score,
    correctionFeedback: input.correctionFeedback,
    averageResponseTime: profile.averageResponseTime,
    durationMinutes: responseMinutes,
  });
  const weaknessPatterns = detectWeaknessPatterns({
    subject: input.subject,
    expectedCompetency: input.exercise.expectedCompetency,
    score: input.score,
    weakTopics: input.progress?.weakTopics,
    commonMistakes: profile.commonMistakes,
  });
  const progressionSignal = clamp01(input.score / 100);
  const consistencySignal = clamp01(input.score >= 75 ? 0.8 : input.score >= 55 ? 0.58 : 0.34);
  const strengths = input.score >= 82 ? takeRecent([input.subject.name, input.exercise.expectedCompetency, ...profile.strengths], 8) : profile.strengths;
  const weaknesses = input.score < 75 ? takeRecent([...weaknessPatterns, ...profile.weaknesses], 8) : takeRecent(profile.weaknesses.filter((item) => item !== input.subject.slug), 8);
  const commonMistakes = input.score < 75
    ? takeRecent([input.exercise.expectedCompetency, ...weaknessPatterns, ...profile.commonMistakes], 10)
    : takeRecent(profile.commonMistakes.filter((item) => item !== input.exercise.expectedCompetency), 10);

  return {
    studentId: profile.studentId,
    subjectSlug: profile.subjectSlug || input.subject.slug,
    strengths,
    weaknesses,
    frustrationLevel: blend(profile.frustrationLevel, frustrationSignal, 0.4),
    consistencyScore: blend(profile.consistencyScore, consistencySignal, 0.3),
    averageResponseTime: Math.round((profile.averageResponseTime * Math.max(1, profile.lastSessions) + responseMinutes) / (Math.max(1, profile.lastSessions) + 1)),
    lastSessions: Math.min(30, profile.lastSessions + 1),
    commonMistakes,
    progressionVelocity: blend(profile.progressionVelocity, progressionSignal, 0.3),
    updatedAt: new Date().toISOString(),
  };
}

export function updateEvolutionFromSession(
  profile: StudentEvolutionProfile,
  input: SessionEvolutionInput,
): StudentEvolutionProfile {
  if (profile.subjectSlug !== input.subject.slug && profile.subjectSlug !== "general") {
    throw new Error("EVOLUTION_SCOPE_MISMATCH");
  }
  const frustrationSignal = detectFrustration({
    message: input.studentMessage,
    emotionalState: input.session.emotionalState,
    durationMinutes: input.session.durationMinutes,
    averageResponseTime: profile.averageResponseTime,
  });
  const weaknessPatterns = detectWeaknessPatterns({
    subject: input.subject,
    weakTopics: input.progress?.weakTopics,
    transcript: input.session.transcript,
    commonMistakes: profile.commonMistakes,
  });
  const sessionSuccessSignal =
    input.session.emotionalState === "confident"
      ? 0.82
      : input.session.emotionalState === "steady"
        ? 0.64
        : input.session.emotionalState === "demotivated"
          ? 0.38
          : 0.3;
  const responseTime = Math.max(1, input.session.durationMinutes);
  const consistencySignal = clamp01(input.session.durationMinutes >= 10 ? 0.76 : 0.48);
  const strengths =
    input.session.emotionalState === "confident" || inferProgressSignal(input.progress) > 0.7
      ? takeRecent([input.subject.name, ...profile.strengths], 8)
      : profile.strengths;

  return {
    studentId: profile.studentId,
    subjectSlug: profile.subjectSlug || input.subject.slug,
    strengths,
    weaknesses:
      input.session.emotionalState === "frustrated" || input.session.emotionalState === "blocked"
        ? takeRecent([...weaknessPatterns, ...profile.weaknesses], 8)
        : takeRecent(profile.weaknesses.filter((item) => item !== input.subject.slug), 8),
    frustrationLevel: blend(profile.frustrationLevel, frustrationSignal, 0.34),
    consistencyScore: blend(profile.consistencyScore, consistencySignal, 0.28),
    averageResponseTime: Math.round((profile.averageResponseTime * Math.max(1, profile.lastSessions) + responseTime) / (Math.max(1, profile.lastSessions) + 1)),
    lastSessions: Math.min(30, profile.lastSessions + 1),
    commonMistakes:
      input.session.emotionalState === "frustrated" || input.session.emotionalState === "blocked"
        ? takeRecent([...weaknessPatterns, ...profile.commonMistakes], 10)
        : profile.commonMistakes,
    progressionVelocity: blend(profile.progressionVelocity, sessionSuccessSignal, 0.22),
    updatedAt: new Date().toISOString(),
  };
}

export function createInitialEvolutionProfile(input: {
  student: StudentProfile;
  progress: MentoriaProgress[];
  subject: MentoriaSubject;
}): StudentEvolutionProfile {
  const subjectProgress = input.progress.filter((item) => item.subjectId === input.subject.id);
  const strengths = subjectProgress
    .filter((item) => item.masteryScore >= 70 || item.confidenceScore >= 68)
    .flatMap((item) => [input.subject.name, ...item.strongTopics]);
  const weaknesses = subjectProgress
    .filter((item) => item.masteryScore < 65 || item.confidenceScore < 60)
    .flatMap((item) => [input.subject.name, ...item.weakTopics]);

  const baselineFrustration =
    input.student.emotionalBaseline.frustration === "high"
      ? 0.72
      : input.student.emotionalBaseline.frustration === "low"
        ? 0.2
        : 0.46;
  const baselineConsistency =
    input.student.emotionalBaseline.concentration === "high"
      ? 0.76
      : input.student.emotionalBaseline.concentration === "low"
        ? 0.32
        : 0.54;

  return {
    studentId: input.student.id,
    subjectSlug: input.subject.slug || "general",
    strengths: takeRecent([...input.student.strengths, ...strengths], 8),
    weaknesses: takeRecent(weaknesses, 8),
    frustrationLevel: baselineFrustration,
    consistencyScore: baselineConsistency,
    averageResponseTime: Math.max(8, input.student.preferredStudyMinutes),
    lastSessions: 0,
    commonMistakes: takeRecent(weaknesses, 8),
    progressionVelocity: clamp01(
      input.progress.length > 0
        ? input.progress.reduce((total, item) => total + item.masteryScore, 0) / (input.progress.length * 100)
        : 0.42,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function buildEvolutionAdaptiveSignals(
  profile: StudentEvolutionProfile,
  options?: { subject?: MentoriaSubject | null },
): EvolutionAdaptiveSignals {
  const subjectKey = options?.subject ? normalizedSubjectName(options.subject) : null;
  const subjectWeak = subjectKey ? profile.weaknesses.some((item) => item.toLowerCase().includes(subjectKey)) : false;
  const highFrustration = profile.frustrationLevel >= 0.7;
  const lowConsistency = profile.consistencyScore <= 0.4;
  const fastProgress = profile.progressionVelocity >= 0.72;
  const slowProgress = profile.progressionVelocity <= 0.42;

  const supportLevel = highFrustration || lowConsistency || subjectWeak ? "high" : profile.frustrationLevel >= 0.45 ? "medium" : "low";
  const challengeLevel =
    highFrustration || subjectWeak
      ? "down"
      : fastProgress && profile.consistencyScore >= 0.62
        ? "up"
        : "steady";
  const explanationMode =
    supportLevel === "high"
      ? "scaffolded"
      : challengeLevel === "up"
        ? "analytical"
        : "guided";
  const reinforcementFrequency = supportLevel === "high" ? "high" : challengeLevel === "up" ? "low" : "medium";
  const focusPriority = supportLevel === "high" ? "stability" : challengeLevel === "up" ? "acceleration" : "balance";

  return {
    supportLevel,
    challengeLevel,
    explanationMode,
    reinforcementFrequency,
    focusPriority,
    prioritizedWeaknesses: profile.weaknesses.slice(0, 4),
    prioritizedStrengths: profile.strengths.slice(0, 4),
    promptDirectives: [
      supportLevel === "high" ? "Reduce la carga cognitiva y refuerza cada pequeno avance." : null,
      challengeLevel === "up" ? "Sube el nivel de autonomia y pide justificar el razonamiento." : null,
      subjectWeak ? `Refuerza especialmente ${options?.subject?.name}.` : null,
      reinforcementFrequency === "high" ? "Introduce comprobaciones frecuentes de comprension." : "Mantiene un refuerzo equilibrado sin sobreexplicar.",
      lowConsistency ? "Trabaja objetivos breves y cierres claros para sostener el habito." : null,
      fastProgress ? "Aprovecha la buena traccion con retos progresivos." : null,
    ].filter(Boolean) as string[],
  };
}
