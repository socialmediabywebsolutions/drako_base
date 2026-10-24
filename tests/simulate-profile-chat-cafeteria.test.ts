import { describe, expect, it, vi } from "vitest";
import { mergeAiStructuredOutput } from "@/lib/socialflow/ai/models/localModel";
import type { ChannelProfile } from "@/lib/socialflow/profile/types";

// Mocks the LLM layer only (anthropicModel.intelligenceModel) with hand-written, realistic
// per-block answers for a fictional "cafetería" — no real Anthropic/Workers AI call is made.
// This validates the conversation -> ChannelProfile field mapping deterministically, ahead of
// wiring the chat into any real UI/account (see plan: profile chat agent, gate before deploy).
vi.mock("@/lib/socialflow/ai/models/anthropicModel", () => ({
  intelligenceModel: { generateStructured: vi.fn() },
}));

import { intelligenceModel } from "@/lib/socialflow/ai/models/anthropicModel";
import { ProfileChatAgent, type ProfileChatMessage, type ProposedCompetitor } from "@/lib/socialflow/ai/agents/ProfileChatAgent";

function emptyProfile(): ChannelProfile {
  const now = new Date().toISOString();
  return {
    id: "sf_profile_test", tenantId: "test-tenant", saasId: "socialflow", channelId: "test-channel",
    brandName: "", channelName: "", websiteUrl: "", activeSocialNetworks: [], onboardingCompletedAt: null,
    shortDescription: "", longDescription: "", mission: "", valueProposition: "", toneOfVoice: "", personality: "",
    primaryLanguage: "", targetCountry: "", targetMarkets: [],
    niche: "", subniches: [], mainTopics: [], secondaryTopics: [], viralThemes: [], trendingTopics: [],
    seasonalTopics: [], forbiddenTopics: [], allowedTopics: [],
    audienceDescription: "", buyerPersona: "", painPoints: [], desires: [], objections: [],
    awarenessLevel: "", audienceLanguage: "", audienceStyle: "",
    products: [], services: [], offers: [], avgPrice: null, transformations: [], differentiators: [],
    primaryCTA: "", secondaryCTAs: [],
    baseKeywords: [], priorityKeywords: [], longTailKeywords: [], baseHashtags: [], priorityHashtags: [], competitorHashtags: [],
    contentPillars: [], preferredFormats: [], avoidedFormats: [], postingFrequencyGoal: "",
    marketSignals: [], opportunitySignals: [], demandSignals: [], audienceQuestions: [], recurringObjections: [],
    industryTrends: [], prohibitedClaims: [], bannedWords: [], forbiddenAngles: [],
    complianceNotes: "", brandSafetyRules: "", assetSummary: null,
    ageRange: null, gender: null, growthGoalFollowers: null, growthGoalTimeline: null, contentStyle: null, postingFrequency: null,
    createdAt: now, updatedAt: now,
  };
}

// Applies a patch the same way ProfileAiChat.tsx's applyPatch() does on the client:
// non-empty strings/arrays and any defined number/other value overlay the running draft.
function applyPatch(base: Record<string, unknown>, patch: Record<string, unknown> | undefined) {
  if (!patch) return base;
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length) next[key] = value;
    } else if (typeof value === "string") {
      if (value.trim()) next[key] = value;
    } else {
      next[key] = value;
    }
  }
  return next;
}

type ScriptedTurn = {
  assistantMessage: string;
  extractedFields?: Record<string, unknown>;
  proposedFields?: Record<string, unknown>;
  proposedCompetitors?: ProposedCompetitor[];
};

// One scripted LLM reply per agent call: 1 kickoff + 6 block answers (identity, niche, audience,
// business, competitors, goals) for a fictional specialty coffee shop, "Café Aurora" (Valencia).
const SCRIPT: ScriptedTurn[] = [
  { assistantMessage: "¡Hola! Cuéntame de tu cafetería: qué hacéis, a quién habláis y qué tono usáis normalmente." },
  {
    extractedFields: {
      brandName: "Café Aurora",
      shortDescription: "Cafetería de especialidad con tueste propio en Valencia",
      toneOfVoice: "cercano, sin postureo, cálido",
      primaryLanguage: "es",
    },
    proposedFields: {
      longDescription:
        "Café Aurora es una cafetería de especialidad en Valencia con tueste propio, pensada para quienes trabajan, estudian o simplemente quieren un buen café en un ambiente acogedor y sin pretensiones.",
      mission: "Acercar café de especialidad de calidad a la vida diaria de Valencia, sin esnobismo.",
      valueProposition: "Café de origen, tueste propio y ambiente cercano a precio justo.",
      personality: "Cercana, artesanal, honesta",
      targetMarkets: ["Valencia", "España"],
    },
    assistantMessage: "¡Genial! ¿Cuál es tu nicho principal y hay subtemas relacionados? ¿Hay temas que evitas o que no quieres tocar?",
  },
  {
    extractedFields: {
      niche: "cafetería de especialidad",
      mainTopics: ["café de origen", "latte art", "maridaje con repostería"],
      forbiddenTopics: ["política"],
    },
    proposedFields: {
      subniches: ["tueste propio", "brunch de especialidad", "repostería artesanal"],
      secondaryTopics: ["sostenibilidad del café", "barismo"],
      allowedTopics: ["recomendaciones de café para casa", "eventos locales"],
    },
    assistantMessage: "Perfecto. Háblame de tu audiencia: quiénes son, qué buscan, qué les preocupa.",
  },
  {
    extractedFields: {
      audienceDescription:
        "Profesionales y estudiantes de 25 a 40 años que buscan un espacio tranquilo para trabajar o desconectar, valorando la calidad del café sobre el precio",
    },
    proposedFields: {
      buyerPersona:
        "Ana, 29 años, freelance o estudiante de posgrado en Valencia, trabaja desde cafeterías, valora la calidad y el ambiente, dispuesta a pagar algo más por buen café y wifi tranquilo.",
      painPoints: ["cafeterías ruidosas o masificadas", "café de mala calidad en el trabajo o en casa", "falta de sitios con buen wifi y enchufes"],
      desires: ["un espacio tranquilo para concentrarse", "café de especialidad sin tener que ser experto", "sentirse parte de una comunidad local"],
      objections: ["el café de especialidad es caro", "no entiendo de café, me da corte pedir"],
    },
    assistantMessage: "¿Qué vendes u ofreces? (productos, servicios, precios si aplica, qué te diferencia de otros)",
  },
  {
    extractedFields: {
      products: ["café de especialidad en grano", "café en taza", "repostería casera"],
      offers: ["catas de café mensuales"],
      avgPrice: 3.5,
    },
    proposedFields: {
      services: ["venta de café en grano para casa", "catas y formación de café"],
      transformations: ["de no saber nada de café a disfrutarlo con confianza"],
      differentiators: ["tueste propio", "catas mensuales", "ambiente sin postureo"],
    },
    assistantMessage: "¿Conoces cuentas o negocios similares al tuyo que consideres competencia o referencia?",
  },
  {
    proposedFields: {
      competitorHashtags: ["#tomacafe", "#blendstation", "#specialtycoffeevalencia"],
    },
    proposedCompetitors: [
      { name: "Toma Café", handle: "@tomacafe", platform: "instagram", niche: "cafetería de especialidad" },
      { name: "Blend Station", handle: null, platform: "instagram", niche: "cafetería de especialidad en Valencia" },
    ],
    assistantMessage:
      "Para terminar: ¿tienes un objetivo de seguidores y plazo, con qué frecuencia publicas, a qué rango de edad te diriges, y qué estilo visual predomina en tu contenido?",
  },
  {
    extractedFields: {
      growthGoalFollowers: 5000,
      growthGoalTimeline: "6 meses",
      postingFrequency: 4,
      ageRange: "25-35",
    },
    proposedFields: {
      contentStyle: "lifestyle",
      baseKeywords: ["cafetería de especialidad valencia", "café de origen", "tueste propio"],
      priorityKeywords: ["cafetería especialidad valencia"],
      longTailKeywords: ["mejor cafetería de especialidad en valencia centro"],
      baseHashtags: ["#cafedeespecialidad", "#cafeteriavalencia", "#tuestepropioespaña"],
      priorityHashtags: ["#cafedeespecialidadvalencia"],
    },
    assistantMessage: "¡Gracias! Ya tengo todo lo que necesito. Vamos a revisar el resumen completo antes de guardar.",
  },
];

const USER_ANSWERS = [
  "Somos Café Aurora, una cafetería de especialidad en Valencia, con tueste propio, ambiente acogedor y cercano, para gente que trabaja o estudia y busca café bueno sin postureo.",
  "Nuestro nicho es cafetería de especialidad: tocamos café de origen, latte art y maridaje con repostería casera. Evitamos hablar de política.",
  "Nuestra audiencia son profesionales y estudiantes de 25 a 40 años que quieren un espacio tranquilo para trabajar o desconectar, y valoran la calidad del café sobre el precio.",
  "Vendemos café de especialidad en grano y en taza, algo de repostería casera, precio medio de 3,5€ por café, y hacemos catas de café una vez al mes.",
  "Miramos mucho a Toma Café en Madrid y a una cafetería local que se llama Blend Station aquí en Valencia.",
  "Queremos llegar a 5000 seguidores en 6 meses, publicamos 4 veces por semana, nuestro público es de 25 a 40 años, y el estilo es cálido y artesanal, con fotos naturales.",
];

describe("ProfileChatAgent — simulación cafetería (Café Aurora)", () => {
  it("mapea la conversación completa a los campos del ChannelProfile", async () => {
    let call = 0;
    vi.mocked(intelligenceModel.generateStructured).mockImplementation(async (_req: any, schemaFactory: () => any) => {
      const scripted = SCRIPT[call++];
      const base = schemaFactory();
      const merged = mergeAiStructuredOutput(base, {
        assistantMessage: scripted.assistantMessage,
        extractedFields: scripted.extractedFields ?? {},
        proposedFields: scripted.proposedFields ?? {},
        proposedCompetitors: scripted.proposedCompetitors ?? [],
      });
      return { data: merged, raw: JSON.stringify(merged) };
    });

    const agent = new ProfileChatAgent();
    const currentProfile = emptyProfile();
    let history: ProfileChatMessage[] = [];
    let draft: Record<string, unknown> = { ...currentProfile };
    const competitors: ProposedCompetitor[] = [];
    let done = false;

    // Kickoff turn (no user message yet)
    let turn = await agent.run({
      tenantId: currentProfile.tenantId,
      saasId: currentProfile.saasId,
      accountType: "empresa",
      currentProfile,
      history,
      userMessage: null,
    });
    history = [...history, { role: "assistant", content: turn.assistantMessage }];

    for (const answer of USER_ANSWERS) {
      history = [...history, { role: "user", content: answer }];
      turn = await agent.run({
        tenantId: currentProfile.tenantId,
        saasId: currentProfile.saasId,
        accountType: "empresa",
        currentProfile,
        history,
        userMessage: answer,
      });
      draft = applyPatch(applyPatch(draft, turn.extractedFields), turn.proposedFields);
      for (const c of turn.proposedCompetitors) {
        if (c?.name && !competitors.some((existing) => existing.name === c.name)) competitors.push(c);
      }
      history = [...history, { role: "assistant", content: turn.assistantMessage }];
      done = turn.done;
    }

    expect(call).toBe(SCRIPT.length);
    expect(done).toBe(true);

    // The entity mapped by the plan for the "competitors" block — a separate ChannelCompetitor[]
    // list, not ChannelProfile fields — is asserted here alongside the field patch.
    const finalOutput = { profile: draft, competitors };
    console.log("SIMULATE_PROFILE_CHAT_CAFETERIA_RESULT", JSON.stringify(finalOutput, null, 2));

    expect(draft.brandName).toBe("Café Aurora");
    expect(draft.niche).toBe("cafetería de especialidad");
    expect(draft.subniches).toEqual(["tueste propio", "brunch de especialidad", "repostería artesanal"]);
    expect(draft.audienceDescription).toMatch(/25 a 40 años/);
    expect(draft.products).toContain("café de especialidad en grano");
    expect(draft.avgPrice).toBe(3.5);
    expect(draft.baseHashtags).toContain("#cafedeespecialidad");
    expect(draft.growthGoalFollowers).toBe(5000);
    expect(draft.postingFrequency).toBe(4);
    expect(competitors.map((c) => c.name)).toEqual(["Toma Café", "Blend Station"]);
  });
});
