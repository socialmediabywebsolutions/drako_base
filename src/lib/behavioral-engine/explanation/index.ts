import type { BehavioralContext, NextBestAction } from "@/lib/behavioral-engine/contracts";

export type BehavioralExplanation = {
  whyToday: string;
  expectedOutcome: string;
};

function formatBehavioralTaskType(type?: string | null) {
  if (type === "practice") return "practica guiada";
  if (type === "review") return "repaso guiado";
  if (type === "challenge") return "reto corto";
  return type ?? "tarea";
}

export type BehavioralExplanationFrame = {
  title: string;
  description: string;
  primaryLabel: string;
  modeBadge: string;
  whyToday: string;
  expectedOutcome: string;
};

export function buildBehavioralExplanation(action: NextBestAction, context: BehavioralContext): BehavioralExplanation {
  const since = context.signals.hoursSinceActivity;
  const when = since === null ? "sin una referencia temporal clara" : `despues de ${Math.round(since)} horas`;

  return {
    whyToday: `${action.title}. Esta decision nace ${when} y usa el estado actual del usuario para reducir friccion.`,
    expectedOutcome: action.description,
  };
}

export function buildBehavioralExplanationFrame(action: NextBestAction, context: BehavioralContext): BehavioralExplanationFrame {
  if (action.strategy === "resume_session") {
    return {
      title: "Tu ultima sesion ya dejo el siguiente paso listo.",
      description: "Retomar ahora evita volver a pensar desde cero y te mete directamente en contexto.",
      primaryLabel: "Retomar ultimo paso",
      modeBadge: "Modo de hoy: continuidad",
      whyToday: "Tu ultima sesion ya dejo una accion concreta y retomar ahora evita volver a pensar desde cero.",
      expectedOutcome: "Si haces clic, el tutor abre justo el siguiente paso que dejaste preparado en tu ultima sesion.",
    };
  }

  if (action.strategy === "gentle_restart") {
    const hours = context.signals.hoursSinceActivity;
    const fragileProfile = context.signals.motivationProfile === "fragile";
    return {
      title: "Hoy te conviene volver con una victoria rapida para recuperar ritmo.",
      description: action.task
        ? `Arranque recomendado: ${action.task.subject} - ${formatBehavioralTaskType(action.task.type)}`
        : "La mejor entrada hoy es una accion corta y guiada para recuperar traccion.",
      primaryLabel: "Volver con algo facil",
      modeBadge: "Modo de hoy: vuelta suave",
      whyToday: fragileProfile
        ? "Hoy priorizamos un arranque suave porque tu ritmo reciente necesita recuperar confianza antes de exigir mas."
        : `Hoy priorizamos un arranque suave porque llevas ${Math.max(1, Math.round(hours ?? 0))} horas sin entrar y conviene recuperar traccion rapido.`,
      expectedOutcome: "Si haces clic, entraras en una accion facil y guiada para volver a coger ritmo sin friccion.",
    };
  }

  if (action.strategy === "momentum_push") {
    return {
      title: "Vienes con buena inercia. Hoy toca subir un paso sin perder claridad.",
      description: action.task
        ? `Arranque recomendado: ${action.task.subject} - ${formatBehavioralTaskType(action.task.type)}`
        : "La entrada mas util hoy es una accion mas ambiciosa que aprovecha tu buen ritmo.",
      primaryLabel: "Subir un paso hoy",
      modeBadge: "Modo de hoy: subir un paso",
      whyToday: `Hoy te proponemos un paso un poco mas ambicioso porque llevas ${context.signals.streak} dias de ritmo y tu inercia esta a favor.`,
      expectedOutcome: "Si haces clic, empezaras por una accion mas potente, pensada para aprovechar tu buen momento de hoy.",
    };
  }

  if (action.strategy === "plan_task") {
    const subject = action.task?.subject ?? "tu siguiente tarea";
    const type = formatBehavioralTaskType(action.task?.type ?? "task");
    const dailyCompletionPercent = Number.isFinite(context.signals.dailyCompletionRate)
      ? Math.round(context.signals.dailyCompletionRate * 100)
      : 0;
    return {
      title: "La continuidad natural hoy viene del plan del dia.",
      description: `Arranque recomendado: ${subject} - ${type}`,
      primaryLabel: "Volver al plan de hoy",
      modeBadge: "Modo de hoy: plan del dia",
      whyToday: `Hoy lo mas sensato es seguir el plan: ya llevas ${dailyCompletionPercent}% del dia encaminado y esta es la siguiente pieza natural.`,
      expectedOutcome: "Si haces clic, entraras directamente en la siguiente tarea util del plan de hoy.",
    };
  }

  return {
    title: "Tu siguiente paso ya esta preparado para volver sin friccion.",
    description: action.description,
    primaryLabel: "Empezar ahora",
    modeBadge: "Modo de hoy: entrada guiada",
    whyToday: "Hoy te dejamos un punto de entrada simple para que no tengas que decidir por donde empezar.",
    expectedOutcome: "Si haces clic, el sistema te dejara la entrada preparada con el mejor prompt disponible ahora mismo.",
  };
}
