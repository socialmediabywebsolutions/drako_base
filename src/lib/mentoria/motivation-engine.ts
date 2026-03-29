import type { InterventionDecision } from "@/lib/mentoria/intervention-engine";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

export type MotivationProfile = "fragile" | "stable" | "high_performer";

export type MotivationState = {
  studentId: string;
  streak: number;
  lastActivityAt: string;
  effortScore: number;
  rewardPoints: number;
  level: number;
  achievements: string[];
  motivationProfile: MotivationProfile;
};

type MotivationSignals = {
  consistencyScore: number;
  frustrationLevel: number;
  progressionVelocity: number;
  interventions: InterventionDecision[];
};

type SessionMotivationInput = {
  studentId: string;
  happenedAt: string;
  durationMinutes: number;
  scoreSignal: number;
  completed: boolean;
  source: "session" | "exercise" | "focus";
  evolution: StudentEvolutionProfile;
  interventions: InterventionDecision[];
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

function dayKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function computeStreak(current: MotivationState | null, happenedAt: string): number {
  if (!current) return 1;
  const currentDay = dayKey(happenedAt);
  const previousDay = dayKey(current.lastActivityAt);
  if (currentDay === previousDay) {
    return Math.max(1, current.streak);
  }
  const deltaDays = Math.round((new Date(currentDay).getTime() - new Date(previousDay).getTime()) / 86400000);
  if (deltaDays === 1) {
    return current.streak + 1;
  }
  return 1;
}

export function calculateEffortScore(input: {
  durationMinutes: number;
  scoreSignal: number;
  completed: boolean;
  evolution: StudentEvolutionProfile;
  interventions: InterventionDecision[];
  source: "session" | "exercise" | "focus";
}): number {
  const completionWeight = input.completed ? 0.28 : 0.08;
  const durationWeight = clamp01(input.durationMinutes / (input.source === "focus" ? 40 : 25)) * 0.24;
  const scoreWeight = clamp01(input.scoreSignal) * 0.22;
  const consistencyWeight = clamp01(input.evolution.consistencyScore) * 0.14;
  const recoveryWeight =
    input.interventions.some((item) => item.type === "high_frustration" || item.type === "risk_student")
      ? 0.12
      : input.evolution.frustrationLevel < 0.45
        ? 0.08
        : 0.04;
  const progressionWeight = clamp01(input.evolution.progressionVelocity) * 0.12;
  return clamp01(completionWeight + durationWeight + scoreWeight + consistencyWeight + recoveryWeight + progressionWeight);
}

export function detectMotivationProfile(input: MotivationSignals): MotivationProfile {
  const hasRisk = input.interventions.some((item) => item.type === "risk_student");
  const hasLowConsistency = input.interventions.some((item) => item.type === "low_consistency");
  const hasRapidProgress = input.interventions.some((item) => item.type === "rapid_progress");

  if (hasRisk || input.frustrationLevel >= 0.72 || input.consistencyScore <= 0.36) {
    return "fragile";
  }

  if (hasRapidProgress || (input.progressionVelocity >= 0.76 && input.consistencyScore >= 0.6 && input.frustrationLevel <= 0.45)) {
    return "high_performer";
  }

  if (hasLowConsistency) {
    return "fragile";
  }

  return "stable";
}

function rewardForSource(source: SessionMotivationInput["source"]): number {
  if (source === "exercise") return 10;
  if (source === "focus") return 8;
  return 12;
}

function buildAchievements(input: {
  previous: MotivationState | null;
  next: MotivationState;
  source: SessionMotivationInput["source"];
  interventions: InterventionDecision[];
}): string[] {
  const achievements = [...(input.previous?.achievements ?? [])];

  if (input.next.streak >= 3) achievements.push("Ritmo de 3 dias");
  if (input.next.streak >= 7) achievements.push("Ritmo de 7 dias");
  if (input.next.rewardPoints >= 100) achievements.push("Primer nivel de esfuerzo");
  if (input.next.rewardPoints >= 250) achievements.push("Constancia sostenida");
  if (input.source === "focus" && input.next.effortScore >= 0.7) achievements.push("Foco con sentido");
  if (input.source === "exercise" && input.next.effortScore >= 0.72) achievements.push("Practica con intencion");
  if (input.source === "session" && !input.interventions.some((item) => item.type === "high_frustration")) achievements.push("Sesion con buen cierre");
  if (input.next.motivationProfile === "high_performer") achievements.push("Autonomia en crecimiento");
  if (input.next.motivationProfile === "fragile" && input.next.streak >= 2) achievements.push("Vuelta al ritmo");

  return dedupe(achievements).slice(0, 12);
}

export function updateMotivationFromSession(
  current: MotivationState | null,
  input: SessionMotivationInput,
): MotivationState {
  const streak = computeStreak(current, input.happenedAt);
  const effortScore = calculateEffortScore({
    durationMinutes: input.durationMinutes,
    scoreSignal: input.scoreSignal,
    completed: input.completed,
    evolution: input.evolution,
    interventions: input.interventions,
    source: input.source,
  });
  const rewardPoints =
    (current?.rewardPoints ?? 0) +
    Math.round(effortScore * rewardForSource(input.source) * (streak >= 3 ? 1.15 : 1));
  const motivationProfile = detectMotivationProfile({
    consistencyScore: input.evolution.consistencyScore,
    frustrationLevel: input.evolution.frustrationLevel,
    progressionVelocity: input.evolution.progressionVelocity,
    interventions: input.interventions,
  });
  const level = Math.max(1, 1 + Math.floor(rewardPoints / 120));

  const next: MotivationState = {
    studentId: input.studentId,
    streak,
    lastActivityAt: input.happenedAt,
    effortScore,
    rewardPoints,
    level,
    achievements: [],
    motivationProfile,
  };

  next.achievements = buildAchievements({
    previous: current,
    next,
    source: input.source,
    interventions: input.interventions,
  });

  return next;
}

export function createInitialMotivationState(studentId: string, happenedAt: string): MotivationState {
  return {
    studentId,
    streak: 1,
    lastActivityAt: happenedAt,
    effortScore: 0.52,
    rewardPoints: 12,
    level: 1,
    achievements: [],
    motivationProfile: "stable",
  };
}
