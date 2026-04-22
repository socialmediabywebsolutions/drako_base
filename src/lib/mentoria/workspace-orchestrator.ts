export type WorkspaceOrchestratorStage =
  | "idle"
  | "explaining"
  | "guided_practice"
  | "reinforcement"
  | "light_evaluation"
  | "summary";

export type WorkspaceOrchestratorActionKind = "run_next" | "quick_action" | "send_message";

export type WorkspaceOrchestratorAction = {
  id: string;
  label: string;
  description: string;
  kind: WorkspaceOrchestratorActionKind;
  topic?: string;
  prompt?: string;
  subjectSlug?: string | null;
};

export type WorkspaceOrchestratorPlan = {
  stage: WorkspaceOrchestratorStage;
  stageLabel: string;
  intentLabel: string;
  message: string;
  microObjective: string;
  nextStep: string;
  boardFocus: string;
  coachMessage: string;
  guidedSteps: string[];
  practiceTrigger: {
    kind: "guided_step" | "exercise" | "daily_task" | "subject_session" | "session_resume" | "quick_start";
    label: string;
    detail: string;
    ready: boolean;
  } | null;
  primaryAction: WorkspaceOrchestratorAction;
  secondaryActions: WorkspaceOrchestratorAction[];
  progressLabel?: string;
};

export type WorkspaceOrchestratorNextAction = {
  kind: "guided_step" | "exercise" | "task" | "resume_session" | "subject_session" | "quick_action" | "focus_session";
  title: string;
  detail: string;
  ctaLabel: string;
  sessionState?: "idle" | "answering" | "checking" | "retry" | "completed";
};

export type WorkspaceOrchestratorFeedback = {
  status: "correct" | "almost" | "incorrect";
  level: "short" | "superficial" | "explained" | "incorrect";
  tone: "guided" | "direct" | "paced";
  message: string;
  rationale: string;
};

export type BuildWorkspaceOrchestratorPlanInput = {
  nextAction: WorkspaceOrchestratorNextAction | null;
  primaryActionLabel?: string | null;
  sessionState: "idle" | "answering" | "checking" | "retry" | "completed";
  selectedSubjectName?: string | null;
  activeSubjectSlug?: string | null;
  currentTopic?: string | null;
  currentMessage?: string | null;
  activeGuidedStep?: string | null;
  activeStepIndex?: number;
  totalSteps?: number;
  sessionProgressPercent?: number;
  guidedFeedback?: WorkspaceOrchestratorFeedback | null;
  tutorResult?: {
    topic?: string;
    reinforcementQuestion?: string;
    progressMessage?: string;
    recommendedNextStep?: string;
  } | null;
  entry?: {
    recommendedTopic: string;
    recommendedPrompt: string;
    recommendedSubjectSlug?: string | null;
  } | null;
  activeDailyTask?: {
    subject: string;
    type?: string | null;
  } | null;
  latestExercise?: {
    prompt: string;
    status: "pending" | "submitted" | "corrected";
    score?: number;
  } | null;
  latestSession?: {
    topic: string;
    recommendedNextStep: string;
  } | null;
  motivationMessage?: string | null;
};

const STAGE_COPY: Record<WorkspaceOrchestratorStage, { label: string; intent: string }> = {
  idle: {
    label: "Inicio",
    intent: "Elegir una entrada clara",
  },
  explaining: {
    label: "Explicando",
    intent: "Entender antes de practicar",
  },
  guided_practice: {
    label: "Practica guiada",
    intent: "Resolver un paso concreto",
  },
  reinforcement: {
    label: "Refuerzo",
    intent: "Ajustar sin perder confianza",
  },
  light_evaluation: {
    label: "Evaluacion ligera",
    intent: "Comprobar si ya esta claro",
  },
  summary: {
    label: "Resumen",
    intent: "Cerrar avance y preparar continuidad",
  },
};

function fallbackSubject(input: BuildWorkspaceOrchestratorPlanInput) {
  return input.selectedSubjectName
    ?? input.activeDailyTask?.subject
    ?? input.tutorResult?.topic
    ?? input.currentTopic
    ?? input.activeSubjectSlug
    ?? "la materia activa";
}

function makeSendAction(input: {
  id: string;
  label: string;
  description: string;
  topic: string;
  prompt: string;
  subjectSlug?: string | null;
}): WorkspaceOrchestratorAction {
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    kind: "send_message",
    topic: input.topic,
    prompt: input.prompt,
    subjectSlug: input.subjectSlug,
  };
}

function buildPrimaryAction(input: BuildWorkspaceOrchestratorPlanInput): WorkspaceOrchestratorAction {
  if (input.nextAction?.kind === "guided_step" && input.nextAction.sessionState === "completed") {
    const subject = fallbackSubject(input);
    const topic = input.tutorResult?.topic ?? input.currentTopic ?? subject;
    const prompt = input.tutorResult?.recommendedNextStep
      ?? `Resume lo que acabo de completar en ${subject} y preparame una practica corta para consolidarlo.`;

    return makeSendAction({
      id: "primary_summary_next",
      label: input.tutorResult?.recommendedNextStep ? "Preparar siguiente paso" : "Cerrar y practicar otro ejemplo",
      description: "Convierte el cierre de la sesion en continuidad concreta.",
      topic,
      prompt,
      subjectSlug: input.activeSubjectSlug ?? input.entry?.recommendedSubjectSlug ?? null,
    });
  }

  if (input.nextAction) {
    const label =
      input.nextAction.kind === "exercise"
        ? "Corregir desde el chat"
        : input.primaryActionLabel ?? input.nextAction.ctaLabel;

    return {
      id: `primary_${input.nextAction.kind}`,
      label,
      description: input.nextAction.detail,
      kind: "run_next",
    };
  }

  if (input.entry?.recommendedPrompt) {
    return {
      id: "primary_entry",
      label: input.entry.recommendedTopic,
      description: "Abre la recomendacion principal del tutor.",
      kind: "quick_action",
      topic: input.entry.recommendedTopic,
      prompt: input.entry.recommendedPrompt,
      subjectSlug: input.entry.recommendedSubjectSlug,
    };
  }

  const subject = fallbackSubject(input);
  return makeSendAction({
    id: "primary_explain",
    label: "Te explico esto paso a paso",
    description: "Abre una explicacion corta y accionable.",
    topic: input.currentTopic ?? subject,
    prompt: `Quiero que me expliques ${subject} paso a paso y luego me propongas una practica corta.`,
    subjectSlug: input.activeSubjectSlug,
  });
}

function resolveStage(input: BuildWorkspaceOrchestratorPlanInput): WorkspaceOrchestratorStage {
  if (input.sessionState === "completed" || input.tutorResult?.progressMessage) return "summary";
  if (input.sessionState === "checking" || input.nextAction?.kind === "exercise") return "light_evaluation";
  if (input.sessionState === "retry" || input.guidedFeedback?.status === "almost" || input.guidedFeedback?.status === "incorrect") return "reinforcement";
  if (input.activeGuidedStep || input.sessionState === "answering") return "guided_practice";
  if (input.tutorResult?.recommendedNextStep || input.tutorResult?.reinforcementQuestion) return "explaining";
  return "idle";
}

function resolveMicroObjective(stage: WorkspaceOrchestratorStage, input: BuildWorkspaceOrchestratorPlanInput) {
  const subject = fallbackSubject(input);
  if (stage === "guided_practice" && input.activeGuidedStep) {
    return `Completar el paso ${Math.max(1, (input.activeStepIndex ?? 0) + 1)} sin abrir otro frente.`;
  }
  if (stage === "reinforcement") {
    return input.guidedFeedback?.level === "short"
      ? "Ampliar una idea mas y volver a comprobar."
      : "Rehacer el mismo paso con la idea principal mas clara.";
  }
  if (stage === "light_evaluation") {
    return input.nextAction?.kind === "exercise"
      ? "Entregar el ejercicio de la pizarra y decidir si subir o reforzar."
      : "Comprobar la respuesta y decidir el siguiente movimiento.";
  }
  if (stage === "summary") {
    return "Cerrar el bloque y dejar preparado el siguiente paso.";
  }
  if (stage === "explaining") {
    return `Convertir la explicacion de ${subject} en una practica corta.`;
  }
  return `Empezar por una accion clara en ${subject}.`;
}

function resolveNextStep(stage: WorkspaceOrchestratorStage, input: BuildWorkspaceOrchestratorPlanInput) {
  if (input.activeGuidedStep) return input.activeGuidedStep;
  if (input.nextAction?.title) return input.nextAction.title;
  if (input.tutorResult?.recommendedNextStep) return input.tutorResult.recommendedNextStep;
  if (input.latestSession?.recommendedNextStep) return input.latestSession.recommendedNextStep;
  if (input.entry?.recommendedTopic) return input.entry.recommendedTopic;
  if (stage === "summary") return "Elegir si conviene practicar otro ejemplo o cerrar por hoy.";
  return "Abrir una sesion guiada y resolver el primer paso.";
}

function buildGuidedSteps(input: BuildWorkspaceOrchestratorPlanInput) {
  if (input.activeGuidedStep) {
    return [
      input.activeGuidedStep,
      input.guidedFeedback?.status === "incorrect"
        ? "Rehaz este mismo paso antes de avanzar."
        : "Comprueba y avanza solo si la idea principal esta clara.",
    ];
  }

  if (input.tutorResult?.recommendedNextStep) {
    return [input.tutorResult.recommendedNextStep];
  }

  if (input.tutorResult?.reinforcementQuestion) {
    return [input.tutorResult.reinforcementQuestion];
  }

  if (input.latestSession?.recommendedNextStep) {
    return [input.latestSession.recommendedNextStep];
  }

  if (input.nextAction?.detail) {
    return [input.nextAction.detail];
  }

  return [];
}

function buildPracticeTrigger(input: BuildWorkspaceOrchestratorPlanInput): WorkspaceOrchestratorPlan["practiceTrigger"] {
  if (!input.nextAction) {
    if (!input.entry?.recommendedPrompt) return null;

    return {
      kind: "quick_start",
      label: input.entry.recommendedTopic,
      detail: "El chat puede abrir esta entrada recomendada en la pizarra.",
      ready: true,
    };
  }

  if (input.nextAction.kind === "guided_step") {
    return {
      kind: "guided_step",
      label: input.nextAction.sessionState === "completed" ? "Preparar continuidad" : "Comprobar paso activo",
      detail: input.nextAction.detail,
      ready: input.nextAction.sessionState !== "checking",
    };
  }

  if (input.nextAction.kind === "exercise") {
    return {
      kind: "exercise",
      label: "Corregir ejercicio",
      detail: input.latestExercise?.prompt ?? input.nextAction.detail,
      ready: true,
    };
  }

  if (input.nextAction.kind === "task") {
    return {
      kind: "daily_task",
      label: input.activeDailyTask?.subject ?? input.nextAction.ctaLabel,
      detail: "El chat puede abrir esta tarea en la pizarra y cargar el tutor con el contexto correcto.",
      ready: true,
    };
  }

  if (input.nextAction.kind === "subject_session") {
    return {
      kind: "subject_session",
      label: fallbackSubject(input),
      detail: input.nextAction.detail,
      ready: true,
    };
  }

  if (input.nextAction.kind === "resume_session") {
    return {
      kind: "session_resume",
      label: input.latestSession?.topic ?? input.nextAction.ctaLabel,
      detail: input.nextAction.detail,
      ready: true,
    };
  }

  return {
    kind: "quick_start",
    label: input.nextAction.ctaLabel,
    detail: input.nextAction.detail,
    ready: true,
  };
}

function buildSecondaryActions(input: BuildWorkspaceOrchestratorPlanInput): WorkspaceOrchestratorAction[] {
  const subject = fallbackSubject(input);
  const topic = input.tutorResult?.topic ?? input.currentTopic ?? subject;
  const subjectSlug = input.activeSubjectSlug ?? input.entry?.recommendedSubjectSlug ?? null;
  const actions: WorkspaceOrchestratorAction[] = [];

  if (input.activeGuidedStep) {
    actions.push(makeSendAction({
      id: "hint",
      label: "Dame una pista corta",
      description: "Recibe una ayuda pequena sin resolverlo entero.",
      topic,
      prompt: `Dame una pista corta para este paso: ${input.activeGuidedStep}`,
      subjectSlug,
    }));
    actions.push(makeSendAction({
      id: "explain_step",
      label: "Explicalo paso a paso",
      description: "Vuelve al razonamiento sin cambiar de tarea.",
      topic,
      prompt: `Explicame paso a paso como resolver: ${input.activeGuidedStep}`,
      subjectSlug,
    }));
    return actions;
  }

  if (input.tutorResult?.recommendedNextStep) {
    actions.push(makeSendAction({
      id: "practice_next",
      label: "Practicar otro ejemplo",
      description: "Convierte el siguiente paso en practica guiada.",
      topic,
      prompt: input.tutorResult.recommendedNextStep,
      subjectSlug,
    }));
  }

  actions.push(makeSendAction({
    id: "explain",
    label: "Te explico esto paso a paso",
    description: "Pide una explicacion breve con practica.",
    topic,
    prompt: `Explicame ${subject} paso a paso y despues dame un ejercicio corto.`,
    subjectSlug,
  }));

  if (input.entry?.recommendedPrompt && actions.length < 2) {
    actions.push({
      id: "recommended_entry",
      label: input.entry.recommendedTopic,
      description: "Usa la entrada recomendada para empezar.",
      kind: "quick_action",
      topic: input.entry.recommendedTopic,
      prompt: input.entry.recommendedPrompt,
      subjectSlug: input.entry.recommendedSubjectSlug,
    });
  }

  return actions.slice(0, 2);
}

export function buildWorkspaceOrchestratorPlan(input: BuildWorkspaceOrchestratorPlanInput): WorkspaceOrchestratorPlan {
  const stage = resolveStage(input);
  const copy = STAGE_COPY[stage];
  const subject = fallbackSubject(input);
  const nextStep = resolveNextStep(stage, input);
  const microObjective = resolveMicroObjective(stage, input);
  const progressLabel = input.totalSteps && input.totalSteps > 0
    ? `Paso ${Math.min((input.activeStepIndex ?? 0) + 1, input.totalSteps)} de ${input.totalSteps} - ${input.sessionProgressPercent ?? 0}%`
    : undefined;

  const boardFocus = input.nextAction?.kind === "exercise"
    ? "La pizarra contiene el ejercicio. Escribe alli y el chat puede lanzar la correccion."
    : input.activeGuidedStep
      ? "La pizarra contiene el paso activo. El chat decide si avanzas, refuerzas o cierras."
      : input.nextAction?.kind === "resume_session"
        ? "La pizarra recupera el punto exacto de la ultima sesion."
        : `La pizarra abre el trabajo principal de ${subject}.`;

  const message = stage === "summary"
    ? "Bien. No alargamos por alargar: cerramos avance y dejamos continuidad."
    : stage === "reinforcement"
      ? "No cambiamos de tema. Ajustamos este paso y seguimos."
      : stage === "light_evaluation"
        ? "Toca comprobar con calma y decidir el nivel siguiente."
        : stage === "guided_practice"
          ? "Vamos a resolver esto juntos, un paso cada vez."
          : stage === "explaining"
            ? "Primero claridad, despues practica."
            : input.motivationMessage ?? "Empezamos con una accion pequena y clara.";

  return {
    stage,
    stageLabel: copy.label,
    intentLabel: copy.intent,
    message,
    microObjective,
    nextStep,
    boardFocus,
    coachMessage: message,
    guidedSteps: buildGuidedSteps(input),
    practiceTrigger: buildPracticeTrigger(input),
    primaryAction: buildPrimaryAction(input),
    secondaryActions: buildSecondaryActions(input),
    progressLabel,
  };
}
