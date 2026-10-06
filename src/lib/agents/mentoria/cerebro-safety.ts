/**
 * Mentoría — Protocolo de Seguridad del Agente Cerebro
 *
 * Este módulo analiza cada mensaje del alumno ANTES de que llegue al tutor
 * y detecta señales que requieren intervención especial o derivación.
 *
 * PRINCIPIOS DE SEGURIDAD:
 * 1. El tutor de IA no es un psicólogo ni un trabajador social. Nunca simula serlo.
 * 2. Ante cualquier señal de crisis, el agente calma, valida y deriva. No profundiza.
 * 3. Las señales de acoso o daño siempre se escalan a los padres/tutores vía notificación.
 * 4. La privacidad del alumno se respeta — el sistema no revela el contenido exacto
 *    al padre, solo señala que el alumno puede necesitar apoyo.
 * 5. El tutor mantiene tono cálido y sin alarmar; el alumno no debe sentir que "falló".
 *
 * NIVELES DE ALERTA:
 * - NONE: sesión normal
 * - LOW: señal leve de malestar — el tutor ajusta tono, no hay escalado
 * - MEDIUM: señal moderada — tutor deriva suavemente, registra en log de sesión
 * - HIGH: señal de crisis — sesión se detiene, tutor responde con protocolo de crisis,
 *         se dispara notificación al padre/tutor
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SafetyLevel = "none" | "low" | "medium" | "high";

export type SafetyCategory =
  | "none"
  | "emotional_distress"     // tristeza profunda, llanto, desesperanza
  | "self_harm_ideation"     // lenguaje de daño a sí mismo
  | "bullying_disclosure"    // acoso escolar mencionado
  | "abuse_disclosure"       // situación en casa preocupante
  | "suicidal_ideation"      // señales de ideación suicida
  | "academic_crisis"        // colapso académico total, abandono
  | "isolation_signal";      // soledad extrema, sin red de apoyo

export type SafetyAssessment = {
  /** Nivel de alerta detectado */
  level: SafetyLevel;
  /** Categoría principal detectada */
  category: SafetyCategory;
  /** Señales específicas que activaron la alerta */
  triggeredSignals: string[];
  /** ¿Se debe notificar al padre/tutor? */
  notifyParent: boolean;
  /** Respuesta de emergencia para el tutor (solo si level === "high") */
  crisisResponse?: string;
  /** Nota interna para el log de sesión */
  internalNote: string;
};

// ─── Patrones de detección ────────────────────────────────────────────────────

/** ALTO: Ideación suicida — máxima prioridad */
const SUICIDAL_PATTERNS = [
  "quiero morir", "no quiero vivir", "mejor muerto", "mejor muerta",
  "no tiene sentido vivir", "desaparecer para siempre",
  "no me importa si me pasa algo", "ojalá no hubiera nacido",
  "nadie me va a echar de menos", "estarían mejor sin mí",
  "me quiero quitar la vida", "acabar con todo",
];

/** ALTO: Señales de daño a sí mismo */
const SELF_HARM_PATTERNS = [
  "me hago daño", "me corto", "me lastime",
  "me pego a mí mismo", "me pego a mí misma",
  "me castigo", "me hago daño cuando me equivoco",
  "tengo ganas de hacerme daño",
];

/** ALTO: Revelación de abuso */
const ABUSE_PATTERNS = [
  "me pega", "me pega en casa", "me hacen daño en casa",
  "tengo miedo de llegar a casa", "en casa me hacen cosas malas",
  "mi padre me pega", "mi madre me pega",
  "alguien me toca", "alguien me hace cosas",
  "me hacen cosas que no quiero",
];

/** MEDIO: Revelación de acoso escolar */
const BULLYING_PATTERNS = [
  "me hacen bullying", "me acosan", "me insultan en clase",
  "me pegan en el recreo", "nadie quiere ser mi amigo",
  "me llaman nombres", "se meten conmigo",
  "me excluyen", "siempre estoy solo", "siempre estoy sola",
  "no tengo amigos", "me odian en clase",
  "me dejan solo en clase", "me dejan sola en clase",
];

/** MEDIO: Angustia emocional profunda */
const EMOTIONAL_DISTRESS_PATTERNS = [
  "estoy muy triste", "lloro todos los días", "no paro de llorar",
  "me siento muy mal", "me siento horrible",
  "no me siento bien", "me siento vacío", "me siento vacía",
  "no me importa nada", "todo me da igual",
  "estoy agotado emocionalmente", "estoy agotada emocionalmente",
  "no aguanto más", "ya no puedo más con todo",
  "me siento solo siempre", "me siento sola siempre",
  "no tengo a nadie", "no tengo a nadie con quien hablar",
];

/** BAJO: Crisis académica / abandono */
const ACADEMIC_CRISIS_PATTERNS = [
  "voy a dejar de estudiar", "voy a dejar los estudios",
  "para qué estudiar si no sirve de nada",
  "mis padres me van a matar cuando vean las notas",
  "he suspendido todo", "he fallado en todo",
  "soy un desastre", "soy una inútil", "soy un inútil",
  "no sirvo para estudiar", "no valgo para nada",
  "nunca voy a aprobar", "soy lo peor de la clase",
];

/** BAJO: Aislamiento */
const ISOLATION_PATTERNS = [
  "no tengo con quien hablar de esto",
  "mis padres no me entienden", "mis padres no me escuchan",
  "en casa nadie me hace caso",
  "no tengo con quien hablar",
  "solo tú me escuchas", "eres lo único que tengo",
  "prefiero hablar contigo que con las personas reales",
];

// ─── Detector ────────────────────────────────────────────────────────────────

function matchPatterns(text: string, patterns: string[]): string[] {
  const lower = text.toLowerCase();
  return patterns.filter((p) => lower.includes(p));
}

/**
 * Evalúa el mensaje del alumno y produce una evaluación de seguridad.
 * Se debe llamar antes de pasar el mensaje al tutor.
 */
export function assessMessageSafety(studentMessage: string): SafetyAssessment {
  const suicidalMatches = matchPatterns(studentMessage, SUICIDAL_PATTERNS);
  const selfHarmMatches = matchPatterns(studentMessage, SELF_HARM_PATTERNS);
  const abuseMatches = matchPatterns(studentMessage, ABUSE_PATTERNS);
  const bullyingMatches = matchPatterns(studentMessage, BULLYING_PATTERNS);
  const distressMatches = matchPatterns(studentMessage, EMOTIONAL_DISTRESS_PATTERNS);
  const academicCrisisMatches = matchPatterns(studentMessage, ACADEMIC_CRISIS_PATTERNS);
  const isolationMatches = matchPatterns(studentMessage, ISOLATION_PATTERNS);

  // ─── Nivel HIGH ───────────────────────────────────────────────────────────

  if (suicidalMatches.length > 0) {
    return {
      level: "high",
      category: "suicidal_ideation",
      triggeredSignals: suicidalMatches,
      notifyParent: true,
      crisisResponse: buildCrisisResponse("suicidal"),
      internalNote: `Señal de ideación suicida detectada. Patrones: ${suicidalMatches.join(", ")}. Notificación a padres activada.`,
    };
  }

  if (selfHarmMatches.length > 0) {
    return {
      level: "high",
      category: "self_harm_ideation",
      triggeredSignals: selfHarmMatches,
      notifyParent: true,
      crisisResponse: buildCrisisResponse("self_harm"),
      internalNote: `Señal de autolesión detectada. Patrones: ${selfHarmMatches.join(", ")}. Notificación a padres activada.`,
    };
  }

  if (abuseMatches.length > 0) {
    return {
      level: "high",
      category: "abuse_disclosure",
      triggeredSignals: abuseMatches,
      notifyParent: true,
      crisisResponse: buildCrisisResponse("abuse"),
      internalNote: `Posible revelación de abuso. Patrones: ${abuseMatches.join(", ")}. Notificación a padres activada.`,
    };
  }

  // ─── Nivel MEDIUM ─────────────────────────────────────────────────────────

  if (bullyingMatches.length > 0) {
    return {
      level: "medium",
      category: "bullying_disclosure",
      triggeredSignals: bullyingMatches,
      notifyParent: true,
      internalNote: `Posible acoso escolar mencionado. Patrones: ${bullyingMatches.join(", ")}. Registro activado.`,
    };
  }

  if (distressMatches.length >= 2) {
    return {
      level: "medium",
      category: "emotional_distress",
      triggeredSignals: distressMatches,
      notifyParent: false,
      internalNote: `Angustia emocional moderada. Patrones: ${distressMatches.join(", ")}.`,
    };
  }

  // ─── Nivel LOW ────────────────────────────────────────────────────────────

  if (distressMatches.length === 1 || academicCrisisMatches.length > 0) {
    return {
      level: "low",
      category: academicCrisisMatches.length > 0 ? "academic_crisis" : "emotional_distress",
      triggeredSignals: [...distressMatches, ...academicCrisisMatches],
      notifyParent: false,
      internalNote: `Malestar leve o crisis académica detectada. Tutor debe ajustar tono.`,
    };
  }

  if (isolationMatches.length > 0) {
    return {
      level: "low",
      category: "isolation_signal",
      triggeredSignals: isolationMatches,
      notifyParent: false,
      internalNote: `Señal de aislamiento. El alumno puede estar buscando conexión emocional en el tutor IA. Redirigir con calidez hacia personas reales.`,
    };
  }

  // ─── Nivel NONE ───────────────────────────────────────────────────────────

  return {
    level: "none",
    category: "none",
    triggeredSignals: [],
    notifyParent: false,
    internalNote: "",
  };
}

// ─── Respuestas de crisis ────────────────────────────────────────────────────

function buildCrisisResponse(type: "suicidal" | "self_harm" | "abuse"): string {
  if (type === "suicidal") {
    return [
      "Lo que acabas de compartir es muy importante y me alegra que lo hayas dicho.",
      "Necesito que sepas que hay personas reales que quieren ayudarte ahora mismo.",
      "Por favor, habla con alguien de confianza — un familiar, un profesor, o llama al Teléfono de la Esperanza: 717 003 717.",
      "No tienes que pasar por esto solo. Hoy no seguimos con los estudios — lo más importante eres tú.",
    ].join(" ");
  }
  if (type === "self_harm") {
    return [
      "Gracias por contarme esto. Lo que sientes es real y merece atención.",
      "Hablar de hacerse daño es una señal de que necesitas apoyo que va más allá de lo que yo puedo darte.",
      "Te pido que hables hoy con alguien de confianza — tus padres, un profe o un médico.",
      "Estudiar puede esperar. Tu bienestar no.",
    ].join(" ");
  }
  return [
    "Lo que me has dicho me importa mucho y quiero que sepas que lo que describes no está bien.",
    "Mereces estar seguro. Habla con un adulto de confianza fuera de casa — un profesor, el orientador del colegio.",
    "Si no sabes a quién acudir, puedes llamar al 016, es confidencial y gratuito.",
    "Los estudios pueden esperar. Tú no.",
  ].join(" ");
}

// ─── Inyección de directivas de seguridad para el tutor ──────────────────────

/**
 * Genera instrucciones adicionales para el tutor basadas en la evaluación de seguridad.
 * Estas instrucciones se añaden al contexto ANTES del mensaje del alumno.
 */
export function buildSafetyDirective(assessment: SafetyAssessment): string | null {
  if (assessment.level === "none") return null;

  switch (assessment.level) {
    case "high":
      return [
        "⚠️ PROTOCOLO DE SEGURIDAD ACTIVADO — NIVEL CRÍTICO",
        "NO continúes con la sesión académica.",
        "Responde SOLO con el mensaje de crisis que se te ha preparado.",
        "No preguntes más sobre el tema. No explores ni profundices en el malestar.",
        "No diagnostiques ni interpretes. Solo valida, nombra el recurso y detén la sesión.",
        assessment.crisisResponse ?? "",
      ].join("\n");

    case "medium":
      return [
        "⚠️ SEÑAL DE MALESTAR DETECTADA",
        assessment.category === "bullying_disclosure"
          ? "El alumno ha mencionado posible acoso. Responde con calma y empatía antes de continuar. Valida lo que siente, sugiere hablar con un adulto de confianza (profe u orientador) y no fuerces la continuación de los estudios si el alumno no quiere."
          : "El alumno parece estar pasando por un momento difícil emocionalmente. Empieza por reconocer cómo se siente antes de cualquier contenido académico. Pregunta si está bien para continuar. Si no quiere, está bien.",
      ].join("\n");

    case "low":
      return assessment.category === "isolation_signal"
        ? "El alumno puede estar buscando conexión emocional contigo como IA. Responde con calidez, pero recuérdale con naturalidad que tiene personas reales alrededor que le quieren y con quienes puede hablar."
        : "El alumno parece estar con el ánimo bajo o en crisis de confianza académica. Empieza con un pequeño reconocimiento de su esfuerzo antes de entrar en materia. Micro-logros primero.";
  }
}

// ─── Utilidad para log de sesión ─────────────────────────────────────────────

/**
 * Devuelve true si la evaluación requiere registrar un evento en el log de seguridad
 * de la sesión (para auditoría interna, no visible al alumno).
 */
export function requiresSecurityLog(assessment: SafetyAssessment): boolean {
  return assessment.level === "medium" || assessment.level === "high";
}

/**
 * Devuelve true si se debe interrumpir la sesión académica y responder
 * solo con el protocolo de crisis.
 */
export function requiresSessionHalt(assessment: SafetyAssessment): boolean {
  return assessment.level === "high";
}
