export type DrakoVerticalId = "SALON" | "CLINIC" | "PET_GROOMING" | "LAUNDRY" | "OTHER";

export type DrakoVerticalHealth = "HEALTHY" | "TIGHT" | "AT_RISK";

export type DrakoVerticalSnapshot = {
  verticalId: DrakoVerticalId;
  verticalLabel: string;
  saasCount: number;
  activeSaasCount: number;
  churnRiskLevel: "LOW" | "MEDIUM" | "HIGH";
  mrr: number;
  arr: number;
  avgMrrPerSaas: number;
  vendorCostsMonthly: number;
  vendorMarginPercent: number;
  health: DrakoVerticalHealth;
  notes?: string;
};

export type DrakoVendorExpenseType = "INFRA" | "AI" | "MARKETING" | "SUPPORT" | "TEAM" | "OTHER";

export type DrakoVendorExpensePeriod = "MONTHLY" | "YEARLY" | "ONE_OFF";

export type DrakoVendorExpense = {
  id: string;
  label: string;
  type: DrakoVendorExpenseType;
  amount: number;
  currency: string;
  period: DrakoVendorExpensePeriod;
  fromDate: string;
  toDate: string | null;
  verticalId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type DrakoVendorExpenseInput = {
  id?: string;
  label: string;
  type: DrakoVendorExpenseType;
  amount: number;
  currency: string;
  period: DrakoVendorExpensePeriod;
  fromDate: string;
  toDate?: string | null;
  verticalId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DrakoVendorExpenseFilters = {
  from?: string;
  to?: string;
  period?: DrakoVendorExpensePeriod;
  type?: DrakoVendorExpenseType;
  verticalId?: string | null;
};

export type DrakoVendorTaxSummary = {
  totalQuarterlyTaxEstimated: number;
  totalQuarterlyTaxByVertical: Record<DrakoVerticalId, number>;
  notes?: string;
};

export type DrakoVendorSnapshot = {
  totalMrr: number;
  totalArr: number;
  totalSaasCount: number;
  verticals: DrakoVerticalSnapshot[];
  taxSummary?: DrakoVendorTaxSummary;
  riskLevelGlobal: "LOW" | "MEDIUM" | "HIGH";
  opportunityLevelGlobal: "LOW" | "MEDIUM" | "HIGH";
  recommendations: string[];
};

export type DrakoVendorExpensesByType = {
  type: DrakoVendorExpenseType;
  amount: number;
  share: number;
};

export type DrakoVendorExpensesByVertical = {
  verticalId: string | null;
  amount: number;
  share: number;
};

export type DrakoVendorMarginByVertical = {
  verticalId: string | null;
  revenue: number;
  vendorCosts: number;
  margin: number;
  marginRate: number;
};

export type DrakoVendorAccountingSnapshot = {
  totalVendorExpensesThisMonth: number;
  totalVendorExpensesLastMonth: number;
  vendorExpensesByType: DrakoVendorExpensesByType[];
  vendorExpensesByVertical: DrakoVendorExpensesByVertical[];
  estimatedMarginByVertical: DrakoVendorMarginByVertical[];
  notes: string[];
};

export type DrakoVendorPerSaasCostEstimate = {
  saasId: string;
  saasName: string;
  verticalId: string | null;
  infraCostMonthly: number;
  aiCostMonthly: number;
  supportCostMonthly: number;
  otherCostMonthly: number;
  totalVendorCostMonthly: number;
};

export type DrakoBaselineNeedCategory = "LIFE" | "WORK";

export type DrakoBaselineNeed = {
  id: string;
  tenantId: string;
  label: string;
  category: DrakoBaselineNeedCategory;
  amountMonthly: number;
  currency: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type DrakoBaselineSnapshot = {
  lifeTotalMonthly: number;
  workTotalMonthly: number;
  baselineTotalMonthly: number;
  items: DrakoBaselineNeed[];
};

export type DrakoTreasuryAccountType = "TAX_RESERVE" | "INFRA_RESERVE" | "AI_RESERVE" | "PERSONAL_SPENDING" | "GENERAL";

export type DrakoTreasuryAccountBalance = {
  accountId: string;
  label: string;
  type: DrakoTreasuryAccountType;
  balance: number;
};

export type DrakoTreasurySnapshot = {
  accounts: DrakoTreasuryAccountBalance[];
  totalBalance: number;
  taxReserveBalance: number;
  infraReserveBalance: number;
  aiReserveBalance: number;
  personalSpendingBalance: number;
  recommendedTaxReserveThisQuarter: number;
  recommendedInfraReserveThisMonth: number;
  recommendedAiReserveThisMonth: number;
  taxReserveGap: number;
  infraReserveGap: number;
  aiReserveGap: number;
};
