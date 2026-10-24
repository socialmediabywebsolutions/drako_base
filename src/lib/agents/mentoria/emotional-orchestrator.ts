import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy } from "@/lib/mentoria/microcopy";
import { buildInterventionResponse } from "@/lib/mentoria/intervention-engine";
import { buildEvolutionAdaptiveSignals } from "@/lib/mentoria/student-evolution";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { MentoriaEmotionalState, MentoriaIntervention, StudentProfile } from "@/lib/mentoria/types";

export type EmotionalAdaptation = {
  emotionalState: MentoriaEmotionalState;
  tone: "calm" | "encouraging" | "energizing";
  explanationDepth: "step_by_step" | "guided" | "challenge";
  difficultyAdjustment: "down" | "steady" | "up";
  tutorInstruction: string;
};

function includesAny(input: string, words: string[]) {
  return words.some((word) => input.includes(word));
}

export function evaluateStudentEmotion(input: {
  message: string;
  profile: StudentProfile;
  evolution?: StudentEvolutionProfile;
  subjectName?: string;
  interventions?: MentoriaIntervention[];
  motivation?: MotivationState;
}): EmotionalAdaptation {
  const normalized = input.message.toLowerCase();
  const learningProfile = getLearningProfile(input.profile);
  const encouragementCopy = getMicrocopy(learningProfile.stage, "encouragement");
  const evolutionSignals = input.evolution ? buildEvolutionAdaptiveSignals(input.evolution) : null;
  const interventionResponse = buildInterventionResponse(input.interventions ?? []);
  const motivationNeedsSupport = input.motivation?.motivationProfile === "fragile" || (input.motivation?.effortScore ?? 1) < 0.42;
  const motivationNeedsChallenge = input.motivation?.motivationProfile === "high_performer" && (input.motivation?.streak ?? 0) >= 3;
  const frustrated = includesAny(normalized, ["no entiendo", "me sale mal", "es imposible", "que rabia", "frustra"]);
  const blocked = includesAny(normalized, ["no se por donde empezar", "me he quedado en blanco", "bloqueado", "no puedo seguir"]);
  const demotivated = includesAny(normalized, ["no quiero", "me da igual", "paso de esto", "no me apetece", "aburrido"]);
  const confident = includesAny(normalized, ["ya lo pillo", "creo que puedo", "quiero un reto", "otra mas dificil"]);

  const baselineNeedsGentleMode =
    input.profile.emotionalBaseline.frustration === "high" ||
    input.profile.emotionalBaseline.concentration === "low";
  const baselineNeedsActivation = input.profile.emotionalBaseline.motivation === "low";
  const evolutionNeedsGentleMode =
    (input.evolution?.frustrationLevel ?? 0) >= 0.7 ||
    evolutionSignals?.supportLevel === "high" ||
    interventionResponse.toneMode === "stabilize" ||
    motivationNeedsSupport;
  const evolutionNeedsChallenge =
    ((input.evolution?.progressionVelocity ?? 0) >= 0.72 && evolutionSignals?.challengeLevel === "up") ||
    interventionResponse.tutorMode === "stretch" ||
    motivationNeedsChallenge;

  if (blocked) {
    return {
      emotionalState: "blocked",
      tone: "calm",
      explanationDepth: "step_by_step",
      difficultyAdjustment: "down",
        tutorInstruction: `${encouragementCopy} Reduce la carga cognitiva. Ajusta el lenguaje al tramo ${learningProfile.stage} y divide el problema en micro-pasos con estilo ${learningProfile.explanationStyle}. ${evolutionSignals?.promptDirectives.join(" ") ?? ""} ${interventionResponse.directives.join(" ")}`.trim(),
    };
  }

  if (frustrated) {
    return {
      emotionalState: "frustrated",
      tone: "encouraging",
      explanationDepth: "guided",
      difficultyAdjustment: "down",
      tutorInstruction: `${encouragementCopy} Valida el esfuerzo sin dramatizar. Reencuadra el error como pista y ofrece un ejemplo cercano al tramo ${learningProfile.stage}. ${evolutionSignals?.promptDirectives.join(" ") ?? ""} ${interventionResponse.directives.join(" ")}`.trim(),
    };
  }

  if (demotivated) {
    return {
      emotionalState: "demotivated",
      tone: "energizing",
      explanationDepth: "guided",
      difficultyAdjustment: "steady",
      tutorInstruction: `${encouragementCopy} Recupera interes conectando el contenido con una meta concreta del alumno con tono base ${learningProfile.tone} y una accion breve de exito rapido. ${evolutionSignals?.promptDirectives.join(" ") ?? ""} ${interventionResponse.directives.join(" ")} ${motivationNeedsSupport ? "Reconoce el esfuerzo visible y cierra con un micro-logro alcanzable." : ""}`.trim(),
    };
  }

  if (confident || evolutionNeedsChallenge) {
    return {
      emotionalState: "confident",
      tone: "energizing",
      explanationDepth: "challenge",
      difficultyAdjustment: "up",
      tutorInstruction: `${encouragementCopy} Manten el reto con estilo ${learningProfile.explanationStyle} y pide justificar el razonamiento antes de avanzar al siguiente nivel. ${evolutionSignals?.promptDirectives.join(" ") ?? ""} ${interventionResponse.directives.join(" ")} ${motivationNeedsChallenge ? "Reconoce la racha positiva y abre un reto nuevo." : ""}`.trim(),
    };
  }

  if (baselineNeedsGentleMode || evolutionNeedsGentleMode) {
    return {
      emotionalState: input.profile.emotionalBaseline.concentration === "low" || evolutionSignals?.explanationMode === "scaffolded" ? "blocked" : "frustrated",
      tone: "calm",
      explanationDepth: "step_by_step",
      difficultyAdjustment: "down",
      tutorInstruction: `${encouragementCopy} Parte de una base emocional sensible. Usa secuencias cortas, una idea por turno y adapta el tono al tramo ${learningProfile.stage}. ${evolutionSignals?.promptDirectives.join(" ") ?? ""} ${interventionResponse.directives.join(" ")}`.trim(),
    };
  }

  if (baselineNeedsActivation) {
    return {
      emotionalState: "demotivated",
      tone: "energizing",
      explanationDepth: "guided",
      difficultyAdjustment: "steady",
      tutorInstruction: `${encouragementCopy} La motivacion basal es baja. Activa el interes con ejemplos cercanos y metas cortas y alcanzables con estilo ${learningProfile.explanationStyle}. ${evolutionSignals?.promptDirectives.join(" ") ?? ""} ${interventionResponse.directives.join(" ")} ${motivationNeedsSupport ? "Haz visible el progreso inmediato para sostener la implicacion." : ""}`.trim(),
    };
  }

  return {
    emotionalState: input.profile.baseEmotionalState,
    tone: interventionResponse.toneMode === "challenge" || evolutionSignals?.supportLevel === "low" ? "encouraging" : "calm",
    explanationDepth: interventionResponse.tutorMode === "stretch" || evolutionSignals?.explanationMode === "analytical" ? "challenge" : "guided",
    difficultyAdjustment: interventionResponse.tutorMode === "gentle" ? "down" : evolutionSignals?.challengeLevel ?? "steady",
    tutorInstruction: `${encouragementCopy} Ensena de forma guiada, clara y amable con tono ${learningProfile.tone} y explicacion ${learningProfile.explanationStyle}. ${evolutionSignals?.promptDirectives.join(" ") ?? ""} ${interventionResponse.directives.join(" ")} ${motivationNeedsSupport ? "Haz visible el avance logrado en esta interaccion." : motivationNeedsChallenge ? "Refuerza la racha positiva y enlaza con un reto siguiente." : ""}`.trim(),
  };
}
