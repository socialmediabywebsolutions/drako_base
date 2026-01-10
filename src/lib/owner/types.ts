import type { SocialOwnerSummary } from "@/lib/social/repository";
import type { SaasTaxSummaryForSaas } from "@/lib/tax/types";
import type { BusinessType, BlueprintPrimaryGoal, BlueprintMaturityStage, SaasModuleCode } from "@/lib/blueprints/types";
import type { SaasFeature, SaasFeatureKey } from "@/lib/features/types";
import type { SaasPackDefinition } from "@/lib/packs/types";

export type CanHireStatus = "CAN_HIRE" | "BORDERLINE" | "CANNOT_HIRE";

export type AutopilotActionCategory =
  | "ECONOMY"
  | "PRICING"
  | "HR"
  | "FAIRNESS"
  | "SOCIAL"
  | "EMAIL"
  | "INVENTORY"
  | "CUSTOMERS"
  | "GENERAL"
  | "SYSTEM"
  | "TAX";

export type AutopilotActionSeverity = "INFO" | "SUGGESTION" | "WARNING" | "CRITICAL";

export type AutopilotActionTarget = {
  type: "EMPLOYEE" | "SERVICE" | "CAMPAIGN" | "SUPPLIER" | "FEATURE" | "PACK" | "GENERAL";
  id?: string | null;
};

export type AutopilotKnowledgeHint = {
  spaceSlug?: string;
  tags?: string[];
  targetType?: string;
  targetId?: string;
};

export type DrakoSuggestedAction = {
  id: string;
  key?: string;
  category: AutopilotActionCategory;
  severity: AutopilotActionSeverity;
  title: string;
  description: string;
  target?: AutopilotActionTarget;
  knowledgeHints?: AutopilotKnowledgeHint;
  targetArea?: string;
  employeeId?: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  serviceId?: string | null;
  requiresFeatures?: SaasFeatureKey[];
  requiresPacks?: string[];
  createdAt: string;
};

export type CanHireAdvice = {
  status: CanHireStatus;
  reason: string;
  details?: string | null;
};

export type OwnerControlSnapshot = {
  tenantId: string;
  saasId: string;
  currentPack?: {
    id: string;
    slug: string;
    label: string;
    vertical: string;
  };
  recommendedPackId?: string;
  companyFeatures?: SaasFeature[];
  companyPacks?: SaasPackDefinition[];
  companyResolvedSaasId?: string | null;
  blueprintSummary?: {
    businessType: BusinessType;
    primaryGoal: BlueprintPrimaryGoal;
    maturityStage: BlueprintMaturityStage;
    activeModulesCount: number;
    plannedModulesCount: number;
    missingCriticalModules: SaasModuleCode[];
  };
  guardrailsEnforcementSummary?: {
    blockOverwork: boolean;
    blockUnderpay: boolean;
    minRestHoursBetweenShifts: number;
  };
  social?: SocialOwnerSummary;
  taxSummary?: SaasTaxSummaryForSaas;
  socialConversion?: {
    totalAppointmentsFromSocial: number;
    totalRevenueFromSocial: number;
    topCampaignName?: string;
    topCampaignRevenue?: number;
  };
  employeesProfitabilitySummary?: {
    employeesCount: number;
    healthyCount: number;
    tightCount: number;
    unprofitableCount: number;
    lowActivityCount: number;
    topProfitableEmployee?: { employeeId: string; name: string; marginPercent: number | null };
    mostUnprofitableEmployee?: { employeeId: string; name: string; marginPercent: number | null };
  };
  autopilotActions?: DrakoSuggestedAction[];
  economy: {
    marginPercentEstimated: number | null;
    targetMarginPercent: number | null;
    totalRevenueEstimated: number | null;
    totalCostsEstimated: number | null;
    costBreakdown: {
      rent: number;
      utilities: number;
      payroll: number;
      products: number;
      other: number;
    };
    pricingPressureServices: Array<{
      serviceId: string;
      serviceName: string;
      marginCurrent: number | null;
      marginTarget: number | null;
      status: "OK" | "LOW_MARGIN" | "LOSS";
    }>;
  };
  hr: {
    employeesTotal: number;
    overworkedCount: number;
    underpaidCount: number;
    lowActivityCount: number;
    criticalIssues: string[];
  };
  emailIntake: {
    totalMessages: number;
    invoicesCount: number;
    supplierOffersCount: number;
    leadMessagesCount: number;
    lastInvoiceAt: string | null;
    potentialSavingsPerMonth: number;
    topSavingsOpportunities: Array<{
      supplierName: string | null;
      itemName: string;
      currentUnitCost: number;
      offeredUnitCost: number;
      estimatedMonthlyUsage: number;
      estimatedMonthlySaving: number;
    }>;
  };
  canHireAdvice: CanHireAdvice;
  recommendations: string[];
};

export interface OwnerPortfolioSaasItem {
  saasId: string;
  name: string;
  slug: string;
  verticalPack?: {
    id: string;
    slug: string;
    label: string;
  };
  recommendedPackId?: string;
  keyMetrics: {
    marginPercent?: number;
    hrFairnessStatus?: "OK" | "WARNING" | "CRITICAL";
    employeesRoiStatus?: "HEALTHY" | "TIGHT" | "LOW_ACTIVITY";
    socialRoiStatus?: "GOOD" | "NEUTRAL" | "POOR";
    guardrailsViolationsLast30d?: number;
    autopilotPendingTasks?: number;
  };
  autopilotSummary?: {
    criticalActions: number;
    warningActions: number;
    suggestionActions: number;
  };
}

export interface OwnerPortfolioSnapshot {
  ownerId: string;
  totalSaas: number;
  saas: OwnerPortfolioSaasItem[];
  highLevel: {
    totalMarginAverage?: number;
    totalEmployees?: number;
    totalOpenTasks?: number;
    totalHardGuardrailViolationsLast30d?: number;
  };
}

export type OwnerGrowthAutopilotSeverity = "CRITICAL" | "WARNING" | "INFO";

export type OwnerGrowthAutopilotCategory =
  | "ECONOMY"
  | "SAAS_HEALTH"
  | "PRICING"
  | "MARKETING"
  | "VERTICAL_MIX"
  | "CATALOG"
  | "RISK"
  | "OPPORTUNITY"
  | "DEPARTMENT_COVERAGE";

export interface OwnerGrowthAutopilotTarget {
  type: "SAAS" | "VERTICAL" | "PACK" | "PORTFOLIO" | "OWNER";
  saasId?: string;
  vertical?: "CLINIC" | "SALON" | "PET_GROOMING" | "LAUNDRY" | "OTHER";
  packId?: string;
}

export interface OwnerGrowthAutopilotAction {
  id: string;
  severity: OwnerGrowthAutopilotSeverity;
  category: OwnerGrowthAutopilotCategory;
  title: string;
  description: string;
  target: OwnerGrowthAutopilotTarget;
  rationale?: string;
  metadata?: Record<string, unknown>;
}

export type SaasHealthStatus = "GOOD" | "WARNING" | "CRITICAL";

export type SaasHealthSignal = {
  kind: "PRICING" | "DEPARTMENTS" | "MARKETING" | "MARGIN";
  level: "INFO" | "WARN" | "CRITICAL";
  message: string;
};

export type SaasHealthSnapshot = {
  saasId: string;
  saasName: string;
  verticalId: OwnerGrowthAutopilotTarget["vertical"];
  healthScore: number;
  healthStatus: SaasHealthStatus;
  pricingStatus: "UNDERWATER" | "AT_RISK" | "ABOVE_TARGET";
  departmentCoverageStatus: "WELL_COVERED" | "PARTIAL" | "CRITICAL_GAP";
  marketingStatus: "OK" | "NEAR_LIMIT" | "OVER_LIMIT";
  estimatedVendorCostMonthly?: number;
  recommendedTargetPriceMonthly?: number;
  signals: SaasHealthSignal[];
};
