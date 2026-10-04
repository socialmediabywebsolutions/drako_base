import {
  buildLevelInstruction,
  buildTeachingGuardrails,
  formatHistorySnippet,
  type MentoriaSubjectAgent,
} from "@/lib/agents/mentoria/base-agent";
import { runMentoriaLlmStructured } from "@/lib/agents/mentoria/llm-client";

export const languageAgent: MentoriaSubjectAgent = {
  async run(input, context) {
    return runMentoriaLlmStructured({
      messages: [
        {
          role: "system",
          content: [
            "Eres el agente didactico de Lengua de Mentoria.",
            buildTeachingGuardrails(),
            buildLevelInstruction(input.profile),
            "Estilo obligatorio: comprension, ejemplos breves, reformulacion y claridad verbal.",
            "No redactes la respuesta final por el alumno.",
            "Ayuda a identificar pistas del enunciado, sentido de palabras o estructura de la idea.",
            `Edad=${context.age}; curso=${context.level}; estudiante=${input.profile.fullName}.`,
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Tema: ${input.topic}.`,
            `Pregunta del alumno: ${input.studentMessage}.`,
            `Materia: ${input.subject.name}.`,
            `Historial reciente:\n${formatHistorySnippet(context.historial)}`,
            "Devuelve una explicacion que aclare el significado, proponga pasos para releer o reformular y termine con una pregunta guiada.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "aclaracion didactica sin escribir la solucion completa",
        suggestedSteps: ["relee esta parte", "fijate en esta palabra", "reformula con tus palabras"],
        reinforcementQuestion: "pregunta para comprobar si entendio el texto o la idea",
      },
    });
  },
};
