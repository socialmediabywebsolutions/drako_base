import type { SaasFeatureCategory, SaasFeatureKey } from "@/lib/features/types";
import type { SaasFeature } from "@/lib/features/types";
import { getCompanyFeatures } from "@/lib/features/repository";
import type { CompanyFeaturesResult } from "@/lib/features/repository";
import type { SaasCatalogVertical, SaasPackDefinition } from "@/lib/packs/types";
import { SAAS_PACK_DEFINITIONS } from "@/lib/packs/definitions";
import type { SaasModuleCode } from "@/lib/blueprints/types";
import { resolveBlueprintsContext, listSaasModules, upsertSaasModule } from "@/lib/blueprints/repository";
import { resolveFeaturesContext, listSaasFeatures, upsertSaasFeature } from "@/lib/features/repository";
import type { DracoEnv } from "@/lib/cf";

type PackGuessInput = {
  businessType?: string | null;
  featureKeys?: string[];
  serviceNames?: string[];
};

const MODULE_DEFAULTS: Record<SaasModuleCode, { label: string; phase: number; importance: number }> = {
  ECONOMY: { label: "Economy Engine", phase: 2, importance: 3 },
  HR: { label: "HR & Compliance", phase: 2, importance: 3 },
  EMAIL_INTAKE: { label: "Email Intake", phase: 2, importance: 2 },
  SOCIAL: { label: "Social Engine", phase: 2, importance: 2 },
  APPOINTMENTS: { label: "Appointments", phase: 1, importance: 3 },
  CUSTOMERS: { label: "Customers", phase: 1, importance: 2 },
  CLIENT_PORTAL: { label: "Client Portal", phase: 1, importance: 2 },
  STAFF_PORTAL: { label: "Staff Portal", phase: 1, importance: 2 },
  DOMAINS: { label: "Domains", phase: 0, importance: 3 },
  OWNER_CONTROL: { label: "Owner Control", phase: 2, importance: 3 },
  AUTOPILOT: { label: "Autopilot", phase: 3, importance: 3 },
};

const FEATURE_DEFAULTS: Record<SaasFeatureKey, { label: string; category: SaasFeatureCategory; phaseOrder: number }> = {
  ECONOMY: { label: "Economy Engine", category: "CORE", phaseOrder: 1 },
  HR: { label: "HR & Compliance", category: "OPERATIONS", phaseOrder: 1 },
  EMPLOYEES: { label: "Equipo & Roles", category: "OPERATIONS", phaseOrder: 1 },
  STAFF_PORTAL: { label: "Staff Portal", category: "OPERATIONS", phaseOrder: 1 },
  CLIENT_PORTAL: { label: "Client Portal", category: "MARKETING", phaseOrder: 1 },
  EMAIL_INTAKE: { label: "Email Intake", category: "MARKETING", phaseOrder: 2 },
  SOCIAL: { label: "Social Engine", category: "MARKETING", phaseOrder: 2 },
  OWNER_CONTROL: { label: "Owner Control", category: "ANALYTICS", phaseOrder: 2 },
  TASKS: { label: "Tasks & Execution", category: "OPERATIONS", phaseOrder: 3 },
  KNOWLEDGE: { label: "Knowledge Base", category: "OPERATIONS", phaseOrder: 3 },
  BLUEPRINT: { label: "Blueprint & Factory", category: "CORE", phaseOrder: 0 },
  APPEARANCE_BRANDING: { label: "Branding & Themes", category: "CORE", phaseOrder: 0 },
  TAX_ENGINE: { label: "Tax & Accounting", category: "ANALYTICS", phaseOrder: 2 },
};

export function listSaasPacks(): SaasPackDefinition[] {
  return SAAS_PACK_DEFINITIONS;
}

export type GetCompanyPacksInput = {
  tenantId: string;
  companyId?: string | null;
  saasId?: string | null;
  env?: DracoEnv | null;
  featureResult?: CompanyFeaturesResult | null;
  featureResolver?: typeof getCompanyFeatures;
  loader?: () => SaasPackDefinition[];
};

export type CompanyPacksResult = {
  items: SaasPackDefinition[];
  resolvedSaasId: string | null;
  matchReason: "FEATURE_MATCH" | "FEATURE_INTERSECTION" | "FALLBACK";
};

function resolveEffectiveSaasId(companyId?: string | null, saasId?: string | null): string | null {
  const normalizedCompany = companyId?.trim();
  if (normalizedCompany) return normalizedCompany;
  const normalizedSaas = saasId?.trim();
  return normalizedSaas ?? null;
}

function filterPacksByFeatures(packs: SaasPackDefinition[], features: SaasFeature[]): {
  items: SaasPackDefinition[];
  matchReason: CompanyPacksResult["matchReason"];
} {
  if (features.length === 0) {
    return { items: packs, matchReason: "FALLBACK" };
  }

  const enabledKeys = new Set<string>(
    features.filter((feature) => feature.status === "ENABLED").map((feature) => feature.featureKey),
  );

  if (enabledKeys.size === 0) {
    return { items: packs, matchReason: "FALLBACK" };
  }

  const fullMatches = packs.filter((pack) => pack.recommendedFeatureKeys.every((key) => enabledKeys.has(key)));
  if (fullMatches.length > 0) {
    return { items: fullMatches, matchReason: "FEATURE_MATCH" };
  }

  const partialMatches = packs.filter((pack) => pack.recommendedFeatureKeys.some((key) => enabledKeys.has(key)));
  if (partialMatches.length > 0) {
    return { items: partialMatches, matchReason: "FEATURE_INTERSECTION" };
  }

  return { items: packs, matchReason: "FALLBACK" };
}

export async function getCompanyPacks({
  tenantId,
  companyId,
  saasId,
  env,
  featureResult,
  featureResolver = getCompanyFeatures,
  loader = listSaasPacks,
}: GetCompanyPacksInput): Promise<CompanyPacksResult> {
  const effectiveSaasId = resolveEffectiveSaasId(companyId, saasId);
  if (!effectiveSaasId) {
    return { items: loader(), resolvedSaasId: null, matchReason: "FALLBACK" };
  }

  const resolvedFeatures =
    featureResult ?? (await featureResolver({ tenantId, companyId, saasId, env }));
  const allPacks = loader();
  const { items, matchReason } = filterPacksByFeatures(allPacks, resolvedFeatures.items);
  return { items, resolvedSaasId: resolvedFeatures.resolvedSaasId ?? effectiveSaasId, matchReason };
}

export type SaasCatalogItem = {
  id: string;
  vertical: SaasCatalogVertical;
  label: string;
  shortTagline: string;
  idealFor: string[];
  startingFromText: string;
  highlightBullets: string[];
  recommendedPlanId?: string;
};

export function listSaasCatalogItems(): SaasCatalogItem[] {
  return SAAS_PACK_DEFINITIONS.filter((pack) => pack.catalog)
    .map((pack) => ({
      id: pack.id,
      vertical: pack.catalog!.vertical,
      label: pack.label,
      shortTagline: pack.catalog!.shortTagline,
      idealFor: pack.catalog!.idealFor,
      startingFromText: pack.catalog!.startingFromText,
      highlightBullets: pack.catalog!.highlightBullets,
      recommendedPlanId: pack.catalog!.recommendedPlanId,
    }));
}

export function getSaasPackById(id: string): SaasPackDefinition | undefined {
  return SAAS_PACK_DEFINITIONS.find((pack) => pack.id === id);
}

export function guessPackForSaas(input: PackGuessInput): SaasPackDefinition | null {
  const serviceNames = input.serviceNames?.map((name) => name.toLowerCase()) ?? [];
  if (serviceNames.some((name) => name.includes("dog") || name.includes("perro") || name.includes("pet") || name.includes("groom"))) {
    return getSaasPackById("drako_pet_grooming_pack") ?? null;
  }
  if (serviceNames.some((name) => name.includes("lavander") || name.includes("lavado") || name.includes("washing"))) {
    return getSaasPackById("drako_laundry_pack") ?? null;
  }

  const businessType = input.businessType ?? null;
  if (businessType === "CLINIC") return getSaasPackById("drako_clinic_pack") ?? null;
  if (businessType === "SALON") return getSaasPackById("drako_salon_pack") ?? null;
  if (businessType === "PET_CARE") return getSaasPackById("drako_pet_grooming_pack") ?? null;
  if (businessType === "LAUNDRY") return getSaasPackById("drako_laundry_pack") ?? null;

  const featureKeys = input.featureKeys ?? [];
  if (featureKeys.includes("SOCIAL") && featureKeys.includes("CLIENT_PORTAL")) {
    return getSaasPackById("drako_salon_pack") ?? null;
  }

  return null;
}

export async function applyPackToSaas(params: {
  tenantId: string;
  saasId: string;
  env?: Parameters<typeof resolveFeaturesContext>[0]["env"];
  pack: SaasPackDefinition;
}): Promise<{ appliedFeatures: SaasFeatureKey[]; appliedBlueprintModules: SaasModuleCode[]; warnings: string[] }> {
  const featuresCtx = await resolveFeaturesContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const existingFeatures = await listSaasFeatures(featuresCtx);
  const appliedFeatures: SaasFeatureKey[] = [];
  const warnings: string[] = [];

  for (const featureKey of params.pack.recommendedFeatureKeys) {
    const existing = existingFeatures.find((feature) => feature.featureKey === featureKey);
    if (existing) {
      if (existing.status === "DISABLED") {
        warnings.push(`Feature ${featureKey} está desactivada manualmente.`);
      }
      continue;
    }
    const defaults = FEATURE_DEFAULTS[featureKey as SaasFeatureKey];
    await upsertSaasFeature(featuresCtx, {
      tenantId: params.tenantId,
      saasId: params.saasId,
      featureKey: featureKey as SaasFeatureKey,
      label: defaults.label,
      category: defaults.category,
      status: "ENABLED",
      source: "MANUAL",
      phaseOrder: defaults.phaseOrder,
    });
    appliedFeatures.push(featureKey as SaasFeatureKey);
  }

  const blueprintCtx = await resolveBlueprintsContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const existingModules = await listSaasModules(blueprintCtx, params.saasId);
  const appliedBlueprintModules: SaasModuleCode[] = [];

  for (const moduleKey of params.pack.recommendedBlueprintModuleKeys) {
    const existing = existingModules.find((module) => module.code === moduleKey);
    if (existing) continue;
    const defaults = MODULE_DEFAULTS[moduleKey as SaasModuleCode];
    await upsertSaasModule(blueprintCtx, {
      saasId: params.saasId,
      code: moduleKey as SaasModuleCode,
      label: defaults.label,
      phase: defaults.phase,
      status: "ACTIVE",
      importance: defaults.importance,
      description: null,
    });
    appliedBlueprintModules.push(moduleKey as SaasModuleCode);
  }

  return { appliedFeatures, appliedBlueprintModules, warnings };
}
