import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { InterventionType, MentoriaIntervention, MentoriaInterventionSeverity } from "@/lib/mentoria/types";

export type InterventionDecision = {
  type: InterventionType;
  severity: MentoriaInterventionSeverity;
  summary: string;
  recommendations: string[];
  channels: string[];
  metadata: Record<string, string | number | boolean | string[]>;
};

export type InterventionResponse = {
  toneMode: "stabilize" | "guide" | "challenge";
  plannerMode: "support" | "balance" | "accelerate";
  tutorMode: "gentle" | "guided" | "stretch";
  recommendationBundle: string[];
  directives: string[];
  parentVisibleAlerts: InterventionDecision[];
};

function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function createDecision(input: InterventionDecision): InterventionDecision {
  return {
    ...input,
    recommendations: dedupe(input.recommendations).slice(0, 4),
    channels: dedupe(input.channels).slice(0, 4),
  };
}

export function detectInterventions(profile: StudentEvolutionProfile): InterventionDecision[] {
  const decisions: InterventionDecision[] = [];

  if (profile.frustrationLevel > 0.75) {
    decisions.push(
      createDecision({
        type: "high_frustration",
        severity: profile.frustrationLevel > 0.88 ? "critical" : "high",
        summary: "El alumno muestra un nivel de frustracion sostenido que requiere bajar carga y reforzar seguridad.",
        recommendations: [
          "Reducir la dificultad inmediata y dividir cada tarea en micro-pasos.",
          "Introducir comprobaciones de comprension despues de cada explicacion.",
          "Priorizar ejemplos cercanos antes de pedir transferencia.",
        ],
        channels: ["parent_panel", "planner", "agent_runtime"],
        metadata: {
          frustrationLevel: profile.frustrationLevel,
          weaknesses: profile.weaknesses.slice(0, 3),
        },
      }),
    );
  }

  if (profile.consistencyScore < 0.3) {
    decisions.push(
      createDecision({
        type: "low_consistency",
        severity: profile.consistencyScore < 0.18 ? "high" : "medium",
        summary: "La constancia del alumno es baja y conviene cerrar sesiones mas breves, claras y frecuentes.",
        recommendations: [
          "Reducir la duracion de bloques y aumentar cierres concretos.",
          "Añadir metas visibles por sesion y una accion final sencilla.",
          "Revisar si las sesiones estan siendo demasiado largas para el momento actual.",
        ],
        channels: ["parent_panel", "planner", "async_notification"],
        metadata: {
          consistencyScore: profile.consistencyScore,
          averageResponseTime: profile.averageResponseTime,
        },
      }),
    );
  }

  if (profile.progressionVelocity >= 0.78 && profile.consistencyScore >= 0.55) {
    decisions.push(
      createDecision({
        type: "rapid_progress",
        severity: profile.progressionVelocity >= 0.9 ? "high" : "medium",
        summary: "El alumno progresa rapido y puede asumir mas autonomia, reto y transferencia.",
        recommendations: [
          "Subir un nivel la exigencia en ejercicios y justificacion.",
          "Introducir tareas de transferencia y comparacion de estrategias.",
          "Mantener seguimiento para evitar salto de dificultad excesivo.",
        ],
        channels: ["planner", "agent_runtime"],
        metadata: {
          progressionVelocity: profile.progressionVelocity,
          strengths: profile.strengths.slice(0, 3),
        },
      }),
    );
  }

  if (profile.progressionVelocity <= 0.34 && profile.lastSessions >= 5 && profile.weaknesses.length >= 2) {
    decisions.push(
      createDecision({
        type: "stagnation",
        severity: profile.progressionVelocity <= 0.22 ? "high" : "medium",
        summary: "Hay señales de estancamiento: varias sesiones recientes no estan moviendo el progreso esperado.",
        recommendations: [
          "Cambiar estrategia de explicacion y variar el tipo de practica.",
          "Trabajar una sola debilidad nuclear antes de ampliar el temario.",
          "Comprobar si el alumno entiende el concepto base o solo sigue pasos.",
        ],
        channels: ["parent_panel", "planner", "agent_runtime"],
        metadata: {
          progressionVelocity: profile.progressionVelocity,
          lastSessions: profile.lastSessions,
          weaknesses: profile.weaknesses.slice(0, 4),
        },
      }),
    );
  }

  if (
    (profile.frustrationLevel > 0.75 && profile.consistencyScore < 0.3) ||
    (profile.progressionVelocity <= 0.25 && profile.lastSessions >= 8 && profile.weaknesses.length >= 3)
  ) {
    decisions.push(
      createDecision({
        type: "risk_student",
        severity: "critical",
        summary: "El alumno entra en zona de riesgo academico-adaptativo y necesita intervencion prioritaria.",
        recommendations: [
          "Bajar exigencia temporalmente y reconstruir seguridad sobre una unica prioridad.",
          "Reforzar coordinacion familiar durante los proximos dias.",
          "Monitorizar cada nueva sesion para confirmar recuperacion de ritmo.",
        ],
        channels: ["parent_panel", "async_notification", "planner", "agent_runtime"],
        metadata: {
          frustrationLevel: profile.frustrationLevel,
          consistencyScore: profile.consistencyScore,
          progressionVelocity: profile.progressionVelocity,
          weaknesses: profile.weaknesses.slice(0, 5),
        },
      }),
    );
  }

  return decisions;
}

export function buildInterventionResponse(interventions: InterventionDecision[]): InterventionResponse {
  const hasCritical = interventions.some((item) => item.severity === "critical");
  const hasHighFrustration = interventions.some((item) => item.type === "high_frustration");
  const hasLowConsistency = interventions.some((item) => item.type === "low_consistency");
  const hasRapidProgress = interventions.some((item) => item.type === "rapid_progress");
  const hasStagnation = interventions.some((item) => item.type === "stagnation");

  const toneMode =
    hasCritical || hasHighFrustration ? "stabilize" : hasRapidProgress && !hasStagnation ? "challenge" : "guide";
  const plannerMode =
    hasCritical || hasLowConsistency || hasStagnation ? "support" : hasRapidProgress ? "accelerate" : "balance";
  const tutorMode =
    hasCritical || hasHighFrustration ? "gentle" : hasRapidProgress && !hasLowConsistency ? "stretch" : "guided";

  const recommendationBundle = dedupe(interventions.flatMap((item) => item.recommendations)).slice(0, 6);
  const directives = dedupe([
    toneMode === "stabilize" ? "Reduce la carga cognitiva, valida esfuerzo y refuerza seguridad." : null,
    plannerMode === "support" ? "Acorta bloques, concentra prioridades y aumenta puntos de control." : null,
    tutorMode === "stretch" ? "Sube autonomia, transferencia y justificacion del razonamiento." : null,
    hasStagnation ? "Cambia estrategia didactica y evita repetir el mismo formato de practica." : null,
    hasLowConsistency ? "Trabaja metas de sesion breves con cierres visibles y recuperables." : null,
    hasRapidProgress ? "Aprovecha traccion para introducir retos de nivel superior sin perder precision." : null,
  ]);

  return {
    toneMode,
    plannerMode,
    tutorMode,
    recommendationBundle,
    directives,
    parentVisibleAlerts: interventions.filter((item) => item.channels.includes("parent_panel")),
  };
}

export function materializeInterventions(
  tenantId: string,
  studentId: string,
  interventions: InterventionDecision[],
  existing: MentoriaIntervention[],
): MentoriaIntervention[] {
  const now = new Date().toISOString();
  const byType = new Map(existing.map((item) => [item.type, item]));

  const active = interventions.map((decision) => {
    const current = byType.get(decision.type);
    return {
      id: current?.id ?? crypto.randomUUID(),
      tenantId,
      studentProfileId: studentId,
      type: decision.type,
      severity: decision.severity,
      status: "active" as const,
      summary: decision.summary,
      recommendations: decision.recommendations,
      channels: decision.channels,
      metadata: decision.metadata,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      resolvedAt: undefined,
    };
  });

  const resolved = existing
    .filter((item) => item.status === "active" && !interventions.some((decision) => decision.type === item.type))
    .map((item) => ({
      ...item,
      status: "resolved" as const,
      updatedAt: now,
      resolvedAt: now,
    }));

  return [...active, ...resolved];
}
