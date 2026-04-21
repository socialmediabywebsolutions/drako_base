import type { StateActions, StateDecision } from "@/lib/mentoria/state/state-types";

const ACTIONS_BY_STATE: Record<StateDecision["state"], StateActions> = {
  focused: {
    boardMode: "normal",
    chatTone: "light",
    chatIntensity: "low",
    guardianAlert: "none",
    guardianSummary: "El alumno está en ritmo estable y no requiere intervención del tutor.",
    primaryStudentAction: "Continuar con la siguiente tarea prioritaria sin cambiar el ritmo.",
  },
  progressing: {
    boardMode: "reinforce_progress",
    chatTone: "motivating",
    chatIntensity: "low",
    guardianAlert: "none",
    guardianSummary: "Se observa mejora gradual; conviene consolidar la racha sin añadir presión.",
    primaryStudentAction: "Cerrar el siguiente bloque para consolidar el avance reciente.",
  },
  demotivated: {
    boardMode: "simplified_focus",
    chatTone: "calm",
    chatIntensity: "medium",
    guardianAlert: "soft",
    guardianSummary: "Hay bajada de impulso, pero todavía existe presencia y margen de reconducción suave.",
    primaryStudentAction: "Reducir la sesión a una meta pequeña y cerrable hoy.",
  },
  overloaded: {
    boardMode: "overload_reduction",
    chatTone: "calm",
    chatIntensity: "high",
    guardianAlert: "recommended",
    guardianSummary: "El alumno muestra saturación: demasiadas tareas abiertas y poca capacidad de cierre.",
    primaryStudentAction: "Cerrar una única prioridad y ocultar el resto por ahora.",
  },
  inconsistent: {
    boardMode: "simplified_focus",
    chatTone: "supportive",
    chatIntensity: "medium",
    guardianAlert: "soft",
    guardianSummary: "El problema dominante es la irregularidad; conviene reforzar continuidad mínima.",
    primaryStudentAction: "Completar hoy una sesión corta para mantener el hábito.",
  },
  disconnected: {
    boardMode: "reentry",
    chatTone: "supportive",
    chatIntensity: "high",
    guardianAlert: "recommended",
    guardianSummary: "El alumno se está alejando del sistema y necesita una reentrada fácil, no una carga nueva.",
    primaryStudentAction: "Reentrar con una tarea guiada de 5-10 minutos.",
  },
  at_risk: {
    boardMode: "intervention",
    chatTone: "firm",
    chatIntensity: "high",
    guardianAlert: "critical",
    guardianSummary: "Existe riesgo alto de bloqueo sostenido y conviene intervención coordinada hoy.",
    primaryStudentAction: "Reducir la carga al mínimo esencial y guiar paso a paso la siguiente acción.",
  },
  recovering: {
    boardMode: "recovery",
    chatTone: "motivating",
    chatIntensity: "medium",
    guardianAlert: "soft",
    guardianSummary: "El alumno está reenganchando; ahora importa sostener el retorno sin sobreexigir.",
    primaryStudentAction: "Mantener una carga moderada y asegurar un cierre claro hoy.",
  },
};

export function deriveStateActions(decision: StateDecision): StateActions {
  return ACTIONS_BY_STATE[decision.state];
}
