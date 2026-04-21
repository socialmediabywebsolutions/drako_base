import type { GuardianViewModel, StateActions, StateDecision } from "@/lib/mentoria/state/state-types";

const STATE_LABELS: Record<StateDecision["state"], string> = {
  focused: "En foco",
  progressing: "Progresando",
  demotivated: "Desmotivado",
  overloaded: "Saturado",
  inconsistent: "Inconsistente",
  disconnected: "Desconectado",
  at_risk: "En riesgo",
  recovering: "Recuperando ritmo",
};

export function buildGuardianViewModel(input: {
  decision: StateDecision;
  actions: StateActions;
}): GuardianViewModel {
  const { decision, actions } = input;
  const requiresIntervention = actions.guardianAlert === "recommended" || actions.guardianAlert === "critical";

  return {
    state: decision.state,
    priority: decision.priority,
    summary: STATE_LABELS[decision.state],
    message: actions.guardianSummary ?? "No hay recomendaciones nuevas para el tutor.",
    requiresIntervention,
    alertLevel: actions.guardianAlert,
  };
}
