import type { BehavioralContext, BehavioralTaskCandidate, NextBestAction } from "@/lib/behavioral-engine/contracts";

function sortTasksForGentleRestart(tasks: BehavioralTaskCandidate[]): BehavioralTaskCandidate[] {
  const typeWeight: Record<BehavioralTaskCandidate["type"], number> = {
    review: 0,
    practice: 1,
    challenge: 2,
    other: 3,
  };

  return [...tasks].sort((left, right) => {
    if (typeWeight[left.type] !== typeWeight[right.type]) {
      return typeWeight[left.type] - typeWeight[right.type];
    }
    return (left.difficulty ?? 0) - (right.difficulty ?? 0);
  });
}

function sortTasksForMomentum(tasks: BehavioralTaskCandidate[]): BehavioralTaskCandidate[] {
  const typeWeight: Record<BehavioralTaskCandidate["type"], number> = {
    challenge: 0,
    practice: 1,
    review: 2,
    other: 3,
  };

  return [...tasks].sort((left, right) => {
    if (typeWeight[left.type] !== typeWeight[right.type]) {
      return typeWeight[left.type] - typeWeight[right.type];
    }
    return (right.difficulty ?? 0) - (left.difficulty ?? 0);
  });
}

function buildAction(input: {
  strategy: NextBestAction["strategy"];
  title: string;
  description: string;
  rationale: string[];
  confidence: number;
  task?: BehavioralTaskCandidate | null;
  prompt?: string | null;
}): NextBestAction {
  return {
    strategy: input.strategy,
    title: input.title,
    description: input.description,
    rationale: input.rationale,
    confidence: input.confidence,
    task: input.task ?? null,
    prompt: input.prompt ?? null,
  };
}

export function decideNextBestAction(context: BehavioralContext): NextBestAction {
  const { signals } = context;
  const nextDailyTask = signals.pendingTasks[0] ?? null;
  const gentleRestartTask = sortTasksForGentleRestart(signals.pendingTasks)[0] ?? null;
  const momentumTask = sortTasksForMomentum(signals.pendingTasks)[0] ?? null;
  const needsGentleRestart =
    signals.motivationProfile === "fragile"
    || ((signals.hoursSinceActivity ?? 0) >= 48);
  const hasMomentumMode =
    (signals.motivationProfile === "high_performer" || signals.streak >= 4)
    && (signals.hoursSinceActivity === null || signals.hoursSinceActivity <= 30);
  const chosenTask =
    needsGentleRestart
      ? (gentleRestartTask ?? nextDailyTask)
      : hasMomentumMode
        ? (momentumTask ?? nextDailyTask)
        : nextDailyTask;

  if (signals.recentSessionRecommendedNextStep && !needsGentleRestart && context.availableActions.canResumeSession) {
    return buildAction({
      strategy: "resume_session",
      title: "Retomar el siguiente paso ya preparado",
      description: "La sesion anterior ya dejo una accion concreta y no hace falta recomenzar desde cero.",
      rationale: [
        "Existe un siguiente paso recomendado en la sesion mas reciente.",
        "No hay senal de reenganche suave que justifique bajar la exigencia.",
      ],
      confidence: 0.94,
      prompt: signals.recentSessionRecommendedNextStep,
    });
  }

  if (chosenTask && needsGentleRestart) {
    return buildAction({
      strategy: "gentle_restart",
      title: "Volver con una victoria rapida",
      description: "El mejor arranque para hoy es una accion corta y guiada que recupere traccion.",
      rationale: [
        "El usuario necesita un reenganche suave por friccion reciente o tiempo fuera.",
        `La mejor tarea de bajo esfuerzo disponible es ${chosenTask.subject} - ${chosenTask.type}.`,
      ],
      confidence: 0.9,
      task: chosenTask,
    });
  }

  if (chosenTask && hasMomentumMode) {
    return buildAction({
      strategy: "momentum_push",
      title: "Aprovechar el buen momento",
      description: "La mejor accion para hoy puede exigir un poco mas sin romper claridad.",
      rationale: [
        "La racha y el perfil de motivacion permiten subir un paso.",
        `La mejor tarea para aprovechar ese momento es ${chosenTask.subject} - ${chosenTask.type}.`,
      ],
      confidence: 0.9,
      task: chosenTask,
    });
  }

  if (chosenTask && context.availableActions.canStartPendingTask) {
    return buildAction({
      strategy: "plan_task",
      title: "Seguir la siguiente tarea natural del plan",
      description: "La accion con menos friccion util es continuar el plan actual.",
      rationale: [
        "Hay una tarea pendiente clara dentro del plan del dia.",
        "No hay una senal mas fuerte que justifique retomar sesion o cambiar de modo.",
      ],
      confidence: 0.86,
      task: chosenTask,
    });
  }

  return buildAction({
    strategy: "entry",
    title: "Entrar por el mejor prompt disponible",
    description: "No hay una tarea o sesion dominante; conviene abrir el contexto inicial preparado.",
    rationale: [
      "No hay una continuidad dominante entre sesion y plan.",
      "La mejor opcion restante es usar el punto de entrada ya preparado.",
    ],
    confidence: 0.76,
  });
}
