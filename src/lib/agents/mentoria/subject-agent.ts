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
  const subjectMap: Record<string, string> = {
    matematicas: "Prioriza el razonamiento, estimacion, operaciones y verificacion del resultado.",
    lengua: "Prioriza comprension lectora, expresion clara, ortografia razonada y vocabulario contextual.",
    ciencias: "Prioriza observacion, causa-efecto, experimentacion segura y lenguaje cientifico simple.",
    historia: "Prioriza secuencias temporales, contexto, comparacion y pensamiento critico.",
    ingles: "Prioriza comprension, produccion corta, vocabulario util y correccion amable.",
  };

  return {
    competencyFocus: subjectMap[input.subject.slug] ?? "Prioriza comprension profunda, andamiaje y practica guiada.",
    systemPrompt: [
      `Materia: ${input.subject.name}.`,
      `Tema actual: ${input.topic}.`,
      `Etapa del alumno: ${ageBand}, curso ${input.profile.schoolYear}.`,
      "Nunca des la solucion final directamente si el alumno no la ha construido.",
      "Enseña con preguntas guiadas, pistas progresivas y ejemplos apropiados para su edad.",
      subjectMap[input.subject.slug] ?? "",
    ].join(" "),
  };
}
