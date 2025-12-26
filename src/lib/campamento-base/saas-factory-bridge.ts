import type { SaasBlueprintDraft, SaasVerticalId } from "@/lib/campamento-base/saas-factory-types";
import { withCampamentoBaseProfile } from "@/lib/campamento-base/saas-factory-helpers";

function inferVertical(transcript: string, hint?: string): SaasVerticalId {
  const text = `${transcript} ${hint ?? ""}`.toLowerCase();
  if (text.includes("peluquer") || text.includes("salon") || text.includes("barber")) return "SALON";
  if (text.includes("clinica") || text.includes("clinic") || text.includes("dent")) return "CLINIC";
  if (text.includes("groom") || text.includes("mascota")) return "PET_GROOMING";
  if (text.includes("lavander")) return "LAUNDRY";
  if (text.includes("cripto") || text.includes("crypto")) return "CRYPTO";
  if (text.includes("educacion") || text.includes("escuela")) return "EDUCATION";
  return "OTHER";
}

export function suggestSaasBlueprintFromInterview(input: {
  transcript: string;
  verticalHint?: string;
  goals?: string[];
}): SaasBlueprintDraft {
  const verticalId = inferVertical(input.transcript, input.verticalHint);
  const goals = (input.goals ?? []).map((goal) => goal.toLowerCase());
  const wantsMarketing = goals.some((goal) => goal.includes("citas") || goal.includes("clientes"));
  const lowBudget = goals.some((goal) => goal.includes("bajo presupuesto") || goal.includes("barato"));

  return withCampamentoBaseProfile({
    ownerTenantId: "demo-tenant",
    saasName: "Nuevo SaaS",
    proposedSlug: "nuevo-saas",
    proposedSubdomain: "nuevo-saas",
    verticalId,
    summary: "Blueprint inicial sugerido a partir de entrevista.",
    targetAudience: "Clientes del vertical seleccionado",
    mainProblem: "Falta de automatizacion y control operativo",
    mainGoal: "Aumentar ingresos y eficiencia",
    packsByDepartment: {
      marketing: wantsMarketing ? "STANDARD" : "BASIC",
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
      tier: lowBudget ? "COST_SAVER" : "BALANCED",
      notes: lowBudget ? "Cliente sensible a coste" : "Perfil estandar",
    },
    knowledgeSeeds: [
      { type: "BUSINESS_INFO", description: "Descripcion general del negocio" },
      { type: "SERVICES", description: "Listado de servicios principales" },
    ],
    initialFeatures: [],
    interviewSummary: input.transcript.slice(0, 280),
  });
}
