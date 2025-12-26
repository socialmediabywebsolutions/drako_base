import { getSaasSubscriptions } from "@/lib/billing/client-saas-subscriptions";
import { getSaasPlanById } from "@/lib/billing/saas-plans";
import { buildOwnerControlSnapshot } from "@/lib/owner/control-dashboard";
import { getBaselineSnapshot } from "@/lib/owner/baseline";
import { getDrakoVendorAccountingSnapshot } from "@/lib/owner/vendor-accounting";
import { estimateVendorCostsPerSaas } from "@/lib/owner/vendor-accounting";
import { buildSaasPricingRecommendations } from "@/lib/owner/pricing-engine";
import { listSaasForOwner } from "@/lib/owner/portfolio";
import { getSaasMarketingSnapshotForMonth, resolveSaasMarketingContext } from "@/lib/saas/marketing-repository";
import { buildOwnerTaxPortfolioSummary } from "@/lib/tax/portfolio";
import type { OwnerTaxPortfolioSummary } from "@/lib/tax/types";
import type { SaasMarketingSnapshot } from "@/lib/saas/marketing-types";
import { getSaasDepartmentCoverage, type SaasDepartmentCoverage } from "@/lib/owner/department-coverage";
import { buildSaasHealthSnapshots } from "@/lib/owner/saas-health";
import type { SaasHealthSnapshot } from "@/lib/owner/types";

export type OwnerSaasAccountingRow = {
  saasId: string;
  saasName: string;
  slug: string;
  vertical?: "CLINIC" | "SALON" | "PET_GROOMING" | "LAUNDRY" | "OTHER";
  packId?: string;
  recommendedPackId?: string;
  planId?: string;
  planLabel?: string;
  subscriptionMonthlyAmount?: number;
  currency?: string;
  profitabilityMarginPercent?: number;
  profitabilityStatus?: "HEALTHY" | "TIGHT" | "AT_RISK" | "UNKNOWN";
  notes?: string;
};

export type OwnerAccountingSnapshot = {
  totalSaas: number;
  totalSubscriptionMRR: number;
  totalEstimatedMarginPercent?: number;
  baselineLifeMonthly: number;
  baselineWorkMonthly: number;
  basicBaselineMonthly: number;
  vendorFixedMonthly: number;
  totalBaselineMonthly: number;
  totalOwnerRevenueMonthly: number;
  baselineCoveragePercent: number;
  baselineCovered: boolean;
  baselineGapAmount: number;
  saasPricingSummary: {
    numUnderwater: number;
    numAtRisk: number;
    numAboveTarget: number;
    worstCases: Array<{
      saasId: string;
      saasName: string;
      currentMonthlyPrice: number;
      estimatedVendorCostMonthly: number;
      recommendedMinPriceMonthly: number;
      status: "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER";
    }>;
  };
  pricingStatusBySaas: Record<string, "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER">;
  departmentCoverageSummary?: {
    wellCoveredCount: number;
    partialCount: number;
    criticalGapCount: number;
    topGaps: SaasDepartmentCoverage[];
  };
  saasHealthSummary?: {
    total: number;
    good: number;
    warning: number;
    critical: number;
    topCritical: SaasHealthSnapshot[];
    topScaleCandidates: SaasHealthSnapshot[];
    items: SaasHealthSnapshot[];
  };
  saasHealthItems?: SaasHealthSnapshot[];
  verticalBreakdown: Array<{
    vertical: OwnerSaasAccountingRow["vertical"];
    saasCount: number;
    mrr: number;
    avgMarginPercent?: number;
  }>;
  rows: OwnerSaasAccountingRow[];
  taxSummary?: OwnerTaxPortfolioSummary;
};

export type OwnerMarketingSnapshotItem = {
  saasId: string;
  saasName: string;
  verticalId: OwnerSaasAccountingRow["vertical"];
  includedPostsPerMonth: number;
  postsPublishedThisMonth: number;
  usagePostsPercent: number;
  isNearLimit: boolean;
  status: "OK" | "NEAR_LIMIT" | "OVER_LIMIT";
  currentPackTier: SaasMarketingSnapshot["currentPackTier"];
  currentPackDefinition: SaasMarketingSnapshot["currentPackDefinition"];
  recommendedPackTier: SaasMarketingSnapshot["recommendedPackTier"];
  recommendedPackDefinition: SaasMarketingSnapshot["recommendedPackDefinition"];
};

export type OwnerMarketingSnapshot = {
  totalSaasWithMarketingPlan: number;
  saasNearLimitCount: number;
  saasOverLimitCount: number;
  items: OwnerMarketingSnapshotItem[];
};

function resolveSubscriptionCandidate<T extends { status: string; updatedAt: string }>(subs: T[]): T | null {
  const sorted = [...subs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = sorted.find((sub) => ["active", "trialing"].includes(sub.status));
  return active ?? sorted[0] ?? null;
}

function toMonthlyAmount(amount: number, interval: "month" | "year"): number {
  if (interval === "year") return amount / 12;
  return amount;
}

function resolveProfitabilityStatus(margin?: number | null, target?: number | null): OwnerSaasAccountingRow["profitabilityStatus"] {
  if (typeof margin !== "number") return "UNKNOWN";
  const targetMargin = typeof target === "number" ? target : 40;
  if (margin >= targetMargin) return "HEALTHY";
  if (margin >= targetMargin - 10) return "TIGHT";
  return "AT_RISK";
}

export async function buildOwnerAccountingSnapshot(params: {
  tenantId: string;
  ownerId: string;
}): Promise<OwnerAccountingSnapshot> {
  const baselineSnapshot = await getBaselineSnapshot({ tenantId: params.tenantId });
  const vendorSnapshot = await getDrakoVendorAccountingSnapshot({ tenantId: params.tenantId, ownerId: params.ownerId });
  const saasList = await listSaasForOwner(params.tenantId, params.ownerId);
  const rows: OwnerSaasAccountingRow[] = [];

  for (const saas of saasList) {
    let subscriptionMonthlyAmount: number | undefined;
    let planLabel: string | undefined;
    let planId: string | undefined;
    let currency: string | undefined;
    try {
      const subscriptions = await getSaasSubscriptions(params.tenantId, saas.id);
      const current = resolveSubscriptionCandidate(subscriptions);
      if (current?.saasPlanId) {
        planId = current.saasPlanId;
        const plan = await getSaasPlanById(params.tenantId, current.saasPlanId);
        if (plan) {
          planLabel = plan.name;
          currency = plan.currency;
          subscriptionMonthlyAmount = toMonthlyAmount(plan.amount, plan.billingInterval) / 100;
        }
      }
    } catch (error) {
      console.warn("OWNER_ACCOUNTING_PLAN_ERROR", error);
    }

    let marginPercent: number | undefined;
    let marginTarget: number | undefined;
    let notes: string | undefined;
    let packId: string | undefined;
    let recommendedPackId: string | undefined;
    let vertical: OwnerSaasAccountingRow["vertical"];
    try {
      const snapshot = await buildOwnerControlSnapshot({ tenantId: params.tenantId, saasId: saas.id });
      marginPercent = snapshot.economy.marginPercentEstimated ?? undefined;
      marginTarget = snapshot.economy.targetMarginPercent ?? undefined;
      notes = snapshot.canHireAdvice?.reason ?? undefined;
      if (snapshot.currentPack) {
        packId = snapshot.currentPack.id;
        vertical = (snapshot.currentPack.vertical as OwnerSaasAccountingRow["vertical"]) ?? "OTHER";
      }
      recommendedPackId = snapshot.recommendedPackId ?? undefined;
    } catch (error) {
      console.warn("OWNER_ACCOUNTING_SNAPSHOT_ERROR", error);
    }

    rows.push({
      saasId: saas.id,
      saasName: saas.name,
      slug: saas.slug,
      vertical: vertical ?? "OTHER",
      packId,
      recommendedPackId,
      planId,
      planLabel,
      subscriptionMonthlyAmount,
      currency,
      profitabilityMarginPercent: marginPercent,
      profitabilityStatus: resolveProfitabilityStatus(marginPercent, marginTarget),
      notes,
    });
  }

  const totalSubscriptionMRR = rows.reduce((acc, row) => acc + (row.subscriptionMonthlyAmount ?? 0), 0);
  const vendorFixedMonthly = vendorSnapshot.totalVendorExpensesThisMonth;
  const basicBaselineMonthly = baselineSnapshot.baselineTotalMonthly;
  const totalBaselineMonthly = basicBaselineMonthly + vendorFixedMonthly;
  const totalOwnerRevenueMonthly = totalSubscriptionMRR;
  const baselineCoverageRaw = totalBaselineMonthly > 0 ? totalOwnerRevenueMonthly / totalBaselineMonthly : 0;
  const baselineCoveragePercent = Math.max(0, Math.min(2, baselineCoverageRaw));
  const baselineCovered = totalOwnerRevenueMonthly >= totalBaselineMonthly && totalBaselineMonthly > 0;
  const baselineGapAmount = Math.max(0, totalBaselineMonthly - totalOwnerRevenueMonthly);
  const weighted = rows.reduce(
    (acc, row) => {
      if (typeof row.profitabilityMarginPercent !== "number") return acc;
      const weight = row.subscriptionMonthlyAmount ?? 1;
      return { sum: acc.sum + row.profitabilityMarginPercent * weight, weight: acc.weight + weight };
    },
    { sum: 0, weight: 0 },
  );

  const verticalGroups = new Map<OwnerSaasAccountingRow["vertical"], OwnerSaasAccountingRow[]>();
  rows.forEach((row) => {
    const key = row.vertical ?? "OTHER";
    const list = verticalGroups.get(key) ?? [];
    list.push(row);
    verticalGroups.set(key, list);
  });

  const verticalBreakdown = Array.from(verticalGroups.entries()).map(([verticalKey, items]) => {
    const mrr = items.reduce((acc, row) => acc + (row.subscriptionMonthlyAmount ?? 0), 0);
    const marginValues = items.map((row) => row.profitabilityMarginPercent).filter((value): value is number => typeof value === "number");
    const avgMarginPercent = marginValues.length ? marginValues.reduce((acc, value) => acc + value, 0) / marginValues.length : undefined;
    return {
      vertical: verticalKey,
      saasCount: items.length,
      mrr,
      avgMarginPercent,
    };
  });

  let taxSummary: OwnerTaxPortfolioSummary | undefined;
  try {
    taxSummary = await buildOwnerTaxPortfolioSummary({ tenantId: params.tenantId, ownerId: params.ownerId });
  } catch (error) {
    console.warn("OWNER_ACCOUNTING_TAX_SUMMARY_ERROR", error);
  }

  let saasPricingSummary: OwnerAccountingSnapshot["saasPricingSummary"] = {
    numUnderwater: 0,
    numAtRisk: 0,
    numAboveTarget: 0,
    worstCases: [],
  };
  let pricingStatusBySaas: OwnerAccountingSnapshot["pricingStatusBySaas"] = {};
  let pricingRecommendations: ReturnType<typeof buildSaasPricingRecommendations> = [];
  try {
    const costs = await estimateVendorCostsPerSaas({
      tenantId: params.tenantId,
      ownerId: params.ownerId,
      rows,
    });
    const recommendations = buildSaasPricingRecommendations({
      rows,
      costs,
      workBaselineMonthly: baselineSnapshot.workTotalMonthly,
    });
    pricingRecommendations = recommendations;
    pricingStatusBySaas = recommendations.reduce<Record<string, "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER">>(
      (acc, item) => {
        acc[item.saasId] = item.status;
        return acc;
      },
      {},
    );
    const underwater = recommendations.filter((item) => item.status === "UNDERWATER");
    const atRisk = recommendations.filter((item) => item.status === "AT_RISK");
    const aboveTarget = recommendations.filter((item) => item.status === "ABOVE_TARGET");
    const worstCases = recommendations
      .filter((item) => item.status !== "ABOVE_TARGET")
      .slice()
      .sort((a, b) => {
        const severity = (value: typeof a.status) => (value === "UNDERWATER" ? 0 : 1);
        const severityDelta = severity(a.status) - severity(b.status);
        if (severityDelta !== 0) return severityDelta;
        return (b.estimatedVendorCostMonthly - b.currentMonthlyPrice) - (a.estimatedVendorCostMonthly - a.currentMonthlyPrice);
      })
      .slice(0, 3)
      .map((item) => ({
        saasId: item.saasId,
        saasName: item.saasName,
        currentMonthlyPrice: item.currentMonthlyPrice,
        estimatedVendorCostMonthly: item.estimatedVendorCostMonthly,
        recommendedMinPriceMonthly: item.recommendedMinPriceMonthly,
        status: item.status,
      }));
    saasPricingSummary = {
      numUnderwater: underwater.length,
      numAtRisk: atRisk.length,
      numAboveTarget: aboveTarget.length,
      worstCases,
    };
  } catch (error) {
    console.warn("OWNER_ACCOUNTING_PRICING_SUMMARY_ERROR", error);
  }

  let departmentCoverageSummary: OwnerAccountingSnapshot["departmentCoverageSummary"] | undefined;
  let departmentCoverage: SaasDepartmentCoverage[] = [];
  try {
    const coverage = await getSaasDepartmentCoverage({ tenantId: params.tenantId, rows });
    departmentCoverage = coverage;
    const wellCoveredCount = coverage.filter((item) => item.status === "WELL_COVERED").length;
    const partialCount = coverage.filter((item) => item.status === "PARTIAL").length;
    const criticalGapCount = coverage.filter((item) => item.status === "CRITICAL_GAP").length;
    const topGaps = coverage
      .filter((item) => item.status !== "WELL_COVERED")
      .slice()
      .sort((a, b) => {
        const score = (value: typeof a.status) => (value === "CRITICAL_GAP" ? 0 : 1);
        const scoreDelta = score(a.status) - score(b.status);
        if (scoreDelta !== 0) return scoreDelta;
        return b.gaps.length - a.gaps.length;
      })
      .slice(0, 3);
    departmentCoverageSummary = {
      wellCoveredCount,
      partialCount,
      criticalGapCount,
      topGaps,
    };
  } catch (error) {
    console.warn("OWNER_ACCOUNTING_COVERAGE_ERROR", error);
  }

  let saasHealthItems: OwnerAccountingSnapshot["saasHealthItems"];
  let saasHealthSummary: OwnerAccountingSnapshot["saasHealthSummary"];
  try {
    const marketingSnapshot = await buildOwnerMarketingSnapshotFromRows({ tenantId: params.tenantId, rows });
    const healthItems = buildSaasHealthSnapshots({
      rows,
      pricingRecommendations,
      departmentCoverage,
      marketingSnapshot,
    });
    const good = healthItems.filter((item) => item.healthStatus === "GOOD").length;
    const warning = healthItems.filter((item) => item.healthStatus === "WARNING").length;
    const critical = healthItems.filter((item) => item.healthStatus === "CRITICAL").length;
    const topCritical = healthItems
      .filter((item) => item.healthStatus === "CRITICAL")
      .slice()
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 3);
    const topScaleCandidates = healthItems
      .filter((item) => item.healthStatus === "GOOD")
      .slice()
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, 3);
    saasHealthItems = healthItems;
    saasHealthSummary = {
      total: healthItems.length,
      good,
      warning,
      critical,
      topCritical,
      topScaleCandidates,
      items: healthItems,
    };
  } catch (error) {
    console.warn("OWNER_ACCOUNTING_HEALTH_ERROR", error);
  }

  return {
    totalSaas: rows.length,
    totalSubscriptionMRR,
    totalEstimatedMarginPercent: weighted.weight > 0 ? weighted.sum / weighted.weight : undefined,
    baselineLifeMonthly: baselineSnapshot.lifeTotalMonthly,
    baselineWorkMonthly: baselineSnapshot.workTotalMonthly,
    basicBaselineMonthly,
    vendorFixedMonthly,
    totalBaselineMonthly,
    totalOwnerRevenueMonthly,
    baselineCoveragePercent,
    baselineCovered,
    baselineGapAmount,
    saasPricingSummary,
    pricingStatusBySaas,
    departmentCoverageSummary,
    saasHealthSummary,
    saasHealthItems,
    verticalBreakdown,
    rows,
    taxSummary,
  };
}

function resolveMarketingStatus(snapshot: SaasMarketingSnapshot): OwnerMarketingSnapshotItem["status"] {
  if (snapshot.includedPostsPerMonth <= 0) return "OK";
  if (snapshot.postsPublishedThisMonth >= snapshot.includedPostsPerMonth) return "OVER_LIMIT";
  if (snapshot.postsPublishedThisMonth >= snapshot.includedPostsPerMonth * 0.8) return "NEAR_LIMIT";
  return "OK";
}

async function buildOwnerMarketingSnapshotFromRows(params: {
  tenantId: string;
  rows: OwnerSaasAccountingRow[];
}): Promise<OwnerMarketingSnapshot> {
  const ctx = await resolveSaasMarketingContext({ tenantId: params.tenantId });
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const items: OwnerMarketingSnapshotItem[] = [];
  for (const row of params.rows) {
    const snapshot = await getSaasMarketingSnapshotForMonth(ctx, row.saasId, {
      month,
      year,
      verticalId: row.vertical ?? null,
    });
    const status = resolveMarketingStatus(snapshot);
    items.push({
      saasId: row.saasId,
      saasName: row.saasName,
      verticalId: row.vertical ?? "OTHER",
      includedPostsPerMonth: snapshot.includedPostsPerMonth,
      postsPublishedThisMonth: snapshot.postsPublishedThisMonth,
      usagePostsPercent: snapshot.usagePostsPercent,
      isNearLimit: snapshot.isNearLimit,
      status,
      currentPackTier: snapshot.currentPackTier,
      currentPackDefinition: snapshot.currentPackDefinition,
      recommendedPackTier: snapshot.recommendedPackTier,
      recommendedPackDefinition: snapshot.recommendedPackDefinition,
    });
  }

  const totalSaasWithMarketingPlan = items.length;
  const saasNearLimitCount = items.filter((item) => item.status === "NEAR_LIMIT").length;
  const saasOverLimitCount = items.filter((item) => item.status === "OVER_LIMIT").length;

  return {
    totalSaasWithMarketingPlan,
    saasNearLimitCount,
    saasOverLimitCount,
    items,
  };
}

export async function getOwnerMarketingSnapshot(params: { tenantId: string; ownerId: string }): Promise<OwnerMarketingSnapshot> {
  const accounting = await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId: params.ownerId });
  return buildOwnerMarketingSnapshotFromRows({ tenantId: params.tenantId, rows: accounting.rows });
}
