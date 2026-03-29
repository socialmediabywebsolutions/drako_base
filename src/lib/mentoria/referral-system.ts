import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy } from "@/lib/mentoria/microcopy";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type {
  DailyPlan,
  MentoriaGrowthEntitlements,
  MentoriaIntervention,
  MentoriaProgress,
  MentoriaProgressSharePayload,
  MentoriaReferral,
  MentoriaReferralProfile,
  MentoriaRewardFeature,
  StudentProfile,
} from "@/lib/mentoria/types";

const DEFAULT_PREMIUM_REWARD_DAYS = 7;
const DEFAULT_REWARD_POINTS = 60;
const FEATURE_UNLOCK_DAYS = 14;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

export function generateReferralCode(input: { studentName: string; studentId?: string }): string {
  const prefix = slugify(input.studentName) || "mentoria";
  const entropy = (input.studentId ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `${prefix}-${entropy}`;
}

export function generateInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function buildReferralRewardPackage(): {
  premiumDays: number;
  rewardPoints: number;
  featureUnlocks: MentoriaRewardFeature[];
} {
  return {
    premiumDays: DEFAULT_PREMIUM_REWARD_DAYS,
    rewardPoints: DEFAULT_REWARD_POINTS,
    featureUnlocks: ["advanced_parent_insights", "adaptive_motivation_boost", "progress_sharing_branding"],
  };
}

export function resolveGrowthEntitlements(profile: MentoriaReferralProfile | null, now = new Date().toISOString()): MentoriaGrowthEntitlements {
  const activeUnlocks = Object.fromEntries(
    Object.entries(profile?.featureUnlocks ?? {}).filter(([, expiresAt]) => typeof expiresAt === "string" && expiresAt > now),
  ) as MentoriaGrowthEntitlements["featureUnlocks"];

  return {
    premiumAccessUntil: profile?.premiumAccessUntil && profile.premiumAccessUntil > now ? profile.premiumAccessUntil : undefined,
    featureUnlocks: activeUnlocks,
    rewardPointsEarned: profile?.rewardPointsEarned ?? 0,
  };
}

export function applyReferralReward(input: {
  profile: MentoriaReferralProfile;
  referral: MentoriaReferral;
  now?: string;
}): MentoriaReferralProfile {
  const now = input.now ?? new Date().toISOString();
  const startFrom = input.profile.premiumAccessUntil && input.profile.premiumAccessUntil > now ? input.profile.premiumAccessUntil : now;
  const featureUnlocks = { ...input.profile.featureUnlocks };

  for (const feature of input.referral.rewardFeatures) {
    const currentExpiry = featureUnlocks[feature];
    const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
    featureUnlocks[feature] = addDays(baseDate, FEATURE_UNLOCK_DAYS);
  }

  return {
    ...input.profile,
    totalInvites: Math.max(input.profile.totalInvites, input.profile.convertedInvites + 1),
    registeredInvites: Math.max(input.profile.registeredInvites, input.profile.convertedInvites + 1),
    convertedInvites: input.profile.convertedInvites + 1,
    premiumAccessUntil: addDays(startFrom, input.referral.rewardPremiumDays),
    rewardPointsEarned: input.profile.rewardPointsEarned + input.referral.rewardPoints,
    featureUnlocks,
    updatedAt: now,
  };
}

export function buildReferralInviteMessage(input: {
  student: StudentProfile;
  referralCode: string;
  inviteUrl: string;
}): string {
  const stage = getLearningProfile(input.student).stage;
  const encouragement = getMicrocopy(stage, "encouragement");
  return `${encouragement} Estoy usando Mentoria para acompañar el aprendizaje de ${input.student.fullName}. Este enlace activa una bienvenida guiada y un arranque adaptado desde el primer día: ${input.inviteUrl} Código: ${input.referralCode}.`;
}

export function buildProgressSharePayload(input: {
  student: StudentProfile;
  progress: MentoriaProgress[];
  dailyPlan: DailyPlan | null;
  motivation: MotivationState;
  interventions: MentoriaIntervention[];
}): MentoriaProgressSharePayload {
  const stage = getLearningProfile(input.student).stage;
  const dashboardMessage = getMicrocopy(stage, "dashboard_message");
  const recommendations = dedupe([
    ...input.interventions.flatMap((item) => item.recommendations),
    input.motivation.motivationProfile === "fragile"
      ? "Mantener sesiones cortas con cierres visibles durante los próximos días."
      : input.motivation.motivationProfile === "high_performer"
        ? "Aprovechar la buena racha con un reto de mayor autonomía y seguimiento ligero."
        : "Sostener una rutina clara y regular para consolidar el avance actual.",
  ]).slice(0, 4);

  return {
    studentName: input.student.fullName,
    schoolYear: input.student.schoolYear,
    summaryMessage: dashboardMessage,
    headlineMetric: `${Math.round(input.progress.reduce((total, item) => total + item.masteryScore, 0) / Math.max(1, input.progress.length))}% de dominio medio`,
    progress: input.progress.map((item) => ({
      subject: item.subject?.name ?? "Materia",
      masteryScore: item.masteryScore,
      confidenceScore: item.confidenceScore,
      sessionsCompleted: item.sessionsCompleted,
      exercisesCompleted: item.exercisesCompleted,
    })),
    dailyPlan: input.dailyPlan
      ? {
          recommendedDuration: input.dailyPlan.recommendedDuration,
          completionRate: input.dailyPlan.completionRate,
          tasks: input.dailyPlan.tasks.map((task) => ({
            subject: task.subject,
            type: task.type,
            difficulty: task.difficulty,
            completed: task.completed,
          })),
        }
      : null,
    achievements: input.motivation.achievements.slice(0, 6),
    recommendations,
  };
}

export function buildProgressShareMessage(input: {
  student: StudentProfile;
  shareUrl: string;
  payload: MentoriaProgressSharePayload;
}): string {
  return `Progreso compartido de ${input.student.fullName} en Mentoria: ${input.payload.headlineMetric}. Ver resumen: ${input.shareUrl}`;
}

export function buildGrowthRecommendations(input: {
  student: StudentProfile;
  evolution: StudentEvolutionProfile;
  motivation: MotivationState;
  interventions: MentoriaIntervention[];
  dailyPlan: DailyPlan;
  referralProfile: MentoriaReferralProfile;
}): { shareMessage: string; inviteReason: string } {
  const stage = getLearningProfile(input.student).stage;
  const parentMessage = getMicrocopy(stage, "parent_message");
  const activeIntervention = input.interventions.find((item) => item.status === "active");
  const shareMessage =
    input.dailyPlan.completionRate >= 0.5 || input.motivation.streak >= 3
      ? `${parentMessage} Compartir el progreso ahora puede reforzar el reconocimiento del esfuerzo real del alumno.`
      : `${parentMessage} Compartir un resumen corto puede ayudar a sostener el acompañamiento familiar sin sobrecargar.`;
  const inviteReason =
    activeIntervention?.type === "risk_student"
      ? "Invitar a otra familia cercana puede servir para recomendar una rutina guiada antes de que el bloqueo crezca."
      : input.evolution.progressionVelocity >= 0.7
        ? "El avance actual hace más natural recomendar Mentoria a otra familia con una experiencia real ya visible."
        : "Cuando ya hay una rutina en marcha, invitar desde un caso real convierte mejor que hacerlo en frío.";

  return { shareMessage, inviteReason };
}
