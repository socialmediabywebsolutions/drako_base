import type { OrchestratorActorType, OrchestratorContext, StateActions, StateDecision } from "@/lib/mentoria/state/state-types";

const STUDENT_GOALS: Record<StateDecision["state"], string> = {
  focused: "mantener el ritmo sin interrumpir innecesariamente",
  progressing: "reforzar el avance y proponer el siguiente paso claro",
  demotivated: "reducir fricción y recuperar impulso con una meta pequeña",
  overloaded: "bajar presión, ordenar prioridades y contener saturación",
  inconsistent: "recuperar continuidad mínima sin pedir perfección",
  disconnected: "facilitar una reentrada breve, cálida y sin culpa",
  at_risk: "intervenir con claridad, foco y reducción de carga inmediata",
  recovering: "proteger la recuperación y evitar una recaída por exceso de exigencia",
};

const GUARDIAN_GOALS: Record<StateDecision["state"], string> = {
  focused: "confirmar que no hace falta intervenir",
  progressing: "explicar el progreso sin convertirlo en alerta",
  demotivated: "dar una recomendación simple de apoyo emocional y académico",
  overloaded: "pedir ayuda para reducir carga y elegir una sola prioridad",
  inconsistent: "orientar al tutor hacia rutina y continuidad",
  disconnected: "recomendar una intervención breve de reactivación",
  at_risk: "activar intervención humana clara y prioritaria",
  recovering: "pedir apoyo suave para sostener la recuperación",
};

export function buildOrchestratorContext(input: {
  decision: StateDecision;
  actions: StateActions;
  actorType: OrchestratorActorType;
}): OrchestratorContext {
  const { decision, actions, actorType } = input;

  return {
    actorType,
    tone: actions.chatTone,
    intensity: actions.chatIntensity,
    messageGoal: actorType === "student" ? STUDENT_GOALS[decision.state] : GUARDIAN_GOALS[decision.state],
    restrictions: actorType === "student"
      ? [
          "No generar ansiedad ni dramatizar el estado.",
          "Priorizar una sola acción clara.",
          "No usar lenguaje técnico ni diagnóstico.",
        ]
      : [
          "Explicar el estado en lenguaje claro y no técnico.",
          "No compartir telemetría cruda ni interpretación íntima del alumno.",
          "Dar una sugerencia accionable, no una lista de métricas.",
        ],
    promptContext: {
      state: decision.state,
      severity: decision.severity,
      priority: decision.priority,
      confidence: decision.confidence,
      reasons: decision.reasons,
      primaryStudentAction: actions.primaryStudentAction,
      guardianSummary: actions.guardianSummary,
    },
  };
}
