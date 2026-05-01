import type {
  LearningSession,
  MentoriaBoardDocumentFeedback,
  MentoriaBoardExam,
  MentoriaBoardExercise,
  MentoriaBoardMode,
  MentoriaBoardTask,
  MentoriaBoardUpdate,
  MentoriaClassroomIntent,
  MentoriaLearningState,
  MentoriaExercise,
  MentoriaSessionMode,
  MentoriaSubject,
  StudentProfile,
} from "@/lib/mentoria/types";

function splitBoardText(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      if (line.length <= 140) return [line];
      return line
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    })
    .slice(0, 4);
}

function inferBoardMode(input: {
  intent?: MentoriaClassroomIntent;
  sessionMode?: MentoriaSessionMode;
  exercise?: MentoriaBoardExercise | null;
  task?: MentoriaBoardTask | null;
  exam?: MentoriaBoardExam | null;
  correction?: string | null;
  documentFeedback?: MentoriaBoardDocumentFeedback | null;
}): MentoriaBoardMode {
  if (input.intent === "document" || input.documentFeedback) return "document_feedback";
  if (input.correction) return "correction";
  if (input.intent === "exam" || input.exam) return "exam";
  if (input.intent === "task" || input.task) return "task";
  if (input.exercise) return "practice";
  return "explanation";
}

function deriveStepsFromExplanation(explanation: string[]): string[] {
  return explanation
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => line.trim().replace(/[.!?]+$/, ""))
    .filter(Boolean)
    .slice(0, 4);
}

function resolveBoardSteps(input: { suggestedSteps?: string[]; explanation: string[] }) {
  const explicitSteps = (input.suggestedSteps ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (explicitSteps.length > 0) return explicitSteps;
  return deriveStepsFromExplanation(input.explanation);
}

function buildWorkedExample(topic: string, steps: string[]): string | null {
  const firstStep = steps[0]?.replace(/[.!?]+$/, "");
  if (!firstStep) return null;
  const secondStep = steps[1]?.replace(/[.!?]+$/, "");
  return [
    `Ejemplo guiado sobre ${topic}: ${firstStep}.`,
    secondStep ? `Despues ${secondStep.toLowerCase()}.` : null,
  ].filter(Boolean).join(" ");
}

function formatDifficultyLabel(level?: number | null) {
  if (!level || level <= 1) return "base guiada";
  if (level === 2) return "comparacion corta";
  if (level === 3) return "ejercicio mixto";
  if (level === 4) return "reto con justificacion";
  return "reto autonomo";
}

function resolveClassroomPhase(input: {
  intent: MentoriaClassroomIntent;
  learningState?: MentoriaLearningState | null;
}): MentoriaBoardUpdate["classroomPhase"] {
  const action = input.learningState?.lastTutorAction;
  if (action === "raise_difficulty") return "evaluate";
  if (action === "correct_mistake" || action === "switch_strategy") return "correct";
  if (input.intent === "correction") return "correct";
  if (input.intent === "practice" || input.intent === "task" || input.intent === "exam") return "ask";
  return "explain";
}

function buildDifficultyAwareQuestion(input: {
  topic: string;
  fallback?: string | null;
  learningState?: MentoriaLearningState | null;
}) {
  const level = input.learningState?.difficultyLevel ?? 1;
  const fallback = input.fallback?.trim();
  if (fallback) return fallback;
  if (level <= 1) return `Mira el ejemplo y dime cual es el primer paso en ${input.topic}.`;
  if (level === 2) return `Resuelve una version corta de ${input.topic} y explica solo el paso clave.`;
  if (level === 3) return `Resuelve ${input.topic} y justifica por que tu respuesta encaja.`;
  if (level === 4) return `Resuelve el reto de ${input.topic} sin pista inicial y comprueba tu resultado.`;
  return `Crea y resuelve un ejemplo propio de ${input.topic}, con comprobacion final.`;
}

function buildDiagram(subjectSlug: string, topic: string): string[] | null {
  const slug = subjectSlug.toLowerCase();
  if (slug.includes("matematic")) {
    return ["datos -> operacion -> resultado -> comprobacion"];
  }
  if (slug.includes("historia")) {
    return ["contexto -> causa -> hecho -> consecuencia"];
  }
  if (slug.includes("lengua") || slug.includes("ingles")) {
    return ["idea -> pista -> reformulacion"];
  }
  if (slug.includes("ciencia")) {
    return ["observacion -> causa -> efecto -> conclusion"];
  }
  if (topic.trim()) {
    return [`${topic} -> idea clave -> comprobacion`];
  }
  return null;
}

function buildFormula(subjectSlug: string, topic: string): string | null {
  if (!subjectSlug.toLowerCase().includes("matematic")) return null;
  if (/fraccion/i.test(topic)) return "mismo denominador -> opera numeradores -> simplifica si hace falta";
  if (/ecuacion/i.test(topic)) return "aisla la variable -> opera igual en ambos lados -> comprueba";
  return "datos -> operacion -> resultado -> comprobacion";
}

function buildExercisePrompt(subject: MentoriaSubject, topic: string, steps: string[], question?: string | null): MentoriaBoardExercise {
  const hints = steps.filter(Boolean).slice(0, 2);
  return {
    prompt: question?.trim()
      ? question.trim()
      : `Practica ahora con una version corta de ${topic}. Hazlo sin saltarte el primer paso.`,
    answerFormat: subject.slug.toLowerCase().includes("matematic")
      ? "Operacion y respuesta final"
      : "Respuesta corta con la idea principal",
    hints,
  };
}

function buildLearningLoopExercise(input: {
  subject: MentoriaSubject;
  topic: string;
  steps: string[];
  question?: string | null;
  learningState?: MentoriaLearningState | null;
}): MentoriaBoardExercise {
  const state = input.learningState ?? null;
  const hints = state?.frustrationLevel === "high"
    ? input.steps.filter(Boolean).slice(0, 1)
    : state?.difficultyLevel && state.difficultyLevel >= 4
      ? []
      : input.steps.filter(Boolean).slice(0, 2);
  const prompt = buildDifficultyAwareQuestion({
    topic: input.topic,
    fallback: input.question,
    learningState: state,
  });
  return {
    prompt,
    answerFormat: input.subject.slug.toLowerCase().includes("matematic")
      ? state?.difficultyLevel && state.difficultyLevel >= 3
        ? "Operacion, comparacion y comprobacion"
        : "Un paso y respuesta corta"
      : state?.difficultyLevel && state.difficultyLevel >= 3
        ? "Respuesta con justificacion"
        : "Respuesta corta",
    hints,
  };
}

function buildTaskPrompt(subject: MentoriaSubject, topic: string, steps: string[]): MentoriaBoardTask {
  return {
    title: `Tarea guiada de ${subject.name}`,
    prompt: `Resuelve una tarea corta sobre ${topic} y deja visible tu razonamiento antes de pedir la correccion.`,
    allowedSteps: steps.slice(0, 3),
    answerFormat: subject.slug.toLowerCase().includes("matematic")
      ? "Operacion, razonamiento y respuesta final"
      : "Respuesta breve con idea principal y justificacion",
  };
}

function buildExamPrompt(subject: MentoriaSubject, topic: string, steps: string[]): MentoriaBoardExam {
  const firstStep = steps[0] ?? `Explica ${topic} con tus palabras.`;
  const secondStep = steps[1] ?? `Aplica ${topic} a un ejemplo concreto de ${subject.name}.`;
  const thirdStep = steps[2] ?? `Justifica por que esa respuesta es correcta.`;

  return {
    title: `Simulacro corto de ${subject.name}`,
    questions: [
      `1. ${firstStep}`,
      `2. ${secondStep}`,
      `3. ${thirdStep}`,
    ],
    timeLimitMinutes: 12,
    scoring: "Se valora claridad, procedimiento y precision.",
    score: null,
    maxScore: 10,
    recommendations: [],
  };
}

function buildDocumentFeedback(input: {
  subject: MentoriaSubject;
  topic: string;
  explanation: string[];
  steps: string[];
}): MentoriaBoardDocumentFeedback {
  return {
    summary: input.explanation[0] ?? `Resumen inicial del documento de ${input.subject.name}.`,
    detectedErrors: input.steps.slice(0, 3),
    reviewTopics: [input.topic, input.subject.name].filter(Boolean),
  };
}

export function buildBoardUpdateFromSession(input: {
  student: StudentProfile;
  subject: MentoriaSubject;
  topic: string;
  intent?: MentoriaClassroomIntent;
  reply?: string | null;
  explanation?: string | null;
  suggestedSteps?: string[];
  reinforcementQuestion?: string | null;
  recommendedNextStep?: string | null;
  sessionMode?: MentoriaSessionMode;
  includePractice?: boolean;
  nextActionLabel?: string | null;
  learningState?: MentoriaLearningState | null;
  classroomPhase?: MentoriaBoardUpdate["classroomPhase"];
  createdAt?: string;
}): MentoriaBoardUpdate {
  const explanation = splitBoardText(input.explanation?.trim() || input.reply?.trim() || `Vamos a trabajar ${input.topic} paso a paso.`);
  const resolvedSteps = resolveBoardSteps({
    suggestedSteps: input.suggestedSteps,
    explanation,
  });
  const resolvedIntent = input.intent ?? "explanation";
  const classroomPhase = input.classroomPhase ?? resolveClassroomPhase({
    intent: resolvedIntent,
    learningState: input.learningState,
  });
  const activeQuestion = buildDifficultyAwareQuestion({
    topic: input.topic,
    fallback: input.reinforcementQuestion,
    learningState: input.learningState,
  });
  const shouldAskForStudentAction =
    input.includePractice
    || resolvedIntent === "practice"
    || resolvedIntent === "question"
    || Boolean(input.learningState?.awaitingStudentAnswer)
    || classroomPhase === "ask"
    || classroomPhase === "evaluate"
    || classroomPhase === "correct";
  const exercise = shouldAskForStudentAction && resolvedIntent !== "exam" && resolvedIntent !== "task" && resolvedIntent !== "document"
    ? buildLearningLoopExercise({
        subject: input.subject,
        topic: input.topic,
        steps: resolvedSteps,
        question: activeQuestion,
        learningState: input.learningState,
      })
    : null;
  const task = resolvedIntent === "task" ? buildTaskPrompt(input.subject, input.topic, resolvedSteps) : null;
  const exam = resolvedIntent === "exam" ? buildExamPrompt(input.subject, input.topic, resolvedSteps) : null;
  const documentFeedback = resolvedIntent === "document"
    ? buildDocumentFeedback({
        subject: input.subject,
        topic: input.topic,
        explanation,
        steps: resolvedSteps,
      })
    : null;
  const correctionText = resolvedIntent === "correction"
    ? [
        input.explanation?.trim(),
        input.reply?.trim(),
      ].filter(Boolean).join(" ").trim() || null
    : null;
  const note =
    resolvedIntent === "correction"
      ? "Correccion activa: reescribe la respuesta con el ajuste principal antes de seguir."
      : resolvedIntent === "exam"
        ? "Nota orientativa: primero completa el simulacro y luego pide correccion."
        : null;
  const conceptDefinition =
    resolvedIntent === "idle"
      ? null
      : resolvedIntent === "task"
        ? `Hoy vamos a resolver una tarea real de ${input.subject.name}.`
        : resolvedIntent === "exam"
          ? `Vamos a simular un examen corto de ${input.subject.name}.`
          : resolvedIntent === "document"
            ? `Voy a revisar el material de ${input.subject.name} sin mezclarlo con otras materias.`
            : explanation[0] ?? `Vamos a trabajar ${input.topic}.`;

  return {
    studentId: input.student.id,
    subjectSlug: input.subject.slug,
    subjectName: input.subject.name,
    studentName: input.student.fullName,
    schoolYear: input.student.schoolYear,
    topic: input.topic,
    intent: resolvedIntent,
    mode: inferBoardMode({
      intent: resolvedIntent,
      sessionMode: input.sessionMode,
      exercise,
      task,
      exam,
      correction: correctionText,
      documentFeedback,
    }),
    classroomPhase,
    conceptDefinition,
    explanation,
    steps: resolvedSteps,
    example: resolvedIntent === "exam" || resolvedIntent === "task" || resolvedIntent === "document"
      ? null
      : buildWorkedExample(input.topic, resolvedSteps),
    formula: buildFormula(input.subject.slug, input.topic),
    diagram: resolvedIntent === "document" ? null : buildDiagram(input.subject.slug, input.topic),
    exercise,
    task,
    exam,
    correction: correctionText,
    documentFeedback,
    note,
    guidedQuestion: activeQuestion,
    activeQuestion,
    learningState: input.learningState ?? null,
    nextAction:
      input.nextActionLabel?.trim()
      || input.recommendedNextStep?.trim()
      || activeQuestion
      || resolvedSteps[0]
      || `Da un paso corto mas sobre ${input.topic}.`,
    updatedAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function buildBoardUpdateFromExercise(input: {
  student: StudentProfile;
  subject: MentoriaSubject;
  topic: string;
  exercise: MentoriaExercise;
  correction?: string | null;
  createdAt?: string;
}): MentoriaBoardUpdate {
  const resolvedCorrection = input.correction?.trim() || input.exercise.correctionFeedback?.trim() || null;
  return {
    studentId: input.student.id,
    subjectSlug: input.subject.slug,
    subjectName: input.subject.name,
    studentName: input.student.fullName,
    schoolYear: input.student.schoolYear,
    topic: input.topic,
    intent: resolvedCorrection ? "correction" : "practice",
    mode: inferBoardMode({
      intent: resolvedCorrection ? "correction" : "practice",
      exercise: {
        prompt: input.exercise.prompt,
        answerFormat: input.exercise.answerFormat,
        hints: input.exercise.hints,
      },
      correction: resolvedCorrection,
    }),
    classroomPhase: resolvedCorrection ? "correct" : "ask",
    conceptDefinition: resolvedCorrection ? "Ahora toca revisar el razonamiento y corregir justo el punto fragil." : `Practica de ${input.topic}.`,
    explanation: resolvedCorrection
      ? splitBoardText(resolvedCorrection)
      : [
          input.exercise.expectedCompetency || `Practica guiada de ${input.topic}.`,
          "Resuelvelo con calma y deja visible el razonamiento.",
        ],
    steps: input.exercise.hints.length > 0
      ? input.exercise.hints.slice(0, 3)
      : deriveStepsFromExplanation([
          input.exercise.expectedCompetency || `Practica guiada de ${input.topic}.`,
          "Resuelvelo con calma y deja visible el razonamiento.",
        ]),
    example: null,
    formula: buildFormula(input.subject.slug, input.topic),
    diagram: buildDiagram(input.subject.slug, input.topic),
    exercise: {
      prompt: input.exercise.prompt,
      answerFormat: input.exercise.answerFormat,
      hints: input.exercise.hints,
    },
    task: null,
    exam: null,
    correction: resolvedCorrection,
    documentFeedback: null,
    note: resolvedCorrection && typeof input.exercise.score === "number" ? `Nota orientativa: ${input.exercise.score}/10` : null,
    guidedQuestion: null,
    activeQuestion: resolvedCorrection ? "Corrige el paso fragil y vuelve a intentarlo." : input.exercise.prompt,
    nextAction: resolvedCorrection ? "Corrige el paso fragil y vuelve a intentarlo." : "Resuelve el ejercicio y luego lo revisamos juntos.",
    updatedAt: input.createdAt ?? input.exercise.updatedAt ?? new Date().toISOString(),
  };
}

export function buildBoardUpdateFromLearningSession(input: {
  student: StudentProfile;
  subject: MentoriaSubject;
  session: LearningSession;
}): MentoriaBoardUpdate {
  if (input.session.boardUpdate) {
    return input.session.boardUpdate;
  }

  const lastTutorMessage = [...input.session.transcript]
    .reverse()
    .find((item) => item.role === "tutor")?.content ?? input.session.tutorSummary;

  return buildBoardUpdateFromSession({
    student: input.student,
    subject: input.subject,
    topic: input.session.topic || input.subject.name,
    reply: lastTutorMessage,
    explanation: input.session.explanation ?? input.session.tutorSummary,
    suggestedSteps: input.session.suggestedSteps ?? [],
    reinforcementQuestion: input.session.reinforcementQuestion ?? input.session.recommendedNextStep,
    recommendedNextStep: input.session.recommendedNextStep,
    createdAt: input.session.updatedAt,
  });
}

export function buildEmptyBoardUpdate(input: {
  student: StudentProfile;
  subject: MentoriaSubject;
  topic?: string | null;
}): MentoriaBoardUpdate {
  const topic = input.topic?.trim() || input.subject.name;
  return {
    studentId: input.student.id,
    subjectSlug: input.subject.slug,
    subjectName: input.subject.name,
    studentName: input.student.fullName,
    schoolYear: input.student.schoolYear,
    topic,
    intent: "idle",
    mode: "explanation",
    classroomPhase: "explain",
    conceptDefinition: null,
    explanation: [],
    steps: [],
    example: null,
    formula: null,
    diagram: null,
    exercise: null,
    task: null,
    exam: null,
    correction: null,
    documentFeedback: null,
    note: null,
    guidedQuestion: null,
    activeQuestion: null,
    nextAction: `Cuenta que no entendiste sobre ${topic}.`,
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
}
