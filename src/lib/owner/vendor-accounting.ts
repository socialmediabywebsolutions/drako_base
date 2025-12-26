import { getDemoOwner } from "@/lib/admin/demo-data";
import { queryAll } from "@/lib/db";
import { buildOwnerAccountingSnapshot } from "@/lib/owner/accounting";
import { getVendorMonthlyAggregates, listVendorExpenses, resolveVendorExpensesContext } from "@/lib/owner/vendor-expenses";
import type { DracoEnv } from "@/lib/cf";
import type { OwnerSaasAccountingRow } from "@/lib/owner/accounting";
import type {
  DrakoVendorAccountingSnapshot,
  DrakoVendorExpensesByType,
  DrakoVendorExpensesByVertical,
  DrakoVendorExpenseType,
  DrakoVendorMarginByVertical,
  DrakoVendorPerSaasCostEstimate,
} from "@/lib/owner/vendor-types";

type OwnerRow = {
  id: string;
};

function formatMonth(value: Date): string {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function shiftMonth(base: Date, offset: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
}

function sumTotalsForMonth(items: Array<{ month: string; total: number }>, month: string): number {
  return items.filter((item) => item.month === month).reduce((acc, item) => acc + item.total, 0);
}

function buildMonthRange(date: Date): { monthStart: Date; monthEnd: Date; monthKey: string } {
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const monthKey = formatMonth(monthStart);
  return { monthStart, monthEnd, monthKey };
}

function isExpenseInMonth(fromDate: string, toDate: string | null, monthStart: Date, monthEnd: Date, period: string): boolean {
  const from = new Date(fromDate);
  if (Number.isNaN(from.getTime())) return false;
  if (from > monthEnd) return false;
  if (toDate) {
    const to = new Date(toDate);
    if (!Number.isNaN(to.getTime()) && to < monthStart) return false;
  }
  if (period === "ONE_OFF") {
    return from >= monthStart && from <= monthEnd;
  }
  return true;
}

function toShare(amount: number, total: number): number {
  if (total <= 0) return 0;
  return amount / total;
}

async function resolveOwnerId(tenantId: string): Promise<string | null> {
  const rows = await queryAll<OwnerRow>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", tenantId);
  if (rows[0]?.id) return rows[0].id;
  return getDemoOwner(tenantId)?.id ?? null;
}

function toExpensesByType(
  byType: Array<{ month: string; type: DrakoVendorExpenseType; total: number }>,
  month: string,
  total: number,
): DrakoVendorExpensesByType[] {
  return byType
    .filter((item) => item.month === month)
    .map((item) => ({
      type: item.type,
      amount: item.total,
      share: toShare(item.total, total),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function toExpensesByVertical(
  byVertical: Array<{ month: string; verticalId: string | null; total: number }>,
  month: string,
  total: number,
): DrakoVendorExpensesByVertical[] {
  return byVertical
    .filter((item) => item.month === month)
    .map((item) => ({
      verticalId: item.verticalId,
      amount: item.total,
      share: toShare(item.total, total),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildMarginByVertical(params: {
  revenueByVertical: Map<string | null, number>;
  expensesByVertical: Map<string | null, number>;
}): DrakoVendorMarginByVertical[] {
  const verticalIds = new Set<string | null>();
  params.revenueByVertical.forEach((_, key) => verticalIds.add(key));
  params.expensesByVertical.forEach((_, key) => verticalIds.add(key));

  const rows: DrakoVendorMarginByVertical[] = [];
  verticalIds.forEach((verticalId) => {
    const revenue = params.revenueByVertical.get(verticalId) ?? 0;
    const vendorCosts = params.expensesByVertical.get(verticalId) ?? 0;
    const margin = revenue - vendorCosts;
    const marginRate = revenue > 0 ? margin / revenue : 0;
    rows.push({
      verticalId,
      revenue,
      vendorCosts,
      margin,
      marginRate,
    });
  });

  return rows.sort((a, b) => b.marginRate - a.marginRate);
}

function buildNotes(params: {
  marginByVertical: DrakoVendorMarginByVertical[];
  expensesByType: DrakoVendorExpensesByType[];
  totalSaas: number;
  saasCountByVertical: Map<string | null, number>;
}): string[] {
  const notes: string[] = [];
  const marginCriticalThreshold = 0.3;
  const marginWarningThreshold = 0.5;
  const marginHealthyThreshold = 0.7;
  const aiShareWarningThreshold = 0.35;
  const targetCostPerSaas = { min: 80, max: 120 };
  const targetCostByType: Record<string, { min: number; max: number }> = {
    INFRA: { min: 15, max: 25 },
    AI: { min: 25, max: 40 },
    SUPPORT: { min: 30, max: 50 },
    TEAM: { min: 30, max: 50 },
    OTHER: { min: 10, max: 20 },
  };

  for (const row of params.marginByVertical) {
    const label = row.verticalId ?? "UNASSIGNED";
    if (row.revenue > 0 && row.marginRate < marginCriticalThreshold) {
      notes.push(`Vertical ${label}: margen critico (<30%). Revisa precio de plan o costes IA/INFRA.`);
    } else if (row.revenue > 0 && row.marginRate < marginWarningThreshold) {
      notes.push(`Vertical ${label}: margen bajo (30-50%). Ajusta pricing o modulos activos.`);
    } else if (row.revenue > 0 && row.marginRate > marginHealthyThreshold) {
      notes.push(`Vertical ${label}: margen muy sano (>70%). Oportunidad de upsell en modulos.`);
    }

    const saasCount = params.saasCountByVertical.get(row.verticalId ?? "OTHER") ?? 0;
    if (saasCount > 0) {
      const costPerSaas = row.vendorCosts / saasCount;
      if (costPerSaas > targetCostPerSaas.max) {
        notes.push(`Vertical ${label}: coste vendor por SaaS ${costPerSaas.toFixed(0)} € (objetivo 80-120 €).`);
      }
    }
  }

  const totalExpenses = params.expensesByType.reduce((acc, entry) => acc + entry.amount, 0);
  if (totalExpenses > 0) {
    const aiEntry = params.expensesByType.find((entry) => entry.type === "AI");
    const aiShare = aiEntry ? aiEntry.amount / totalExpenses : 0;
    if (aiShare >= aiShareWarningThreshold) {
      notes.push(`AI representa ${(aiShare * 100).toFixed(0)}% del gasto vendor. Optimiza modelos o prompts.`);
    }
  }

  if (params.totalSaas > 0) {
    for (const entry of params.expensesByType) {
      const target = targetCostByType[entry.type];
      if (!target) continue;
      const perSaas = entry.amount / params.totalSaas;
      if (perSaas > target.max) {
        notes.push(`Coste ${entry.type} por SaaS ${perSaas.toFixed(0)} € (objetivo ${target.min}-${target.max} €).`);
      }
    }
  }

  return notes;
}

export async function getDrakoVendorAccountingSnapshot(params: {
  tenantId: string;
  ownerId?: string | null;
  env?: DracoEnv | null;
}): Promise<DrakoVendorAccountingSnapshot> {
  const ownerId = params.ownerId ?? (await resolveOwnerId(params.tenantId));
  if (!ownerId) {
    return {
      totalVendorExpensesThisMonth: 0,
      totalVendorExpensesLastMonth: 0,
      vendorExpensesByType: [],
      vendorExpensesByVertical: [],
      estimatedMarginByVertical: [],
      notes: ["Owner not found for vendor snapshot."],
    };
  }

  const ctx = await resolveVendorExpensesContext({ tenantId: params.tenantId, env: params.env });
  const now = new Date();
  const currentMonth = formatMonth(now);
  const lastMonth = formatMonth(shiftMonth(now, -1));

  const aggregates = await getVendorMonthlyAggregates(ctx, { from: lastMonth, to: currentMonth });
  const totalVendorExpensesThisMonth = sumTotalsForMonth(aggregates.byType, currentMonth);
  const totalVendorExpensesLastMonth = sumTotalsForMonth(aggregates.byType, lastMonth);

  const vendorExpensesByType = toExpensesByType(aggregates.byType, currentMonth, totalVendorExpensesThisMonth);
  const vendorExpensesByVertical = toExpensesByVertical(aggregates.byVertical, currentMonth, totalVendorExpensesThisMonth);

  const accounting = await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId });
  const revenueByVertical = new Map<string | null, number>();
  accounting.verticalBreakdown.forEach((item) => {
    revenueByVertical.set(item.vertical ?? "OTHER", item.mrr);
  });

  const expensesByVertical = new Map<string | null, number>();
  vendorExpensesByVertical.forEach((item) => {
    expensesByVertical.set(item.verticalId, item.amount);
  });

  const estimatedMarginByVertical = buildMarginByVertical({ revenueByVertical, expensesByVertical });
  const saasCountByVertical = new Map<string | null, number>();
  accounting.verticalBreakdown.forEach((item) => {
    saasCountByVertical.set(item.vertical ?? "OTHER", item.saasCount);
  });
  const notes = buildNotes({
    marginByVertical: estimatedMarginByVertical,
    expensesByType: vendorExpensesByType,
    totalSaas: accounting.totalSaas,
    saasCountByVertical,
  });

  return {
    totalVendorExpensesThisMonth,
    totalVendorExpensesLastMonth,
    vendorExpensesByType,
    vendorExpensesByVertical,
    estimatedMarginByVertical,
    notes,
  };
}

export async function estimateVendorCostsPerSaas(params: {
  tenantId: string;
  ownerId?: string | null;
  env?: DracoEnv | null;
  rows?: OwnerSaasAccountingRow[];
}): Promise<DrakoVendorPerSaasCostEstimate[]> {
  let accountingRows = params.rows;
  if (!accountingRows) {
    const ownerId = params.ownerId ?? (await resolveOwnerId(params.tenantId));
    if (!ownerId) return [];
    const accounting = await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId });
    accountingRows = accounting.rows;
  }
  if (accountingRows.length === 0) return [];

  const ctx = await resolveVendorExpensesContext({ tenantId: params.tenantId, env: params.env });
  const expenses = await listVendorExpenses(ctx);
  const { monthStart, monthEnd } = buildMonthRange(new Date());

  const aiByVertical = new Map<string | null, number>();
  const infraByVertical = new Map<string | null, number>();
  const supportByVertical = new Map<string | null, number>();
  const otherByVertical = new Map<string | null, number>();

  for (const expense of expenses) {
    if (!isExpenseInMonth(expense.fromDate, expense.toDate, monthStart, monthEnd, expense.period)) continue;
    const monthlyAmount = expense.period === "YEARLY" ? expense.amount / 12 : expense.amount;
    const verticalKey = expense.verticalId ?? null;
    if (expense.type === "AI") {
      aiByVertical.set(verticalKey, (aiByVertical.get(verticalKey) ?? 0) + monthlyAmount);
    }
    if (expense.type === "INFRA") {
      infraByVertical.set(verticalKey, (infraByVertical.get(verticalKey) ?? 0) + monthlyAmount);
    }
    if (expense.type === "SUPPORT" || expense.type === "TEAM") {
      supportByVertical.set(verticalKey, (supportByVertical.get(verticalKey) ?? 0) + monthlyAmount);
    }
    if (expense.type === "OTHER") {
      otherByVertical.set(verticalKey, (otherByVertical.get(verticalKey) ?? 0) + monthlyAmount);
    }
  }

  const saasCountByVertical = new Map<string | null, number>();
  accountingRows.forEach((row) => {
    const key = row.vertical ?? "OTHER";
    saasCountByVertical.set(key, (saasCountByVertical.get(key) ?? 0) + 1);
  });

  const globalAi = aiByVertical.get(null) ?? 0;
  const globalInfra = infraByVertical.get(null) ?? 0;
  const globalSupport = supportByVertical.get(null) ?? 0;
  const globalOther = otherByVertical.get(null) ?? 0;

  const totalSaas = accountingRows.length;
  const perSaasInfra = totalSaas > 0 ? globalInfra / totalSaas : 0;
  const perSaasSupport = totalSaas > 0 ? globalSupport / totalSaas : 0;
  const perSaasOther = totalSaas > 0 ? globalOther / totalSaas : 0;
  const perSaasAiGlobal = totalSaas > 0 ? globalAi / totalSaas : 0;

  return accountingRows.map((row) => {
    const verticalKey = row.vertical ?? "OTHER";
    const saasCount = saasCountByVertical.get(verticalKey) ?? 1;
    const aiVertical = (aiByVertical.get(verticalKey) ?? 0) / saasCount;
    const infraVertical = (infraByVertical.get(verticalKey) ?? 0) / saasCount;
    const supportVertical = (supportByVertical.get(verticalKey) ?? 0) / saasCount;
    const otherVertical = (otherByVertical.get(verticalKey) ?? 0) / saasCount;
    const aiCostMonthly = aiVertical + perSaasAiGlobal;
    const infraCostMonthly = perSaasInfra + infraVertical;
    const supportCostMonthly = perSaasSupport + supportVertical;
    const otherCostMonthly = perSaasOther + otherVertical;
    const totalVendorCostMonthly = aiCostMonthly + infraCostMonthly + supportCostMonthly + otherCostMonthly;
    return {
      saasId: row.saasId,
      saasName: row.saasName,
      verticalId: verticalKey,
      infraCostMonthly,
      aiCostMonthly,
      supportCostMonthly,
      otherCostMonthly,
      totalVendorCostMonthly,
    };
  });
}
