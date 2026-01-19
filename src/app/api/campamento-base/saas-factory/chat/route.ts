import { NextResponse } from "next/server";
import { getSession, requireTenantAccess, UnauthorizedError, type SessionData } from "@/lib/auth/session";
import { resolveTenantId } from "@/lib/tenants/services";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { withCampamentoBaseProfile } from "@/lib/campamento-base/saas-factory-helpers";
import { runAi } from "@/lib/ai/client";
import { getAllTemplates } from "@/lib/campamento-base/templates/marketplace";
import {
  buildAdvancedSystemPrompt,
  buildDrakoPartnerSystemPrompt,
  parseBlueprintResponse,
  inferVertical,
  analyzeCompetitors,
  type ChatMessage,
} from "@/lib/campamento-base/ai-blueprint-v2/prompts";
import { type BusinessIntelligence, saveBusinessKnowledge } from "@/lib/campamento-base/bi/knowledge-base";

export const runtime = "edge";

type ChatPayload = {
  message?: string;
  blueprint?: SaasBlueprintDraft | null;
  history?: { role: "user" | "assistant"; content: string }[];
  mode?: "partner" | "factory";
  companyId?: string;
};

// Available packs (simplified list)
const AVAILABLE_PACKS = [
  "crm",
  "support",
  "marketing",
  "social_media",
  "accounting",
  "tax",
  "email_intake",
  "knowledge",
  "ecommerce",
  "education",
  "community",
  "projects",
];


function buildDefaultBlueprint(tenantId: string): SaasBlueprintDraft {
  return withCampamentoBaseProfile({
    ownerTenantId: tenantId,
    saasName: "Nuevo SaaS",
    proposedSlug: "nuevo-saas",
    proposedSubdomain: "nuevo-saas",
    verticalId: "OTHER",
    summary: "Blueprint inicial definido por Campamento Base.",
    targetAudience: "Clientes del vertical seleccionado",
    mainProblem: "Operacion dispersa",
    mainGoal: "Eficiencia y crecimiento",
    packsByDepartment: {
      marketing: "STANDARD",
      accounting: "BASIC",
      support: "BASIC",
      emailIntake: "BASIC",
      ops: "BASIC",
      tax: "BASIC",
    },
    initialPricing: {
      currentMonthlyPrice: 0,
      estimatedVendorCostMonthly: null,
      recommendedMinPriceMonthly: null,
      recommendedTargetPriceMonthly: null,
      recommendedStretchPriceMonthly: null,
    },
    aiProfile: {
      tier: "BALANCED",
    },
    knowledgeSeeds: [],
    initialFeatures: [],
    interviewSummary: "",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatPayload;

    // Relaxation: If mode is 'partner', we allow guest access using the resolved tenantId (defaults to demo)
    let tenantId: string;
    let sessionData: SessionData | null = null;

    if (body.mode === "partner") {
      tenantId = resolveTenantId(req);
      // Try to get session if it exists, but don't fail if null
      await getSession(req);
    } else {
      // Factory mode requires full access
      const access = await requireTenantAccess(req);
      tenantId = access.tenantId;
      sessionData = access.session;
    }

    if (!body?.message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const currentBlueprint = body.blueprint || buildDefaultBlueprint(tenantId);
    currentBlueprint.ownerTenantId = currentBlueprint.ownerTenantId || tenantId;

    // Build conversation history
    const conversationHistory: ChatMessage[] = [
      ...(body.history || []).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: body.message },
    ];

    // Get templates for context
    const templates = await getAllTemplates({ featuredOnly: true }).catch(() => []);

    // Infer vertical and get competitor analysis
    const vertical = inferVertical(conversationHistory);
    const competitorData = vertical ? await analyzeCompetitors(vertical) : undefined;

    const context = {
      templates,
      vertical,
      availablePacks: AVAILABLE_PACKS,
      competitorData,
      conversationHistory,
    };

    // Build advanced system prompt with full context
    const systemPrompt = body.mode === "partner"
      ? buildDrakoPartnerSystemPrompt(context)
      : buildAdvancedSystemPrompt(context);

    // Call AI with Llama 3.1 70B (smart mode)
    const response = await runAi({
      mode: "smart",
      tenantId,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `CURRENT BLUEPRINT JSON:\n${JSON.stringify(currentBlueprint, null, 2)}\n\nUSER MESSAGE: "${body.message}"\n\nResponde con el JSON estructurado según las instrucciones.`,
        },
      ],
    });

    if (!response.ok || !response.content) {
      throw new Error("AI did not return a valid response.");
    }

    // Parse with v2 robust parser
    const parsed = parseBlueprintResponse(response.content);

    // Check if we have a valid response
    if (!parsed || !parsed.entitlements) {
      return NextResponse.json({
        reply: "No pude entender tu solicitud completamente. ¿Podrías darme más detalles?",
        blueprint: currentBlueprint,
      });
    }

    // Map v2 response to legacy blueprint format
    const updatedBlueprint: SaasBlueprintDraft = {
      ...currentBlueprint,
      ownerTenantId: tenantId, // Ensure tenantId is set
      saasName: parsed.understanding || currentBlueprint.saasName,
      summary: parsed.marketingCopy?.tagline || currentBlueprint.summary,
      initialPricing: {
        ...currentBlueprint.initialPricing,
        currentMonthlyPrice: parsed.pricing.monthly,
      },
      // Map packs to packsByDepartment (simplified mapping)
      packsByDepartment: {
        ...currentBlueprint.packsByDepartment,
        marketing: parsed.entitlements.packs.includes("marketing")
          ? "FULL"
          : parsed.entitlements.packs.includes("social_media")
            ? "STANDARD"
            : "BASIC",
        support: parsed.entitlements.packs.includes("support") ? "STANDARD" : "BASIC",
      },
    };

    const finalBlueprint = withCampamentoBaseProfile(updatedBlueprint);

    // Build conversational reply with roadmap if available
    let reply = parsed.reply || `✨ ${parsed.understanding}\n\n`;

    // Real-time Persistence for Drako Partner
    if (body.mode === "partner" && parsed.detectedKnowledge) {
      try {
        await saveBusinessKnowledge({
          tenantId: tenantId,
          companyId: body.companyId || `draft-${tenantId.slice(0, 8)}`,
          socialProfiles: parsed.detectedKnowledge.identity?.socialProfiles as BusinessIntelligence["socialProfiles"],
          location: { address: parsed.detectedKnowledge.identity?.address as string },
          operatingCosts: parsed.detectedKnowledge.finances as BusinessIntelligence["operatingCosts"],
          fiscalInfo: parsed.detectedKnowledge.identity?.fiscal as BusinessIntelligence["fiscalInfo"],
        });
      } catch (e) {
        console.error("BI_PERSISTENCE_ERROR", e);
      }
    }

    if (!parsed.reply) {
      if (parsed.suggestedTemplate) {
        reply += `📋 **Template sugerido:** ${parsed.suggestedTemplate}\n`;
      }

      if (parsed.pricing) {
        reply += `💰 **Precio recomendado:** $${parsed.pricing.monthly}/mes ($${parsed.pricing.yearly}/año)\n`;
        reply += `_${parsed.pricing.rationale}_\n\n`;
      }

      if (parsed.marketingCopy?.valueProps && parsed.marketingCopy.valueProps.length > 0) {
        reply += `🎯 **Value props:**\n`;
        parsed.marketingCopy.valueProps.forEach((vp) => {
          reply += `- ${vp}\n`;
        });
        reply += `\n`;
      }
    }

    return NextResponse.json({
      reply,
      blueprint: finalBlueprint,
      // Extended v2 data (optional, for advanced clients)
      v2: {
        fullAnalysis: parsed,
        templates: templates.slice(0, 3).map((t) => ({
          id: t.id,
          skipCache: !req.cache,
          name: t.name,
          slug: t.slug,
        })) as unknown, // Cast the array to unknown
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const errorMessage = error instanceof Error ? error.message : "Internal error processing AI request";
    console.error("SAAS_FACTORY_CHAT_ERROR", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
