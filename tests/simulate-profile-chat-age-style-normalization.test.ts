import { describe, expect, it, vi } from "vitest";
import type { ChannelProfile } from "@/lib/socialflow/profile/types";

// Regression test for a bug report: the "goals" block's ageRange/contentStyle dropdowns stayed on
// "Sin especificar" in the final review even when the user clearly stated an age range or visual
// style, because the model's free-text answer ("25 a 35 años", "colorido y cercano") never
// exactly matched the <select>'s literal option values ("25-35", "colorido"). ProfileChatAgent now
// normalizes both fields after the model call — this test mocks a realistic free-text LLM
// response (not already-normalized) and asserts the agent maps it to the exact dropdown values.
vi.mock("@/lib/socialflow/ai/models/anthropicModel", () => ({
  intelligenceModel: { generateStructured: vi.fn() },
}));

import { intelligenceModel } from "@/lib/socialflow/ai/models/anthropicModel";
import { mergeAiStructuredOutput } from "@/lib/socialflow/ai/models/localModel";
import { ProfileChatAgent } from "@/lib/socialflow/ai/agents/ProfileChatAgent";

// All blocks except "goals" are already complete, so the agent treats this turn as answering the
// goals question and finishing the conversation (done: true) — matching how a user would reach
// this point after already filling identity/niche/audience/business/competitors.
function profileMissingOnlyGoals(): ChannelProfile {
  const now = new Date().toISOString();
  return {
    id: "sf_profile_test", tenantId: "test-tenant", saasId: "socialflow", channelId: "test-channel",
    brandName: "Marca de Prueba", channelName: "", websiteUrl: "", activeSocialNetworks: [], onboardingCompletedAt: null,
    shortDescription: "Una marca de prueba", longDescription: "", mission: "", valueProposition: "", toneOfVoice: "cercano", personality: "",
    primaryLanguage: "es", targetCountry: "", targetMarkets: [],
    niche: "marketing digital", subniches: ["contenido"], mainTopics: [], secondaryTopics: [], viralThemes: [], trendingTopics: [],
    seasonalTopics: [], forbiddenTopics: [], allowedTopics: [],
    audienceDescription: "emprendedores", buyerPersona: "", painPoints: ["falta de tiempo"], desires: [], objections: [],
    awarenessLevel: "", audienceLanguage: "", audienceStyle: "",
    products: ["asesoría"], services: [], offers: [], avgPrice: null, transformations: [], differentiators: [],
    primaryCTA: "", secondaryCTAs: [],
    baseKeywords: [], priorityKeywords: [], longTailKeywords: [], baseHashtags: [], priorityHashtags: [], competitorHashtags: ["#ejemplo"],
    contentPillars: [], preferredFormats: [], avoidedFormats: [], postingFrequencyGoal: "",
    marketSignals: [], opportunitySignals: [], demandSignals: [], audienceQuestions: [], recurringObjections: [],
    industryTrends: [], prohibitedClaims: [], bannedWords: [], forbiddenAngles: [],
    complianceNotes: "", brandSafetyRules: "", assetSummary: null,
    ageRange: null, gender: null, growthGoalFollowers: null, growthGoalTimeline: null, contentStyle: null, postingFrequency: null,
    createdAt: now, updatedAt: now,
  };
}

describe("ProfileChatAgent — normalización de rango de edad y estilo visual", () => {
  it('mapea "25 a 35 años" y "colorido y cercano" a los valores exactos del desplegable', async () => {
    vi.mocked(intelligenceModel.generateStructured).mockImplementation(async (_req: any, schemaFactory: () => any) => {
      const base = schemaFactory();
      const merged = mergeAiStructuredOutput(base, {
        assistantMessage: "¡Gracias! Ya tengo todo lo que necesito. Vamos a revisar el resumen completo antes de guardar.",
        extractedFields: {
          // Deliberately realistic free text, not already one of the <select> option values —
          // this is exactly the shape of answer that used to leave the dropdowns unset.
          ageRange: "25 a 35 años",
          contentStyle: "colorido y cercano",
          growthGoalFollowers: 3000,
          growthGoalTimeline: "6 meses",
          postingFrequency: 3,
        },
        proposedFields: {},
        proposedCompetitors: [],
      });
      return { data: merged, raw: JSON.stringify(merged) };
    });

    const profile = profileMissingOnlyGoals();
    const turn = await new ProfileChatAgent().run({
      tenantId: profile.tenantId,
      saasId: profile.saasId,
      accountType: "influencer",
      currentProfile: profile,
      history: [{ role: "assistant", content: "Para terminar: ¿tienes un objetivo de seguidores y plazo, con qué frecuencia publicas, a qué rango de edad te diriges, y qué estilo visual predomina en tu contenido?" }],
      userMessage: "Me dirijo a personas de 25 a 35 años, y mi estilo visual es colorido y cercano.",
    });

    expect(turn.done).toBe(true);
    expect(turn.blockKey).toBe("goals");
    expect(turn.extractedFields.ageRange).toBe("25-35");
    expect(turn.extractedFields.contentStyle).toBe("colorido");
    // Both values needed best-effort mapping (neither was already a literal dropdown value), so
    // the assistant message should flag it for the user to double-check in the review screen.
    expect(turn.assistantMessage).toMatch(/rango de edad.*25-35/);
    expect(turn.assistantMessage).toMatch(/estilo visual.*colorido/);
  });

  it('deja el campo sin mapear si no hay señal reconocible, en vez de adivinar', async () => {
    vi.mocked(intelligenceModel.generateStructured).mockImplementation(async (_req: any, schemaFactory: () => any) => {
      const base = schemaFactory();
      const merged = mergeAiStructuredOutput(base, {
        assistantMessage: "¡Gracias! Ya tengo todo lo que necesito.",
        extractedFields: { contentStyle: "no lo tengo muy definido todavía" },
        proposedFields: {},
        proposedCompetitors: [],
      });
      return { data: merged, raw: JSON.stringify(merged) };
    });

    const profile = profileMissingOnlyGoals();
    const turn = await new ProfileChatAgent().run({
      tenantId: profile.tenantId,
      saasId: profile.saasId,
      accountType: "influencer",
      currentProfile: profile,
      history: [{ role: "assistant", content: "..." }],
      userMessage: "No tengo muy definido el estilo visual todavía.",
    });

    expect(turn.extractedFields.contentStyle).toBeNull();
    expect(turn.assistantMessage).not.toMatch(/estilo visual/);
  });
});
