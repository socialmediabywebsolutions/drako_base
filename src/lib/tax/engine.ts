import { listSaasExpenses, listSaasServices, resolveEconomyContext } from "@/lib/economy/repository";
import { listAppointmentsForSaas, resolveAppointmentsContext } from "@/lib/appointments/repository";
import { getSaasTaxProfile, getOrCreateTaxPeriod, listTaxPeriodsForSaas, resolveTaxContext, updateTaxPeriod } from "@/lib/tax/repository";
import type { DracoEnv } from "@/lib/cf";
import type { SaasTaxPeriod, SaasTaxProfile, SaasTaxSummaryForSaas } from "@/lib/tax/types";

export const DEFAULT_TAX_PROFILE: Omit<SaasTaxProfile, "id" | "tenantId" | "saasId" | "createdAt" | "updatedAt"> = {
  country: "ES",
  region: null,
  regime: "GENERAL",
  defaultVatRate: 21,
  reducedVatRate: 10,
  superReducedVatRate: 4,
  usesWithholding: true,
  withholdingRate: 7,
  incomeTaxMode: "ESTIMATE_ONLY",
  metadata: { demo: true },
};

const VAT_RISK_THRESHOLD = 1500;

function startOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  const startMonth = quarter * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), startMonth, 1, 0, 0, 0, 0));
}

function endOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  const endMonth = quarter * 3 + 2;
  const endDate = new Date(Date.UTC(date.getUTCFullYear(), endMonth + 1, 0, 23, 59, 59, 999));
  return endDate;
}

function buildQuarterKey(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getUTCFullYear()}Q${quarter}`;
}

function monthsBetween(start: Date, end: Date): number {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
}

function sumExpensesForPeriod(expenses: Awaited<ReturnType<typeof listSaasExpenses>>, start: Date, end: Date): number {
  return expenses.reduce((acc, expense) => {
    const from = new Date(expense.fromDate);
    const to = expense.toDate ? new Date(expense.toDate) : end;
    if (to < start || from > end) return acc;
    if (expense.period === "ONE_OFF") {
      if (from >= start && from <= end) return acc + expense.amount;
      return acc;
    }
    const effectiveStart = from > start ? from : start;
    const effectiveEnd = to < end ? to : end;
    const months = Math.max(1, monthsBetween(effectiveStart, effectiveEnd));
    const monthlyAmount = expense.period === "YEARLY" ? expense.amount / 12 : expense.amount;
    return acc + monthlyAmount * months;
  }, 0);
}

function estimateVatPortion(amount: number, rate: number): number {
  if (rate <= 0) return 0;
  return (amount * rate) / (100 + rate);
}

async function ensureProfile(ctx: Awaited<ReturnType<typeof resolveTaxContext>>): Promise<SaasTaxProfile> {
  const existing = await getSaasTaxProfile(ctx);
  if (existing) return existing;
  const now = new Date().toISOString();
  return {
    id: "tax_profile_default",
    tenantId: ctx.tenantId,
    saasId: ctx.saasId ?? "",
    createdAt: now,
    updatedAt: now,
    ...DEFAULT_TAX_PROFILE,
  };
}

async function recalculateTaxPeriodInternal(
  params: {
    tenantId: string;
    saasId: string;
    env?: DracoEnv | null;
  },
  profile: SaasTaxProfile,
  period: SaasTaxPeriod,
): Promise<SaasTaxPeriod> {
  const economyCtx = await resolveEconomyContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const appointmentsCtx = await resolveAppointmentsContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const expenses = await listSaasExpenses(economyCtx);
  const services = await listSaasServices(economyCtx);
  const serviceMap = new Map(services.map((service) => [service.id, service.currentPrice]));

  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  const appointments = await listAppointmentsForSaas(appointmentsCtx, { from: period.startDate, to: period.endDate });
  const revenue = appointments
    .filter((appt) => appt.status === "DONE" || appt.status === "CONFIRMED")
    .reduce((acc, appt) => acc + (appt.priceAtBooking ?? serviceMap.get(appt.serviceId) ?? 0), 0);

  const expenseTotal = sumExpensesForPeriod(expenses, start, end);
  const vatCollected = estimateVatPortion(revenue, profile.defaultVatRate);
  const vatPaid = estimateVatPortion(expenseTotal, profile.defaultVatRate);
  const vatDue = vatCollected - vatPaid;
  const incomeTaxBase = revenue - expenseTotal;
  const incomeTaxDue = profile.usesWithholding && profile.incomeTaxMode !== "NONE" && incomeTaxBase > 0
    ? (incomeTaxBase * profile.withholdingRate) / 100
    : 0;

  const notes = "Estimación demo. No equivale a una declaración oficial.";

  const taxCtx = await resolveTaxContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const updated = await updateTaxPeriod(
    taxCtx,
    {
      id: period.id,
      periodType: period.periodType,
      periodKey: period.periodKey,
      startDate: period.startDate,
      endDate: period.endDate,
    },
    {
      estimatedRevenue: revenue,
      estimatedExpenses: expenseTotal,
      vatCollected,
      vatPaid,
      vatDue,
      incomeTaxBase,
      incomeTaxDue,
      status: "CALCULATED",
      notes,
      metadata: { vatRate: profile.defaultVatRate, demo: true },
    },
  );
  return updated;
}

export async function getSaasTaxSummary(params: { tenantId: string; saasId: string; env?: DracoEnv | null }): Promise<SaasTaxSummaryForSaas> {
  const taxCtx = await resolveTaxContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const profile = await ensureProfile(taxCtx);
  const now = new Date();
  const quarterKey = buildQuarterKey(now);
  const start = startOfQuarter(now);
  const end = endOfQuarter(now);
  const period = await getOrCreateTaxPeriod(taxCtx, {
    periodType: "QUARTERLY",
    periodKey: quarterKey,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });
  const recalculated = await recalculateTaxPeriodInternal(params, profile, period);
  const margin = recalculated.estimatedRevenue > 0 ? ((recalculated.estimatedRevenue - recalculated.estimatedExpenses) / recalculated.estimatedRevenue) * 100 : 0;
  const status = recalculated.vatDue > VAT_RISK_THRESHOLD || margin < 15 ? "RISK" : recalculated.vatDue > 0 ? "TIGHT" : "OK";
  const nextDeadline = new Date(Date.parse(recalculated.endDate) + 1000 * 60 * 60 * 24 * 20).toISOString();
  return {
    currentQuarterKey: quarterKey,
    currentQuarterVatDue: recalculated.vatDue,
    currentQuarterRevenue: recalculated.estimatedRevenue,
    currentQuarterExpenses: recalculated.estimatedExpenses,
    nextDeadline,
    status,
    notes: recalculated.notes,
  };
}

export async function recalculateCurrentQuarter(params: { tenantId: string; saasId: string; env?: DracoEnv | null }): Promise<SaasTaxPeriod> {
  const taxCtx = await resolveTaxContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const profile = await ensureProfile(taxCtx);
  const now = new Date();
  const quarterKey = buildQuarterKey(now);
  const period = await getOrCreateTaxPeriod(taxCtx, {
    periodType: "QUARTERLY",
    periodKey: quarterKey,
    startDate: startOfQuarter(now).toISOString(),
    endDate: endOfQuarter(now).toISOString(),
  });
  return recalculateTaxPeriodInternal(params, profile, period);
}

export async function listTaxPeriodsWithSummary(params: { tenantId: string; saasId: string; env?: DracoEnv | null }): Promise<SaasTaxPeriod[]> {
  const taxCtx = await resolveTaxContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  return listTaxPeriodsForSaas(taxCtx, { periodType: "QUARTERLY" });
}
