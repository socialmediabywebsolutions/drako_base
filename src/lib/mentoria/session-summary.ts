/**
 * Mentoría — Resumen de sesión automático
 *
 * PROBLEMA: al terminar una sesión el alumno no tiene ningún resumen estructurado
 * de lo que aprendió. Solo puede releer el historial del chat, que mezcla
 * preguntas, correcciones, digresiones y contexto.
 *
 * SOLUCIÓN: al terminar cada sesión el sistema genera un SessionSummary —
 * 3 a 5 puntos clave de lo aprendido, en lenguaje del alumno, accesibles
 * desde el dashboard y el historial de sesiones.
 *
 * DISEÑO:
 * - El resumen NO es una transcripción. Es una síntesis.
 * - Los puntos son positivos: lo que YA sé, no lo que me faltó.
 * - El punto final siempre es el siguiente paso concreto.
 * - El resumen se genera via LLM usando SessionOutcomeSignal como contexto.
 */

import type { SessionOutcomeSignal } from "@/lib/agents/mentoria/base-agent";

// ─── Estructura del resumen ───────────────────────────────────────────────────

export type SessionSummaryPoint = {
  /** Tipo del punto — define cómo se muestra en el dashboard */
  type: "learned" | "practiced" | "clarified" | "next_step" | "achievement";
  /** Texto del punto en lenguaje del alumno */
  text: string;
  /** Concepto o tema al que hace referencia (para vincularlo con el progreso) */
  topicRef?: string;
};

export type SessionSummary = {
  /** ID único del resumen */
  id: string;
  studentId: string;
  subjectSlug: string;
  subjectName: string;
  sessionDate: string; // ISO date

  /** Duración real de la sesión */
  durationMinutes: number;

  /** Titular del resumen — una frase que resume la sesión */
  headline: string;

  /** 3 a 5 puntos clave. El último siempre es "next_step". */
  points: SessionSummaryPoint[];

  /** ¿Cómo terminó el alumno emocionalmente? — para personalizar el mensaje */
  closingTone: "positive" | "neutral" | "needs_encouragement";

  /** Mensaje de cierre personalizado para el alumno */
  closingMessage: string;

  /** Si el Cerebro quiere enviar algo adicional al padre */
  parentNote?: string;
};

// ─── Builder desde SessionOutcomeSignal ──────────────────────────────────────
// Esta función construye el resumen SIN LLM — usando los datos estructurados
// del SessionOutcomeSignal que los agentes ya emiten.
// Para un resumen más rico, el Cerebro puede pasar el historial al LLM.

export function buildSessionSummaryFromSignal(
  signal: SessionOutcomeSignal,
  studentId: string,
  subjectSlug: string,
  subjectName: string,
): Omit<SessionSummary, "id" | "headline" | "closingMessage" | "parentNote"> {
  const points: SessionSummaryPoint[] = [];

  // Puntos de lo aprendido — de topicsCovered que no están en weakTopics
  const masteredTopics = signal.topicsCovered.filter(
    (t) => !signal.weakTopicsDetected.includes(t),
  );
  for (const topic of masteredTopics.slice(0, 2)) {
    points.push({
      type: "learned",
      text: `Trabajé "${topic}" y lo comprendí bien`,
      topicRef: topic,
    });
  }

  // Punto de práctica si masteryLevel es partial o mastered
  if (signal.masteryLevel === "partial" || signal.masteryLevel === "mastered") {
    const topic = signal.topicsCovered[0];
    if (topic) {
      points.push({
        type: "practiced",
        text: signal.masteryLevel === "mastered"
          ? `Demostré que entiendo "${topic}"`
          : `Practiqué "${topic}" — me queda un poco más de práctica`,
        topicRef: topic,
      });
    }
  }

  // Si hay temas débiles, añadir punto de clarificación (sin ser negativo)
  if (signal.weakTopicsDetected.length > 0) {
    const weakTopic = signal.weakTopicsDetected[0];
    points.push({
      type: "clarified",
      text: `Identifiqué que necesito repasar "${weakTopic}"`,
      topicRef: weakTopic,
    });
  }

  // Siguiente paso — siempre el último
  const nextStepTopic = signal.weakTopicsDetected[0] ?? signal.topicsCovered.at(-1) ?? subjectName;
  const nextStepVerb =
    signal.difficultyNextSession === "up"
      ? "profundizar en"
      : signal.difficultyNextSession === "down"
        ? "repasar con más calma"
        : "continuar con";
  points.push({
    type: "next_step",
    text: `Próxima sesión: ${nextStepVerb} "${nextStepTopic}"`,
    topicRef: nextStepTopic,
  });

  // Tono de cierre según estado emocional
  let closingTone: SessionSummary["closingTone"] = "neutral";
  if (signal.emotionalStateAtEnd === "confident") closingTone = "positive";
  if (signal.emotionalStateAtEnd === "frustrated" || signal.emotionalStateAtEnd === "demotivated") {
    closingTone = "needs_encouragement";
  }

  return {
    studentId,
    subjectSlug,
    subjectName,
    sessionDate: new Date().toISOString(),
    durationMinutes: Math.round(signal.durationSeconds / 60),
    points: points.slice(0, 5), // máximo 5 puntos
    closingTone,
  };
}

// ─── Prompt para generar el resumen con LLM ───────────────────────────────────
// Cuando el Cerebro tiene acceso al historial completo, puede usar este prompt
// para que el LLM genere un titular y un mensaje de cierre personalizado.

export function buildSummaryGenerationPrompt(
  params: {
    subjectName: string;
    topicsCovered: string[];
    masteryLevel: string;
    emotionalState: string;
    age: number;
    durationMinutes: number;
    weakTopics: string[];
  },
): string {
  return `Eres el sistema de resumen educativo de Mentoría. Genera el resumen de una sesión de estudio.

DATOS DE LA SESIÓN:
- Materia: ${params.subjectName}
- Duración: ${params.durationMinutes} minutos
- Temas trabajados: ${params.topicsCovered.join(", ")}
- Nivel de dominio al acabar: ${params.masteryLevel}
- Estado emocional del alumno al acabar: ${params.emotionalState}
- Temas que aún necesita trabajar: ${params.weakTopics.length > 0 ? params.weakTopics.join(", ") : "ninguno detectado"}
- Edad del alumno: ${params.age} años

INSTRUCCIONES:
1. Genera un "headline" — una frase corta (máx 10 palabras) que resume la sesión positivamente.
   Ejemplo: "Entendiste las fracciones equivalentes" / "Buen repaso de la Segunda Guerra Mundial"
2. Genera un "closingMessage" — 1-2 frases motivadoras adaptadas a la edad y al estado emocional.
   - Si está frustrado/desanimado: empatía primero, después motivación suave.
   - Si está confiado: celebra sin exceso.
   - Si está neutral: refuerzo neutro y concreto.
   - Para edad < 10: frases cortas, palabras simples, tono cálido.
   - Para edad 10-14: tono amigable, reconocimiento del esfuerzo.
   - Para edad 14+: tono directo y respetuoso, evitar condescendencia.

RESPONDE EXCLUSIVAMENTE en JSON válido con este formato exacto:
{"headline": "...", "closingMessage": "..."}`;
}

// ─── Tipos para la BD (D1) ────────────────────────────────────────────────────

export type SessionSummaryRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  subject_slug: string;
  subject_name: string;
  session_date: string;
  duration_minutes: number;
  headline: string;
  points_json: string; // JSON.stringify(SessionSummaryPoint[])
  closing_tone: SessionSummary["closingTone"];
  closing_message: string;
  parent_note: string | null;
  created_at: string;
};

export function serializeSummary(summary: SessionSummary, tenantId: string): SessionSummaryRow {
  return {
    id: summary.id,
    tenant_id: tenantId,
    student_id: summary.studentId,
    subject_slug: summary.subjectSlug,
    subject_name: summary.subjectName,
    session_date: summary.sessionDate,
    duration_minutes: summary.durationMinutes,
    headline: summary.headline,
    points_json: JSON.stringify(summary.points),
    closing_tone: summary.closingTone,
    closing_message: summary.closingMessage,
    parent_note: summary.parentNote ?? null,
    created_at: new Date().toISOString(),
  };
}

export function deserializeSummary(row: SessionSummaryRow): SessionSummary {
  return {
    id: row.id,
    studentId: row.student_id,
    subjectSlug: row.subject_slug,
    subjectName: row.subject_name,
    sessionDate: row.session_date,
    durationMinutes: row.duration_minutes,
    headline: row.headline,
    points: JSON.parse(row.points_json) as SessionSummaryPoint[],
    closingTone: row.closing_tone,
    closingMessage: row.closing_message,
    parentNote: row.parent_note ?? undefined,
  };
}
