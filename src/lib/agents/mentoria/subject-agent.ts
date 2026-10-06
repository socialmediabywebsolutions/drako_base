import type { MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";

export type SubjectBrief = {
  systemPrompt: string;
  competencyFocus: string;
};

export function buildSubjectBrief(input: {
  subject: MentoriaSubject;
  profile: StudentProfile;
  topic: string;
}): SubjectBrief {
  const ageBand = input.profile.age <= 8 ? "infantil" : input.profile.age <= 12 ? "intermedia" : "adolescente";

  // Instrucciones específicas por materia — en tono compañero, no manual
  const subjectMap: Record<string, string> = {
    matematicas: "El objetivo es que el alumno entienda la lógica, no que memorice el procedimiento. Muestra por qué funciona, no solo cómo.",
    lengua: "La lengua es comunicación. Prioriza que el alumno se exprese con claridad, comprenda lo que lee, y gane confianza con las palabras.",
    ciencias: "Las ciencias explican el mundo. Conecta siempre con algo que el alumno haya visto o vivido antes de ir a la teoría.",
    historia: "La historia son personas tomando decisiones. Haz que el alumno entienda el contexto, no que memorice fechas.",
    filosofia: "La filosofía no tiene respuestas correctas — tiene mejores preguntas. Ayuda al alumno a pensar con rigor, no a repetir definiciones.",
    ingles: "El inglés se aprende usándolo. Corrige con amabilidad, celebra los intentos, y da contexto de uso real en cada corrección.",
    programacion: "Programar es resolver problemas. Cuando algo no funciona, es una oportunidad de aprendizaje — no un fracaso. Depura con el alumno, no por él.",
  };

  const specificFocus = subjectMap[input.subject.slug] ?? "Prioriza comprensión profunda. Guía con preguntas, nunca dando la respuesta directa.";

  return {
    competencyFocus: specificFocus,
    systemPrompt: [
      `Materia: ${input.subject.name} | Tema: ${input.topic} | Curso: ${input.profile.schoolYear} | Etapa: ${ageBand}.`,
      "Nunca des la solución final si el alumno no la ha construido.",
      "Usa preguntas guiadas, pistas progresivas y ejemplos reales apropiados a su edad.",
      specificFocus,
    ].join(" "),
  };
}
