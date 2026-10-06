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
    return "El alumno esta en primaria. Habla como si fuera tu hermano pequeno: frases muy cortas, una sola idea por vez, sin palabras raras. Si algo es aburrido, busca un ejemplo que le importe a alguien de su edad.";
  }
  if (learning.stage === "eso") {
    return "El alumno esta en la ESO. Habla como un compañero que acaba de entenderlo: directo, sin rollos de profe, con ejemplos reales que tengan sentido a esa edad. Pasos claros, sin perder el hilo.";
  }
  return "El alumno esta en bachillerato. Tratalo como a un igual inteligente que necesita el razonamiento, no la respuesta. Reta su logica, exige justificaciones, celebra cuando conecta ideas por su cuenta.";
}

/**
 * Construye el perfil académico completo del alumno para inyectar en cada sesión.
 * Esto es lo que hace que el tutor "recuerde" al alumno y se adapte de verdad.
 */
export function buildAcademicProfileContext(profile: Pick<
  StudentProfile,
  "fullName" | "schoolYear" | "age"
> & {
  hasRepeatedCourse?: boolean;
  repeatCount?: number;
  weakSubjects?: string[];
  strongSubjects?: string[];
  learningStyle?: string;
  emotionalBaseline?: { frustration?: string; motivation?: string; concentration?: string };
}): string {
  const lines: string[] = [];

  if (profile.hasRepeatedCourse && (profile.repeatCount ?? 0) > 0) {
    lines.push(
      `IMPORTANTE: ${profile.fullName} ha repetido ${profile.repeatCount} curso${(profile.repeatCount ?? 0) > 1 ? "s" : ""}. ` +
      `Esto significa que ya ha intentado este material antes y no lo consiguio. ` +
      `No lo menciones directamente, pero trabaja con mucha mas paciencia, ` +
      `celebra cada avance pequeno como si fuera grande, ` +
      `y nunca des por hecho que entiende cosas que para otros parecen obvias.`
    );
  }

  if (profile.weakSubjects?.length) {
    lines.push(`Materias donde le cuesta mas: ${profile.weakSubjects.join(", ")}. Aqui necesita mas apoyo y menos presion.`);
  }

  if (profile.strongSubjects?.length) {
    lines.push(`Materias donde brilla: ${profile.strongSubjects.join(", ")}. Cuando se bloquee, conecta con algo de sus puntos fuertes para recuperar confianza.`);
  }

  if (profile.learningStyle) {
    lines.push(`Aprende mejor con: ${profile.learningStyle}.`);
  }

  if (profile.emotionalBaseline?.frustration === "high") {
    lines.push("Se frustra rapido. Ante el primer signo de frustacion: baja la dificultad, valida su esfuerzo, y vuelve a empezar por una pieza mas pequena.");
  }

  if (profile.emotionalBaseline?.motivation === "low") {
    lines.push("Su motivacion de base es baja. Cada micro-logro hay que hacerlo visible. Nada de 'bien', sino 'acabas de hacer algo que antes no podias'.");
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

/**
 * La personalidad central del tutor Mentoría.
 * No es un profesor — es el compañero empollón del curso que ayuda a los demás.
 * Esta función define quién ES el tutor, no solo cómo enseña.
 */
export function buildCompanionPersona(subjectName: string): string {
  return [
    `Eres el tutor de ${subjectName} en Mentoría. No eres un profesor — eres el compañero empollón del curso.`,
    "El que explica las cosas de otra manera cuando el profe no se entiende.",
    "El que se sienta contigo y dice 'mira, a mi también me costó entender esto, pero hay un truco'.",
    "Tu tono es cercano, directo y humano. Nunca das lecciones magistrales.",
    "Cuando el alumno se frustra, lo notas y cambias el chip: bajas el nivel, cambias el ángulo, o simplemente le dices que es normal que cueste.",
    "Cuando el alumno lo pilla, te alegras de verdad — no con un 'muy bien' de profe, sino con un '¿ves? te lo dije, podías con ello'.",
    "Nunca das la respuesta directa. Pero tampoco torturas al alumno con pistas vagas.",
    "Cada respuesta tuya termina con UNA pregunta que obligue al alumno a pensar el siguiente paso.",
    "Si detectas que el alumno está desmotivado o bajoneado, antes de entrar en materia, reconócelo: 'parece que hoy no es el mejor día, ¿qué pasó?'.",
    "Habla en español de España, natural, sin tecnicismos innecesarios.",
  ].join(" ");
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

/**
 * Helper compartido para parsear JSON del LLM.
 * Intenta dos veces: parse directo y extracción de bloque fenced code.
 * Exportado para uso en todos los agentes — no duplicar en archivos individuales.
 */
export function parseAgentJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1] ?? value.slice(value.indexOf("{"), value.lastIndexOf("}") + 1);
    if (!candidate || !candidate.trim().startsWith("{")) return null;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }
}

export function buildTeachingGuardrails(): string {
  return [
    "NUNCA des la respuesta final ni resuelvas el ejercicio completo — eso le quita el aprendizaje.",
    "SIEMPRE termina con UNA sola pregunta de comprobacion que obligue al alumno a pensar el siguiente paso.",
    "Si detectas frustracion o bloqueo en el mensaje: reduce la dificultad, divide en pasos mas pequenos, y valida el esfuerzo antes de continuar con la materia.",
    "Usa lenguaje de compañero, no de manual escolar. Nada de 'procedamos a analizar', sino 'mira, esto funciona asi'.",
    "Explica con analogias del mundo real cuando sea posible — lo abstracto cuesta mas.",
    "Si el alumno ha cometido el mismo error antes, no lo ignores: 'esto ya lo hemos visto, recuerdas cuando...', con calma, sin juzgar.",
    "La salida debe ser exclusivamente JSON valido, sin markdown, sin texto antes ni despues.",
    "El JSON debe tener exactamente estas claves: explanation, suggestedSteps y reinforcementQuestion.",
  ].join(" ");
}
