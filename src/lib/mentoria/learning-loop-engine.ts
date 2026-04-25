import type {
  DailyPlan,
  DailyPlanTaskType,
  MentoriaIntervention,
  MentoriaProgress,
  MentoriaSubject,
  StudentProfile,
} from "@/lib/mentoria/types";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

export { resolveLearningLoopDecision, type LearningLoopDecision } from "@/lib/mentoria/learning-loop";

export function generateDailyPlan(input: {
  profile: StudentProfile;
  subjects: MentoriaSubject[];
  progress: MentoriaProgress[];
  evolution: StudentEvolutionProfile;
  subjectEvolutions?: StudentEvolutionProfile[];
  motivation: MotivationState;
  interventions: MentoriaIntervention[];
  existingPlan?: DailyPlan | null;
}): DailyPlan {
  const now = new Date().toISOString();
  const planDate = now.slice(0, 10);
  const progressBySubjectId = new Map(input.progress.map((item) => [item.subjectId, item]));
  const evolutionBySubjectSlug = new Map(
    (input.subjectEvolutions ?? []).map((profile) => [profile.subjectSlug, profile]),
  );
  const tasks = input.subjects
    .map((subject, index) => {
      const progress = progressBySubjectId.get(subject.id);
      const subjectEvolution = evolutionBySubjectSlug.get(subject.slug) ?? null;
      const mastery = progress?.masteryScore ?? 45;
      const type: DailyPlanTaskType =
        subjectEvolution?.frustrationLevel && subjectEvolution.frustrationLevel >= 0.72
          ? "review"
          : mastery < 45
          ? "review"
          : mastery < 70
            ? "practice"
            : "challenge";
      return {
        id: input.existingPlan?.tasks[index]?.id ?? crypto.randomUUID(),
        subject: subject.name,
        subjectId: subject.id,
        type,
        difficulty:
          subjectEvolution?.frustrationLevel && subjectEvolution.frustrationLevel >= 0.72
            ? 1
            : subjectEvolution?.progressionVelocity && subjectEvolution.progressionVelocity >= 0.82
              ? 3
              : mastery < 45 ? 1 : mastery < 70 ? 2 : 3,
        completed: false,
      };
    })
    .sort((left, right) => left.difficulty - right.difficulty)
    .slice(0, Math.max(1, Math.min(3, input.subjects.length)));

  const priority =
    input.interventions.some((item) => item.severity === "critical" || item.severity === "high")
      ? "high"
      : input.motivation.motivationProfile === "fragile"
        ? "medium"
        : "low";

  return {
    id: input.existingPlan?.id ?? crypto.randomUUID(),
    tenantId: input.profile.tenantId,
    studentId: input.profile.id,
    planDate,
    recommendedDuration: input.profile.preferredStudyMinutes,
    tasks,
    priority,
    adaptationReason: `Plan ajustado a ${input.evolution.weaknesses[0] ?? "la materia activa"} y al estado actual del alumno.`,
    generatedAt: now,
    createdAt: input.existingPlan?.createdAt ?? now,
    updatedAt: now,
    completedTaskIds: input.existingPlan?.completedTaskIds ?? [],
    completionRate: 0,
  };
}

export function completeDailyPlanTask(
  plan: DailyPlan,
  input: { subjectId?: string; preferredTypes?: Array<"practice" | "review" | "challenge"> },
): DailyPlan {
  const preferredTypes = input.preferredTypes ?? [];
  let completedTaskId: string | null = null;
  const tasks = plan.tasks.map((task) => {
    const subjectMatch = !input.subjectId || task.subjectId === input.subjectId;
    const typeMatch = preferredTypes.length === 0 || preferredTypes.includes(task.type);
    if (!completedTaskId && !task.completed && subjectMatch && typeMatch) {
      completedTaskId = task.id;
      return { ...task, completed: true };
    }
    return task;
  });
  const completedTaskIds = Array.from(new Set([
    ...plan.completedTaskIds,
    ...(completedTaskId ? [completedTaskId] : []),
  ]));
  const completionRate = tasks.length === 0
    ? 0
    : Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100);
  return {
    ...plan,
    tasks,
    completedTaskIds,
    completionRate,
    updatedAt: new Date().toISOString(),
  };
}
