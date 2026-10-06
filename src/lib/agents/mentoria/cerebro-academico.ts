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

// ─── Motor de decisión ────────────────────────────────────────────────────────

export function buildCerebroAcademicoDecision(input: {
  academic: AcademicProfile;
  emotional: StudentEmotionalSnapshot;
  masteryMap: TopicMasteryMap;
  currentSubjectSlug: string;
  currentTopic: string;
}): CerebroAcademicoDecision {
  const { academic, emotional, masteryMap, currentSubjectSlug, currentTopic } = input;

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

  if (emotional.frustrationAccumulated >= 0.6 || emotional.lastSessionEmotion === "blocked") {
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
  const sessionBriefing = [
    `Alumno: curso ${academic.schoolYear}, ${academic.age} años.`,
    academic.hasRepeatedCourse ? `Ha repetido ${academic.repeatCount} vez/veces.` : null,
    `Estado emocional previo: ${emotional.lastSessionEmotion} | Tendencia: ${emotional.emotionalTrend}.`,
    `Dominio del tema actual ('${currentTopic}'): ${topicMastery}.`,
    `Materia débil: ${subjectIsWeak ? "sí" : "no"}.`,
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
