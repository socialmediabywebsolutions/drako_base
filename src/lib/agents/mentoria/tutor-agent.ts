import {
  buildMentoriaAgentContext,
  type MentoriaAgentHistoryTurn,
  type MentoriaTeachingResponse,
} from "@/lib/agents/mentoria/base-agent";
import { languageAgent } from "@/lib/agents/mentoria/language-agent";
import { mathAgent } from "@/lib/agents/mentoria/math-agent";
import { scienceAgent } from "@/lib/agents/mentoria/science-agent";
import type { EmotionalAdaptation } from "@/lib/agents/mentoria/emotional-orchestrator";
import { buildSubjectBrief } from "@/lib/agents/mentoria/subject-agent";
import { generateFallbackTeachingResponse } from "@/lib/agents/mentoria/ai-fallback";
import { buildInterventionResponse } from "@/lib/mentoria/intervention-engine";
import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy } from "@/lib/mentoria/microcopy";
import { buildEvolutionAdaptiveSignals } from "@/lib/mentoria/student-evolution";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DailyPlan, MentoriaBillingSummary, MentoriaIntervention, MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";

function selectSubjectAgent(subject: MentoriaSubject) {
  const slug = subject.slug.toLowerCase();
  if (slug.includes("matematic")) return mathAgent;
  if (slug.includes("lengua") || slug.includes("language") || slug.includes("ingles")) return languageAgent;
  if (slug.includes("ciencias") || slug.includes("science")) return scienceAgent;
  return scienceAgent;
}

function composeReply(teaching: MentoriaTeachingResponse, introCopy: string): string {
  return [
    introCopy,
    teaching.explanation,
    teaching.suggestedSteps.length > 0
      ? `Pasos sugeridos: ${teaching.suggestedSteps.map((step, index) => `${index + 1}. ${step}`).join(" ")}`
      : null,
    `Pregunta de refuerzo: ${teaching.reinforcementQuestion}`,
  ].filter(Boolean).join("\n\n");
}

export async function runTutorAgent(input: {
  profile: StudentProfile;
  subject: MentoriaSubject;
  topic: string;
  studentMessage: string;
  adaptation: EmotionalAdaptation;
  evolution: StudentEvolutionProfile;
  interventions: MentoriaIntervention[];
  motivation: MotivationState;
  dailyPlan: DailyPlan;
  billing: MentoriaBillingSummary;
  history?: MentoriaAgentHistoryTurn[];
}): Promise<{
  reply: string;
  tutorSummary: string;
  recommendedNextStep: string;
  totalTokens: number;
  explanation: string;
  suggestedSteps: string[];
  reinforcementQuestion: string;
  provider: string;
  model?: string;
}> {
  const brief = buildSubjectBrief({
    subject: input.subject,
    profile: input.profile,
    topic: input.topic,
  });
  const learningProfile = getLearningProfile(input.profile);
  const evolutionSignals = buildEvolutionAdaptiveSignals(input.evolution, { subject: input.subject });
  const interventionResponse = buildInterventionResponse(input.interventions);
  const introCopy = getMicrocopy(learningProfile.stage, "explanation_intro");
  const encouragementCopy = getMicrocopy(learningProfile.stage, "encouragement");
  const todaysTasks = input.dailyPlan.tasks
    .filter((task) => !task.completed && (!task.subjectId || task.subjectId === input.subject.id))
    .map((task) => `${task.type} dificultad ${task.difficulty}`)
    .join(", ");
  const subjectAgent = selectSubjectAgent(input.subject);
  let teaching: MentoriaTeachingResponse & { totalTokens: number; provider: string; model?: string; isFallback?: boolean };
  
  try {
    teaching = await subjectAgent.run(
      {
        profile: input.profile,
        subject: input.subject,
        topic: input.topic,
        studentMessage: [
          `Mensaje del alumno: ${input.studentMessage}`,
          brief.systemPrompt,
          `Profundidad requerida: ${input.adaptation.explanationDepth}.`,
          `Ajuste de dificultad: ${input.adaptation.difficultyAdjustment}.`,
          `Preferencia de aprendizaje: ${input.profile.learningPreference}.`,
          `Frustracion evolutiva: ${input.evolution.frustrationLevel.toFixed(2)}.`,
          `Consistencia evolutiva: ${input.evolution.consistencyScore.toFixed(2)}.`,
          `Velocidad de progresion: ${input.evolution.progressionVelocity.toFixed(2)}.`,
          `Fortalezas recordadas: ${input.evolution.strengths.join(", ") || "sin fortalezas registradas"}.`,
          `Debilidades activas: ${input.evolution.weaknesses.join(", ") || "sin debilidades registradas"}.`,
          `Modo adaptativo: apoyo=${evolutionSignals.supportLevel}; reto=${evolutionSignals.challengeLevel}; explicacion=${evolutionSignals.explanationMode}; refuerzo=${evolutionSignals.reinforcementFrequency}.`,
          `Intervencion activa: tono=${interventionResponse.toneMode}; planner=${interventionResponse.plannerMode}; tutor=${interventionResponse.tutorMode}.`,
          `Motivacion: perfil=${input.motivation.motivationProfile}; racha=${input.motivation.streak}; esfuerzo=${input.motivation.effortScore.toFixed(2)}; nivel=${input.motivation.level}; puntos=${input.motivation.rewardPoints}.`,
          `Logros activos: ${input.motivation.achievements.join(", ") || "sin logros activos"}.`,
          `Plan diario: prioridad=${input.dailyPlan.priority}; duracion=${input.dailyPlan.recommendedDuration}; razon=${input.dailyPlan.adaptationReason}.`,
          `Plan comercial del alumno: ${input.billing.planCode}; estado=${input.billing.subscriptionStatus}.`,
          `Tareas pendientes de hoy para esta materia: ${todaysTasks || "sin tareas pendientes especificas para esta materia"}.`,
          input.adaptation.tutorInstruction,
          evolutionSignals.promptDirectives.join(" "),
          interventionResponse.directives.join(" "),
          `Microcopy de acompanamiento: ${encouragementCopy}.`,
          input.motivation.motivationProfile === "fragile"
            ? "Haz visible el progreso pequeno y evita que el cierre suene a evaluacion dura."
            : input.motivation.motivationProfile === "high_performer"
              ? "Reconoce la buena racha y conecta la respuesta con un reto nuevo."
              : "Refuerza el avance real sin sobreactuar ni gamificar de forma vacia.",
        ].join("\n"),
      },
      buildMentoriaAgentContext({
        profile: {
          id: input.profile.id,
          age: input.profile.age,
          schoolYear: input.profile.schoolYear,
        },
        history: input.history ?? [],
      }),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[TutorAgent] AI call failed, using fallback:", errorMessage);
    
    const fallback = generateFallbackTeachingResponse({
      subject: input.subject,
      topic: input.topic,
      difficultyLevel: input.adaptation.difficultyAdjustment,
      failureReason: errorMessage as any,
    });
    
    teaching = {
      explanation: fallback.explanation,
      suggestedSteps: fallback.suggestedSteps,
      reinforcementQuestion: fallback.reinforcementQuestion,
      totalTokens: 0,
      provider: "fallback",
      isFallback: true,
    };
  }

  const reply = composeReply(teaching, introCopy);
  const tutorSummary = `Explicacion guiada de ${input.subject.name} sobre ${input.topic}, adaptada a ${input.profile.schoolYear} con tono ${input.adaptation.tone}.`;
  const recommendedNextStep =
    input.dailyPlan.tasks.some((task) => !task.completed && task.subjectId === input.subject.id && task.type === "challenge")
      ? "Cerrar la comprension con un reto corto alineado al plan del dia."
      : input.adaptation.explanationDepth === "step_by_step" || interventionResponse.tutorMode === "gentle" || evolutionSignals.supportLevel === "high"
      ? "Resolver un paso corto guiado antes de subir dificultad."
      : interventionResponse.tutorMode === "stretch" || evolutionSignals.challengeLevel === "up"
        ? "Practicar con un reto de mayor autonomia y justificar cada decision."
    : "Practicar con un ejercicio inmediato para consolidar comprension.";

  return {
    reply,
    tutorSummary,
    recommendedNextStep,
    totalTokens: teaching.totalTokens,
    explanation: teaching.explanation,
    suggestedSteps: teaching.suggestedSteps,
    reinforcementQuestion: teaching.reinforcementQuestion,
    provider: teaching.provider,
    model: teaching.model,
  };
}
