export type SaasTaxPeriodStatus = "OPEN" | "CALCULATED" | "FILED";

export type SaasTaxPeriodType = "QUARTERLY" | "ANNUAL";

export type SaasTaxProfile = {
  id: string;
  tenantId: string;
  saasId: string;
  country: string;
  region: string | null;
  regime: string;
  defaultVatRate: number;
  reducedVatRate: number | null;
  superReducedVatRate: number | null;
  usesWithholding: boolean;
  withholdingRate: number;
  incomeTaxMode: "ESTIMATE_ONLY" | "NONE" | string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasTaxPeriod = {
  id: string;
  tenantId: string;
  saasId: string;
  periodType: SaasTaxPeriodType;
  periodKey: string;
  startDate: string;
  endDate: string;
  status: SaasTaxPeriodStatus;
  estimatedRevenue: number;
  estimatedExpenses: number;
  vatCollected: number;
  vatPaid: number;
  vatDue: number;
  incomeTaxBase: number;
  incomeTaxDue: number;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasTaxSummaryForSaas = {
  currentQuarterKey: string;
  currentQuarterVatDue: number;
  currentQuarterRevenue: number;
  currentQuarterExpenses: number;
  nextDeadline: string | null;
  status: "OK" | "TIGHT" | "RISK";
  notes: string | null;
};

export type OwnerTaxPortfolioSummary = {
  totalVatDueAllSaas: number;
  saasWithHighVat: number;
  saasWithNegativeMargin: number;
  items: Array<{
    saasId: string;
    vatDue: number;
    status: "OK" | "TIGHT" | "RISK";
    marginPercent?: number | null;
    periodKey: string;
  }>;
};
