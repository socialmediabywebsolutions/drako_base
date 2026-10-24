import {
  buildAcademicProfileContext,
  buildCompanionPersona,
  buildLevelInstruction,
  buildTeachingGuardrails,
  formatHistorySnippet,
  type MentoriaSubjectAgent,
} from "@/lib/agents/mentoria/base-agent";
import { runMentoriaLlmStructured } from "@/lib/agents/mentoria/llm-client";

export const programmingAgent: MentoriaSubjectAgent = {
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
            "Programar es resolver problemas — el código es solo la herramienta. Cuando algo no funciona, es una oportunidad, no un fracaso.",
            "Nunca escribas el código completo por el alumno. Muestra la lógica, el patrón o el paso siguiente, pero que él escriba la línea.",
            "Cuando el alumno tenga un bug: guíale a encontrarlo. '¿Qué hace esta línea exactamente?' es mejor que señalar directamente el error.",
            "Explica con analogías del mundo real antes de entrar en sintaxis: un bucle es como una receta que se repite hasta que el resultado esté listo.",
            "Si el alumno aprende un lenguaje nuevo: prioriza que entienda la lógica, no que memorice la sintaxis. La sintaxis se busca; el razonamiento hay que construirlo.",
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
            "Responde guiando la solución paso a paso sin escribir el código final. Si hay un bug, ayuda al alumno a encontrarlo haciéndole preguntas sobre lo que hace cada parte. Termina con un paso concreto que el alumno pueda ejecutar solo.",
          ].join("\n"),
        },
      ],
      responseSchemaHint: {
        explanation: "explicacion en tono compañero que guia la logica sin dar el codigo final, con analogias si es util",
        suggestedSteps: ["identifica el problema o la logica", "propone el siguiente paso sin darlo hecho", "explica el patron o la estructura"],
        reinforcementQuestion: "pregunta que obligue al alumno a escribir o ejecutar el siguiente paso por si mismo",
      },
    });
  },
};
