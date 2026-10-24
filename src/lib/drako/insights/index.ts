import type { DrakoEventRecord } from "@/lib/drako/metrics";
import type { UserContext } from "@/lib/drako/memory";

export type Insight = {
  id: string;
  category: string;
  title: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  actions: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export function createInsight(input: {
  id?: string;
  category: string;
  title: string;
  summary: string;
  severity?: Insight["severity"];
  actions?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): Insight {
  return {
    id: input.id ?? crypto.randomUUID(),
    category: input.category,
    title: input.title,
    summary: input.summary,
    severity: input.severity ?? "info",
    actions: [...(input.actions ?? [])],
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function generateInsights(input: {
  context: UserContext;
  events: DrakoEventRecord[];
  now?: string;
}): Insight[] {
  const insights: Insight[] = [];
  const weakSubjects = readStringArray(input.context.traits?.weakSubjects);
  const consistencyScore = readNumber(input.context.traits?.consistencyScore);
  const progressionVelocity = readNumber(input.context.traits?.progressionVelocity);
  const streak = readNumber(input.context.traits?.streak);

  if (weakSubjects[0]) {
    insights.push(
      createInsight({
        category: "learning_gap",
        title: "Materia debil detectada",
        summary: `La materia con mayor necesidad de refuerzo es ${weakSubjects[0]}.`,
        severity: "warning",
        actions: [`Priorizar la siguiente sesion en ${weakSubjects[0]}.`],
        metadata: { subject: weakSubjects[0] },
      }),
    );
  }

  const lowScoreExercises = input.events
    .filter((event) => event.type === "exercise_completed")
    .map((event) => event.payload as { expectedCompetency?: string; score?: number })
    .filter((payload) => typeof payload.expectedCompetency === "string" && typeof payload.score === "number" && payload.score < 70);
  const repeatedCompetency = lowScoreExercises.find(
    (payload, _, current) =>
      current.filter((item) => item.expectedCompetency === payload.expectedCompetency).length >= 2,
  );
  if (repeatedCompetency?.expectedCompetency) {
    insights.push(
      createInsight({
        category: "error_pattern",
        title: "Repeticion de error",
        summary: `Se repite dificultad en ${repeatedCompetency.expectedCompetency}.`,
        severity: "warning",
        actions: ["Cambiar la estrategia explicativa y reforzar una sola competencia."],
        metadata: { competency: repeatedCompetency.expectedCompetency },
      }),
    );
  }

  if ((consistencyScore !== null && consistencyScore < 0.45) || (streak !== null && streak <= 1 && input.events.length >= 3)) {
    insights.push(
      createInsight({
        category: "consistency",
        title: "Falta de consistencia",
        summary: "La regularidad actual necesita bloques mas cortos y frecuentes.",
        severity: "critical",
        actions: ["Reducir carga diaria y reforzar el cierre visible de cada sesion."],
        metadata: { consistencyScore, streak },
      }),
    );
  }

  const scoreSeries = input.events
    .filter((event) => event.type === "exercise_completed")
    .map((event) => event.payload as { score?: number })
    .map((payload) => payload.score)
    .filter((score): score is number => typeof score === "number")
    .slice(0, 3)
    .reverse();
  if ((progressionVelocity !== null && progressionVelocity >= 0.72) || (scoreSeries.length >= 2 && scoreSeries[scoreSeries.length - 1] > scoreSeries[0])) {
    insights.push(
      createInsight({
        category: "improvement",
        title: "Mejora progresiva",
        summary: "El avance reciente permite sostener o elevar ligeramente el reto.",
        severity: "info",
        actions: ["Mantener continuidad y abrir una practica de transferencia controlada."],
        metadata: { progressionVelocity, scoreSeries },
      }),
    );
  }

  return insights.slice(0, 6);
}
