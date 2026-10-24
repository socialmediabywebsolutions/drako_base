import type { AgentPackTier, DepartmentId } from "@/lib/agents/agent-templates";

export type SaasVerticalId = "SALON" | "CLINIC" | "PET_GROOMING" | "LAUNDRY" | "EDUCATION" | "CRYPTO" | "OTHER";

export type DepartmentPackTier = "BASIC" | "STANDARD" | "FULL";
export type AccountingPackTier = "BASIC" | "FULL";
export type AiTier = "COST_SAVER" | "BALANCED" | "PREMIUM";
export type OwnerPricingIntent = "LOW_COST" | "BALANCED" | "PREMIUM";
export type AiStrategy = "COST_OPTIMIZED" | "BALANCED" | "QUALITY_FOCUSED";

export type SaasBlueprintDraft = {
  id?: string;
  ownerTenantId: string;
  saasName: string;
  proposedSlug: string;
  proposedSubdomain: string;
  verticalId: SaasVerticalId;
  summary: string;
  targetAudience: string;
  mainProblem: string;
  mainGoal: string;
  packsByDepartment: {
    marketing?: DepartmentPackTier;
    accounting?: AccountingPackTier;
    support?: DepartmentPackTier;
    emailIntake?: AccountingPackTier;
    ops?: DepartmentPackTier;
    tax?: AccountingPackTier;
  };
  initialPricing: {
    currentMonthlyPrice: number;
    estimatedVendorCostMonthly?: number | null;
    recommendedMinPriceMonthly?: number | null;
    recommendedTargetPriceMonthly?: number | null;
    recommendedStretchPriceMonthly?: number | null;
  };
  aiProfile: {
    tier: AiTier;
    notes?: string;
  };
  campamentoBaseProfile?: {
    departmentsEnabled: DepartmentId[];
    packsByDepartment: Partial<Record<DepartmentId, AgentPackTier>>;
    ownerPricingIntent: OwnerPricingIntent;
    aiProfile: {
      preferredTier: AiTier;
      strategy: AiStrategy;
    };
  };
  knowledgeSeeds?: Array<{
    type: "BUSINESS_INFO" | "SERVICES" | "FAQ" | "LEGAL" | "MARKETING_POSITIONING";
    description: string;
  }>;
  initialFeatures?: string[];
  interviewSummary?: string;
  provisioning?: {
    domains: {
      primarySubdomain: string;
      primaryDomainType: "SUBDOMAIN_ONLY" | "CUSTOM_DOMAIN_ALLOWED";
      customDomainRequested?: string | null;
    };
    stripe: {
      billingInterval: "MONTHLY" | "YEARLY";
      taxProfile: "ES_AUTONOMO" | "ES_SL" | "OTHER";
      currency: string;
    };
    ai: {
      tier: AiTier;
      preferredProviders?: string[];
    };
  };
};

export type SaasProvisioningStatus = "PENDING" | "SUCCESS" | "ERROR";

export type SaasFactoryProvisioningResult = {
  status: SaasProvisioningStatus;
  message?: string;
  metadata?: Record<string, unknown> | null;
};
