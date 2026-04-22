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
import { buildTutorBehaviorPolicy, type TutorBehaviorPolicy } from "@/lib/mentoria/profile-engine";
import type { StudentLearningMemory } from "@/lib/mentoria/student-learning-memory";
import type { DynamicStudentProfile } from "@/lib/mentoria/student-profile";
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

export function composeAdaptiveTutorReply(
  teaching: MentoriaTeachingResponse,
  introCopy: string,
  policy?: TutorBehaviorPolicy | null,
): string {
  const stepsLimit = policy?.explanationLength === "short" ? 2 : policy?.explanationLength === "deep" ? 4 : 3;
  const visibleSteps = teaching.suggestedSteps.slice(0, stepsLimit);
  const emotionalOpening =
    policy?.tone === "empathetic"
      ? "Vamos despacio. Que cueste ahora no significa que no puedas con ello."
      : policy?.tone === "direct"
        ? "Voy directo: primero comprobamos la idea y luego subimos un punto."
        : null;
  const detailCue =
    policy?.detailLevel === "minimal"
      ? "Me quedo con una idea clave y un primer paso."
      : policy?.detailLevel === "analytical"
        ? "Quiero que justifiques el razonamiento, no solo el resultado."
        : null;
  const reinforcementCue =
    policy?.positiveReinforcement === "high"
      ? "Si una parte sale regular, la usamos como pista y repetimos solo ese paso."
      : policy?.positiveReinforcement === "low"
        ? "Te dare menos pistas para que ganes autonomia."
        : null;
  const memoryCue =
    policy?.preferredExplanationStyle === "visual_step_by_step" || policy?.exampleUse === "visual_step"
      ? "Te lo pongo como esquema visual: partes, orden y comprobacion."
      : policy?.preferredExplanationStyle === "concrete_examples"
        ? "Empiezo por un ejemplo concreto y luego sacamos la regla."
        : policy?.preferredExplanationStyle === "short_guided"
          ? "Lo mantenemos corto: una idea, un paso y una comprobacion."
          : policy?.preferredExplanationStyle === "challenge_first"
            ? "Primero intentas justificar la idea; si falla, doy una pista."
            : null;
  const sessionLengthCue = policy?.bestSessionLength && policy.bestSessionLength <= 14
    ? `Hoy no alargamos: bloque corto de unos ${policy.bestSessionLength} minutos.`
    : null;
  const conceptCue = policy?.memorySummary
    ? `Hoy afinamos un concepto concreto: ${policy.memorySummary}`
    : null;

  return [
    emotionalOpening,
    introCopy,
    conceptCue,
    memoryCue,
    sessionLengthCue,
    detailCue,
    teaching.explanation,
    visibleSteps.length > 0
      ? `Pasos sugeridos: ${visibleSteps.map((step, index) => `${index + 1}. ${step}`).join(" ")}`
      : null,
    reinforcementCue,
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
  dynamicProfile?: DynamicStudentProfile;
  learningMemory?: StudentLearningMemory;
  tutorPolicy?: TutorBehaviorPolicy;
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
  const tutorPolicy = input.tutorPolicy ?? (input.dynamicProfile ? buildTutorBehaviorPolicy(input.dynamicProfile) : null);
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
          input.dynamicProfile
            ? [
                `Perfil dinamico academico: etapa=${input.dynamicProfile.academic.stage}; curso=${input.dynamicProfile.academic.schoolYear}; repeticion=${input.dynamicProfile.academic.hasRepeatedCourse ? "si" : "no"}.`,
                `Perfil dinamico cognitivo: comprension=${input.dynamicProfile.cognitive.comprehensionLevel}; errorRate=${input.dynamicProfile.cognitive.errorRate.toFixed(2)}; velocidad=${input.dynamicProfile.cognitive.responseSpeed}.`,
                `Perfil dinamico emocional: frustracion=${input.dynamicProfile.emotional.frustrationLevel}; confianza=${input.dynamicProfile.emotional.confidenceLevel}; consistencia=${input.dynamicProfile.emotional.consistency}.`,
                `Perfil dinamico familiar: estructura=${input.dynamicProfile.contextual.familyStructure}; soporte=${input.dynamicProfile.contextual.supportLevel}.`,
              ].join("\n")
            : null,
          input.learningMemory
            ? [
                `Memoria evolutiva persistente: estilo=${input.learningMemory.preferredExplanationStyle}; velocidad=${input.learningMemory.averageResponseSpeed}; mejorDuracion=${input.learningMemory.bestSessionLength}; mejorFranja=${input.learningMemory.bestSessionTimeWindow}.`,
                `Tendencias persistentes: confianza=${input.learningMemory.confidenceTrend}; frustracion=${input.learningMemory.frustrationTrend}; consistencia=${input.learningMemory.consistencyTrend}; motivacion=${input.learningMemory.motivationPattern}.`,
                `Materias fuertes recordadas: ${input.learningMemory.strongestSubjects.join(", ") || "sin patron fuerte estable"}.`,
                `Materias debiles recordadas: ${input.learningMemory.weakestSubjects.join(", ") || "sin debilidad persistente"}.`,
                `Resumen interno anterior: funciono=${input.learningMemory.lastAdaptationSummary.worked}; friccion=${input.learningMemory.lastAdaptationSummary.friction}; proximoInicio=${input.learningMemory.lastAdaptationSummary.nextStart}.`,
              ].join("\n")
            : null,
          input.dynamicProfile?.memory?.activeConceptKey
            ? [
                `Memoria didactica por concepto: concepto=${input.dynamicProfile.memory.activeConceptKey}; dominio=${input.dynamicProfile.memory.activeConceptMastery}; confianza=${input.dynamicProfile.memory.activeConceptConfidence}; refuerzoPendiente=${input.dynamicProfile.memory.activeConceptNeedsReinforcement ? "si" : "no"}; apoyo=${input.dynamicProfile.memory.activeConceptSupportStyle}.`,
                `Resumen didactico activo: ${input.dynamicProfile.memory.activeConceptSummary ?? "sin resumen activo"}.`,
                input.dynamicProfile.memory.fragileConcepts?.length
                  ? `Conceptos fragiles cercanos: ${input.dynamicProfile.memory.fragileConcepts.map((item) => `${item.conceptKey}(${item.masteryLevel}, recurrencia=${item.recurrenceCount})`).join(", ")}.`
                  : null,
              ].filter(Boolean).join("\n")
            : null,
          tutorPolicy
            ? [
                `Politica viva del tutor: tono=${tutorPolicy.tone}; ritmo=${tutorPolicy.pace}; dificultad=${tutorPolicy.difficulty}; detalle=${tutorPolicy.detailLevel}; ejemplos=${tutorPolicy.exampleUse}; refuerzo positivo=${tutorPolicy.positiveReinforcement}.`,
                ...tutorPolicy.directives,
              ].join("\n")
            : null,
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

  const reply = composeAdaptiveTutorReply(teaching, introCopy, tutorPolicy);
  const tutorSummary = `Explicacion guiada de ${input.subject.name} sobre ${input.topic}, adaptada a ${input.profile.schoolYear} con tono ${input.adaptation.tone}${tutorPolicy ? `, ritmo ${tutorPolicy.pace} y dificultad ${tutorPolicy.difficulty}` : ""}.`;
  const recommendedNextStep =
    tutorPolicy?.sessionStage === "reinforcement"
      ? "Repetir el patron clave con un ejemplo corto antes de avanzar."
      : tutorPolicy?.sessionStage === "light_evaluation"
        ? "Comprobar autonomia con un reto breve y pedir justificacion."
        : tutorPolicy?.sessionStage === "guided_practice"
          ? "Resolver un micro-paso guiado y confirmar seguridad antes de subir dificultad."
          :
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
