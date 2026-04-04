import { runMentoriaLlm } from "@/lib/agents/mentoria/llm-client";
import { generateFallbackExercise, generateFallbackCorrection } from "@/lib/agents/mentoria/ai-fallback";
import { buildInterventionResponse } from "@/lib/mentoria/intervention-engine";
import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy } from "@/lib/mentoria/microcopy";
import { buildEvolutionAdaptiveSignals } from "@/lib/mentoria/student-evolution";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DailyPlan, MentoriaBillingSummary, MentoriaExercise, MentoriaIntervention, MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1] ?? value.slice(value.indexOf("{"), value.lastIndexOf("}") + 1);
    if (!candidate || !candidate.trim().startsWith("{")) {
      return null;
    }
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }
}

export async function generateExercise(input: {
  profile: StudentProfile;
  subject: MentoriaSubject;
  topic: string;
  difficultyLevel: string;
  entryMode?: "resume_session" | "gentle_restart" | "momentum_push" | "plan_task" | "entry";
  promptInstruction?: string;
  evolution: StudentEvolutionProfile;
  interventions: MentoriaIntervention[];
  motivation: MotivationState;
  dailyPlan: DailyPlan;
  billing: MentoriaBillingSummary;
}): Promise<{
  prompt: string;
  expectedCompetency: string;
  hints: string[];
  answerFormat: string;
  difficultyLevel: string;
}> {
  const learningProfile = getLearningProfile(input.profile);
  const evolutionSignals = buildEvolutionAdaptiveSignals(input.evolution, { subject: input.subject });
  const interventionResponse = buildInterventionResponse(input.interventions);
  const introCopy = getMicrocopy(learningProfile.stage, "explanation_intro");
  const errorCopy = getMicrocopy(learningProfile.stage, "error_feedback");
  const plannedTask = input.dailyPlan.tasks.find((task) => !task.completed && task.subjectId === input.subject.id);
  const plannedDifficultyValue = plannedTask?.difficulty ?? 3;
  const plannedDifficulty =
    plannedTask
      ? plannedDifficultyValue >= 4
        ? "stretch"
        : plannedDifficultyValue === 3
          ? "medium"
          : "guided"
      : input.difficultyLevel;
  const effectiveDifficulty =
    interventionResponse.tutorMode === "gentle" || evolutionSignals.challengeLevel === "down"
      ? "guided"
      : interventionResponse.tutorMode === "stretch" || evolutionSignals.challengeLevel === "up"
        ? "stretch"
        : plannedDifficulty;

  try {
    const llm = await runMentoriaLlm([
      {
        role: "system",
        content:
          [
            "Genera un ejercicio educativo breve en JSON con las claves prompt, expectedCompetency, hints y answerFormat.",
            "No des la solucion. Las hints deben ser un array de tres pistas progresivas.",
            `Tramo: ${learningProfile.stage}.`,
            `Tono: ${learningProfile.tone}.`,
            `Estilo explicativo: ${learningProfile.explanationStyle}.`,
            `Modo evolutivo: apoyo=${evolutionSignals.supportLevel}; reto=${evolutionSignals.challengeLevel}; explicacion=${evolutionSignals.explanationMode}.`,
            `Modo de intervencion: tono=${interventionResponse.toneMode}; tutor=${interventionResponse.tutorMode}.`,
            `Motivacion: perfil=${input.motivation.motivationProfile}; esfuerzo=${input.motivation.effortScore.toFixed(2)}; racha=${input.motivation.streak}.`,
            `Modo de entrada: ${input.entryMode ?? "default"}.`,
            `Plan comercial: ${input.billing.planCode}; estado=${input.billing.subscriptionStatus}.`,
            `Plan diario: prioridad=${input.dailyPlan.priority}; razon=${input.dailyPlan.adaptationReason}; tarea actual=${plannedTask ? `${plannedTask.type} dificultad ${plannedTask.difficulty}` : "sin tarea especifica"}.`,
            `Debilidades activas: ${input.evolution.weaknesses.join(", ") || "sin debilidades activas"}.`,
            `Microcopy de introduccion: ${introCopy}.`,
            `Microcopy de ayuda: ${errorCopy}.`,
            input.promptInstruction ?? "",
            "Para primary usa consignas cortas y concretas. Para eso estructura mejor el reto. Para bachillerato pide mas analisis y justificacion.",
            interventionResponse.tutorMode === "gentle" || evolutionSignals.supportLevel === "high"
              ? "Genera una consigna mas corta, una competencia muy concreta y pistas mas graduales."
              : interventionResponse.tutorMode === "stretch" || evolutionSignals.challengeLevel === "up"
                ? "Genera una tarea con mas transferencia, menos pista directa y una respuesta mas razonada."
                : "Mantiene dificultad media con una progresion de pistas equilibrada.",
          ].join(" "),
      },
      {
        role: "user",
        content: `Materia=${input.subject.name}; tema=${input.topic}; edad=${input.profile.age}; curso=${input.profile.schoolYear}; dificultad=${effectiveDifficulty}; tipo=${plannedTask?.type ?? "practice"}`,
      },
    ]);

    const parsed = parseJson<{
      prompt?: string;
      expectedCompetency?: string;
      hints?: string[];
      answerFormat?: string;
    }>(llm.text);

    return {
      prompt: parsed?.prompt ?? `${introCopy} Resuelve una actividad guiada sobre ${input.topic}.`,
      expectedCompetency: parsed?.expectedCompetency ?? `Comprension aplicada de ${input.topic}.`,
      hints:
        Array.isArray(parsed?.hints) && parsed.hints.length > 0
          ? parsed.hints.slice(0, 3)
          : evolutionSignals.supportLevel === "high"
            ? ["Empieza por la parte mas pequena.", "Comprueba cada paso antes de seguir.", "Usa la pista anterior para cerrar la respuesta."]
            : learningProfile.stage === "primary"
            ? ["Lee con calma lo que te pide.", "Busca la pista mas importante.", "Cuentalo paso a paso con tus palabras."]
            : learningProfile.stage === "bachillerato"
              ? ["Identifica la idea o procedimiento central.", "Relaciona los datos con el concepto correcto.", "Justifica por que tu respuesta tiene sentido."]
              : ["Empieza por identificar que te pide.", "Separa los datos importantes.", "Comprueba tu razonamiento paso a paso."],
      answerFormat:
        parsed?.answerFormat ??
        ((plannedTask?.type === "challenge" || evolutionSignals.challengeLevel === "up")
          ? "respuesta razonada con justificacion"
          : learningProfile.stage === "primary"
            ? "respuesta guiada breve"
            : learningProfile.stage === "bachillerato"
              ? "respuesta razonada"
              : "respuesta abierta corta"),
      difficultyLevel: effectiveDifficulty,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ExerciseAgent] AI call failed, using fallback:", errorMessage);
    
    const fallback = generateFallbackExercise({
      subject: input.subject,
      topic: input.topic,
      difficultyLevel: effectiveDifficulty,
    });
    
    return fallback;
  }
}

export async function correctExercise(input: {
  profile: StudentProfile;
  subject: MentoriaSubject;
  exercise: MentoriaExercise;
  studentAnswer: string;
  evolution: StudentEvolutionProfile;
  interventions: MentoriaIntervention[];
  motivation: MotivationState;
}): Promise<{ feedback: string; score: number }> {
  const learningProfile = getLearningProfile(input.profile);
  const evolutionSignals = buildEvolutionAdaptiveSignals(input.evolution, { subject: input.subject });
  const interventionResponse = buildInterventionResponse(input.interventions);
  const errorCopy = getMicrocopy(learningProfile.stage, "error_feedback");
  const successCopy = getMicrocopy(learningProfile.stage, "success_feedback");

  try {
    const llm = await runMentoriaLlm([
      {
        role: "system",
        content:
          [
            "Corrige de forma educativa y sin humillar. Devuelve JSON con feedback y score (0-100).",
            "Explica que esta bien, que mejorar y un siguiente intento sugerido.",
            `Tramo: ${learningProfile.stage}.`,
            `Tono: ${learningProfile.tone}.`,
            `Estilo explicativo: ${learningProfile.explanationStyle}.`,
            `Modo adaptativo: apoyo=${evolutionSignals.supportLevel}; reto=${evolutionSignals.challengeLevel}; refuerzo=${evolutionSignals.reinforcementFrequency}.`,
            `Modo de intervencion: tono=${interventionResponse.toneMode}; tutor=${interventionResponse.tutorMode}.`,
            `Motivacion: perfil=${input.motivation.motivationProfile}; esfuerzo=${input.motivation.effortScore.toFixed(2)}; racha=${input.motivation.streak}.`,
            `Microcopy de error: ${errorCopy}.`,
            `Microcopy de exito: ${successCopy}.`,
            interventionResponse.tutorMode === "gentle" || evolutionSignals.supportLevel === "high"
              ? "Cuando haya error, reduce la carga, separa el fallo en una sola idea y deja un siguiente intento alcanzable."
              : interventionResponse.tutorMode === "stretch" || evolutionSignals.challengeLevel === "up"
                ? "Cuando haya acierto parcial, exige precision adicional y una mejora concreta del razonamiento."
                : "Mantiene un feedback equilibrado, constructivo y accionable.",
            "Ajusta el vocabulario al tramo sin perder rigor.",
          ].join(" "),
      },
      {
        role: "user",
        content: `Materia=${input.subject.name}; ejercicio=${input.exercise.prompt}; competencia=${input.exercise.expectedCompetency}; respuesta=${input.studentAnswer}`,
      },
    ]);

    const parsed = parseJson<{ feedback?: string; score?: number }>(llm.text);
    return {
      feedback:
        parsed?.feedback ??
        (interventionResponse.tutorMode === "gentle" || evolutionSignals.supportLevel === "high"
          ? `${errorCopy} Vamos a separar el ejercicio en una idea cada vez y reconstruirlo con calma.`
          : learningProfile.stage === "primary"
          ? `${errorCopy} Vamos a repasarlo con calma y en pasos pequenos.`
          : learningProfile.stage === "bachillerato"
            ? `${errorCopy} Vamos a revisar el razonamiento y afinar la justificacion.`
            : `${errorCopy} Vamos a revisar el razonamiento paso a paso para reforzarlo.`),
      score: Math.max(0, Math.min(100, Number(parsed?.score ?? 70))),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ExerciseCorrection] AI call failed, using fallback:", errorMessage);
    
    const estimatedScore = input.studentAnswer.trim().length > 20 ? 65 : 45;
    const fallback = generateFallbackCorrection({
      score: estimatedScore,
      studentAnswer: input.studentAnswer,
      expectedCompetency: input.exercise.expectedCompetency,
    });
    
    return fallback;
  }
}
