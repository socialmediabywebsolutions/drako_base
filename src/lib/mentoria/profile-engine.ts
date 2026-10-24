import type { EmotionalAdaptation } from "@/lib/agents/mentoria/emotional-orchestrator";
import type { MentoriaEmotionalState, MentoriaSessionMode } from "@/lib/mentoria/types";
import type { DynamicProfileLevel, DynamicResponseSpeed, DynamicStudentProfile } from "@/lib/mentoria/student-profile";

export type DynamicSessionStage = "guided_practice" | "reinforcement" | "light_evaluation";
export type TutorTonePolicy = "empathetic" | "clear" | "direct";
export type TutorPacePolicy = "slow" | "steady" | "fast";
export type TutorDetailPolicy = "minimal" | "guided" | "analytical";
export type TutorReinforcementPolicy = "high" | "medium" | "low";
export type TutorExamplePolicy = "concrete_first" | "guided_example" | "challenge_example" | "visual_step";

export type TutorBehaviorPolicy = {
  tone: TutorTonePolicy;
  difficulty: "down" | "steady" | "up";
  pace: TutorPacePolicy;
  sessionStage: DynamicSessionStage;
  sessionMode: MentoriaSessionMode;
  explanationLength: "short" | "balanced" | "deep";
  detailLevel: TutorDetailPolicy;
  exampleUse: TutorExamplePolicy;
  positiveReinforcement: TutorReinforcementPolicy;
  preferredExplanationStyle?: NonNullable<DynamicStudentProfile["memory"]>["preferredExplanationStyle"];
  bestSessionLength?: number;
  memorySummary?: string;
  directives: string[];
};

export type DynamicProfileSessionEvent = {
  kind: "session" | "exercise";
  emotionalState?: MentoriaEmotionalState;
  correctAnswers?: number;
  totalAnswers?: number;
  consecutiveErrors?: number;
  abandoned?: boolean;
  responseSpeed?: DynamicResponseSpeed;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function levelToNumber(level: DynamicProfileLevel): number {
  if (level === "low") return 0.25;
  if (level === "high") return 0.82;
  return 0.55;
}

function numberToLevel(value: number): DynamicProfileLevel {
  if (value < 0.4) return "low";
  if (value >= 0.7) return "high";
  return "medium";
}

function blendLevel(current: DynamicProfileLevel, next: DynamicProfileLevel, weight = 0.35): DynamicProfileLevel {
  return numberToLevel(clamp01(levelToNumber(current) * (1 - weight) + levelToNumber(next) * weight));
}

function isBlocked(profile: DynamicStudentProfile): boolean {
  return (
    profile.emotional.frustrationLevel === "high"
    || profile.cognitive.comprehensionLevel === "low"
    || profile.cognitive.errorRate >= 0.62
  );
}

function isInconsistent(profile: DynamicStudentProfile): boolean {
  return profile.emotional.consistency === "low" || profile.contextual.supportSignals.includes("low_consistency");
}

function isFastAndConfident(profile: DynamicStudentProfile): boolean {
  return (
    profile.emotional.confidenceLevel === "high"
    && profile.cognitive.comprehensionLevel === "high"
    && profile.cognitive.responseSpeed === "fast"
    && profile.cognitive.errorRate <= 0.28
  );
}

function applyMemoryToPolicy(policy: TutorBehaviorPolicy, profile: DynamicStudentProfile): TutorBehaviorPolicy {
  const memory = profile.memory;
  if (!memory) return policy;

  const directives = [...policy.directives];
  let next: TutorBehaviorPolicy = {
    ...policy,
    preferredExplanationStyle: memory.preferredExplanationStyle,
    bestSessionLength: memory.bestSessionLength,
    memorySummary: memory.lastAdaptationSummary.nextStart,
  };

  if (memory.activeConceptKey) {
    directives.push(`Concepto activo a vigilar: ${memory.activeConceptKey.replaceAll("_", " ")}.`);
  }
  if (memory.activeConceptSummary) {
    directives.push(`Memoria didactica activa: ${memory.activeConceptSummary}`);
  }
  if (memory.activeConceptNeedsReinforcement) {
    next = {
      ...next,
      sessionStage: "reinforcement",
      difficulty: "down",
      pace: "slow",
      positiveReinforcement: "high",
    };
    directives.push("Antes de seguir, recupera el concepto fragil y comprueba si la base ya esta clara.");
  }
  if (memory.activeConceptSupportStyle === "visual_steps") {
    next = { ...next, exampleUse: "visual_step", detailLevel: next.detailLevel === "analytical" ? "guided" : next.detailLevel };
    directives.push("Representa el concepto con pasos visuales verbales antes de pedir autonomia.");
  }
  if (memory.activeConceptSupportStyle === "concrete_example") {
    next = { ...next, exampleUse: "concrete_first", detailLevel: "guided" };
    directives.push("Arranca con un ejemplo simple del concepto antes de abstraer la regla.");
  }
  if (memory.activeConceptSupportStyle === "guided_practice") {
    next = { ...next, sessionStage: "guided_practice", detailLevel: "guided", pace: "slow" };
    directives.push("Convierte el siguiente movimiento en practica guiada del mismo concepto.");
  }
  if (memory.activeConceptSupportStyle === "retrieval_check" && !memory.activeConceptNeedsReinforcement && next.difficulty !== "down") {
    next = { ...next, sessionStage: "light_evaluation", exampleUse: "challenge_example" };
    directives.push("Haz una comprobacion corta de autonomia antes de volver a explicar.");
  }
  if (memory.activeConceptMastery === "fragile") {
    next = {
      ...next,
      tone: "empathetic",
      difficulty: "down",
      sessionStage: "guided_practice",
      explanationLength: "short",
      positiveReinforcement: "high",
    };
    directives.push("Explica desde cero el concepto si hace falta y no asumas base previa consolidada.");
  }
  if (memory.activeConceptMastery === "secure" || memory.activeConceptMastery === "mastered") {
    directives.push("No repitas toda la teoria: comprueba primero si el concepto sigue estable.");
  }

  if (memory.preferredExplanationStyle === "visual_step_by_step") {
    next = { ...next, exampleUse: "visual_step", detailLevel: next.detailLevel === "analytical" ? "guided" : next.detailLevel };
    directives.push("Usa un esquema visual verbal: partes, flechas, orden y comprobacion.");
  }
  if (memory.preferredExplanationStyle === "concrete_examples") {
    next = { ...next, exampleUse: "concrete_first" };
    directives.push("Empieza con un ejemplo concreto antes de explicar la regla.");
  }
  if (memory.preferredExplanationStyle === "short_guided") {
    next = { ...next, explanationLength: "short", detailLevel: "minimal", positiveReinforcement: "high" };
    directives.push("Mantiene la sesion corta y guiada; evita abrir dos conceptos a la vez.");
  }
  if (memory.preferredExplanationStyle === "challenge_first" && next.difficulty !== "down" && memory.frustrationTrend !== "rising") {
    next = { ...next, difficulty: "up", exampleUse: "challenge_example", detailLevel: "analytical" };
    directives.push("Arranca con una comprobacion breve de autonomia antes de dar pistas.");
  }
  if (memory.bestSessionLength <= 14) {
    next = { ...next, explanationLength: "short", pace: next.pace === "fast" ? "steady" : next.pace };
    directives.push(`Apunta a un bloque breve de unos ${memory.bestSessionLength} minutos.`);
  }
  if (memory.frustrationTrend === "rising") {
    next = {
      ...next,
      tone: "empathetic",
      difficulty: "down",
      pace: "slow",
      sessionStage: "guided_practice",
      sessionMode: "soft_reentry",
      positiveReinforcement: "high",
      explanationLength: "short",
    };
    directives.push("La memoria marca frustracion al alza: anticipa el bloqueo antes de subir carga.");
  }
  if (
    memory.frustrationTrend !== "rising"
    && (memory.consistencyTrend === "falling" || memory.motivationPattern === "avoidant" || memory.motivationPattern === "bursty")
  ) {
    next = {
      ...next,
      pace: "slow",
      sessionStage: "reinforcement",
      sessionMode: "study_routine",
      positiveReinforcement: "high",
    };
    directives.push("La memoria marca baja continuidad: cierra con una tarea pequena y muy concreta.");
  }
  if (memory.confidenceTrend === "rising" && memory.consistencyTrend === "rising" && memory.frustrationTrend !== "rising" && next.difficulty !== "down") {
    next = {
      ...next,
      difficulty: "up",
      sessionStage: "light_evaluation",
      exampleUse: next.exampleUse === "visual_step" ? "visual_step" : "challenge_example",
    };
    directives.push("La memoria marca confianza sostenida: deja menos pista y pide justificar.");
  }
  if (memory.repetitionRiskSignals.length > 0) {
    directives.push(`Senales persistentes a vigilar: ${memory.repetitionRiskSignals.join(", ")}.`);
  }
  directives.push(`Ultimo aprendizaje interno: ${memory.lastAdaptationSummary.nextStart}`);

  return {
    ...next,
    directives,
  };
}

export function buildTutorBehaviorPolicy(profile: DynamicStudentProfile): TutorBehaviorPolicy {
  if (isBlocked(profile)) {
    return applyMemoryToPolicy({
      tone: "empathetic",
      difficulty: "down",
      pace: "slow",
      sessionStage: "guided_practice",
      sessionMode: "soft_reentry",
      explanationLength: "short",
      detailLevel: "minimal",
      exampleUse: "concrete_first",
      positiveReinforcement: "high",
      directives: [
        "Usa explicaciones cortas y una sola idea por turno.",
        "Valida la dificultad sin dramatizar y convierte el error en pista.",
        "Pregunta antes de subir dificultad.",
      ],
    }, profile);
  }

  if (isInconsistent(profile)) {
    return applyMemoryToPolicy({
      tone: "clear",
      difficulty: "steady",
      pace: "slow",
      sessionStage: "reinforcement",
      sessionMode: "study_routine",
      explanationLength: "balanced",
      detailLevel: "guided",
      exampleUse: "guided_example",
      positiveReinforcement: "high",
      directives: [
        "Mantiene objetivos pequenos y cierres claros.",
        "Repite el patron clave antes de pasar a otro tema.",
        "Refuerza continuidad mas que intensidad.",
      ],
    }, profile);
  }

  if (isFastAndConfident(profile)) {
    return applyMemoryToPolicy({
      tone: "direct",
      difficulty: "up",
      pace: "fast",
      sessionStage: "light_evaluation",
      sessionMode: "subject_reinforcement",
      explanationLength: "short",
      detailLevel: "analytical",
      exampleUse: "challenge_example",
      positiveReinforcement: "low",
      directives: [
        "Ve mas directo y evita sobreexplicar.",
        "Pide justificar el razonamiento.",
        "Propone un reto corto si la comprobacion sale bien.",
      ],
    }, profile);
  }

  return applyMemoryToPolicy({
    tone: profile.contextual.supportLevel === "high" ? "empathetic" : "clear",
    difficulty: profile.cognitive.comprehensionLevel === "high" ? "up" : "steady",
    pace: profile.cognitive.responseSpeed === "slow" ? "slow" : "steady",
    sessionStage: "guided_practice",
    sessionMode: "subject_reinforcement",
    explanationLength: "balanced",
    detailLevel: "guided",
    exampleUse: "guided_example",
    positiveReinforcement: "medium",
    directives: [
      "Ajusta la explicacion al curso real y comprueba comprension.",
      profile.academic.hasRepeatedCourse ? "No des por supuesta la base del curso anterior." : "Mantiene el nivel propio del curso actual.",
      profile.contextual.familyStructure === "separated_parents" ? "Evita presuponer una rutina familiar unica." : "Conecta el siguiente paso con una rutina familiar simple.",
    ],
  }, profile);
}

export function applyTutorBehaviorPolicy(
  adaptation: EmotionalAdaptation,
  policy: TutorBehaviorPolicy,
): EmotionalAdaptation {
  return {
    ...adaptation,
    tone: policy.tone === "empathetic" ? "calm" : policy.tone === "direct" ? "energizing" : adaptation.tone,
    explanationDepth:
      policy.detailLevel === "minimal"
        ? "step_by_step"
        : policy.detailLevel === "analytical"
          ? "challenge"
          : adaptation.explanationDepth,
    difficultyAdjustment: policy.difficulty,
    tutorInstruction: [
      adaptation.tutorInstruction,
      `Perfil dinamico: tono=${policy.tone}; ritmo=${policy.pace}; dificultad=${policy.difficulty}; detalle=${policy.detailLevel}; refuerzo=${policy.positiveReinforcement}.`,
      ...policy.directives,
    ].filter(Boolean).join(" ").trim(),
  };
}

export function resolveSessionModeFromProfile(
  profile: DynamicStudentProfile,
  fallback: MentoriaSessionMode,
): MentoriaSessionMode {
  const policy = buildTutorBehaviorPolicy(profile);
  if (policy.sessionMode !== "subject_reinforcement") return policy.sessionMode;
  if (isBlocked(profile)) return "soft_reentry";
  if (isInconsistent(profile)) return "study_routine";
  if (profile.cognitive.comprehensionLevel === "low") return "subject_reinforcement";
  return fallback;
}

export function updateDynamicStudentProfile(
  profile: DynamicStudentProfile,
  event: DynamicProfileSessionEvent,
): DynamicStudentProfile {
  const totalAnswers = Math.max(0, event.totalAnswers ?? 0);
  const correctAnswers = Math.max(0, Math.min(totalAnswers, event.correctAnswers ?? 0));
  const eventErrorRate = totalAnswers > 0 ? 1 - correctAnswers / totalAnswers : profile.cognitive.errorRate;
  const manyErrors = event.consecutiveErrors !== undefined ? event.consecutiveErrors >= 2 : eventErrorRate >= 0.6;
  const fastAndGood = event.responseSpeed === "fast" && eventErrorRate <= 0.2 && !event.abandoned;
  const nextFrustration =
    event.emotionalState === "blocked" || event.emotionalState === "frustrated" || manyErrors
      ? "high"
      : fastAndGood
        ? "low"
        : profile.emotional.frustrationLevel;
  const nextConfidence =
    fastAndGood
      ? "high"
      : manyErrors || event.abandoned
        ? "low"
        : profile.emotional.confidenceLevel;
  const nextConsistency = event.abandoned ? "low" : event.kind === "session" ? blendLevel(profile.emotional.consistency, "high", 0.18) : profile.emotional.consistency;
  const nextComprehension =
    fastAndGood
      ? "high"
      : manyErrors
        ? "low"
        : profile.cognitive.comprehensionLevel;

  return {
    ...profile,
    cognitive: {
      ...profile.cognitive,
      comprehensionLevel: fastAndGood || manyErrors
        ? nextComprehension
        : blendLevel(profile.cognitive.comprehensionLevel, nextComprehension, 0.42),
      errorRate: clamp01(profile.cognitive.errorRate * 0.65 + eventErrorRate * 0.35),
      responseSpeed: event.responseSpeed ?? profile.cognitive.responseSpeed,
    },
    emotional: {
      frustrationLevel: fastAndGood || manyErrors || event.emotionalState === "blocked" || event.emotionalState === "frustrated"
        ? nextFrustration
        : blendLevel(profile.emotional.frustrationLevel, nextFrustration, 0.45),
      confidenceLevel: fastAndGood || manyErrors || event.abandoned
        ? nextConfidence
        : blendLevel(profile.emotional.confidenceLevel, nextConfidence, 0.42),
      consistency: nextConsistency,
    },
    updatedAt: new Date().toISOString(),
  };
}
