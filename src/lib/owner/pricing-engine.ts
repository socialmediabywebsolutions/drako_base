import { estimateVendorCostsPerSaas } from "@/lib/owner/vendor-accounting";
import { buildOwnerAccountingSnapshot, type OwnerSaasAccountingRow } from "@/lib/owner/accounting";
import { getBaselineSnapshot } from "@/lib/owner/baseline";
import { getDemoOwner } from "@/lib/admin/demo-data";
import { getSaasMarketingSnapshotForMonth, resolveSaasMarketingContext } from "@/lib/saas/marketing-repository";
import { queryAll } from "@/lib/db";
import type { DracoEnv } from "@/lib/cf";
import type { DrakoVendorPerSaasCostEstimate } from "@/lib/owner/vendor-types";
import type { SaasMarketingSnapshot } from "@/lib/saas/marketing-types";
import type { MarketingPackTier } from "@/lib/saas/marketing-packs";

export type DrakoSaasPricingSuggestion = {
  saasId: string;
  saasName: string;
  verticalId: string | null;
  estimatedCostMonthly: number;
  targetMarginPercent: number;
  suggestedMinPriceMonthly: number;
  suggestedPriceRange: { low: number; high: number };
  notes: string[];
};

export type SaasPricingRecommendation = {
  saasId: string;
  saasName: string;
  verticalId: string | null;
  currentMonthlyPrice: number;
  estimatedVendorCostMonthly: number;
  recommendedMinPriceMonthly: number;
  recommendedTargetPriceMonthly: number;
  recommendedStretchPriceMonthly?: number;
  status: "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER";
  marketingPackTier: MarketingPackTier | null;
  marketingPackMonthlyPrice: number | null;
  marketingPackShareOfPrice: number | null;
  marketingPackStatus: "NONE" | "LIGHT" | "BALANCED" | "HEAVY";
  notes: string[];
};

type MarketingPackInfo = Pick<
  SaasMarketingSnapshot,
  "currentPackTier" | "currentPackDefinition" | "recommendedPackTier" | "recommendedPackDefinition"
>;

type PricingRowInput = Pick<OwnerSaasAccountingRow, "saasId" | "saasName" | "vertical" | "subscriptionMonthlyAmount">;
const VERTICAL_PRICING_RULES: Record<
  string,
  {
    minFactor: number;
    targetFactor: number;
    stretchFactor: number;
  }
> = {
  SALON: { minFactor: 1.2, targetFactor: 1.6, stretchFactor: 2.0 },
  CLINIC: { minFactor: 1.4, targetFactor: 1.8, stretchFactor: 2.2 },
  PET_GROOMING: { minFactor: 1.2, targetFactor: 1.5, stretchFactor: 1.9 },
  LAUNDRY: { minFactor: 1.15, targetFactor: 1.4, stretchFactor: 1.8 },
  DEFAULT: { minFactor: 1.2, targetFactor: 1.5, stretchFactor: 2.0 },
};

function roundUp(value: number): number {
  return Math.ceil(value / 5) * 5;
}

function buildRecommendationStatus(currentPrice: number, estimatedCost: number, recommendedMin: number): SaasPricingRecommendation["status"] {
  if (currentPrice <= 0 || currentPrice < estimatedCost) return "UNDERWATER";
  if (currentPrice < recommendedMin) return "AT_RISK";
  return "ABOVE_TARGET";
}

function resolvePackStatus(share: number | null, hasPack: boolean): SaasPricingRecommendation["marketingPackStatus"] {
  if (!hasPack || share === null || !Number.isFinite(share)) return "NONE";
  if (share <= 0.25) return "LIGHT";
  if (share <= 0.5) return "BALANCED";
  return "HEAVY";
}

export function buildSaasPricingRecommendations(params: {
  rows: PricingRowInput[];
  costs: DrakoVendorPerSaasCostEstimate[];
  workBaselineMonthly: number;
  marketingBySaas?: Map<string, MarketingPackInfo>;
}): SaasPricingRecommendation[] {
  if (!params.rows.length) return [];
  const workShare = params.rows.length > 0 ? params.workBaselineMonthly / params.rows.length : 0;
  const costBySaas = new Map<string, DrakoVendorPerSaasCostEstimate>();
  params.costs.forEach((item) => {
    costBySaas.set(item.saasId, item);
  });

  return params.rows.map((row) => {
    const cost = costBySaas.get(row.saasId);
    const estimatedVendorCostMonthly = (cost?.totalVendorCostMonthly ?? 0) + workShare;
    const verticalKey = row.vertical ?? "DEFAULT";
    const rule = VERTICAL_PRICING_RULES[verticalKey] ?? VERTICAL_PRICING_RULES.DEFAULT;
    const rawMinPrice = estimatedVendorCostMonthly * rule.minFactor;
    const rawTargetPrice = estimatedVendorCostMonthly * rule.targetFactor;
    const rawStretchPrice = estimatedVendorCostMonthly * rule.stretchFactor;
    const recommendedMinPriceMonthly = roundUp(Math.max(estimatedVendorCostMonthly, rawMinPrice));
    const recommendedTargetPriceMonthly = roundUp(Math.max(recommendedMinPriceMonthly, rawTargetPrice));
    const recommendedStretchPriceMonthly = roundUp(Math.max(recommendedTargetPriceMonthly, rawStretchPrice));
    const currentMonthlyPrice = row.subscriptionMonthlyAmount ?? 0;
    const marketingSnapshot = params.marketingBySaas?.get(row.saasId);
    const marketingPackTier = marketingSnapshot?.currentPackTier ?? null;
    const marketingPackMonthlyPrice = marketingSnapshot?.currentPackDefinition?.recommendedMonthlyPrice ?? null;
    const marketingPackShareOfPrice =
      marketingPackMonthlyPrice !== null && currentMonthlyPrice > 0 ? marketingPackMonthlyPrice / currentMonthlyPrice : null;
    const marketingPackStatus = resolvePackStatus(marketingPackShareOfPrice, Boolean(marketingPackTier));
    const notes: string[] = [];
    if (!row.subscriptionMonthlyAmount) {
      notes.push("Sin precio actual detectado en el plan.");
    }
    if (estimatedVendorCostMonthly < 20) {
      notes.push("Coste muy bajo, puedes permitirte planes entry-level.");
    }
    if (estimatedVendorCostMonthly > 80) {
      notes.push("Coste alto, evita precios demasiado bajos.");
    }
    const status = buildRecommendationStatus(currentMonthlyPrice, estimatedVendorCostMonthly, recommendedMinPriceMonthly);
    if (status === "UNDERWATER" && marketingPackMonthlyPrice !== null) {
      const shareLabel =
        marketingPackShareOfPrice !== null ? `${Math.round(marketingPackShareOfPrice * 100)}%` : "—";
      notes.push(
        `Este SaaS esta en perdidas y su pack de marketing ${marketingPackTier ?? ""} representa ~${shareLabel} del precio mensual. Considera subir precio o reducir pack.`,
      );
    }
    if (status === "AT_RISK" && marketingPackStatus === "HEAVY") {
      const shareLabel =
        marketingPackShareOfPrice !== null ? `${Math.round(marketingPackShareOfPrice * 100)}%` : "—";
      notes.push(
        `Margen estrecho con un pack de marketing pesado (~${shareLabel} del precio). Un pequeno aumento de costes puede dejarte en perdidas.`,
      );
    }
    if (status === "ABOVE_TARGET" && marketingPackStatus === "LIGHT") {
      const shareLabel =
        marketingPackShareOfPrice !== null ? `${Math.round(marketingPackShareOfPrice * 100)}%` : "—";
      notes.push(
        `Buen margen con un pack de marketing ligero (~${shareLabel} del precio); puedes invertir mas en marketing o mantener margen.`,
      );
    }
    return {
      saasId: row.saasId,
      saasName: row.saasName,
      verticalId: row.vertical ?? null,
      currentMonthlyPrice,
      estimatedVendorCostMonthly,
      recommendedMinPriceMonthly,
      recommendedTargetPriceMonthly,
      recommendedStretchPriceMonthly,
      status,
      marketingPackTier,
      marketingPackMonthlyPrice,
      marketingPackShareOfPrice,
      marketingPackStatus,
      notes,
    };
  });
}

export async function getSaasPricingSuggestions(params: {
  tenantId: string;
  ownerId?: string | null;
  env?: DracoEnv | null;
}): Promise<DrakoSaasPricingSuggestion[]> {
  const costs = await estimateVendorCostsPerSaas({
    tenantId: params.tenantId,
    ownerId: params.ownerId,
    env: params.env,
  });

  return costs.map((item) => {
    const targetMarginPercent = 0.7;
    const suggestedMinPriceMonthly = roundUp(item.totalVendorCostMonthly / (1 - targetMarginPercent));
    const suggestedPriceRange = {
      low: suggestedMinPriceMonthly,
      high: roundUp(suggestedMinPriceMonthly * 1.3),
    };
    const notes: string[] = [];
    if (item.totalVendorCostMonthly < 20) {
      notes.push("Coste muy bajo, puedes permitirte planes entry-level.");
    }
    if (item.totalVendorCostMonthly > 80) {
      notes.push("Coste alto, evita precios demasiado bajos.");
    }
    return {
      saasId: item.saasId,
      saasName: item.saasName,
      verticalId: item.verticalId,
      estimatedCostMonthly: item.totalVendorCostMonthly,
      targetMarginPercent,
      suggestedMinPriceMonthly,
      suggestedPriceRange,
      notes,
    };
  });
}

export async function getSaasPricingRecommendations(params: {
  tenantId: string;
  ownerId?: string | null;
  env?: DracoEnv | null;
}): Promise<SaasPricingRecommendation[]> {
  let ownerId = params.ownerId ?? null;
  if (!ownerId) {
    const rows = await queryAll<{ id: string }>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", params.tenantId);
    ownerId = rows[0]?.id ?? getDemoOwner(params.tenantId)?.id ?? null;
  }
  const accounting = ownerId
    ? await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId })
    : null;
  if (!accounting || accounting.rows.length === 0) return [];
  const baseline = await getBaselineSnapshot({ tenantId: params.tenantId });
  const costs = await estimateVendorCostsPerSaas({
    tenantId: params.tenantId,
    ownerId,
    env: params.env,
    rows: accounting.rows,
  });
  let marketingBySaas: Map<string, SaasMarketingSnapshot> | undefined;
  try {
    const marketingCtx = await resolveSaasMarketingContext({ tenantId: params.tenantId, env: params.env });
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const snapshots = await Promise.all(
      accounting.rows.map((row) =>
        getSaasMarketingSnapshotForMonth(marketingCtx, row.saasId, {
          month,
          year,
          verticalId: row.vertical ?? null,
        }),
      ),
    );
    marketingBySaas = new Map(snapshots.map((snapshot) => [snapshot.saasId, snapshot]));
  } catch (error) {
    console.warn("OWNER_PRICING_MARKETING_SNAPSHOT_ERROR", error);
  }

  return buildSaasPricingRecommendations({
    rows: accounting.rows,
    costs,
    workBaselineMonthly: baseline.workTotalMonthly,
    marketingBySaas,
  });
}
