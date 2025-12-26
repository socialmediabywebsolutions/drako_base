import type { AiTier, SaasBlueprintDraft, SaasVerticalId } from "@/lib/campamento-base/saas-factory-types";
import type { AgentPackTier, DepartmentId } from "@/lib/agents/agent-templates";

function resolveAiStrategy(tier: AiTier): "COST_OPTIMIZED" | "BALANCED" | "QUALITY_FOCUSED" {
  if (tier === "COST_SAVER") return "COST_OPTIMIZED";
  if (tier === "PREMIUM") return "QUALITY_FOCUSED";
  return "BALANCED";
}

const DEPARTMENTS: DepartmentId[] = ["MARKETING", "ACCOUNTING", "SUPPORT", "EMAIL_INTAKE", "OPS", "TAX"];

function resolveVerticalDefaults(verticalId: SaasVerticalId): {
  departmentsEnabled: DepartmentId[];
  packsByDepartment: Partial<Record<DepartmentId, AgentPackTier>>;
} {
  if (verticalId === "SALON") {
    return {
      departmentsEnabled: ["MARKETING", "ACCOUNTING"],
      packsByDepartment: {
        MARKETING: "STANDARD",
        ACCOUNTING: "BASIC",
      },
    };
  }
  return {
    departmentsEnabled: ["MARKETING", "SUPPORT"],
    packsByDepartment: {
      MARKETING: "BASIC",
      SUPPORT: "BASIC",
    },
  };
}

function normalizePackTierForAccounting(tier?: AgentPackTier): "BASIC" | "FULL" | undefined {
  if (!tier) return undefined;
  return tier === "FULL" ? "FULL" : "BASIC";
}

export function normalizeCampamentoBaseProfileForBlueprint(
  blueprint: SaasBlueprintDraft,
  options?: { applyDefaults?: boolean },
): SaasBlueprintDraft {
  const applyDefaults = options?.applyDefaults ?? true;
  const existing = blueprint.campamentoBaseProfile;
  const aiTier = blueprint.aiProfile.tier;
  const verticalDefaults = resolveVerticalDefaults(blueprint.verticalId);

  const derivedPacks: Partial<Record<DepartmentId, AgentPackTier>> = {
    MARKETING: blueprint.packsByDepartment.marketing,
    ACCOUNTING: blueprint.packsByDepartment.accounting,
    SUPPORT: blueprint.packsByDepartment.support,
    EMAIL_INTAKE: blueprint.packsByDepartment.emailIntake ?? blueprint.packsByDepartment.support,
    OPS: blueprint.packsByDepartment.ops ?? blueprint.packsByDepartment.support,
    TAX: blueprint.packsByDepartment.tax ?? blueprint.packsByDepartment.accounting,
  };

  let departmentsEnabled = existing?.departmentsEnabled?.length ? existing.departmentsEnabled : [];
  let packsByDepartment: Partial<Record<DepartmentId, AgentPackTier>> = {
    ...derivedPacks,
    ...(existing?.packsByDepartment ?? {}),
  };

  if (departmentsEnabled.length === 0) {
    if (applyDefaults) {
      departmentsEnabled = verticalDefaults.departmentsEnabled;
      packsByDepartment = { ...packsByDepartment, ...verticalDefaults.packsByDepartment };
    } else {
      departmentsEnabled = DEPARTMENTS.filter((dept) => Boolean(packsByDepartment[dept]));
    }
  }

  if (applyDefaults) {
    for (const dept of departmentsEnabled) {
      if (!packsByDepartment[dept]) {
        packsByDepartment[dept] = verticalDefaults.packsByDepartment[dept] ?? "BASIC";
      }
    }
  }

  return {
    ...blueprint,
    packsByDepartment: {
      marketing: packsByDepartment.MARKETING ?? blueprint.packsByDepartment.marketing,
      accounting: normalizePackTierForAccounting(packsByDepartment.ACCOUNTING) ?? blueprint.packsByDepartment.accounting,
      support: packsByDepartment.SUPPORT ?? blueprint.packsByDepartment.support,
      emailIntake: normalizePackTierForAccounting(packsByDepartment.EMAIL_INTAKE) ?? blueprint.packsByDepartment.emailIntake,
      ops: packsByDepartment.OPS ?? blueprint.packsByDepartment.ops,
      tax: normalizePackTierForAccounting(packsByDepartment.TAX) ?? blueprint.packsByDepartment.tax,
    },
    campamentoBaseProfile: {
      departmentsEnabled,
      packsByDepartment,
      ownerPricingIntent: existing?.ownerPricingIntent ?? "BALANCED",
      aiProfile: {
        preferredTier: existing?.aiProfile?.preferredTier ?? aiTier,
        strategy: existing?.aiProfile?.strategy ?? resolveAiStrategy(aiTier),
      },
    },
  };
}

export function withCampamentoBaseProfile(blueprint: SaasBlueprintDraft): SaasBlueprintDraft {
  return normalizeCampamentoBaseProfileForBlueprint(blueprint, { applyDefaults: true });
}
