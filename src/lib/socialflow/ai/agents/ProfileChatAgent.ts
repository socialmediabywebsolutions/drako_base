import { intelligenceModel } from "@/lib/socialflow/ai/models/anthropicModel";
import type { ChannelCompetitor, ChannelProfile } from "@/lib/socialflow/profile/types";

export type ProfileChatBlockKey = "identity" | "niche" | "audience" | "business" | "competitors" | "goals";

export type ProfileChatMessage = { role: "user" | "assistant"; content: string };

export type ProposedCompetitor = {
  name: string;
  handle: string | null;
  platform: ChannelCompetitor["platform"] | null;
  niche: string | null;
};

export type ProfileChatTurnInput = {
  tenantId: string;
  saasId: string;
  accountType: "empresa" | "influencer" | null;
  currentProfile: ChannelProfile;
  history: ProfileChatMessage[];
  userMessage: string | null;
};

export type ProfileChatTurnOutput = {
  assistantMessage: string;
  blockKey: ProfileChatBlockKey | null;
  extractedFields: Partial<ChannelProfile>;
  proposedFields: Partial<ChannelProfile>;
  proposedCompetitors: ProposedCompetitor[];
  done: boolean;
};

const BLOCK_ORDER: ProfileChatBlockKey[] = ["identity", "niche", "audience", "business", "competitors", "goals"];

const BLOCK_PROMPTS: Record<ProfileChatBlockKey, string> = {
  identity: "Cuéntame de tu marca/canal: qué haces, a quién le hablas, y qué tono usas normalmente.",
  niche: "¿Cuál es tu nicho principal y hay subtemas relacionados? ¿Hay temas que evitas o que no quieres tocar?",
  audience: "Háblame de tu audiencia: quiénes son, qué buscan, qué les preocupa.",
  business: "¿Qué vendes u ofreces? (productos, servicios, precios si aplica, qué te diferencia de otros)",
  competitors: "¿Conoces cuentas o negocios similares al tuyo que consideres competencia o referencia?",
  goals: "Para terminar: ¿tienes un objetivo de seguidores y plazo, con qué frecuencia publicas, a qué rango de edad te diriges, y qué estilo visual predomina en tu contenido?",
};

const BLOCK_COMPLETENESS_CHECKS: Record<ProfileChatBlockKey, (p: ChannelProfile) => boolean> = {
  identity: (p) => Boolean(p.brandName?.trim() && p.shortDescription?.trim() && p.toneOfVoice?.trim()),
  niche: (p) => Boolean(p.niche?.trim() && p.subniches?.length),
  audience: (p) => Boolean(p.audienceDescription?.trim() && p.painPoints?.length),
  business: (p) => Boolean(p.products?.length || p.services?.length || p.offers?.length),
  competitors: (p) => Boolean(p.competitorHashtags?.length),
  goals: (p) =>
    Boolean(p.growthGoalFollowers || p.growthGoalTimeline?.trim() || p.postingFrequency || p.ageRange || p.contentStyle),
};

// Nullable ChannelProfile fields are encoded with non-null sentinels ("" / 0) while talking to
// the LLM because mergeAiStructuredOutput (localModel.ts) falls through to "return base" for any
// base value that isn't a string/number/array/plain-object — a `null` seed can never be
// overwritten by the model's answer. The sentinels are converted back to `null` in toProfilePatch.
function buildFieldSeed() {
  return {
    brandName: "",
    channelName: "",
    websiteUrl: "",
    shortDescription: "",
    longDescription: "",
    mission: "",
    valueProposition: "",
    toneOfVoice: "",
    personality: "",
    primaryLanguage: "",
    targetMarkets: [] as string[],
    niche: "",
    subniches: [] as string[],
    mainTopics: [] as string[],
    secondaryTopics: [] as string[],
    forbiddenTopics: [] as string[],
    allowedTopics: [] as string[],
    audienceDescription: "",
    buyerPersona: "",
    painPoints: [] as string[],
    desires: [] as string[],
    objections: [] as string[],
    products: [] as string[],
    services: [] as string[],
    offers: [] as string[],
    avgPrice: 0,
    transformations: [] as string[],
    differentiators: [] as string[],
    baseKeywords: [] as string[],
    priorityKeywords: [] as string[],
    longTailKeywords: [] as string[],
    baseHashtags: [] as string[],
    priorityHashtags: [] as string[],
    competitorHashtags: [] as string[],
    ageRange: "",
    gender: "",
    growthGoalFollowers: 0,
    growthGoalTimeline: "",
    contentStyle: "",
    postingFrequency: 0,
  };
}

type FieldSeed = ReturnType<typeof buildFieldSeed>;

const NULLABLE_STRING_KEYS: Array<keyof FieldSeed> = ["ageRange", "gender", "growthGoalTimeline", "contentStyle"];
const NULLABLE_NUMBER_KEYS: Array<keyof FieldSeed> = ["avgPrice", "growthGoalFollowers", "postingFrequency"];

function toProfilePatch(seed: FieldSeed): Partial<ChannelProfile> {
  const patch: Record<string, unknown> = { ...seed };
  for (const key of NULLABLE_STRING_KEYS) {
    if (!patch[key]) patch[key] = null;
  }
  for (const key of NULLABLE_NUMBER_KEYS) {
    if (!patch[key]) patch[key] = null;
  }
  return patch as Partial<ChannelProfile>;
}

function summarizeProfileForPrompt(profile: ChannelProfile): string {
  const lines: string[] = [];
  for (const block of BLOCK_ORDER) {
    const filled = BLOCK_COMPLETENESS_CHECKS[block](profile);
    lines.push(`- Bloque "${block}": ${filled ? "ya tiene datos" : "vacío o incompleto"}`);
  }
  return lines.join("\n");
}

function accountTypeLabel(accountType: ProfileChatTurnInput["accountType"]): string {
  if (accountType === "influencer") return "un/a influencer o creador/a de contenido";
  if (accountType === "empresa") return "una empresa/negocio";
  return "una marca (tipo de cuenta no especificado)";
}

export class ProfileChatAgent {
  async run(input: ProfileChatTurnInput): Promise<ProfileChatTurnOutput> {
    const pendingBlocks = BLOCK_ORDER.filter((block) => !BLOCK_COMPLETENESS_CHECKS[block](input.currentProfile));

    const assistantTurnsSoFar = input.history.filter((m) => m.role === "assistant").length;
    const answeredBlock = assistantTurnsSoFar > 0 ? pendingBlocks[assistantTurnsSoFar - 1] ?? null : null;
    const nextBlock = pendingBlocks[assistantTurnsSoFar] ?? null;

    // Nothing pending at all: either the very first turn on an already-complete profile,
    // or we just processed the last pending block's answer.
    if (!nextBlock && !answeredBlock) {
      return {
        assistantMessage:
          "Tu perfil de canal ya tiene todos los bloques principales completos. Puedes repasar cualquier campo manualmente, o decirme qué quieres actualizar.",
        blockKey: null,
        extractedFields: {},
        proposedFields: {},
        proposedCompetitors: [],
        done: true,
      };
    }

    const system = [
      "Eres un CEO/estratega de marketing entrevistando al dueño de un canal/marca para completar su perfil estratégico.",
      `Estás hablando con ${accountTypeLabel(input.accountType)}.`,
      "Cuando el usuario da información genérica o escasa, propones una versión más específica y elaborada (nicho, subnichos, keywords, hashtags, competidores razonables) en vez de dejar los campos vacíos — pero SIEMPRE separando lo que el usuario dijo literalmente (extractedFields) de lo que tú propones/infieres (proposedFields), nunca mezclándolo.",
      "Si algo del perfil actual parece inconsistente con lo que el usuario te está contando ahora (p.ej. un nicho guardado que no encaja con la audiencia o negocio descritos), corrígelo en proposedFields y menciónalo brevemente en tu respuesta.",
      "Responde ÚNICAMENTE con JSON válido con las claves 'assistantMessage', 'extractedFields' y 'proposedFields' (y 'proposedCompetitors' si aplica). Sin markdown ni comentarios.",
    ].join(" ");

    const promptParts: string[] = [
      `Estado actual del perfil por bloques:\n${summarizeProfileForPrompt(input.currentProfile)}`,
      `Perfil actual completo (JSON, para detectar huecos o inconsistencias): ${JSON.stringify(input.currentProfile)}`,
    ];

    if (input.history.length) {
      promptParts.push(
        `Historial de la conversación hasta ahora:\n${input.history.map((m) => `${m.role === "user" ? "Usuario" : "Tú"}: ${m.content}`).join("\n")}`,
      );
    }

    if (answeredBlock && input.userMessage) {
      promptParts.push(
        `El usuario acaba de responder al bloque "${answeredBlock}" (${BLOCK_PROMPTS[answeredBlock]}) con:\n"${input.userMessage}"`,
        `Extrae en 'extractedFields' lo que dijo literalmente, y en 'proposedFields' (y 'proposedCompetitors' si el bloque es "competitors") tus sugerencias razonadas si la respuesta fue genérica o incompleta.`,
      );
    }

    if (nextBlock) {
      promptParts.push(
        `Después de procesar la respuesta anterior (si la hubo), formula en 'assistantMessage' la siguiente pregunta de forma natural y breve, cubriendo este bloque: "${BLOCK_PROMPTS[nextBlock]}". No hagas más de una pregunta a la vez.`,
      );
    } else {
      promptParts.push(
        "Ya no quedan bloques pendientes tras esta respuesta. En 'assistantMessage', agradece brevemente y anuncia que vas a mostrarle un resumen completo para revisar antes de guardar. No hagas ninguna pregunta nueva.",
      );
    }

    const prompt = promptParts.join("\n\n");

    const { data } = await intelligenceModel.generateStructured<{
      assistantMessage: string;
      extractedFields: FieldSeed;
      proposedFields: FieldSeed;
      proposedCompetitors: ProposedCompetitor[];
    }>(
      { prompt, system, tenantId: input.tenantId, saasId: input.saasId },
      () => ({
        assistantMessage: nextBlock ? BLOCK_PROMPTS[nextBlock] : "Gracias, ya tengo todo lo que necesito. Revisemos el resumen.",
        extractedFields: buildFieldSeed(),
        proposedFields: buildFieldSeed(),
        proposedCompetitors: [],
      }),
    );

    return {
      assistantMessage: data.assistantMessage,
      blockKey: answeredBlock,
      extractedFields: answeredBlock ? toProfilePatch(data.extractedFields) : {},
      proposedFields: answeredBlock ? toProfilePatch(data.proposedFields) : {},
      proposedCompetitors: answeredBlock === "competitors" ? data.proposedCompetitors ?? [] : [],
      done: !nextBlock,
    };
  }
}
