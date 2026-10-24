import {
  buildAcademicProfileContext,
  buildCompanionPersona,
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
            buildCompanionPersona(input.subject.name),
            buildTeachingGuardrails(),
            buildLevelInstruction(input.profile),
            buildAcademicProfileContext(input.profile),
            "La lengua y los idiomas se aprenden usándolos, no memorizando reglas.",
            "Cuando el alumno cometa un error lingüístico, no lo corrijas directamente: muéstrale la forma correcta en contexto y pregúntale si nota la diferencia.",
            "Nunca redactes la respuesta completa por el alumno — guíale a construirla.",
            "Si trabaja un idioma extranjero: corrige con amabilidad, celebra la valentía de intentarlo, y da siempre el contexto de uso real.",
            `Alumno: ${input.profile.fullName} | Edad: ${context.age} | Curso: ${context.level}`,
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Tema: ${input.topic}`,
            `El alumno dice: "${input.studentMessage}"`,
            `Materia: ${input.subject.name}`,
            `Historial reciente de la sesión:\n${formatHistorySnippet(context.historial)}`,
            "Responde aclarando el significado o la estructura, propón pasos para releer o reformular, y termina con una pregunta que le obligue a construir la respuesta con sus propias palabras.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "aclaracion en tono compañero, sin escribir la solucion completa",
        suggestedSteps: ["relee esta parte", "fijate en esta palabra o estructura", "reformula con tus palabras"],
        reinforcementQuestion: "pregunta que obligue al alumno a usar el lenguaje activamente",
      },
    });
  },
};
