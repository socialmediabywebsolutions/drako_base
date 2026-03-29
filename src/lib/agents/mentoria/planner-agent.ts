import { analyzeProgress } from "@/lib/agents/mentoria/progress-agent";
import { buildInterventionResponse } from "@/lib/mentoria/intervention-engine";
import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy } from "@/lib/mentoria/microcopy";
import { buildEvolutionAdaptiveSignals } from "@/lib/mentoria/student-evolution";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DailyPlan, MentoriaBillingSummary, MentoriaIntervention, MentoriaProgress, MentoriaSubject, ParentAccount, StudentProfile, StudyPlanBlock } from "@/lib/mentoria/types";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];

export function buildStudyPlan(input: {
  profile: StudentProfile;
  subjects: MentoriaSubject[];
  progress: MentoriaProgress[];
  parents?: ParentAccount[];
  evolution: StudentEvolutionProfile;
  interventions: MentoriaIntervention[];
  motivation: MotivationState;
  dailyPlan: DailyPlan;
  billing: MentoriaBillingSummary;
}): { goalsSummary: string; blocks: StudyPlanBlock[] } {
  const analysis = analyzeProgress({
    progress: input.progress,
    subjects: input.subjects,
    schoolYear: input.profile.schoolYear,
    age: input.profile.age,
    motivation: input.motivation,
  });
  const learningProfile = getLearningProfile(input.profile);
  const evolutionSignals = buildEvolutionAdaptiveSignals(input.evolution);
  const interventionResponse = buildInterventionResponse(input.interventions);
  const plannerMessage = getMicrocopy(learningProfile.stage, "planner_message");
  const supervisionLevel = input.parents?.[0]?.supervisionLevel ?? "balanced";
  const dailyStudyMinutes = input.parents?.length
    ? Math.max(20, Math.round(input.parents.reduce((total, parent) => total + parent.dailyStudyMinutes, 0) / input.parents.length))
    : input.profile.preferredStudyMinutes;
  const orderedSubjects = [...input.subjects].sort((left, right) => {
    const leftProgress = input.progress.find((item) => item.subjectId === left.id);
    const rightProgress = input.progress.find((item) => item.subjectId === right.id);
    return (leftProgress?.masteryScore ?? 50) - (rightProgress?.masteryScore ?? 50);
  });

  const blocks = DAYS.map((day, index) => {
    const subject = orderedSubjects[index % Math.max(1, orderedSubjects.length)];
    const subjectSignals = buildEvolutionAdaptiveSignals(input.evolution, { subject });
    const focusLabel =
      input.motivation.motivationProfile === "fragile" || interventionResponse.plannerMode === "support" || subjectSignals.supportLevel === "high"
        ? "acompanado"
        : learningProfile.stage === "primary"
        ? "acompanado"
        : learningProfile.stage === "eso"
          ? index < 2 ? "guiado" : "activo"
          : supervisionLevel === "close"
            ? "acompanado"
            : "autonomo";
    return {
      id: crypto.randomUUID(),
      day,
      subjectId: subject.id,
      title: `${subject.name} con foco ${focusLabel}`,
      goal:
        index === 0 && (subjectSignals.prioritizedWeaknesses[0] || analysis.weakSubjects[0])
          ? `Reforzar ${subjectSignals.prioritizedWeaknesses[0] ?? analysis.weakSubjects[0]}`
          : input.motivation.motivationProfile === "high_performer" || interventionResponse.plannerMode === "accelerate" || subjectSignals.challengeLevel === "up"
            ? `Profundizar ${subject.name} con transferencia`
            : `Consolidar ${subject.name}`,
      durationMinutes: Math.max(
        20,
        Math.min(
          input.motivation.motivationProfile === "fragile" || interventionResponse.plannerMode === "support" || subjectSignals.supportLevel === "high"
            ? Math.round(dailyStudyMinutes * 0.85)
            : input.motivation.motivationProfile === "high_performer" || interventionResponse.plannerMode === "accelerate" || subjectSignals.challengeLevel === "up"
              ? Math.round(dailyStudyMinutes * 1.1)
              : dailyStudyMinutes,
          input.profile.preferredStudyMinutes || dailyStudyMinutes,
        ),
      ),
      focusMode: true,
    };
  });
  const dailyPlanSummary = input.dailyPlan.tasks
    .slice(0, 3)
    .map((task) => `${task.subject} (${task.type})`)
    .join(", ");

  return {
    goalsSummary:
      analysis.weakSubjects.length > 0 || evolutionSignals.prioritizedWeaknesses.length > 0 || interventionResponse.plannerMode === "support" || input.motivation.motivationProfile === "fragile"
        ? learningProfile.stage === "primary"
          ? `${plannerMessage} Semana para reforzar ${(evolutionSignals.prioritizedWeaknesses.length ? evolutionSignals.prioritizedWeaknesses : analysis.weakSubjects).join(", ")} con pasos cortos y constancia.`
          : learningProfile.stage === "eso"
            ? `${plannerMessage} Semana centrada en reforzar ${(evolutionSignals.prioritizedWeaknesses.length ? evolutionSignals.prioritizedWeaknesses : analysis.weakSubjects).join(", ")} sin perder continuidad en las materias fuertes.`
            : `${plannerMessage} Semana de refuerzo estrategico en ${(evolutionSignals.prioritizedWeaknesses.length ? evolutionSignals.prioritizedWeaknesses : analysis.weakSubjects).join(", ")} manteniendo autonomia en el resto del itinerario.`
        : learningProfile.stage === "primary"
          ? `${plannerMessage} Semana equilibrada para comprender mejor, practicar con calma y mantener el habito.`
          : learningProfile.stage === "eso"
            ? `${plannerMessage} Semana de consolidacion con equilibrio entre comprension, practica y autonomia.`
            : input.motivation.motivationProfile === "high_performer" || interventionResponse.plannerMode === "accelerate" || evolutionSignals.challengeLevel === "up"
              ? `${plannerMessage} Semana de consolidacion avanzada con foco en analisis, autonomia y transferencia de aprendizaje. Hoy el ritmo se apoya en ${dailyPlanSummary}. Plan activo: ${input.billing.planLabel}.`
              : `${plannerMessage} Semana de consolidacion con foco en analisis, autonomia y transferencia de aprendizaje. Hoy el ritmo se apoya en ${dailyPlanSummary}. Plan activo: ${input.billing.planLabel}.`,
    blocks,
  };
}
