/**
 * Mentoría — Protocolo de traspaso entre agentes
 *
 * PROBLEMA: cuando el Agente Deberes necesita delegar al Tutor Núcleo,
 * o cuando el Tutor detecta un bloqueo y quiere que tome el control el Cerebro,
 * no existe un formato estandarizado para transmitir el contexto de la sesión.
 * El resultado es que el alumno nota "saltos" en el tono o pérdida de contexto.
 *
 * SOLUCIÓN: AgentHandoffSignal — un sobre sellado que el agente entrante recibe
 * con todo lo que necesita para continuar sin fricción.
 *
 * PRINCIPIO: el traspaso es invisible para el alumno.
 * El nuevo agente NO dice "ahora te ayudaré yo" ni referencia al agente anterior.
 * Simplemente continúa la conversación con el contexto recibido.
 */

import type { CerebroEscalationReason, ConceptMasteryLevel } from "./base-agent";

// ─── Tipos de agentes que pueden participar en un traspaso ───────────────────

export type MentoriaAgentRole =
  | "homework"      // Agente Deberes — revisión de tareas concretas
  | "tutor_core"    // Tutor Núcleo — enseñanza de conceptos
  | "exam_prep"     // Agente Examen — preparación y simulacros
  | "planner"       // Planner — organización del plan de estudio
  | "cerebro"       // Cerebro — orquestador emocional y estratégico
  | "guardian";     // Canal del padre/tutor (no es un agente tutor, pero recibe señales)

// ─── Motivo del traspaso ──────────────────────────────────────────────────────

export type HandoffReason =
  // El alumno pasó de revisar deberes a necesitar explicación del concepto base
  | "needs_concept_explanation"
  // El alumno terminó el tema y es hora de practicar con ejercicios
  | "ready_for_practice"
  // El alumno tiene un examen próximo — prioridad a simulacros
  | "exam_approaching"
  // El agente actual detectó bloqueo emocional que supera su capacidad
  | "emotional_block"
  // El alumno lleva demasiado tiempo sin avanzar — intervención del Cerebro
  | "session_stall"
  // El alumno pidió explícitamente cambiar de tipo de ayuda
  | "student_request"
  // La sesión terminó — traspaso al siguiente agente del plan diario
  | "session_complete"
  // Señal de alerta de seguridad que el Cerebro debe gestionar
  | "safety_alert";

// ─── Modo de sesión — distingue "quiero estudiar" de "esto me cuesta mucho" ──

export type SessionIntentMode =
  // El alumno viene a estudiar normalmente — flujo estándar
  | "study"
  // El alumno declaró dificultad explícita al iniciar — flujo de refuerzo
  | "struggling"
  // El alumno viene a repasar antes de un examen — flujo de revisión rápida
  | "review"
  // El alumno tiene deberes que entregar pronto — flujo de resolución de tarea
  | "homework"
  // El alumno quiere hacer un simulacro de examen
  | "exam_simulation";

// ─── El sobre de traspaso ─────────────────────────────────────────────────────

export type AgentHandoffSignal = {
  /** Quién envía el traspaso */
  fromAgent: MentoriaAgentRole;
  /** Quién debe tomar el control */
  toAgent: MentoriaAgentRole;
  /** Por qué se produce el traspaso */
  reason: HandoffReason;

  /** Contexto del alumno en el momento del traspaso */
  studentContext: {
    studentId: string;
    age: number;
    /** Materia en la que se estaba trabajando */
    subjectSlug: string;
    /** Tema concreto dentro de la materia */
    currentTopic: string;
    /** ¿Cómo llegó el alumno a esta sesión? */
    sessionIntent: SessionIntentMode;
  };

  /** Estado de la sesión en el momento del traspaso */
  sessionState: {
    /** Cuántos intercambios han ocurrido ya */
    turnCount: number;
    /** Duración de la sesión hasta ahora (segundos) */
    elapsedSeconds: number;
    /** Dominio del concepto justo antes del traspaso */
    masteryAtHandoff: ConceptMasteryLevel;
    /** Estado emocional estimado del alumno */
    emotionalState: "calm" | "frustrated" | "blocked" | "demotivated" | "confident" | "unknown";
    /** Los últimos N mensajes del alumno (máx 3, para contexto inmediato) */
    recentStudentMessages: string[];
  };

  /** Lo que el agente entrante necesita saber para NO repetir lo que ya se hizo */
  continuationContext: {
    /** Qué ya se explicó o revisó en esta sesión */
    alreadyCovered: string[];
    /** Dónde se quedó exactamente el alumno */
    lastStudentAction: string;
    /** Próximo paso sugerido por el agente saliente */
    suggestedNextStep: string;
    /** Nota interna libre (no se muestra al alumno) */
    internalNote?: string;
  };

  /** Solo presente si reason === "safety_alert" */
  safetyContext?: {
    alertLevel: "soft" | "urgent" | "crisis";
    triggerReason: string;
  };

  /** Solo presente si reason relacionado con escalada al Cerebro */
  escalationReason?: CerebroEscalationReason;

  /** Timestamp ISO del traspaso */
  timestamp: string;
};

// ─── Builder helpers ──────────────────────────────────────────────────────────

/**
 * Construye un handoff estándar desde el Agente Deberes al Tutor Núcleo.
 * Caso más común: el alumno tiene un ejercicio que no entiende y necesita
 * que le expliquen el concepto base.
 */
export function buildHomeworkToTutorHandoff(
  studentId: string,
  age: number,
  subjectSlug: string,
  currentTopic: string,
  sessionState: AgentHandoffSignal["sessionState"],
  alreadyCovered: string[],
  lastMessage: string,
): AgentHandoffSignal {
  return {
    fromAgent: "homework",
    toAgent: "tutor_core",
    reason: "needs_concept_explanation",
    studentContext: {
      studentId,
      age,
      subjectSlug,
      currentTopic,
      sessionIntent: "homework",
    },
    sessionState,
    continuationContext: {
      alreadyCovered,
      lastStudentAction: lastMessage,
      suggestedNextStep: `Explicar el concepto base de "${currentTopic}" antes de retomar el ejercicio.`,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Construye un handoff al Cerebro cuando se detecta bloqueo emocional.
 * El Cerebro evalúa si debe interrumpir la sesión o simplemente adaptar el ritmo.
 */
export function buildEmotionalEscalationHandoff(
  studentId: string,
  age: number,
  subjectSlug: string,
  currentTopic: string,
  fromAgent: MentoriaAgentRole,
  sessionState: AgentHandoffSignal["sessionState"],
  escalationReason: CerebroEscalationReason,
  internalNote?: string,
): AgentHandoffSignal {
  return {
    fromAgent,
    toAgent: "cerebro",
    reason: "emotional_block",
    studentContext: {
      studentId,
      age,
      subjectSlug,
      currentTopic,
      sessionIntent: "study",
    },
    sessionState,
    continuationContext: {
      alreadyCovered: [],
      lastStudentAction: sessionState.recentStudentMessages.at(-1) ?? "",
      suggestedNextStep: "Evaluar si continuar la sesión o proponer una pausa.",
      internalNote,
    },
    escalationReason,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Convierte un SessionIntentMode a texto legible para el prompt del agente entrante.
 * El agente puede usar esto para calibrar su apertura de conversación.
 */
export function describeSessionIntent(intent: SessionIntentMode): string {
  switch (intent) {
    case "study":
      return "El alumno viene a estudiar de forma regular.";
    case "struggling":
      return "El alumno declaró al inicio que le está costando. Adapta el ritmo y refuerza la confianza.";
    case "review":
      return "El alumno quiere repasar lo ya visto. Sé conciso y ve directo a los puntos clave.";
    case "homework":
      return "El alumno tiene deberes concretos. Ayúdale a resolverlos sin darle la solución directamente.";
    case "exam_simulation":
      return "El alumno quiere simular un examen. Modo evaluación: no ayudes hasta que termine.";
  }
}

/**
 * Genera la instrucción de contexto de continuación para el prompt del agente entrante.
 * Garantiza que el nuevo agente no repita lo ya explicado ni pierda el hilo.
 */
export function buildContinuationInstruction(handoff: AgentHandoffSignal): string {
  const { continuationContext, sessionState, studentContext } = handoff;
  const lines: string[] = [];

  lines.push(`Contexto de sesión recibido:`);
  lines.push(`- Materia: ${studentContext.subjectSlug} / Tema: ${studentContext.currentTopic}`);
  lines.push(describeSessionIntent(studentContext.sessionIntent));

  if (continuationContext.alreadyCovered.length > 0) {
    lines.push(`- Ya cubierto en esta sesión: ${continuationContext.alreadyCovered.join(", ")}.`);
    lines.push(`  No repitas ni reintroduzcas estos puntos.`);
  }

  lines.push(`- Última acción del alumno: "${continuationContext.lastStudentAction}"`);
  lines.push(`- Próximo paso sugerido: ${continuationContext.suggestedNextStep}`);

  if (sessionState.emotionalState === "frustrated" || sessionState.emotionalState === "blocked") {
    lines.push(`- ALERTA: el alumno llega frustrado/bloqueado. Empieza con calma antes de entrar al contenido.`);
  }

  lines.push(`NO menciones que eres un agente diferente. Continúa la conversación de forma natural.`);

  return lines.join("\n");
}
