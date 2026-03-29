import type { MentoriaTeachingResponse } from "@/lib/agents/mentoria/base-agent";
import type { MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";

export type AIFailureReason = 
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE"
  | "EMPTY_RESPONSE"
  | "PARSE_ERROR"
  | "UNAVAILABLE";

export type FallbackResponse = {
  isFallback: true;
  failureReason: AIFailureReason;
  explanation: string;
  suggestedSteps: string[];
  reinforcementQuestion: string;
};

function buildMathFallback(topic: string, difficultyLevel: string): FallbackResponse {
  const isBasic = difficultyLevel === "guided" || difficultyLevel === "easy";
  return {
    isFallback: true,
    failureReason: "UNAVAILABLE",
    explanation: isBasic
      ? `Vamos a trabajar ${topic} paso a paso. Primero, identifica los datos que tienes. Luego, piensa qué operación necesitas hacer.`
      : `Para resolver ${topic}, comienza por entender qué se pregunta. Después, identifica los pasos necesarios y ejecuta cada uno cuidadosamente.`,
    suggestedSteps: isBasic
      ? [
          "Lee el problema completo",
          "Subraya los números y datos importantes",
          "Escribe la operación que necesitas",
          "Verifica tu respuesta",
        ]
      : [
          "Analiza qué tipo de problema es",
          "Plantea la estrategia de solución",
          "Ejecuta los cálculos paso a paso",
          "Verifica que la respuesta tenga sentido",
        ],
    reinforcementQuestion: isBasic
      ? `¿Qué operación crees que necesitas para resolver esto?`
      : `¿Puedes explicar por qué elegiste ese método?`,
  };
}

function buildLanguageFallback(topic: string, difficultyLevel: string): FallbackResponse {
  const isBasic = difficultyLevel === "guided" || difficultyLevel === "easy";
  return {
    isFallback: true,
    failureReason: "UNAVAILABLE",
    explanation: isBasic
      ? `Trabajemos con ${topic}. Primero, lee el texto con atención. Luego, identifica las partes principales.`
      : `Para entender ${topic}, comienza por leer cuidadosamente. Después, analiza la estructura y el significado de cada parte.`,
    suggestedSteps: isBasic
      ? [
          "Lee el texto completo",
          "Identifica las ideas principales",
          "Busca palabras clave",
          "Resume en tus propias palabras",
        ]
      : [
          "Analiza la estructura del texto",
          "Identifica el propósito del autor",
          "Examina el uso del lenguaje",
          "Forma tu propia interpretación",
        ],
    reinforcementQuestion: isBasic
      ? `¿Cuál es la idea principal de lo que leíste?`
      : `¿Cómo el autor usa el lenguaje para comunicar su mensaje?`,
  };
}

function buildScienceFallback(topic: string, difficultyLevel: string): FallbackResponse {
  const isBasic = difficultyLevel === "guided" || difficultyLevel === "easy";
  return {
    isFallback: true,
    failureReason: "UNAVAILABLE",
    explanation: isBasic
      ? `Exploremos ${topic}. Comienza observando o imaginando el fenómeno. Luego, piensa en qué está sucediendo.`
      : `Para comprender ${topic}, primero observa los hechos. Después, forma hipótesis y prueba si se cumplen.`,
    suggestedSteps: isBasic
      ? [
          "Observa el fenómeno o situación",
          "Identifica qué está pasando",
          "Piensa en por qué sucede",
          "Verifica tu comprensión",
        ]
      : [
          "Reúne información sobre el tema",
          "Forma una hipótesis",
          "Busca evidencia que la apoye",
          "Saca conclusiones basadas en datos",
        ],
    reinforcementQuestion: isBasic
      ? `¿Qué crees que está sucediendo aquí?`
      : `¿Qué evidencia apoya tu explicación?`,
  };
}

export function generateFallbackTeachingResponse(input: {
  subject: MentoriaSubject;
  topic: string;
  difficultyLevel: string;
  failureReason: AIFailureReason;
}): FallbackResponse {
  const subjectSlug = input.subject.slug.toLowerCase();

  if (subjectSlug.includes("matematic")) {
    return buildMathFallback(input.topic, input.difficultyLevel);
  }

  if (subjectSlug.includes("lengua") || subjectSlug.includes("language") || subjectSlug.includes("ingles")) {
    return buildLanguageFallback(input.topic, input.difficultyLevel);
  }

  if (subjectSlug.includes("ciencias") || subjectSlug.includes("science")) {
    return buildScienceFallback(input.topic, input.difficultyLevel);
  }

  return buildScienceFallback(input.topic, input.difficultyLevel);
}

export function generateFallbackExercise(input: {
  subject: MentoriaSubject;
  topic: string;
  difficultyLevel: string;
}): {
  prompt: string;
  expectedCompetency: string;
  hints: string[];
  answerFormat: string;
  difficultyLevel: string;
} {
  const subjectSlug = input.subject.slug.toLowerCase();
  const isBasic = input.difficultyLevel === "guided" || input.difficultyLevel === "easy";

  if (subjectSlug.includes("matematic")) {
    return {
      prompt: isBasic
        ? `Resuelve este problema sobre ${input.topic}: Identifica los datos y escribe la operación que necesitas.`
        : `Plantea y resuelve un problema sobre ${input.topic}. Explica cada paso de tu solución.`,
      expectedCompetency: `Resolver problemas de ${input.topic}`,
      hints: isBasic
        ? [
            "¿Cuáles son los números importantes?",
            "¿Qué operación necesitas?",
            "Verifica tu respuesta",
          ]
        : [
            "¿Qué tipo de problema es?",
            "¿Cuál es la estrategia?",
            "¿Es razonable tu respuesta?",
          ],
      answerFormat: "Escribe los pasos de tu solución",
      difficultyLevel: input.difficultyLevel,
    };
  }

  if (subjectSlug.includes("lengua") || subjectSlug.includes("language") || subjectSlug.includes("ingles")) {
    return {
      prompt: isBasic
        ? `Lee este texto sobre ${input.topic} e identifica la idea principal.`
        : `Analiza este texto sobre ${input.topic}. Explica cómo el autor comunica su mensaje.`,
      expectedCompetency: `Comprender y analizar textos sobre ${input.topic}`,
      hints: isBasic
        ? [
            "¿Cuál es el tema principal?",
            "¿Cuáles son los detalles importantes?",
            "¿Cuál es la conclusión?",
          ]
        : [
            "¿Cuál es la intención del autor?",
            "¿Qué técnicas literarias usa?",
            "¿Cuál es el impacto en el lector?",
          ],
      answerFormat: "Escribe tu análisis en párrafos",
      difficultyLevel: input.difficultyLevel,
    };
  }

  return {
    prompt: isBasic
      ? `Observa y describe lo que sucede en ${input.topic}.`
      : `Investiga y explica los procesos involucrados en ${input.topic}.`,
    expectedCompetency: `Entender ${input.topic}`,
    hints: isBasic
      ? [
          "¿Qué observas?",
          "¿Por qué crees que sucede?",
          "¿Puedes dar un ejemplo?",
        ]
      : [
          "¿Cuáles son los factores involucrados?",
          "¿Cómo interactúan?",
          "¿Qué evidencia lo apoya?",
        ],
    answerFormat: "Escribe tu explicación",
    difficultyLevel: input.difficultyLevel,
  };
}

export function generateFallbackCorrection(input: {
  score: number;
  studentAnswer: string;
  expectedCompetency: string;
}): {
  feedback: string;
  score: number;
} {
  const isCorrect = input.score >= 70;

  if (isCorrect) {
    return {
      feedback: `¡Bien hecho! Demostraste comprensión de ${input.expectedCompetency}. Continúa practicando para mejorar aún más.`,
      score: input.score,
    };
  }

  return {
    feedback: `Tu respuesta muestra que estás trabajando en ${input.expectedCompetency}. Revisa los pasos y vuelve a intentarlo. Cada intento te acerca más a la solución.`,
    score: input.score,
  };
}
