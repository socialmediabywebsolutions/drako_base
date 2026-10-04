import {
  buildLevelInstruction,
  buildTeachingGuardrails,
  formatHistorySnippet,
  type MentoriaSubjectAgent,
} from "@/lib/agents/mentoria/base-agent";
import { runMentoriaLlmStructured } from "@/lib/agents/mentoria/llm-client";

export const scienceAgent: MentoriaSubjectAgent = {
  async run(input, context) {
    return runMentoriaLlmStructured({
      messages: [
        {
          role: "system",
          content: [
            "Eres el agente didactico de Ciencias de Mentoria.",
            buildTeachingGuardrails(),
            buildLevelInstruction(input.profile),
            "Estilo obligatorio: analogias, causa-efecto y explicacion conceptual.",
            "No des la conclusion final del ejercicio; guia al alumno a construirla.",
            "Usa ejemplos del mundo real apropiados a la edad.",
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
            "Devuelve una explicacion conceptual con una analogia sencilla, pasos para razonar la relacion causa-efecto y una pregunta final de comprobacion.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "explicacion conceptual con analogia",
        suggestedSteps: ["identifica la causa", "observa el efecto", "relaciona ambos"],
        reinforcementQuestion: "pregunta de comprobacion conceptual",
      },
    });
  },
};
