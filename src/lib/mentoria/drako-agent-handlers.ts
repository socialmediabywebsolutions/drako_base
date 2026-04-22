import { createAgentResponse, registerAgent, type AgentTask } from "@/lib/drako/agent-core";
import { createContentRequest, executeContentRequest } from "@/lib/drako/content";
import type { MentoriaAgentHistoryTurn } from "@/lib/agents/mentoria/base-agent";
import type { EmotionalAdaptation } from "@/lib/agents/mentoria/emotional-orchestrator";
import { analyzeProgress } from "@/lib/agents/mentoria/progress-agent";
import { runTutorAgent } from "@/lib/agents/mentoria/tutor-agent";
import { buildInterventionResponse } from "@/lib/mentoria/intervention-engine";
import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy } from "@/lib/mentoria/microcopy";
import type { TutorBehaviorPolicy } from "@/lib/mentoria/profile-engine";
import type { StudentLearningMemory } from "@/lib/mentoria/student-learning-memory";
import type { DynamicStudentProfile } from "@/lib/mentoria/student-profile";
import { buildEvolutionAdaptiveSignals } from "@/lib/mentoria/student-evolution";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DailyPlan, MentoriaBillingSummary, MentoriaIntervention, MentoriaProgress, MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";

type TutorTaskInput = {
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
};

type ExerciseGeneratorTaskInput = {
  profile: StudentProfile;
  subject: MentoriaSubject;
  topic: string;
  difficultyLevel: string;
  evolution: StudentEvolutionProfile;
  interventions: MentoriaIntervention[];
  motivation: MotivationState;
  dailyPlan: DailyPlan;
  billing: MentoriaBillingSummary;
  learningMemory?: StudentLearningMemory;
};

type ProgressEvaluatorTaskInput = {
  progress: MentoriaProgress[];
  subjects: MentoriaSubject[];
  schoolYear?: string;
  age?: number;
  evolution?: StudentEvolutionProfile;
  interventions?: MentoriaIntervention[];
  motivation?: MotivationState;
};

function parseExercisePayload(value: string): {
  prompt?: string;
  expectedCompetency?: string;
  hints?: string[];
  answerFormat?: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const objectStart = value.indexOf("{");
    const objectEnd = value.lastIndexOf("}");
    const candidate =
      fencedMatch?.[1]?.trim() ??
      (objectStart >= 0 && objectEnd > objectStart ? value.slice(objectStart, objectEnd + 1).trim() : "");

    if (!candidate) {
      return {};
    }

    try {
      parsed = JSON.parse(candidate);
    } catch {
      return {};
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  return parsed as {
    prompt?: string;
    expectedCompetency?: string;
    hints?: string[];
    answerFormat?: string;
  };
}

async function tutorHandler(task: AgentTask<TutorTaskInput>) {
  const result = await runTutorAgent(task.input);
  return createAgentResponse({
    task,
    reply: result.reply,
    output: {
      tutorSummary: result.tutorSummary,
      recommendedNextStep: result.recommendedNextStep,
      explanation: result.explanation,
      suggestedSteps: result.suggestedSteps,
      reinforcementQuestion: result.reinforcementQuestion,
    },
    recommendations: [result.recommendedNextStep],
    usage: {
      tokens: result.totalTokens,
    },
    metadata: {
      subjectId: task.input.subject.id,
      provider: result.provider,
      model: result.model,
    },
  });
}

async function exerciseGeneratorHandler(task: AgentTask<ExerciseGeneratorTaskInput>) {
  const learningProfile = getLearningProfile(task.input.profile);
  const evolutionSignals = buildEvolutionAdaptiveSignals(task.input.evolution, { subject: task.input.subject });
  const interventionResponse = buildInterventionResponse(task.input.interventions);
  const introCopy = getMicrocopy(learningProfile.stage, "explanation_intro");
  const errorCopy = getMicrocopy(learningProfile.stage, "error_feedback");
  const plannedTask = task.input.dailyPlan.tasks.find((item) => !item.completed && item.subjectId === task.input.subject.id);
  const plannedDifficultyValue = plannedTask?.difficulty ?? 3;
  const plannedDifficulty =
    plannedTask
      ? plannedDifficultyValue >= 4
        ? "stretch"
        : plannedDifficultyValue === 3
          ? "medium"
          : "guided"
      : task.input.difficultyLevel;
  const effectiveDifficulty =
    task.input.learningMemory?.frustrationTrend === "rising" || interventionResponse.tutorMode === "gentle" || evolutionSignals.challengeLevel === "down"
      ? "guided"
      : task.input.learningMemory?.confidenceTrend === "rising" || interventionResponse.tutorMode === "stretch" || evolutionSignals.challengeLevel === "up"
        ? "stretch"
        : plannedDifficulty;

  const contentRequest = createContentRequest({
    kind: "mentoria.exercise-generation",
    context: task.context,
    input: task.input,
    metadata: {
      temperature: 0.3,
      maxTokens: 800,
      messages: [
        {
          role: "system",
          content: [
            "Genera un ejercicio educativo breve en JSON con las claves prompt, expectedCompetency, hints y answerFormat.",
            "No des la solucion.",
            "Las hints deben ser exactamente un array de tres pistas progresivas.",
            `Tramo: ${learningProfile.stage}.`,
            `Tono: ${learningProfile.tone}.`,
            `Estilo explicativo: ${learningProfile.explanationStyle}.`,
            `Modo evolutivo: apoyo=${evolutionSignals.supportLevel}; reto=${evolutionSignals.challengeLevel}; explicacion=${evolutionSignals.explanationMode}.`,
            `Modo de intervencion: tono=${interventionResponse.toneMode}; tutor=${interventionResponse.tutorMode}.`,
            `Motivacion: perfil=${task.input.motivation.motivationProfile}; esfuerzo=${task.input.motivation.effortScore.toFixed(2)}; racha=${task.input.motivation.streak}.`,
            `Plan comercial: ${task.input.billing.planCode}; estado=${task.input.billing.subscriptionStatus}.`,
            `Plan diario: prioridad=${task.input.dailyPlan.priority}; razon=${task.input.dailyPlan.adaptationReason}; tarea actual=${plannedTask ? `${plannedTask.type} dificultad ${plannedTask.difficulty}` : "sin tarea especifica"}.`,
            `Debilidades activas: ${task.input.evolution.weaknesses.join(", ") || "sin debilidades activas"}.`,
            task.input.learningMemory
              ? `Memoria persistente: estilo=${task.input.learningMemory.preferredExplanationStyle}; mejorDuracion=${task.input.learningMemory.bestSessionLength}; confianza=${task.input.learningMemory.confidenceTrend}; frustracion=${task.input.learningMemory.frustrationTrend}.`
              : "Memoria persistente: sin memoria longitudinal todavia.",
            `Microcopy de introduccion: ${introCopy}.`,
            `Microcopy de ayuda: ${errorCopy}.`,
            interventionResponse.tutorMode === "gentle" || evolutionSignals.supportLevel === "high"
              ? "Genera una consigna corta, una competencia concreta y pistas graduales."
              : interventionResponse.tutorMode === "stretch" || evolutionSignals.challengeLevel === "up"
                ? "Genera una tarea con transferencia real, menos pista directa y respuesta mas razonada."
                : "Mantiene dificultad media con progresion de pistas equilibrada.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Materia=${task.input.subject.name}; tema=${task.input.topic}; edad=${task.input.profile.age}; curso=${task.input.profile.schoolYear}; dificultad=${effectiveDifficulty}; tipo=${plannedTask?.type ?? "practice"}`,
        },
      ],
    },
  });

  const artifact = await executeContentRequest(contentRequest);
  const parsed = parseExercisePayload(artifact.payload.text);
  const fallbackPrompt = artifact.payload.text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim()
    .split(/\n{2,}/)[0]
    ?.trim();
  const hints =
    Array.isArray(parsed.hints) && parsed.hints.length >= 3
      ? parsed.hints.slice(0, 3)
      : learningProfile.stage === "primary"
        ? [
            "Empieza por identificar que representa cada parte de la tarea.",
            "Haz un paso pequeño y comprueba si tiene sentido antes de seguir.",
            "Explica la respuesta con tus palabras para validar que la entiendes.",
          ]
        : [
            "Identifica el concepto principal antes de resolver.",
            "Relaciona los datos del ejercicio con el procedimiento correcto.",
            "Justifica por que tu respuesta encaja con el problema.",
          ];
  const prompt =
    parsed.prompt?.trim() ||
    fallbackPrompt ||
    `${introCopy} Resuelve una actividad guiada sobre ${task.input.topic} en ${task.input.subject.name}.`;
  const expectedCompetency =
    parsed.expectedCompetency?.trim() || `Comprension aplicada de ${task.input.topic} en ${task.input.subject.name}.`;
  const answerFormat =
    parsed.answerFormat?.trim() ||
    (effectiveDifficulty === "stretch" ? "respuesta razonada con justificacion" : "respuesta guiada breve");

  return createAgentResponse({
    task,
    reply: prompt,
    output: {
      prompt,
      expectedCompetency,
      hints,
      answerFormat,
      difficultyLevel: effectiveDifficulty,
    },
    usage: {
      tokens: artifact.payload.totalTokens,
    },
    metadata: {
      provider: artifact.payload.provider,
    },
  });
}

async function progressEvaluatorHandler(task: AgentTask<ProgressEvaluatorTaskInput>) {
  const output = analyzeProgress(task.input);
  return createAgentResponse({
    task,
    reply: output.nextActions[0] ?? "Sin recomendaciones disponibles.",
    output,
    recommendations: output.nextActions,
  });
}

let mentoriaAgentsRegistered = false;

export function ensureMentoriaAgentHandlersRegistered(): void {
  if (mentoriaAgentsRegistered) {
    return;
  }
  registerAgent("tutor", tutorHandler);
  registerAgent("exercise-generator", exerciseGeneratorHandler);
  registerAgent("progress-evaluator", progressEvaluatorHandler);
  mentoriaAgentsRegistered = true;
}
