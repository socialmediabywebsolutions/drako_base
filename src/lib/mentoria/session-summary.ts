import type { MentoriaProgress, MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";

export type SessionSummary = {
  sessionId: string;
  studentName: string;
  subjectName: string;
  topic: string;
  durationMinutes: number;
  performanceScore: number;
  emotionalState: string;
  emotionalSignal: string;
  detectedDifficulty: string;
  recommendation: string;
  parentMessage: string;
  actionItems: string[];
};

export function generateSessionSummary(input: {
  sessionId: string;
  student: StudentProfile;
  subject: MentoriaSubject;
  topic: string;
  durationMinutes: number;
  progress: MentoriaProgress;
  evolution: StudentEvolutionProfile;
  motivation: MotivationState;
  emotionalState: string;
  aiTokensUsed: number;
}): SessionSummary {
  const performanceScore = input.progress.masteryScore ?? 50;
  const frustrationLevel = input.evolution.frustrationLevel;
  const confidenceScore = input.progress.confidenceScore ?? 50;
  const progressionVelocity = input.evolution.progressionVelocity;

  const emotionalSignal = detectEmotionalSignal(frustrationLevel, confidenceScore, input.emotionalState);
  const detectedDifficulty = detectDifficulty(performanceScore, frustrationLevel, progressionVelocity);
  const recommendation = generateRecommendation(input.subject.slug, detectedDifficulty, input.topic, input.progress);
  const parentMessage = buildParentMessage(input.student.name, input.subject.name, input.topic, detectedDifficulty, emotionalSignal, recommendation);
  const actionItems = buildActionItems(detectedDifficulty, input.progress, input.evolution);

  return {
    sessionId: input.sessionId,
    studentName: input.student.name,
    subjectName: input.subject.name,
    topic: input.topic,
    durationMinutes: input.durationMinutes,
    performanceScore,
    emotionalState: input.emotionalState,
    emotionalSignal,
    detectedDifficulty,
    recommendation,
    parentMessage,
    actionItems,
  };
}

function detectEmotionalSignal(frustrationLevel: number, confidenceScore: number, emotionalState: string): string {
  if (frustrationLevel >= 0.8) {
    return "high_frustration";
  }
  if (frustrationLevel >= 0.6) {
    return "mild_frustration";
  }
  if (confidenceScore >= 80) {
    return "high_confidence";
  }
  if (confidenceScore >= 60) {
    return "moderate_confidence";
  }
  return "neutral";
}

function detectDifficulty(performanceScore: number, frustrationLevel: number, progressionVelocity: number): string {
  if (performanceScore < 40 || frustrationLevel >= 0.7) {
    return "struggling";
  }
  if (performanceScore < 60 && progressionVelocity < 0.5) {
    return "slow_progress";
  }
  if (performanceScore >= 80 && progressionVelocity >= 0.7) {
    return "excelling";
  }
  return "on_track";
}

function generateRecommendation(subjectSlug: string, difficulty: string, topic: string, progress: MentoriaProgress): string {
  if (difficulty === "struggling") {
    return `Reforzar con ejercicios básicos de ${topic}. Considerar sesiones más cortas y frecuentes.`;
  }
  if (difficulty === "slow_progress") {
    return `Aumentar práctica en ${topic}. Usar ejemplos más concretos y cercanos a la realidad.`;
  }
  if (difficulty === "excelling") {
    return `Desafiar con problemas más complejos. Explorar aplicaciones prácticas de ${topic}.`;
  }
  return `Continuar con la práctica regular de ${topic}. Monitorear progreso.`;
}

function buildParentMessage(studentName: string, subjectName: string, topic: string, difficulty: string, emotionalSignal: string, recommendation: string): string {
  const emotionalContext = emotionalSignal === "high_frustration"
    ? "Se detectó frustración. "
    : emotionalSignal === "mild_frustration"
    ? "Mostró algo de dificultad. "
    : emotionalSignal === "high_confidence"
    ? "Mostró mucha confianza. "
    : "";

  const difficultyContext = difficulty === "struggling"
    ? `${studentName} tuvo dificultad en ${topic}. `
    : difficulty === "slow_progress"
    ? `${studentName} está progresando lentamente en ${topic}. `
    : difficulty === "excelling"
    ? `${studentName} está sobresaliendo en ${topic}. `
    : `${studentName} está trabajando en ${topic}. `;

  return `Hoy en ${subjectName}: ${difficultyContext}${emotionalContext}Recomendación: ${recommendation}`;
}

function buildActionItems(difficulty: string, progress: MentoriaProgress, evolution: StudentEvolutionProfile): string[] {
  const items: string[] = [];

  if (difficulty === "struggling") {
    items.push("Reforzar conceptos básicos");
    items.push("Practicar con ejercicios guiados");
    items.push("Sesiones más cortas (15-20 min)");
  } else if (difficulty === "slow_progress") {
    items.push("Aumentar frecuencia de práctica");
    items.push("Usar ejemplos prácticos");
    items.push("Revisar conceptos previos");
  } else if (difficulty === "excelling") {
    items.push("Proponer desafíos avanzados");
    items.push("Explorar aplicaciones reales");
    items.push("Aumentar complejidad gradualmente");
  } else {
    items.push("Continuar práctica regular");
    items.push("Monitorear progreso");
  }

  if (evolution.weaknesses.length > 0) {
    items.push(`Trabajar en: ${evolution.weaknesses.slice(0, 2).join(", ")}`);
  }

  return items.slice(0, 4);
}
