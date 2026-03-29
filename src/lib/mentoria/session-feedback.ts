import type { MentoriaProgress } from "@/lib/mentoria/types";

export type SessionFeedback = {
  progressMessage: string;
  scoreChange: number;
  masteryLevel: string;
  confidenceLevel: string;
  nextSteps: string[];
  encouragement: string;
};

export function generateSessionFeedback(input: {
  previousMastery: number;
  currentMastery: number;
  previousConfidence: number;
  currentConfidence: number;
  performanceScore: number;
  sessionCount: number;
  studentName: string;
}): SessionFeedback {
  const masteryChange = input.currentMastery - input.previousMastery;
  const confidenceChange = input.currentConfidence - input.previousConfidence;
  const masteryLevel = getMasteryLevel(input.currentMastery);
  const confidenceLevel = getConfidenceLevel(input.currentConfidence);

  const progressMessage = buildProgressMessage(
    input.studentName,
    masteryChange,
    confidenceChange,
    input.currentMastery
  );

  const encouragement = buildEncouragement(
    input.performanceScore,
    input.sessionCount,
    masteryChange,
    confidenceChange
  );

  const nextSteps = buildNextSteps(input.currentMastery, input.currentConfidence, input.performanceScore);

  return {
    progressMessage,
    scoreChange: masteryChange,
    masteryLevel,
    confidenceLevel,
    nextSteps,
    encouragement,
  };
}

function getMasteryLevel(score: number): string {
  if (score >= 90) return "expert";
  if (score >= 75) return "advanced";
  if (score >= 60) return "intermediate";
  if (score >= 40) return "beginner";
  return "novice";
}

function getConfidenceLevel(score: number): string {
  if (score >= 80) return "very_confident";
  if (score >= 60) return "confident";
  if (score >= 40) return "somewhat_confident";
  return "needs_support";
}

function buildProgressMessage(studentName: string, masteryChange: number, confidenceChange: number, currentMastery: number): string {
  if (masteryChange > 10) {
    return `¡Excelente! ${studentName} ha mejorado significativamente. Dominio: ${currentMastery}%`;
  }
  if (masteryChange > 5) {
    return `Muy bien, ${studentName}. Progreso notable. Dominio: ${currentMastery}%`;
  }
  if (masteryChange > 0) {
    return `Buen trabajo, ${studentName}. Estás avanzando. Dominio: ${currentMastery}%`;
  }
  return `${studentName}, sigue practicando. Dominio: ${currentMastery}%`;
}

function buildEncouragement(performanceScore: number, sessionCount: number, masteryChange: number, confidenceChange: number): string {
  if (performanceScore >= 80) {
    return "¡Vas muy bien! Mantén este ritmo y sigue desafiándote.";
  }
  if (performanceScore >= 60) {
    return "Estás en el camino correcto. Un poco más de práctica y lo dominarás.";
  }
  if (sessionCount < 3) {
    return "Es tu primer intento. Cada sesión te acerca más al dominio. ¡Sigue adelante!";
  }
  if (masteryChange > 0 || confidenceChange > 0) {
    return "Veo que estás mejorando. No te desanimes, el progreso es real.";
  }
  return "Necesitas más práctica en este tema. Vamos a reforzar los conceptos básicos.";
}

function buildNextSteps(mastery: number, confidence: number, performance: number): string[] {
  const steps: string[] = [];

  if (mastery < 40) {
    steps.push("Revisar conceptos básicos");
    steps.push("Practicar con ejercicios guiados");
  } else if (mastery < 60) {
    steps.push("Aumentar dificultad gradualmente");
    steps.push("Practicar problemas variados");
  } else if (mastery < 80) {
    steps.push("Resolver problemas complejos");
    steps.push("Aplicar a situaciones reales");
  } else {
    steps.push("Enseñar a otros");
    steps.push("Explorar temas avanzados");
  }

  if (confidence < 50) {
    steps.push("Sesiones más frecuentes");
  }

  if (performance >= 80) {
    steps.push("Desafío: problema de mayor complejidad");
  }

  return steps.slice(0, 3);
}

export function buildSessionCompletionMessage(feedback: SessionFeedback, subjectName: string): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════");
  lines.push("✅ SESIÓN COMPLETADA");
  lines.push("═══════════════════════════════");
  lines.push("");
  lines.push(feedback.progressMessage);
  lines.push("");
  lines.push(`📊 Nivel de dominio: ${feedback.masteryLevel}`);
  lines.push(`💪 Confianza: ${feedback.confidenceLevel}`);
  lines.push("");
  lines.push(feedback.encouragement);
  lines.push("");
  lines.push("Próximos pasos:");
  feedback.nextSteps.forEach((step) => {
    lines.push(`  • ${step}`);
  });
  lines.push("");
  lines.push("═══════════════════════════════");

  return lines.join("\n");
}
