/**
 * Mentoría — Cerebro Académico del Alumno
 *
 * El Cerebro Académico es el orquestador inteligente que lee al alumno
 * ANTES de cada sesión y decide cómo debe comportarse el tutor.
 *
 * No enseña. No habla con el alumno. Su trabajo es conocer al alumno
 * mejor que él mismo y preparar al tutor para que sea exactamente
 * lo que ese alumno necesita ese día.
 *
 * PRINCIPIOS:
 * 1. Lee el historial completo, no solo la última sesión.
 * 2. Detecta patrones: bloqueos recurrentes, temas que siempre cuestan, momentos de éxito.
 * 3. Considera el contexto emocional de las últimas sesiones.
 * 4. Si el alumno ha repetido curso, trabaja con paciencia extra y micro-logros visibles.
 * 5. Adapta la dificultad antes de que el alumno se frustre, no después.
 */

// ─── Perfil de necesidades de accesibilidad ───────────────────────────────────

export type AccessibilityProfile = {
  /** Dificultades de atención / rasgos TDAH detectados */
  hasAttentionDifficulty: boolean;
  /** Ansiedad ante exámenes o evaluación */
  hasExamAnxiety: boolean;
  /** Dificultades de organización o planificación */
  hasOrganizationIssues: boolean;
  /** Ritmo de procesamiento lento (necesita más tiempo por paso) */
  isSlowProcessor: boolean;
  /** Brecha de base importante (necesita refuerzo de conceptos previos) */
  hasBaseGap: boolean;
  /** Estilo de apoyo preferido del onboarding */
  preferredSupportStyle: "step_by_step" | "visual_steps" | "concrete_example" | "guided_practice" | "quick_checks" | "unknown";
};

/** Parsea el campo supportNotes del alumno para detectar señales de accesibilidad. */
export function parseAccessibilityFromSupportNotes(notes: string): AccessibilityProfile {
  const text = notes.toLowerCase();
  return {
    hasAttentionDifficulty: text.includes("atencion") || text.includes("tdah") || text.includes("attention"),
    hasExamAnxiety: text.includes("ansiedad") || text.includes("exam_anxiety"),
    hasOrganizationIssues: text.includes("organizacion") || text.includes("organization"),
    isSlowProcessor: text.includes("ritmo lento") || text.includes("slow_processor") || text.includes("necesita mas tiempo"),
    hasBaseGap: text.includes("falta de base") || text.includes("base_gap"),
    preferredSupportStyle: text.includes("paso a paso") ? "step_by_step"
      : text.includes("visual y por bloques") ? "visual_steps"
      : text.includes("con ejemplos concretos") ? "concrete_example"
      : text.includes("practica guiada") ? "guided_practice"
      : text.includes("comprobaciones cortas") ? "quick_checks"
      : "unknown",
  };
}

// ─── Perfil académico enriquecido ─────────────────────────────────────────────

export type AcademicProfile = {
  /** Curso actual (ej: "3º ESO") */
  schoolYear: string;
  /** Edad del alumno */
  age: number;
  /** ¿Ha repetido algún curso? */
  hasRepeatedCourse: boolean;
  /** Número de veces que ha repetido (0 si no ha repetido) */
  repeatCount: number;
  /** Materias donde le cuesta más (slug) */
  weakSubjects: string[];
  /** Materias donde destaca (slug) */
  strongSubjects: string[];
  /** Estilo de aprendizaje preferido detectado */
  learningStyle: "visual" | "step_by_step" | "examples_first" | "challenge_first" | "unknown";
  /** Duración óptima de sesión en minutos */
  optimalSessionLength: number;
  /** Mejor franja horaria detectada */
  bestTimeWindow: "morning" | "afternoon" | "evening" | "unknown";
  /** Perfil de necesidades de accesibilidad (opcional, si hay datos) */
  accessibility?: AccessibilityProfile;
};

// ─── Señal de estado emocional ────────────────────────────────────────────────

export type StudentEmotionalSnapshot = {
  /** Estado emocional detectado en la última sesión */
  lastSessionEmotion: "confident" | "frustrated" | "blocked" | "demotivated" | "calm" | "unknown";
  /** Tendencia de las últimas 5 sesiones */
  emotionalTrend: "improving" | "stable" | "declining" | "unknown";
  /** Nivel de frustración acumulada (0-1) */
  frustrationAccumulated: number;
  /** ¿Ha habido alertas de seguridad recientes? */
  hasRecentSafetyAlert: boolean;
};

// ─── Mapa de dominio por tema ──────────────────────────────────────────────────

export type TopicMasteryMap = {
  /** slug del tema → nivel de dominio */
  [topicSlug: string]: "mastered" | "partial" | "not_yet" | "never_seen";
};

// ─── Decisión del Cerebro Académico ──────────────────────────────────────────

export type CerebroAcademicoDecision = {
  /** Tono que debe usar el tutor hoy */
  tutorTone: "encouraging" | "direct" | "empathetic" | "celebratory" | "patient";
  /** Ritmo de la sesión */
  sessionPace: "slow" | "steady" | "fast";
  /** Nivel de dificultad de inicio */
  startingDifficulty: "easy" | "medium" | "hard";
  /** ¿Debe el tutor empezar reconociendo el estado emocional antes de la materia? */
  checkInFirst: boolean;
  /** Instrucción específica para el tutor (no visible al alumno) */
  tutorDirective: string;
  /** Temas frágiles a vigilar esta sesión */
  fragilTopics: string[];
  /** Micro-logros que celebrar si aparecen */
  celebrationTriggers: string[];
  /** ¿Debe el tutor frenar y simplificar si detecta bloqueo? */
  simplifyOnBlock: boolean;
  /** Resumen interno para el próximo tutor */
  sessionBriefing: string;
};

// ─── Detección de emoción en tiempo real ──────────────────────────────────────

export type RealtimeEmotionSignal = {
  /** Señal de frustración detectada en el texto (0 = nada, 1 = muy alta) */
  frustrationSignal: number;
  /** Señal de bloqueo / no comprensión */
  blockSignal: number;
  /** Señal de confianza / seguridad */
  confidenceSignal: number;
  /** Señal de desmotivación o abandono */
  demotivationSignal: number;
  /** Emoción dominante detectada */
  dominantEmotion: StudentEmotionalSnapshot["lastSessionEmotion"];
};

const FRUSTRATION_PATTERNS = [
  "no entiendo", "no entiendo nada", "no lo pillo", "no me entera",
  "esto es imposible", "odio esto", "lo odio", "qué asco", "qué rollo",
  "me rindo", "paso de esto", "ya no puedo más", "nunca lo voy a entender",
  "es muy difícil", "demasiado difícil", "no puedo", "no sé cómo",
  "estoy perdido", "estoy perdida", "no sé nada", "fatal",
];

const BLOCK_PATTERNS = [
  "no sé", "no sé qué", "no sé cómo", "no entiendo el paso",
  "no me sale", "me he quedado atascado", "me he bloqueado",
  "no veo por qué", "qué significa", "qué es", "no comprendo",
  "me confundo", "me confunde", "estoy confundido", "estoy confundida",
  "puedes explicar", "explícame", "no me queda claro",
];

const CONFIDENCE_PATTERNS = [
  "lo entiendo", "ya lo tengo", "creo que sí", "lo he pillado",
  "ahora sí", "tiene sentido", "lo veo claro", "perfecto",
  "genial", "gracias", "fácil", "ya sé", "lo sé",
  "correcto", "exacto", "bien",
];

const DEMOTIVATION_PATTERNS = [
  "para qué", "para qué sirve esto", "esto no sirve para nada",
  "no me interesa", "me da igual", "me aburre", "aburrido",
  "no quiero", "no tengo ganas", "estoy cansado", "estoy cansada",
  "otro día", "mañana", "dejémoslo",
];

function countMatches(text: string, patterns: string[]): number {
  const lower = text.toLowerCase();
  return patterns.filter((pattern) => lower.includes(pattern)).length;
}

/**
 * Analiza el mensaje del alumno y detecta señales emocionales en tiempo real.
 * Se llama ANTES de pasar el mensaje al tutor para ajustar el contexto.
 */
export function analyzeStudentMessageEmotion(studentMessage: string): RealtimeEmotionSignal {
  const frustrationCount = countMatches(studentMessage, FRUSTRATION_PATTERNS);
  const blockCount = countMatches(studentMessage, BLOCK_PATTERNS);
  const confidenceCount = countMatches(studentMessage, CONFIDENCE_PATTERNS);
  const demotivationCount = countMatches(studentMessage, DEMOTIVATION_PATTERNS);
  const total = Math.max(frustrationCount + blockCount + confidenceCount + demotivationCount, 1);

  const frustrationSignal = Math.min(frustrationCount / 2, 1);
  const blockSignal = Math.min(blockCount / 3, 1);
  const confidenceSignal = Math.min(confidenceCount / 2, 1);
  const demotivationSignal = Math.min(demotivationCount / 2, 1);

  let dominantEmotion: RealtimeEmotionSignal["dominantEmotion"] = "unknown";
  if (frustrationSignal >= 0.4) {
    dominantEmotion = "frustrated";
  } else if (demotivationSignal >= 0.4) {
    dominantEmotion = "demotivated";
  } else if (blockSignal >= 0.3) {
    dominantEmotion = "blocked";
  } else if (confidenceSignal >= 0.4) {
    dominantEmotion = "confident";
  } else if (total >= 1) {
    dominantEmotion = "calm";
  }

  return { frustrationSignal, blockSignal, confidenceSignal, demotivationSignal, dominantEmotion };
}

/**
 * Combina la señal emocional en tiempo real con el snapshot histórico.
 * La señal en vivo tiene más peso que el historial si es fuerte.
 */
export function mergeEmotionalSnapshot(
  historical: StudentEmotionalSnapshot,
  realtime: RealtimeEmotionSignal,
): StudentEmotionalSnapshot {
  if (realtime.dominantEmotion === "unknown") return historical;

  // Si hay señal fuerte en vivo, sobreescribe la emoción de la última sesión
  const frustrationAccumulated = Math.min(
    historical.frustrationAccumulated * 0.7 + realtime.frustrationSignal * 0.3,
    1,
  );

  return {
    ...historical,
    lastSessionEmotion: realtime.dominantEmotion,
    frustrationAccumulated,
  };
}

// ─── Motor de decisión ────────────────────────────────────────────────────────

export function buildCerebroAcademicoDecision(input: {
  academic: AcademicProfile;
  emotional: StudentEmotionalSnapshot;
  masteryMap: TopicMasteryMap;
  currentSubjectSlug: string;
  currentTopic: string;
}): CerebroAcademicoDecision {
  const { academic, emotional, masteryMap, currentSubjectSlug, currentTopic } = input;
  const accessibility = academic.accessibility;

  // ── Determinar tono base ──────────────────────────────────────────────────
  let tutorTone: CerebroAcademicoDecision["tutorTone"] = "direct";

  if (emotional.hasRecentSafetyAlert || emotional.frustrationAccumulated >= 0.75) {
    tutorTone = "empathetic";
  } else if (emotional.lastSessionEmotion === "frustrated" || emotional.emotionalTrend === "declining") {
    tutorTone = "encouraging";
  } else if (emotional.lastSessionEmotion === "confident" && emotional.emotionalTrend === "improving") {
    tutorTone = "celebratory";
  } else if (academic.hasRepeatedCourse) {
    tutorTone = "patient"; // nunca pressure, siempre micro-logros
  }

  // ── Determinar ritmo ──────────────────────────────────────────────────────
  let sessionPace: CerebroAcademicoDecision["sessionPace"] = "steady";

  if (
    emotional.frustrationAccumulated >= 0.6
    || emotional.lastSessionEmotion === "blocked"
    || accessibility?.hasAttentionDifficulty
    || accessibility?.isSlowProcessor
  ) {
    sessionPace = "slow";
  } else if (emotional.emotionalTrend === "improving" && emotional.lastSessionEmotion === "confident") {
    sessionPace = "fast";
  }

  // ── Dificultad de inicio ──────────────────────────────────────────────────
  const topicMastery = masteryMap[currentTopic] ?? "never_seen";
  const subjectIsWeak = academic.weakSubjects.includes(currentSubjectSlug);

  let startingDifficulty: CerebroAcademicoDecision["startingDifficulty"] = "medium";

  if (topicMastery === "not_yet" || subjectIsWeak || emotional.frustrationAccumulated >= 0.5) {
    startingDifficulty = "easy"; // empezar fácil, ganar confianza primero
  } else if (topicMastery === "mastered" && !subjectIsWeak) {
    startingDifficulty = "hard";
  }

  // ── Check-in emocional antes de la materia ────────────────────────────────
  const checkInFirst =
    emotional.lastSessionEmotion === "frustrated" ||
    emotional.lastSessionEmotion === "demotivated" ||
    emotional.emotionalTrend === "declining" ||
    emotional.hasRecentSafetyAlert;

  // ── Directiva para el tutor ───────────────────────────────────────────────
  const directives: string[] = [];

  if (academic.hasRepeatedCourse) {
    directives.push(
      `Este alumno ha repetido ${academic.repeatCount} curso${academic.repeatCount > 1 ? "s" : ""}. ` +
      "Cada avance pequeño es enorme para él/ella — hazlo visible sin sobreactuar. Mucha paciencia, zero presión."
    );
  }

  if (checkInFirst) {
    directives.push("Antes de entrar en materia, pregunta cómo está el alumno hoy. Una pregunta simple, sin dramatizar.");
  }

  if (topicMastery === "not_yet") {
    directives.push(`El alumno ya ha intentado '${currentTopic}' antes sin éxito. Empieza desde un ángulo diferente — no repitas el mismo enfoque.`);
  }

  if (subjectIsWeak) {
    directives.push(`'${currentSubjectSlug}' es una de sus materias más difíciles. Reduce la presión, divide en pasos mínimos, y celebra cada paso completado.`);
  }

  if (emotional.frustrationAccumulated >= 0.7) {
    directives.push("Alta frustración acumulada. Si aparece cualquier señal de bloqueo, simplifica inmediatamente sin esperar a que el alumno lo pida.");
  }

  // ── Directivas de accesibilidad ───────────────────────────────────────────
  if (accessibility?.hasAttentionDifficulty) {
    directives.push(
      "Este alumno tiene dificultades de atención. " +
      "Divide CADA explicación en pasos de máximo 2-3 líneas. " +
      "Haz una pausa y comprueba comprensión después de cada paso. " +
      "Usa frases cortas, activas y concretas. Evita párrafos largos.",
    );
  }

  if (accessibility?.hasExamAnxiety) {
    directives.push(
      "Este alumno tiene ansiedad ante evaluaciones. " +
      "NUNCA uses lenguaje de examen ('vas a ser evaluado', 'esto entra en el examen'). " +
      "Enmarca los ejercicios como práctica y exploración, no como prueba. " +
      "Si se equivoca, celebra el intento antes de corregir.",
    );
  }

  if (accessibility?.hasOrganizationIssues) {
    directives.push(
      "Este alumno tiene dificultades de organización. " +
      "Al inicio de cada explicación, anuncia el plan: '1. Vamos a ver X, 2. luego practicamos Y'. " +
      "Usa listas numeradas siempre. Resume al final de cada bloque.",
    );
  }

  if (accessibility?.isSlowProcessor) {
    directives.push(
      "Este alumno procesa la información más lento que la media. " +
      "Espera respuesta antes de continuar. No acumules preguntas — haz UNA a la vez. " +
      "Si no responde rápido, no es bloqueo — dale tiempo.",
    );
  }

  if (accessibility?.hasBaseGap) {
    directives.push(
      "Este alumno tiene lagunas de base importantes. " +
      "Antes de cada concepto nuevo, verifica que los conceptos previos están claros con una pregunta simple. " +
      "Si falla el concepto previo, trabaja ese primero sin avanzar.",
    );
  }

  if (accessibility?.preferredSupportStyle === "visual_steps") {
    directives.push("Usa siempre listas numeradas para los pasos. Nunca expliques en texto corrido sin estructura visual.");
  } else if (accessibility?.preferredSupportStyle === "concrete_example") {
    directives.push("Empieza SIEMPRE con un ejemplo real antes de la teoría. La teoría viene después del ejemplo, nunca antes.");
  } else if (accessibility?.preferredSupportStyle === "quick_checks") {
    directives.push("Haz comprobaciones cortas cada 2-3 intercambios. Una pregunta directa: '¿lo tienes claro hasta aquí?'");
  }

  // ── Temas frágiles ────────────────────────────────────────────────────────
  const fragilTopics = Object.entries(masteryMap)
    .filter(([, level]) => level === "partial" || level === "not_yet")
    .map(([slug]) => slug);

  // ── Triggers de celebración ───────────────────────────────────────────────
  const celebrationTriggers: string[] = [];

  if (academic.hasRepeatedCourse) {
    celebrationTriggers.push("cualquier respuesta correcta en materia donde antes fallaba");
  }
  if (subjectIsWeak) {
    celebrationTriggers.push(`avance en ${currentSubjectSlug}`);
  }
  if (topicMastery === "not_yet") {
    celebrationTriggers.push(`primer paso completado en '${currentTopic}'`);
  }

  // ── Briefing de sesión ────────────────────────────────────────────────────
  const accessibilityFlags = accessibility
    ? [
        accessibility.hasAttentionDifficulty ? "atención" : null,
        accessibility.hasExamAnxiety ? "ansiedad exámenes" : null,
        accessibility.hasOrganizationIssues ? "organización" : null,
        accessibility.isSlowProcessor ? "ritmo lento" : null,
        accessibility.hasBaseGap ? "brecha base" : null,
      ].filter(Boolean)
    : [];

  const sessionBriefing = [
    `Alumno: curso ${academic.schoolYear}, ${academic.age} años.`,
    academic.hasRepeatedCourse ? `Ha repetido ${academic.repeatCount} vez/veces.` : null,
    `Estado emocional previo: ${emotional.lastSessionEmotion} | Tendencia: ${emotional.emotionalTrend}.`,
    `Dominio del tema actual ('${currentTopic}'): ${topicMastery}.`,
    `Materia débil: ${subjectIsWeak ? "sí" : "no"}.`,
    accessibilityFlags.length > 0 ? `Necesidades: ${accessibilityFlags.join(", ")}.` : null,
    `Tono decidido: ${tutorTone} | Ritmo: ${sessionPace} | Dificultad inicio: ${startingDifficulty}.`,
  ].filter(Boolean).join(" ");

  return {
    tutorTone,
    sessionPace,
    startingDifficulty,
    checkInFirst,
    tutorDirective: directives.join(" "),
    fragilTopics,
    celebrationTriggers,
    simplifyOnBlock: emotional.frustrationAccumulated >= 0.5 || subjectIsWeak,
    sessionBriefing,
  };
}

// ─── Inyector de decisión en system prompt ────────────────────────────────────
// Convierte la decisión del Cerebro en instrucciones que el tutor puede seguir.

export function injectCerebroDirectives(decision: CerebroAcademicoDecision): string {
  const lines: string[] = ["[CEREBRO ACADÉMICO — instrucciones privadas para el tutor]"];

  lines.push(`Tono de esta sesión: ${decision.tutorTone}.`);
  lines.push(`Ritmo: ${decision.sessionPace} | Dificultad de inicio: ${decision.startingDifficulty}.`);

  if (decision.checkInFirst) {
    lines.push("PRIMERO pregunta cómo está el alumno antes de entrar en la materia.");
  }

  if (decision.tutorDirective) {
    lines.push(decision.tutorDirective);
  }

  if (decision.fragilTopics.length > 0) {
    lines.push(`Temas frágiles a vigilar: ${decision.fragilTopics.join(", ")}.`);
  }

  if (decision.simplifyOnBlock) {
    lines.push("Si detectas bloqueo: simplifica inmediatamente, sin esperar.");
  }

  if (decision.celebrationTriggers.length > 0) {
    lines.push(`Celebra visiblemente si aparece: ${decision.celebrationTriggers.join("; ")}.`);
  }

  return lines.join("\n");
}
