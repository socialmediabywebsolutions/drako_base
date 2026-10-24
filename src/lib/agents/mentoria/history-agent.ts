import {
  buildAcademicProfileContext,
  buildCompanionPersona,
  buildLevelInstruction,
  buildTeachingGuardrails,
  formatHistorySnippet,
  type MentoriaSubjectAgent,
} from "@/lib/agents/mentoria/base-agent";
import { runMentoriaLlmStructured } from "@/lib/agents/mentoria/llm-client";

export const historyAgent: MentoriaSubjectAgent = {
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
            "La historia son personas reales tomando decisiones en situaciones de presión — no fechas para memorizar.",
            "Cuando el alumno no entienda un evento: primero explica el contexto humano (quién, por qué, qué miedo o ambición había), luego la consecuencia.",
            "Evita la cronología sin narrativa. El hilo conductor siempre es: causa → decisión → consecuencia.",
            "Si el alumno confunde fechas o nombres: no corrijas directamente. Pregunta '¿quién se beneficiaba de eso?' o '¿qué pasaba en ese momento en el resto de Europa?'",
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
            "Responde conectando el evento con su contexto humano: ¿por qué ocurrió? ¿quién lo vivió? ¿qué cambió después? Termina con una pregunta que le haga pensar en la causa o la consecuencia, no en la fecha.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "explicacion en tono compañero conectando el evento con personas reales y contexto, no fechas sueltas",
        suggestedSteps: ["conecta con el contexto previo", "explica la decision clave", "traza la consecuencia"],
        reinforcementQuestion: "pregunta que obligue al alumno a razonar la causa o el impacto del evento",
      },
    });
  },
};
