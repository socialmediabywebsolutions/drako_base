import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";

export type MentoriaAgentHistoryTurn = {
  role: "student" | "tutor";
  content: string;
  createdAt?: string;
};

export type MentoriaAgentContext = {
  student_id: string;
  age: number;
  level: string;
  historial: MentoriaAgentHistoryTurn[];
};

export type MentoriaTeachingResponse = {
  explanation: string;
  suggestedSteps: string[];
  reinforcementQuestion: string;
};

export type MentoriaSubjectAgentInput = {
  profile: StudentProfile;
  subject: MentoriaSubject;
  topic: string;
  studentMessage: string;
};

export type MentoriaSubjectAgent = {
  run: (
    input: MentoriaSubjectAgentInput,
    context: MentoriaAgentContext,
  ) => Promise<MentoriaTeachingResponse & { provider: string; totalTokens: number; model?: string }>;
};

export function buildMentoriaAgentContext(input: {
  profile: Pick<StudentProfile, "id" | "age" | "schoolYear">;
  history?: MentoriaAgentHistoryTurn[];
}): MentoriaAgentContext {
  return {
    student_id: input.profile.id,
    age: input.profile.age,
    level: input.profile.schoolYear,
    historial: input.history ?? [],
  };
}

export function formatHistorySnippet(history: MentoriaAgentHistoryTurn[]): string {
  if (history.length === 0) {
    return "Sin historial previo relevante.";
  }

  return history
    .slice(-6)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");
}

export function buildLevelInstruction(profile: Pick<StudentProfile, "schoolYear" | "age">): string {
  const learning = getLearningProfile(profile);
  if (learning.stage === "primary") {
    return "El alumno esta en primaria. Usa frases concretas, vocabulario sencillo y una sola idea por paso.";
  }
  if (learning.stage === "eso") {
    return "El alumno esta en ESO. Estructura la explicacion con pasos claros y vocabulario academico moderado.";
  }
  return "El alumno esta en bachillerato. Prioriza precision conceptual, razonamiento y autonomia guiada.";
}

export function buildTeachingGuardrails(): string {
  return [
    "No des la respuesta final ni resuelvas el ejercicio completo.",
    "Obliga a que el alumno piense con una pregunta de refuerzo al final.",
    "Explica por pasos y usa andamiaje progresivo.",
    "Si detectas confusion, simplifica el lenguaje antes de aumentar dificultad.",
    "La salida debe ser exclusivamente JSON valido, sin markdown, sin texto antes ni despues.",
    "El JSON debe tener exactamente estas claves: explanation, suggestedSteps y reinforcementQuestion.",
  ].join(" ");
}
