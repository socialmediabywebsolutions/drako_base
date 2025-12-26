import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import type { DracoEnv } from "@/lib/cf";

export type AiProvisioningResult = {
  status: "SUCCESS";
  profile: {
    tier: "COST_SAVER" | "BALANCED" | "PREMIUM";
    preferredProviders: string[];
  };
};

function resolveProviders(tier: AiProvisioningResult["profile"]["tier"]): string[] {
  if (tier === "PREMIUM") return ["FIREWORKS", "GEMINI", "OPENAI"];
  if (tier === "BALANCED") return ["FIREWORKS", "DEEPSEEK"];
  return ["DEEPSEEK", "LOCAL"];
}

export function recommendAiProfileForBlueprint(blueprint: SaasBlueprintDraft): AiProvisioningResult {
  let tier = blueprint.aiProfile.tier;
  if (blueprint.verticalId === "CRYPTO") tier = "PREMIUM";

  return {
    status: "SUCCESS",
    profile: {
      tier,
      preferredProviders: resolveProviders(tier),
    },
  };
}

export async function materializeAiConfigForSaas(params: {
  env?: DracoEnv | null;
  saasId: string;
  blueprint: SaasBlueprintDraft;
}): Promise<AiProvisioningResult> {
  const profile = recommendAiProfileForBlueprint(params.blueprint);
  // TODO: persist per-SaaS AI profile when a dedicated table is available.
  return profile;
}
