import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import type { SaasBlueprintDraft, SaasVerticalId } from "@/lib/campamento-base/saas-factory-types";
import { withCampamentoBaseProfile } from "@/lib/campamento-base/saas-factory-helpers";
export const runtime = "edge";


type ChatPayload = {
  message?: string;
  blueprint?: SaasBlueprintDraft | null;
};

const VERTICAL_RULES: Array<{ id: SaasVerticalId; keywords: string[]; label: string }> = [
  { id: "SALON", keywords: ["peluquer", "salon", "barber"], label: "salon" },
  { id: "CLINIC", keywords: ["clinica", "clinic", "dent"], label: "clinica" },
  { id: "PET_GROOMING", keywords: ["groom", "mascota", "perro"], label: "grooming" },
  { id: "LAUNDRY", keywords: ["lavander", "laundry"], label: "lavanderia" },
  { id: "EDUCATION", keywords: ["educacion", "escuela", "academia"], label: "educacion" },
  { id: "CRYPTO", keywords: ["cripto", "crypto", "blockchain"], label: "cripto" },
];

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

function applyTierUpdates(message: string, blueprint: SaasBlueprintDraft, changes: string[]) {
  const tierMarkers = [
    { key: "BASIC", tokens: ["basic", "basico"] },
    { key: "STANDARD", tokens: ["standard", "estandar"] },
    { key: "FULL", tokens: ["full", "completo"] },
  ];

  const updatePackTier = (dept: "marketing" | "support" | "ops", label: string) => {
    for (const tier of tierMarkers) {
      if (message.includes(`${label} ${tier.tokens[0]}`) || tier.tokens.some((token) => message.includes(`${label} ${token}`))) {
        blueprint.packsByDepartment[dept] = tier.key as "BASIC" | "STANDARD" | "FULL";
        changes.push(`${label} -> ${tier.key}`);
        return;
      }
      if (message.includes(`${tier.tokens[0]} ${label}`) || tier.tokens.some((token) => message.includes(`${token} ${label}`))) {
        blueprint.packsByDepartment[dept] = tier.key as "BASIC" | "STANDARD" | "FULL";
        changes.push(`${label} -> ${tier.key}`);
        return;
      }
    }
  };

  updatePackTier("marketing", "marketing");
  updatePackTier("support", "soporte");
  updatePackTier("ops", "ops");

  if (message.includes("contabilidad") || message.includes("accounting")) {
    if (message.includes("full") || message.includes("completo")) {
      blueprint.packsByDepartment.accounting = "FULL";
      changes.push("contabilidad -> FULL");
    } else if (message.includes("basic") || message.includes("basico")) {
      blueprint.packsByDepartment.accounting = "BASIC";
      changes.push("contabilidad -> BASIC");
    }
  }

  if (message.includes("tax") || message.includes("fiscal") || message.includes("impuestos")) {
    if (message.includes("full") || message.includes("completo")) {
      blueprint.packsByDepartment.tax = "FULL";
      changes.push("tax -> FULL");
    } else if (message.includes("basic") || message.includes("basico")) {
      blueprint.packsByDepartment.tax = "BASIC";
      changes.push("tax -> BASIC");
    }
  }

  if (message.includes("email") || message.includes("intake") || message.includes("whatsapp")) {
    if (message.includes("full") || message.includes("completo")) {
      blueprint.packsByDepartment.emailIntake = "FULL";
      changes.push("email intake -> FULL");
    } else if (message.includes("basic") || message.includes("basico")) {
      blueprint.packsByDepartment.emailIntake = "BASIC";
      changes.push("email intake -> BASIC");
    }
  }
}

function applyAiTierUpdates(message: string, blueprint: SaasBlueprintDraft, changes: string[]) {
  if (message.includes("poco presupuesto") || message.includes("barato") || message.includes("low cost")) {
    blueprint.aiProfile.tier = "COST_SAVER";
    const baseProfile = withCampamentoBaseProfile(blueprint).campamentoBaseProfile!;
    blueprint.campamentoBaseProfile = {
      ...baseProfile,
      ownerPricingIntent: "LOW_COST",
    };
    changes.push("IA -> COST_SAVER");
    return;
  }
  if (message.includes("premium") || message.includes("alta calidad")) {
    blueprint.aiProfile.tier = "PREMIUM";
    const baseProfile = withCampamentoBaseProfile(blueprint).campamentoBaseProfile!;
    blueprint.campamentoBaseProfile = {
      ...baseProfile,
      ownerPricingIntent: "PREMIUM",
    };
    changes.push("IA -> PREMIUM");
    return;
  }
  if (message.includes("balance") || message.includes("equilibr")) {
    blueprint.aiProfile.tier = "BALANCED";
    const baseProfile = withCampamentoBaseProfile(blueprint).campamentoBaseProfile!;
    blueprint.campamentoBaseProfile = {
      ...baseProfile,
      ownerPricingIntent: "BALANCED",
    };
    changes.push("IA -> BALANCED");
  }
}

function applyPricing(message: string, blueprint: SaasBlueprintDraft, changes: string[]) {
  const priceMatch = message.match(/(\d{2,5})(?:\s?€|\s?euros|\s?\/mes|\s?al mes)?/);
  if (priceMatch && message.includes("precio")) {
    const value = Number(priceMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      blueprint.initialPricing.currentMonthlyPrice = value;
      changes.push(`precio -> ${value} EUR/mes`);
    }
  }
}

function applySummary(message: string, blueprint: SaasBlueprintDraft, changes: string[], verticalLabel: string | null) {
  const audienceMatch = message.match(/para\s+([a-z0-9\s]+?)(?:\.|,|$)/);
  if (audienceMatch && audienceMatch[1]) {
    blueprint.targetAudience = audienceMatch[1].trim();
    changes.push(`audiencia -> ${blueprint.targetAudience}`);
  }
  if (message.includes("objetivo")) {
    const goalMatch = message.match(/objetivo\s*:?\s*([a-z0-9\s]+?)(?:\.|,|$)/);
    if (goalMatch?.[1]) {
      blueprint.mainGoal = goalMatch[1].trim();
      changes.push(`objetivo -> ${blueprint.mainGoal}`);
    }
  }
  if (message.includes("problema")) {
    const problemMatch = message.match(/problema\s*:?\s*([a-z0-9\s]+?)(?:\.|,|$)/);
    if (problemMatch?.[1]) {
      blueprint.mainProblem = problemMatch[1].trim();
      changes.push(`problema -> ${blueprint.mainProblem}`);
    }
  }
  if (!changes.length && verticalLabel) {
    blueprint.summary = `SaaS ${verticalLabel} preparado por Campamento Base.`;
  }
}

function applyVertical(message: string, blueprint: SaasBlueprintDraft, changes: string[]): string | null {
  for (const rule of VERTICAL_RULES) {
    if (rule.keywords.some((keyword) => message.includes(keyword))) {
      blueprint.verticalId = rule.id;
      changes.push(`vertical -> ${rule.id}`);
      return rule.label;
    }
  }
  return null;
}

function applyName(message: string, blueprint: SaasBlueprintDraft, changes: string[]) {
  const quoted = message.match(/"([^"]+)"/);
  if (quoted?.[1]) {
    blueprint.saasName = quoted[1].trim();
    changes.push(`nombre -> ${blueprint.saasName}`);
    return;
  }
  const named = message.match(/nombre\s*:?\s*([a-z0-9\s-]+)/);
  if (named?.[1]) {
    const name = named[1].trim();
    if (name.length >= 3) {
      blueprint.saasName = name;
      changes.push(`nombre -> ${blueprint.saasName}`);
    }
  }
}

function updateBlueprintFromMessage(message: string, blueprint: SaasBlueprintDraft): { reply: string; blueprint: SaasBlueprintDraft } {
  const normalized = normalizeMessage(message);
  const changes: string[] = [];

  applyName(normalized, blueprint, changes);
  const verticalLabel = applyVertical(normalized, blueprint, changes);
  applyTierUpdates(normalized, blueprint, changes);
  applyAiTierUpdates(normalized, blueprint, changes);
  applyPricing(normalized, blueprint, changes);
  applySummary(normalized, blueprint, changes, verticalLabel);

  if (!changes.length) {
    return {
      reply: "No detecte cambios concretos. Indica vertical, packs o pricing para ajustar el blueprint.",
      blueprint: withCampamentoBaseProfile(blueprint),
    };
  }

  return {
    reply: `He actualizado: ${changes.join(", ")}.`,
    blueprint: withCampamentoBaseProfile(blueprint),
  };
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as ChatPayload | null;
    if (!body?.message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    const blueprint = body.blueprint ?? buildDefaultBlueprint(tenantId);
    blueprint.ownerTenantId = blueprint.ownerTenantId || tenantId;

    const { reply, blueprint: nextBlueprint } = updateBlueprintFromMessage(body.message, blueprint);

    return NextResponse.json({ reply, blueprint: nextBlueprint });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("SAAS_FACTORY_CHAT_ERROR", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
