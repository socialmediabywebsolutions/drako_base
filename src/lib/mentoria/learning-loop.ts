import type {
  MentoriaBoardUpdate,
  MentoriaClassroomIntent,
  MentoriaFrustrationLevel,
  MentoriaLearningDifficulty,
  MentoriaLearningLoopMode,
  MentoriaLearningState,
  MentoriaLearningStrategy,
} from "@/lib/mentoria/types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

export type LearningLoopDecision = {
  learningStateUpdated: MentoriaLearningState;
  nextAction: string;
  feedback: string | null;
  tutorInstruction: string;
  evolutionSignals: string[];
  classroomPhase: "explain" | "ask" | "evaluate" | "correct";
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function mapIntentToLoopMode(intent: MentoriaClassroomIntent): MentoriaLearningLoopMode {
  if (intent === "exam") return "exam";
  if (intent === "task" || intent === "practice") return "exercise";
  if (intent === "correction" || intent === "document") return "correction";
  return "explain";
}

function inferInitialDifficulty(intent: MentoriaClassroomIntent): MentoriaLearningDifficulty {
  if (intent === "exam") return 3;
  if (intent === "task" || intent === "practice") return 2;
  return 1;
}

function inferInitialStrategy(intent: MentoriaClassroomIntent): MentoriaLearningStrategy {
  if (intent === "frustration") return "micro_step";
  if (intent === "exam") return "challenge";
  return "step_by_step";
}

function inferFrustrationLevel(input: {
  message: string;
  intent: MentoriaClassroomIntent;
  previous?: MentoriaFrustrationLevel;
  answerScore?: number;
}): MentoriaFrustrationLevel {
  const message = input.message.toLowerCase();
  const isHigh =
    input.intent === "frustration"
    || /bloque|frustr|agob|no puedo|me cuesta mucho|no entiendo/.test(message);
  if (isHigh) return "high";
  if (typeof input.answerScore === "number" && input.answerScore >= 0.18) return "low";
  if (input.previous === "high") return "medium";
  return input.previous ?? "medium";
}

function stepFrustrationDown(level: MentoriaFrustrationLevel): MentoriaFrustrationLevel {
  if (level === "high") return "medium";
  return "low";
}

function resolveEscalatedStrategy(current: MentoriaLearningStrategy): MentoriaLearningStrategy {
  if (current === "step_by_step") return "visual";
  if (current === "visual") return "analogy";
  if (current === "analogy") return "micro_step";
  return "micro_step";
}

function actionFromState(state: MentoriaLearningState) {
  if (state.lastTutorAction === "raise_difficulty") return "ask";
  if (state.lastTutorAction === "correct_mistake" || state.lastTutorAction === "switch_strategy") return "correct";
  return state.mode === "correction" ? "correct" : "explain";
}

function detectInitialGap(message: string, topic: string) {
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("no entiendo")) return [`Base fragil en ${topic}`];
  if (normalizedMessage.includes("bloque")) return [`Bloqueo activo en ${topic}`];
  return [`Necesita consolidar ${topic}`];
}

function scoreAnswerAgainstBoard(answer: string, boardUpdate?: MentoriaBoardUpdate | null) {
  if (!answer.trim() || !boardUpdate) return 0;
  const answerTokens = new Set(normalizeText(answer));
  const referenceTokens = new Set(
    [
      boardUpdate.topic,
      ...(boardUpdate.steps ?? []),
      ...(boardUpdate.explanation ?? []),
      boardUpdate.guidedQuestion ?? "",
      boardUpdate.conceptDefinition ?? "",
      boardUpdate.correction ?? "",
    ]
      .flatMap((chunk) => normalizeText(chunk))
      .slice(0, 24),
  );
  if (referenceTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of referenceTokens) {
    if (answerTokens.has(token)) overlap += 1;
  }
  return overlap / referenceTokens.size;
}

export function resolveLearningLoopDecision(input: {
  studentId: string;
  subjectSlug: string;
  message: string;
  topic: string;
  intent: MentoriaClassroomIntent;
  previousState?: MentoriaLearningState | null;
  previousBoardUpdate?: MentoriaBoardUpdate | null;
  studentEvolution?: StudentEvolutionProfile | null;
  now?: string;
}): LearningLoopDecision {
  const now = input.now ?? new Date().toISOString();
  const previous = input.previousState ?? null;
  const evolution = input.studentEvolution ?? null;
  const answerScore = previous?.awaitingStudentAnswer
    ? scoreAnswerAgainstBoard(input.message, input.previousBoardUpdate)
    : 0;
  const normalizedTopic = input.topic.toLowerCase();
  const hasCommonMistake = Boolean(
    evolution?.commonMistakes.some((item) => item.toLowerCase().includes(normalizedTopic)),
  );
  const hasWeakness = Boolean(
    evolution?.weaknesses.some((item) => item.toLowerCase().includes(normalizedTopic)),
  );
  const highFrustrationHistory = Boolean(evolution && evolution.frustrationLevel >= 0.72);
  const fastProgressHistory = Boolean(evolution && evolution.progressionVelocity >= 0.82);
  const evolutionSignals = [
    hasCommonMistake ? "common_mistake" : null,
    hasWeakness ? "subject_weakness" : null,
    highFrustrationHistory ? "high_frustration_history" : null,
    fastProgressHistory ? "high_progression_velocity" : null,
  ].filter(Boolean) as string[];

  if (!previous) {
    const seededDifficulty = highFrustrationHistory || hasCommonMistake || hasWeakness
      ? 1
      : fastProgressHistory
        ? 3
        : inferInitialDifficulty(input.intent);
    const seededStrategy = highFrustrationHistory
      ? "visual"
      : hasCommonMistake || hasWeakness
        ? "step_by_step"
        : inferInitialStrategy(input.intent);
    const learningStateUpdated: MentoriaLearningState = {
      studentId: input.studentId,
      subjectSlug: input.subjectSlug,
      currentTopic: input.topic,
      stepIndex: 0,
      difficultyLevel: seededDifficulty,
      masteryScore: fastProgressHistory ? 35 : input.intent === "exam" ? 35 : 20,
      frustrationLevel: highFrustrationHistory
        ? "high"
        : inferFrustrationLevel({ message: input.message, intent: input.intent }),
      detectedGaps: [
        ...detectInitialGap(input.message, input.topic),
        ...(hasCommonMistake ? [`Error recurrente en ${input.topic}`] : []),
        ...(hasWeakness ? [`Debilidad persistente en ${input.topic}`] : []),
      ].slice(0, 5),
      lastUserAnswer: null,
      lastTutorAction: "introduce_concept",
      mode: mapIntentToLoopMode(input.intent),
      strategy: seededStrategy,
      awaitingStudentAnswer: true,
      repeatedBlockCount: 0,
      feedback: highFrustrationHistory
        ? "Veo frustracion persistente en esta materia, asi que empiezo con una explicacion mas suave y visual."
        : hasCommonMistake || hasWeakness
          ? "Detecto una dificultad repetida en este tema, asi que empiezo mas guiado de lo normal."
          : fastProgressHistory
            ? "Vienes con buena progresion en esta materia, asi que arranco un poco por encima de la base."
            : "Empiezo por la base y espero una respuesta corta para ajustar el siguiente paso.",
      updatedAt: now,
    };
    return {
      learningStateUpdated,
      feedback: learningStateUpdated.feedback,
      nextAction: "Responde a la pregunta guiada para adaptar el siguiente paso.",
      classroomPhase: "explain",
      tutorInstruction: [
        "Estas abriendo una clase nueva.",
        `Tema activo: ${input.topic}.`,
        `Dificultad inicial: ${learningStateUpdated.difficultyLevel}/5.`,
        `Frustracion detectada: ${learningStateUpdated.frustrationLevel}.`,
        evolutionSignals.length > 0 ? `Memoria pedagogica activa: ${evolutionSignals.join(", ")}.` : null,
        "Empieza con una intencion docente explicita: explicar. Explica una sola idea clave, deja 2-3 pasos, muestra un ejemplo y termina con una pregunta muy concreta que obligue al alumno a actuar.",
      ].filter(Boolean).join(" "),
      evolutionSignals,
    };
  }

  const updated: MentoriaLearningState = {
    ...previous,
    studentId: input.studentId,
    subjectSlug: input.subjectSlug,
    currentTopic: input.topic,
    lastUserAnswer: input.message,
    updatedAt: now,
  };

  if (!previous.awaitingStudentAnswer) {
    updated.awaitingStudentAnswer = true;
    updated.lastTutorAction = "resume_step";
      return {
        learningStateUpdated: updated,
        feedback: updated.feedback,
        nextAction: "Continua con el siguiente paso guiado.",
        classroomPhase: actionFromState(updated),
        tutorInstruction: "Ya habia una explicacion en marcha. Continuala sin reiniciar el tema ni cambiar la materia.",
        evolutionSignals,
      };
  }

  if (answerScore >= 0.18) {
    updated.masteryScore = clamp(previous.masteryScore + 18, 0, 100);
    updated.frustrationLevel = stepFrustrationDown(previous.frustrationLevel);
    updated.stepIndex = previous.stepIndex + 1;
    updated.difficultyLevel = clamp(previous.difficultyLevel + (fastProgressHistory ? 2 : 1), 1, 5) as MentoriaLearningDifficulty;
    updated.awaitingStudentAnswer = true;
    updated.repeatedBlockCount = 0;
    updated.mode = input.intent === "exam" ? "exam" : previous.mode === "exam" ? "exam" : "exercise";
    updated.lastTutorAction = "raise_difficulty";
    updated.feedback = "Bien. Esa respuesta ya permite avanzar un paso mas y subir un poco la dificultad.";
    return {
      learningStateUpdated: updated,
      feedback: updated.feedback,
      nextAction: "Responde al siguiente paso para seguir avanzando.",
      classroomPhase: "evaluate",
      tutorInstruction: [
        "El alumno ha respondido suficientemente bien al paso anterior.",
        `Dominio actual: ${updated.masteryScore}/100.`,
        `Sube la dificultad a ${updated.difficultyLevel}/5.`,
        evolutionSignals.length > 0 ? `Ten en cuenta la memoria activa: ${evolutionSignals.join(", ")}.` : null,
        "Empieza con una intencion docente explicita: evaluar. Reconoce el acierto, conecta con el siguiente paso y exige un poco mas de autonomia sin dar la respuesta final.",
      ].filter(Boolean).join(" "),
      evolutionSignals,
    };
  }

  updated.masteryScore = clamp(previous.masteryScore - 6, 0, 100);
  updated.repeatedBlockCount = previous.repeatedBlockCount + 1;
  updated.difficultyLevel = clamp(
    previous.difficultyLevel - (highFrustrationHistory || hasCommonMistake || hasWeakness ? 2 : 1),
    1,
    5,
  ) as MentoriaLearningDifficulty;
  updated.frustrationLevel = inferFrustrationLevel({
    message: input.message,
    intent: input.intent,
    previous: previous.frustrationLevel,
    answerScore,
  });
  updated.strategy = updated.repeatedBlockCount >= 2
    ? resolveEscalatedStrategy(previous.strategy)
    : previous.strategy;
  updated.awaitingStudentAnswer = true;
  updated.mode = "correction";
  updated.lastTutorAction = updated.repeatedBlockCount >= 2 ? "switch_strategy" : "correct_mistake";
  updated.feedback = updated.repeatedBlockCount >= 2
    ? "Sigo viendo bloqueo. Cambio la estrategia para explicarlo de forma mas visual y en pasos mas pequenos."
    : "Todavia no. Voy a corregir el error principal y darte una variacion mas simple.";
  const gapLabel = `Paso ${previous.stepIndex + 1} de ${input.topic}`;
  if (!updated.detectedGaps.includes(gapLabel)) {
    updated.detectedGaps = [...updated.detectedGaps, gapLabel].slice(-5);
  }

  return {
    learningStateUpdated: updated,
    feedback: updated.feedback,
    nextAction: updated.repeatedBlockCount >= 2
      ? "Responde a la nueva version simplificada antes de volver a subir nivel."
      : "Corrige el error principal y vuelve a intentarlo con un ejemplo nuevo.",
    classroomPhase: updated.repeatedBlockCount >= 2 ? "correct" : "evaluate",
    tutorInstruction: [
      "La respuesta del alumno no es suficiente para avanzar.",
      `Frustracion actual: ${updated.frustrationLevel}.`,
      `Estrategia obligatoria ahora: ${updated.strategy}.`,
      evolutionSignals.length > 0 ? `Memoria activa: ${evolutionSignals.join(", ")}.` : null,
      "Empieza con una intencion docente explicita: corregir. No repitas la misma explicacion. Corrige el error principal, da un ejemplo nuevo y cierra con una pregunta mas simple o mas visual.",
    ].filter(Boolean).join(" "),
    evolutionSignals,
  };
}
