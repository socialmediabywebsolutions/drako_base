/**
 * Mentoría — Protocolo de Seguridad del Agente Cerebro
 *
 * El Cerebro es el orquestador emocional del sistema. Detecta señales de
 * malestar, frustración crónica y posibles situaciones de riesgo a través
 * del análisis de patrones en las sesiones del alumno.
 *
 * PRINCIPIOS FUNDAMENTALES:
 * 1. El Cerebro NO diagnostica. Nunca.
 * 2. El Cerebro NO etiqueta al alumno.
 * 3. Ante la duda, escala a un humano. Siempre.
 * 4. La privacidad del alumno es prioritaria, con una excepción: el riesgo de daño.
 */

// ─── Niveles de alerta ────────────────────────────────────────────────────────

export type SafetyAlertLevel =
  | "none"       // sin señales preocupantes
  | "watch"      // señal leve, mantener observación (no notificar)
  | "soft"       // notificar al padre con mensaje de acompañamiento
  | "urgent"     // notificar al padre con urgencia + recurso de apoyo
  | "crisis";    // detener sesión + mostrar recursos de crisis inmediatamente al alumno

// ─── Señales que el Cerebro monitoriza ───────────────────────────────────────

export type SafetySignal = {
  // Señales lingüísticas directas en los mensajes del alumno
  linguisticFlags: string[];
  // Patrones de comportamiento en sesiones (abandono, evasión, etc.)
  behaviorPatterns: SafetyBehaviorPattern[];
  // Historial de alertas previas
  priorAlerts: SafetyAlertRecord[];
};

export type SafetyBehaviorPattern =
  | "repeated_abandonment"   // abandona sesiones antes de terminar 3+ veces en una semana
  | "topic_avoidance"        // evita sistemáticamente un tema concreto sin explicación
  | "message_escalation"     // mensajes progresivamente más negativos en la sesión
  | "session_frequency_drop" // de >3 sesiones/semana a 0 en menos de 7 días
  | "unusual_hours"          // sesiones a horas inusuales (madrugada) de forma repetida
  | "self_deprecation";      // lenguaje muy negativo sobre sí mismo de forma persistente

export type SafetyAlertRecord = {
  level: SafetyAlertLevel;
  triggeredAt: string; // ISO date
  reason: string;
  resolved: boolean;
};

// ─── Palabras y frases que activan revisión ───────────────────────────────────
// IMPORTANTE: La presencia de estas palabras NO implica diagnóstico.
// Son señales que deben combinarse con contexto y patrón antes de actuar.

export const LINGUISTIC_WATCH_SIGNALS: string[] = [
  // frustración normal — solo observar
  "no puedo más", "estoy agotado", "para qué sirve esto",
  "soy malo en todo", "nunca lo voy a entender",
];

export const LINGUISTIC_SOFT_SIGNALS: string[] = [
  // malestar sostenido — notificar al padre con calma
  "no me importa nada", "da igual lo que haga", "no valgo para nada",
  "nadie me entiende", "estoy muy solo",
];

export const LINGUISTIC_CRISIS_SIGNALS: string[] = [
  // riesgo inmediato — actuar ahora, sin esperar confirmación
  "hacerme daño", "hacerme algo", "no quiero estar aquí",
  "no quiero seguir", "desaparecer", "quitarme la vida",
  "suicidarme", "matarme", "ya no aguanto más",
];

// ─── Evaluador de nivel de alerta ─────────────────────────────────────────────

export function evaluateSafetyLevel(
  message: string,
  signal: SafetySignal,
): { level: SafetyAlertLevel; reason: string } {
  const normalized = message.toLowerCase();

  // CRISIS — prioridad máxima, evaluar primero
  const crisisMatch = LINGUISTIC_CRISIS_SIGNALS.find((s) => normalized.includes(s));
  if (crisisMatch) {
    return {
      level: "crisis",
      reason: `Señal de crisis detectada: "${crisisMatch}". Requiere intervención inmediata.`,
    };
  }

  // SOFT — combinación de señal lingüística + patrón de comportamiento
  const softMatch = LINGUISTIC_SOFT_SIGNALS.find((s) => normalized.includes(s));
  const hasBehaviorConcern = signal.behaviorPatterns.includes("self_deprecation")
    || signal.behaviorPatterns.includes("session_frequency_drop")
    || signal.behaviorPatterns.includes("repeated_abandonment");

  if (softMatch || (hasBehaviorConcern && signal.priorAlerts.some((a) => a.level === "watch"))) {
    return {
      level: "soft",
      reason: softMatch
        ? `Expresión de malestar detectada: "${softMatch}"`
        : `Patrón de comportamiento preocupante: ${signal.behaviorPatterns.join(", ")}`,
    };
  }

  // WATCH — señal leve o patrón incipiente
  const watchMatch = LINGUISTIC_WATCH_SIGNALS.find((s) => normalized.includes(s));
  if (watchMatch || hasBehaviorConcern) {
    return {
      level: "watch",
      reason: watchMatch
        ? `Señal de observación: "${watchMatch}"`
        : `Patrón de comportamiento incipiente: ${signal.behaviorPatterns.join(", ")}`,
    };
  }

  return { level: "none", reason: "" };
}

// ─── Respuestas del sistema por nivel ─────────────────────────────────────────

export type SafetyResponse = {
  /** ¿Debe interrumpirse la sesión de estudio? */
  interruptSession: boolean;
  /** Mensaje que el tutor IA muestra al alumno */
  studentMessage: string | null;
  /** Recursos que se muestran al alumno (solo en crisis) */
  crisisResources: CrisisResource[] | null;
  /** ¿Se notifica al padre? */
  notifyParent: boolean;
  /** Mensaje que recibe el padre (sin revelar detalles que el alumno no quiso compartir) */
  parentMessage: string | null;
  /** ¿Se registra en el log de seguridad para supervisión interna? */
  logForReview: boolean;
};

export type CrisisResource = {
  name: string;
  description: string;
  contact: string;
  url?: string;
};

// Recursos de crisis para España (verificar vigencia periódicamente)
export const CRISIS_RESOURCES_ES: CrisisResource[] = [
  {
    name: "Teléfono de la Esperanza",
    description: "Atención a personas en crisis emocional, 24h",
    contact: "717 003 717",
    url: "https://telefonodelaesperanza.org",
  },
  {
    name: "Línea de Atención a la Conducta Suicida",
    description: "Ministerio de Sanidad, 24h, gratuito",
    contact: "024",
  },
  {
    name: "Cruz Roja Escucha",
    description: "Apoyo emocional, especialmente para jóvenes",
    contact: "900 107 917",
  },
];

export function buildSafetyResponse(level: SafetyAlertLevel): SafetyResponse {
  switch (level) {
    case "none":
      return {
        interruptSession: false,
        studentMessage: null,
        crisisResources: null,
        notifyParent: false,
        parentMessage: null,
        logForReview: false,
      };

    case "watch":
      return {
        interruptSession: false,
        studentMessage: null, // el tutor adapta su tono, sin interrumpir
        crisisResources: null,
        notifyParent: false,
        parentMessage: null,
        logForReview: true, // se registra para seguimiento interno
      };

    case "soft":
      return {
        interruptSession: false,
        studentMessage:
          "Parece que hoy no es el mejor momento. Está bien hacer una pausa. " +
          "Si quieres hablar con alguien de confianza, siempre es buena idea.",
        crisisResources: null,
        notifyParent: true,
        parentMessage:
          "Hemos notado que tu hijo/a ha expresado sentirse un poco desanimado/a esta semana. " +
          "No es urgente, pero puede ser buen momento para una conversación tranquila sobre cómo se encuentra.",
        logForReview: true,
      };

    case "urgent":
      return {
        interruptSession: true,
        studentMessage:
          "Veo que estás pasando un momento difícil. Lo más importante ahora no son los estudios. " +
          "¿Hay alguien en casa con quien puedas hablar?",
        crisisResources: null,
        notifyParent: true,
        parentMessage:
          "⚠️ Tu hijo/a ha expresado un nivel de malestar que nos preocupa. " +
          "Te recomendamos hablar con él/ella hoy, con calma y sin presión. " +
          "Si sientes que necesita apoyo profesional, tu médico de cabecera puede orientarte.",
        logForReview: true,
      };

    case "crisis":
      return {
        interruptSession: true,
        studentMessage:
          "Lo que acabas de escribir me importa mucho. Quiero que sepas que no estás solo/a. " +
          "Hay personas preparadas para escucharte ahora mismo:",
        crisisResources: CRISIS_RESOURCES_ES,
        notifyParent: true,
        parentMessage:
          "🚨 URGENTE: Tu hijo/a ha expresado pensamientos que requieren atención inmediata. " +
          "Por favor, habla con él/ella ahora. Si crees que hay riesgo inmediato, llama al 112.",
        logForReview: true,
      };
  }
}

// ─── Guardianes de implementación ────────────────────────────────────────────
// Reglas que el equipo de desarrollo debe respetar al implementar el Cerebro.

export const CEREBRO_IMPLEMENTATION_RULES = [
  "NUNCA almacenar las señales de crisis como datos de perfil del alumno.",
  "NUNCA mostrar al padre el mensaje exacto que escribió el alumno sin su consentimiento.",
  "NUNCA diagnosticar ni sugerir diagnósticos en mensajes al alumno o al padre.",
  "NUNCA etiquetar al alumno como 'en riesgo' en su perfil permanente.",
  "SIEMPRE permitir al alumno cerrar el mensaje de crisis y continuar si quiere.",
  "SIEMPRE verificar los recursos de crisis con frecuencia trimestral.",
  "SIEMPRE loggear el evento de crisis en un sistema seguro separado de los datos académicos.",
  "En caso de duda sobre el nivel de alerta, escalar al nivel superior. Nunca infraestimar.",
] as const;
