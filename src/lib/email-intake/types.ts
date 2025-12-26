export type EmailClassification = "INVOICE" | "QUOTE" | "SUPPLIER" | "LEAD" | "OTHER";

export type EmailStatus = "NEW" | "REVIEWED" | "ARCHIVED" | "CONVERTED_TO_EXPENSE" | "CONVERTED_TO_LEAD";

export type SaasEmailMessage = {
  id: string;
  tenantId: string;
  saasId: string;
  fromAddress: string;
  fromName: string | null;
  toAddress: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  receivedAt: string;
  classification: EmailClassification;
  subType: string | null;
  status: EmailStatus;
  parsedAmount: number | null;
  parsedCurrency: string | null;
  parsedDueDate: string | null;
  parsedSupplierName: string | null;
  linkedExpenseId: string | null;
  linkedCustomerId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailIntakeSuggestion = {
  type: "EXPENSE" | "SUPPLIER" | "LEAD" | "OTHER";
  title: string;
  description: string;
  relatedExpenseId?: string;
  relatedInventoryItemId?: string;
  currentUnitCost?: number;
  offeredUnitCost?: number;
  monthlyUsageEstimate?: number;
  monthlySavingsEstimate?: number;
  savingsEstimate?: number;
  // Legacy fields kept for backward compatibility with earlier automation.
  estimatedMonthlyUsage?: number;
  estimatedMonthlySaving?: number;
};

export type EmailExpenseLinkResult = {
  message: string;
  createdExpense?: { id: string };
  updatedExpense?: { id: string };
};

export type EmailIntakeSnapshot = {
  countsByClassification: Record<EmailClassification, number>;
  countsByStatus: Record<EmailStatus, number>;
  latestMessages: SaasEmailMessage[];
  lastProcessedAt: string | null;
};
