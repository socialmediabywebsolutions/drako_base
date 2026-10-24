/**
 * Mentoría — Perfil de aprendizaje por edad
 *
 * El gap: LearningProfile tiene 3 etapas (primary/eso/bachillerato) pero dentro
 * de cada etapa la diferencia entre un alumno de 7 años y uno de 11 es enorme.
 * Este módulo extiende el perfil con parámetros pedagógicos específicos por rango de edad.
 *
 * PRINCIPIO: la edad calibra el CÓMO, no el QUÉ.
 * El contenido y dificultad los decide el Planner; la forma de comunicarlo la decide este perfil.
 */

import type { StudentProfile } from "@/lib/mentoria/types";
import { getLearningProfile, type LearningProfile } from "@/lib/mentoria/learning-profile";

// ─── Parámetros pedagógicos por edad ─────────────────────────────────────────

export type AgePedagogyParams = {
  /**
   * Duración máxima recomendada de una sesión sin pausa.
   * A los 7 años el foco se rompe rápido. A los 17 puede sostener 45+ min.
   */
  maxSessionMinutes: number;

  /**
   * Longitud máxima de una explicación en el chat (palabras aprox.).
   * Un niño de 8 años se pierde con más de 60 palabras seguidas.
   */
  maxExplanationWords: number;

  /**
   * ¿Cada cuántos intercambios el tutor debe lanzar un refuerzo positivo explícito?
   * Los alumnos más jóvenes necesitan validación más frecuente.
   */
  encouragementFrequency: "every_turn" | "every_2_turns" | "every_4_turns" | "as_needed";

  /**
   * ¿Cuánta autonomía puede asumir el agente antes de escalar al Cerebro?
   * Con alumnos pequeños el umbral de escalada es más bajo.
   */
  autonomyThreshold: "low" | "medium" | "high";

  /**
   * Nivel de vocabulario técnico permitido en las explicaciones.
   */
  vocabularyLevel: "everyday" | "school_standard" | "academic" | "advanced";

  /**
   * Número de pasos máximo en una explicación secuencial.
   * Más pasos = más carga cognitiva.
   */
  maxStepsPerExplanation: number;

  /**
   * ¿El tutor puede usar analogías abstractas o solo ejemplos concretos?
   */
  analogyStyle: "concrete_only" | "concrete_preferred" | "abstract_allowed";

  /**
   * ¿Con qué frecuencia el tutor debe hacer check-in emocional explícito?
   * ("¿Cómo lo llevas?" / "¿Necesitas un descanso?")
   */
  emotionalCheckInFrequency: "high" | "medium" | "low";

  /**
   * ¿El padre/tutor debe recibir resumen de esta sesión por defecto?
   * Para menores de 12 años, siempre. Para bachillerato, solo si hay alerta.
   */
  defaultParentSummary: boolean;
};

// ─── Tabla de parámetros por rango de edad ───────────────────────────────────

const AGE_PARAMS: Array<{ minAge: number; maxAge: number; params: AgePedagogyParams }> = [
  {
    // Primaria baja — 6 a 8 años
    minAge: 6,
    maxAge: 8,
    params: {
      maxSessionMinutes: 15,
      maxExplanationWords: 50,
      encouragementFrequency: "every_turn",
      autonomyThreshold: "low",
      vocabularyLevel: "everyday",
      maxStepsPerExplanation: 2,
      analogyStyle: "concrete_only",
      emotionalCheckInFrequency: "high",
      defaultParentSummary: true,
    },
  },
  {
    // Primaria media — 9 a 10 años
    minAge: 9,
    maxAge: 10,
    params: {
      maxSessionMinutes: 20,
      maxExplanationWords: 80,
      encouragementFrequency: "every_2_turns",
      autonomyThreshold: "low",
      vocabularyLevel: "everyday",
      maxStepsPerExplanation: 3,
      analogyStyle: "concrete_only",
      emotionalCheckInFrequency: "high",
      defaultParentSummary: true,
    },
  },
  {
    // Primaria alta — 11 a 12 años
    minAge: 11,
    maxAge: 12,
    params: {
      maxSessionMinutes: 25,
      maxExplanationWords: 100,
      encouragementFrequency: "every_2_turns",
      autonomyThreshold: "medium",
      vocabularyLevel: "school_standard",
      maxStepsPerExplanation: 4,
      analogyStyle: "concrete_preferred",
      emotionalCheckInFrequency: "medium",
      defaultParentSummary: true,
    },
  },
  {
    // ESO baja — 12 a 14 años
    minAge: 12,
    maxAge: 14,
    params: {
      maxSessionMinutes: 30,
      maxExplanationWords: 130,
      encouragementFrequency: "every_2_turns",
      autonomyThreshold: "medium",
      vocabularyLevel: "school_standard",
      maxStepsPerExplanation: 5,
      analogyStyle: "concrete_preferred",
      emotionalCheckInFrequency: "medium",
      defaultParentSummary: true,
    },
  },
  {
    // ESO alta — 15 a 16 años
    minAge: 15,
    maxAge: 16,
    params: {
      maxSessionMinutes: 35,
      maxExplanationWords: 160,
      encouragementFrequency: "every_4_turns",
      autonomyThreshold: "medium",
      vocabularyLevel: "academic",
      maxStepsPerExplanation: 6,
      analogyStyle: "abstract_allowed",
      emotionalCheckInFrequency: "low",
      defaultParentSummary: false,
    },
  },
  {
    // Bachillerato — 16 a 18 años
    minAge: 16,
    maxAge: 99,
    params: {
      maxSessionMinutes: 45,
      maxExplanationWords: 200,
      encouragementFrequency: "as_needed",
      autonomyThreshold: "high",
      vocabularyLevel: "advanced",
      maxStepsPerExplanation: 8,
      analogyStyle: "abstract_allowed",
      emotionalCheckInFrequency: "low",
      defaultParentSummary: false,
    },
  },
];

// ─── Perfil de aprendizaje extendido ─────────────────────────────────────────

export type ExtendedLearningProfile = LearningProfile & {
  age: number;
  pedagogy: AgePedagogyParams;
};

/**
 * Devuelve el perfil de aprendizaje completo con los parámetros pedagógicos
 * específicos para la edad del alumno.
 *
 * @example
 * const profile = getExtendedLearningProfile({ age: 9, schoolYear: "4º Primaria" });
 * // profile.pedagogy.maxSessionMinutes → 20
 * // profile.pedagogy.vocabularyLevel → "everyday"
 */
export function getExtendedLearningProfile(
  profile: Pick<StudentProfile, "schoolYear" | "age">,
): ExtendedLearningProfile {
  const base = getLearningProfile(profile);

  // Buscar el rango de edad más específico (el primero que cumpla min <= age <= max)
  // La tabla está ordenada de menor a mayor para que primaria baja tenga prioridad
  // frente a solapamientos (ej: 12 años puede ser primaria alta o ESO baja —
  // en ese caso prima el schoolYear a través del base.stage)
  const ageEntry = AGE_PARAMS.find(
    (entry) => profile.age >= entry.minAge && profile.age <= entry.maxAge,
  ) ?? AGE_PARAMS[AGE_PARAMS.length - 1];

  // Ajuste fino: si el alumno es de bachillerato pero tiene menos de 16
  // (p. ej. alumno avanzado de 15 años), subir vocabulario pero mantener
  // los límites de sesión conservadores
  let pedagogy = { ...ageEntry.params };
  if (base.stage === "bachillerato" && profile.age < 16) {
    pedagogy = {
      ...pedagogy,
      vocabularyLevel: "academic",
      maxStepsPerExplanation: 7,
    };
  }

  return {
    ...base,
    age: profile.age,
    pedagogy,
  };
}

// ─── Helpers para los agentes ─────────────────────────────────────────────────

/**
 * Genera la instrucción de estilo de comunicación para los prompts de los agentes.
 * Esta instrucción reemplaza/complementa buildLevelInstruction() de base-agent.ts.
 */
export function buildAgeAdaptedInstruction(
  profile: Pick<StudentProfile, "schoolYear" | "age">,
): string {
  const ep = getExtendedLearningProfile(profile);
  const { pedagogy, stage } = ep;

  const stageText =
    stage === "primary"
      ? "en primaria"
      : stage === "eso"
        ? "en ESO"
        : "en bachillerato";

  const parts: string[] = [
    `El alumno tiene ${ep.age} años y está ${stageText}.`,
    `Máximo ${pedagogy.maxExplanationWords} palabras por explicación.`,
    `No más de ${pedagogy.maxStepsPerExplanation} pasos en secuencias.`,
  ];

  if (pedagogy.vocabularyLevel === "everyday") {
    parts.push("Usa vocabulario cotidiano, evita tecnicismos.");
  } else if (pedagogy.vocabularyLevel === "school_standard") {
    parts.push("Usa vocabulario escolar estándar. Los términos técnicos siempre con definición breve.");
  } else if (pedagogy.vocabularyLevel === "academic") {
    parts.push("Vocabulario académico moderado. Puedes asumir que conoce los términos del curso.");
  } else {
    parts.push("Vocabulario técnico y preciso. Prioriza rigor conceptual.");
  }

  if (pedagogy.analogyStyle === "concrete_only") {
    parts.push("Solo analogías concretas y cercanas al alumno (animales, juegos, objetos cotidianos).");
  } else if (pedagogy.analogyStyle === "concrete_preferred") {
    parts.push("Prefiere ejemplos concretos. Las analogías abstractas solo si el alumno ya entiende la base.");
  }

  if (pedagogy.encouragementFrequency === "every_turn") {
    parts.push("Incluye un refuerzo positivo breve en cada respuesta (sin ser condescendiente).");
  } else if (pedagogy.encouragementFrequency === "every_2_turns") {
    parts.push("Refuerza positivamente cada dos intercambios.");
  }

  if (pedagogy.emotionalCheckInFrequency === "high") {
    parts.push("Haz check-in emocional frecuente: '¿Cómo lo llevas?' o '¿Necesitas un descanso?'");
  }

  return parts.join(" ");
}

/**
 * ¿Debe esta sesión enviar resumen automático al padre?
 * Los alumnos más jóvenes siempre; los de bachillerato solo si hay alerta.
 */
export function shouldSendParentSummary(
  profile: Pick<StudentProfile, "schoolYear" | "age">,
  hasAlert: boolean,
): boolean {
  const ep = getExtendedLearningProfile(profile);
  return ep.pedagogy.defaultParentSummary || hasAlert;
}
