import {
  buildAcademicProfileContext,
  buildCompanionPersona,
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
            buildCompanionPersona("Matemáticas"),
            buildTeachingGuardrails(),
            buildLevelInstruction(input.profile),
            buildAcademicProfileContext(input.profile),
            "Las matemáticas asustan a mucha gente — tu trabajo es quitarle el miedo, no demostrarlo.",
            "Muestra la lógica detrás del procedimiento, no solo los pasos mecánicos.",
            "Si el alumno pide directamente el resultado: dale una pista concreta o un paso intermedio, nunca la solución.",
            "Notación en texto plano: 'x^2' para potencias, 'sqrt(x)' para raíces, fracciones como a/b.",
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
            "Responde como el compañero que acaba de entender esto: empieza por la idea clave, luego 2-3 pasos concretos, y cierra con una pregunta que le obligue a dar el siguiente paso él solo.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "explicacion en tono compañero, con la idea clave primero",
        suggestedSteps: ["paso 1 concreto", "paso 2", "paso 3"],
        reinforcementQuestion: "una pregunta que obligue al alumno a pensar el siguiente paso",
      },
    });
  },
};
