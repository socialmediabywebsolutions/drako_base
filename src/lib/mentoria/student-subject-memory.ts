import type {
  MentoriaConceptConfidenceLevel,
  MentoriaConceptInternalSummary,
  MentoriaConceptMasteryLevel,
  MentoriaStudentSubjectMemory,
  MentoriaSupportStyle,
  MentoriaSubject,
} from "@/lib/mentoria/types";

export type InferConceptKeyInput = {
  subjectSlug?: string | null;
  topic?: string | null;
  expectedCompetency?: string | null;
  text?: string | null;
};

type ConceptRule = {
  conceptKey: string;
  supportStyle: MentoriaSupportStyle;
  errorType: string;
  keywords: string[];
};

const SPANISH_STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "o",
  "en",
  "con",
  "para",
  "por",
  "que",
  "una",
  "un",
  "al",
  "lo",
  "se",
  "como",
  "sobre",
  "desde",
  "sin",
  "mas",
  "muy",
  "este",
  "esta",
  "estas",
  "estos",
  "esa",
  "ese",
  "eso",
]);

const SUBJECT_CONCEPT_RULES: Array<{ subjectMatch: RegExp; rules: ConceptRule[] }> = [
  {
    subjectMatch: /mat|algebra|geo|calc/,
    rules: [
      {
        conceptKey: "fractions_comparison",
        supportStyle: "visual_steps",
        errorType: "fraction_comparison_confusion",
        keywords: ["fraccion", "fracciones", "compar", "mayor", "menor", "ordenar"],
      },
      {
        conceptKey: "fractions_simplification",
        supportStyle: "visual_steps",
        errorType: "fraction_simplification_error",
        keywords: ["fraccion", "fracciones", "simplificar", "irreducible", "mcd"],
      },
      {
        conceptKey: "equation_isolation",
        supportStyle: "step_by_step",
        errorType: "equation_isolation_error",
        keywords: ["ecuacion", "despejar", "despeje", "aislar", "incognita"],
      },
      {
        conceptKey: "problem_solving",
        supportStyle: "guided_practice",
        errorType: "problem_translation_error",
        keywords: ["problema", "enunciado", "datos", "resolver", "plantear"],
      },
      {
        conceptKey: "algebra_operations",
        supportStyle: "step_by_step",
        errorType: "algebra_operation_error",
        keywords: ["algebra", "polinom", "terminos", "operaciones", "factorizar"],
      },
    ],
  },
  {
    subjectMatch: /leng|lect|compren|idioma|castell|english|ingles/,
    rules: [
      {
        conceptKey: "reading_main_idea",
        supportStyle: "concrete_example",
        errorType: "main_idea_detection_error",
        keywords: ["idea principal", "comprension", "lectora", "resumen", "texto"],
      },
      {
        conceptKey: "reading_inference",
        supportStyle: "guided_practice",
        errorType: "reading_inference_error",
        keywords: ["infer", "deduc", "conclusion", "interpreta", "lectura"],
      },
      {
        conceptKey: "syntax_sentence_structure",
        supportStyle: "step_by_step",
        errorType: "syntax_structure_error",
        keywords: ["sintaxis", "sujeto", "predicado", "complemento", "oracion"],
      },
      {
        conceptKey: "spelling_accentuation",
        supportStyle: "concrete_example",
        errorType: "accentuation_error",
        keywords: ["tilde", "acento", "acentuacion", "ortografia", "aguda", "llana", "esdrujula"],
      },
    ],
  },
  {
    subjectMatch: /cien|fis|quim|bio/,
    rules: [
      {
        conceptKey: "scientific_reasoning",
        supportStyle: "guided_practice",
        errorType: "scientific_reasoning_error",
        keywords: ["hipotesis", "explica", "causa", "efecto", "razona"],
      },
      {
        conceptKey: "scientific_vocabulary",
        supportStyle: "concrete_example",
        errorType: "scientific_vocabulary_error",
        keywords: ["concepto", "termino", "definicion", "proceso", "funcion"],
      },
    ],
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !SPANISH_STOPWORDS.has(item));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function includesKeyword(haystack: string, keyword: string): boolean {
  const normalizedKeyword = normalize(keyword);
  return haystack.includes(normalizedKeyword);
}

function fallbackConceptKey(input: InferConceptKeyInput): string {
  const subject = normalize(input.subjectSlug ?? "general").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "general";
  const raw = `${input.expectedCompetency ?? ""} ${input.topic ?? ""} ${input.text ?? ""}`.trim();
  const tokens = tokenize(raw).slice(0, 3);
  const suffix = tokens.length > 0 ? tokens.join("_") : "core_concept";
  return `${subject}_${suffix}`;
}

export function normalizeConceptKey(value: string): string {
  const normalized = normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "general_concept";
}

export function humanizeConceptKey(value: string): string {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return "el concepto activo";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function inferConceptSupportStyle(input: { conceptKey: string; subjectSlug?: string | null }): MentoriaSupportStyle {
  const subject = normalize(input.subjectSlug ?? "");
  const concept = normalize(input.conceptKey);
  for (const entry of SUBJECT_CONCEPT_RULES) {
    if (!entry.subjectMatch.test(subject)) continue;
    const matched = entry.rules.find((rule) => normalize(rule.conceptKey) === concept);
    if (matched) return matched.supportStyle;
  }
  if (concept.includes("reading") || concept.includes("spelling")) return "concrete_example";
  if (concept.includes("fraction") || concept.includes("geometry")) return "visual_steps";
  return "step_by_step";
}

export function inferConceptKey(input: InferConceptKeyInput): string {
  const subject = normalize(input.subjectSlug ?? "");
  const haystack = normalize(`${input.expectedCompetency ?? ""} ${input.topic ?? ""} ${input.text ?? ""}`);
  let bestMatch: { key: string; score: number } | null = null;

  for (const entry of SUBJECT_CONCEPT_RULES) {
    if (!entry.subjectMatch.test(subject)) continue;
    for (const rule of entry.rules) {
      const score = rule.keywords.reduce((total, keyword) => total + (includesKeyword(haystack, keyword) ? keyword.split(/\s+/).length : 0), 0);
      if (score <= 0) continue;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { key: rule.conceptKey, score };
      }
    }
  }

  return normalizeConceptKey(bestMatch?.key ?? fallbackConceptKey(input));
}

export function inferLastErrorType(input: {
  conceptKey: string;
  correctionFeedback?: string | null;
  studentText?: string | null;
  subjectSlug?: string | null;
}): string {
  const haystack = normalize(`${input.correctionFeedback ?? ""} ${input.studentText ?? ""}`);
  if (haystack.includes("denominador")) return "denominator_confusion";
  if (haystack.includes("numerador")) return "numerator_confusion";
  if (haystack.includes("signo") || haystack.includes("operacion")) return "operation_sign_confusion";
  if (haystack.includes("idea principal")) return "main_idea_confusion";
  if (haystack.includes("tilde") || haystack.includes("acento")) return "accentuation_confusion";
  if (haystack.includes("sujeto") || haystack.includes("predicado")) return "syntax_role_confusion";

  const subject = normalize(input.subjectSlug ?? "");
  const concept = normalize(input.conceptKey);
  for (const entry of SUBJECT_CONCEPT_RULES) {
    if (!entry.subjectMatch.test(subject)) continue;
    const rule = entry.rules.find((item) => normalize(item.conceptKey) === concept);
    if (rule) return rule.errorType;
  }
  return `${normalizeConceptKey(input.conceptKey)}_error`;
}

export function deriveSupportStyleFromPolicy(input: {
  previous?: MentoriaSupportStyle | null;
  tutorExampleUse?: string | null;
  tutorDetailLevel?: string | null;
  tutorStage?: string | null;
  tutorDifficulty?: string | null;
  tutorReply?: string | null;
  success: boolean;
}): MentoriaSupportStyle {
  const reply = normalize(input.tutorReply ?? "");
  if (input.tutorExampleUse === "visual_step" || reply.includes("esquema visual") || reply.includes("partes, orden y comprobacion")) {
    return "visual_steps";
  }
  if (input.tutorExampleUse === "concrete_first" || reply.includes("ejemplo concreto")) {
    return "concrete_example";
  }
  if ((input.tutorStage === "light_evaluation" || input.tutorDifficulty === "up") && input.success) {
    return "retrieval_check";
  }
  if (input.tutorStage === "guided_practice" || input.tutorDetailLevel === "guided") {
    return "guided_practice";
  }
  return input.previous ?? "step_by_step";
}

export function masteryToScore(value: MentoriaConceptMasteryLevel): number {
  if (value === "mastered") return 3;
  if (value === "secure") return 2;
  if (value === "developing") return 1;
  return 0;
}

export function scoreToMastery(value: number): MentoriaConceptMasteryLevel {
  const safe = clamp(Math.round(value), 0, 3);
  if (safe >= 3) return "mastered";
  if (safe === 2) return "secure";
  if (safe === 1) return "developing";
  return "fragile";
}

export function createInitialStudentSubjectMemory(input: {
  studentId: string;
  tenantId?: string;
  subjectSlug: string;
  conceptKey: string;
  supportStyle?: MentoriaSupportStyle;
  happenedAt?: string | null;
  evidenceSummary?: string;
  errorType?: string | null;
}): MentoriaStudentSubjectMemory {
  const supportStyle = input.supportStyle ?? inferConceptSupportStyle({ conceptKey: input.conceptKey, subjectSlug: input.subjectSlug });
  const timestamp = input.happenedAt ?? new Date().toISOString();
  const conceptLabel = humanizeConceptKey(input.conceptKey);
  const internalSummary: MentoriaConceptInternalSummary = {
    conceptWorked: conceptLabel,
    errorDetected: input.errorType ?? null,
    interventionThatWorked: supportStyle.replace(/_/g, " "),
    revisitSoon: true,
  };

  return {
    studentId: input.studentId,
    tenantId: input.tenantId,
    subjectSlug: normalizeConceptKey(input.subjectSlug),
    conceptKey: normalizeConceptKey(input.conceptKey),
    confidenceLevel: "low",
    masteryLevel: "fragile",
    recurrenceCount: 0,
    lastErrorType: input.errorType ?? null,
    preferredSupportStyle: supportStyle,
    lastWorkedAt: timestamp,
    needsReinforcement: true,
    evidenceSummary: input.evidenceSummary ?? `${conceptLabel}: empezar con apoyo ${supportStyle.replace(/_/g, " ")}.`,
    internalSummary,
    updatedAt: timestamp,
  };
}

function topicSimilarity(topic: string | null | undefined, memory: MentoriaStudentSubjectMemory): number {
  const haystack = tokenize(`${topic ?? ""} ${memory.evidenceSummary} ${memory.internalSummary.conceptWorked}`);
  if (haystack.length === 0) return 0;
  const conceptTokens = new Set(tokenize(`${memory.conceptKey} ${memory.internalSummary.conceptWorked}`));
  return haystack.filter((token) => conceptTokens.has(token)).length;
}

export function pickActiveStudentSubjectMemory(
  memories: MentoriaStudentSubjectMemory[],
  input?: { subjectSlug?: string | null; topic?: string | null },
): MentoriaStudentSubjectMemory | null {
  if (memories.length === 0) return null;
  const subjectSlug = normalizeConceptKey(input?.subjectSlug ?? "");
  const filtered = subjectSlug
    ? memories.filter((item) => normalizeConceptKey(item.subjectSlug) === subjectSlug)
    : memories;
  const pool = filtered.length > 0 ? filtered : memories;

  return [...pool].sort((left, right) => {
    const leftScore = (left.needsReinforcement ? 50 : 0) + left.recurrenceCount * 6 + topicSimilarity(input?.topic, left) * 5 + masteryToScore(left.masteryLevel) * -3 + Date.parse(left.updatedAt) / 1e11;
    const rightScore = (right.needsReinforcement ? 50 : 0) + right.recurrenceCount * 6 + topicSimilarity(input?.topic, right) * 5 + masteryToScore(right.masteryLevel) * -3 + Date.parse(right.updatedAt) / 1e11;
    return rightScore - leftScore;
  })[0] ?? null;
}

export function rankFragileSubjectMemories(
  memories: MentoriaStudentSubjectMemory[],
  input?: { subjectSlug?: string | null },
): MentoriaStudentSubjectMemory[] {
  const subjectSlug = input?.subjectSlug ? normalizeConceptKey(input.subjectSlug) : null;
  return memories
    .filter((item) => !subjectSlug || normalizeConceptKey(item.subjectSlug) === subjectSlug)
    .sort((left, right) => {
      const leftScore = (left.needsReinforcement ? 30 : 0) + left.recurrenceCount * 5 - masteryToScore(left.masteryLevel) * 4;
      const rightScore = (right.needsReinforcement ? 30 : 0) + right.recurrenceCount * 5 - masteryToScore(right.masteryLevel) * 4;
      return rightScore - leftScore;
    });
}

export function summarizeSubjectConcept(memory: MentoriaStudentSubjectMemory | null | undefined, subject?: MentoriaSubject | null): string | null {
  if (!memory) return null;
  const conceptLabel = humanizeConceptKey(memory.conceptKey);
  const subjectLabel = subject?.name ?? humanizeConceptKey(memory.subjectSlug);
  if (memory.needsReinforcement) {
    return `${subjectLabel}: conviene retomar ${conceptLabel} con apoyo ${memory.preferredSupportStyle.replace(/_/g, " ")}.`;
  }
  if (memory.masteryLevel === "mastered" || memory.masteryLevel === "secure") {
    return `${subjectLabel}: ${conceptLabel} ya admite una comprobacion corta de autonomia.`;
  }
  return `${subjectLabel}: ${conceptLabel} sigue en consolidacion.`;
}
