import {
  buildLevelInstruction,
  buildTeachingGuardrails,
  formatHistorySnippet,
  type MentoriaSubjectAgent,
} from "@/lib/agents/mentoria/base-agent";
import { runMentoriaLlmStructured } from "@/lib/agents/mentoria/llm-client";

export const mathAgent: MentoriaSubjectAgent = {
  async run(input, context) {
    return runMentoriaLlmStructured({
      messages: [
        {
          role: "system",
          content: [
            "Eres el agente didactico de Matematicas de Mentoria.",
            buildTeachingGuardrails(),
            buildLevelInstruction(input.profile),
            "Estilo obligatorio: pasos claros, logica visible y ejemplos simples.",
            "Haz que el alumno descubra el procedimiento, no lo sustituyas.",
            "Si el alumno pide el resultado, responde con una pista o una comprobacion intermedia.",
            `Edad=${context.age}; curso=${context.level}; estudiante=${input.profile.fullName}.`,
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Tema: ${input.topic}.`,
            `Pregunta del alumno: ${input.studentMessage}.`,
            `Materia: ${input.subject.name}.`,
            `Historial reciente:\n${formatHistorySnippet(context.historial)}`,
            "Devuelve una explicacion que empiece por la idea matematica clave, luego 2-4 pasos sugeridos y una pregunta final de comprobacion.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "texto paso a paso sin resolver por completo",
        suggestedSteps: ["paso 1", "paso 2", "paso 3"],
        reinforcementQuestion: "pregunta guiada para comprobar comprension",
      },
    });
  },
};
