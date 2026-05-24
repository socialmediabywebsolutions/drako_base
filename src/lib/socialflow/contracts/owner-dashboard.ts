import {
  getSocialConversionSnapshot,
  getSocialOwnerSummary,
  resolveSocialContext,
  type SocialOwnerSummary,
} from "@/lib/socialflow/repository";
import type { DracoEnv } from "@/lib/cf";
import type { SocialConversionSnapshot } from "@/lib/social-core/types";

export type SocialOwnerDashboardSnapshot = {
  ownerSummary: SocialOwnerSummary;
  conversionSummary: SocialConversionSnapshot;
};

export async function getSocialOwnerDashboardSnapshot(input: {
  tenantId: string;
  saasId: string;
  env?: DracoEnv | null;
}): Promise<SocialOwnerDashboardSnapshot> {
  const socialCtx = await resolveSocialContext({
    tenantId: input.tenantId,
    saasId: input.saasId,
    env: input.env,
  });
  const [ownerSummary, conversionSummary] = await Promise.all([
    getSocialOwnerSummary(socialCtx),
    getSocialConversionSnapshot(socialCtx),
  ]);

  return { ownerSummary, conversionSummary };
}

export type { SocialOwnerSummary };
