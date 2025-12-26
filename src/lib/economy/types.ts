export type SaasServiceCategory = "HAIR_SERVICE" | "BEAUTY_SERVICE" | "CONSULTING" | "OTHER";

export type SaasInventoryCategory = "HAIR_DYE" | "OXIDANT" | "SHAMPOO" | "TOOL" | "OTHER";

export type SaasExpenseType =
  | "RENT"
  | "UTILITIES"
  | "PAYROLL"
  | "PRODUCTS"
  | "MARKETING"
  | "OTHER_FIXED"
  | "OTHER_VARIABLE";

export type SaasExpensePeriod = "MONTHLY" | "YEARLY" | "ONE_OFF";

export type SaasExpenseSource = "MANUAL" | "INVOICE_EMAIL" | "IMPORT";

export type SaasInventoryMovementType = "IN" | "OUT" | "ADJUST";

export type SaasInventoryMovementSource = "PURCHASE" | "SERVICE_USAGE" | "MANUAL_ADJUST" | "WASTE";

export type ServicePhase = {
  id: string;
  label: string;
  phaseType: "APPLY" | "PROCESS" | "RINSE" | "STYLE" | string;
  durationMinutes: number;
};

export type SaasService = {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  slug: string;
  category: SaasServiceCategory | "OTHER" | string | null;
  durationMinutes: number;
  currentPrice: number;
  recommendedPrice: number | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasInventoryItem = {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  sku: string | null;
  category: SaasInventoryCategory | "OTHER" | string | null;
  unit: string | null;
  costPerUnit: number;
  stockQuantity: number;
  minStockQuantity: number;
  preferredSupplier: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasInventoryMovement = {
  id: string;
  tenantId: string;
  saasId: string;
  inventoryItemId: string;
  type: SaasInventoryMovementType;
  quantity: number;
  reason: string | null;
  source: SaasInventoryMovementSource | null;
  relatedServiceId: string | null;
  relatedEmployeeId: string | null;
  createdAt: string;
};

export type SaasExpense = {
  id: string;
  tenantId: string;
  saasId: string;
  type: SaasExpenseType;
  label: string;
  amount: number;
  currency: string;
  period: SaasExpensePeriod;
  fromDate: string;
  toDate: string | null;
  source: SaasExpenseSource | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasPricingSettings = {
  id: string;
  tenantId: string;
  saasId: string;
  targetMarginPercent: number;
  minMarginPercent: number;
  occupancyTargetPercent: number;
  includePayroll: boolean;
  includeRent: boolean;
  includeUtilities: boolean;
  includeProducts: boolean;
  updatedAt: string;
};

export type SaasServiceProduct = {
  id: string;
  tenantId: string;
  saasId: string;
  serviceId: string;
  inventoryItemId: string;
  quantityPerService: number;
  metadata: Record<string, unknown> | null;
};

export type SaasProfitabilitySnapshot = {
  totalRevenue: number;
  totalCosts: number;
  productCosts: number;
  rentCosts: number;
  utilitiesCosts: number;
  payrollCosts: number;
  marginPercent: number;
  targetMarginPercent: number;
  estimatedMonthlyRevenue: number;
  estimatedMonthlyCosts: number;
  canHireAdvice: string;
};
