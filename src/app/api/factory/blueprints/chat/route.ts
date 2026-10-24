import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { resolveTenantId } from "@/lib/tenants/services";
import type { SaasBlueprintDraft } from "@/lib/factory/contracts/blueprints";
import { withCampamentoBaseProfile } from "@/lib/factory/blueprint-profile";
import { runAi } from "@/lib/ai/client";
import { getAllTemplates } from "@/lib/factory/templates/marketplace";
import {
  buildAdvancedSystemPrompt,
  buildDrakoPartnerSystemPrompt,
  parseBlueprintResponse,
  inferVertical,
  analyzeCompetitors,
  type ChatMessage,
} from "@/lib/factory/ai-blueprint/prompts";
import { type BusinessIntelligence, saveBusinessKnowledge } from "@/lib/factory/bi/knowledge-base";
import { InterviewOrchestrator, type InterviewPhase } from "@/lib/interviews/orchestrator";

export const dynamic = "force-dynamic";

type ChatPayload = {
  message?: string;
  blueprint?: SaasBlueprintDraft | null;
  history?: { role: "user" | "assistant"; content: string }[];
  mode?: "partner" | "factory";
  companyId?: string;
  currentPhase?: number;
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

    if (body.mode === "partner") {
      tenantId = resolveTenantId(req, { fallbackTenantId: null });
      if (!tenantId) {
        throw new UnauthorizedError("TENANT_CONTEXT_REQUIRED", 401);
      }
    } else {
      // Factory mode requires full access
      const access = await requireTenantAccess(req);
      tenantId = access.tenantId;
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
    const initialPhase = (body.currentPhase ?? 0) as InterviewPhase;
    const systemPrompt = body.mode === "partner"
      ? buildDrakoPartnerSystemPrompt(initialPhase)
      : buildAdvancedSystemPrompt(context);

    // Prepare full message chain for context-aware AI
    const messagesForAi: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      // Inject history (excluding the very last duplicate message if constructed above)
      // ROLLUP STRATEGY: Keep only the tail (last 15 msgs) to prevent context overflow.
      // Long-term memory is preserved in the 'currentBlueprint' JSON injected below.
      ...conversationHistory.slice(0, -1).slice(-15).map(h => ({
        role: h.role,
        content: h.content
      })),
      // Add the current context-augmented user message
      {
        role: "user",
        content: `CONTEXTO DEL PROYECTO ACTUAL (BLUEPRINT JSON):\n${JSON.stringify(currentBlueprint, null, 2)}\n\nMENSAJE DEL USUARIO ACTUAL: "${body.message}"\n\nINSTRUCCIÓN CRÍTICA: Responde continuando la conversación de forma natural, basándote en el historial previo y avanzando el progreso si corresponde. Responde SIEMPRE con el JSON estructurado.`,
      },
    ];

    // Call AI with Llama 3.1 70B (smart mode)
    const response = await runAi({
      mode: "smart",
      tenantId,
      messages: messagesForAi,
    });

    if (!response.ok || !response.content) {
      throw new Error("AI did not return a valid response.");
    }

    // Parse with v2 robust parser
    const parsed = parseBlueprintResponse(response.content);

    // Check if we have a valid response
    if (!parsed || (!parsed.entitlements && body.mode !== "partner")) {
      return NextResponse.json({
        reply: "No pude entender tu solicitud completamente. ¿Podrías darme más detalles?",
        blueprint: currentBlueprint,
      });
    }

    // --- PHASE ORCHESTRATION (Hard Validation) ---
    let orchestratedPhase = initialPhase;
    if (body.mode === "partner") {
      const sanitizedAiPhase = typeof parsed.currentPhase === 'number' ? parsed.currentPhase : initialPhase;
      orchestratedPhase = InterviewOrchestrator.calculateNextPhase(
        initialPhase,
        parsed.detectedKnowledge,
        sanitizedAiPhase
      );

      // LOG for debugging (Antigravity)
      console.log(`[FactoryChat] Mode: Partner | Initial: ${initialPhase} | AI Suggested: ${sanitizedAiPhase} | Orchestrated: ${orchestratedPhase}`);
    }

    // 4. Map v2 response to legacy blueprint format with industrial precision
    const packs = parsed.entitlements?.packs || [];

    const updatedBlueprint: SaasBlueprintDraft = {
      ...currentBlueprint,
      ownerTenantId: tenantId,
      saasName: parsed.understanding || currentBlueprint.saasName,
      summary: parsed.marketingCopy?.tagline || currentBlueprint.summary,
      initialPricing: {
        ...currentBlueprint.initialPricing,
        currentMonthlyPrice: parsed.pricing.monthly,
      },
      // Map packs to all departments dynamically
      packsByDepartment: {
        marketing: packs.includes("marketing") ? "FULL" : packs.includes("social_media") ? "STANDARD" : "BASIC",
        accounting: packs.includes("accounting") ? "FULL" : "BASIC",
        support: packs.includes("support") ? "STANDARD" : "BASIC",
        emailIntake: packs.includes("email_intake") ? "FULL" : "BASIC",
        ops: packs.includes("ops") ? "STANDARD" : "BASIC",
        tax: packs.includes("tax") ? "FULL" : "BASIC",
      },
      // Transfer AI Profile if designated as premium
      aiProfile: {
        tier: packs.includes("neural_kernel") ? "PREMIUM" : "BALANCED"
      }
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
      if (parsed.suggestedTemplate && (parsed.currentPhase || 0) >= 5) {
        reply += `📋 **Template sugerido:** ${parsed.suggestedTemplate}\n`;
      }

      if (parsed.pricing && parsed.pricing.monthly > 0) {
        reply += `💰 **Precio recomendado:** $${parsed.pricing.monthly}/mes ($${parsed.pricing.yearly}/año)\n`;
        reply += `_${parsed.pricing.rationale}_\n\n`;
      } else if (parsed.pricing && (parsed.currentPhase || 0) < 5) {
        // Silently log or handle low-phase conversation without showing budget
      }

      if (parsed.marketingCopy?.valueProps && parsed.marketingCopy.valueProps.length > 0 && (parsed.currentPhase || 0) >= 4) {
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
      // Extended v2 data
      v2: {
        fullAnalysis: {
          ...parsed,
          currentPhase: orchestratedPhase // Overwrite AI's guess with orchestrated reality
        },
        templates: templates.slice(0, 3).map((t) => ({
          id: t.id,
          skipCache: !req.cache,
          name: t.name,
          slug: t.slug,
        })) as unknown,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const errorMessage = error instanceof Error ? error.message : "Internal error processing AI request";
    console.error("SAAS_FACTORY_CHAT_ERROR", error);
    return NextResponse.json({ error: errorMessage }, { status: errorMessage === "DRAKO_AI_NOT_AVAILABLE" ? 503 : 500 });
  }
}
