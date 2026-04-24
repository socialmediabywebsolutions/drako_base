import type {
  LearningSession,
  MentoriaBoardExercise,
  MentoriaBoardMode,
  MentoriaBoardUpdate,
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
  sessionMode?: MentoriaSessionMode;
  wantsExample?: boolean;
  exercise?: MentoriaBoardExercise | null;
  correction?: string | null;
}): MentoriaBoardMode {
  if (input.correction) return "correction";
  if (input.exercise) return "practice";
  if (input.wantsExample || input.sessionMode === "task_resolution") return "example";
  if (input.sessionMode === "exam_preparation") return "summary";
  return "explanation";
}

function buildFallbackSteps(topic: string, subjectSlug: string): string[] {
  const slug = subjectSlug.toLowerCase();
  if (slug.includes("matematic")) {
    return [
      "Mira primero que datos tienes delante.",
      "Aplica un paso corto sin saltar nada.",
      "Comprueba el resultado con un caso sencillo.",
    ];
  }
  if (slug.includes("historia")) {
    return [
      "Situa el tema en su contexto.",
      "Separa causa, hecho y consecuencia.",
      "Explicalo con tus palabras.",
    ];
  }
  if (slug.includes("lengua") || slug.includes("ingles")) {
    return [
      "Identifica la idea principal.",
      "Fijate en la palabra o estructura clave.",
      "Reescribelo de forma mas clara.",
    ];
  }
  if (slug.includes("ciencia")) {
    return [
      "Observa que esta pasando.",
      "Relaciona causa y efecto.",
      "Cierra con una conclusion corta.",
    ];
  }
  return [
    `Ubica bien ${topic}.`,
    "Separa la idea principal en pasos cortos.",
    "Comprueba que puedes explicarlo sin ayuda.",
  ];
}

function buildWorkedExample(subject: MentoriaSubject, topic: string, steps: string[]): string {
  const slug = subject.slug.toLowerCase();
  const firstStep = steps[0] ?? "empieza por la idea principal";
  if (slug.includes("matematic")) {
    return `Ejemplo guiado: toma un caso muy simple de ${topic}, ${firstStep.toLowerCase()} y comprueba el resultado antes de seguir.`;
  }
  if (slug.includes("historia")) {
    return `Ejemplo guiado: en ${topic}, coloca primero el contexto, despues una causa clara y termina con la consecuencia principal.`;
  }
  if (slug.includes("lengua") || slug.includes("ingles")) {
    return `Ejemplo guiado: lee una frase corta de ${topic}, detecta la pista importante y reformulala con palabras mas faciles.`;
  }
  if (slug.includes("ciencia")) {
    return `Ejemplo guiado: en ${topic}, observa un caso sencillo, explica que cambia y cierra con la relacion causa-efecto.`;
  }
  return `Ejemplo guiado: usa ${topic} en una situacion simple, ${firstStep.toLowerCase()} y explica por que funciona.`;
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

export function buildBoardUpdateFromSession(input: {
  student: StudentProfile;
  subject: MentoriaSubject;
  topic: string;
  reply?: string | null;
  explanation?: string | null;
  suggestedSteps?: string[];
  reinforcementQuestion?: string | null;
  recommendedNextStep?: string | null;
  sessionMode?: MentoriaSessionMode;
  includePractice?: boolean;
  createdAt?: string;
}): MentoriaBoardUpdate {
  const explanation = splitBoardText(input.explanation?.trim() || input.reply?.trim() || `Vamos a trabajar ${input.topic} paso a paso.`);
  const steps = (input.suggestedSteps ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 4);
  const resolvedSteps = steps.length > 0 ? steps : buildFallbackSteps(input.topic, input.subject.slug);
  const wantsExample = /ejemplo/i.test(input.reply ?? "") || /ejemplo/i.test(input.explanation ?? "");
  const exercise = input.includePractice
    ? buildExercisePrompt(input.subject, input.topic, resolvedSteps, input.reinforcementQuestion)
    : null;

  return {
    studentId: input.student.id,
    subjectSlug: input.subject.slug,
    subjectName: input.subject.name,
    studentName: input.student.fullName,
    schoolYear: input.student.schoolYear,
    topic: input.topic,
    mode: inferBoardMode({
      sessionMode: input.sessionMode,
      wantsExample,
      exercise,
      correction: null,
    }),
    conceptDefinition: explanation[0] ?? `Vamos a trabajar ${input.topic}.`,
    explanation,
    steps: resolvedSteps,
    example: buildWorkedExample(input.subject, input.topic, resolvedSteps),
    formula: buildFormula(input.subject.slug, input.topic),
    diagram: buildDiagram(input.subject.slug, input.topic),
    exercise,
    correction: null,
    nextAction:
      input.recommendedNextStep?.trim()
      || input.reinforcementQuestion?.trim()
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
    mode: inferBoardMode({
      exercise: {
        prompt: input.exercise.prompt,
        answerFormat: input.exercise.answerFormat,
        hints: input.exercise.hints,
      },
      correction: resolvedCorrection,
    }),
    conceptDefinition: resolvedCorrection ? "Ahora toca revisar el razonamiento y corregir justo el punto fragil." : `Practica de ${input.topic}.`,
    explanation: resolvedCorrection
      ? splitBoardText(resolvedCorrection)
      : [
          input.exercise.expectedCompetency || `Practica guiada de ${input.topic}.`,
          "Resuelvelo con calma y deja visible el razonamiento.",
        ],
    steps: input.exercise.hints.length > 0 ? input.exercise.hints.slice(0, 3) : buildFallbackSteps(input.topic, input.subject.slug),
    example: null,
    formula: buildFormula(input.subject.slug, input.topic),
    diagram: buildDiagram(input.subject.slug, input.topic),
    exercise: {
      prompt: input.exercise.prompt,
      answerFormat: input.exercise.answerFormat,
      hints: input.exercise.hints,
    },
    correction: resolvedCorrection,
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
    mode: "explanation",
    conceptDefinition: `La pizarra de ${input.subject.name} esta lista.`,
    explanation: ["Escribe tu duda al tutor y la explicacion importante aparecera aqui, paso a paso."],
    steps: ["Cuenta que no entendiste.", "Mira la explicacion en la pizarra.", "Da el siguiente paso guiado."],
    example: null,
    formula: buildFormula(input.subject.slug, topic),
    diagram: buildDiagram(input.subject.slug, topic),
    exercise: null,
    correction: null,
    nextAction: `Cuenta que no entendiste sobre ${topic}.`,
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
}
