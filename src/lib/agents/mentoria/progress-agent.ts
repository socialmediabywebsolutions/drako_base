import { buildInterventionResponse } from "@/lib/mentoria/intervention-engine";
import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy } from "@/lib/mentoria/microcopy";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { MentoriaInitialLevel, MentoriaIntervention, MentoriaProgress, MentoriaSubject } from "@/lib/mentoria/types";

const INITIAL_LEVEL_SCORE_MAP: Record<MentoriaInitialLevel, { mastery: number; confidence: number }> = {
  me_cuesta_mucho: { mastery: 35, confidence: 32 },
  voy_normal: { mastery: 58, confidence: 56 },
  se_me_da_bien: { mastery: 78, confidence: 74 },
};

export function analyzeProgress(input: {
  progress: MentoriaProgress[];
  subjects: MentoriaSubject[];
  schoolYear?: string;
  age?: number;
  evolution?: StudentEvolutionProfile;
  interventions?: MentoriaIntervention[];
  motivation?: MotivationState;
}): {
  weakSubjects: string[];
  strongSubjects: string[];
  nextActions: string[];
} {
  const learningProfile =
    input.schoolYear && typeof input.age === "number"
      ? getLearningProfile({ schoolYear: input.schoolYear, age: input.age })
      : null;
  const encouragementCopy = learningProfile ? getMicrocopy(learningProfile.stage, "encouragement") : null;
  const successCopy = learningProfile ? getMicrocopy(learningProfile.stage, "success_feedback") : null;
  const errorCopy = learningProfile ? getMicrocopy(learningProfile.stage, "error_feedback") : null;
  const interventionResponse = buildInterventionResponse(input.interventions ?? []);
  const fragileMotivation = input.motivation?.motivationProfile === "fragile";
  const highMotivation = input.motivation?.motivationProfile === "high_performer";
  const decorated = input.progress.map((entry) => ({
    entry,
    subjectName: input.subjects.find((subject) => subject.id === entry.subjectId)?.name ?? "Materia",
  }));

  const weakSubjects = decorated
    .filter((item) => item.entry.masteryScore < 65 || item.entry.confidenceScore < 60)
    .map((item) => item.subjectName);
  const strongSubjects = decorated
    .filter((item) => item.entry.masteryScore >= 80 && item.entry.confidenceScore >= 75)
    .map((item) => item.subjectName);
  const evolutionWeaknesses = input.evolution?.weaknesses.slice(0, 2) ?? [];
  const evolutionStrengths = input.evolution?.strengths.slice(0, 2) ?? [];
  const highFrustration = (input.evolution?.frustrationLevel ?? 0) >= 0.7;
  const fastProgress = (input.evolution?.progressionVelocity ?? 0) >= 0.72;

  const nextActions = [
    weakSubjects[0] || evolutionWeaknesses[0]
      ? fragileMotivation || interventionResponse.toneMode === "stabilize"
        ? `${errorCopy} Priorizar una sola meta, bajar carga y comprobar comprension despues de cada paso.`
        : learningProfile?.stage === "primary"
        ? `${encouragementCopy} Reforzar ${weakSubjects[0] ?? evolutionWeaknesses[0]} con una sesion corta y muy guiada.`
        : learningProfile?.stage === "bachillerato"
          ? `${errorCopy} Reforzar ${weakSubjects[0] ?? evolutionWeaknesses[0]} con una sesion de analisis y practica dirigida.`
          : `${encouragementCopy} Reforzar ${weakSubjects[0] ?? evolutionWeaknesses[0]} con una sesion corta guiada.`
      : null,
    strongSubjects[0] || evolutionStrengths[0]
      ? highMotivation || interventionResponse.tutorMode === "stretch"
        ? `${successCopy} Elevar exigencia en ${strongSubjects[0] ?? evolutionStrengths[0]} con transferencia y autonomia.`
        : learningProfile?.stage === "primary"
        ? `${successCopy} Mantener el buen ritmo en ${strongSubjects[0] ?? evolutionStrengths[0]} con un reto corto.`
        : learningProfile?.stage === "bachillerato"
          ? `${successCopy} Mantener traccion en ${strongSubjects[0] ?? evolutionStrengths[0]} con un reto de mayor autonomia.`
          : `${successCopy} Mantener traccion en ${strongSubjects[0] ?? evolutionStrengths[0]} con un reto semanal.`
      : null,
    highFrustration
      ? learningProfile?.stage === "primary"
        ? "Baja el ritmo del reto y mete una comprobacion pequena despues de cada explicacion."
        : learningProfile?.stage === "bachillerato"
          ? "Reduce la carga por sesion y cierra cada bloque con verificacion de comprension antes de avanzar."
          : "Introduce refuerzo frecuente y objetivos breves hasta recuperar seguridad."
      : fastProgress
        ? learningProfile?.stage === "bachillerato"
          ? "Sube la exigencia con tareas de transferencia y justificacion completa del razonamiento."
          : "Aumenta un poco el reto para aprovechar la buena progresion sin perder claridad."
        : null,
    learningProfile?.stage === "primary"
      ? "Cerrar cada sesion con una mini practica para comprobar que la idea principal esta clara."
      : learningProfile?.stage === "bachillerato"
        ? "Cerrar cada sesion con una tarea de transferencia y justificacion del razonamiento."
        : "Cerrar cada sesion con un ejercicio de transferencia para medir comprension real.",
  ].filter(Boolean) as string[];

  return {
    weakSubjects,
    strongSubjects,
    nextActions,
  };
}

export function buildInitialProgressFromOnboarding(input: {
  subjectId: string;
  initialLevel: MentoriaInitialLevel;
  schoolYear?: string;
  age?: number;
}) {
  const base = INITIAL_LEVEL_SCORE_MAP[input.initialLevel];
  const learningProfile =
    input.schoolYear && typeof input.age === "number"
      ? getLearningProfile({ schoolYear: input.schoolYear, age: input.age })
      : null;
  const masteryAdjustment = learningProfile?.stage === "primary" ? -3 : learningProfile?.stage === "bachillerato" ? 4 : 0;
  const confidenceAdjustment = learningProfile?.stage === "primary" ? 2 : learningProfile?.stage === "bachillerato" ? -2 : 0;
  return {
    subjectId: input.subjectId,
    masteryScore: Math.max(0, Math.min(100, base.mastery + masteryAdjustment)),
    confidenceScore: Math.max(0, Math.min(100, base.confidence + confidenceAdjustment)),
    streakDays: 0,
    sessionsCompleted: 0,
    exercisesCompleted: 0,
    weakTopics:
      input.initialLevel === "me_cuesta_mucho"
        ? [learningProfile?.stage === "bachillerato" ? "base conceptual por reforzar" : "base inicial por reforzar"]
        : [],
    strongTopics:
      input.initialLevel === "se_me_da_bien"
        ? [learningProfile?.stage === "primary" ? "base inicial segura" : "base inicial consolidada"]
        : [],
  };
}
