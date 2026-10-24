import type { StateDecision, StateSignals, StudentState, InterventionPriority, StateSeverity } from "@/lib/mentoria/state/state-types";

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function buildDefaultSignals(): StateSignals {
  return {
    studyMinutesRatio: 0.72,
    taskCompletionRatio: 0.68,
    consistencyRatio: 0.64,
    academicDropRatio: 0.12,
    sessionAbandonRate: 0.18,
    unfinishedTaskRate: 0.22,
    reentryFragility: 0.28,
    irregularityScore: 0.32,
    negativeToneScore: 0.24,
    helpSeekingScore: 0.55,
    chatResponseLatency: 0.35,
    chatEngagementRatio: 0.7,
    daysInactive: 0,
    usageDrop7d: 0.08,
    lateNightOverloadPattern: false,
    burstThenDropPattern: false,
  };
}

export async function collectStudentSignals(studentId: string): Promise<StateSignals> {
  const seed = Array.from(studentId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variant = (seed % 17) / 100;
  const base = buildDefaultSignals();

  return {
    ...base,
    studyMinutesRatio: clamp(base.studyMinutesRatio - variant),
    taskCompletionRatio: clamp(base.taskCompletionRatio - variant / 2),
    consistencyRatio: clamp(base.consistencyRatio - variant / 3),
    negativeToneScore: clamp(base.negativeToneScore + variant / 2),
    chatEngagementRatio: clamp(base.chatEngagementRatio - variant / 2),
    irregularityScore: clamp(base.irregularityScore + variant / 2),
  };
}

function buildDecision(state: StudentState, signals: StateSignals, reasons: string[], confidence: number, severity: StateSeverity, priority: InterventionPriority): StateDecision {
  return {
    state,
    severity,
    priority,
    confidence: clamp(confidence),
    reasons,
    signals,
  };
}

export function evaluateStudentState(signals: StateSignals): StateDecision {
  const reasons: string[] = [];

  if (
    (signals.daysInactive >= 5 || signals.taskCompletionRatio < 0.25) &&
    [
      signals.negativeToneScore >= 0.65,
      signals.sessionAbandonRate >= 0.5,
      signals.consistencyRatio < 0.35,
      signals.usageDrop7d >= 0.6,
    ].filter(Boolean).length >= 2
  ) {
    reasons.push("Hay combinación de caída académica, baja continuidad y señales persistentes de bloqueo.");
    if (signals.daysInactive >= 5) reasons.push("El alumno acumula demasiados días sin actividad.");
    if (signals.taskCompletionRatio < 0.25) reasons.push("La finalización de tareas está por debajo del mínimo viable.");
    return buildDecision("at_risk", signals, reasons, 0.92, "high", "critical");
  }

  if (signals.daysInactive >= 4 && signals.chatEngagementRatio < 0.2 && signals.usageDrop7d >= 0.5) {
    reasons.push("Hay desconexión clara del sistema en uso y conversación.");
    reasons.push("La caída de actividad ya no es puntual.");
    return buildDecision("disconnected", signals, reasons, 0.89, "high", "high");
  }

  if (
    signals.sessionAbandonRate >= 0.45 &&
    signals.unfinishedTaskRate >= 0.5 &&
    (signals.lateNightOverloadPattern || signals.negativeToneScore >= 0.5)
  ) {
    reasons.push("Se abren demasiadas tareas y se cierran pocas.");
    reasons.push("Las señales apuntan a saturación, no a simple desorganización.");
    return buildDecision("overloaded", signals, reasons, 0.84, "high", "high");
  }

  if (
    signals.negativeToneScore >= 0.55 &&
    signals.taskCompletionRatio >= 0.3 &&
    signals.taskCompletionRatio <= 0.6 &&
    signals.daysInactive <= 2
  ) {
    reasons.push("El alumno sigue presente, pero con caída de impulso y lenguaje más negativo.");
    reasons.push("Todavía hay actividad, así que conviene reactivar sin sobredramatizar.");
    return buildDecision("demotivated", signals, reasons, 0.78, "medium", "medium");
  }

  if (signals.consistencyRatio < 0.5 && signals.daysInactive < 4 && signals.irregularityScore >= 0.6) {
    reasons.push("El patrón dominante es irregularidad, no ausencia total.");
    reasons.push("Hay días buenos, pero no se sostienen lo suficiente.");
    return buildDecision("inconsistent", signals, reasons, 0.76, "medium", "medium");
  }

  if (
    signals.daysInactive <= 3 &&
    signals.taskCompletionRatio >= 0.45 &&
    signals.taskCompletionRatio < 0.75 &&
    signals.consistencyRatio >= 0.45 &&
    signals.usageDrop7d <= 0.25 &&
    signals.academicDropRatio <= 0.2
  ) {
    reasons.push("Hay señales de reenganche sin haber recuperado todavía un ritmo sólido.");
    reasons.push("Conviene proteger la recuperación antes de intensificar la carga.");
    return buildDecision("recovering", signals, reasons, 0.64, "medium", "medium");
  }

  if (
    signals.taskCompletionRatio >= 0.6 &&
    (signals.studyMinutesRatio >= 0.75 || signals.consistencyRatio >= 0.7 || signals.academicDropRatio <= 0.05) &&
    signals.negativeToneScore <= 0.4
  ) {
    reasons.push("El alumno está mejorando respecto a su baseline reciente.");
    reasons.push("Hay progreso observable sin necesidad de una intervención fuerte.");
    return buildDecision("progressing", signals, reasons, 0.72, "low", "low");
  }

  if (
    signals.taskCompletionRatio >= 0.75 &&
    signals.consistencyRatio >= 0.7 &&
    signals.sessionAbandonRate <= 0.2 &&
    signals.negativeToneScore <= 0.25 &&
    signals.daysInactive <= 1
  ) {
    reasons.push("La ejecución es estable y el sistema no necesita intervenir más de la cuenta.");
    return buildDecision("focused", signals, reasons, 0.74, "low", "low");
  }

  reasons.push("El patrón actual es estable pero no concluyente; se asume progreso funcional por defecto.");
  return buildDecision("progressing", signals, reasons, 0.55, "low", "low");
}
