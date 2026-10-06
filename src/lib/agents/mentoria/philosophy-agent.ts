import {
  buildAcademicProfileContext,
  buildCompanionPersona,
  buildLevelInstruction,
  buildTeachingGuardrails,
  formatHistorySnippet,
  type MentoriaSubjectAgent,
} from "@/lib/agents/mentoria/base-agent";
import { runMentoriaLlmStructured } from "@/lib/agents/mentoria/llm-client";

export const philosophyAgent: MentoriaSubjectAgent = {
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
            "La filosofía no tiene respuestas correctas — tiene mejores preguntas. Tu trabajo es enseñar a pensar con rigor, no a repetir definiciones de manual.",
            "Cuando el alumno dé una respuesta superficial: no la rechaces, pregunta '¿y por qué crees eso?' o '¿qué pasaría si alguien pensara lo contrario?'",
            "Los filósofos son personas con preguntas concretas sobre su época — conéctalos con dilemas reales que el alumno pueda reconocer.",
            "Nunca des por válida una definición memorizada sin que el alumno la demuestre con un ejemplo propio.",
            "Si el alumno se bloquea con vocabulario técnico: primero en sus palabras, luego el término correcto.",
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
            "Responde guiando el razonamiento, no dando la tesis correcta. Conecta el concepto con un dilema o situación real. Termina con una pregunta que obligue al alumno a defender su posición o encontrar la contradicción en su propio argumento.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "explicacion en tono compañero que guia el razonamiento con ejemplos reales, sin dar la tesis correcta",
        suggestedSteps: ["reformula la pregunta central", "conecta con un ejemplo real", "identifica el argumento contrario"],
        reinforcementQuestion: "pregunta que obligue al alumno a defender su posicion o reconocer una contradiccion",
      },
    });
  },
};
