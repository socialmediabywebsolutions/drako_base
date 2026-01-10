import type { DracoEnv } from "@/lib/cf";
import { getCompanyFeatures, type CompanyFeaturesResult } from "@/lib/features/repository";
import type { SaasFeature } from "@/lib/features/types";
import { getCompanyPacks, listSaasPacks, type CompanyPacksResult } from "@/lib/packs/repository";
import type { SaasPackDefinition } from "@/lib/packs/types";

export type ResolveCompanyFeaturePackContextInput = {
  tenantId: string;
  companyId?: string | null;
  fallbackSaasId?: string | null;
  env: DracoEnv | null;
  featureFetcher?: typeof getCompanyFeatures;
  packFetcher?: typeof getCompanyPacks;
  packFallback?: typeof listSaasPacks;
};

export type ResolvedCompanyFeaturePackContext = {
  features?: SaasFeature[];
  packs?: SaasPackDefinition[];
  resolvedSaasId: string | null;
  errors: string[];
  featureResult?: CompanyFeaturesResult | null;
  packResult?: CompanyPacksResult | null;
};

export async function resolveCompanyFeaturePackContext({
  tenantId,
  companyId,
  fallbackSaasId,
  env,
  featureFetcher = getCompanyFeatures,
  packFetcher = getCompanyPacks,
  packFallback = listSaasPacks,
}: ResolveCompanyFeaturePackContextInput): Promise<ResolvedCompanyFeaturePackContext> {
  const errors: string[] = [];
  const hasIdentifiers = Boolean((companyId && companyId.trim()) || (fallbackSaasId && fallbackSaasId.trim()));

  if (!hasIdentifiers) {
    return { features: undefined, packs: packFallback(), resolvedSaasId: null, errors, featureResult: null, packResult: null };
  }

  let featureResult: CompanyFeaturesResult | null = null;
  let packResult: CompanyPacksResult | null = null;
  let resolvedSaasId: string | null = null;

  try {
    featureResult = await featureFetcher({ tenantId, companyId, saasId: fallbackSaasId, env });
    resolvedSaasId = featureResult.resolvedSaasId ?? resolvedSaasId;
  } catch {
    errors.push("company features query failed");
    featureResult = null;
  }

  try {
    packResult = await packFetcher({
      tenantId,
      companyId,
      saasId: fallbackSaasId,
      env,
      featureResult: featureResult ?? undefined,
    });
    resolvedSaasId = packResult.resolvedSaasId ?? resolvedSaasId;
  } catch {
    errors.push("company packs query failed");
    packResult = null;
  }

  const packs = packResult?.items ?? packFallback();
  const features = featureResult?.items;

  return {
    features,
    packs,
    resolvedSaasId,
    errors,
    featureResult,
    packResult,
  };
}
