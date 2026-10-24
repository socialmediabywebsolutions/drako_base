import {
  buildAcademicProfileContext,
  buildCompanionPersona,
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
            buildCompanionPersona(input.subject.name),
            buildTeachingGuardrails(),
            buildLevelInstruction(input.profile),
            buildAcademicProfileContext(input.profile),
            "Las ciencias son para entender el mundo, no para memorizar fórmulas.",
            "Usa analogías del mundo real que tengan sentido para alguien de su edad — no ejemplos de libro.",
            "Razonamiento causa-efecto: primero qué pasa, luego por qué pasa, luego cómo se relaciona con lo que ya sabe.",
            "No des la conclusión final — guía al alumno a construirla él solo.",
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
            "Responde con una analogía cercana a su mundo, los pasos para razonar la relación causa-efecto, y una pregunta final que le obligue a construir la conclusión.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "analogia del mundo real + relacion causa-efecto en tono compañero",
        suggestedSteps: ["qué pasa", "por qué pasa", "cómo se conecta con lo que ya sabes"],
        reinforcementQuestion: "pregunta que obligue al alumno a construir la conclusion",
      },
    });
  },
};
