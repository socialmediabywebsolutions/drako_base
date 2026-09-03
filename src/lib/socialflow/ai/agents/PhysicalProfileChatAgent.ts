import { intelligenceModel } from "@/lib/socialflow/ai/models/anthropicModel";

export type PhysicalChatQuestionKey =
  | "gender"
  | "measurements"
  | "constitution"
  | "hair"
  | "tattoos"
  | "visualStyle"
  | "fitness";

export const PHYSICAL_CHAT_QUESTIONS: Array<{ key: PhysicalChatQuestionKey; question: string }> = [
  { key: "gender", question: "¿Eres mujer, hombre, o prefieres no especificarlo?" },
  { key: "measurements", question: "¿Cuánto mides y cuánto pesas aproximadamente?" },
  {
    key: "constitution",
    question:
      "¿Cómo describirías tu constitución física? ¿Eres de las que engorda poco aunque coma mucho, o tienes tendencia a ganar peso fácilmente, o eres más atlética/musculosa por naturaleza?",
  },
  { key: "hair", question: "¿De qué color tienes el cabello y cómo lo llevas normalmente?" },
  { key: "tattoos", question: "¿Tienes tatuajes visibles que aparezcan en tus fotos?" },
  {
    key: "visualStyle",
    question: "¿Cómo describirías el estilo visual de tu contenido — más colorido y vibrante, minimalista, oscuro/misterioso, natural sin filtros?",
  },
  { key: "fitness", question: "¿Cuál es tu estilo fitness principal — gym, yoga, running, lifestyle...?" },
];

const GENDER_VALUES = ["mujer", "hombre", "no_binario", "prefiero_no_decir"] as const;
const BODY_CONSTITUTION_VALUES = ["ectomorfo", "mesomorfo", "endomorfo", "mixto"] as const;
const HAIR_COLOR_BASE_VALUES = [
  "negro",
  "castano_oscuro",
  "castano",
  "castano_claro",
  "rubio_oscuro",
  "rubio",
  "rubio_platino",
  "pelirrojo",
  "canoso",
  "rapado_sin_cabello",
] as const;
const HAIR_STYLE_VALUES = [
  "sin_tratamiento",
  "mechas_californianas",
  "mechas_babylights",
  "mechas_balayage",
  "mechas_de_color",
  "ombre",
  "highlights",
  "tenido_fantasia",
] as const;
const HAIR_LENGTH_VALUES = ["rapado", "muy_corto", "corto", "medio", "largo", "muy_largo"] as const;
const HAIR_TEXTURE_VALUES = ["liso", "ondulado", "rizado", "muy_rizado", "con_mechas", "con_highlights"] as const;
const TATTOOS_VALUES = ["sin_tatuajes", "pequenos_discretos", "brazo", "espalda", "cuello_manos", "muy_tatuado"] as const;
const CONTENT_VISUAL_STYLE_VALUES = [
  "minimalista",
  "colorido_vibrante",
  "oscuro_moody",
  "natural_sin_filtros",
  "glamuroso",
  "deportivo_raw",
  "profesional_limpio",
] as const;
const FITNESS_STYLE_VALUES = [
  "fitness",
  "lifestyle",
  "gym",
  "fitness_model",
  "crossfit",
  "yoga",
  "pilates",
  "running",
  "nutricion",
  "wellness",
] as const;

type ExtractionSeed = {
  gender: string;
  heightCm: number;
  weightKg: number;
  bodyConstitution: string;
  hairColorBase: string;
  hairStyle: string;
  hairLength: string;
  hairTexture: string;
  tattoos: string;
  contentVisualStyle: string[];
  fitnessStyles: string[];
};

function buildSeed(): ExtractionSeed {
  return {
    gender: "",
    heightCm: 0,
    weightKg: 0,
    bodyConstitution: "",
    hairColorBase: "",
    hairStyle: "",
    hairLength: "",
    hairTexture: "",
    tattoos: "",
    contentVisualStyle: [],
    fitnessStyles: [],
  };
}

const QUESTION_FIELD_GUIDE: Record<PhysicalChatQuestionKey, string> = {
  gender: `Rellena SOLO 'gender' con uno de: ${GENDER_VALUES.join(", ")}.`,
  measurements: "Rellena SOLO 'heightCm' (número entero en centímetros) y 'weightKg' (número, puede tener decimales) según lo que diga el usuario.",
  constitution: `Rellena SOLO 'bodyConstitution' con uno de: ${BODY_CONSTITUTION_VALUES.join(", ")} — "engorda poco aunque coma mucho" = ectomorfo, "tendencia a ganar peso fácilmente" = endomorfo, "atlética/musculosa por naturaleza" = mesomorfo, si menciona una mezcla o no está claro = mixto.`,
  hair: `Rellena 'hairColorBase' con uno de: ${HAIR_COLOR_BASE_VALUES.join(", ")}. Rellena 'hairStyle' con uno de: ${HAIR_STYLE_VALUES.join(", ")} (usa "sin_tratamiento" si no menciona mechas/tinte/tratamiento). Si lo menciona, rellena también 'hairLength' con uno de: ${HAIR_LENGTH_VALUES.join(", ")} y 'hairTexture' con uno de: ${HAIR_TEXTURE_VALUES.join(", ")}.`,
  tattoos: `Rellena SOLO 'tattoos' con uno de: ${TATTOOS_VALUES.join(", ")} — si dice que no tiene tatuajes usa "sin_tatuajes".`,
  visualStyle: `Rellena SOLO 'contentVisualStyle' (array) con una o más de: ${CONTENT_VISUAL_STYLE_VALUES.join(", ")}.`,
  fitness: `Rellena SOLO 'fitnessStyles' (array) con una o más de: ${FITNESS_STYLE_VALUES.join(", ")}.`,
};

export type PhysicalChatTurnInput = {
  tenantId: string;
  saasId: string;
  questionKey: PhysicalChatQuestionKey;
  userMessage: string;
};

export type PhysicalChatTurnOutput = {
  extractedFields: Record<string, unknown>;
};

export class PhysicalProfileChatAgent {
  async run(input: PhysicalChatTurnInput): Promise<PhysicalChatTurnOutput> {
    const system =
      "Eres un asistente que extrae datos físicos estructurados de una respuesta en lenguaje natural para el perfil de un influencer. Responde ÚNICAMENTE con JSON válido, sin markdown ni comentarios. No inventes datos que el usuario no mencionó — deja esos campos vacíos.";

    const prompt = [
      `El usuario respondió a la pregunta: "${PHYSICAL_CHAT_QUESTIONS.find((q) => q.key === input.questionKey)?.question ?? input.questionKey}"`,
      `Respuesta del usuario: "${input.userMessage}"`,
      QUESTION_FIELD_GUIDE[input.questionKey],
    ].join("\n\n");

    const { data } = await intelligenceModel.generateStructured<ExtractionSeed>(
      { prompt, system, tenantId: input.tenantId, saasId: input.saasId },
      buildSeed,
    );

    const extractedFields: Record<string, unknown> = {};
    if (data.gender) extractedFields.gender = data.gender;
    if (data.heightCm) extractedFields.heightCm = data.heightCm;
    if (data.weightKg) extractedFields.weightKg = data.weightKg;
    if (data.bodyConstitution) extractedFields.bodyConstitution = data.bodyConstitution;
    if (data.hairColorBase) extractedFields.hairColorBase = data.hairColorBase;
    if (data.hairStyle) extractedFields.hairStyle = data.hairStyle;
    if (data.hairLength) extractedFields.hairLength = data.hairLength;
    if (data.hairTexture) extractedFields.hairTexture = data.hairTexture;
    if (data.tattoos) extractedFields.tattoos = data.tattoos;
    if (data.contentVisualStyle?.length) extractedFields.contentVisualStyle = data.contentVisualStyle;
    if (data.fitnessStyles?.length) extractedFields.fitnessStyles = data.fitnessStyles;

    return { extractedFields };
  }
}
