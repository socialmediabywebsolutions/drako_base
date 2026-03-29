import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type {
  DailyPlan,
  DailyPlanPriority,
  DailyPlanTask,
  DailyPlanTaskType,
  MentoriaIntervention,
  MentoriaProgress,
  MentoriaSubject,
  StudentProfile,
} from "@/lib/mentoria/types";

type GenerateDailyPlanInput = {
  profile: StudentProfile;
  subjects: MentoriaSubject[];
  progress: MentoriaProgress[];
  evolution: StudentEvolutionProfile;
  motivation: MotivationState;
  interventions: MentoriaIntervention[];
  generatedAt?: string;
  existingPlan?: DailyPlan | null;
};

type CompleteDailyPlanTaskInput = {
  subjectId?: string;
  preferredTypes?: DailyPlanTaskType[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildReason(parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

function toPriority(evolution: StudentEvolutionProfile, motivation: MotivationState, interventions: MentoriaIntervention[]): DailyPlanPriority {
  const activeTypes = new Set(interventions.filter((item) => item.status === "active").map((item) => item.type));
  if (activeTypes.has("risk_student") || activeTypes.has("high_frustration") || evolution.frustrationLevel > 0.75 || motivation.motivationProfile === "fragile") {
    return "high";
  }
  if (activeTypes.has("low_consistency") || evolution.consistencyScore < 0.45) {
    return "medium";
  }
  return motivation.motivationProfile === "high_performer" && evolution.progressionVelocity > 0.72 ? "low" : "medium";
}

function resolveBaseDuration(input: GenerateDailyPlanInput): number {
  const preferred = clamp(input.profile.preferredStudyMinutes || 35, 20, 120);
  const interventionTypes = new Set(input.interventions.filter((item) => item.status === "active").map((item) => item.type));

  let adjusted = preferred;
  if (input.evolution.frustrationLevel > 0.75 || input.motivation.motivationProfile === "fragile") adjusted *= 0.75;
  if (input.evolution.consistencyScore < 0.3) adjusted *= 0.85;
  if (interventionTypes.has("low_consistency")) adjusted *= 0.9;
  if (input.motivation.motivationProfile === "high_performer" && input.evolution.consistencyScore > 0.65) adjusted *= 1.15;
  if (input.evolution.progressionVelocity > 0.78) adjusted *= 1.08;
  return clamp(Math.round(adjusted / 5) * 5, 15, 120);
}

function matchWeaknessSubject(subject: MentoriaSubject, weaknesses: string[]): boolean {
  const name = normalize(subject.name);
  const slug = normalize(subject.slug);
  return weaknesses.some((weakness) => {
    const value = normalize(weakness);
    return value.includes(name) || value.includes(slug) || name.includes(value) || slug.includes(value);
  });
}

function orderSubjects(input: GenerateDailyPlanInput): MentoriaSubject[] {
  const progressBySubject = new Map(input.progress.map((item) => [item.subjectId, item]));
  return [...input.subjects].sort((left, right) => {
    const leftWeak = matchWeaknessSubject(left, input.evolution.weaknesses) ? 1 : 0;
    const rightWeak = matchWeaknessSubject(right, input.evolution.weaknesses) ? 1 : 0;
    if (leftWeak !== rightWeak) return rightWeak - leftWeak;
    const leftMastery = progressBySubject.get(left.id)?.masteryScore ?? 50;
    const rightMastery = progressBySubject.get(right.id)?.masteryScore ?? 50;
    return leftMastery - rightMastery;
  });
}

function buildTaskId(planDate: string, subject: MentoriaSubject, type: DailyPlanTaskType, index: number): string {
  return `${planDate}:${subject.slug}:${type}:${index}`;
}

function buildTaskSet(input: GenerateDailyPlanInput, planDate: string): DailyPlanTask[] {
  const subjects = orderSubjects(input);
  const weakest = subjects[0];
  const second = subjects[1] ?? subjects[0];
  const highSupport = input.evolution.frustrationLevel > 0.75 || input.motivation.motivationProfile === "fragile";
  const highMomentum = input.motivation.motivationProfile === "high_performer" && input.evolution.progressionVelocity > 0.7;
  const lowConsistency = input.evolution.consistencyScore < 0.3;

  const skeleton: Array<{ subject: MentoriaSubject; type: DailyPlanTaskType; difficulty: number }> = [];

  if (highSupport) {
    skeleton.push(
      { subject: weakest, type: "practice", difficulty: 2 },
      { subject: weakest, type: "review", difficulty: 1 },
    );
    if (!lowConsistency && second) {
      skeleton.push({ subject: second, type: "practice", difficulty: 2 });
    }
  } else if (highMomentum) {
    skeleton.push(
      { subject: weakest, type: "review", difficulty: 3 },
      { subject: second, type: "practice", difficulty: 4 },
      { subject: weakest, type: "challenge", difficulty: 4 },
      { subject: (subjects[2] ?? second), type: "challenge", difficulty: 5 },
    );
  } else {
    skeleton.push(
      { subject: weakest, type: "review", difficulty: 2 },
      { subject: second, type: "practice", difficulty: 3 },
      { subject: weakest, type: "challenge", difficulty: input.evolution.progressionVelocity > 0.62 ? 4 : 3 },
    );
  }

  return skeleton.slice(0, 4).map((item, index) => ({
    id: buildTaskId(planDate, item.subject, item.type, index),
    subject: item.subject.name,
    subjectId: item.subject.id,
    type: item.type,
    difficulty: clamp(item.difficulty, 1, 5),
    completed: input.existingPlan?.completedTaskIds.includes(buildTaskId(planDate, item.subject, item.type, index)) ?? false,
  }));
}

export function generateDailyPlan(input: GenerateDailyPlanInput): DailyPlan {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const planDate = generatedAt.slice(0, 10);
  const priority = toPriority(input.evolution, input.motivation, input.interventions);
  const recommendedDuration = resolveBaseDuration(input);
  const tasks = buildTaskSet(input, planDate);
  const completedTaskIds = tasks.filter((task) => task.completed).map((task) => task.id);
  const reasons: string[] = [];

  if (input.evolution.frustrationLevel > 0.75) reasons.push("Se reduce la carga para sostener el avance con menos friccion.");
  if (input.evolution.consistencyScore < 0.3) reasons.push("Se priorizan bloques cortos para recuperar regularidad diaria.");
  if (input.motivation.motivationProfile === "fragile") reasons.push("Se buscan logros tempranos para proteger el compromiso.");
  if (input.motivation.motivationProfile === "high_performer" && input.evolution.progressionVelocity > 0.7) {
    reasons.push("Se abre espacio para reto real porque el alumno esta respondiendo bien.");
  }
  if (reasons.length === 0) reasons.push("Se equilibra consolidacion, practica y reto segun el estado actual del alumno.");

  return {
    id: input.existingPlan?.id ?? crypto.randomUUID(),
    tenantId: input.existingPlan?.tenantId ?? input.profile.tenantId,
    studentId: input.profile.id,
    planDate,
    recommendedDuration,
    tasks,
    priority,
    adaptationReason: buildReason(reasons),
    generatedAt,
    createdAt: input.existingPlan?.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    completedTaskIds,
    completionRate: tasks.length ? completedTaskIds.length / tasks.length : 0,
  };
}

export function completeDailyPlanTask(plan: DailyPlan, input: CompleteDailyPlanTaskInput): DailyPlan {
  const preferredTypes = input.preferredTypes ?? ["practice", "review", "challenge"];
  const target = plan.tasks.find(
    (task) =>
      !plan.completedTaskIds.includes(task.id) &&
      (!input.subjectId || task.subjectId === input.subjectId) &&
      preferredTypes.includes(task.type),
  ) ?? plan.tasks.find((task) => !plan.completedTaskIds.includes(task.id) && (!input.subjectId || task.subjectId === input.subjectId));

  if (!target) {
    return plan;
  }

  const completedTaskIds = Array.from(new Set([...plan.completedTaskIds, target.id]));
  const tasks = plan.tasks.map((task) => (task.id === target.id ? { ...task, completed: true } : task));

  return {
    ...plan,
    tasks,
    completedTaskIds,
    completionRate: tasks.length ? completedTaskIds.length / tasks.length : 0,
    updatedAt: new Date().toISOString(),
  };
}
