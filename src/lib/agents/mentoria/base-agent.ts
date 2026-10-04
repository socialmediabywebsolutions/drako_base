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

// ─── Señales de salida del Agente Núcleo ─────────────────────────────────────
// Protocolo estandarizado que TODOS los agentes tutor deben emitir al finalizar
// cada interacción. El Cerebro consume estas señales para adaptar la estrategia.

export type ConceptMasteryLevel =
  | "mastered"      // alumno demostró comprensión clara
  | "partial"       // comprensión parcial, necesita refuerzo
  | "not_yet"       // no comprendido, requiere nuevo enfoque
  | "unknown";      // no se puede determinar aún

export type CerebroEscalationReason =
  | "repeated_frustration"    // 3+ señales de frustración seguidas
  | "session_stall"           // alumno sin avance >10 min
  | "emotional_crisis"        // señal de malestar emocional significativo
  | "topic_switch_needed"     // cambio de tema urgente por bloqueo total
  | "parent_alert_needed";    // situación que el padre debería conocer

export type SessionOutcomeSignal = {
  /** Duración real de la interacción en segundos */
  durationSeconds: number;
  /** Temas que se trabajaron en esta sesión */
  topicsCovered: string[];
  /** Nivel de dominio estimado al final */
  masteryLevel: ConceptMasteryLevel;
  /** Estado emocional detectado al final */
  emotionalStateAtEnd: "calm" | "frustrated" | "blocked" | "demotivated" | "confident" | "unknown";
  /** ¿Debe subir la dificultad en la próxima sesión? */
  difficultyNextSession: "down" | "steady" | "up";
  /** Temas específicos con errores recurrentes */
  weakTopicsDetected: string[];
  /** ¿El agente recomienda escalar al Cerebro? */
  escalateToCerebro: boolean;
  /** Si escalateToCerebro=true, motivo concreto */
  escalationReason?: CerebroEscalationReason;
  /** Nota libre para el próximo agente (sin exponer al alumno) */
  internalNote?: string;
};

/** Helper: construye una señal de salida mínima cuando el agente no puede
 *  determinar los valores exactos (fallback seguro). */
export function buildDefaultOutcomeSignal(
  overrides: Partial<SessionOutcomeSignal> = {},
): SessionOutcomeSignal {
  return {
    durationSeconds: 0,
    topicsCovered: [],
    masteryLevel: "unknown",
    emotionalStateAtEnd: "unknown",
    difficultyNextSession: "steady",
    weakTopicsDetected: [],
    escalateToCerebro: false,
    ...overrides,
  };
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
